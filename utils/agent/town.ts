import { Character, Scene, Novel, Plot } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

export interface TownState {
    novelId: number;
    currentTime: Date;
    speed: number;
    isRunning: boolean;
}

export interface CharacterState {
    character: Character;
    currentSceneId: number;
    currentSceneName: string;
    lastAction: string;
    lastActionTime: Date;
    status: 'idle' | 'moving' | 'talking' | 'observing';
}

export interface PlotExecutionResult {
    type: 'plot_start' | 'narration' | 'dialogue' | 'plot_complete' | 'novel_complete' | 'wait';
    plotId?: number;
    plotTitle?: string;
    characterId?: number;
    characterName?: string;
    content?: string;
    sceneId?: number;
    sceneName?: string;
    allDialogues?: string[];
    currentDialogueIndex?: number;
    memoryContent?: string;
}

export class TownSimulator {
    private prisma: PrismaClient;
    private novel: Novel | null = null;
    private characters: Character[] = [];
    private scenes: Scene[] = [];
    private plots: Plot[] = [];
    private characterStates: Map<number, CharacterState> = new Map();
    private currentTime: Date;
    private speed: number = 1;
    private currentPlotIndex: number = 0;
    private currentDialogueIndex: number = 0;
    private characterMemoryBuffer: Map<number, string[]> = new Map();
    private novelCompleted: boolean = false;

    constructor(prismaClient: PrismaClient) {
        this.prisma = prismaClient;
        this.currentTime = new Date();
    }

    async initialize(novelId: number) {
        this.novel = await this.prisma.novel.findUnique({ where: { id: novelId } });
        this.characters = await this.prisma.character.findMany({ where: { novelId } });
        this.scenes = await this.prisma.scene.findMany({ where: { novelId, isActive: true } });
        this.plots = await this.prisma.plot.findMany({
            where: { novelId },
            orderBy: [
                { chapterIndex: 'asc' },
                { sceneIndex: 'asc' }
            ]
        });

        this.currentPlotIndex = 0;
        this.currentDialogueIndex = 0;
        this.novelCompleted = false;

        // 尝试从 TownStatus 恢复进度
        const townStatus = await this.prisma.townStatus.findUnique({
            where: { novelId }
        });

        if (townStatus) {
            // 恢复保存的进度
            this.currentPlotIndex = townStatus.currentPlotIndex || 0;
            this.currentDialogueIndex = townStatus.currentDialogueIndex || 0;
            this.speed = townStatus.speed || 1;
            console.log(`[恢复进度] 情节索引: ${this.currentPlotIndex}, 对话索引: ${this.currentDialogueIndex}`);
        } else {
            // 如果没有保存的进度，从已完成的情节计算
            const completedPlots = await this.prisma.plot.findMany({
                where: { novelId, isCompleted: true },
                orderBy: [
                    { chapterIndex: 'asc' },
                    { sceneIndex: 'asc' }
                ]
            });

            if (completedPlots.length > 0) {
                const lastCompletedPlot = completedPlots[completedPlots.length - 1];
                const lastCompletedIndex = this.plots.findIndex(p => p.id === lastCompletedPlot.id);
                if (lastCompletedIndex !== -1) {
                    this.currentPlotIndex = lastCompletedIndex + 1;
                }
            }
        }

        for (const char of this.characters) {
            this.characterMemoryBuffer.set(char.id, []);
            await this.prisma.memory.findMany({
                where: { characterId: char.id },
                orderBy: { timestamp: 'desc' },
                take: 50
            });

            const charFromDb = await this.prisma.character.findUnique({
                where: { id: char.id }
            });
            const savedScene = charFromDb?.currentScene || '小镇广场';
            const sceneObj = this.scenes.find(s => s.name === savedScene) || this.scenes[0];

            this.characterStates.set(char.id, {
                character: char,
                currentSceneId: sceneObj?.id || 1,
                currentSceneName: savedScene,
                lastAction: '初始化',
                lastActionTime: new Date(),
                status: 'idle'
            });
        }

        if (this.currentPlotIndex >= this.plots.length) {
            this.novelCompleted = true;
        }

        console.log(`小镇模拟器初始化完成: ${this.characters.length} 个角色, ${this.plots.length} 个情节`);
        console.log(`当前情节索引: ${this.currentPlotIndex}/${this.plots.length}, 小说完成: ${this.novelCompleted}`);
    }

