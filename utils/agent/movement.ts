/**
 * 移动管理模块
 * 管理角色的移动状态、路径执行、位置更新
 * 
 * 核心功能：
 * - 开始/停止移动
 * - 更新角色位置
 * - 管理移动路径
 * - 记录移动历史
 */

import { PrismaClient } from '@prisma/client';
import { findPath, GridPosition, isWalkable, euclideanDistance, simplifyPath } from './pathfinding';

/**
 * 活动移动状态
 */
interface ActiveMovement {
  characterId: number;
  path: GridPosition[];
  currentIndex: number;
  startTime: Date;
  reason?: string;
}

/**
 * 移动结果
 */
export interface MovementResult {
  success: boolean;
  message: string;
  path?: GridPosition[];
  estimatedTime?: number;  // 预计到达时间（毫秒）
}

/**
 * 移动管理器类
 */
export class MovementManager {
  private prisma: PrismaClient;
  
  // 活动中的移动
  private activeMovements: Map<number, ActiveMovement> = new Map();
  
  // 缓存的可行走地图
  private walkableMapCache: Map<number, number[][]> = new Map();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 开始移动角色到目标位置
   * 
   * @param characterId 角色ID
   * @param targetPos 目标位置
   * @param reason 移动原因
   * @returns 移动结果
   */
  async startMovement(
    characterId: number,
    targetPos: GridPosition,
    reason?: string
  ): Promise<MovementResult> {
    // 获取角色当前位置
    const position = await this.prisma.characterPosition.findUnique({
      where: { characterId },
      include: {
        character: {
          include: { novel: { include: { townMap: true } } }
        }
      }
    });

    if (!position || !position.character.novel.townMap) {
      return {
        success: false,
        message: '角色位置或地图数据不存在'
      };
    }

    const townMap = position.character.novel.townMap;
    const walkableMap = await this.getWalkableMap(townMap.id, townMap.walkableMap);

    // 检查目标位置是否可行走
    if (!isWalkable(targetPos, walkableMap)) {
      return {
        success: false,
        message: '目标位置不可达'
      };
    }

    const startPos: GridPosition = {
      x: position.gridX,
      y: position.gridY
    };

    // 如果已经在目标位置附近，不需要移动
    if (euclideanDistance(startPos, targetPos) < 0.5) {
      return {
        success: true,
        message: '已在目标位置',
        path: [startPos]
      };
    }

    // 计算路径
    let path = findPath(
      { x: Math.round(startPos.x), y: Math.round(startPos.y) },
      { x: Math.round(targetPos.x), y: Math.round(targetPos.y) },
      walkableMap
    );

    if (path.length === 0) {
      return {
        success: false,
        message: '无法找到路径'
      };
    }

    // 简化路径
    path = simplifyPath(path);

    // 添加精确的起点和终点
    path[0] = startPos;
    path[path.length - 1] = targetPos;

    // 计算预计时间
    const pathLength = path.reduce((sum, _, i) => {
      if (i === 0) return 0;
      return sum + euclideanDistance(path[i - 1], path[i]);
    }, 0);
    const estimatedTime = (pathLength / position.moveSpeed) * 1000;

    // 创建移动记录
    await this.prisma.movement.create({
      data: {
        characterId,
        novelId: position.character.novelId,
        fromX: startPos.x,
        fromY: startPos.y,
        toX: targetPos.x,
        toY: targetPos.y,
        path: JSON.stringify(path),
        reason: reason || null,
        status: 'moving'
      }
    });

    // 更新角色位置状态
    await this.prisma.characterPosition.update({
      where: { characterId },
      data: {
        targetX: targetPos.x,
        targetY: targetPos.y,
        isMoving: true,
        currentPath: JSON.stringify(path)
      }
    });

    // 记录活动移动
    this.activeMovements.set(characterId, {
      characterId,
      path,
      currentIndex: 0,
      startTime: new Date(),
      reason
    });

    return {
      success: true,
      message: '开始移动',
      path,
      estimatedTime
    };
  }

  /**
   * 更新所有角色的位置
   * 每帧调用此方法来更新角色位置
   * 
   * @param deltaMs 距离上一帧的毫秒数
   */
  async updatePositions(deltaMs: number): Promise<void> {
    for (const [characterId, movement] of this.activeMovements) {
      await this.updateCharacterPosition(characterId, movement, deltaMs);
    }
  }

  /**
   * 更新单个角色的位置
   */
  private async updateCharacterPosition(
    characterId: number,
    movement: ActiveMovement,
    deltaMs: number
  ): Promise<void> {
    const position = await this.prisma.characterPosition.findUnique({
      where: { characterId }
    });

    if (!position || !position.isMoving) {
      this.activeMovements.delete(characterId);
      return;
    }

    const { path, currentIndex } = movement;

    // 检查是否已完成路径
    if (currentIndex >= path.length - 1) {
      await this.completeMovement(characterId);
      return;
    }

    const currentPos: GridPosition = { x: position.gridX, y: position.gridY };
    const targetPoint = path[currentIndex + 1];

    // 计算移动距离
    const moveDistance = (position.moveSpeed * deltaMs) / 1000;
    const distanceToTarget = euclideanDistance(currentPos, targetPoint);

    if (distanceToTarget <= moveDistance) {
      // 到达下一个路径点
      await this.prisma.characterPosition.update({
        where: { characterId },
        data: {
          gridX: targetPoint.x,
          gridY: targetPoint.y,
          direction: this.calculateDirection(currentPos, targetPoint)
        }
      });

      movement.currentIndex++;

      // 检查是否到达终点
      if (movement.currentIndex >= path.length - 1) {
        await this.completeMovement(characterId);
      }
    } else {
      // 继续向目标点移动
      const ratio = moveDistance / distanceToTarget;
      const newX = currentPos.x + (targetPoint.x - currentPos.x) * ratio;
      const newY = currentPos.y + (targetPoint.y - currentPos.y) * ratio;

      await this.prisma.characterPosition.update({
        where: { characterId },
        data: {
          gridX: newX,
          gridY: newY,
          direction: this.calculateDirection(currentPos, targetPoint)
        }
      });
    }
  }

