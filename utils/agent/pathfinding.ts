/**
 * 路径规划模块
 * 实现 A* 算法，支持在网格地图上寻找最短路径
 * 
 * 核心功能：
 * - A* 路径规划算法
 * - 可行走区域检测
 * - 距离计算
 */

/**
 * 网格位置接口
 */
export interface GridPosition {
  x: number;
  y: number;
}

/**
 * 路径节点接口（用于 A* 算法）
 */
export interface PathNode {
  pos: GridPosition;
  g: number;  // 从起点到当前点的成本
  h: number;  // 从当前点到终点的估计成本（启发函数）
  f: number;  // g + h
  parent: PathNode | null;
}

/**
 * A* 路径规划算法
 * 
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
  // 检查起点和终点是否有效
  if (!isWalkable(start, walkableMap) || !isWalkable(end, walkableMap)) {
    return [];
  }

  // 如果起点和终点相同
  if (start.x === end.x && start.y === end.y) {
    return [start];
  }

  const openList: PathNode[] = [];
  const closedSet: Set<string> = new Set();

  // 创建起始节点
  const startNode: PathNode = {
    pos: start,
    g: 0,
    h: manhattanDistance(start, end),
    f: manhattanDistance(start, end),
    parent: null
  };

  openList.push(startNode);

  // 最大迭代次数，防止无限循环
  const maxIterations = walkableMap.length * (walkableMap[0]?.length || 0) * 2;
  let iterations = 0;

  while (openList.length > 0 && iterations < maxIterations) {
    iterations++;

    // 找到 f 值最小的节点
    openList.sort((a, b) => a.f - b.f);
    const current = openList.shift()!;

    // 检查是否到达终点
    if (current.pos.x === end.x && current.pos.y === end.y) {
      return reconstructPath(current);
    }

    // 将当前节点加入关闭列表
    closedSet.add(`${current.pos.x},${current.pos.y}`);

    // 获取相邻节点（四方向）
    const neighbors = getNeighbors(current.pos, walkableMap);

    for (const neighborPos of neighbors) {
      const key = `${neighborPos.x},${neighborPos.y}`;

      // 如果已在关闭列表中，跳过
      if (closedSet.has(key)) {
        continue;
      }

      const g = current.g + 1;  // 移动成本为 1
      const h = manhattanDistance(neighborPos, end);
      const f = g + h;

      // 检查是否已在开放列表中
      const existingIndex = openList.findIndex(
        n => n.pos.x === neighborPos.x && n.pos.y === neighborPos.y
      );

      if (existingIndex === -1) {
        // 新节点，加入开放列表
        openList.push({
          pos: neighborPos,
          g,
          h,
          f,
          parent: current
        });
      } else if (g < openList[existingIndex].g) {
        // 找到更短的路径，更新节点
        openList[existingIndex].g = g;
        openList[existingIndex].f = g + openList[existingIndex].h;
        openList[existingIndex].parent = current;
      }
    }
  }

  // 无法找到路径
  return [];
}

/**
 * 获取相邻的可行走位置
 * 
 * @param pos 当前位置
 * @param walkableMap 可行走地图
 * @returns 相邻的可行走位置列表
 */
export function getNeighbors(pos: GridPosition, walkableMap: number[][]): GridPosition[] {
  const neighbors: GridPosition[] = [];
  
  // 四方向：上、下、左、右
  const directions = [
    { x: 0, y: -1 },  // 上
    { x: 0, y: 1 },   // 下
    { x: -1, y: 0 },  // 左
    { x: 1, y: 0 }    // 右
  ];

  for (const dir of directions) {
    const newPos: GridPosition = {
      x: pos.x + dir.x,
      y: pos.y + dir.y
    };

    if (isWalkable(newPos, walkableMap)) {
      neighbors.push(newPos);
    }
  }

  return neighbors;
}

/**
 * 检查位置是否可行走
 * 
 * @param pos 要检查的位置
 * @param walkableMap 可行走地图
 * @returns 是否可行走
 */
export function isWalkable(pos: GridPosition, walkableMap: number[][]): boolean {
  // 检查边界
  if (pos.x < 0 || pos.y < 0) {
    return false;
  }

  if (!walkableMap || walkableMap.length === 0) {
    return false;
  }

  if (pos.y >= walkableMap.length) {
    return false;
  }

  if (!walkableMap[pos.y] || pos.x >= walkableMap[pos.y].length) {
    return false;
  }

  return walkableMap[pos.y][pos.x] === 1;
}

