/**
 * 场景像素图片生成模块
 * 为小说场景生成斯坦福小镇风格的像素背景图
 * 
 * 特点：
 * - 像素艺术风格（Stardew Valley 风格）
 * - 俯视角视图
 * - 根据场景类型和布局生成独特图片
 */

import { Scene } from '@prisma/client';
import { generateImage, ImageGenResult, checkDiffusersHealth } from './index';
import { SceneLayout } from '../agent/sceneLayout';

// 场景像素风格 Prompt 模板
const SCENE_PIXEL_PROMPTS: Record<string, string> = {
  residence: `
    pixel art, 32x32 tiles, top-down view, cozy cottage house,
    warm colors, chimney with smoke, small garden with flowers,
    wooden door, windows with curtains, fairy tale style,
    Stardew Valley inspired, detailed pixel work, game asset,
    no text, no UI, clean background
  `.trim().replace(/\s+/g, ' '),
  
  shop: `
    pixel art, 32x32 tiles, top-down view, medieval shop building,
    wooden sign, display windows, awning, crates and barrels outside,
    warm colors, fairy tale style, Stardew Valley inspired,
    detailed pixel work, game asset, no text, no UI
  `.trim().replace(/\s+/g, ' '),
  
  public: `
    pixel art, 32x32 tiles, top-down view, town square,
    stone fountain in center, wooden benches, cobblestone ground,
    lamp posts, flower beds, fairy tale style,
    Stardew Valley inspired, detailed pixel work, game asset, no text
  `.trim().replace(/\s+/g, ' '),
  
  forest: `
    pixel art, 32x32 tiles, top-down view, dense forest,
    tall trees, mushrooms, fallen leaves, dirt path,
    dappled sunlight, fairy tale style,
    Stardew Valley inspired, detailed pixel work, game asset, no text
  `.trim().replace(/\s+/g, ' '),
  
  castle: `
    pixel art, 32x32 tiles, top-down view, medieval castle,
    tall towers, stone walls, flags, moat,
    grand entrance, fairy tale style,
    Stardew Valley inspired, detailed pixel work, game asset, no text
  `.trim().replace(/\s+/g, ' '),
  
  village: `
    pixel art, 32x32 tiles, top-down view, rural village,
    thatched cottages, farm fields, well, dirt roads,
    peaceful atmosphere, fairy tale style,
    Stardew Valley inspired, detailed pixel work, game asset, no text
  `.trim().replace(/\s+/g, ' '),
  
  park: `
    pixel art, 32x32 tiles, top-down view, beautiful park,
    trees, flower beds, walking paths, benches,
    pond with ducks, fairy tale style,
    Stardew Valley inspired, detailed pixel work, game asset, no text
  `.trim().replace(/\s+/g, ' '),
  
  school: `
    pixel art, 32x32 tiles, top-down view, school building,
    playground, flag pole, trees, entrance gate,
    fairy tale style, Stardew Valley inspired,
    detailed pixel work, game asset, no text
  `.trim().replace(/\s+/g, ' '),
  
  hospital: `
    pixel art, 32x32 tiles, top-down view, hospital building,
    white walls, red cross, ambulance parking,
    fairy tale style, Stardew Valley inspired,
    detailed pixel work, game asset, no text
  `.trim().replace(/\s+/g, ' '),
  
  restaurant: `
    pixel art, 32x32 tiles, top-down view, restaurant building,
    outdoor seating, flower boxes, awning, entrance,
    fairy tale style, Stardew Valley inspired,
    detailed pixel work, game asset, no text
  `.trim().replace(/\s+/g, ' '),
  
  bar: `
    pixel art, 32x32 tiles, top-down view, tavern building,
    wooden sign, warm light from windows, barrel outside,
    fairy tale style, Stardew Valley inspired,
    detailed pixel work, game asset, no text
  `.trim().replace(/\s+/g, ' '),
  
  library: `
    pixel art, 32x32 tiles, top-down view, library building,
    large windows, book symbol, entrance steps,
    fairy tale style, Stardew Valley inspired,
    detailed pixel work, game asset, no text
  `.trim().replace(/\s+/g, ' ')
};

// 默认场景 Prompt
const DEFAULT_SCENE_PROMPT = `
  pixel art, 32x32 tiles, top-down view, fairy tale building,
  warm colors, detailed, Stardew Valley inspired,
  game asset, no text, no UI
`.trim().replace(/\s+/g, ' ');

// 像素风格负面 Prompt
const PIXEL_NEGATIVE_PROMPT = `
  realistic, 3d render, high resolution photo, text, watermark,
  blurry, low quality, deformed, ugly, bad anatomy,
  people, humans, faces, portrait, crowd,
  modern, sci-fi, futuristic, dark, horror
`.trim().replace(/\s+/g, ' ');

