export enum CellType {
  EMPTY = 0,
  WALL = 1,
  FLOOR = 2,
  GOAL = 3,
  HAZARD = 4,
  SPAWN = 5,
  SPECIAL = 6,
  ICE = 7,
  PORTAL = 8,
}

export interface GridPoint {
  gridX: number;
  gridY: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

const DIRS_4: readonly GridPoint[] = [
  { gridX: 0, gridY: -1 },
  { gridX: 1, gridY: 0 },
  { gridX: 0, gridY: 1 },
  { gridX: -1, gridY: 0 },
];

const DIRS_8: readonly GridPoint[] = [
  { gridX: 0, gridY: -1 },
  { gridX: 1, gridY: -1 },
  { gridX: 1, gridY: 0 },
  { gridX: 1, gridY: 1 },
  { gridX: 0, gridY: 1 },
  { gridX: -1, gridY: 1 },
  { gridX: -1, gridY: 0 },
  { gridX: -1, gridY: -1 },
];

const DIRECTION_DELTAS: Record<Direction, GridPoint> = {
  up: { gridX: 0, gridY: -1 },
  down: { gridX: 0, gridY: 1 },
  left: { gridX: -1, gridY: 0 },
  right: { gridX: 1, gridY: 0 },
};

export function gridToWorld(
  gridX: number,
  gridY: number,
  cellSize: number,
  offsetX: number = 0,
  offsetY: number = 0,
): { x: number; y: number } {
  return {
    x: offsetX + gridX * cellSize + cellSize / 2,
    y: offsetY + gridY * cellSize + cellSize / 2,
  };
}

export function worldToGrid(
  worldX: number,
  worldY: number,
  cellSize: number,
  offsetX: number = 0,
  offsetY: number = 0,
): GridPoint {
  return {
    gridX: Math.floor((worldX - offsetX) / cellSize),
    gridY: Math.floor((worldY - offsetY) / cellSize),
  };
}

export function isInBounds(
  gridX: number,
  gridY: number,
  width: number,
  height: number,
): boolean {
  return gridX >= 0 && gridX < width && gridY >= 0 && gridY < height;
}

export function getNeighbors(
  gridX: number,
  gridY: number,
  width: number,
  height: number,
  mode: '4-dir' | '8-dir' = '4-dir',
): GridPoint[] {
  const dirs = mode === '4-dir' ? DIRS_4 : DIRS_8;
  const result: GridPoint[] = [];
  for (const d of dirs) {
    const nx = gridX + d.gridX;
    const ny = gridY + d.gridY;
    if (isInBounds(nx, ny, width, height)) {
      result.push({ gridX: nx, gridY: ny });
    }
  }
  return result;
}

export function getDirection(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): Direction | null {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (dx === 0 && dy === -1) return 'up';
  if (dx === 0 && dy === 1) return 'down';
  if (dx === -1 && dy === 0) return 'left';
  if (dx === 1 && dy === 0) return 'right';
  return null;
}

export function getDirectionDelta(direction: Direction): GridPoint {
  return DIRECTION_DELTAS[direction];
}

export function getCellsInDirection(
  startX: number,
  startY: number,
  direction: Direction,
  range: number,
  width: number,
  height: number,
): GridPoint[] {
  const delta = DIRECTION_DELTAS[direction];
  const result: GridPoint[] = [];
  for (let i = 1; i <= range; i++) {
    const nx = startX + delta.gridX * i;
    const ny = startY + delta.gridY * i;
    if (!isInBounds(nx, ny, width, height)) break;
    result.push({ gridX: nx, gridY: ny });
  }
  return result;
}

export function getCellsInRadius(
  centerX: number,
  centerY: number,
  radius: number,
  width: number,
  height: number,
): GridPoint[] {
  const result: GridPoint[] = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      if (dx === 0 && dy === 0) continue;
      if (Math.abs(dx) + Math.abs(dy) > radius) continue;
      const nx = centerX + dx;
      const ny = centerY + dy;
      if (isInBounds(nx, ny, width, height)) {
        result.push({ gridX: nx, gridY: ny });
      }
    }
  }
  return result;
}

export function manhattanDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

export function chebyshevDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

export function getReachableCells(
  startX: number,
  startY: number,
  maxRange: number,
  width: number,
  height: number,
  isWalkable: (x: number, y: number) => boolean,
  mode: '4-dir' | '8-dir' = '4-dir',
): GridPoint[] {
  const visited = new Set<string>();
  const result: GridPoint[] = [];
  const queue: { x: number; y: number; dist: number }[] = [
    { x: startX, y: startY, dist: 0 },
  ];
  const key = (x: number, y: number) => `${x},${y}`;
  visited.add(key(startX, startY));

  while (queue.length > 0) {
    const { x, y, dist } = queue.shift()!;
    result.push({ gridX: x, gridY: y });

    if (dist >= maxRange) continue;

    for (const n of getNeighbors(x, y, width, height, mode)) {
      const nk = key(n.gridX, n.gridY);
      if (!visited.has(nk) && isWalkable(n.gridX, n.gridY)) {
        visited.add(nk);
        queue.push({ x: n.gridX, y: n.gridY, dist: dist + 1 });
      }
    }
  }

  return result;
}

