/**
 * 地图编辑组件
 * 允许用户编辑像素地图的格子类型
 * 
 * 功能：
 * - 点击格子修改类型
 * - 选择不同的画笔工具
 * - 保存修改到数据库
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button, Tooltip, message, Popconfirm } from 'antd';
import {
  BgColorsOutlined,
  HomeOutlined,
  ShopOutlined,
  BorderOutlined,
  CloudOutlined,
  SaveOutlined,
  UndoOutlined,
  ClearOutlined
} from '@ant-design/icons';
import PixelTownMap, { Tile, MapRegion, CharacterOnMap, MapEvent } from './PixelTownMap';

/**
 * 画笔工具类型
 */
type BrushTool = 'grass' | 'ground' | 'path' | 'water' | 'wall' | 'building' | 'eraser';

/**
 * 工具配置
 */
const TOOLS: Array<{
  type: BrushTool;
  label: string;
  icon: React.ReactNode;
  color: string;
}> = [
  { type: 'grass', label: '草地', icon: <BgColorsOutlined />, color: '#4CAF50' },
  { type: 'ground', label: '地面', icon: <BorderOutlined />, color: '#8B7355' },
  { type: 'path', label: '道路', icon: <BgColorsOutlined />, color: '#D7CCC8' },
  { type: 'water', label: '水域', icon: <CloudOutlined />, color: '#2196F3' },
  { type: 'wall', label: '墙壁', icon: <BorderOutlined />, color: '#5D4037' },
  { type: 'building', label: '建筑', icon: <HomeOutlined />, color: '#FFC107' },
  { type: 'eraser', label: '橡皮擦', icon: <ClearOutlined />, color: '#9E9E9E' }
];

/**
 * 组件属性
 */
interface MapEditorProps {
  // 地图配置
  mapWidth: number;
  mapHeight: number;
  tileSize: number;

  // 初始地图数据
  initialTiles: Tile[][];
  initialWalkableMap: number[][];

  // 区域
  regions: MapRegion[];

  // 角色（可选，用于显示）
  characters?: CharacterOnMap[];

  // 保存回调
  onSave: (tiles: Tile[][], walkableMap: number[][]) => Promise<void>;

  // 是否显示工具栏
  showToolbar?: boolean;
}

/**
 * 地图编辑器组件
 */
