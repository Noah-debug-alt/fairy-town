# 小镇系统重构技术方案

> 本文档基于现有功能设计渐进式改进方案，确保向后兼容，不破坏现有功能。

## 一、项目背景与目标

### 1.1 当前状态

Fairy Town 是一个 AI 驱动的小说可视化系统，已实现以下核心功能：

| 模块 | 功能 | 完成度 |
|------|------|--------|
| 小说解析 | LLM 解析小说，提取角色、情节、场景 | ✅ 完成 |
| 记忆系统 | 记忆流、检索、反思、压缩 | ✅ 完成 |
| 小镇模拟 | 情节执行、角色状态管理 | ⚠️ 50% |
| 地图组件 | Canvas 绘制、场景显示、对话气泡 | ⚠️ 60% |
| 预言系统 | 预言生成、采纳、转换 | ✅ 完成 |
| 图片生成 | GPU 生图、多后端支持 | ✅ 完成 |

### 1.2 目标

将小镇系统改造为类似**斯坦福小镇（Smallville）**的风格：
- **像素网格风格地图**
- **角色完全自由移动**
- **情节驱动 + 简单互动**

### 1.3 设计原则

1. **向后兼容**：新功能作为扩展，不修改现有核心逻辑
2. **渐进实现**：每个阶段独立可测试
3. **数据迁移**：提供迁移方案，不影响现有数据
4. **可选切换**：用户可选择使用新地图或旧地图

---

## 二、现有系统分析

### 2.1 数据模型（prisma/schema.prisma）

#### Scene 模型
```prisma
model Scene {
  id          Int      @id @default(autoincrement())
  novelId     Int
  name        String
  description String?
  type        String
  positionX   Int      @default(0)      // 已有：场景 X 位置
  positionY   Int      @default(0)      // 已有：场景 Y 位置
  characters  String   @default("[]")
  isActive    Boolean  @default(true)
  imageUrl    String?
  imagePrompt String?
  mapStyle    String   @default("building")
  // ...
}
```

#### Character 模型
```prisma
model Character {
  id            Int      @id @default(autoincrement())
  novelId       Int
  name          String
  currentScene  String   @default("小镇广场")  // 已有：当前场景名
  // ...
}
```

#### TownEvent 模型
```prisma
model TownEvent {
  id            Int      @id @default(autoincrement())
  novelId       Int
  sceneId       Int?
  characterId   Int?
  type          String
  content       String
  timestamp     DateTime @default(now())
  // ...
}
```

### 2.2 小镇模拟器（utils/agent/town.ts）

```typescript
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
  // ...
}
```

**现有功能**：
- ✅ 情节按顺序执行
- ✅ 对话解析和记忆更新
- ✅ 角色状态管理（idle, moving, talking, observing）
- ✅ 模拟进度保存和恢复
- ❌ 角色真实移动（只有状态，没有位置）
- ❌ 路径规划
- ❌ 角色间互动

### 2.3 地图组件（components/TownMap.tsx）

**现有功能**：
- ✅ Canvas 绘制场景建筑
- ✅ 角色显示在场景中
- ✅ 对话气泡
- ✅ 缩放和拖拽
- ❌ 角色移动动画
- ❌ 网格系统
- ❌ 角色精确位置

---

## 三、与斯坦福小镇对比

### 3.1 斯坦福小镇核心架构

| 组件 | 功能 | 当前项目 |
|------|------|----------|
| **记忆流 (Memory Stream)** | 存储所有经历，按相关性检索 | ✅ 已实现 |
| **反思机制 (Reflection)** | 提取高层次洞察 | ✅ 已实现 |
| **规划系统 (Planning)** | 长期+短期计划 | ❌ 未实现 |
| **环境交互** | 真实沙盒世界 | ⚠️ 部分实现 |
| **移动系统** | 角色移动轨迹 | ❌ 未实现 |
| **社交互动** | 自主对话、信息传播 | ⚠️ 预设对话 |

### 3.2 差距分析

```
斯坦福小镇流程：
观察 → 记忆流 → 检索 → 反思 → 规划 → 行动

当前项目流程：
情节 → 执行对话 → 更新记忆 → 显示在地图
```

**主要差距**：
1. 角色没有真实位置，只是"在某个场景中"
2. 没有路径规划，角色无法移动
3. 情节执行是线性的，没有角色自主决策
4. 地图是静态背景，不是可交互的沙盒

---

