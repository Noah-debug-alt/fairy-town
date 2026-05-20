/**
 * 简单互动系统
 * 当角色靠近时触发简单互动（打招呼、点头等）
 * 
 * 核心功能：
 * - 检测角色间的距离
 * - 触发简单互动
 * - 生成互动内容
 * - 记录互动历史
 */

import { PrismaClient, Character, CharacterPosition } from '@prisma/client';
import { euclideanDistance, GridPosition } from './pathfinding';

/**
 * 互动类型
 */
export type InteractionType =
  | 'greeting'    // 打招呼
  | 'wave'        // 挥手
  | 'nod'         // 点头
  | 'pass_by'     // 擦肩而过
  | 'chat';       // 简单聊天

/**
 * 互动接口
 */
export interface Interaction {
  type: InteractionType;
  character1Id: number;
  character2Id: number;
  character1Name: string;
  character2Name: string;
  content: string;
  timestamp: Date;
}

/**
 * 互动结果
 */
export interface InteractionResult {
  interactions: Interaction[];
  hasInteractions: boolean;
}

// 互动触发距离（格子数）
const INTERACTION_DISTANCE = 2;

// 互动冷却时间（毫秒）
const INTERACTION_COOLDOWN = 30000;

// 同一对角色的互动间隔（毫秒）
const PAIR_COOLDOWN = 60000;

/**
 * 互动系统类
 */
export class InteractionSystem {
  private prisma: PrismaClient;
  
  // 上次互动时间记录（角色对）
  private lastInteractionTime: Map<string, Date> = new Map();
  
