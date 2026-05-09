import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-迷宫寻路';
export const playletTitle = '迷宫寻路';

interface MazeCell {
  x: number;
  y: number;
}

interface MazeConfig {
  columns: number;
  rows: number;
  start: MazeCell;
  end: MazeCell;
  walls: MazeCell[];
  checkpoints: MazeCell[];
  expectedPath: MazeCell[];
}

export class PlayletScene extends BasePlayletScene {
  private readonly selectedKeys = new Set<string>();
  private readonly cellRects = new Map<string, Phaser.GameObjects.Rectangle>();
  private attempts = 0;
  private feedbackText?: Phaser.GameObjects.Text;
  private config!: MazeConfig;

  constructor() {
    super('迷宫寻路PlayletScene');
  }

  create(): void {
    const cam = this.cameras.main;
    const normalized = normalizeConfig(this.node.config);
    this.config = normalized.maze;
    this.setRuntimeStatus('playlet', this.scene.key);
    this.add.rectangle(
      cam.width / 2,
      cam.height / 2,
      cam.width,
      cam.height,
      0x102a43,
    );
    this.add
      .text(cam.width / 2, 42, normalized.prompt, {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: Math.min(760, cam.width - 80) },
      })
      .setOrigin(0.5);
    this.add
      .text(cam.width / 2, 82, normalized.successCriteria, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#bfdbfe',
        align: 'center',
        wordWrap: { width: Math.min(720, cam.width - 80) },
      })
      .setOrigin(0.5);

    this.renderMaze();
    this.renderSubmitButton();
    this.feedbackText = this.add
      .text(cam.width / 2, cam.height - 52, '点选可通行格子，连通起点、检查点和终点。', {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#dbeafe',
        align: 'center',
        wordWrap: { width: Math.min(760, cam.width - 80) },
      })
      .setOrigin(0.5);
  }

  private renderMaze(): void {
    const cam = this.cameras.main;
    const maze = this.config;
    const size = Math.min(400, cam.height - 220, cam.width - 220);
    const cellSize = size / Math.max(maze.columns, maze.rows);
    const startX = cam.width / 2 - (maze.columns * cellSize) / 2;
    const startY = 118;
    const wallKeys = new Set(maze.walls.map(cellKey));
    const checkpointKeys = new Set(maze.checkpoints.map(cellKey));

    for (let row = 1; row <= maze.rows; row += 1) {
      for (let col = 1; col <= maze.columns; col += 1) {
        const cell = { x: col, y: row };
        const key = cellKey(cell);
        const x = startX + (col - 0.5) * cellSize;
        const y = startY + (row - 0.5) * cellSize;
        const fixedType = resolveFixedType(key, maze, wallKeys, checkpointKeys);
        const rect = this.add
          .rectangle(x, y, cellSize - 4, cellSize - 4, fixedFill(fixedType))
          .setStrokeStyle(2, fixedStroke(fixedType));
        this.cellRects.set(key, rect);
        if (fixedType !== 'wall') {
          rect
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.toggleCell(key, fixedType));
        }
        const label = fixedLabel(fixedType) || `${col},${row}`;
        this.add
          .text(x, y, label, {
            fontFamily: 'Arial',
            fontSize: fixedType ? '16px' : '12px',
            color: fixedType === 'wall' ? '#f8fafc' : '#0f172a',
          })
          .setOrigin(0.5);
      }
    }
  }

  private renderSubmitButton(): void {
    const cam = this.cameras.main;
    this.add
      .text(cam.width / 2, cam.height - 116, '提交路线', buttonStyle())
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.submit());
  }

  private toggleCell(key: string, fixedType: FixedCellType): void {
    if (fixedType === 'start' || fixedType === 'end' || fixedType === 'checkpoint') {
      this.showFeedback('起点、终点和检查点会自动计入路线。');
      return;
    }
    const rect = this.cellRects.get(key);
    if (!rect) return;
    if (this.selectedKeys.has(key)) {
      this.selectedKeys.delete(key);
      rect.setFillStyle(0xf8fafc);
      rect.setStrokeStyle(2, 0x93c5fd);
      this.showFeedback(`已移除路线格 (${key})。`);
      return;
    }
    this.selectedKeys.add(key);
    rect.setFillStyle(0xfde68a);
    rect.setStrokeStyle(3, 0xfacc15);
    this.showFeedback(`已加入路线格 (${key})。`);
  }

  private submit(): void {
    this.attempts += 1;
    const routeKeys = this.buildRouteKeys();
    const validation = validateRoute(this.config, routeKeys);
    this.paintRoute(routeKeys, validation.valid);
    if (validation.valid) {
      this.finish('success', {
        attempts: this.attempts,
        evidence: [`${playletId}:route:${[...routeKeys].sort().join('|')}`],
      });
      return;
    }
    this.showFeedback(validation.message);
  }

  private buildRouteKeys(): Set<string> {
    return new Set([
      ...this.selectedKeys,
      cellKey(this.config.start),
      cellKey(this.config.end),
      ...this.config.checkpoints.map(cellKey),
    ]);
  }

  private paintRoute(routeKeys: Set<string>, success: boolean): void {
    const wallKeys = new Set(this.config.walls.map(cellKey));
    const checkpointKeys = new Set(this.config.checkpoints.map(cellKey));
    for (const [key, rect] of this.cellRects) {
      const fixedType = resolveFixedType(key, this.config, wallKeys, checkpointKeys);
      if (fixedType) {
        rect.setFillStyle(fixedFill(fixedType));
        rect.setStrokeStyle(2, fixedStroke(fixedType));
        continue;
      }
      if (routeKeys.has(key)) {
        rect.setFillStyle(success ? 0xbbf7d0 : 0xfca5a5);
        rect.setStrokeStyle(3, success ? 0x16a34a : 0xdc2626);
      } else {
        rect.setFillStyle(0xf8fafc);
        rect.setStrokeStyle(2, 0x93c5fd);
      }
    }
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

type FixedCellType = 'start' | 'end' | 'wall' | 'checkpoint' | undefined;

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  successCriteria: string;
  maze: MazeConfig;
} {
  const prompt = readString(config.prompt, '请为迷宫规划一条可行路线。');
  const columns = clampInt(config.columns ?? config.cols, 5);
  const rows = clampInt(config.rows, 5);
  const start = normalizeCell(config.start) ?? { x: 1, y: 1 };
  const end = normalizeCell(config.end) ?? { x: columns, y: rows };
  const maze = {
    columns,
    rows,
    start,
    end,
    walls: readArray(config.walls).map((value) => normalizeCell(value)).filter(Boolean) as MazeCell[],
    checkpoints: readArray(config.checkpoints).map((value) => normalizeCell(value)).filter(Boolean) as MazeCell[],
    expectedPath: readArray(config.expectedPath ?? config.path)
      .map((value) => normalizeCell(value))
      .filter(Boolean) as MazeCell[],
  };
  if (maze.walls.length === 0 && maze.expectedPath.length === 0) {
    maze.walls = [
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 4, y: 3 },
      { x: 3, y: 4 },
    ];
    maze.checkpoints = [{ x: 3, y: 3 }];
    maze.expectedPath = [
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 1, y: 3 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
      { x: 5, y: 2 },
      { x: 5, y: 3 },
      { x: 5, y: 4 },
      { x: 5, y: 5 },
    ];
  }
  return {
    prompt,
    successCriteria: readString(config.successCriteria, '路线必须绕开障碍并连通关键点。'),
    maze,
  };
}