## 四、改进方案设计

### 4.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层                                │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ PixelTownMap    │  │ TownMap (旧)    │  ← 可选切换       │
│  │ (新像素地图)     │  │ (卡通建筑地图)   │                  │
│  └────────┬────────┘  └────────┬────────┘                  │
│           │                    │                            │
│           └──────────┬─────────┘                            │
│                      ▼                                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              TownSimulator (小镇模拟器)                 │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │  │
│  │  │ Movement    │ │ Interaction │ │ PlotExecutor│      │  │
│  │  │ Manager     │ │ System      │ │ (现有)      │      │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        数据层                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ TownMap     │ │ Character   │ │ Scene       │           │
│  │ (新)        │ │ Position(新)│ │ (现有)      │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 阶段划分

| 阶段 | 内容 | 影响范围 | 风险 |
|------|------|----------|------|
| **阶段一** | 新增数据模型 | 新增表，不影响现有 | 低 |
| **阶段二** | 路径规划系统 | 新增模块 | 低 |
| **阶段三** | 移动管理系统 | 新增模块 | 低 |
| **阶段四** | 像素地图组件 | 新增组件 | 低 |
| **阶段五** | 简单互动系统 | 新增模块 | 低 |
| **阶段六** | 集成与测试 | 修改现有代码 | 中 |

---

## 五、详细设计

### 5.1 阶段一：数据模型扩展

#### 5.1.1 新增 TownMap 模型

```prisma
// 新增：统一大地图模型
model TownMap {
  id            Int      @id @default(autoincrement())
  novelId       Int      @unique
  
  // 地图基本信息
  name          String   @default("小镇")
  
  // 地图尺寸（格子数）
  width         Int      @default(40)
  height        Int      @default(30)
  
  // 每格像素大小
  tileSize      Int      @default(32)
  
  // 地图数据（JSON）
  // tiles[y][x] = { type: "ground"|"wall"|"water"|"grass"|"path"|"building", variant: 0-2 }
  tiles         String   @default("[]")
  
  // 可行走区域（JSON）
  // walkableMap[y][x] = 1 (可行走) | 0 (障碍)
  walkableMap   String   @default("[]")
  
  // 背景图（可选）
  backgroundUrl String?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  novel         Novel    @relation(fields: [novelId], references: [id])
  regions       MapRegion[]
  
  @@index([novelId])
}
```

#### 5.1.2 新增 MapRegion 模型

```prisma
// 新增：地图区域（对应现有 Scene 的位置概念）
model MapRegion {
  id            Int      @id @default(autoincrement())
  townMapId     Int
  
  // 区域名称（对应 Scene.name）
  name          String
  
  // 关联的场景 ID（可选，用于兼容现有数据）
  sceneId       Int?
  
  // 区域范围（格子坐标）
  startX        Int
  startY        Int
  endX          Int
  endY          Int
  
  // 区域类型（对应 Scene.type）
  type          String   @default("public")
  
  // 区域内可行走区域（可选覆盖）
  localWalkable String?  // JSON
  
  createdAt     DateTime @default(now())
  
  townMap       TownMap  @relation(fields: [townMapId], references: [id])
  
  @@index([townMapId])
  @@index([sceneId])
}
```

#### 5.1.3 新增 CharacterPosition 模型

```prisma
// 新增：角色精确位置（扩展现有 Character，不修改原模型）
model CharacterPosition {
  id            Int      @id @default(autoincrement())
  characterId   Int      @unique
  
  // 精确位置（格子坐标，支持小数用于平滑移动）
  gridX         Float    @default(0)
  gridY         Float    @default(0)
  
  // 移动目标
  targetX       Float?
  targetY       Float?
  
  // 移动状态
  isMoving      Boolean  @default(false)
  moveSpeed     Float    @default(1.0)    // 格子/秒
  
  // 朝向
  direction     String   @default("down") // up|down|left|right
  
  // 当前所在区域
  currentRegionId Int?
  
  // 移动路径（JSON）
  currentPath   String   @default("[]")   // [{x, y}, ...]
  
  updatedAt     DateTime @updatedAt
  
  character     Character @relation(fields: [characterId], references: [id])
  
  @@index([characterId])
}
```

#### 5.1.4 新增 Movement 模型