  // 角色信息缓存
  private characterCache: Map<number, Character> = new Map();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 检测角色间的互动
   * 
   * @param positions 所有角色的位置
   * @returns 检测到的互动列表
   */
  async detectInteractions(positions: CharacterPosition[]): Promise<Interaction[]> {
    const interactions: Interaction[] = [];
    const now = new Date();

    // 遍历所有角色对
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const pos1 = positions[i];
        const pos2 = positions[j];

        // 计算距离
        const distance = euclideanDistance(
          { x: pos1.gridX, y: pos1.gridY },
          { x: pos2.gridX, y: pos2.gridY }
        );

        // 检查是否在互动范围内
        if (distance <= INTERACTION_DISTANCE) {
          // 检查冷却时间
          const pairKey = this.getPairKey(pos1.characterId, pos2.characterId);
          const lastTime = this.lastInteractionTime.get(pairKey);

          if (lastTime && now.getTime() - lastTime.getTime() < PAIR_COOLDOWN) {
            continue;  // 还在冷却中
          }

          // 生成互动
          const interaction = await this.generateInteraction(
            pos1.characterId,
            pos2.characterId,
            distance
          );

          if (interaction) {
            interactions.push(interaction);
            this.lastInteractionTime.set(pairKey, now);
          }
        }
      }
    }

    return interactions;
  }

  /**
   * 生成互动内容
   */
  private async generateInteraction(
    character1Id: number,
    character2Id: number,
    distance: number
  ): Promise<Interaction | null> {
    // 获取角色信息
    const char1 = await this.getCharacter(character1Id);
    const char2 = await this.getCharacter(character2Id);

    if (!char1 || !char2) {
      return null;
    }

    // 根据距离和关系选择互动类型
    const type = this.selectInteractionType(distance, char1, char2);
    
    // 生成互动内容
    const content = await this.generateInteractionContent(type, char1, char2);

    return {
      type,
      character1Id: char1.id,
      character2Id: char2.id,
      character1Name: char1.name,
      character2Name: char2.name,
      content,
      timestamp: new Date()
    };
  }

  /**
   * 选择互动类型
   */
  private selectInteractionType(
    distance: number,
    char1: Character,
    char2: Character
  ): InteractionType {
    // 检查角色关系
    const relationships1 = this.parseRelationships(char1.relationships);
    const relationship = relationships1[char2.name];

    // 根据关系和距离选择互动类型
    if (relationship === 'friend' || relationship === 'family') {
      // 朋友或家人更可能打招呼
      const types: InteractionType[] = ['greeting', 'wave', 'chat'];
      return types[Math.floor(Math.random() * types.length)];
    } else if (relationship === 'enemy') {
      // 敌人可能只是擦肩而过
      return 'pass_by';
    } else {
      // 普通关系
      const types: InteractionType[] = ['nod', 'wave', 'pass_by'];
      return types[Math.floor(Math.random() * types.length)];
    }
  }

  /**
   * 生成互动内容
   */
  private async generateInteractionContent(
    type: InteractionType,
    char1: Character,
    char2: Character
  ): Promise<string> {
    // 预定义的互动模板
    const templates: Record<InteractionType, string[]> = {
      greeting: [
        `${char1.name}向${char2.name}打招呼："早上好！"`,
        `${char1.name}笑着说："嘿，${char2.name}！"`,
        `${char1.name}热情地喊道："${char2.name}，好久不见！"`,
        `${char1.name}点头致意："${char2.name}，你好。"`
      ],
      wave: [
        `${char1.name}向${char2.name}挥了挥手。`,
        `${char1.name}远远地向${char2.name}招手。`,
        `${char2.name}看到${char1.name}，挥手示意。`
      ],
      nod: [
        `${char1.name}向${char2.name}点了点头。`,
        `${char1.name}和${char2.name}互相点头致意。`,
        `${char1.name}微微点头，${char2.name}也点头回应。`
      ],
      pass_by: [
        `${char1.name}和${char2.name}擦肩而过。`,
        `${char1.name}经过${char2.name}身边，没有说话。`,
        `${char1.name}和${char2.name}相遇，互相看了一眼。`
      ],
      chat: [
        `${char1.name}和${char2.name}停下来聊了几句。`,
        `${char1.name}问道："最近怎么样？"`,
        `${char2.name}对${char1.name}说："天气真不错。"`
      ]
    };

    const typeTemplates = templates[type];
    return typeTemplates[Math.floor(Math.random() * typeTemplates.length)];
  }

  /**
   * 解析角色关系
   */
  private parseRelationships(relationshipsJson: string): Record<string, string> {
    try {
      return JSON.parse(relationshipsJson || '{}');
    } catch {
      return {};
    }
  }

  /**
   * 获取角色信息（带缓存）
   */
  private async getCharacter(characterId: number): Promise<Character | null> {
    if (this.characterCache.has(characterId)) {
      return this.characterCache.get(characterId)!;
    }

    const character = await this.prisma.character.findUnique({
      where: { id: characterId }
    });

    if (character) {
      this.characterCache.set(characterId, character);
    }

    return character;
  }

  /**
   * 生成角色对的唯一标识
   */
  private getPairKey(id1: number, id2: number): string {
    return id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.characterCache.clear();
    this.lastInteractionTime.clear();
  }

  /**
   * 记录互动到数据库
   */
  async recordInteraction(interaction: Interaction, novelId: number): Promise<void> {
    // 创建小镇事件
    await this.prisma.townEvent.create({
      data: {
        novelId,
        characterId: interaction.character1Id,
        type: 'interaction',
        content: interaction.content,
        characterName: interaction.character1Name
      }
    });
  }

  /**
   * 获取角色附近的互动对象
   */
  async getNearbyCharacters(
    characterId: number,
    positions: CharacterPosition[],
    radius: number = INTERACTION_DISTANCE
  ): Promise<number[]> {
    const myPos = positions.find(p => p.characterId === characterId);
    if (!myPos) return [];

    const nearby: number[] = [];

    for (const pos of positions) {
      if (pos.characterId === characterId) continue;

      const distance = euclideanDistance(
        { x: myPos.gridX, y: myPos.gridY },
        { x: pos.gridX, y: pos.gridY }
      );

      if (distance <= radius) {
        nearby.push(pos.characterId);
      }
    }

    return nearby;
  }

  /**
   * 检查两个角色是否可以互动
   */
  canInteract(
    character1Id: number,
    character2Id: number,
    positions: CharacterPosition[]
  ): boolean {
    const pos1 = positions.find(p => p.characterId === character1Id);
    const pos2 = positions.find(p => p.characterId === character2Id);

    if (!pos1 || !pos2) return false;

    const distance = euclideanDistance(
      { x: pos1.gridX, y: pos1.gridY },
      { x: pos2.gridX, y: pos2.gridY }
    );

    if (distance > INTERACTION_DISTANCE) return false;

    // 检查冷却
    const pairKey = this.getPairKey(character1Id, character2Id);
    const lastTime = this.lastInteractionTime.get(pairKey);
    const now = new Date();

    if (lastTime && now.getTime() - lastTime.getTime() < PAIR_COOLDOWN) {
      return false;
    }

    return true;
  }

  /**
   * 强制触发互动（用于情节需要）
   */
  async forceInteraction(
    character1Id: number,
    character2Id: number,
    type: InteractionType,
    novelId: number
  ): Promise<Interaction | null> {
    const char1 = await this.getCharacter(character1Id);
    const char2 = await this.getCharacter(character2Id);

    if (!char1 || !char2) return null;

    const content = await this.generateInteractionContent(type, char1, char2);

    const interaction: Interaction = {
      type,
      character1Id: char1.id,
      character2Id: char2.id,
      character1Name: char1.name,
      character2Name: char2.name,
      content,
      timestamp: new Date()
    };

    // 记录互动
    await this.recordInteraction(interaction, novelId);

    // 更新冷却时间
    const pairKey = this.getPairKey(character1Id, character2Id);
    this.lastInteractionTime.set(pairKey, new Date());

    return interaction;
  }
}

