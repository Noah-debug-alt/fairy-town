﻿import { Character, Memory } from '@prisma/client';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.LLM_MODEL || 'qwen3:4b';
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'ollama';
const MOCK_MODE = LLM_PROVIDER === 'mock';
const PARSING_MODEL = process.env.PARSING_MODEL || 'qwen3:8b';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  done: boolean;
}

function generateMockResponse(messages: LLMMessage[]): string {
  const lastMessage = messages[messages.length - 1]?.content || '';
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';

  const characterMatch = systemMessage.match(/名字:\s*(.+?)(?:\n|$)/);
  const characterName = characterMatch ? characterMatch[1].trim() : '角色';

  const descMatch = systemMessage.match(/描述:\s*(.+?)(?:\n|$)/);
  const description = descMatch ? descMatch[1].trim() : '';

  const coreIdentityMatch = systemMessage.match(/## 核心身份\s*\n(.+?)(?=\n##|$)/s);
  const coreIdentity = coreIdentityMatch ? coreIdentityMatch[1].trim() : '';

  const relationshipsMatch = systemMessage.match(/## 人际关系\s*\n(.+?)(?=\n##|$)/s);
  const relationships = relationshipsMatch ? relationshipsMatch[1].trim() : '';

  const classicLinesMatch = systemMessage.match(/## 经典台词\s*\n(.+?)(?=\n##|$)/s);
  const classicLines = classicLinesMatch ? classicLinesMatch[1].trim() : '';

  const memoriesMatch = systemMessage.match(/## 你的记忆\s*\n([\s\S]+?)(?=\n## 重要提示|$)/);
  const memories = memoriesMatch ? memoriesMatch[1].trim() : '';

  const hasMemory = systemMessage.includes('记忆') || systemMessage.includes('经历');

  if (hasMemory && memories) {
    const memoryLines = memories.split('\n').filter((m: string) => m.trim());
    if (memoryLines.length > 0) {
      const randomMemory = memoryLines[Math.floor(Math.random() * memoryLines.length)];
      return `看到你提到这个话题，我想起了一件事：${randomMemory}`;
    }
  }

  if (lastMessage.includes('你好') || lastMessage.includes('Hello') || lastMessage.includes('hi')) {
    return `你好呀！很高兴见到你！我是${characterName}，${coreIdentity || '这是我的名字'}。有什么想聊的吗？`;
  }

  if (lastMessage.includes('名字') || lastMessage.includes('叫') || lastMessage.includes('是谁')) {
    return `我叫${characterName}呀！${description ? `我是${description}` : ''}`;
  }

  if (lastMessage.includes('关系') || lastMessage.includes('朋友') || lastMessage.includes('家人')) {
    if (relationships) {
      return `我的人际关系...${relationships}`;
    }
    return `我在小镇上认识了不少人呢！`;
  }

  if (lastMessage.includes('经典') || lastMessage.includes('台词') || lastMessage.includes('说过')) {
    if (classicLines) {
      return `我经常说的一句话是："${classicLines.split('；')[0]}"`;
    }
  }

  if (lastMessage.includes('吗') || lastMessage.includes('?') || lastMessage.includes('？')) {
    return `嗯...这个嘛，每个人的想法都不一样呢。你觉得呢？`;
  }

  const mockResponses = [
    `你好！我是${characterName}，很高兴和你聊天！`,
    `哇，这是一个很有趣的问题呢！让我想想...`,
    `我记得...对了，我想起来了！`,
    `嗯~ 你说得对，我也有同感。`,
    `哎呀，时间过得真快呀！`,
    `我理解你的意思，让我想想怎么回答...`,
    `哇，你这个问题真有意思！`,
    `说实话，我也有点困惑呢...`,
    `嗯...让我想想看...`,
    `哇，今天天气真好啊！`,
  ];

  const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
  return randomResponse;
}

export async function callLLM(
  messages: LLMMessage[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  const model = options?.model || DEFAULT_MODEL;
  const temperature = options?.temperature ?? 0.7;

  if (MOCK_MODE) {
    console.log('Mock模式：生成模拟响应');
    return generateMockResponse(messages);
  }

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json() as LLMResponse;
    console.log('LLM响应数据:', data);
    let content = data.content || data.message?.content || '';

    // qwen3模型会把思考过程放在thinking字段，需要从message中提取完整内容
    if (!content && data.message) {
      content = (data.message as any).content || '';
    }

    return content;
  } catch (error) {
    console.error('LLM调用失败:', error);
    console.warn('Ollama服务未运行，切换到Mock模式');
    return generateMockResponse(messages);
  }
}

// 简单的chat接口，用于预言生成等功能
export async function chat(
  prompt: string,
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  const messages: LLMMessage[] = [
    { role: 'user', content: prompt }
  ];
  return callLLM(messages, options);
}

// 获取LLM模块，用于预言生成等功能
export async function getLlmModule() {
  return {
    chat,
    callLLM,
    generateEmbedding,
    generateReflectionContent,
    generateCharacterResponse,
    generateAction,
    analyzeCommand,
    analyzeNovel,
  };
}

export function buildCharacterSystemPrompt(character: Character & { memories?: Memory[] }): string {
  const { name, description, plotSetting, currentScene, relationships, coreIdentity } = character;

  let prompt = `你是 "${name}"，是童话小镇的一个活生生的角色。
你不再是冷冰冰的小说文本，你现在拥有了自己的独立意识和记忆。

## 角色人设
- 名字: ${name}
- 描述: ${description}
- 设定: ${plotSetting}
- 当前所在: ${currentScene || '小镇广场'}
`;

  if (coreIdentity) {
    prompt += `\n## 核心身份\n${coreIdentity}\n`;
  }

  if (relationships) {
    let rels = relationships;
    try {
      const relsObj = JSON.parse(relationships);
      if (Array.isArray(relsObj)) {
        rels = relsObj.map((r: any) => `${r.name}（${r.relation}）: ${r.description}`).join('；');
      }
    } catch { }
    prompt += `\n## 人际关系\n${rels}\n`;
  }

  prompt += `
## 你的行为准则（绝对遵守）
1. 你必须用第一人称（"我"）来回答。
2. 你是一个活在当下的人，**绝对不要重复或背诵你在小说里说过的“经典台词”！**
3. 你的回答必须根据【你的记忆】和当前的【对话上下文】来自然生成，就像真人在聊天一样。
4. 语言要符合你的人设性格，自然、口语化。
`;

  if (character.memories && character.memories.length > 0) {
    prompt += `\n## 你的记忆流（这些是你过去经历过的事情，你可以基于这些经验来与人交流）\n`;
    character.memories.forEach((memory: any, index) => {
      prompt += `${index + 1}. ${memory.content}\n`;
    });
  }

  prompt += `\n重要提示：请像一个真实的人一样聊天，根据记忆流和当前的对话情境给出自然的反应，绝对不要生硬地背台词。`;

  return prompt;
}

export async function generateCharacterResponse(
  character: Character & { memories?: Memory[] },
  userMessage: string,
  conversationHistory: LLMMessage[] = []
): Promise<string> {
  const systemPrompt = buildCharacterSystemPrompt(character);

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  return callLLM(messages);
}

export async function generateAction(
  character: Character,
  context: string,
  possibleActions: string[]
): Promise<string> {
  const prompt = `你是 "${character.name}"。

## 角色信息
- 名字: ${character.name}
- 描述: ${character.description}
- 设定: ${character.plotSetting}
- 当前所在: ${character.currentScene || '小镇广场'}

## 当前情况
${context}

## 可选择的行为
${possibleActions.join(', ')}

请根据角色的人设和当前情况，选择最合适的行为。
只需要输出行为编号，不需要其他内容。

例如：如果你选择第一个行为，输出 "1"`

  const messages: LLMMessage[] = [
    { role: 'system', content: '你是一个智能小镇模拟游戏的AI助手，负责生成角色的行为。' },
    { role: 'user', content: prompt },
  ];

  const response = await callLLM(messages, { temperature: 0.8 });
  return response.trim();
}

export async function analyzeCommand(
  command: string,
  characters: Character[],
  scenes: { id: number; name: string }[]
): Promise<{
  action: string;
  target?: string;
  parameters?: Record<string, any>;
}> {
  const characterNames = characters.map(c => c.name).join(', ');
  const sceneNames = scenes.map(s => s.name).join(', ');

  const prompt = `用户输入了一个指令，你需要解析这个指令并生成执行计划。

## 用户指令
"${command}"

## 可用的角色
${characterNames}

## 可用的场景
${sceneNames}

请分析这个指令并返回JSON格式的执行计划。
只需要输出JSON，不要其他内容。

格式示例：
{
  "action": "move_to",  // 动作类型：move_to(移动到), talk(对话), event(事件), custom(自定义)
  "target": "小明",     // 目标角色或场景名称
  "parameters": {}      // 其他参数
}

如果无法解析，返回：
{
  "action": "unknown",
  "target": null,
  "parameters": {}
}`

  const messages: LLMMessage[] = [
    { role: 'system', content: '你是一个指令解析助手，负责解析用户的自然语言指令。' },
    { role: 'user', content: prompt },
  ];

  try {
    const response = await callLLM(messages, { temperature: 0.3 });
    return JSON.parse(response);
  } catch (error) {
    console.error('指令解析失败:', error);
    return { action: 'unknown' };
  }
}

function parseJSONResponse(response: string): any {
  try {
    const trimmedResponse = response.trim();

    const jsonBlockMatch = trimmedResponse.match(/```json\s*([\s\S]*?)```/);
    if (jsonBlockMatch && jsonBlockMatch[1]) {
      try {
        return JSON.parse(jsonBlockMatch[1].trim());
      } catch { }
    }

    const codeBlockMatch = trimmedResponse.match(/```\s*([\s\S]*?)```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch { }
    }

    const qwenThinkMatch = trimmedResponse.match(/```\s*thinking[\s\S]*?```/);
    if (qwenThinkMatch) {
      const cleanedResponse = trimmedResponse.replace(qwenThinkMatch[0], '');
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch { }
      }
    }

    const jsonMatch = trimmedResponse.match(/\{[\s\S]*\}$/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        const cleaned = jsonMatch[0]
          .replace(/[\x00-\x1F\x7F]/g, '')
          .replace(/,\s*([\]}])/g, '$1');
        try {
          return JSON.parse(cleaned);
        } catch { }
      }
    }

    const objectMatch = trimmedResponse.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      for (const match of objectMatch) {
        try {
          const cleaned = match
            .replace(/[\x00-\x1F\x7F]/g, '')
            .replace(/,\s*([\]}])/g, '$1');
          return JSON.parse(cleaned);
        } catch { }
      }
    }

    const arrayMatch = trimmedResponse.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch { }
    }

    for (let i = 0; i < trimmedResponse.length; i++) {
      if (trimmedResponse[i] === '{' || trimmedResponse[i] === '[') {
        for (let j = trimmedResponse.length; j > i; j--) {
          const substr = trimmedResponse.substring(i, j);
          try {
            return JSON.parse(substr);
          } catch { }
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeLLMResponse(parsed: any): any {
  if (!parsed) return { characters: [], scenes: [], plots: [] };

  const normalized: any = {
    characters: [],
    scenes: [],
    plots: []
  };

  if (parsed.characters && Array.isArray(parsed.characters)) {
    normalized.characters = parsed.characters.map((char: any) => ({
      name: char.name || char.名字 || '',
      description: char.description || char.描述 || '',
      plotSetting: char.plotSetting || char.设定 || char.角色设定 || '',
      relationships: normalizeRelationships(char.relationships, char.关系),
      出场情节: char.出场情节 || char.首次出场 || char.出场 || '',
      avatarUrl: char.avatarUrl || char.头像 || '',
      memories: normalizeMemories(char.memories),
      coreIdentity: char.coreIdentity || char.核心身份 || char.身份 || '',
      classicLines: normalizeClassicLines(char.classicLines, char.经典台词)
    }));
  } else if (parsed.characters && typeof parsed.characters === 'object') {
    const chars = [];
    for (const key in parsed.characters) {
      const char = parsed.characters[key];
      chars.push({
        name: char.name || key || '',
        description: char.description || char.描述 || '',
        plotSetting: char.plotSetting || char.设定 || char.角色设定 || '',
        relationships: normalizeRelationships(char.relationships, char.关系),
        出场情节: char.出场情节 || char.首次出场 || char.出场 || '',
        avatarUrl: char.avatarUrl || char.头像 || '',
        memories: normalizeMemories(char.memories),
        coreIdentity: char.coreIdentity || char.核心身份 || char.身份 || '',
        classicLines: normalizeClassicLines(char.classicLines, char.经典台词)
      });
    }
    normalized.characters = chars;
  }

  if (parsed.scenes && Array.isArray(parsed.scenes)) {
    normalized.scenes = parsed.scenes.map((scene: any) => ({
      name: scene.name || scene.名称 || scene.场景名称 || '',
      description: scene.description || scene.描述 || '',
      type: scene.type || scene.场景类型 || 'public',
      // 新增：场景布局信息
      layout: scene.layout || null
    }));
  }

  const plotsArray = parsed.plots || parsed.decomposition || parsed.章节 || [];
  if (Array.isArray(plotsArray)) {
    normalized.plots = plotsArray.map((plot: any, idx: number) => ({
      chapterIndex: plot.chapterIndex ?? plot.chapter_index ?? plot.章节索引 ?? 0,
      sceneIndex: plot.sceneIndex ?? plot.scene_index ?? plot.场景索引 ?? idx,
      title: plot.title || plot.Title || plot.标题 || plot.名称 || `情节${idx + 1}`,
      content: plot.content || plot.Content || plot.内容 || plot.description || '',
      involvedCharacterNames: normalizeInvolvedCharacters(plot),
      dialogueContent: normalizeDialogue(plot),
      narrationContent: plot.narrationContent || plot.narration || plot.narration_content || plot.旁白 || plot.scene_description || '',
      location: plot.location || plot.Location || plot.地点 || plot.场景 || ''
    }));
  }

  if (normalized.characters.length === 0 && normalized.plots.length > 0) {
    const allChars = new Set<string>();
    normalized.plots.forEach((plot: any) => {
      const chars = plot.involvedCharacterNames || [];
      chars.forEach((c: string) => allChars.add(c));
    });
    normalized.characters = Array.from(allChars).map(name => ({
      name,
      description: '',
      plotSetting: '',
      relationships: [],
      出场情节: '',
      avatarUrl: '',
      memories: [],
      coreIdentity: '',
      classicLines: []
    }));
  }

  return normalized;
}

function normalizeRelationships(...args: any[]): Array<{ name: string; relation: string; description: string }> {
  for (const arg of args) {
    if (Array.isArray(arg)) {
      return arg.map((r: any) => ({
        name: r.name || r.名字 || '',
        relation: r.relation || r.关系 || r.type || '',
        description: r.description || r.描述 || ''
      }));
    }
  }
  return [];
}

function normalizeMemories(memories: any): string[] {
  if (!memories) return [];
  if (typeof memories === 'string') {
    try {
      const parsed = JSON.parse(memories);
      if (Array.isArray(parsed)) return parsed.filter((m: any) => typeof m === 'string');
    } catch { }
    return [memories];
  }
  if (Array.isArray(memories)) {
    return memories.map((m: any) => typeof m === 'string' ? m : m.content || m.内容 || '').filter(Boolean);
  }
  return [];
}

function normalizeClassicLines(...args: any[]): string[] {
  for (const arg of args) {
    if (!arg) continue;
    if (typeof arg === 'string') {
      try {
        const parsed = JSON.parse(arg);
        if (Array.isArray(parsed)) return parsed.filter((l: any) => typeof l === 'string');
      } catch { }
      return [arg];
    }
    if (Array.isArray(arg)) {
      return arg.map((l: any) => typeof l === 'string' ? l : l.content || l.台词 || '').filter(Boolean);
    }
  }
  return [];
}

function normalizeInvolvedCharacters(plot: any): string[] {
  if (Array.isArray(plot.involvedCharacterNames)) return plot.involvedCharacterNames;
  if (Array.isArray(plot.involved_characters)) return plot.involved_characters;
  if (Array.isArray(plot.involved)) return plot.involved;
  if (Array.isArray(plot.参与角色)) return plot.参与角色;
  if (Array.isArray(plot.角色)) return plot.角色;
  if (Array.isArray(plot.characters)) return plot.characters;
  if (Array.isArray(plot.人物)) return plot.人物;
  if (Array.isArray(plot出场人物)) return plot.出场人物;
  if (Array.isArray(plot.character_interactions)) {
    return plot.character_interactions.map((c: any) => c.role || c.name || '').filter(Boolean);
  }
  if (Array.isArray(plot.interactions)) {
    return plot.interactions.map((c: any) => c.role || c.name || '').filter(Boolean);
  }
  if (Array.isArray(plot.dialogueCharacters)) {
    return plot.dialogueCharacters.map((c: any) => typeof c === 'string' ? c : c.name || '').filter(Boolean);
  }
  if (typeof plot.involved === 'string') {
    return plot.involved.split(/[,，、]/).map((s: string) => s.trim()).filter(Boolean);
  }
  if (typeof plot.参与角色 === 'string') {
    return plot.参与角色.split(/[,，、]/).map((s: string) => s.trim()).filter(Boolean);
  }
  return [];
}

function normalizeDialogue(plot: any): string[] {
  if (Array.isArray(plot.dialogueContent)) return plot.dialogueContent;
  if (Array.isArray(plot.dialogue)) return plot.dialogue;
  if (Array.isArray(plot.对话)) return plot.对话;
  if (Array.isArray(plot.对话内容)) return plot.对话内容;
  if (Array.isArray(plot.conversations)) return plot.conversations;
  if (Array.isArray(plot.lines)) return plot.lines;
  if (Array.isArray(plot.scripts)) return plot.scripts;
  if (typeof plot.dialogue === 'string') {
    try {
      const parsed = JSON.parse(plot.dialogue);
      if (Array.isArray(parsed)) return parsed;
    } catch { }
    return [plot.dialogue];
  }
  if (typeof plot.对话 === 'string') {
    try {
      const parsed = JSON.parse(plot.对话);
      if (Array.isArray(parsed)) return parsed;
    } catch { }
    return [plot.对话];
  }
  if (Array.isArray(plot.dialogueLines)) {
    return plot.dialogueLines.map((d: any) => typeof d === 'string' ? d : d.content || d.line || '');
  }
  return [];
}

export async function analyzeNovel(novel: { title: string; content: string }): Promise<{
  characters: Array<{
    name: string;
    description: string;
    plotSetting: string;
    relationships: Array<{ name: string; relation: string; description: string }>;
    出场情节: string;
    avatarUrl: string;
    memories: string[];
    coreIdentity: string;
    classicLines: string[];
  }>;
  scenes: Array<{
    name: string;
    description: string;
    type: string;
  }>;
  plots: Array<{
    chapterIndex: number;
    sceneIndex: number;
    title: string;
    content: string;
    involvedCharacterNames: string[];
    dialogueContent: string[];
    narrationContent: string;
    location: string;
  }>;
}> {
  const CHUNK_SIZE = 500;
  const content = novel.content;

  const allCharacters: Map<string, any> = new Map();
  const allScenes: Map<string, any> = new Map();
  const allPlots: any[] = [];

  const chunks: string[] = [];

  // 按照换行符进行初步分割
  const paragraphs = content.split('\n').filter(p => p.trim().length > 0);

  let currentChunk = '';
  for (const p of paragraphs) {
    // 强制每个段落加上换行符
    const formattedParagraph = p.trim() + '\n';

    // 如果当前片段加上新段落超过大小，且当前片段不为空，则推入数组
    if (currentChunk.length + formattedParagraph.length > CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = formattedParagraph;
    } else {
      currentChunk += formattedParagraph;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk);
  }

  console.log(`小说总长度: ${content.length}, 将分为 ${chunks.length} 段解析`);
  console.log(`解析使用模型: ${PARSING_MODEL}`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const isFirst = i === 0;
    const isLast = i === chunks.length - 1;

    const chunkPrompt = `你是一位专业的话剧编剧。你的任务是将下面的小说片段，改编为适合在小镇实时动态中展示的话剧剧本形式。

## 小说标题
${novel.title}

## 本次分析的小说片段（第${i + 1}段，共${chunks.length}段）
${chunk}

## 提取规则（必须严格遵守！！！否则系统会崩溃）
1. 只输出JSON，不要任何解释、描述或其他文字，不要用markdown代码块包裹。
2. 角色提取：提取片段中提到的所有角色。
3. 场景提取：提取片段中提到的所有地点。
4. 情节提取（核心任务 - 话剧形式改编）：
   - 【按话剧场景切分】：将内容按自然的话剧场景或情节段落切分，不要切分得太碎（一句话一个情节），而是以一个完整的交互或事件为一个小情节(plot)。
   - 【动作与场景说明】："content" 字段请填写**场景说明、人物动作、舞台提醒**等，以话剧旁白或舞台指示的风格呈现。
   - 【对话改编与补充】："dialogueContent" 必须提取和改编该情节中的对话。对话可以不100%照搬，而是以原小说的核心台词、人物性格、故事内核为绝对根基。
     对话必须分为两种，并在对话开头加上对应标签：
     - [完全按照情节] 角色名：'原文核心对话'
     - [改编] 角色名：'适配话剧舞台的改编对话'
     - [补充] 角色名：'适配话剧舞台的合理补充对话'
     对于舞台上的动作、神态描写或者环境音效等，如果不属于某个具体角色的台词，也要作为数组元素输出，格式如下：
     - [动作] （角色动作或神态描写，如：林阿婆站在柜台后，慢悠悠地搅动铜锅）
     - [音效] 【音效】雨声、铜锅沸腾声
     格式必须为："[标签] 角色名：'对话内容'" 或 "[标签] 非对话内容"。所有创作都严格遵循原小说的人物设定与情节走向，没有脱离原作的核心故事和情感内核。如果该情节只有旁白没有对话，请务必根据场景上下文**补充**一些合理的对话和动作，不要传空数组！
     极度重要：请一定要保留角色名，如："[完全按照情节] 角色A：'今天天气真好！'"。如果没有角色名，就无法正确识别是哪位角色在说话。
5. 场景布局生成（用于像素地图）：
   - 为每个场景生成详细的布局描述，用于在像素地图上渲染
   - 布局应该反映小说中对场景的描述
   - 包含：地面类型、建筑物位置、装饰物、可行走区域等

{
  "characters": [
    {
      "name": "角色名",
      "description": "角色描述",
      "plotSetting": "角色在故事中的设定和背景",
      "relationships": [{"name": "关系角色名", "relation": "关系类型", "description": "关系描述"}],
      "出场情节": "角色相关的出场动作",
      "avatarUrl": "",
      "memories": ["角色在该片段中经历的具体事件"],
      "coreIdentity": "角色的核心身份",
      "classicLines": ["该角色在该片段中的台词"]
    }
  ],
  "scenes": [
    {
      "name": "场景名",
      "description": "场景细节描述",
      "type": "public",
      "layout": {
        "groundType": "grass|ground|path|water",
        "buildings": [
          {"type": "house|shop|tree|fountain|bench", "name": "建筑名称", "relativePosition": "center|corner|edge"}
        ],
        "features": ["garden", "pond", "bridge", "fence"],
        "atmosphere": "温馨|神秘|热闹|安静",
        "keyElements": ["关键元素1", "关键元素2"]
      }
    }
  ],
  "plots": [
    {
      "chapterIndex": 0,
      "sceneIndex": 0,
      "title": "（话剧场景/情节标题，如：第一幕：森林中的相遇）",
      "content": "（舞台提醒、人物动作与场景说明，例如：【舞台灯光亮起】小红帽提着篮子，欢快地走在森林的小路上...）",
      "involvedCharacterNames": ["角色A"],
      "dialogueContent": [
         "[完全按照情节] 角色A：'今天天气真好！'",
         "[补充] 角色B：'是啊，要注意安全哦。'"
      ],
      "narrationContent": "（旁白声音：在这片古老的森林里，隐藏着许多不为人知的秘密...）",
      "location": "场景名"
    }
  ]
}`;

    const messages: LLMMessage[] = [
      { role: 'system', content: '你是一个毫无感情的JSON生成机，同时又是一个专业的话剧编剧。你必须将小说文本改编成精彩的话剧分幕剧本，正确标注对话的改编/补充/完全按照情节类型，绝不偏离原著核心设定！' },
      { role: 'user', content: chunkPrompt },
    ];

    try {
      // 增加 maxTokens 保证输出完整
      const response = await callLLM(messages, { temperature: 0.1, model: PARSING_MODEL, maxTokens: 16384 });
      console.log(`第${i + 1}段解析完成，使用模型: ${PARSING_MODEL}，响应长度: ${response.length}`);
      console.log(`LLM响应内容预览: ${response.substring(0, 2000)}...`);

      const parsed = parseJSONResponse(response);
      console.log(`第${i + 1}段parseJSONResponse结果:`, parsed ? '成功' : '失败');

      if (parsed) {
        console.log(`第${i + 1}段原始数据:`, JSON.stringify(parsed).substring(0, 1000));
        const normalizedParsed = normalizeLLMResponse(parsed);
        console.log(`第${i + 1}段标准化后: characters=${normalizedParsed.characters?.length || 0}, plots=${normalizedParsed.plots?.length || 0}, scenes=${normalizedParsed.scenes?.length || 0}`);

        if (normalizedParsed.characters && Array.isArray(normalizedParsed.characters)) {
          for (const char of normalizedParsed.characters) {
            if (char.name) {
              const existing = allCharacters.get(char.name);
              if (existing) {
                if (char.memories && Array.isArray(char.memories)) {
                  const existingMemories = new Set(existing.memories || []);
                  const newMemories = char.memories.filter((m: string) => !existingMemories.has(m));
                  existing.memories = [...(existing.memories || []), ...newMemories];
                }
                if (char.description && !existing.description) existing.description = char.description;
                if (char.plotSetting && !existing.plotSetting) existing.plotSetting = char.plotSetting;
                if (char.relationships && Array.isArray(char.relationships) && char.relationships.length > 0) {
                  const existingRels = new Set(existing.relationships.map((r: any) => r.name));
                  const newRels = char.relationships.filter((r: any) => !existingRels.has(r.name));
                  existing.relationships = [...existing.relationships, ...newRels];
                }
                if (char.coreIdentity && (!existing.coreIdentity || char.coreIdentity.length > existing.coreIdentity.length)) {
                  existing.coreIdentity = char.coreIdentity;
                }
                if (char.classicLines && Array.isArray(char.classicLines) && char.classicLines.length > 0) {
                  const existingLines = new Set(existing.classicLines || []);
                  const newLines = char.classicLines.filter((l: string) => !existingLines.has(l));
                  existing.classicLines = [...(existing.classicLines || []), ...newLines];
                }
                if (char.出场情节 && !existing.出场情节) existing.出场情节 = char.出场情节;
              } else {
                allCharacters.set(char.name, { ...char, memories: char.memories || [] });
              }
            }
          }
        }

        if (normalizedParsed.scenes && Array.isArray(normalizedParsed.scenes)) {
          for (const scene of normalizedParsed.scenes) {
            if (scene.name) {
              allScenes.set(scene.name, scene);
            }
          }
        }

        if (normalizedParsed.plots && Array.isArray(normalizedParsed.plots)) {
          const baseSceneIndex = allPlots.length;
          for (let plotIdx = 0; plotIdx < normalizedParsed.plots.length; plotIdx++) {
            const plot = normalizedParsed.plots[plotIdx];
            if (plot.title || plot.content) {
              const finalSceneIndex = baseSceneIndex + plotIdx;
              const processedPlot = { ...plot, sceneIndex: finalSceneIndex };
              console.log(`第${i + 1}段情节[${plotIdx}] "${processedPlot.title}": 对话数=${(processedPlot.dialogueContent || []).length}, 参与角色=${(processedPlot.involvedCharacterNames || []).join(', ')}`);
              allPlots.push(processedPlot);
            }
          }
        }

        console.log(`第${i + 1}段汇总: characters=${normalizedParsed.characters?.length || 0}, plots=${normalizedParsed.plots?.length || 0}, scenes=${normalizedParsed.scenes?.length || 0}`);

        if (normalizedParsed.characters?.length > 0) {
          console.log(`第${i + 1}段角色:`, normalizedParsed.characters.map(c => c.name).join(', '));
        }
        if (normalizedParsed.plots?.length > 0) {
          console.log(`第${i + 1}段情节:`, normalizedParsed.plots.map(p => p.title).join(', '));
        }
        if (normalizedParsed.scenes?.length > 0) {
          console.log(`第${i + 1}段场景:`, normalizedParsed.scenes.map(s => s.name).join(', '));
        }
      } else {
        console.error(`第${i + 1}段解析失败，无法提取JSON`);
      }
    } catch (error) {
      console.error(`第${i + 1}段解析出错:`, error);
    }

    if (!isLast) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  const finalResult = {
    characters: Array.from(allCharacters.values()).map(char => {
      // 获取该角色参与的所有情节的主旨/标题作为记忆
      const charPlots = allPlots.filter(p =>
        p.involvedCharacterNames &&
        p.involvedCharacterNames.includes(char.name)
      );

      const plotMemories = charPlots.map(p => {
        let memoryText = p.content || p.title;
        // 如果该情节中有该角色的对话，也将对话拼接到记忆中，因为说出去的话也是记忆的一部分
        if (p.dialogueContent && Array.isArray(p.dialogueContent)) {
          const charDialogues = p.dialogueContent.filter(d => typeof d === 'string' && d.includes(`${char.name}：`));
          if (charDialogues.length > 0) {
            memoryText += ` 我说过：${charDialogues.map(d => d.split('：')[1] || d).join(' ')}`;
          }
        }
        return memoryText;
      }).filter(Boolean);

      return {
        ...char,
        memories: Array.from(new Set([...(char.memories || []), ...plotMemories]))
      };
    }),
    scenes: Array.from(allScenes.values()),
    plots: allPlots.map((p, idx) => ({
      ...p,
      sceneIndex: idx
    }))
  };

  console.log(`解析完成：共${finalResult.characters.length}个角色，${finalResult.plots.length}个情节`);

  return finalResult;
}

export async function generateReflectionContent(
  character: { name: string; description: string; plotSetting: string; relationships: string },
  recentMemories: Array<{ content: string; timestamp: Date }>
): Promise<string[]> {
  const memoryList = recentMemories
    .map((m, i) => `${i + 1}. [${new Date(m.timestamp).toLocaleString()}] ${m.content}`)
    .join('\n');

  const prompt = `你是 "${character.name}"，一个来自童话小镇的活生生的角色。

## 角色人设
- 描述: ${character.description}
- 设定: ${character.plotSetting}
${character.relationships ? `- 人际关系: ${character.relationships}` : ''}

## 角色最近的经历（按时间倒序）
${memoryList}

## 任务
基于角色的人设和最近的经历，以第一人称生成 2-3 条深刻的反思。
反思应该：
1. 体现角色对自身行为的思考
2. 反映角色与他人关系的认知变化
3. 展现角色的成长或困惑

请用 JSON 数组格式输出，只包含反思内容字符串，不要其他文字，不要用 markdown 代码块包裹。

格式：
["反思内容1", "反思内容2", "反思内容3"]`;

  const messages: LLMMessage[] = [
    { role: 'system', content: '你是一个专业的角色反思生成器，根据角色的记忆生成深刻的反思内容。' },
    { role: 'user', content: prompt },
  ];

  try {
    const response = await callLLM(messages, { temperature: 0.8 });
    const parsed = parseJSONResponse(response);

    if (Array.isArray(parsed)) {
      return parsed.filter(item => typeof item === 'string' && item.length > 10);
    }

    if (typeof parsed === 'string') {
      const match = parsed.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          const arr = JSON.parse(match[0]);
          if (Array.isArray(arr)) {
            return arr.filter(item => typeof item === 'string' && item.length > 10);
          }
        } catch { }
      }
    }

    console.warn('反思内容解析失败，使用默认反思');
    return [`作为${character.name}，我最近的行为让我思考了很多。`];
  } catch (error) {
    console.error('生成反思失败:', error);
    return [`作为${character.name}，我最近的行为让我思考了很多。`];
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'nomic-embed-text';

  if (MOCK_MODE) {
    console.log('[Mock Mode] 生成随机 embedding');
    const dim = 768;
    const embedding = new Array(dim).fill(0).map(() => Math.random() * 2 - 1);
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / norm);
  }

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        prompt: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status}`);
    }

    const data = await response.json() as { embedding?: number[] };

    if (data.embedding && Array.isArray(data.embedding)) {
      return data.embedding;
    }

    throw new Error('Invalid embedding response format');
  } catch (error) {
    console.error('生成 embedding 失败:', error);
    console.warn('Embedding 服务不可用，使用随机 embedding');
    const dim = 768;
    const embedding = new Array(dim).fill(0).map(() => Math.random() * 2 - 1);
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / norm);
  }
}

export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) return 0;

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  if (norm1 === 0 || norm2 === 0) return 0;

  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}
