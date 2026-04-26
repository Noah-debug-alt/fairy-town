// 记忆管理系统 - 斯坦福小镇风格
// 核心功能：记忆存储、检索、重要性计算、反思生成、记忆压缩

import { PrismaClient, Memory, Observation, Reflection, MemorySummary, MemoryImportanceHistory } from '@prisma/client';

const prisma = new PrismaClient();

// 延迟导入避免循环依赖
let llmModule: typeof import('../llm/index') | null = null;
async function getLlmModule() {
  if (!llmModule) {
    llmModule = await import('../llm/index');
  }
  return llmModule;
}

export type MemoryType = 'OBSERVATION' | 'DIALOGUE' | 'REFLECTION' | 'PLOT';

export interface WriteMemoryParams {
  characterId: number;
  novelId: number;
  content: string;
  type: MemoryType;
  importance?: number;
  tags?: string[];
  source?: 'auto' | 'reflect' | 'manual' | 'event';
  location?: string;
  participants?: string[];
  emotion?: string;
}

export interface MemoryRetrievalParams {
  characterId: number;
  context?: string;
  limit?: number;
  types?: MemoryType[];
  minImportance?: number;
  timeRange?: {
    start: Date;
    end: Date;
  };
}

export interface MemoryWithImportance extends Memory {
  score?: number;
}

const DEFAULT_IMPORTANCE = 5;
const HIGH_IMPORTANCE_THRESHOLD = 7;
const REFLECTION_TRIGGER_COUNT = 10;
const MAX_ACTIVE_MEMORIES = 100;
const COMPRESSION_THRESHOLD = 50;

function calculateImportance(
  content: string,
  type: MemoryType,
  options?: { hasEmotion?: boolean; hasEntities?: boolean; isKeyEvent?: boolean }
): number {
  let importance = DEFAULT_IMPORTANCE;

  const contentLength = content.length;
  if (contentLength > 200) importance += 1;
  if (contentLength > 500) importance += 1;

  switch (type) {
    case 'DIALOGUE':
      importance += 1;
      break;
    case 'REFLECTION':
      importance += 3;
      break;
    case 'PLOT':
      importance += 2;
      break;
    case 'OBSERVATION':
    default:
      break;
  }

  if (options?.hasEmotion) importance += 1;
  if (options?.hasEntities) importance += 1;
  if (options?.isKeyEvent) importance += 2;

  return Math.min(10, Math.max(1, importance));
}

function extractKeywords(content: string): string[] {
  const stopWords = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with'
  ]);

  const words = content
    .replace(/[^\w\u4e00-\u9fa5]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1 && !stopWords.has(word.toLowerCase()));

  const wordCount = new Map<string, number>();
  words.forEach(word => {
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
  });

  return Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

function extractEntities(content: string): string[] {
  const entityPattern = /[\u4e00-\u9fa5]{2,}(?:说|道|想|认为|感觉)|[A-Z][a-z]+(?=\s+(?:说|道|想|认为|感觉|在|去|来))/g;
  const matches = content.match(entityPattern) || [];
  return [...new Set(matches)];
}