function validateRoute(
  maze: MazeConfig,
  routeKeys: Set<string>,
): { valid: boolean; message: string } {
  const wallKeys = new Set(maze.walls.map(cellKey));
  if ([...routeKeys].some((key) => wallKeys.has(key))) {
    return { valid: false, message: '路线穿过了障碍格，请绕开深色墙体。' };
  }
  const requiredKeys = [
    cellKey(maze.start),
    cellKey(maze.end),
    ...maze.checkpoints.map(cellKey),
    ...maze.expectedPath.map(cellKey),
  ];
  const missing = requiredKeys.find((key) => !routeKeys.has(key));
  if (missing) {
    return { valid: false, message: `路线还缺少关键格 (${missing})。` };
  }
  const reachable = collectReachable(cellKey(maze.start), routeKeys);
  if (!reachable.has(cellKey(maze.end))) {
    return { valid: false, message: '路线还没有从起点连续连接到终点。' };
  }
  const isolated = [...routeKeys].find((key) => !reachable.has(key));
  if (isolated) {
    return { valid: false, message: `路线格 (${isolated}) 没有与主路线相连。` };
  }
  return { valid: true, message: '路线正确。' };
}

function collectReachable(startKey: string, routeKeys: Set<string>): Set<string> {
  const visited = new Set<string>();
  const queue = [startKey];
  while (queue.length > 0) {
    const key = queue.shift();
    if (!key || visited.has(key) || !routeKeys.has(key)) continue;
    visited.add(key);
    for (const next of neighborKeys(key)) {
      if (routeKeys.has(next) && !visited.has(next)) queue.push(next);
    }
  }
  return visited;
}

function neighborKeys(key: string): string[] {
  const [x, y] = key.split(',').map((part) => Number.parseInt(part, 10));
  return [
    `${x + 1},${y}`,
    `${x - 1},${y}`,
    `${x},${y + 1}`,
    `${x},${y - 1}`,
  ];
}

function resolveFixedType(
  key: string,
  maze: MazeConfig,
  wallKeys: Set<string>,
  checkpointKeys: Set<string>,
): FixedCellType {
  if (key === cellKey(maze.start)) return 'start';
  if (key === cellKey(maze.end)) return 'end';
  if (wallKeys.has(key)) return 'wall';
  if (checkpointKeys.has(key)) return 'checkpoint';
  return undefined;
}

function fixedFill(type: FixedCellType): number {
  if (type === 'start') return 0x86efac;
  if (type === 'end') return 0xfda4af;
  if (type === 'wall') return 0x1e293b;
  if (type === 'checkpoint') return 0xc4b5fd;
  return 0xf8fafc;
}

function fixedStroke(type: FixedCellType): number {
  if (type === 'start') return 0x16a34a;
  if (type === 'end') return 0xe11d48;
  if (type === 'wall') return 0x475569;
  if (type === 'checkpoint') return 0x7c3aed;
  return 0x93c5fd;
}

function fixedLabel(type: FixedCellType): string {
  if (type === 'start') return '起';
  if (type === 'end') return '终';
  if (type === 'wall') return '墙';
  if (type === 'checkpoint') return '点';
  return '';
}

function normalizeCell(value: unknown): MazeCell | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const cell = value as Record<string, unknown>;
  const x = readNumber(cell.x, Number.NaN);
  const y = readNumber(cell.y, Number.NaN);
  if (Number.isNaN(x) || Number.isNaN(y)) return undefined;
  return { x: Math.round(x), y: Math.round(y) };
}

function cellKey(cell: MazeCell): string {
  return `${cell.x},${cell.y}`;
}

function clampInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(3, Math.min(8, Math.round(value)));
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function buttonStyle(): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '20px',
    color: '#111827',
    backgroundColor: '#facc15',
    padding: { left: 24, right: 24, top: 12, bottom: 12 },
  };
}
