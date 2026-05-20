/**
 * 场景布局生成器
 * 根据 LLM 生成的场景布局描述，生成像素地图数据
 * 
 * 核心功能：
 * - 解析场景布局描述
 * - 生成对应的像素格子
 * - 放置建筑物、装饰物
 * - 生成可行走区域
 */

import { Tile } from '../components/PixelTownMap';

/**
 * 场景布局接口（LLM 输出格式）
 */
export interface SceneLayout {
  groundType: 'grass' | 'ground' | 'path' | 'water';
  buildings: Array<{
    type: 'house' | 'shop' | 'tree' | 'fountain' | 'bench' | 'well' | 'bridge' | 'fence';
    name: string;
    relativePosition: 'center' | 'corner' | 'edge' | 'left' | 'right' | 'top' | 'bottom';
  }>;
  features: string[];  // garden, pond, bridge, fence 等
  atmosphere: string;  // 温馨、神秘、热闹、安静
  keyElements: string[];  // 关键元素
}

/**
 * 建筑物模板
 */
const BUILDING_TEMPLATES: Record<string, {
  width: number;
  height: number;
  tiles: { type: Tile['type']; variant: number }[][];
}> = {
  house: {
    width: 4,
    height: 3,
    tiles: [
      [{ type: 'wall', variant: 0 }, { type: 'wall', variant: 1 }, { type: 'wall', variant: 0 }, { type: 'wall', variant: 1 }],
      [{ type: 'building', variant: 0 }, { type: 'building', variant: 1 }, { type: 'building', variant: 0 }, { type: 'building', variant: 1 }],
      [{ type: 'building', variant: 1 }, { type: 'ground', variant: 0 }, { type: 'ground', variant: 0 }, { type: 'building', variant: 1 }]
    ]
  },
  shop: {
    width: 5,
    height: 3,
    tiles: [
      [{ type: 'wall', variant: 0 }, { type: 'wall', variant: 1 }, { type: 'wall', variant: 0 }, { type: 'wall', variant: 1 }, { type: 'wall', variant: 0 }],
      [{ type: 'building', variant: 1 }, { type: 'building', variant: 0 }, { type: 'building', variant: 1 }, { type: 'building', variant: 0 }, { type: 'building', variant: 1 }],
      [{ type: 'ground', variant: 0 }, { type: 'ground', variant: 0 }, { type: 'ground', variant: 0 }, { type: 'ground', variant: 0 }, { type: 'ground', variant: 0 }]
    ]
  },
  tree: {
    width: 2,
    height: 2,
    tiles: [
      [{ type: 'grass', variant: 2 }, { type: 'grass', variant: 1 }],
      [{ type: 'grass', variant: 1 }, { type: 'grass', variant: 2 }]
    ]
  },
  fountain: {
    width: 3,
    height: 3,
    tiles: [
      [{ type: 'ground', variant: 0 }, { type: 'ground', variant: 1 }, { type: 'ground', variant: 0 }],
      [{ type: 'ground', variant: 1 }, { type: 'water', variant: 0 }, { type: 'ground', variant: 1 }],
      [{ type: 'ground', variant: 0 }, { type: 'ground', variant: 1 }, { type: 'ground', variant: 0 }]
    ]
  },
  bench: {
    width: 2,
    height: 1,
    tiles: [
      [{ type: 'ground', variant: 0 }, { type: 'ground', variant: 1 }]
    ]
  },
  well: {
    width: 2,
    height: 2,
    tiles: [
      [{ type: 'ground', variant: 0 }, { type: 'water', variant: 1 }],
      [{ type: 'ground', variant: 1 }, { type: 'ground', variant: 0 }]
    ]
  },
  bridge: {
    width: 4,
    height: 2,
    tiles: [
      [{ type: 'path', variant: 0 }, { type: 'path', variant: 1 }, { type: 'path', variant: 0 }, { type: 'path', variant: 1 }],
      [{ type: 'path', variant: 1 }, { type: 'path', variant: 0 }, { type: 'path', variant: 1 }, { type: 'path', variant: 0 }]
    ]
  },
  fence: {
    width: 3,
    height: 1,
    tiles: [
      [{ type: 'wall', variant: 0 }, { type: 'wall', variant: 1 }, { type: 'wall', variant: 0 }]
    ]
  }
};

/**
 * 地面类型颜色映射
 */
const GROUND_TYPE_MAP: Record<string, Tile['type']> = {
  grass: 'grass',
  ground: 'ground',
  path: 'path',
  water: 'water'
};