```prisma
// 新增：移动记录
model Movement {
  id            Int      @id @default(autoincrement())
  characterId   Int
  novelId       Int
  
  // 起点
  fromX         Float
  fromY         Float
  fromRegionId  Int?
  
  // 终点
  toX           Float
  toY           Float
  toRegionId    Int?
  
  // 路径
  path          String   @default("[]")   // JSON: [{x, y}, ...]
  
  // 时间
  startTime     DateTime @default(now())
  endTime       DateTime?
  
  // 状态
  status        String   @default("moving") // moving|arrived|interrupted
  
  // 原因（情节触发、自主移动等）
  reason        String?                    // plot:123, interaction, idle
  
  createdAt     DateTime @default(now())
  
  character     Character @relation(fields: [characterId], references: [id])
  novel         Novel     @relation(fields: [novelId], references: [id])
  
  @@index([characterId])
  @@index([novelId])
  @@index([status])
}
```

#### 5.1.5 更新现有模型关联

```prisma
// 修改 Novel 模型，添加关联
model Novel {
  // ... 现有字段 ...
  townMap       TownMap?
  movements     Movement[]
}

// 修改 Character 模型，添加关联
model Character {
  // ... 现有字段 ...
  position      CharacterPosition?
  movements     Movement[]
}
```

### 5.2 阶段二：路径规划系统

#### 5.2.1 新建文件：utils/agent/pathfinding.ts

```typescript
/**
 * 路径规划模块
 * 实现 A* 算法，支持在网格地图上寻找最短路径
 */

export interface GridPosition {
  x: number;
  y: number;
}

export interface PathNode {
  pos: GridPosition;
  g: number;  // 从起点到当前点的成本
  h: number;  // 从当前点到终点的估计成本（启发函数）
  f: number;  // g + h
  parent: PathNode | null;
}

/**
 * A* 路径规划算法
 * @param start 起点
 * @param end 终点
 * @param walkableMap 可行走地图 (1=可行走, 0=障碍)
 * @returns 路径点数组，如果无法到达则返回空数组
 */
export function findPath(
  start: GridPosition,
  end: GridPosition,
  walkableMap: number[][]
): GridPosition[] {
  // 实现细节...
}

/**
 * 检查位置是否可行走
 */
export function isWalkable(
  pos: GridPosition,
  walkableMap: number[][]
): boolean {
  // 实现细节...
}

/**
 * 计算两点间曼哈顿距离
 */
export function manhattanDistance(
  a: GridPosition,
  b: GridPosition
): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * 计算两点间欧几里得距离
 */
export function euclideanDistance(
  a: GridPosition,
  b: GridPosition
): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}
```

### 5.3 阶段三：移动管理系统

#### 5.3.1 新建文件：utils/agent/movement.ts

```typescript
/**
 * 移动管理模块
 * 管理角色的移动状态、路径执行、位置更新
 */

import { PrismaClient } from '@prisma/client';
import { findPath, GridPosition, isWalkable } from './pathfinding';

export class MovementManager {
  private prisma: PrismaClient;
  
  // 活动中的移动
  private activeMovements: Map<number, {
    path: GridPosition[];
    currentIndex: number;
    startTime: Date;
    reason?: string;
  }>;
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.activeMovements = new Map();
  }
  
  /**
   * 开始移动角色到目标位置
   * @returns 是否成功开始移动
   */
  async startMovement(
    characterId: number,
    targetPos: GridPosition,
    walkableMap: number[][],
    reason?: string
  ): Promise<boolean> {
    // 实现细节...
  }
  
  /**
   * 更新所有角色的位置（每帧调用）
   * @param deltaMs 距离上一帧的毫秒数
   */
  async updatePositions(deltaMs: number): Promise<void> {
    // 实现细节...
  }
  
  /**
   * 检查角色是否正在移动
   */
  isMoving(characterId: number): boolean {
    return this.activeMovements.has(characterId);
  }
  
  /**
   * 等待角色到达目标
   */
  async waitForArrival(characterId: number, timeoutMs: number = 30000): Promise<boolean> {
    // 实现细节...
  }
  
  /**
   * 中断移动
   */
  async interruptMovement(characterId: number): Promise<void> {
    // 实现细节...
  }
  
  /**
   * 获取角色当前位置
   */
  async getPosition(characterId: number): Promise<GridPosition | null> {
    // 实现细节...
  }
}
```

### 5.4 阶段四：像素地图组件

#### 5.4.1 新建文件：components/PixelTownMap.tsx

