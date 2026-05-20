/**
 * 数据迁移脚本
 * 将现有 Scene 数据转换为 TownMap 和 MapRegion
 * 
 * 使用方法：
 * npx ts-node scripts/migrateToTownMap.ts <novelId>
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Tile {
  type: 'ground' | 'wall' | 'water' | 'grass' | 'path' | 'building';
  variant: number;
}

/**
 * 迁移小说的场景数据到新的地图系统
 */
export async function migrateNovelToTownMap(novelId: number) {
  console.log(`[迁移] 开始迁移小说 ${novelId} 的场景数据...`);

  // 检查是否已经有 TownMap
  const existingMap = await prisma.townMap.findUnique({
    where: { novelId }
  });

  if (existingMap) {
    console.log(`[迁移] 小说 ${novelId} 已有地图数据，跳过迁移`);
    return existingMap;
  }

  // 1. 获取现有场景
  const scenes = await prisma.scene.findMany({
    where: { novelId, isActive: true },
    orderBy: { id: 'asc' }
  });

  if (scenes.length === 0) {
    console.log(`[迁移] 小说 ${novelId} 没有场景需要迁移`);
    return null;
  }

  console.log(`[迁移] 找到 ${scenes.length} 个场景`);

  // 2. 计算统一地图尺寸
  // 每个场景占用 10x8 格子
  const regionWidth = 10;
  const regionHeight = 8;
  const cols = Math.ceil(Math.sqrt(scenes.length));
  const rows = Math.ceil(scenes.length / cols);

  const mapWidth = cols * regionWidth + 4;  // 额外边距
  const mapHeight = rows * regionHeight + 4;

  console.log(`[迁移] 地图尺寸: ${mapWidth}x${mapHeight} 格子`);

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

  console.log(`[迁移] 创建地图 ID: ${townMap.id}`);

  // 5. 为每个 Scene 创建 MapRegion
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const col = i % cols;
    const row = Math.floor(i / cols);

    const startX = col * regionWidth + 2;
    const startY = row * regionHeight + 2;

    await prisma.mapRegion.create({
      data: {
        townMapId: townMap.id,
        name: scene.name,
        sceneId: scene.id,
        startX,
        startY,
        endX: startX + regionWidth - 1,
        endY: startY + regionHeight - 1,
        type: scene.type || 'public'
      }
    });

    // 在地图上标记区域为建筑类型
    for (let y = startY; y < startY + regionHeight; y++) {
      for (let x = startX; x < startX + regionWidth; x++) {
        if (tiles[y] && tiles[y][x]) {
          // 边界为墙，内部为地面
          if (x === startX || x === startX + regionWidth - 1 ||
              y === startY || y === startY + regionHeight - 1) {
            tiles[y][x] = { type: 'wall', variant: 0 };
          } else {
            tiles[y][x] = { type: 'ground', variant: Math.floor(Math.random() * 3) };
          }
        }
      }
    }

    console.log(`[迁移] 创建区域: ${scene.name} (${startX},${startY})-(${startX + regionWidth - 1},${startY + regionHeight - 1})`);
  }

  // 更新地图数据（包含区域标记）
  await prisma.townMap.update({
    where: { id: townMap.id },
    data: { tiles: JSON.stringify(tiles) }
  });

  // 6. 为每个角色创建位置
  const characters = await prisma.character.findMany({
    where: { novelId }
  });

  console.log(`[迁移] 找到 ${characters.length} 个角色`);

  for (const char of characters) {
    // 检查是否已有位置
    const existingPos = await prisma.characterPosition.findUnique({
      where: { characterId: char.id }
    });

    if (existingPos) {
      console.log(`[迁移] 角色 ${char.name} 已有位置，跳过`);
      continue;
    }

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
        gridX: startX + Math.random() * (regionWidth - 2),
        gridY: startY + Math.random() * (regionHeight - 2),
        currentRegionId: region?.id
      }
    });

    console.log(`[迁移] 创建角色位置: ${char.name}`);
  }

  console.log(`[迁移] 迁移完成: ${scenes.length} 个场景, ${characters.length} 个角色`);
  return townMap;
}

/**
 * 生成默认地图格子
 */
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

/**
 * 生成默认可行走地图
 */
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

/**
 * 迁移所有小说
 */
export async function migrateAllNovels() {
  const novels = await prisma.novel.findMany({
    select: { id: true, title: true }
  });

  console.log(`[迁移] 找到 ${novels.length} 部小说`);

  for (const novel of novels) {
    console.log(`\n[迁移] 处理小说: ${novel.title} (ID: ${novel.id})`);
    await migrateNovelToTownMap(novel.id);
  }

  console.log('\n[迁移] 所有小说迁移完成');
}

// 命令行执行
const args = process.argv.slice(2);

if (args.length > 0) {
  const novelId = parseInt(args[0]);
  if (isNaN(novelId)) {
    console.error('用法: npx ts-node scripts/migrateToTownMap.ts <novelId>');
    console.error('或者: npx ts-node scripts/migrateToTownMap.ts --all');
    process.exit(1);
  }
  migrateNovelToTownMap(novelId)
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      prisma.$disconnect();
      process.exit(1);
    });
} else if (args.includes('--all')) {
  migrateAllNovels()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      prisma.$disconnect();
      process.exit(1);
    });
} else {
  console.log('用法:');
  console.log('  npx ts-node scripts/migrateToTownMap.ts <novelId>  # 迁移指定小说');
  console.log('  npx ts-node scripts/migrateToTownMap.ts --all     # 迁移所有小说');
}