  /**
   * 完成移动
   */
  private async completeMovement(characterId: number): Promise<void> {
    const movement = this.activeMovements.get(characterId);
    this.activeMovements.delete(characterId);

    // 更新角色位置状态
    await this.prisma.characterPosition.update({
      where: { characterId },
      data: {
        isMoving: false,
        targetX: null,
        targetY: null,
        currentPath: '[]'
      }
    });

    // 更新移动记录状态
    if (movement) {
      await this.prisma.movement.updateMany({
        where: {
          characterId,
          status: 'moving'
        },
        data: {
          status: 'arrived',
          endTime: new Date()
        }
      });
    }

    console.log(`[Movement] 角色 ${characterId} 移动完成`);
  }

  /**
   * 计算移动方向
   */
  private calculateDirection(from: GridPosition, to: GridPosition): string {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    } else {
      return dy > 0 ? 'down' : 'up';
    }
  }

  /**
   * 检查角色是否正在移动
   */
  isMoving(characterId: number): boolean {
    return this.activeMovements.has(characterId);
  }

  /**
   * 等待角色到达目标
   * 
   * @param characterId 角色ID
   * @param timeoutMs 超时时间（毫秒）
   * @returns 是否成功到达
   */
  async waitForArrival(characterId: number, timeoutMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();

    while (this.isMoving(characterId)) {
      if (Date.now() - startTime > timeoutMs) {
        await this.interruptMovement(characterId);
        return false;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return true;
  }

  /**
   * 中断移动
   */
  async interruptMovement(characterId: number): Promise<void> {
    const movement = this.activeMovements.get(characterId);
    this.activeMovements.delete(characterId);

    // 更新角色位置状态
    await this.prisma.characterPosition.update({
      where: { characterId },
      data: {
        isMoving: false,
        targetX: null,
        targetY: null,
        currentPath: '[]'
      }
    });

    // 更新移动记录状态
    if (movement) {
      await this.prisma.movement.updateMany({
        where: {
          characterId,
          status: 'moving'
        },
        data: {
          status: 'interrupted',
          endTime: new Date()
        }
      });
    }

    console.log(`[Movement] 角色 ${characterId} 移动被中断`);
  }

  /**
   * 获取角色当前位置
   */
  async getPosition(characterId: number): Promise<GridPosition | null> {
    const position = await this.prisma.characterPosition.findUnique({
      where: { characterId }
    });

    if (!position) {
      return null;
    }

    return {
      x: position.gridX,
      y: position.gridY
    };
  }

  /**
   * 获取角色的移动进度
   */
  async getMovementProgress(characterId: number): Promise<{
    isMoving: boolean;
    progress: number;
    remainingPath: GridPosition[];
  }> {
    const movement = this.activeMovements.get(characterId);

    if (!movement) {
      return {
        isMoving: false,
        progress: 1,
        remainingPath: []
      };
    }

    const progress = movement.currentIndex / (movement.path.length - 1);
    const remainingPath = movement.path.slice(movement.currentIndex);

    return {
      isMoving: true,
      progress,
      remainingPath
    };
  }

  /**
   * 获取或缓存可行走地图
   */
  private async getWalkableMap(townMapId: number, walkableMapJson: string): Promise<number[][]> {
    if (this.walkableMapCache.has(townMapId)) {
      return this.walkableMapCache.get(townMapId)!;
    }

    const walkableMap = JSON.parse(walkableMapJson);
    this.walkableMapCache.set(townMapId, walkableMap);

    return walkableMap;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.walkableMapCache.clear();
  }

  /**
   * 移动多个角色到指定位置
   * 用于情节执行时移动多个角色
   */
  async moveCharactersToPositions(
    movements: Array<{
      characterId: number;
      targetPos: GridPosition;
    }>,
    reason?: string
  ): Promise<void> {
    const promises = movements.map(({ characterId, targetPos }) =>
      this.startMovement(characterId, targetPos, reason)
    );

    await Promise.all(promises);

    // 等待所有角色到达
    const waitPromises = movements.map(({ characterId }) =>
      this.waitForArrival(characterId, 60000)
    );

    await Promise.all(waitPromises);
  }

  /**
   * 立即设置角色位置（不进行移动动画）
   */
  async setPositionImmediately(
    characterId: number,
    pos: GridPosition
  ): Promise<void> {
    // 中断任何正在进行的移动
    await this.interruptMovement(characterId);

    // 更新位置
    await this.prisma.characterPosition.update({
      where: { characterId },
      data: {
        gridX: pos.x,
        gridY: pos.y,
        isMoving: false,
        targetX: null,
        targetY: null,
        currentPath: '[]'
      }
    });
  }
}

// 导出单例（可选）
let movementManagerInstance: MovementManager | null = null;

export function getMovementManager(prisma: PrismaClient): MovementManager {
  if (!movementManagerInstance) {
    movementManagerInstance = new MovementManager(prisma);
  }
  return movementManagerInstance;
}