// 氛围修饰词
const ATMOSPHERE_MODIFIERS: Record<string, string> = {
  '温馨': 'warm and cozy atmosphere, soft lighting',
  '神秘': 'mysterious atmosphere, dim lighting, fog',
  '热闹': 'lively atmosphere, bright colors',
  '安静': 'peaceful and quiet atmosphere, soft colors',
  '恐怖': 'dark and spooky atmosphere, shadows',
  '浪漫': 'romantic atmosphere, soft pink tones',
  '欢快': 'cheerful atmosphere, bright sunny day'
};

// 关键元素映射
const KEY_ELEMENT_PROMPTS: Record<string, string> = {
  '花园': 'beautiful flower garden, colorful flowers',
  '池塘': 'small pond with lily pads',
  '桥': 'wooden bridge over stream',
  '篱笆': 'white picket fence',
  '喷泉': 'ornate stone fountain',
  '雕像': 'stone statue in center',
  '井': 'old stone well',
  '树': 'large oak tree with shade',
  '花': 'flower beds with roses',
  '草': 'green grass patches',
  '路': 'cobblestone path',
  '灯': 'street lamp posts'
};

/**
 * 场景图片尺寸配置
 */
export const SCENE_IMAGE_SIZES = {
  // 标准尺寸：10x8 格子区域
  standard: { width: 320, height: 256 },
  // 高清尺寸：2倍
  hd: { width: 640, height: 512 },
  // 缩略图
  thumbnail: { width: 160, height: 128 }
};

/**
 * 生成场景像素图片
 * 
 * @param scene 场景信息
 * @param layout 场景布局（可选）
 * @param sizeKey 图片尺寸键
 * @returns 生成结果
 */
export async function generateScenePixelImage(
  scene: {
    id: number;
    name: string;
    type: string;
    description?: string | null;
    layout?: string | null;
  },
  sizeKey: 'standard' | 'hd' = 'standard'
): Promise<ImageGenResult> {
  console.log(`[ScenePixelImage] 开始生成场景图片: ${scene.name} (类型: ${scene.type})`);

  // 解析布局信息
  let layout: SceneLayout | null = null;
  if (scene.layout) {
    try {
      layout = JSON.parse(scene.layout);
    } catch (e) {
      console.warn(`[ScenePixelImage] 无法解析布局: ${scene.layout}`);
    }
  }

  // 构建 Prompt
  const prompt = buildScenePixelPrompt(scene, layout);
  console.log(`[ScenePixelImage] Prompt: ${prompt.substring(0, 100)}...`);

  // 获取图片尺寸
  const size = SCENE_IMAGE_SIZES[sizeKey];

  // 检查 GPU 服务状态
  const gpuAvailable = await checkDiffusersHealth();
  console.log(`[ScenePixelImage] GPU 服务状态: ${gpuAvailable ? '可用' : '不可用'}`);

  // 生成图片
  const result = await generateImage(prompt, {
    width: size.width,
    height: size.height,
    negativePrompt: PIXEL_NEGATIVE_PROMPT,
    style: 'pixel',
    steps: 20
  });

  if (result.success) {
    console.log(`[ScenePixelImage] 生成成功: ${result.imageUrl}`);
  } else {
    console.error(`[ScenePixelImage] 生成失败: ${result.error}`);
  }

  return result;
}

/**
 * 构建场景像素 Prompt
 */
