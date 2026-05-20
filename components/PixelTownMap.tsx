/**
 * 像素风格地图组件
 * 渲染网格地图、角色、对话气泡
 * 支持角色平滑移动动画
 * 
 * 特性：
 * - 像素风格渲染
 * - 角色移动动画
 * - 区域边界显示
 * - 对话气泡
 * - 缩放和拖拽
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';

// 格子类型颜色
const TILE_COLORS: Record<string, string[]> = {
  ground: ['#8B7355', '#A0826D', '#9B7B5A'],
  grass: ['#4CAF50', '#66BB6A', '#81C784'],
  path: ['#D7CCC8', '#BCAAA4', '#A1887F'],
  water: ['#2196F3', '#42A5F5', '#64B5F6'],
  wall: ['#5D4037', '#6D4C41', '#795548'],
  building: ['#FFC107', '#FFCA28', '#FFD54F']
};

// 方向对应的偏移量（用于角色精灵）
const DIRECTION_OFFSET: Record<string, number> = {
  down: 0,
  left: 1,
  right: 2,
  up: 3
};

/**
 * 格子数据
 */
export interface Tile {
  type: 'ground' | 'wall' | 'water' | 'grass' | 'path' | 'building';
  variant: number;
}

/**
 * 地图区域
 */
export interface MapRegion {
  id: number;
  name: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  type: string;
}

/**
 * 地图上的角色
 */
export interface CharacterOnMap {
  id: number;
  name: string;
  gridX: number;
  gridY: number;
  direction: string;
  isMoving: boolean;
  imageUrl?: string;
  color?: string;
}

/**
 * 地图事件（对话气泡）
 */
export interface MapEvent {
  id: number;
  characterId: number;
  type: 'dialogue' | 'action' | 'narration';
  content: string;
  timestamp: Date;
}

/**
 * 组件属性
 */
interface PixelTownMapProps {
  // 地图配置
  mapWidth: number;
  mapHeight: number;
  tileSize: number;

  // 地图数据
  tiles: Tile[][];
  walkableMap: number[][];

  // 区域
  regions: MapRegion[];

  // 角色
  characters: CharacterOnMap[];

  // 事件（对话气泡）
  events: MapEvent[];

  // 新增：场景背景图（按区域 ID 或名称索引）
  sceneImages?: Record<string, string>;

  // 回调
  onCharacterClick?: (character: CharacterOnMap) => void;
  onRegionClick?: (region: MapRegion) => void;
  onMapClick?: (pos: { x: number; y: number }) => void;

  // 显示选项
  showGrid?: boolean;
  showWalkable?: boolean;
  showRegionBounds?: boolean;
  showRegionNames?: boolean;
  useSceneImages?: boolean;  // 新增：是否使用场景图片作为背景

  // 缩放和偏移
  initialScale?: number;
  initialOffset?: { x: number; y: number };
}

/**
 * 像素风格地图组件
 */
