// 记忆管理函数入口文件
// 提供记忆写入、检索、管理功能

import { PrismaClient, Memory, Character, Novel, MemoryType } from '@prisma/client';

const prisma = new PrismaClient();

export interface WriteMemoryParams {
  characterId: number;
  novelId: number;
  content: string;
  type: string;
  importance?: number;
  tags?: string[];
}

export interface RetrieveMemoryParams {
  characterId: number;
  context: string;
  limit?: number;
}

export interface GetMemoriesParams {
  characterId?: number;
  novelId?: number;
  type?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

export interface InitCharacterMemoryParams {
  characterId: number;
}

interface EmbeddingResult {
  embedding: number[];
}

async function getEmbedding(text: string): Promise<number[]> {
  const LLM_CONFIG = {
    provider: (process.env.LLM_PROVIDER as string) || 'mock',
    model: process.env.LLM_MODEL || 'gpt-4o-mini',
    apiKey: process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || '',
    baseURL: process.env.LLM_BASE_URL,
  };

  if (!LLM_CONFIG.apiKey || LLM_CONFIG.apiKey === 'mock') {
    console.log('[Mock Mode] 使用随机 embedding');
    const dim = 1536;
    const embedding = new Array(dim).fill(0).map(() => Math.random() * 2 - 1);
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / norm);
  }

  try {
    const response = await fetch(`${LLM_CONFIG.baseURL || 'https://api.openai.com/v1'}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_CONFIG.apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status}`);
    }

    const data = await response.json() as EmbeddingResult & { data: Array<{ embedding: number[] }> };
    return data.data[0].embedding;
  } catch (error) {
    console.error('生成 embedding 失败:', error);
    throw error;
  }
}

