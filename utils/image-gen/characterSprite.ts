/**
 * 角色精灵图生成模块
 * 为小说角色生成斯坦福小镇风格的像素精灵图
 * 
 * 特点：
 * - 4方向精灵图（上下左右）
 * - 行走动画帧
 * - 32x32 像素风格
 */

import { Character } from '@prisma/client';
import { generateImage, ImageGenResult, checkDiffusersHealth } from './index';

// 角色精灵图 Prompt 模板
const CHARACTER_SPRITE_PROMPT = `
  pixel art character sprite sheet, 4-direction character,
  top-down view, 32x32 pixels per frame,
  walking animation, 2 frames per direction,
  transparent background, game asset,
  {characterDescription},
  fairy tale style, Stardew Valley inspired,
  consistent style across all frames, no text, no UI
`.trim().replace(/\s+/g, ' ');

// 角色类型样式映射
const CHARACTER_TYPE_STYLES: Record<string, string> = {
  protagonist: 'heroic pose, bright colors, confident expression',
  antagonist: 'dark colors, mysterious, intimidating',
  supporting: 'friendly appearance, warm colors',
  child: 'small stature, cute, innocent expression',
  elder: 'distinguished, wise appearance, gray hair',
  warrior: 'armor, strong build, battle-ready',
  mage: 'robes, mystical aura, staff',
  merchant: 'fine clothes, carrying goods',
  peasant: 'simple clothes, humble appearance'
};

// 角色情绪映射
const EMOTION_MODIFIERS: Record<string, string> = {
  happy: 'smiling, cheerful expression',
  sad: 'downcast eyes, melancholic',
  angry: 'frowning, intense expression',
  scared: 'wide eyes, fearful',
  neutral: 'calm expression',
  excited: 'energetic, animated pose'
};

// 精灵图尺寸配置
export const SPRITE_SIZES = {
  // 标准精灵图：4方向 x 2帧
  standard: { width: 128, height: 64 },  // 4列 x 2行
  // 单帧尺寸
  frame: { width: 32, height: 32 },
  // 高清版
  hd: { width: 256, height: 128 }
};

/**
 * 精灵图配置
 */
export interface SpriteConfig {
  frameWidth: number;
  frameHeight: number;
  directions: ('down' | 'left' | 'right' | 'up')[];
  framesPerDirection: number;
  animationSpeed: number;  // 毫秒
}

/**
 * 默认精灵配置
 */
export const DEFAULT_SPRITE_CONFIG: SpriteConfig = {
  frameWidth: 32,
  frameHeight: 32,
  directions: ['down', 'left', 'right', 'up'],
  framesPerDirection: 2,
  animationSpeed: 200
};

/**
 * 生成角色精灵图
 * 
 * @param character 角色信息
 * @returns 生成结果
 */
export async function generateCharacterSprite(
  character: {
    id: number;
    name: string;
    description: string;
    coreIdentity?: string | null;
  }
): Promise<ImageGenResult & { config?: SpriteConfig }> {
  console.log(`[CharacterSprite] 开始生成角色精灵: ${character.name}`);

  // 构建 Prompt
  const prompt = buildCharacterSpritePrompt(character);
  console.log(`[CharacterSprite] Prompt: ${prompt.substring(0, 100)}...`);

  // 检查 GPU 服务状态
  const gpuAvailable = await checkDiffusersHealth();
  console.log(`[CharacterSprite] GPU 服务状态: ${gpuAvailable ? '可用' : '不可用'}`);

  // 生成精灵图
  const result = await generateImage(prompt, {
    width: SPRITE_SIZES.standard.width,
    height: SPRITE_SIZES.standard.height,
    negativePrompt: `
      realistic, 3d render, photo, text, watermark,
      blurry, low quality, deformed, ugly, bad anatomy,
      multiple characters, crowd, background, scenery
    `.trim().replace(/\s+/g, ' '),
    style: 'pixel',
    steps: 25,
    name: `sprite_${character.name}`
  });

  if (result.success) {
    console.log(`[CharacterSprite] 生成成功: ${result.imageUrl}`);
    return {
      ...result,
      config: DEFAULT_SPRITE_CONFIG
    };
  } else {
    console.error(`[CharacterSprite] 生成失败: ${result.error}`);
    return result;
  }
}

/**
 * 构建角色精灵 Prompt
 */
function buildCharacterSpritePrompt(character: {
  name: string;
  description: string;
  coreIdentity?: string | null;
}): string {
  let description = character.description;

  // 添加核心身份描述
  if (character.coreIdentity) {
    description = `${description}, ${character.coreIdentity}`;
  }

  // 检测角色类型
  const typeStyle = detectCharacterType(character.description);
  if (typeStyle) {
    description = `${description}, ${typeStyle}`;
  }

  // 替换模板
  let prompt = CHARACTER_SPRITE_PROMPT.replace('{characterDescription}', description);

  return prompt;
}

/**
 * 检测角色类型
 */
