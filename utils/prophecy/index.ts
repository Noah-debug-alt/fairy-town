// Prophecy generation utilities
// Generate future plot predictions based on existing plots

import { Novel, Plot, Character } from '@prisma/client';
import { getLlmModule } from '../llm/index';

// 预言生成使用的模型配置
const PROPHECY_MODEL = process.env.PROPHECY_MODEL || 'qwen3:8b';

interface ProphecyData {
    title: string;
    content: string;
    probability: number;
    endingType: string;
    keyFactors: string[];
    involvedCharacterIds: number[];
}

// 修复：预言生成prompt改为中文，确保生成的预言内容是中文
const PROPHECY_GENERATION_PROMPT = `你是一位小说情节预测引擎。基于以下已有情节，预测可能的未来发展。

## 小说标题
{novelTitle}

## 已有情节
{existingPlots}

## 角色
{characters}

## 任务
生成3-4个可能的未来情节分支。每个分支应包含：
1. 标题和内容（200-300字，以小说叙述风格描述）
2. 概率（0-100，基于该发展的可能性）
3. 结局类型（good, bad, hidden, tragic, 或 normal）
4. 影响该分支的关键因素
5. 涉及的角色名

## 要求
1. 预测应从已有情节逻辑推导
2. 不同分支应有明显差异
3. 考虑角色性格和关系
4. 至少包含一个"出乎意料"的分支
5. 保持原小说的风格和基调

输出格式（JSON）：
{
  "prophecies": [
    {
      "title": "预言标题",
      "content": "预言内容（以小说叙述风格描述，200-300字）...",
      "probability": 35,
      "endingType": "good",
      "keyFactors": ["因素1", "因素2"],
      "involvedCharacters": ["角色1", "角色2"]
    }
  ]
}

只输出JSON，不要其他文字。`;

export async function generateProphecies(
    novel: Novel,
    plots: Plot[],
    characters: Character[]
): Promise<ProphecyData[]> {
    try {
        const llm = await getLlmModule();

        // 修复：格式化已有情节为中文格式
        const plotsText = plots.map((p, index) =>
            `${index + 1}. 第${p.chapterIndex}章 第${p.sceneIndex}节: ${p.title}\n   ${p.content || p.narrationContent}`
        ).join('\n\n');

        // 修复：格式化角色为中文格式
        const charactersText = characters.map(c =>
            `- ${c.name}: ${c.description || '无描述'}`
        ).join('\n');

        // Build prompt
        const prompt = PROPHECY_GENERATION_PROMPT
            .replace('{novelTitle}', novel.title)
            .replace('{existingPlots}', plotsText)
            .replace('{characters}', charactersText);

        // Call LLM with qwen3:8b model
        console.log(`[generateProphecies] Using model: ${PROPHECY_MODEL}`);
        const response = await llm.chat(prompt, { model: PROPHECY_MODEL, temperature: 0.7 });

        // Parse response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to parse LLM response as JSON');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const prophecies: ProphecyData[] = [];

        // Get character ID mapping
        const characterNameToId = new Map<string, number>();
        characters.forEach(c => {
            characterNameToId.set(c.name, c.id);
        });

        for (const p of parsed.prophecies || []) {
            // Map character names to IDs
            const involvedIds: number[] = [];
            for (const name of p.involvedCharacters || []) {
                const id = characterNameToId.get(name);
                if (id) {
                    involvedIds.push(id);
                }
            }

            prophecies.push({
                title: p.title || 'Untitled Prophecy',
                content: p.content || '',
                probability: Math.min(100, Math.max(0, p.probability || 50)),
                endingType: ['good', 'bad', 'hidden', 'tragic', 'normal'].includes(p.endingType)
                    ? p.endingType
                    : 'normal',
                keyFactors: p.keyFactors || [],
                involvedCharacterIds: involvedIds
            });
        }

        return prophecies;
    } catch (error) {
        console.error('Error generating prophecies:', error);
        // Return default prophecies if LLM fails
        return [
            {
                title: 'The Path of Light',
                content: 'The protagonist finds the key to solving the crisis and brings hope to everyone. Through courage and wisdom, they overcome all obstacles and achieve a satisfying ending.',
                probability: 35,
                endingType: 'good',
                keyFactors: ['Courage', 'Wisdom', 'Friendship'],
                involvedCharacterIds: characters.slice(0, 2).map(c => c.id)
            },
            {
                title: 'The Shadow Falls',
                content: 'The crisis deepens, and the protagonist faces greater challenges. Despite their efforts, things take a turn for the worse, leading to a difficult ending.',
                probability: 25,
                endingType: 'bad',
                keyFactors: ['Misunderstanding', 'Conflict', 'Loss'],
                involvedCharacterIds: characters.slice(0, 3).map(c => c.id)
            },
            {
                title: 'Hidden Truth',
                content: 'An unexpected revelation changes everything. The protagonist discovers a secret that redefines their journey, leading to a surprising conclusion.',
                probability: 20,
                endingType: 'hidden',
                keyFactors: ['Secret', 'Revelation', 'Choice'],
                involvedCharacterIds: characters.slice(0, 2).map(c => c.id)
            },
            {
                title: 'Sacrifice and Redemption',
                content: 'To protect what matters most, the protagonist makes a difficult sacrifice. Their choice brings both sorrow and hope to those who remain.',
                probability: 20,
                endingType: 'tragic',
                keyFactors: ['Sacrifice', 'Love', 'Redemption'],
                involvedCharacterIds: characters.map(c => c.id)
            }
        ];
    }
}