export function findPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  width: number,
  height: number,
  isWalkable: (x: number, y: number) => boolean,
  mode: '4-dir' | '8-dir' = '4-dir',
): GridPoint[] {
  if (
    !isInBounds(startX, startY, width, height) ||
    !isInBounds(endX, endY, width, height)
  ) {
    return [];
  }

  const key = (x: number, y: number) => `${x},${y}`;
  const openSet = new Map<
    string,
    { x: number; y: number; g: number; f: number }
  >();
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  const heuristic = mode === '4-dir' ? manhattanDistance : chebyshevDistance;
  const startKey = key(startX, startY);
  const endKey = key(endX, endY);
  const h = heuristic(startX, startY, endX, endY);
  openSet.set(startKey, { x: startX, y: startY, g: 0, f: h });
  gScore.set(startKey, 0);

  while (openSet.size > 0) {
    let currentKey = '';
    let currentNode: { x: number; y: number; g: number; f: number } | null =
      null;
    for (const [k, node] of openSet) {
      if (!currentNode || node.f < currentNode.f) {
        currentKey = k;
        currentNode = node;
      }
    }
    if (!currentNode) break;
    if (currentKey === endKey) {
      return tracePath(cameFrom, endKey);
    }

    openSet.delete(currentKey);
    for (const n of getNeighbors(
      currentNode.x,
      currentNode.y,
      width,
      height,
      mode,
    )) {
      if (
        !isWalkable(n.gridX, n.gridY) &&
        !(n.gridX === endX && n.gridY === endY)
      ) {
        continue;
      }

      const nk = key(n.gridX, n.gridY);
      const tentativeG = currentNode.g + 1;
      const existingG = gScore.get(nk);

      if (existingG === undefined || tentativeG < existingG) {
        cameFrom.set(nk, currentKey);
        gScore.set(nk, tentativeG);
        const f = tentativeG + heuristic(n.gridX, n.gridY, endX, endY);
        openSet.set(nk, { x: n.gridX, y: n.gridY, g: tentativeG, f });
      }
    }
  }

  return [];
}

export function floodFill(
  startX: number,
  startY: number,
  width: number,
  height: number,
  predicate: (x: number, y: number) => boolean,
  mode: '4-dir' | '8-dir' = '4-dir',
): GridPoint[] {
  if (
    !isInBounds(startX, startY, width, height) ||
    !predicate(startX, startY)
  ) {
    return [];
  }

  const visited = new Set<string>();
  const result: GridPoint[] = [];
  const queue: GridPoint[] = [{ gridX: startX, gridY: startY }];
  const key = (x: number, y: number) => `${x},${y}`;
  visited.add(key(startX, startY));

  while (queue.length > 0) {
    const { gridX: x, gridY: y } = queue.shift()!;
    result.push({ gridX: x, gridY: y });

    for (const n of getNeighbors(x, y, width, height, mode)) {
      const nk = key(n.gridX, n.gridY);
      if (!visited.has(nk) && predicate(n.gridX, n.gridY)) {
        visited.add(nk);
        queue.push(n);
      }
    }
  }

  return result;
}

export function getLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): GridPoint[] {
  const points: GridPoint[] = [];
  let dx = Math.abs(x2 - x1);
  let dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  let cx = x1;
  let cy = y1;

  while (true) {
    points.push({ gridX: cx, gridY: cy });
    if (cx === x2 && cy === y2) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }

  return points;
}

export function hasLineOfSight(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  isTransparent: (x: number, y: number) => boolean,
): boolean {
  const line = getLine(x1, y1, x2, y2);
  for (let i = 1; i < line.length - 1; i++) {
    if (!isTransparent(line[i].gridX, line[i].gridY)) {
      return false;
    }
  }
  return true;
}

export function findMatches(
  cells: number[][],
  width: number,
  height: number,
  minMatchLength: number = 3,
): GridPoint[][] {
  const matches: GridPoint[][] = [];
  const inMatch = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;

  for (let y = 0; y < height; y++) {
    let runStart = 0;
    for (let x = 1; x <= width; x++) {
      if (
        x < width &&
        cells[y][x] === cells[y][runStart] &&
        cells[y][x] !== 0
      ) {
        continue;
      }
      const runLen = x - runStart;
      if (runLen >= minMatchLength) {
        const group: GridPoint[] = [];
        for (let i = runStart; i < x; i++) {
          group.push({ gridX: i, gridY: y });
          inMatch.add(key(i, y));
        }
        matches.push(group);
      }
      runStart = x;
    }
  }

  for (let x = 0; x < width; x++) {
    let runStart = 0;
    for (let y = 1; y <= height; y++) {
      if (
        y < height &&
        cells[y][x] === cells[runStart][x] &&
        cells[y][x] !== 0
      ) {
        continue;
      }
      const runLen = y - runStart;
      if (runLen >= minMatchLength) {
        const group: GridPoint[] = [];
        for (let i = runStart; i < y; i++) {
          group.push({ gridX: x, gridY: i });
          inMatch.add(key(x, i));
        }
        matches.push(group);
      }
      runStart = y;
    }
  }

  return matches;
}

function tracePath(cameFrom: Map<string, string>, endKey: string): GridPoint[] {
  const path: GridPoint[] = [];
  let traceKey: string | undefined = endKey;
  while (traceKey) {
    const [px, py] = traceKey.split(',').map(Number);
    path.unshift({ gridX: px, gridY: py });
    traceKey = cameFrom.get(traceKey);
  }
  return path;
}
