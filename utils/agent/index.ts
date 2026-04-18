// 智能体核心工具
// 用于智能体的核心功能实现

import { PrismaClient, Character, Memory, ChatSession, ChatMessage } from '@prisma/client';
import { llm } from '../llm';
import { memory } from '../memory';

const prisma = new PrismaClient();

interface AgentStatus {
  [key: string]: unknown;
}

interface PersonaValidationResult {
  isConsistent: boolean;
  reason?: string;
  score?: number;
}

const DIALOGUE_COUNT_FOR_REFLECTION = 10;

export const agent = {
  // 创建智能体
  createAgent: async (character: Character): Promise<Record<string, unknown>> => {
    return {
      id: character.id,
      name: character.name,
      character,
    };
  },

  // 智能体思考
  think: async (_character: Character, _context: string): Promise<string> => {
    return '智能体思考内容';
  },

  // 智能体行动
  act: async (_character: Character, _context: string): Promise<string> => {
    return '智能体行动内容';
  },

  // 智能体对话
  converse: async (
    character: Character,
    session: ChatSession,
    messages: ChatMessage[],
    prompt: string
  ): Promise<ChatMessage> => {
    const relevantMemories = await memory.retrieveRelevantMemory({
      characterId: character.id,
      context: messages.map(m => m.content).join('\n'),
      limit: 5,
    });

    let response = await llm.generateDialogue(character, messages.map(m => m.content).join('\n'), prompt);

    const validationResult = await agent.validatePersonaConsistency(character, response, relevantMemories);

    let retryCount = 0;
    while (!validationResult.isConsistent && retryCount < 2) {
      console.log(`[Agent] 回复不符合人设，重试第 ${retryCount + 1} 次`);
      response = await llm.generateDialogue(character, messages.map(m => m.content).join('\n'), enhancedPrompt + `\n\n请确保回复严格符合角色人设：${character.description}`);
      const newValidation = await agent.validatePersonaConsistency(character, response, relevantMemories);
      if (newValidation.isConsistent) {
        console.log(`[Agent] 重试成功`);
        break;
      }
      retryCount++;
    }

    await agent.checkAndTriggerReflection(character.id);

    return {
      id: 0,
      sessionId: session.id,
      novelId: character.novelId,
      senderType: 'AGENT' as const,
      senderId: character.id,
      receiverId: session.participantIds?.find((id: number) => id !== character.id) || 0,
      content: response,
      sendTime: new Date(),
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  // 智能体记忆管理
  manageMemory: async (character: Character, newMemory: Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>): Promise<Memory> => {
    const tags = typeof newMemory.tags === 'string' ? JSON.parse(newMemory.tags) : (newMemory.tags || []);

    const storedMemory = await memory.writeMemory({
      characterId: newMemory.characterId,
      novelId: newMemory.novelId,
      content: newMemory.content,
      type: newMemory.type,
      importance: newMemory.importance || 5,
      tags: tags,
    }) as unknown as Memory;

    const importance = await llm.analyzeMemoryImportance(storedMemory);
    if (importance !== storedMemory.importance) {
      return await memory.updateMemoryImportance(storedMemory.id, importance);
    }

    return storedMemory;
  },

  // 智能体反思
  reflect: async (character: Character): Promise<string[]> => {
    const recentMemories = await memory.getMemoriesByCharacter(character.id, 10);
    return await llm.generateReflection(character, recentMemories);
  },

  // 生成角色反思（完整流程）
  generateCharacterReflection: async (characterId: number, novelId: number): Promise<string[]> => {
    const character = await prisma.character.findUnique({
      where: { id: characterId },
    });

    if (!character) {
      throw new Error('角色不存在');
    }

    const novel = await prisma.novel.findUnique({
      where: { id: novelId },
    });

    if (!novel) {
      throw new Error('小说不存在');
    }

    const recentMemories = await prisma.memory.findMany({
      where: {
        characterId,
        type: { in: ['DIALOGUE', 'OBSERVATION'] },
      },
      orderBy: { timestamp: 'desc' },
      take: 20,
    });

    if (recentMemories.length < 3) {
      console.log(`[Reflection] 角色 ${characterId} 记忆不足，跳过反思生成`);
      return [];
    }

    let reflections: string[] = [];
    let retryCount = 0;
    const maxRetries = 1;

    while (retryCount <= maxRetries) {
      try {
        reflections = await llm.generateReflection(character, recentMemories);

        if (reflections.length > 0 && reflections.every(r => typeof r === 'string' && r.length > 0)) {
          break;
        }
      } catch (error) {
        console.error(`[Reflection] 生成反思失败，第 ${retryCount + 1} 次重试:`, error);
      }
      retryCount++;
    }

    if (reflections.length === 0) {
      console.log(`[Reflection] 角色 ${characterId} 反思生成失败`);
      return [];
    }

    const reflectionMemories = reflections.map(content => ({
      characterId,
      novelId,
      content,
      type: 'REFLECTION' as const,
      importance: 9,
      tags: JSON.stringify(['反思', '自动生成']),
      timestamp: new Date(),
    }));

    await memory.writeMemory(reflectionMemories);

    console.log(`[Reflection] 角色 ${characterId} 生成了 ${reflections.length} 条反思`);

    return reflections;
  },

  // 检查并触发反思（自动触发机制）
  checkAndTriggerReflection: async (characterId: number): Promise<void> => {
    const dialogueCount = await prisma.memory.count({
      where: {
        characterId,
        type: 'DIALOGUE',
      },
    });

    const lastReflectionCount = await prisma.memory.count({
      where: {
        characterId,
        type: 'REFLECTION',
      },
    });

    const dialogueSinceLastReflection = dialogueCount - lastReflectionCount;

    if (dialogueSinceLastReflection >= DIALOGUE_COUNT_FOR_REFLECTION) {
      console.log(`[Reflection] 角色 ${characterId} 对话数达到 ${dialogueSinceLastReflection}，触发反思`);

      const character = await prisma.character.findUnique({
        where: { id: characterId },
      });

      if (character) {
        try {
          await agent.generateCharacterReflection(characterId, character.novelId);
        } catch (error) {
          console.error(`[Reflection] 自动反思失败:`, error);
        }
      }
    }
  },

  // 人设一致性校验
  validatePersonaConsistency: async (
    character: Character,
    response: string,
    relevantMemories: Memory[]
  ): Promise<PersonaValidationResult> => {
    const characterPersona = `角色名：${character.name}
人设描述：${character.description}
核心剧情：${character.plotSetting}
关系网络：${character.relationships}`;

    const recentReflections = relevantMemories
      .filter(m => m.type === 'REFLECTION')
      .slice(0, 3)
      .map(m => m.content)
      .join('\n');

    const validationPrompt = `你是一个角色人设一致性校验专家。请判断以下角色回复是否符合该角色的人设。

角色信息：
${characterPersona}

角色近期反思：
${recentReflections || '暂无反思'}

待校验的回复内容：
${response}

请根据以下规则判断：
1. 回复是否符合角色的性格特征
2. 回复是否使用了符合角色身份的语言风格
3. 回复是否与角色的背景设定一致
4. 回复是否与角色的反思结论相符

请返回JSON格式的判断结果：
{
  "isConsistent": true/false,
  "reason": "判断理由",
  "score": 0-10的置信度分数
}`;

    try {
      const llmConfig = llm.getConfig();
      let isConsistent = true;
      let reason = '回复符合角色人设';
      let score = 8;

      if (llmConfig.provider === 'mock') {
        console.log('[Mock Mode] 跳过人设校验');
        return { isConsistent: true, score: 8 };
      }

      const result = await llm.generateValidation(validationPrompt);

      try {
        const parsed = JSON.parse(result);
        isConsistent = parsed.isConsistent ?? true;
        reason = parsed.reason ?? reason;
        score = parsed.score ?? score;
      } catch {
        console.error('[Validation] 解析校验结果失败，使用默认结果');
      }

      return { isConsistent, reason, score };
    } catch (error) {
      console.error('[Validation] 校验失败:', error);
      return { isConsistent: true, reason: '校验过程出错，默认通过', score: 5 };
    }
  },

  // 智能体决策
  decide: async (_character: Character, _context: string): Promise<string> => {
    return '智能体决策内容';
  },

  // 智能体状态更新
  updateStatus: async (character: Character, _status: AgentStatus): Promise<Character> => {
    return character;
  },
};