/**
 * 根据场景布局生成区域内的像素格子
 * 
 * @param layout 场景布局
 * @param regionWidth 区域宽度（格子数）
 * @param regionHeight 区域高度（格子数）
 * @returns 像素格子二维数组
 */
export function generateRegionTiles(
  layout: SceneLayout | null,
  regionWidth: number = 10,
  regionHeight: number = 8
): Tile[][] {
  // 初始化格子数组
  const tiles: Tile[][] = [];
  
  // 确定地面类型
  const groundType = layout?.groundType || 'grass';
  const tileType = GROUND_TYPE_MAP[groundType] || 'grass';

  // 填充基础地面
  for (let y = 0; y < regionHeight; y++) {
    tiles[y] = [];
    for (let x = 0; x < regionWidth; x++) {
      // 边界为墙
      if (x === 0 || x === regionWidth - 1 || y === 0 || y === regionHeight - 1) {
        tiles[y][x] = { type: 'wall', variant: 0 };
      } else {
        tiles[y][x] = { type: tileType, variant: Math.floor(Math.random() * 3) };
      }
    }
  }

  // 如果没有布局信息，返回基础地图
  if (!layout) {
    return tiles;
  }

  // 放置建筑物
  const buildings = layout.buildings || [];
  for (const building of buildings) {
    const template = BUILDING_TEMPLATES[building.type];
    if (!template) continue;

    // 计算建筑物位置
    const pos = calculateBuildingPosition(
      building.relativePosition,
      regionWidth,
      regionHeight,
      template.width,
      template.height
    );

    // 放置建筑物
    placeBuilding(tiles, template, pos.x, pos.y, regionWidth, regionHeight);
  }

  // 添加特殊特征
  const features = layout.features || [];
  for (const feature of features) {
    addFeature(tiles, feature, regionWidth, regionHeight);
  }

  return tiles;
}

/**
 * 计算建筑物位置
 */
function calculateBuildingPosition(
  relativePosition: string,
  regionWidth: number,
  regionHeight: number,
  buildingWidth: number,
  buildingHeight: number
): { x: number; y: number } {
  const margin = 1;  // 边距

  switch (relativePosition) {
    case 'center':
      return {
        x: Math.floor((regionWidth - buildingWidth) / 2),
        y: Math.floor((regionHeight - buildingHeight) / 2)
      };
    case 'corner':
      // 随机选择一个角落
      const corners = [
        { x: margin, y: margin },
        { x: regionWidth - buildingWidth - margin, y: margin },
        { x: margin, y: regionHeight - buildingHeight - margin },
        { x: regionWidth - buildingWidth - margin, y: regionHeight - buildingHeight - margin }
      ];
      return corners[Math.floor(Math.random() * corners.length)];
    case 'left':
      return {
        x: margin,
        y: Math.floor((regionHeight - buildingHeight) / 2)
      };
    case 'right':
      return {
        x: regionWidth - buildingWidth - margin,
        y: Math.floor((regionHeight - buildingHeight) / 2)
      };
    case 'top':
      return {
        x: Math.floor((regionWidth - buildingWidth) / 2),
        y: margin
      };
    case 'bottom':
      return {
        x: Math.floor((regionWidth - buildingWidth) / 2),
        y: regionHeight - buildingHeight - margin
      };
    case 'edge':
    default:
      // 随机选择一条边
      const edges = ['top', 'bottom', 'left', 'right'];
      return calculateBuildingPosition(
        edges[Math.floor(Math.random() * edges.length)],
        regionWidth,
        regionHeight,
        buildingWidth,
        buildingHeight
      );
  }
}

/**
 * 放置建筑物
 */
function placeBuilding(
  tiles: Tile[][],
  template: typeof BUILDING_TEMPLATES.house,
  startX: number,
  startY: number,
  regionWidth: number,
  regionHeight: number
): void {
  for (let y = 0; y < template.height; y++) {
    for (let x = 0; x < template.width; x++) {
      const tileX = startX + x;
      const tileY = startY + y;

      // 检查边界
      if (tileX >= 0 && tileX < regionWidth && tileY >= 0 && tileY < regionHeight) {
        tiles[tileY][tileX] = template.tiles[y][x];
      }
    }
  }
}

/**
 * 添加特殊特征
 */