function detectCharacterType(description: string): string | null {
  const descLower = description.toLowerCase();

  if (descLower.includes('主角') || descLower.includes('英雄') || descLower.includes('protagonist')) {
    return CHARACTER_TYPE_STYLES.protagonist;
  }
  if (descLower.includes('反派') || descLower.includes('敌人') || descLower.includes('antagonist')) {
    return CHARACTER_TYPE_STYLES.antagonist;
  }
  if (descLower.includes('孩子') || descLower.includes('儿童') || descLower.includes('child')) {
    return CHARACTER_TYPE_STYLES.child;
  }
  if (descLower.includes('老人') || descLower.includes('长者') || descLower.includes('elder')) {
    return CHARACTER_TYPE_STYLES.elder;
  }
  if (descLower.includes('战士') || descLower.includes('骑士') || descLower.includes('warrior')) {
    return CHARACTER_TYPE_STYLES.warrior;
  }
  if (descLower.includes('法师') || descLower.includes('巫师') || descLower.includes('mage')) {
    return CHARACTER_TYPE_STYLES.mage;
  }
  if (descLower.includes('商人') || descLower.includes('merchant')) {
    return CHARACTER_TYPE_STYLES.merchant;
  }
  if (descLower.includes('农民') || descLower.includes('村民') || descLower.includes('peasant')) {
    return CHARACTER_TYPE_STYLES.peasant;
  }

  return null;
}

/**
 * 批量生成角色精灵图
 * 
 * @param characters 角色列表
 * @param onProgress 进度回调
 * @returns 生成结果列表
 */
export async function batchGenerateCharacterSprites(
  characters: Array<{
    id: number;
    name: string;
    description: string;
    coreIdentity?: string | null;
  }>,
  onProgress?: (current: number, total: number, characterName: string) => void
): Promise<Array<{
  characterId: number;
  characterName: string;
  success: boolean;
  spriteUrl?: string;
  config?: SpriteConfig;
  error?: string;
}>> {
  const results: Array<{
    characterId: number;
    characterName: string;
    success: boolean;
    spriteUrl?: string;
    config?: SpriteConfig;
    error?: string;
  }> = [];

  console.log(`[CharacterSprite] 开始批量生成 ${characters.length} 个角色精灵`);

  for (let i = 0; i < characters.length; i++) {
    const character = characters[i];

    if (onProgress) {
      onProgress(i + 1, characters.length, character.name);
    }

    const result = await generateCharacterSprite(character);

    results.push({
      characterId: character.id,
      characterName: character.name,
      success: result.success,
      spriteUrl: result.imageUrl,
      config: result.config,
      error: result.error
    });

    // 如果生成失败，等待一段时间再继续
    if (!result.success) {
      console.log(`[CharacterSprite] 等待 5 秒后继续...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`[CharacterSprite] 批量生成完成: ${successCount}/${characters.length} 成功`);

  return results;
}

/**
 * 为小说生成所有角色精灵图
 * 
 * @param novelId 小说 ID
 * @param onProgress 进度回调
 * @returns 生成结果
 */
export async function generateNovelCharacterSprites(
  novelId: number,
  onProgress?: (current: number, total: number, characterName: string) => void
): Promise<{
  total: number;
  success: number;
  failed: number;
  results: Array<{
    characterId: number;
    characterName: string;
    success: boolean;
    spriteUrl?: string;
    error?: string;
  }>;
}> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    // 获取所有角色
    const characters = await prisma.character.findMany({
      where: { novelId },
      select: {
        id: true,
        name: true,
        description: true,
        coreIdentity: true
      }
    });

    console.log(`[CharacterSprite] 找到 ${characters.length} 个角色`);

    // 批量生成
    const results = await batchGenerateCharacterSprites(characters, onProgress);

    // 更新数据库
    for (const result of results) {
      if (result.success && result.spriteUrl) {
        await prisma.character.update({
          where: { id: result.characterId },
          data: {
            imageUrl: result.spriteUrl,
            // 存储精灵配置
            // 注意：需要在 Character 模型中添加 spriteConfig 字段
          }
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return {
      total: characters.length,
      success: successCount,
      failed: characters.length - successCount,
      results: results.map(r => ({
        characterId: r.characterId,
        characterName: r.characterName,
        success: r.success,
        spriteUrl: r.spriteUrl,
        error: r.error
      }))
    };
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 从精灵图中提取单帧
 * 用于在地图上显示角色
 * 
 * @param spriteUrl 精灵图 URL
 * @param direction 方向
 * @param frame 帧索引 (0 或 1)
 * @returns 单帧图片的 Data URL
 */
export async function extractSpriteFrame(
  spriteUrl: string,
  direction: 'down' | 'left' | 'right' | 'up',
  frame: number = 0
): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = SPRITE_SIZES.frame.width;
      canvas.height = SPRITE_SIZES.frame.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      // 计算帧位置
      const directionIndex = DEFAULT_SPRITE_CONFIG.directions.indexOf(direction);
      const frameX = (directionIndex * 2 + frame) * SPRITE_SIZES.frame.width;
      const frameY = 0;

      // 提取帧
      ctx.drawImage(
        img,
        frameX, frameY,
        SPRITE_SIZES.frame.width, SPRITE_SIZES.frame.height,
        0, 0,
        SPRITE_SIZES.frame.width, SPRITE_SIZES.frame.height
      );

      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => resolve(null);
    img.src = spriteUrl;
  });
}

export default {
  generateCharacterSprite,
  batchGenerateCharacterSprites,
  generateNovelCharacterSprites,
  extractSpriteFrame,
  SPRITE_SIZES,
  DEFAULT_SPRITE_CONFIG
};