/**
 * 计算两点间曼哈顿距离
 * 
 * @param a 点 A
 * @param b 点 B
 * @returns 曼哈顿距离
 */
export function manhattanDistance(a: GridPosition, b: GridPosition): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * 计算两点间欧几里得距离
 * 
 * @param a 点 A
 * @param b 点 B
 * @returns 欧几里得距离
 */
export function euclideanDistance(a: GridPosition, b: GridPosition): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

/**
 * 重建路径（从终点回溯到起点）
 * 
 * @param node 终点节点
 * @returns 路径点数组（从起点到终点）
 */
function reconstructPath(node: PathNode): GridPosition[] {
  const path: GridPosition[] = [];
  let current: PathNode | null = node;

  while (current) {
    path.unshift(current.pos);
    current = current.parent;
  }

  return path;
}

/**
 * 简化路径（移除不必要的中间点）
 * 用于让角色移动更自然
 * 
 * @param path 原始路径
 * @returns 简化后的路径
 */
export function simplifyPath(path: GridPosition[]): GridPosition[] {
  if (path.length <= 2) {
    return path;
  }

  const simplified: GridPosition[] = [path[0]];

  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const next = path[i + 1];

    // 如果方向改变，保留这个点
    const dirX1 = curr.x - prev.x;
    const dirY1 = curr.y - prev.y;
    const dirX2 = next.x - curr.x;
    const dirY2 = next.y - curr.y;

    if (dirX1 !== dirX2 || dirY1 !== dirY2) {
      simplified.push(curr);
    }
  }

  simplified.push(path[path.length - 1]);

  return simplified;
}

/**
 * 检查两点之间是否有直线路径
 * 
 * @param start 起点
 * @param end 终点
 * @param walkableMap 可行走地图
 * @returns 是否有直线路径
 */
export function hasDirectPath(
  start: GridPosition,
  end: GridPosition,
  walkableMap: number[][]
): boolean {
  // 使用 Bresenham 直线算法检查
  let x0 = Math.floor(start.x);
  let y0 = Math.floor(start.y);
  const x1 = Math.floor(end.x);
  const y1 = Math.floor(end.y);

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (x0 !== x1 || y0 !== y1) {
    if (!isWalkable({ x: x0, y: y0 }, walkableMap)) {
      return false;
    }

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }

  return true;
}

/**
 * 获取两点之间的直线点列表
 * 
 * @param start 起点
 * @param end 终点
 * @returns 直线上的点列表
 */
export function getLinePoints(start: GridPosition, end: GridPosition): GridPosition[] {
  const points: GridPosition[] = [];
  
  let x0 = Math.floor(start.x);
  let y0 = Math.floor(start.y);
  const x1 = Math.floor(end.x);
  const y1 = Math.floor(end.y);

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    points.push({ x: x0, y: y0 });

    if (x0 === x1 && y0 === y1) {
      break;
    }

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }

  return points;
}

/**
 * 计算路径总长度
 * 
 * @param path 路径
 * @returns 总长度
 */
export function getPathLength(path: GridPosition[]): number {
  if (path.length <= 1) {
    return 0;
  }

  let length = 0;
  for (let i = 1; i < path.length; i++) {
    length += euclideanDistance(path[i - 1], path[i]);
  }

  return length;
}

/**
 * 在路径上获取指定距离的点
 * 
 * @param path 路径
 * @param distance 距离（从起点开始）
 * @returns 对应的点
 */
export function getPointAtDistance(path: GridPosition[], distance: number): GridPosition | null {
  if (path.length === 0 || distance <= 0) {
    return path[0] || null;
  }

  let traveled = 0;

  for (let i = 1; i < path.length; i++) {
    const segmentLength = euclideanDistance(path[i - 1], path[i]);

    if (traveled + segmentLength >= distance) {
      // 在这个线段上
      const ratio = (distance - traveled) / segmentLength;
      return {
        x: path[i - 1].x + (path[i].x - path[i - 1].x) * ratio,
        y: path[i - 1].y + (path[i].y - path[i - 1].y) * ratio
      };
    }

    traveled += segmentLength;
  }

  // 返回终点
  return path[path.length - 1];
}