```typescript
/**
 * 像素风格地图组件
 * 渲染网格地图、角色、对话气泡
 * 支持角色平滑移动动画
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';

// 格子类型颜色
const TILE_COLORS: Record<string, string[]> = {
  ground: ['#8B7355', '#A0826D', '#9B7B5A'],  // 地面
  grass:  ['#4CAF50', '#66BB6A', '#81C784'],  // 草地
  path:   ['#D7CCC8', '#BCAAA4', '#A1887F'],  // 道路
  water:  ['#2196F3', '#42A5F5', '#64B5F6'],  // 水域
  wall:   ['#5D4037', '#6D4C41', '#795548'],  // 墙壁
  building: ['#FFC107', '#FFCA28', '#FFD54F'] // 建筑
};

interface PixelTownMapProps {
  // 地图配置
  mapWidth: number;      // 格子数
  mapHeight: number;     // 格子数
  tileSize: number;      // 每格像素
  
  // 地图数据
  tiles: Tile[][];
  walkableMap: number[][];
  
  // 区域
  regions: MapRegion[];
  
  // 角色
  characters: CharacterOnMap[];
  
  // 事件（对话气泡）
  events: MapEvent[];
  
  // 回调
  onCharacterClick?: (character: CharacterOnMap) => void;
  onRegionClick?: (region: MapRegion) => void;
  
  // 显示选项
  showGrid?: boolean;
  showWalkable?: boolean;
  showRegionBounds?: boolean;
}

const PixelTownMap: React.FC<PixelTownMapProps> = (props) => {
  // Canvas 绘制逻辑
  // - 绘制格子背景
  // - 绘制区域边界
  // - 绘制角色（支持动画）
  // - 绘制对话气泡
  // - 处理交互事件
};
```

### 5.5 阶段五：简单互动系统

#### 5.5.1 新建文件：utils/agent/interaction.ts

```typescript
/**
 * 简单互动系统
 * 当角色靠近时触发简单互动（打招呼、点头等）
 */

export type InteractionType = 
  | 'greeting'    // 打招呼
  | 'wave'        // 挥手
  | 'nod'         // 点头
  | 'pass_by';    // 擦肩而过

export interface Interaction {
  type: InteractionType;
  character1Id: number;
  character2Id: number;
  content: string;
  timestamp: Date;
}

// 互动触发距离（格子数）
const INTERACTION_DISTANCE = 2;

// 互动冷却时间（毫秒）
const INTERACTION_COOLDOWN = 30000;

/**
 * 检测角色间的互动
 */
export function detectInteractions(
  positions: CharacterPosition[],
  lastInteractionTime: Map<string, Date>
): Interaction[] {
  // 实现细节...
}

/**
 * 生成互动内容
 */
export async function generateInteractionContent(
  type: InteractionType,
  character1: Character,
  character2: Character
): Promise<string> {
  // 基于角色信息生成互动内容
  // 例如："{角色A}向{角色B}点了点头。"
}
```

### 5.6 阶段六：集成到小镇模拟器

#### 5.6.1 修改文件：utils/agent/town.ts

```typescript
import { MovementManager } from './movement';
import { detectInteractions, generateInteractionContent } from './interaction';

export class TownSimulator {
  // 现有属性...
  
  // 新增：移动管理器
  private movementManager: MovementManager | null = null;
  
  // 新增：是否使用新地图系统
  private useNewMapSystem: boolean = false;
  
  // 新增：上次互动时间记录
  private lastInteractionTime: Map<string, Date> = new Map();
  
  /**
   * 初始化（扩展）
   */
  async initialize(novelId: number) {
    // 现有初始化逻辑...
    
    // 检查是否有新的 TownMap 数据
    const townMap = await this.prisma.townMap.findUnique({
      where: { novelId }
    });
    
    if (townMap) {
      this.useNewMapSystem = true;
      this.movementManager = new MovementManager(this.prisma);
      // 初始化角色位置...
    }
  }
  
  /**
   * 执行情节（扩展）
   */
  async executePlot(plot: Plot): Promise<PlotExecutionResult | null> {
    // 如果使用新地图系统，先移动角色到正确位置
    if (this.useNewMapSystem && this.movementManager) {
      await this.moveCharactersForPlot(plot);
    }
    
    // 现有的对话执行逻辑...
  }
  
  /**
   * 新增：移动角色到情节所需位置
   */
  private async moveCharactersForPlot(plot: Plot): Promise<void> {
    // 1. 解析情节涉及的地点
    // 2. 计算每个角色需要移动到的位置
    // 3. 启动移动
    // 4. 等待所有角色到达
  }
  
  /**
   * 新增：更新循环（用于移动动画）
   */
  async update(deltaMs: number): Promise<void> {
    if (this.movementManager) {
      await this.movementManager.updatePositions(deltaMs);
    }
    
    // 检测互动
    if (this.useNewMapSystem) {
      await this.checkInteractions();
    }
  }
  
  /**
   * 新增：检查角色互动
   */
  private async checkInteractions(): Promise<void> {
    // 实现细节...
  }
}
```