// 修复：convertProphecyToPlots 需要接收角色信息，并使用与小说解析相同的对话格式
// 这样生成的对话才能在小镇模拟中正确演绎
export async function convertProphecyToPlots(
    prophecy: { title: string; content: string },
    novelId: number,
    startChapterIndex: number,
    characters: { id: number; name: string; description?: string }[] = []
): Promise<{
    chapterIndex: number;
    sceneIndex: number;
    title: string;
    content: string;
    narrationContent: string;
    dialogueContent: string[];
    involvedCharacterIds: number[];
    location: string;
}[]> {
    try {
        const llm = await getLlmModule();

        // 构建角色信息文本
        const charactersText = characters.length > 0
            ? characters.map(c => `- ${c.name}${c.description ? `: ${c.description}` : ''}`).join('\n')
            : '（未提供角色信息，请根据预言内容推断合适的角色）';

        // 使用与小说解析相同的对话格式要求
        const prompt = `你是一位专业的话剧编剧。你的任务是将下面的预言内容，改编为适合在小镇实时动态中展示的话剧剧本形式。

## 预言标题
${prophecy.title}

## 预言内容
${prophecy.content}

## 可用角色
${charactersText}

## 改编规则（必须严格遵守！！！否则系统会崩溃）
1. 只输出JSON，不要任何解释、描述或其他文字，不要用markdown代码块包裹。
2. 将预言内容改编为2-3个话剧场景（plots），每个场景是一个完整的小情节。
3. 对话格式要求（极度重要！）：
   - 对话必须以标签开头：[完全按照情节]、[改编] 或 [补充]
   - 格式必须为："[标签] 角色名：'对话内容'"
   - 例如："[补充] 小红帽：'今天天气真好！'"
   - 极度重要：请一定要保留角色名，否则无法识别是哪位角色在说话
4. 如果预言只有叙述没有对话，请根据场景上下文**补充**合理的对话和动作
5. 每个场景的 dialogueContent 数组不能为空，至少要有2-3条对话或动作

输出格式（JSON）：
{
  "plots": [
    {
      "title": "场景标题",
      "narration": "场景描述和旁白...",
      "dialogues": [
        "[补充] 角色A：'对话内容'",
        "[动作] （角色动作描写）"
      ],
      "location": "地点名称",
      "involvedCharacterNames": ["角色A", "角色B"]
    }
  ]
}

只输出JSON，不要其他文字。`;

        console.log(`[convertProphecyToPlots] Using model: ${PROPHECY_MODEL}`);
        console.log(`[convertProphecyToPlots] Characters available: ${characters.map(c => c.name).join(', ')}`);

        const response = await llm.chat(prompt, { model: PROPHECY_MODEL, temperature: 0.7 });
        console.log(`[convertProphecyToPlots] LLM response preview: ${response.substring(0, 500)}...`);

        const jsonMatch = response.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            console.error('[convertProphecyToPlots] Failed to parse LLM response as JSON');
            throw new Error('Failed to parse plot conversion response');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const plots = [];

        // 构建角色名到ID的映射
        const characterNameToId = new Map<string, number>();
        characters.forEach(c => {
            characterNameToId.set(c.name, c.id);
        });

        for (let i = 0; i < (parsed.plots || []).length; i++) {
            const p = parsed.plots[i];

            // 根据角色名映射获取 involvedCharacterIds
            const involvedIds: number[] = [];
            for (const name of (p.involvedCharacterNames || [])) {
                const id = characterNameToId.get(name);
                if (id) {
                    involvedIds.push(id);
                } else {
                    // 尝试模糊匹配
                    for (const [charName, charId] of characterNameToId) {
                        if (name.includes(charName) || charName.includes(name)) {
                            involvedIds.push(charId);
                            break;
                        }
                    }
                }
            }

            plots.push({
                chapterIndex: startChapterIndex,
                sceneIndex: i + 1,
                title: p.title || `Scene ${i + 1}`,
                content: p.narration || '',
                narrationContent: p.narration || '',
                dialogueContent: p.dialogues || [],
                involvedCharacterIds: involvedIds,
                location: p.location || ''
            });
        }

        console.log(`[convertProphecyToPlots] Converted to ${plots.length} plots with dialogues`);
        return plots;
    } catch (error) {
        console.error('Error converting prophecy to plots:', error);
        // Return a simple plot if conversion fails
        return [{
            chapterIndex: startChapterIndex,
            sceneIndex: 1,
            title: prophecy.title,
            content: prophecy.content,
            narrationContent: prophecy.content,
            dialogueContent: [],
            involvedCharacterIds: [],
            location: 'Unknown'
        }];
    }
}