// 导出单例
let interactionSystemInstance: InteractionSystem | null = null;

export function getInteractionSystem(prisma: PrismaClient): InteractionSystem {
  if (!interactionSystemInstance) {
    interactionSystemInstance = new InteractionSystem(prisma);
  }
  return interactionSystemInstance;
}

/**
 * 独立函数：检测互动
 */
export function detectInteractions(
  positions: CharacterPosition[],
  lastInteractionTime: Map<string, Date>
): Interaction[] {
  const interactions: Interaction[] = [];
  const now = new Date();

  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const pos1 = positions[i];
      const pos2 = positions[j];

      const distance = euclideanDistance(
        { x: pos1.gridX, y: pos1.gridY },
        { x: pos2.gridX, y: pos2.gridY }
      );

      if (distance <= INTERACTION_DISTANCE) {
        const pairKey = pos1.characterId < pos2.characterId
          ? `${pos1.characterId}-${pos2.characterId}`
          : `${pos2.characterId}-${pos1.characterId}`;

        const lastTime = lastInteractionTime.get(pairKey);
        if (lastTime && now.getTime() - lastTime.getTime() < PAIR_COOLDOWN) {
          continue;
        }

        // 简单互动内容
        interactions.push({
          type: 'nod',
          character1Id: pos1.characterId,
          character2Id: pos2.characterId,
          character1Name: `角色${pos1.characterId}`,
          character2Name: `角色${pos2.characterId}`,
          content: '两个角色互相点了点头。',
          timestamp: now
        });

        lastInteractionTime.set(pairKey, now);
      }
    }
  }

  return interactions;
}

/**
 * 独立函数：生成互动内容
 */
export async function generateInteractionContent(
  type: InteractionType,
  character1: Character,
  character2: Character
): Promise<string> {
  const templates: Record<InteractionType, string[]> = {
    greeting: [
      `${character1.name}向${character2.name}打招呼。`,
      `${character1.name}："你好，${character2.name}！"`
    ],
    wave: [
      `${character1.name}向${character2.name}挥了挥手。`
    ],
    nod: [
      `${character1.name}向${character2.name}点了点头。`
    ],
    pass_by: [
      `${character1.name}和${character2.name}擦肩而过。`
    ],
    chat: [
      `${character1.name}和${character2.name}聊了几句。`
    ]
  };

  const typeTemplates = templates[type] || templates.nod;
  return typeTemplates[Math.floor(Math.random() * typeTemplates.length)];
}