---

## 六、数据迁移方案

### 6.1 迁移脚本

新建文件：`scripts/migrateToTownMap.ts`

```typescript
/**
 * 数据迁移脚本
 * 将现有 Scene 数据转换为 TownMap 和 MapRegion
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function migrateNovelToTownMap(novelId: number) {
  // 1. 获取现有场景
  const scenes = await prisma.scene.findMany({ 
    where: { novelId, isActive: true } 
  });
  
  if (scenes.length === 0) {
    console.log('没有场景需要迁移');
    return;
  }
  
  // 2. 计算统一地图尺寸
  // 每个场景占用 10x8 格子
  const regionWidth = 10;
  const regionHeight = 8;
  const cols = Math.ceil(Math.sqrt(scenes.length));
  const rows = Math.ceil(scenes.length / cols);
  
  const mapWidth = cols * regionWidth + 4;  // 额外边距
  const mapHeight = rows * regionHeight + 4;
  
  // 3. 生成地图数据
  const tiles = generateDefaultTiles(mapWidth, mapHeight);
  const walkableMap = generateDefaultWalkable(mapWidth, mapHeight);
  
  // 4. 创建 TownMap
  const townMap = await prisma.townMap.create({
    data: {
      novelId,
      name: '小镇',
      width: mapWidth,
      height: mapHeight,
      tileSize: 32,
      tiles: JSON.stringify(tiles),
      walkableMap: JSON.stringify(walkableMap)
    }
  });
  
  // 5. 为每个 Scene 创建 MapRegion
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    
    await prisma.mapRegion.create({
      data: {
        townMapId: townMap.id,
        name: scene.name,
        sceneId: scene.id,
        startX: col * regionWidth + 2,
        startY: row * regionHeight + 2,
        endX: col * regionWidth + regionWidth + 1,
        endY: row * regionHeight + regionHeight + 1,
        type: scene.type
      }
    });
  }
  
  // 6. 为每个角色创建位置
  const characters = await prisma.character.findMany({ 
    where: { novelId } 
  });
  
  for (const char of characters) {
    // 找到角色当前场景对应的区域
    const region = await prisma.mapRegion.findFirst({
      where: {
        townMapId: townMap.id,
        name: char.currentScene
      }
    });
    
    const startX = region ? region.startX + 1 : 2;
    const startY = region ? region.startY + 1 : 2;
    
    await prisma.characterPosition.create({
      data: {
        characterId: char.id,
        gridX: startX,
        gridY: startY,
        currentRegionId: region?.id
      }
    });
  }
  
  console.log(`迁移完成: ${scenes.length} 个场景, ${characters.length} 个角色`);
}

function generateDefaultTiles(width: number, height: number): Tile[][] {
  const tiles: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      tiles[y][x] = { type: 'grass', variant: Math.floor(Math.random() * 3) };
    }
  }
  return tiles;
}

function generateDefaultWalkable(width: number, height: number): number[][] {
  const walkable: number[][] = [];
  for (let y = 0; y < height; y++) {
    walkable[y] = [];
    for (let x = 0; x < width; x++) {
      walkable[y][x] = 1;  // 默认全部可行走
    }
  }
  return walkable;
}
```

### 6.2 回滚方案

如果新系统出现问题：

1. **数据回滚**：删除 TownMap、MapRegion、CharacterPosition、Movement 表数据
2. **代码回滚**：切换到 `backup-before-town-refactor` 分支
3. **前端切换**：使用旧的 TownMap 组件

```bash
# Git 回滚
git checkout backup-before-town-refactor

# 或重置到备份点
git reset --hard backup-before-town-refactor
```

---

## 七、API 设计