export const memory = {
  // 写入新记忆（核心方法）
  writeMemory: async (params: WriteMemoryParams): Promise<Memory> => {
    const {
      characterId,
      novelId,
      content,
      type,
      importance,
      tags = [],
      source = 'auto',
      location,
      participants = [],
      emotion
    } = params;

    const calculatedImportance = importance ?? calculateImportance(content, type, {
      hasEmotion: !!emotion,
      hasEntities: extractEntities(content).length > 0,
      isKeyEvent: type === 'PLOT' || type === 'DIALOGUE'
    });

    const keywords = extractKeywords(content);
    const entities = extractEntities(content);

    const mem = await prisma.memory.create({
      data: {
        characterId,
        novelId,
        content,
        type,
        importance: calculatedImportance,
        tags: JSON.stringify(tags),
        source,
        keywords: JSON.stringify(keywords),
        entities: JSON.stringify(entities),
        sentiment: emotion || null,
        timestamp: new Date()
      }
    });

    if (location || participants.length > 0) {
      await prisma.observation.create({
        data: {
          characterId,
          novelId,
          content,
          sourceType: type.toLowerCase(),
          location: location || null,
          participants: JSON.stringify(participants),
          emotion: emotion || null,
          isImportant: calculatedImportance >= HIGH_IMPORTANCE_THRESHOLD
        }
      });
    }

    await memory.checkAndTriggerReflection(characterId, novelId);

    await memory.cleanupOldMemories(characterId);

    return mem;
  },

  // 批量写入记忆
  writeMemories: async (paramsList: WriteMemoryParams[]): Promise<Memory[]> => {
    const results: Memory[] = [];
    for (const params of paramsList) {
      const mem = await memory.writeMemory(params);
      results.push(mem);
    }
    return results;
  },

  // 获取角色记忆（支持多种过滤条件）
  getMemories: async (
    characterId: number,
    options?: {
      limit?: number;
      type?: MemoryType;
      types?: MemoryType[];
      minImportance?: number;
      includeArchived?: boolean;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<Memory[]> => {
    const {
      limit = 50,
      type,
      types,
      minImportance,
      includeArchived = false,
      startDate,
      endDate
    } = options || {};

    const where: Record<string, unknown> = { characterId };

    if (!includeArchived) {
      where.isArchived = false;
    }

    if (type) {
      where.type = type;
    } else if (types && types.length > 0) {
      where.type = { in: types };
    }

    if (minImportance !== undefined) {
      where.importance = { gte: minImportance };
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        (where.timestamp as Record<string, Date>).gte = startDate;
      }
      if (endDate) {
        (where.timestamp as Record<string, Date>).lte = endDate;
      }
    }

    return await prisma.memory.findMany({
      where,
      orderBy: [
        { importance: 'desc' },
        { timestamp: 'desc' }
      ],
      take: limit
    });
  },

  // 获取记忆详情
  getMemoryById: async (memoryId: number): Promise<Memory | null> => {
    return await prisma.memory.findUnique({
      where: { id: memoryId }
    });
  },

  // 检索相关记忆（基于关键词、重要性和语义相似度）
  retrieveRelevantMemory: async (params: MemoryRetrievalParams): Promise<Memory[]> => {
    const { characterId, context, limit = 5 } = params;

    const memories = await prisma.memory.findMany({
      where: {
        characterId,
        isArchived: false
      },
      orderBy: { timestamp: 'desc' },
      take: 50
    });

    if (memories.length === 0) {
      return [];
    }

    const scoredMemories = await Promise.all(memories.map(async (mem) => {
      let score = mem.importance;

      if (context) {
        try {
          const llm = await getLlmModule();
          const [contextEmbedding, memEmbedding] = await Promise.all([
            llm.generateEmbedding(context),
            llm.generateEmbedding(mem.content)
          ]);
          const similarity = llm.cosineSimilarity(contextEmbedding, memEmbedding);
          score += similarity * 5;
        } catch (error) {
          console.warn('语义相似度计算失败，使用关键词匹配:', error);
          const contextKeywords = extractKeywords(context);
          const contextEntities = extractEntities(context);
          const memKeywords = JSON.parse(mem.keywords || '[]') as string[];
          const memEntities = JSON.parse(mem.entities || '[]') as string[];

          contextKeywords.forEach(keyword => {
            if (memKeywords.includes(keyword) || mem.content.includes(keyword)) {
              score += 2;
            }
          });

          contextEntities.forEach(entity => {
            if (memEntities.includes(entity) || mem.content.includes(entity)) {
              score += 3;
            }
          });
        }
      }

      const hoursSinceCreation = (Date.now() - mem.createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceCreation < 24) score += 1;
      if (hoursSinceCreation < 168) score += 0.5;

      return { ...mem, score };
    }));

    const result = scoredMemories
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, limit)
      .map(({ score: _score, ...mem }) => mem);

    // 更新访问计数：检索到的记忆增加访问次数
    if (result.length > 0) {
      await prisma.memory.updateMany({
        where: { id: { in: result.map(m => m.id) } },
        data: {
          accessCount: { increment: 1 },
          lastAccessedAt: new Date()
        }
      });
    }

    return result;
  },

  // 获取重要记忆
  getImportantMemories: async (
    characterId: number,
    minImportance: number = 7,
    limit: number = 20
  ): Promise<Memory[]> => {
    return await prisma.memory.findMany({
      where: {
        characterId,
        importance: { gte: minImportance },
        isArchived: false
      },
      orderBy: { timestamp: 'desc' },
      take: limit
    });
  },

  // 获取最近的记忆
  getRecentMemories: async (
    characterId: number,
    hours: number = 24,
    limit: number = 20
  ): Promise<Memory[]> => {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return await prisma.memory.findMany({
      where: {
        characterId,
        timestamp: { gte: since },
        isArchived: false
      },
      orderBy: { timestamp: 'desc' },
      take: limit
    });
  },

  // 获取记忆数量统计
  getMemoryStats: async (characterId: number) => {
    const [
      total,
      byType,
      important,
      recent,
      archived
    ] = await Promise.all([
      prisma.memory.count({ where: { characterId } }),
      prisma.memory.groupBy({
        by: ['type'],
        where: { characterId },
        _count: true
      }),
      prisma.memory.count({
        where: { characterId, importance: { gte: 7 }, isArchived: false }
      }),
      prisma.memory.count({
        where: {
          characterId,
          timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          isArchived: false
        }
      }),
      prisma.memory.count({
        where: { characterId, isArchived: true }
      })
    ]);

    return {
      total,
      byType: byType.reduce((acc, item) => {
        acc[item.type] = item._count;
        return acc;
      }, {} as Record<string, number>),
      important,
      recent,
      archived
    };
  },

  // 更新记忆
  updateMemory: async (
    memoryId: number,
    data: Partial<{
      content: string;
      importance: number;
      tags: string[];
      isArchived: boolean;
      isCompressed: boolean;
    }>
  ): Promise<Memory> => {
    const updateData: Record<string, unknown> = { ...data };
    if (data.tags) {
      updateData.tags = JSON.stringify(data.tags);
    }

    return await prisma.memory.update({
      where: { id: memoryId },
      data: updateData
    });
  },

  // 更新记忆重要性（系统自动更新）
  updateMemoryImportance: async (memoryId: number, importance: number): Promise<Memory> => {
    return await prisma.memory.update({
      where: { id: memoryId },
      data: { importance: Math.min(10, Math.max(1, importance)) }
    });
  },

  // 用户手动设置记忆重要性（带历史记录）
  setMemoryImportance: async (
    memoryId: number,
    newImportance: number,
    operator: string = 'user',
    reason?: string
  ): Promise<{ memory: Memory; historyEntry: MemoryImportanceHistory | null }> => {
    // 验证重要性范围
    if (newImportance < 1 || newImportance > 10) {
      throw new Error('重要性值必须在 1-10 范围内');
    }

    // 获取当前记忆
    const currentMemory = await prisma.memory.findUnique({
      where: { id: memoryId }
    });

    if (!currentMemory) {
      throw new Error('记忆不存在');
    }

    const oldImportance = currentMemory.importance;

    // 如果值相同，直接返回
    if (oldImportance === newImportance) {
      return { memory: currentMemory, historyEntry: null };
    }

    // 使用事务更新记忆并记录历史
    const result = await prisma.$transaction(async (tx) => {
      // 更新记忆
      const updatedMemory = await tx.memory.update({
        where: { id: memoryId },
        data: {
          importance: newImportance,
          isManuallySet: true,
          manualSetBy: operator,
          manualSetAt: new Date()
        }
      });

      // 记录修改历史
      const historyEntry = await tx.memoryImportanceHistory.create({
        data: {
          memoryId,
          oldImportance,
          newImportance,
          operator,
          operatorType: 'user',
          reason: reason || null
        }
      });

      return { memory: updatedMemory, historyEntry };
    });

    return result;
  },

  // 获取记忆重要性修改历史
  getImportanceHistory: async (
    memoryId: number,
    limit: number = 20
  ): Promise<MemoryImportanceHistory[]> => {
    return await prisma.memoryImportanceHistory.findMany({
      where: { memoryId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  },

  // 归档记忆（用于记忆压缩）
  archiveMemory: async (memoryId: number): Promise<Memory> => {
    return await prisma.memory.update({
      where: { id: memoryId },
      data: { isArchived: true }
    });
  },

  // 删除记忆
  deleteMemory: async (memoryId: number): Promise<void> => {
    await prisma.memory.delete({
      where: { id: memoryId }
    });
  },

  // 检查并触发反思
  checkAndTriggerReflection: async (characterId: number, _novelId: number): Promise<boolean> => {
    const recentMemories = await prisma.memory.findMany({
      where: {
        characterId,
        type: { in: ['DIALOGUE', 'OBSERVATION'] },
        isArchived: false
      },
      orderBy: { timestamp: 'desc' },
      take: REFLECTION_TRIGGER_COUNT
    });

    if (recentMemories.length < REFLECTION_TRIGGER_COUNT) {
      return false;
    }

    const lastReflection = await prisma.memory.findFirst({
      where: {
        characterId,
        type: 'REFLECTION'
      },
      orderBy: { timestamp: 'desc' }
    });

    if (lastReflection) {
      const hoursSinceLastReflection = (Date.now() - lastReflection.timestamp.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastReflection < 24) {
        return false;
      }
    }

    return true;
  },

  // 生成角色反思（完整流程）
  generateReflection: async (
    characterId: number,
    novelId: number,
    triggerEvent?: string
  ): Promise<Memory[]> => {
    const character = await prisma.character.findUnique({
      where: { id: characterId }
    });

    if (!character) {
      throw new Error('角色不存在');
    }

    const recentMemories = await prisma.memory.findMany({
      where: {
        characterId,
        type: { in: ['DIALOGUE', 'OBSERVATION'] },
        isArchived: false
      },
      orderBy: { timestamp: 'desc' },
      take: 20
    });

    if (recentMemories.length < 3) {
      throw new Error('记忆不足，需要至少3条记忆才能生成反思');
    }

    const relatedMemoryIds = recentMemories.slice(0, 10).map(m => m.id);

    let reflectionContents: string[] = [];

    try {
      const llm = await getLlmModule();
      reflectionContents = await llm.generateReflectionContent(
        {
          name: character.name,
          description: character.description,
          plotSetting: character.plotSetting,
          relationships: character.relationships
        },
        recentMemories.map(m => ({ content: m.content, timestamp: m.timestamp }))
      );
    } catch (error) {
      console.error('LLM生成反思失败，使用默认反思:', error);
      reflectionContents = [
        `作为${character.name}，我最近的行为让我思考了很多。我意识到${character.description}。`
      ];
    }

    if (reflectionContents.length === 0) {
      reflectionContents = [
        `作为${character.name}，我最近的行为让我思考了很多。我意识到${character.description}。`
      ];
    }

    const reflectionMemories: Memory[] = [];

    for (const content of reflectionContents) {
      const mem = await prisma.memory.create({
        data: {
          characterId,
          novelId,
          content,
          type: 'REFLECTION',
          importance: 9,
          tags: JSON.stringify(['反思', '自动生成']),
          source: 'reflect',
          relatedMemoryIds: JSON.stringify(relatedMemoryIds),
          timestamp: new Date()
        }
      });
      reflectionMemories.push(mem);

      await prisma.reflection.create({
        data: {
          characterId,
          novelId,
          content,
          triggerEvent: triggerEvent || null,
          relatedMemories: JSON.stringify(relatedMemoryIds),
          importance: 9,
          isActive: true
        }
      });
    }

    return reflectionMemories;
  },

  // 获取反思历史
  getReflections: async (
    characterId: number,
    limit: number = 10
  ): Promise<Reflection[]> => {
    return await prisma.reflection.findMany({
      where: { characterId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  },

  // 获取观察记录
  getObservations: async (
    characterId: number,
    limit: number = 20
  ): Promise<Observation[]> => {
    return await prisma.observation.findMany({
      where: { characterId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  },

  // 清理旧记忆（记忆压缩）
  cleanupOldMemories: async (characterId: number): Promise<number> => {
    const totalMemories = await prisma.memory.count({
      where: { characterId, isArchived: false }
    });

    if (totalMemories <= MAX_ACTIVE_MEMORIES) {
      return 0;
    }

    const toArchive = await prisma.memory.findMany({
      where: {
        characterId,
        isArchived: false,
        type: { in: ['OBSERVATION', 'DIALOGUE'] },
        importance: { lt: HIGH_IMPORTANCE_THRESHOLD }
      },
      orderBy: [
        { importance: 'asc' },
        { timestamp: 'asc' }
      ],
      take: totalMemories - MAX_ACTIVE_MEMORIES + COMPRESSION_THRESHOLD
    });

    let archivedCount = 0;
    for (const mem of toArchive) {
      await prisma.memory.update({
        where: { id: mem.id },
        data: { isArchived: true }
      });
      archivedCount++;
    }

    return archivedCount;
  },

  // 生成每日摘要
  generateDailySummary: async (
    characterId: number,
    novelId: number,
    date: Date = new Date()
  ): Promise<MemorySummary> => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const dayMemories = await prisma.memory.findMany({
      where: {
        characterId,
        timestamp: { gte: startOfDay, lte: endOfDay },
        isArchived: false
      }
    });

    if (dayMemories.length === 0) {
      throw new Error('当天没有记忆');
    }

    const importantMemories = dayMemories.filter(m => m.importance >= 7);
    const content = importantMemories.length > 0
      ? `今日重要记忆：${importantMemories.map(m => m.content).join('；')}`
      : `今日共记录${dayMemories.length}条记忆`;

    const allKeywords = dayMemories.flatMap(m => JSON.parse(m.keywords || '[]'));
    const uniqueKeywords = [...new Set(allKeywords)].slice(0, 10);

    return await prisma.memorySummary.create({
      data: {
        characterId,
        novelId,
        memoryType: 'daily',
        content,
        dateRangeStart: startOfDay,
        dateRangeEnd: endOfDay,
        keywords: JSON.stringify(uniqueKeywords),
        memoryCount: dayMemories.length,
        importance: Math.round(dayMemories.reduce((sum, m) => sum + m.importance, 0) / dayMemories.length)
      }
    });
  },

  // 获取记忆摘要
  getMemorySummaries: async (
    characterId: number,
    memoryType?: string
  ): Promise<MemorySummary[]> => {
    const where: Record<string, unknown> = { characterId };
    if (memoryType) {
      where.memoryType = memoryType;
    }

    return await prisma.memorySummary.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  },

  // 搜索记忆
  searchMemories: async (
    characterId: number,
    query: string,
    limit: number = 20
  ): Promise<Memory[]> => {
    const keywords = extractKeywords(query);
    const entities = extractEntities(query);

    const memories = await prisma.memory.findMany({
      where: {
        characterId,
        isArchived: false,
        OR: [
          { content: { contains: query } },
          { keywords: { contains: keywords[0] || '' } },
          ...entities.map(entity => ({ content: { contains: entity } }))
        ].filter(condition => 'content' in condition ? condition.content.contains.length > 0 : true)
      },
      orderBy: { importance: 'desc' },
      take: limit
    });

    return memories;
  },

  // 获取上下文相关的记忆（用于 Agent 对话）
  getContextualMemories: async (
    characterId: number,
    currentSituation: string,
    limit: number = 10
  ): Promise<Memory[]> => {
    const relevant = await memory.retrieveRelevantMemory({
      characterId,
      context: currentSituation,
      limit: Math.floor(limit / 2)
    });

    const recent = await memory.getRecentMemories(characterId, 24, Math.floor(limit / 2));

    const combined = [...relevant];
    recent.forEach(mem => {
      if (!combined.find(m => m.id === mem.id)) {
        combined.push(mem);
      }
    });

    return combined.slice(0, limit);
  }
};

export default memory;