const PixelTownMap: React.FC<PixelTownMapProps> = ({
  mapWidth,
  mapHeight,
  tileSize,
  tiles,
  walkableMap,
  regions,
  characters,
  events,
  sceneImages = {},
  onCharacterClick,
  onRegionClick,
  onMapClick,
  showGrid = false,
  showWalkable = false,
  showRegionBounds = true,
  showRegionNames = true,
  useSceneImages = true,
  initialScale = 1,
  initialOffset = { x: 0, y: 0 }
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 缩放和偏移状态
  const [scale, setScale] = useState(initialScale);
  const [offset, setOffset] = useState(initialOffset);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // 角色精灵缓存
  const [characterSprites, setCharacterSprites] = useState<Record<number, HTMLImageElement>>({});
  
  // 新增：场景背景图缓存
  const [sceneImageCache, setSceneImageCache] = useState<Record<string, HTMLImageElement>>({});

  // 加载角色精灵图
  useEffect(() => {
    characters.forEach(char => {
      if (char.imageUrl && !characterSprites[char.id]) {
        const img = new Image();
        img.onload = () => {
          setCharacterSprites(prev => ({ ...prev, [char.id]: img }));
        };
        img.onerror = () => {
          console.warn(`[PixelTownMap] 无法加载角色图片: ${char.imageUrl}`);
        };
        img.src = char.imageUrl;
      }
    });
  }, [characters]);

  // 新增：加载场景背景图
  useEffect(() => {
    if (!useSceneImages || Object.keys(sceneImages).length === 0) return;

    Object.entries(sceneImages).forEach(([key, url]) => {
      if (!sceneImageCache[key]) {
        const img = new Image();
        img.onload = () => {
          setSceneImageCache(prev => ({ ...prev, [key]: img }));
        };
        img.onerror = () => {
          console.warn(`[PixelTownMap] 无法加载场景图片: ${url}`);
        };
        img.src = url;
      }
    });
  }, [sceneImages, useSceneImages]);

  /**
   * 绘制地图
   */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = mapWidth * tileSize;
    const canvasHeight = mapHeight * tileSize;

    // 设置画布尺寸
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    ctx.scale(dpr, dpr);

    // 清空画布
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // 新增：绘制场景背景图（如果可用）
    if (useSceneImages && Object.keys(sceneImageCache).length > 0) {
      for (const region of regions) {
        const sceneImg = sceneImageCache[region.id] || sceneImageCache[region.name];
        if (sceneImg) {
          const regionWidth = (region.endX - region.startX + 1) * tileSize;
          const regionHeight = (region.endY - region.startY + 1) * tileSize;
          ctx.drawImage(
            sceneImg,
            region.startX * tileSize,
            region.startY * tileSize,
            regionWidth,
            regionHeight
          );
        }
      }
    } else {
      // 如果没有场景图片，绘制格子背景
      // 1. 绘制格子背景
      for (let y = 0; y < mapHeight; y++) {
        for (let x = 0; x < mapWidth; x++) {
          const tile = tiles[y]?.[x];
          if (tile) {
            const colors = TILE_COLORS[tile.type] || TILE_COLORS.grass;
            const color = colors[tile.variant % colors.length];

            ctx.fillStyle = color;
            ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);

            // 显示可行走区域
            if (showWalkable && walkableMap[y]?.[x] === 0) {
              ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
              ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
            }

            // 显示网格
            if (showGrid) {
              ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
              ctx.lineWidth = 1;
              ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
            }
          }
        }
      }
    }

    // 2. 绘制区域边界
    if (showRegionBounds) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      for (const region of regions) {
        ctx.strokeRect(
          region.startX * tileSize,
          region.startY * tileSize,
          (region.endX - region.startX + 1) * tileSize,
          (region.endY - region.startY + 1) * tileSize
        );
      }

      ctx.setLineDash([]);
    }

    // 3. 绘制区域名称
    if (showRegionNames) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (const region of regions) {
        const centerX = (region.startX + (region.endX - region.startX) / 2 + 0.5) * tileSize;
        const centerY = region.startY * tileSize + 12;

        // 背景
        const textWidth = ctx.measureText(region.name).width + 10;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(centerX - textWidth / 2, centerY - 8, textWidth, 16);

        // 文字
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px "Microsoft YaHei", sans-serif';
        ctx.fillText(region.name, centerX, centerY);
      }
    }

    // 4. 绘制角色
    for (const char of characters) {
      const x = char.gridX * tileSize;
      const y = char.gridY * tileSize;

      const sprite = characterSprites[char.id];
      if (sprite) {
        // 使用精灵图
        ctx.drawImage(sprite, x, y, tileSize, tileSize);
      } else {
        // 默认圆形角色
        const color = char.color || '#667eea';
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x + tileSize / 2, y + tileSize / 2, tileSize / 2 - 2, 0, Math.PI * 2);
        ctx.fill();

        // 边框
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 角色名首字
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${tileSize * 0.5}px "Microsoft YaHei", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(char.name.slice(0, 1), x + tileSize / 2, y + tileSize / 2);
      }

      // 角色名标签
      const nameWidth = char.name.length * 12 + 10;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(x + tileSize / 2 - nameWidth / 2, y - 18, nameWidth, 16);
      ctx.fillStyle = '#fff';
      ctx.font = '11px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(char.name, x + tileSize / 2, y - 10);

      // 移动指示器
      if (char.isMoving) {
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + tileSize / 2, y + tileSize / 2, tileSize / 2 + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 5. 绘制对话气泡
    for (const event of events) {
      const char = characters.find(c => c.id === event.characterId);
      if (!char) continue;

      const x = char.gridX * tileSize + tileSize / 2;
      const y = char.gridY * tileSize;

      drawDialogueBubble(ctx, x, y - 30, event.content, event.type);
    }

    ctx.restore();
  }, [
    mapWidth, mapHeight, tileSize, tiles, walkableMap,
    regions, characters, events, characterSprites, sceneImageCache,
    showGrid, showWalkable, showRegionBounds, showRegionNames,
    useSceneImages, scale, offset
  ]);

  /**
   * 绘制对话气泡
   */
  const drawDialogueBubble = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    content: string,
    type: string
  ) => {
    const maxWidth = 150;
    const padding = 8;
    const lineHeight = 14;

    // 计算文本行数
    ctx.font = '12px "Microsoft YaHei", sans-serif';
    const lines = wrapText(ctx, content, maxWidth - padding * 2);
    const bubbleHeight = lines.length * lineHeight + padding * 2;
    const bubbleWidth = Math.min(
      Math.max(...lines.map(l => ctx.measureText(l).width)) + padding * 2,
      maxWidth
    );

    // 气泡背景
    ctx.fillStyle = type === 'action' ? 'rgba(255, 152, 0, 0.9)' : 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.roundRect(x - bubbleWidth / 2, y - bubbleHeight, bubbleWidth, bubbleHeight, 4);
    ctx.fill();

    // 气泡尖角
    ctx.beginPath();
    ctx.moveTo(x - 5, y);
    ctx.lineTo(x + 5, y);
    ctx.lineTo(x, y + 5);
    ctx.fill();

    // 文本
    ctx.fillStyle = type === 'action' ? '#fff' : '#333';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((line, i) => {
      ctx.fillText(line, x - bubbleWidth / 2 + padding, y - bubbleHeight + padding + i * lineHeight);
    });
  };

  /**
   * 文本换行
   */
  const wrapText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string[] => {
    const words = text.split('');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine + word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  };

  // 绘制
  useEffect(() => {
    draw();
  }, [draw]);

  /**
   * 处理鼠标滚轮缩放
   */
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newScale = Math.max(0.5, Math.min(3, scale + delta));
    setScale(newScale);
  };

  /**
   * 处理鼠标按下
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  /**
   * 处理鼠标移动
   */
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  /**
   * 处理鼠标释放
   */
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  /**
   * 处理点击
   */
  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / scale / tileSize;
    const y = (e.clientY - rect.top - offset.y) / scale / tileSize;

    // 检查是否点击了角色
    for (const char of characters) {
      const dx = x - char.gridX;
      const dy = y - char.gridY;
      if (dx >= 0 && dx < 1 && dy >= 0 && dy < 1) {
        onCharacterClick?.(char);
        return;
      }
    }

    // 检查是否点击了区域
    for (const region of regions) {
      if (x >= region.startX && x <= region.endX &&
          y >= region.startY && y <= region.endY) {
        onRegionClick?.(region);
        return;
      }
    }

    // 地图点击
    onMapClick?.({ x: Math.floor(x), y: Math.floor(y) });
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        cursor: isDragging ? 'grabbing' : 'grab',
        backgroundColor: '#1a1a2e'
      }}
    >
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        style={{
          imageRendering: 'pixelated'
        }}
      />
    </div>
  );
};

export default PixelTownMap;