### 7.1 新增 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/town/:novelId/map` | GET | 获取小镇地图数据 |
| `/api/town/:novelId/map` | POST | 创建/更新小镇地图 |
| `/api/town/:novelId/map/migrate` | POST | 迁移现有场景到新地图 |
| `/api/character/:id/position` | GET | 获取角色位置 |
| `/api/character/:id/move` | POST | 移动角色到指定位置 |
| `/api/character/:id/path` | GET | 获取角色当前路径 |

### 7.2 WebSocket 事件

| 事件 | 方向 | 说明 |
|------|------|------|
| `position:update` | 服务端→客户端 | 角色位置更新 |
| `movement:start` | 服务端→客户端 | 角色开始移动 |
| `movement:end` | 服务端→客户端 | 角色到达目标 |
| `interaction` | 服务端→客户端 | 角色互动事件 |

---

## 八、前端集成

### 8.1 页面修改

修改 `pages/town/[novelId].tsx`，添加地图切换功能：

```typescript
// 新增：地图类型切换
const [mapType, setMapType] = useState<'pixel' | 'classic'>('pixel');

// 根据类型渲染不同地图组件
{mapType === 'pixel' ? (
  <PixelTownMap {...pixelMapProps} />
) : (
  <TownMap {...classicMapProps} />
)}
```

### 8.2 样式调整

```css
/* 像素风格渲染 */
.pixel-map-canvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
```

---

## 九、测试计划

### 9.1 单元测试

| 模块 | 测试内容 |
|------|----------|
| pathfinding.ts | A* 算法正确性、边界条件 |
| movement.ts | 移动状态管理、位置更新 |
| interaction.ts | 互动检测、内容生成 |

### 9.2 集成测试

| 场景 | 测试内容 |
|------|----------|
| 数据迁移 | 现有数据正确转换 |
| 角色移动 | 路径规划、动画流畅 |
| 情节执行 | 角色移动到正确位置后执行对话 |
| 互动触发 | 角色靠近时触发互动 |

### 9.3 性能测试

| 指标 | 目标 |
|------|------|
| 地图渲染帧率 | ≥ 30 FPS |
| 移动更新延迟 | ≤ 16ms |
| 路径计算时间 | ≤ 100ms |

---

## 十、风险与应对

| 风险 | 可能性 | 影响 | 应对措施 |
|------|--------|------|----------|
| 数据迁移失败 | 低 | 高 | 提供回滚脚本，保留原数据 |
| 性能问题 | 中 | 中 | 优化渲染，使用 requestAnimationFrame |
| 兼容性问题 | 低 | 中 | 保留旧地图组件，提供切换选项 |
| 移动动画卡顿 | 中 | 低 | 降低更新频率，使用 CSS 动画 |

---

## 十一、实施计划

| 阶段 | 任务 | 预计时间 | 依赖 |
|------|------|----------|------|
| 1 | 数据模型扩展 + 迁移脚本 | 1天 | 无 |
| 2 | 路径规划系统 | 1天 | 阶段1 |
| 3 | 移动管理系统 | 1天 | 阶段2 |
| 4 | 像素地图组件 | 2天 | 阶段1,3 |
| 5 | 简单互动系统 | 0.5天 | 阶段3 |
| 6 | 集成与测试 | 1天 | 阶段1-5 |
| **总计** | | **6.5天** | |

---

## 十二、附录

### A. 相关文件清单

| 文件 | 状态 | 说明 |
|------|------|------|
| `prisma/schema.prisma` | 修改 | 添加新模型 |
| `utils/agent/pathfinding.ts` | 新增 | 路径规划 |
| `utils/agent/movement.ts` | 新增 | 移动管理 |
| `utils/agent/interaction.ts` | 新增 | 互动系统 |
| `utils/agent/town.ts` | 修改 | 集成新功能 |
| `components/PixelTownMap.tsx` | 新增 | 像素地图组件 |
| `pages/town/[novelId].tsx` | 修改 | 添加地图切换 |
| `scripts/migrateToTownMap.ts` | 新增 | 数据迁移 |

### B. 参考资料

1. [Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442) - 斯坦福小镇论文
2. [A* Pathfinding Algorithm](https://www.redblobgames.com/pathfinding/a-star/introduction.html) - A* 算法教程
3. [The Sims Style Rendering](https://www.gamedeveloper.com/programming/the-sims-1-2-rendering-analysis) - 模拟人生渲染分析

---

**文档版本**: 1.0  
**创建日期**: 2026-05-20  
**作者**: AI Assistant  
**状态**: 待审核
