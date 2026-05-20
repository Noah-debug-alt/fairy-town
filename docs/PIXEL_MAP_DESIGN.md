# 像素地图系统技术设计文档

> 目标：实现斯坦福小镇风格的像素地图，为不同小说生成独特的地图呈现

## 一、斯坦福小镇地图风格分析

### 1.1 视觉特点

| 特点 | 说明 | 实现难度 |
|------|------|----------|
| **像素艺术风格** | 32x32 或 16x16 像素精灵 | 中等 |
| **俯视角视图** | 类似 The Sims 的 45° 俯视 | 中等 |
| **独特场景** | 每个建筑有独特外观 | 高 |
| **角色精灵** | 4方向 + 行走动画 | 高 |
| **色调协调** | 整体风格统一 | 中等 |

### 1.2 斯坦福小镇地图结构

```
┌─────────────────────────────────────────┐
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐    │
│  │房子A│  │商店 │  │咖啡馆│  │公园 │    │
│  └─────┘  └─────┘  └─────┘  └─────┘    │
│                                         │
│  ┌─────┐  ┌─────────────────┐  ┌─────┐ │
│  │学校 │  │    小镇广场     │  │医院 │ │
│  └─────┘  └─────────────────┘  └─────┘ │
│                                         │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐    │
│  │图书馆│  │餐厅 │  │酒吧 │  │住宅B│    │
│  └─────┘  └─────┘  └─────┘  └─────┘    │
└─────────────────────────────────────────┘
```

### 1.3 关键元素

1. **场景背景**：每个区域有独特的像素风格背景
2. **建筑物**：不同类型的建筑有不同的外观
3. **道路/路径**：连接各区域的路径
4. **装饰物**：树木、花草、路灯等
5. **角色精灵**：可移动的像素角色

---

## 二、系统架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端渲染层                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              PixelTownMap 组件                       │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │   │
│  │  │ 场景背景层  │ │ 装饰物层   │ │ 角色精灵层  │   │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        图片生成层                            │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ 场景图片生成器  │  │ 角色精灵生成器  │                  │
│  │ (SceneImageGen) │  │(CharacterSprite)│                  │
│  └────────┬────────┘  └────────┬────────┘                  │
│           │                    │                            │
│           └──────────┬─────────┘                            │
│                      ▼                                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Stable Diffusion XL (GPU)                │  │
│  │         + 像素风格 LoRA / ControlNet                   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        数据存储层                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Scene       │ │ Character   │ │ ImageCache  │           │
│  │ - layout    │ │ - spriteUrl │ │ - 生成的图片│           │
│  │ - imageUrl  │ │ - animFrames│ │             │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
小说解析 → 场景布局描述 → 生成场景图片 → 存储图片URL
                ↓
角色信息 → 角色精灵描述 → 生成精灵图 → 存储精灵URL
                ↓