    setSpeed(speed: number) {
        this.speed = speed;
    }

    // 保存模拟进度到数据库
    async saveProgress() {
        if (!this.novel) return;

        await this.prisma.townStatus.upsert({
            where: { novelId: this.novel.id },
            update: {
                currentPlotIndex: this.currentPlotIndex,
                currentDialogueIndex: this.currentDialogueIndex,
                speed: this.speed,
                lastUpdateTime: new Date()
            },
            create: {
                novelId: this.novel.id,
                currentPlotIndex: this.currentPlotIndex,
                currentDialogueIndex: this.currentDialogueIndex,
                speed: this.speed,
                isRunning: true
            }
        });

        console.log(`[保存进度] 情节索引: ${this.currentPlotIndex}, 对话索引: ${this.currentDialogueIndex}`);
    }

    advanceTime(minutes: number = 10) {
        const advanceMs = minutes * 60 * 1000 / this.speed;
        this.currentTime = new Date(this.currentTime.getTime() + advanceMs);
    }

    async executePlotDialogue(plot: Plot): Promise<PlotExecutionResult | null> {
        let dialogueContent: string[] = [];
        try {
            dialogueContent = JSON.parse(plot.dialogueContent || '[]');
        } catch {
            dialogueContent = [];
        }

        // 因为在 runSimulationStep 中，情节开始时将 currentDialogueIndex 设置为了 1，所以这里要减 1 才是真实的数组索引
        const actualIndex = this.currentDialogueIndex - 1;

        if (actualIndex < 0 || actualIndex >= dialogueContent.length) {
            return null;
        }

        const currentDialogue = dialogueContent[actualIndex];
        this.currentDialogueIndex++;

        const involvedCharacterIds: number[] = [];
        try {
            const ids = JSON.parse(plot.involvedCharacterIds || '[]');
            involvedCharacterIds.push(...ids);
        } catch (_e) { /* ignore parse error */ }

        let speakerName = '旁白';
        let speakerId = 0;
        let dialogueTypeTag = '';
        let actualDialogueText = currentDialogue;

        // 尝试提取话剧改编标签 [完全按照情节] 或 [改编] 或 [补充]
        const tagMatch = currentDialogue.match(/^[\[【]([^\]】]+)[\]】]\s*(.*)$/);
        if (tagMatch) {
            dialogueTypeTag = tagMatch[1].trim();
            actualDialogueText = tagMatch[2].trim();
        }

        // 提取角色名
        const charNameMatch = actualDialogueText.match(/^([^：:】\s]+)[:：】]+\s*(.*)$/);
        if (charNameMatch) {
            let speakerNameStr = charNameMatch[1].trim();
            if (speakerNameStr.startsWith('【')) speakerNameStr = speakerNameStr.slice(1);
            if (speakerNameStr.endsWith('】')) speakerNameStr = speakerNameStr.slice(0, -1);
            if (speakerNameStr.startsWith('（')) speakerNameStr = speakerNameStr.slice(1);
            if (speakerNameStr.endsWith('）')) speakerNameStr = speakerNameStr.slice(0, -1);
            if (speakerNameStr.startsWith('(')) speakerNameStr = speakerNameStr.slice(1);
            if (speakerNameStr.endsWith(')')) speakerNameStr = speakerNameStr.slice(0, -1);

            let text = charNameMatch[2].trim();
            // 去除包裹的单双引号
            if ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"')) || (text.startsWith('“') && text.endsWith('”'))) {
                text = text.slice(1, -1);
            }
            actualDialogueText = text;

            // 特殊处理一些包含动作的对话，比如 角色：（动作）对话
            const actionWithDialogueMatch = actualDialogueText.match(/^（(.*?)）(.*)$/);
            if (actionWithDialogueMatch) {
                // 如果对话开头包含动作，保留它作为对话的一部分，渲染时也会展示出来
                // 这部分已经是标准话剧格式了
            }