const MapEditor: React.FC<MapEditorProps> = ({
  mapWidth,
  mapHeight,
  tileSize,
  initialTiles,
  initialWalkableMap,
  regions,
  characters = [],
  onSave,
  showToolbar = true
}) => {
  // 当前地图数据
  const [tiles, setTiles] = useState<Tile[][]>(() =>
    JSON.parse(JSON.stringify(initialTiles))
  );
  const [walkableMap, setWalkableMap] = useState<number[][]>(() =>
    JSON.parse(JSON.stringify(initialWalkableMap))
  );

  // 当前选中的工具
  const [currentTool, setCurrentTool] = useState<BrushTool>('grass');

  // 是否正在绘制
  const [isDrawing, setIsDrawing] = useState(false);

  // 历史记录（用于撤销）
  const [history, setHistory] = useState<Tile[][][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // 是否有未保存的修改
  const [hasChanges, setHasChanges] = useState(false);

  // 是否正在保存
  const [isSaving, setIsSaving] = useState(false);

  // 画布引用
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /**
   * 保存历史记录
   */
  const saveToHistory = useCallback((newTiles: Tile[][]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newTiles)));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  /**
   * 撤销
   */
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setTiles(JSON.parse(JSON.stringify(history[historyIndex - 1])));
      setHistoryIndex(historyIndex - 1);
      setHasChanges(true);
    }
  }, [history, historyIndex]);

  /**
   * 重做
   */
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setTiles(JSON.parse(JSON.stringify(history[historyIndex + 1])));
      setHistoryIndex(historyIndex + 1);
      setHasChanges(true);
    }
  }, [history, historyIndex]);

  /**
   * 绘制格子
   */
  const paintTile = useCallback((gridX: number, gridY: number) => {
    if (gridX < 0 || gridX >= mapWidth || gridY < 0 || gridY >= mapHeight) {
      return;
    }

    const newTiles = JSON.parse(JSON.stringify(tiles));
    const newWalkableMap = JSON.parse(JSON.stringify(walkableMap));

    if (currentTool === 'eraser') {
      // 橡皮擦恢复为草地
      newTiles[gridY][gridX] = { type: 'grass', variant: 0 };
      newWalkableMap[gridY][gridX] = 1;
    } else {
      newTiles[gridY][gridX] = { type: currentTool, variant: Math.floor(Math.random() * 3) };
      // 墙壁和水域不可行走
      newWalkableMap[gridY][gridX] = (currentTool === 'wall' || currentTool === 'water') ? 0 : 1;
    }

    setTiles(newTiles);
    setWalkableMap(newWalkableMap);
    setHasChanges(true);
  }, [tiles, walkableMap, currentTool, mapWidth, mapHeight]);

  /**
   * 处理鼠标按下
   */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;  // 只处理左键

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.floor((e.clientX - rect.left) / tileSize);
    const y = Math.floor((e.clientY - rect.top) / tileSize);

    setIsDrawing(true);
    saveToHistory(tiles);
    paintTile(x, y);
  }, [tiles, tileSize, saveToHistory, paintTile]);

  /**
   * 处理鼠标移动
   */
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.floor((e.clientX - rect.left) / tileSize);
    const y = Math.floor((e.clientY - rect.top) / tileSize);

    paintTile(x, y);
  }, [isDrawing, tileSize, paintTile]);

  /**
   * 处理鼠标释放
   */
  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
  }, []);

  /**
   * 保存修改
   */
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(tiles, walkableMap);
      setHasChanges(false);
      message.success('地图已保存');
    } catch (error) {
      message.error('保存失败');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * 重置地图
   */
  const handleReset = () => {
    setTiles(JSON.parse(JSON.stringify(initialTiles)));
    setWalkableMap(JSON.parse(JSON.stringify(initialWalkableMap)));
    setHasChanges(false);
    message.info('已重置为初始状态');
  };

  // 初始化历史记录
  useEffect(() => {
    saveToHistory(initialTiles);
  }, []);

  return (
    <div className="map-editor">
      {/* 工具栏 */}
      {showToolbar && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '12px',
            backgroundColor: '#1a1a2e',
            borderRadius: '8px',
            marginBottom: '12px',
            flexWrap: 'wrap'
          }}
        >
          {/* 画笔工具 */}
          {TOOLS.map(tool => (
            <Tooltip key={tool.type} title={tool.label}>
              <Button
                type={currentTool === tool.type ? 'primary' : 'default'}
                icon={tool.icon}
                onClick={() => setCurrentTool(tool.type)}
                style={{
                  backgroundColor: currentTool === tool.type ? tool.color : undefined,
                  borderColor: tool.color
                }}
              >
                {tool.label}
              </Button>
            </Tooltip>
          ))}

          <div style={{ flex: 1 }} />

          {/* 操作按钮 */}
          <Tooltip title="撤销">
            <Button
              icon={<UndoOutlined />}
              onClick={undo}
              disabled={historyIndex <= 0}
            />
          </Tooltip>

          <Popconfirm
            title="确定要重置地图吗？"
            description="这将放弃所有未保存的修改"
            onConfirm={handleReset}
          >
            <Tooltip title="重置">
              <Button icon={<ClearOutlined />} danger />
            </Tooltip>
          </Popconfirm>

          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={isSaving}
            disabled={!hasChanges}
          >
            保存
          </Button>
        </div>
      )}

      {/* 地图画布 */}
      <div
        style={{
          border: '2px solid #333',
          borderRadius: '8px',
          overflow: 'hidden',
          cursor: 'crosshair'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas
          ref={canvasRef}
          width={mapWidth * tileSize}
          height={mapHeight * tileSize}
          style={{
            imageRendering: 'pixelated',
            display: 'block'
          }}
        />
      </div>

      {/* 状态提示 */}
      {hasChanges && (
        <div
          style={{
            marginTop: '8px',
            padding: '8px 12px',
            backgroundColor: '#ff9800',
            color: '#fff',
            borderRadius: '4px',
            fontSize: '12px'
          }}
        >
          有未保存的修改
        </div>
      )}

      {/* 隐藏的 PixelTownMap 用于渲染 */}
      <div style={{ display: 'none' }}>
        <PixelTownMap
          mapWidth={mapWidth}
          mapHeight={mapHeight}
          tileSize={tileSize}
          tiles={tiles}
          walkableMap={walkableMap}
          regions={regions}
          characters={characters}
          events={[]}
          showGrid={true}
          showRegionBounds={true}
        />
      </div>
    </div>
  );
};

export default MapEditor;