function buildScenePixelPrompt(
  scene: {
    name: string;
    type: string;
    description?: string | null;
  },
  layout: SceneLayout | null
): string {
  // 获取基础 Prompt
  let basePrompt = SCENE_PIXEL_PROMPTS[scene.type] || DEFAULT_SCENE_PROMPT;

  // 添加场景名称相关的描述
  const nameLower = scene.name.toLowerCase();
  
  // 根据名称添加特定元素
  if (nameLower.includes('森林') || nameLower.includes('woods')) {
    basePrompt = SCENE_PIXEL_PROMPTS.forest;
  } else if (nameLower.includes('城堡') || nameLower.includes('castle')) {
    basePrompt = SCENE_PIXEL_PROMPTS.castle;
  } else if (nameLower.includes('广场') || nameLower.includes('square')) {
    basePrompt = SCENE_PIXEL_PROMPTS.public;
  } else if (nameLower.includes('家') || nameLower.includes('house') || nameLower.includes('小屋')) {
    basePrompt = SCENE_PIXEL_PROMPTS.residence;
  } else if (nameLower.includes('商店') || nameLower.includes('shop')) {
    basePrompt = SCENE_PIXEL_PROMPTS.shop;
  }

  // 添加布局信息
  let additionalElements: string[] = [];

  if (layout) {
    // 添加氛围
    if (layout.atmosphere && ATMOSPHERE_MODIFIERS[layout.atmosphere]) {
      additionalElements.push(ATMOSPHERE_MODIFIERS[layout.atmosphere]);
    }

    // 添加地面类型
    if (layout.groundType) {
      const groundPrompts: Record<string, string> = {
        grass: 'grass ground',
        ground: 'dirt ground',
        path: 'cobblestone path',
        water: 'water surface'
      };
      if (groundPrompts[layout.groundType]) {
        additionalElements.push(groundPrompts[layout.groundType]);
      }
    }

    // 添加关键元素
    if (layout.keyElements && Array.isArray(layout.keyElements)) {
      for (const element of layout.keyElements) {
        if (KEY_ELEMENT_PROMPTS[element]) {
          additionalElements.push(KEY_ELEMENT_PROMPTS[element]);
        }
      }
    }

    // 添加建筑物描述
    if (layout.buildings && Array.isArray(layout.buildings)) {
      for (const building of layout.buildings) {
        if (building.name) {
          additionalElements.push(`${building.name} building`);
        }
      }
    }
  }

  // 添加场景描述中的关键词
  if (scene.description) {
    const descLower = scene.description.toLowerCase();
    
    // 检查描述中的关键词
    for (const [key, prompt] of Object.entries(KEY_ELEMENT_PROMPTS)) {
      if (descLower.includes(key)) {
        additionalElements.push(prompt);
      }
    }
  }

  // 组合最终 Prompt
  let finalPrompt = basePrompt;
  if (additionalElements.length > 0) {
    finalPrompt = `${basePrompt}, ${additionalElements.join(', ')}`;
  }

  // 限制 Prompt 长度（避免 CLIP 截断）
  if (finalPrompt.length > 500) {
    finalPrompt = finalPrompt.substring(0, 500);
  }

  return finalPrompt;
}

/**
 * 批量生成场景图片
 * 
 * @param scenes 场景列表
 * @param onProgress 进度回调
 * @returns 生成结果列表
 */
export async function batchGenerateSceneImages(
  scenes: Array<{
    id: number;
    name: string;
    type: string;
    description?: string | null;
    layout?: string | null;
  }>,
  onProgress?: (current: number, total: number, sceneName: string) => void
): Promise<Array<{
  sceneId: number;
  sceneName: string;
  success: boolean;
  imageUrl?: string;
  error?: string;
}>> {
  const results: Array<{
    sceneId: number;
    sceneName: string;
    success: boolean;
    imageUrl?: string;
    error?: string;
  }> = [];

  console.log(`[ScenePixelImage] 开始批量生成 ${scenes.length} 个场景图片`);

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    
    if (onProgress) {
      onProgress(i + 1, scenes.length, scene.name);
    }

    const result = await generateScenePixelImage(scene);
    
    results.push({
      sceneId: scene.id,
      sceneName: scene.name,
      success: result.success,
      imageUrl: result.imageUrl,
      error: result.error
    });

    // 如果生成失败，等待一段时间再继续
    if (!result.success) {
      console.log(`[ScenePixelImage] 等待 5 秒后继续...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`[ScenePixelImage] 批量生成完成: ${successCount}/${scenes.length} 成功`);

  return results;
}

/**
 * 为小说生成所有场景图片
 * 
 * @param novelId 小说 ID
 * @param onProgress 进度回调
 * @returns 生成结果
 */
export async function generateNovelSceneImages(
  novelId: number,
  onProgress?: (current: number, total: number, sceneName: string) => void
): Promise<{
  total: number;
  success: number;
  failed: number;
  results: Array<{
    sceneId: number;
    sceneName: string;
    success: boolean;
    imageUrl?: string;
    error?: string;
  }>;
}> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    // 获取所有场景
    const scenes = await prisma.scene.findMany({
      where: { novelId, isActive: true },
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
        layout: true
      }
    });

    console.log(`[ScenePixelImage] 找到 ${scenes.length} 个场景`);

    // 批量生成
    const results = await batchGenerateSceneImages(scenes, onProgress);

    // 更新数据库
    for (const result of results) {
      if (result.success && result.imageUrl) {
        await prisma.scene.update({
          where: { id: result.sceneId },
          data: { imageUrl: result.imageUrl }
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return {
      total: scenes.length,
      success: successCount,
      failed: scenes.length - successCount,
      results
    };
  } finally {
    await prisma.$disconnect();
  }
}

export default {
  generateScenePixelImage,
  batchGenerateSceneImages,
  generateNovelSceneImages,
  SCENE_IMAGE_SIZES,
  SCENE_PIXEL_PROMPTS
};