            const speaker = this.characters.find(c => c.name === speakerNameStr || speakerNameStr.includes(c.name) || c.name.includes(speakerNameStr));
            if (speaker) {
                speakerName = speaker.name;
                speakerId = speaker.id;
            } else {
                speakerName = speakerNameStr;
            }
        } else {
            // 如果没有匹配到角色名，尝试提取旁白或环境动作的特殊格式
            const envMatch = actualDialogueText.match(/^（(.*)）$/) || actualDialogueText.match(/^\((.*)\)$/);
            if (envMatch) {
                actualDialogueText = envMatch[1];
                if (!dialogueTypeTag) dialogueTypeTag = '动作';
            } else if ((actualDialogueText.startsWith("'") && actualDialogueText.endsWith("'")) || (actualDialogueText.startsWith('"') && actualDialogueText.endsWith('"')) || (actualDialogueText.startsWith('“') && actualDialogueText.endsWith('”'))) {
                actualDialogueText = actualDialogueText.slice(1, -1);
            } else if (actualDialogueText.startsWith('【音效】')) {
                actualDialogueText = actualDialogueText.replace('【音效】', '').trim();
                if (!dialogueTypeTag) dialogueTypeTag = '音效';
            }
        }

        const memoryContent = `[情节片段] ${plot.title}：${currentDialogue}`;

        let eventType = 'dialogue';
        if (dialogueTypeTag === '音效') {
            eventType = 'narration';
            speakerName = '环境';
        } else if (dialogueTypeTag === '动作') {
            eventType = 'action';
            if (speakerName === '旁白') speakerName = '舞台';
        } else if (speakerName === '旁白') {
            eventType = 'narration';
            if (actualDialogueText.startsWith('（') || actualDialogueText.startsWith('(')) {
                eventType = 'action';
                speakerName = '舞台';
            }
        }

        let dbCharacterId: number | null = speakerId || null;
        if (speakerName === '环境' || speakerName === '舞台' || speakerName === '系统' || speakerName === '旁白') {
            dbCharacterId = null;
        }

        for (const charId of involvedCharacterIds) {
            const buffer = this.characterMemoryBuffer.get(charId) || [];
            buffer.push(memoryContent);
            this.characterMemoryBuffer.set(charId, buffer);
        }

        if (speakerId > 0 && eventType === 'dialogue') {
            const state = this.characterStates.get(speakerId);
            if (state) {
                state.lastAction = actualDialogueText;
                state.lastActionTime = new Date();
                state.status = 'talking';
            }
        } else if (speakerId > 0 && eventType === 'action') {
            const state = this.characterStates.get(speakerId);
            if (state) {
                state.lastAction = actualDialogueText;
                state.lastActionTime = new Date();
                state.status = 'moving';
            }
        }

        // 去除外层的括号
        if ((actualDialogueText.startsWith('(') && actualDialogueText.endsWith(')')) || (actualDialogueText.startsWith('（') && actualDialogueText.endsWith('）'))) {
            actualDialogueText = actualDialogueText.slice(1, -1);
            if (!dialogueTypeTag && speakerName === '旁白') {
                dialogueTypeTag = '动作';
            }
        }

        let eventContent = actualDialogueText;

        // 确保不要包含冗余的角色名
        if (eventContent.startsWith(speakerName + '：')) {
            eventContent = eventContent.slice(speakerName.length + 1).trim();
        } else if (eventContent.startsWith(speakerName + ':')) {
            eventContent = eventContent.slice(speakerName.length + 1).trim();
        }

        // 进一步去除可能包含的角色名字前缀以防重复显示，比如 小红帽：（动作）台词
        const colonIndex = eventContent.indexOf('：');
        const asciiColonIndex = eventContent.indexOf(':');

        if (colonIndex !== -1 && (colonIndex < 15)) {
            const prefix = eventContent.slice(0, colonIndex).trim();
            if (prefix === speakerName || speakerName.includes(prefix)) {
                eventContent = eventContent.slice(colonIndex + 1).trim();
            }
        } else if (asciiColonIndex !== -1 && asciiColonIndex < 15) {
            const prefix = eventContent.slice(0, asciiColonIndex).trim();
            if (prefix === speakerName || speakerName.includes(prefix)) {
                eventContent = eventContent.slice(asciiColonIndex + 1).trim();
            }
        }

        if (dialogueTypeTag) {
            eventContent = `【${dialogueTypeTag}】\n${eventContent}`;
        }

        await this.prisma.townEvent.create({
            data: {
                novelId: this.novel!.id,
                characterId: dbCharacterId,
                characterName: speakerName,
                type: eventType,
                content: eventContent,
                timestamp: new Date(),
                isRead: false
            }
        });

        return {
            type: 'dialogue',
            plotId: plot.id,
            plotTitle: plot.title,
            characterId: speakerId,
            characterName: speakerName,
            content: currentDialogue,
            sceneName: plot.location,
            allDialogues: dialogueContent,
            currentDialogueIndex: this.currentDialogueIndex - 1, // 这里返回的是下一个将要执行的真实索引 actualIndex
            memoryContent
        };
    }

    async runSimulationStep(): Promise<PlotExecutionResult | null> {
        if (!this.novel || this.characters.length === 0) return null;

        this.advanceTime();

        if (this.novelCompleted || this.currentPlotIndex >= this.plots.length) {
            this.novelCompleted = true;
            return {
                type: 'novel_complete',
                content: '小说情节已全部播放完毕'
            };
        }

        const currentPlot = this.plots[this.currentPlotIndex];
        if (!currentPlot) return null;

        let dialogueContent: string[] = [];
        try {
            dialogueContent = JSON.parse(currentPlot.dialogueContent || '[]');
        } catch {
            dialogueContent = [];
        }

        if (this.currentDialogueIndex === 0) {
            const involvedCharacterIds: number[] = [];
            try {
                const ids = JSON.parse(currentPlot.involvedCharacterIds || '[]');
                involvedCharacterIds.push(...ids);
            } catch (_e) { /* ignore parse error */ }

            if (dialogueContent.length === 0) {
                const memoryContent = `[开始情节] ${currentPlot.title}：${currentPlot.narrationContent || currentPlot.content}`;

                for (const charId of involvedCharacterIds) {
                    const buffer = this.characterMemoryBuffer.get(charId) || [];
                    buffer.push(memoryContent);
                    buffer.push(`[完成情节] ${currentPlot.title}`);
                    this.characterMemoryBuffer.set(charId, buffer);
                }

                await this.prisma.townEvent.create({
                    data: {
                        novelId: this.novel!.id,
                        characterName: '系统',
                        type: 'plot_start',
                        content: `【场景】\n地点：${currentPlot.location || '未知'}\n时间：[${this.formatTime(this.currentTime)}]\n${currentPlot.title}`,
                        timestamp: new Date(),
                        isRead: false
                    }
                });

                if (currentPlot.content) {
                    await this.prisma.townEvent.create({
                        data: {
                            novelId: this.novel!.id,
                            characterName: '舞台',
                            type: 'action',
                            content: `【动作】\n${currentPlot.content}`,
                            timestamp: new Date(),
                            isRead: false
                        }
                    });
                }

                if (currentPlot.narrationContent) {
                    await this.prisma.townEvent.create({
                        data: {
                            novelId: this.novel!.id,
                            characterName: '环境',
                            type: 'narration',
                            content: `【旁白】\n${currentPlot.narrationContent}`,
                            timestamp: new Date(),
                            isRead: false
                        }
                    });
                }

                await this.prisma.plot.update({
                    where: { id: currentPlot.id },
                    data: {
                        isCompleted: true,
                        completedAt: new Date()
                    }
                });

                this.currentPlotIndex++;
                this.currentDialogueIndex = 0;

                if (this.currentPlotIndex >= this.plots.length) {
                    this.novelCompleted = true;
                }

                // 保存进度
                await this.saveProgress();

                console.log(`[纯旁白情节完成] ${currentPlot.title}, 进度: ${this.currentPlotIndex}/${this.plots.length}`);

                await this.prisma.townEvent.create({
                    data: {
                        novelId: this.novel!.id,
                        characterName: '系统',
                        type: 'plot_complete',
                        content: `【幕落】\n${currentPlot.title} 结束`,
                        timestamp: new Date(),
                        isRead: false
                    }
                });

                return {
                    type: 'plot_complete',
                    plotId: currentPlot.id,
                    plotTitle: currentPlot.title,
                    content: currentPlot.narrationContent || `【${currentPlot.title}】`
                };
            }

            const memoryContent = `[开始情节] ${currentPlot.title}：${currentPlot.narrationContent || currentPlot.content}`;

            for (const charId of involvedCharacterIds) {
                const buffer = this.characterMemoryBuffer.get(charId) || [];
                buffer.push(memoryContent);
                this.characterMemoryBuffer.set(charId, buffer);
            }

            await this.prisma.townEvent.create({
                data: {
                    novelId: this.novel!.id,
                    characterName: '系统',
                    type: 'plot_start',
                    content: `【场景】\n地点：${currentPlot.location || '未知'}\n时间：[${this.formatTime(this.currentTime)}]\n${currentPlot.title}`,
                    timestamp: new Date(),
                    isRead: false
                }
            });

            if (currentPlot.content) {
                await this.prisma.townEvent.create({
                    data: {
                        novelId: this.novel!.id,
                        characterName: '舞台',
                        type: 'action',
                        content: `【动作】\n${currentPlot.content}`,
                        timestamp: new Date(),
                        isRead: false
                    }
                });
            }

            if (currentPlot.narrationContent) {
                await this.prisma.townEvent.create({
                    data: {
                        novelId: this.novel!.id,
                        characterName: '环境',
                        type: 'narration',
                        content: `【旁白】\n${currentPlot.narrationContent}`,
                        timestamp: new Date(),
                        isRead: false
                    }
                });
            }

            const scene = this.scenes.find(s => s.name === currentPlot.location);
            if (scene) {
                for (const charId of involvedCharacterIds) {
                    const state = this.characterStates.get(charId);
                    if (state) {
                        state.currentSceneId = scene.id;
                        state.currentSceneName = scene.name;
                        state.status = 'observing';

                        await this.prisma.character.update({
                            where: { id: charId },
                            data: { currentScene: scene.name }
                        });
                    }
                }
            }

            this.currentDialogueIndex = 1;

            console.log(`[情节开始] ${currentPlot.title}`);

            return {
                type: 'plot_start',
                plotId: currentPlot.id,
                plotTitle: currentPlot.title,
                content: currentPlot.narrationContent,
                sceneName: currentPlot.location
            };
        }

        const dialogueResult = await this.executePlotDialogue(currentPlot);

        if (dialogueResult === null ||
            (dialogueResult.type === 'dialogue' && dialogueResult.currentDialogueIndex! >= (dialogueResult.allDialogues?.length || 0))) {
            await this.prisma.plot.update({
                where: { id: currentPlot.id },
                data: {
                    isCompleted: true,
                    completedAt: new Date()
                }
            });

            const involvedCharacterIds: number[] = [];
            try {
                const ids = JSON.parse(currentPlot.involvedCharacterIds || '[]');
                involvedCharacterIds.push(...ids);
            } catch (_e) { /* ignore parse error */ }

            const memoryContent = `[完成情节] ${currentPlot.title}`;
            for (const charId of involvedCharacterIds) {
                const buffer = this.characterMemoryBuffer.get(charId) || [];
                buffer.push(memoryContent);
                this.characterMemoryBuffer.set(charId, buffer);
            }

            this.currentPlotIndex++;
            this.currentDialogueIndex = 0;

            if (this.currentPlotIndex >= this.plots.length) {
                this.novelCompleted = true;
            }

            // 保存进度
            await this.saveProgress();

            console.log(`[情节完成] ${currentPlot.title}, 进度: ${this.currentPlotIndex}/${this.plots.length}`);

            await this.prisma.townEvent.create({
                data: {
                    novelId: this.novel!.id,
                    characterName: '系统',
                    type: 'plot_complete',
                    content: `【幕落】\n${currentPlot.title} 结束`,
                    timestamp: new Date(),
                    isRead: false
                }
            });

            return {
                type: 'plot_complete',
                plotId: currentPlot.id,
                plotTitle: currentPlot.title,
                content: `【${currentPlot.title}】情节结束`
            };
        }

        return dialogueResult;
    }

    async flushMemoryBuffer() {
        for (const [charId, memories] of this.characterMemoryBuffer) {
            if (memories.length === 0) continue;

            for (const content of memories) {
                await this.prisma.memory.create({
                    data: {
                        characterId: charId,
                        novelId: this.novel!.id,
                        content,
                        type: 'DIALOGUE',
                        importance: 7,
                        tags: JSON.stringify(['对话记忆', '情节进行']),
                        source: 'auto',
                        timestamp: new Date()
                    }
                });
            }

            this.characterMemoryBuffer.set(charId, []);
        }
    }

    async saveCharacterDialogueAsMemory(characterId: number, dialogueContent: string, plotTitle: string) {
        const memoryContent = `[${plotTitle}] ${characterId}: ${dialogueContent}`;

        await this.prisma.memory.create({
            data: {
                characterId,
                novelId: this.novel!.id,
                content: memoryContent,
                type: 'DIALOGUE',
                importance: 7,
                tags: JSON.stringify(['对话记忆', '情节进行']),
                source: 'auto',
                timestamp: new Date()
            }
        });
    }

    getCurrentPlotInfo(): { plotId: number; plotTitle: string; progress: string } | null {
        if (this.currentPlotIndex >= this.plots.length) {
            return null;
        }

        const currentPlot = this.plots[this.currentPlotIndex];
        return {
            plotId: currentPlot.id,
            plotTitle: currentPlot.title,
            progress: `${this.currentPlotIndex + 1}/${this.plots.length}`
        };
    }

    getNovelCompletionStatus(): { completed: boolean; currentIndex: number; totalPlots: number } {
        return {
            completed: this.novelCompleted,
            currentIndex: this.currentPlotIndex,
            totalPlots: this.plots.length
        };
    }

    private formatTime(date: Date): string {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    getCurrentTime(): Date {
        return this.currentTime;
    }

    getCharacterStates(): CharacterState[] {
        return Array.from(this.characterStates.values());
    }

    getPlots(): Plot[] {
        return this.plots;
    }
}