地图渲染 → 加载图片 → Canvas绘制 → 动画更新
```

---

## 三、场景背景图生成

### 3.1 场景类型与模板

| 场景类型 | 描述 | 像素风格特征 |
|----------|------|--------------|
| `residence` | 住宅 | 温馨小屋、烟囱、花园 |
| `shop` | 商店 | 招牌、橱窗、货架 |
| `public` | 公共场所 | 广场、长椅、喷泉 |
| `forest` | 森林 | 茂密树木、小路、蘑菇 |
| `castle` | 城堡 | 高塔、城墙、旗帜 |
| `village` | 村庄 | 茅草屋、农田、水井 |

### 3.2 图片生成 Prompt 模板

```typescript
// 场景背景图生成 Prompt
const SCENE_PIXEL_PROMPT = {
  residence: `
    pixel art, 32x32 tiles, top-down view, cozy cottage house,
    warm colors, chimney with smoke, small garden with flowers,
    wooden door, windows with curtains, fairy tale style,
    Stardew Valley inspired, detailed pixel work, no text
  `,
  
  shop: `
    pixel art, 32x32 tiles, top-down view, medieval shop building,
    wooden sign, display windows, awning, crates and barrels outside,
    warm colors, fairy tale style, Stardew Valley inspired,
    detailed pixel work, no text
  `,
  
  public: `
    pixel art, 32x32 tiles, top-down view, town square,
    stone fountain in center, wooden benches, cobblestone ground,
    lamp posts, flower beds, fairy tale style,
    Stardew Valley inspired, detailed pixel work, no text
  `,
  
  forest: `
    pixel art, 32x32 tiles, top-down view, dense forest,
    tall trees, mushrooms, fallen leaves, dirt path,
    dappled sunlight, fairy tale style,
    Stardew Valley inspired, detailed pixel work, no text
  `,
  
  castle: `
    pixel art, 32x32 tiles, top-down view, medieval castle,
    tall towers, stone walls, flags, moat,
    grand entrance, fairy tale style,
    Stardew Valley inspired, detailed pixel work, no text
  `,
  
  village: `
    pixel art, 32x32 tiles, top-down view, rural village,
    thatched cottages, farm fields, well, dirt roads,
    peaceful atmosphere, fairy tale style,
    Stardew Valley inspired, detailed pixel work, no text
  `
};
```

### 3.3 图片尺寸与规格

| 图片类型 | 尺寸 | 格式 | 用途 |
|----------|------|------|------|
| 场景背景 | 320x256 px | PNG | 10x8 格子区域 |
| 场景缩略图 | 160x128 px | PNG | 列表显示 |
| 场景高清版 | 640x512 px | PNG | 放大查看 |

### 3.4 生成流程

```typescript
async function generateSceneImage(
  scene: Scene,
  layout: SceneLayout
): Promise<string> {
  // 1. 构建 prompt
  const basePrompt = SCENE_PIXEL_PROMPT[scene.type] || SCENE_PIXEL_PROMPT.public;
  const customPrompt = `${basePrompt}, ${layout.atmosphere} atmosphere`;
  
  // 2. 添加关键元素
  const elements = layout.keyElements?.join(', ') || '';
  const fullPrompt = `${customPrompt}, ${elements}`;
  
  // 3. 调用图片生成 API
  const imageUrl = await generateImage(fullPrompt, {
    width: 320,
    height: 256,
    steps: 20,
    style: 'pixel'
  });
  
  // 4. 保存图片 URL 到数据库
  await prisma.scene.update({
    where: { id: scene.id },
    data: { imageUrl }
  });
  
  return imageUrl;
}
```

---

## 四、角色精灵图生成

### 4.1 精灵图格式

**标准精灵图布局（128x32 px）**：

```
┌────────┬────────┬────────┬────────┐
│ 下行帧1 │ 下行帧2 │ 左行帧1 │ 左行帧2 │
│ (32x32) │ (32x32) │ (32x32) │ (32x32) │
├────────┼────────┼────────┼────────┤
│ 右行帧1 │ 右行帧2 │ 上行帧1 │ 上行帧2 │
│ (32x32) │ (32x32) │ (32x32) │ (32x32) │
└────────┴────────┴────────┴────────┘
```

### 4.2 角色精灵 Prompt 模板

```typescript
// 角色精灵图生成 Prompt
const CHARACTER_SPRITE_PROMPT = `
  pixel art sprite sheet, 4-direction character,
  top-down view, 32x32 pixels per frame,
  walking animation, 2 frames per direction,
  transparent background, game asset,
  {characterDescription},
  fairy tale style, Stardew Valley inspired,
  consistent style across all frames, no text
`;
```

### 4.3 生成流程

```typescript
async function generateCharacterSprite(
  character: Character
): Promise<{
  spriteUrl: string;
  frameWidth: number;
  frameHeight: number;
  directions: string[];
}> {
  // 1. 构建 prompt
  const prompt = CHARACTER_SPRITE_PROMPT.replace(
    '{characterDescription}',
    character.description
  );
  
  // 2. 调用图片生成 API
  const spriteUrl = await generateImage(prompt, {
    width: 128,   // 4帧 x 32px
    height: 64,   // 2行 x 32px
    steps: 25,
    style: 'pixel'
  });
  
  // 3. 保存精灵信息
  await prisma.character.update({
    where: { id: character.id },
    data: { 
      spriteUrl,
      spriteConfig: JSON.stringify({
        frameWidth: 32,
        frameHeight: 32,
        directions: ['down', 'left', 'right', 'up'],
        framesPerDirection: 2
      })
    }
  });
  
  return {
    spriteUrl,
    frameWidth: 32,
    frameHeight: 32,
    directions: ['down', 'left', 'right', 'up']
  };
}
```

---

## 五、地图渲染优化

### 5.1 渲染层次

```typescript
// 渲染顺序（从下到上）
const RENDER_LAYERS = {
  1: 'ground',        // 地面层
  2: 'paths',         // 道路层
  3: 'buildings',     // 建筑层
  4: 'decorations',   // 装饰层
  5: 'characters',    // 角色层
  6: 'effects',       // 特效层
  7: 'ui'             // UI层
};
```

### 5.2 图片缓存策略

```typescript
// 图片缓存管理
class ImageCache {
  private cache: Map<string, HTMLImageElement> = new Map();
  private loading: Map<string, Promise<HTMLImageElement>> = new Map();
  
  async get(url: string): Promise<HTMLImageElement> {
    // 1. 检查缓存
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }
    
    // 2. 检查是否正在加载
    if (this.loading.has(url)) {
      return this.loading.get(url)!;
    }
    
    // 3. 加载图片
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.cache.set(url, img);
        this.loading.delete(url);
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
    