function cosineSimilarity(vec1: number[], vec2: number[]): number {
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

function calculateRecencyScore(timestamp: Date): number {
  const now = new Date();
  const diffMinutes = (now.getTime() - timestamp.getTime()) / (1000 * 60);
  return Math.exp(-0.001 * diffMinutes);
}

export const memory = {
  writeMemory: async (params: WriteMemoryParams | WriteMemoryParams[]): Promise<Memory | Memory[]> => {
    const memories = Array.isArray(params) ? params : [params];

    if (memories.length === 0) {
      throw new Error('至少需要一条记忆');
    }

    for (const mem of memories) {
      if (!mem.characterId || !mem.novelId || !mem.content || !mem.type) {
        throw new Error('缺少必要的记忆参数');
      }
    }

    const data = memories.map(mem => ({
      characterId: mem.characterId,
      novelId: mem.novelId,
      content: mem.content,
      type: mem.type,
      timestamp: new Date(),
      importance: mem.importance ?? 5,
      tags: JSON.stringify(mem.tags || []),
    }));

    try {
      const result = await prisma.memory.createMany({
        data,
      });

      const createdMemories = await prisma.memory.findMany({
        where: {
          characterId: memories[0].characterId,
        },
        orderBy: {
          id: 'desc',
        },
        take: memories.length,
      });

      console.log(`[Memory] 成功写入 ${result.count} 条记忆`);
      return Array.isArray(params) ? createdMemories.reverse() : createdMemories[0];
    } catch (error) {
      console.error('写入记忆失败:', error);
      throw error;
    }
  },

  initCharacterMemory: async (params: InitCharacterMemoryParams): Promise<Memory[]> => {
    const { characterId } = params;

    const character = await prisma.character.findUnique({
      where: { id: characterId },
      include: { novel: true },
    });

    if (!character) {
      throw new Error('角色不存在');
    }

    const LLM_CONFIG = {
      provider: (process.env.LLM_PROVIDER as string) || 'mock',
      model: process.env.LLM_MODEL || 'gpt-4o-mini',
      apiKey: process.env.OPENAI_API_KEY || '',
      baseURL: process.env.LLM_BASE_URL,
    };

    const isMockMode = !LLM_CONFIG.apiKey || LLM_CONFIG.apiKey === 'mock';

    let plotMemories: string[];

    if (isMockMode) {
      console.log('[Mock Mode] 生成模拟初始记忆');
      plotMemories = [
        `我是${character.name}，${character.description}`,
        `我的核心设定是：${character.plotSetting}`,
        `我与其他角色的关系：${character.relationships}`,
        `我的经典台词：${character.出场情节}`,
      ];
    } else {
      const prompt = `你是一个小说角色记忆生成专家。请根据以下角色信息，生成该角色的初始剧情记忆。

要求：
1. 每条记忆必须是角色视角的第一人称描述
2. 记忆内容必须是角色的亲身经历或认知
3. 每条记忆应该是一个独立的、完整的事实描述
4. 记忆要体现角色的性格、背景和与其他角色的关系
5. 生成8-12条记忆

角色信息：
- 角色名：${character.name}
- 人设描述：${character.description}
- 核心剧情：${character.plotSetting}
- 关系网络：${character.relationships}
- 经典台词：${character.出场情节}

请以严格的JSON数组格式返回，每条记忆是一个字符串：
["记忆1", "记忆2", ...]`;

      try {
        const response = await fetch(`${LLM_CONFIG.baseURL || 'https://api.openai.com/v1'}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LLM_CONFIG.apiKey}`,
          },
          body: JSON.stringify({
            model: LLM_CONFIG.model,
            messages: [
              { role: 'system', content: '你是一个专业的小说角色记忆生成助手。' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
          }),
        });

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '[]';

        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          plotMemories = parsed;
        } else {
          throw new Error('LLM返回格式错误');
        }
      } catch (error) {
        console.error('生成初始记忆失败:', error);
        throw error;
      }
    }

    const importanceBase = 8;
    const memoriesToCreate = plotMemories.map((content, index) => ({
      characterId,
      novelId: character.novelId,
      content,
      type: 'PLOT' as string,
      timestamp: new Date(Date.now() - index * 1000),
      importance: Math.min(10, importanceBase + Math.floor(Math.random() * 3)),
      tags: JSON.stringify(['初始化', '剧情', '背景设定']),
    }));

    try {
      await prisma.memory.createMany({
        data: memoriesToCreate,
      });

      console.log(`[Memory] 为角色 ${characterId} 生成了 ${plotMemories.length} 条初始记忆`);

      return await prisma.memory.findMany({
        where: { characterId },
        orderBy: { id: 'desc' },
        take: plotMemories.length,
      });
    } catch (error) {
      console.error('写入初始记忆失败:', error);
      throw error;
    }
  },

  retrieveRelevantMemory: async (params: RetrieveMemoryParams): Promise<Memory[]> => {
    const { characterId, context, limit = 10 } = params;

    const allMemories = await prisma.memory.findMany({
      where: { characterId },
      orderBy: { timestamp: 'desc' },
    });

    if (allMemories.length === 0) {
      return [];
    }

    let contextEmbedding: number[];
    try {
      contextEmbedding = await getEmbedding(context);
    } catch (error) {
      console.error('获取上下文embedding失败，使用默认排序');
      return allMemories.slice(0, limit);
    }

    const scoredMemories = await Promise.all(
      allMemories.map(async (mem) => {
        const recencyScore = calculateRecencyScore(new Date(mem.timestamp));

        const importanceScore = mem.importance / 10;

        let relevanceScore = 0;
        try {
          const memEmbedding = await getEmbedding(mem.content);
          relevanceScore = (cosineSimilarity(contextEmbedding, memEmbedding) + 1) / 2;
        } catch (error) {
          console.error('计算记忆embedding失败:', error);
          relevanceScore = 0.5;
        }

        const totalScore = recencyScore * 0.3 + importanceScore * 0.3 + relevanceScore * 0.4;

        return {
          memory: mem,
          score: totalScore,
          breakdown: {
            recency: recencyScore,
            importance: importanceScore,
            relevance: relevanceScore,
          },
        };
      })
    );

    scoredMemories.sort((a, b) => b.score - a.score);

    const topMemories = scoredMemories.slice(0, limit).map(item => item.memory);

    console.log(`[Memory] 为角色 ${characterId} 检索到 ${topMemories.length} 条相关记忆`);

    return topMemories;
  },

  getMemories: async (params: GetMemoriesParams): Promise<Memory[]> => {
    const { characterId, novelId, type, startTime, endTime, limit = 50, offset = 0 } = params;

    const where: Record<string, unknown> = {};

    if (characterId) where.characterId = characterId;
    if (novelId) where.novelId = novelId;
    if (type) where.type = type;

    if (startTime || endTime) {
      where.timestamp = {};
      if (startTime) (where.timestamp as Record<string, Date>).gte = startTime;
      if (endTime) (where.timestamp as Record<string, Date>).lte = endTime;
    }

    return await prisma.memory.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    });
  },

  getMemoriesByCharacter: async (characterId: number, limit: number = 50): Promise<Memory[]> => {
    return await prisma.memory.findMany({
      where: { characterId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  },

  getMemoriesByType: async (characterId: number, type: string, limit: number = 50): Promise<Memory[]> => {
    return await prisma.memory.findMany({
      where: { characterId, type },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  },

  getImportantMemories: async (characterId: number, minImportance: number = 7, limit: number = 50): Promise<Memory[]> => {
    return await prisma.memory.findMany({
      where: {
        characterId,
        importance: { gte: minImportance },
      },
      orderBy: [{ importance: 'desc' }, { timestamp: 'desc' }],
      take: limit,
    });
  },

  getMemoriesByTag: async (characterId: number, tag: string, limit: number = 50): Promise<Memory[]> => {
    const allMemories = await prisma.memory.findMany({
      where: { characterId },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });

    return allMemories.filter(mem => {
      try {
        const tags = JSON.parse(mem.tags) as string[];
        return tags.includes(tag);
      } catch {
        return false;
      }
    }).slice(0, limit);
  },

  updateMemoryImportance: async (memoryId: number, importance: number): Promise<Memory> => {
    return await prisma.memory.update({
      where: { id: memoryId },
      data: { importance },
    });
  },

  searchMemories: async (characterId: number, query: string, limit: number = 50): Promise<Memory[]> => {
    return await prisma.memory.findMany({
      where: {
        characterId,
        content: { contains: query },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  },

  cleanupOldMemories: async (characterId: number, days: number = 30): Promise<number> => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await prisma.memory.deleteMany({
      where: {
        characterId,
        timestamp: { lt: cutoffDate },
        importance: { lt: 5 },
      },
    });

    console.log(`[Memory] 清理了 ${result.count} 条过期低重要性记忆`);
    return result.count;
  },

  deleteAllMemories: async (characterId: number): Promise<number> => {
    const result = await prisma.memory.deleteMany({
      where: { characterId },
    });

    console.log(`[Memory] 删除了角色 ${characterId} 的所有 ${result.count} 条记忆`);
    return result.count;
  },
};