function addFeature(
  tiles: Tile[][],
  feature: string,
  regionWidth: number,
  regionHeight: number
): void {
  switch (feature.toLowerCase()) {
    case 'garden':
      // 在角落添加花园
      for (let y = 1; y < 3; y++) {
        for (let x = 1; x < 3; x++) {
          if (tiles[y] && tiles[y][x]) {
            tiles[y][x] = { type: 'grass', variant: Math.floor(Math.random() * 3) };
          }
        }
      }
      break;
    case 'pond':
      // 添加小池塘
      const pondX = Math.floor(regionWidth / 2);
      const pondY = Math.floor(regionHeight / 2);
      for (let y = pondY - 1; y <= pondY + 1; y++) {
        for (let x = pondX - 1; x <= pondX + 1; x++) {
          if (x > 0 && x < regionWidth - 1 && y > 0 && y < regionHeight - 1) {
            tiles[y][x] = { type: 'water', variant: Math.floor(Math.random() * 3) };
          }
        }
      }
      break;
    case 'path':
      // 添加小路
      for (let x = 1; x < regionWidth - 1; x++) {
        const midY = Math.floor(regionHeight / 2);
        tiles[midY][x] = { type: 'path', variant: Math.floor(Math.random() * 3) };
      }
      break;
  }
}

/**
 * 生成可行走地图
 * 
 * @param tiles 像素格子
 * @returns 可行走地图 (1=可行走, 0=障碍)
 */
export function generateWalkableMap(tiles: Tile[][]): number[][] {
  const walkable: number[][] = [];
  
  for (let y = 0; y < tiles.length; y++) {
    walkable[y] = [];
    for (let x = 0; x < tiles[y].length; x++) {
      const tile = tiles[y][x];
      // 墙壁和水域不可行走
      walkable[y][x] = (tile.type === 'wall' || tile.type === 'water') ? 0 : 1;
    }
  }

  return walkable;
}

/**
 * 解析场景布局 JSON
 */
export function parseSceneLayout(layoutJson: string | null): SceneLayout | null {
  if (!layoutJson) return null;

  try {
    return JSON.parse(layoutJson);
  } catch {
    console.warn('[SceneLayout] 无法解析布局 JSON:', layoutJson);
    return null;
  }
}

/**
 * 为整个小说生成统一地图
 * 
 * @param scenes 场景列表（包含布局信息）
 * @returns 完整的地图数据
 */
export function generateTownMapFromScenes(
  scenes: Array<{
    id: number;
    name: string;
    type: string;
    layout: string | null;
  }>
): {
  width: number;
  height: number;
  tiles: Tile[][];
  walkableMap: number[][];
  regions: Array<{
    sceneId: number;
    name: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  }>;
} {
  const regionWidth = 10;
  const regionHeight = 8;
  const gap = 2;  // 区域间隔

  const cols = Math.ceil(Math.sqrt(scenes.length));
  const rows = Math.ceil(scenes.length / cols);

  const mapWidth = cols * (regionWidth + gap) + gap;
  const mapHeight = rows * (regionHeight + gap) + gap;

  // 初始化地图
  const tiles: Tile[][] = [];
  const walkableMap: number[][] = [];
  const regions: Array<{
    sceneId: number;
    name: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  }> = [];

  // 填充基础地图
  for (let y = 0; y < mapHeight; y++) {
    tiles[y] = [];
    walkableMap[y] = [];
    for (let x = 0; x < mapWidth; x++) {
      tiles[y][x] = { type: 'grass', variant: Math.floor(Math.random() * 3) };
      walkableMap[y][x] = 1;
    }
  }

  // 为每个场景生成区域
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const col = i % cols;
    const row = Math.floor(i / cols);

    const startX = col * (regionWidth + gap) + gap;
    const startY = row * (regionHeight + gap) + gap;

    // 解析布局
    const layout = parseSceneLayout(scene.layout);

    // 生成区域格子
    const regionTiles = generateRegionTiles(layout, regionWidth, regionHeight);

    // 放置到地图上
    for (let y = 0; y < regionHeight; y++) {
      for (let x = 0; x < regionWidth; x++) {
        const mapX = startX + x;
        const mapY = startY + y;
        if (mapY < mapHeight && mapX < mapWidth) {
          tiles[mapY][mapX] = regionTiles[y][x];
          walkableMap[mapY][mapX] = regionTiles[y][x].type === 'wall' ? 0 : 1;
        }
      }
    }

    // 记录区域信息
    regions.push({
      sceneId: scene.id,
      name: scene.name,
      startX,
      startY,
      endX: startX + regionWidth - 1,
      endY: startY + regionHeight - 1
    });
  }

  return {
    width: mapWidth,
    height: mapHeight,
    tiles,
    walkableMap,
    regions
  };
}