    this.loading.set(url, promise);
    return promise;
  }
  
  // 预加载所有场景图片
  async preloadScenes(scenes: Scene[]): Promise<void> {
    await Promise.all(
      scenes
        .filter(s => s.imageUrl)
        .map(s => this.get(s.imageUrl!))
    );
  }
}
```

### 5.3 动画帧管理

```typescript
// 角色动画管理
class CharacterAnimator {
  private frameIndex: number = 0;
  private lastFrameTime: number = 0;
  private frameInterval: number = 200; // 毫秒
  
  // 获取当前帧
  getCurrentFrame(
    direction: 'down' | 'left' | 'right' | 'up',
    isMoving: boolean,
    currentTime: number
  ): number {
    if (!isMoving) {
      return 0; // 静止时显示第一帧
    }
    
    // 更新帧索引
    if (currentTime - this.lastFrameTime > this.frameInterval) {
      this.frameIndex = (this.frameIndex + 1) % 2;
      this.lastFrameTime = currentTime;
    }
    
    // 计算帧位置
    const directionOffset = {
      down: 0,
      left: 2,
      right: 4,
      up: 6
    };
    
    return directionOffset[direction] + this.frameIndex;
  }
}
```

---

## 六、实现步骤

### 阶段一：场景图片生成（2天）

| 任务 | 说明 |
|------|------|
| 1.1 | 创建场景图片生成模块 `utils/image-gen/sceneImage.ts` |
| 1.2 | 定义场景类型的 Prompt 模板 |
| 1.3 | 集成到小说解析流程 |
| 1.4 | 添加批量生成 API |
| 1.5 | 测试生成效果 |

### 阶段二：角色精灵生成（2天）

| 任务 | 说明 |
|------|------|
| 2.1 | 创建角色精灵生成模块 `utils/image-gen/characterSprite.ts` |
| 2.2 | 定义精灵图 Prompt 模板 |
| 2.3 | 实现精灵图裁剪和存储 |
| 2.4 | 添加批量生成 API |
| 2.5 | 测试生成效果 |

### 阶段三：地图渲染优化（1天）

| 任务 | 说明 |
|------|------|
| 3.1 | 更新 PixelTownMap 组件使用图片渲染 |
| 3.2 | 实现图片缓存和预加载 |
| 3.3 | 实现角色动画帧切换 |
| 3.4 | 优化渲染性能 |

### 阶段四：集成测试（1天）

| 任务 | 说明 |
|------|------|
| 4.1 | 完整流程测试 |
| 4.2 | 性能优化 |
| 4.3 | 用户体验优化 |
| 4.4 | 文档更新 |

---

## 七、技术细节

### 7.1 Stable Diffusion 配置

```python
# diffusers_server.py 添加像素风格配置
PIXEL_STYLE_CONFIG = {
    "prompt_suffix": "pixel art, 32bit style, game asset, no text",
    "negative_prompt": "realistic, 3d, high resolution, text, watermark",
    "num_inference_steps": 20,
    "guidance_scale": 7.5,
    "width": 320,
    "height": 256
}
```

### 7.2 图片存储结构

```
public/
  generated/
    scenes/
      novel_{novelId}_scene_{sceneId}.png
      novel_{novelId}_scene_{sceneId}_thumb.png
    characters/
      novel_{novelId}_char_{charId}_sprite.png
      novel_{novelId}_char_{charId}_avatar.png
```

### 7.3 数据库字段扩展

```prisma
model Scene {
  // ... 现有字段
  imageUrl       String?   // 场景背景图
  imageThumbUrl  String?   // 缩略图
}

model Character {
  // ... 现有字段
  spriteUrl      String?   // 精灵图 URL
  spriteConfig   String?   // 精灵图配置 JSON
}
```

---

## 八、预期效果

### 8.1 视觉效果

- 每个场景有独特的像素风格背景
- 角色有可动画的像素精灵
- 整体风格统一，类似 Stardew Valley
- 不同小说有不同的地图风格

### 8.2 性能指标

| 指标 | 目标 |
|------|------|
| 场景图片生成时间 | < 30秒/张 |
| 角色精灵生成时间 | < 45秒/个 |
| 地图渲染帧率 | >= 30 FPS |
| 图片加载时间 | < 1秒 |

---

## 九、风险与应对

| 风险 | 可能性 | 影响 | 应对措施 |
|------|--------|------|----------|
| AI 生成图片质量不稳定 | 高 | 中 | 提供重新生成选项 |
| 精灵图帧不一致 | 中 | 高 | 使用 ControlNet 保证一致性 |
| 生成时间过长 | 中 | 中 | 后台批量生成，显示进度 |
| GPU 内存不足 | 低 | 高 | 降低分辨率，使用 CPU 备选 |

---

**文档版本**: 1.0  
**创建日期**: 2026-05-20  
**预计工期**: 6天