// AI assisted plot rewrite
// 修复：AI改写对话需要使用中文prompt，并确保对话格式与小镇模拟兼容
// 改写后的对话在应用到情节时会被转换为 "[改编] 角色名：'对话内容'" 格式
export async function generatePlotRewrite(
    plot: Plot,
    characters: Character[],
    prompt: string
): Promise<{ speaker: string; content: string; emotion?: string }[]> {
    try {
        const llm = await getLlmModule();

        const charactersText = characters.map(c => `- ${c.name}${c.description ? `: ${c.description}` : ''}`).join('\n');

        // 修复：使用中文prompt，要求生成符合小镇模拟的对话
        const fullPrompt = `你是一位专业的话剧编剧。根据用户的要求，改写以下情节的对话内容。

## 原始情节
标题：${plot.title}
旁白：${plot.narrationContent || '无'}
原始对话：${plot.dialogueContent || '无'}

## 可用角色
${charactersText}

## 用户改写要求
${prompt}

## 改写规则
1. 只输出JSON，不要任何解释文字
2. 对话必须保留角色名，否则无法识别是哪位角色在说话
3. 每条对话必须包含 speaker（角色名）和 content（对话内容）
4. 可选包含 emotion（情感标签，如：愤怒、悲伤、开心等）
5. 对话内容要符合角色性格和故事情境
6. 至少生成3-5条对话

输出格式（JSON）：
{
  "dialogues": [
    {
      "speaker": "角色名",
      "content": "对话内容",
      "emotion": "情感标签（可选）"
    }
  ]
}

只输出JSON，不要其他文字。`;

        console.log(`[generatePlotRewrite] Using model: ${PROPHECY_MODEL}`);
        const response = await llm.chat(fullPrompt, { model: PROPHECY_MODEL, temperature: 0.7 });
        const jsonMatch = response.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            throw new Error('Failed to parse rewrite response');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.dialogues || [];
    } catch (error) {
        console.error('Error generating plot rewrite:', error);
        return [];
    }
}

// 修复：情节分支生成需要使用中文prompt，并确保对话格式与小镇模拟兼容
// 分支对话在应用到情节时会被转换为 "[改编] 角色名：'对话内容'" 格式
export async function generatePlotBranches(
    plot: Plot,
    characters: Character[]
): Promise<{ label: string; description: string; dialogues: { speaker: string; content: string }[] }[]> {
    try {
        const llm = await getLlmModule();

        const charactersText = characters.map(c => `- ${c.name}${c.description ? `: ${c.description}` : ''}`).join('\n');

        // 修复：使用中文prompt，要求生成符合小镇模拟的对话
        const fullPrompt = `你是一位专业的话剧编剧。基于当前情节，生成3个不同的发展分支。

## 当前情节
标题：${plot.title}
旁白：${plot.narrationContent || '无'}
当前对话：${plot.dialogueContent || '无'}

## 可用角色
${charactersText}

## 分支要求
1. 分支A：延续原有基调的发展
2. 分支B：引入紧张或冲突的转折
3. 分支C：出乎意料的发展

## 生成规则
1. 只输出JSON，不要任何解释文字
2. 每个分支必须包含对话，对话必须保留角色名
3. 每个分支至少3-5条对话
4. 对话内容要符合角色性格

输出格式（JSON）：
{
  "branches": [
    {
      "label": "分支标题",
      "description": "简要描述",
      "dialogues": [
        { "speaker": "角色名", "content": "对话内容" }
      ]
    }
  ]
}

只输出JSON，不要其他文字。`;

        console.log(`[generatePlotBranches] Using model: ${PROPHECY_MODEL}`);
        const response = await llm.chat(fullPrompt, { model: PROPHECY_MODEL, temperature: 0.7 });
        const jsonMatch = response.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            throw new Error('Failed to parse branch response');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.branches || [];
    } catch (error) {
        console.error('Error generating plot branches:', error);
        return [
            {
                label: '延续原方向',
                description: '故事按照原来的方向发展',
                dialogues: [
                    { speaker: '角色', content: '让我们继续前行吧。' }
                ]
            },
            {
                label: '意外相遇',
                description: '一个新角色出现，改变了局面',
                dialogues: [
                    { speaker: '陌生人', content: '请问，我可以加入你们吗？' }
                ]
            },
            {
                label: '隐藏的真相',
                description: '一个秘密被揭露，改变了一切',
                dialogues: [
                    { speaker: '角色', content: '我有件事要告诉你...' }
                ]
            }
        ];
    }
}