let simulator: TownSimulator | null = null;
let simulationInterval: NodeJS.Timeout | null = null;

export async function startTownSimulation(prismaClient: PrismaClient, novelId: number, speed: number = 1) {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }

    simulator = new TownSimulator(prismaClient);
    await simulator.initialize(novelId);
    simulator.setSpeed(speed);

    const intervalMs = 8000 / speed;

    simulationInterval = setInterval(async () => {
        try {
            const result = await simulator!.runSimulationStep();

            if (result) {
                switch (result.type) {
                    case 'plot_start':
                        console.log(`[情节开始] ${result.plotTitle}`);
                        break;
                    case 'dialogue':
                        console.log(`[对话] ${result.characterName}: ${result.content}`);
                        break;
                    case 'plot_complete':
                        console.log(`[情节完成] ${result.plotTitle}`);
                        break;
                    case 'novel_complete':
                        console.log('[小说完成] 所有情节已播放完毕');
                        await simulator!.flushMemoryBuffer();
                        break;
                }
            }
        } catch (e) {
            console.error('模拟步骤执行失败', e);
        }
    }, intervalMs);

    console.log(`小镇模拟已启动，间隔: ${intervalMs}ms, 速度: ${speed}x`);
}

export async function stopTownSimulation() {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }

    if (simulator) {
        await simulator.flushMemoryBuffer();
        simulator = null;
    }

    console.log('小镇模拟已停止');
}

export function getSimulator(): TownSimulator | null {
    return simulator;
}
