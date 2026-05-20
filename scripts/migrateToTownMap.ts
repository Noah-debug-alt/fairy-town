/**
 * 数据迁移脚本
 * 将现有 Scene 数据转换为 TownMap 和 MapRegion
 * 
 * 使用方法：
 * npx ts-node scripts/migrateToTownMap.ts <novelId>
 */

import { PrismaClient } from '@prisma/client';
import { generateTownMapFromScenes, parseSceneLayout, SceneLayout } from '../utils/agent/sceneLayout';
import { Tile } from '../components/PixelTownMap';

const prisma = new PrismaClient();

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

  // 1. 获取现有场景（包含布局信息）
  const scenes = await prisma.scene.findMany({
    where: { novelId, isActive: true },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      name: true,
      type: true,
      layout: true
    }
  });

  if (scenes.length === 0) {
    console.log(`[迁移] 小说 ${novelId} 没有场景需要迁移`);
    return null;
  }

  console.log(`[迁移] 找到 ${scenes.length} 个场景`);

  // 检查哪些场景有布局信息
  const scenesWithLayout = scenes.filter(s => s.layout);
  console.log(`[迁移] 其中 ${scenesWithLayout.length} 个场景有布局信息`);

  // 2. 使用新的布局生成器生成地图
  const mapData = generateTownMapFromScenes(scenes);

  console.log(`[迁移] 地图尺寸: ${mapData.width}x${mapData.height} 格子`);

  // 3. 创建 TownMap
  const townMap = await prisma.townMap.create({
    data: {
      novelId,
      name: '小镇',
      width: mapData.width,
      height: mapData.height,
      tileSize: 32,
      tiles: JSON.stringify(mapData.tiles),
      walkableMap: JSON.stringify(mapData.walkableMap)
    }
  });

  console.log(`[迁移] 创建地图 ID: ${townMap.id}`);

  // 4. 为每个场景创建 MapRegion
  for (const region of mapData.regions) {
    await prisma.mapRegion.create({
      data: {
        townMapId: townMap.id,
        name: region.name,
        sceneId: region.sceneId,
        startX: region.startX,
        startY: region.startY,
        endX: region.endX,
        endY: region.endY,
        type: scenes.find(s => s.id === region.sceneId)?.type || 'public'
      }
    });

    console.log(`[迁移] 创建区域: ${region.name} (${region.startX},${region.startY})-(${region.endX},${region.endY})`);
  }

  // 5. 为每个角色创建位置
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
        gridX: startX + Math.random() * 8,  // 区域内随机位置
        gridY: startY + Math.random() * 6,
        currentRegionId: region?.id
      }
    });

    console.log(`[迁移] 创建角色位置: ${char.name}`);
  }

  console.log(`[迁移] 迁移完成: ${scenes.length} 个场景, ${characters.length} 个角色`);
  return townMap;
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
