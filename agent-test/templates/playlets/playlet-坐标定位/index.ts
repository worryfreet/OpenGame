import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-坐标定位';
export const playletTitle = '坐标定位';

interface CoordinateTarget {
  id: string;
  label: string;
  x: number;
  y: number;
  hint?: string;
}

interface GridConfig {
  columns: number;
  rows: number;
}

export class PlayletScene extends BasePlayletScene {
  private readonly selectedKeys = new Set<string>();
  private attempts = 0;
  private feedbackText?: Phaser.GameObjects.Text;
  private cells: Array<{
    key: string;
    rect: Phaser.GameObjects.Rectangle;
  }> = [];
  private targets: CoordinateTarget[] = [];

  constructor() {
    super('坐标定位PlayletScene');
  }

  create(): void {
    const cam = this.cameras.main;
    const config = normalizeConfig(this.node.config);
    this.targets = config.targets;
    this.setRuntimeStatus('playlet', this.scene.key);
    this.add.rectangle(
      cam.width / 2,
      cam.height / 2,
      cam.width,
      cam.height,
      0x18233f,
    );
    this.add
      .text(cam.width / 2, 42, config.prompt, {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: Math.min(760, cam.width - 80) },
      })
      .setOrigin(0.5);
    this.add
      .text(cam.width / 2, 82, config.targetSummary, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#bfdbfe',
        align: 'center',
        wordWrap: { width: Math.min(720, cam.width - 80) },
      })
      .setOrigin(0.5);

    this.renderGrid(config.grid);
    this.renderSubmitButton();
    this.feedbackText = this.add
      .text(cam.width / 2, cam.height - 52, config.successCriteria, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#dbeafe',
        align: 'center',
        wordWrap: { width: Math.min(760, cam.width - 80) },
      })
      .setOrigin(0.5);
  }

  private renderGrid(grid: GridConfig): void {
    const cam = this.cameras.main;
    const size = Math.min(360, cam.height - 220, cam.width - 220);
    const cellSize = size / Math.max(grid.columns, grid.rows);
    const startX = cam.width / 2 - (grid.columns * cellSize) / 2;
    const startY = 124;

    for (let row = 1; row <= grid.rows; row += 1) {
      for (let col = 1; col <= grid.columns; col += 1) {
        const key = cellKey(col, row);
        const x = startX + (col - 0.5) * cellSize;
        const y = startY + (row - 0.5) * cellSize;
        const rect = this.add
          .rectangle(x, y, cellSize - 4, cellSize - 4, 0xf8fafc)
          .setStrokeStyle(2, 0x93c5fd)
          .setInteractive({ useHandCursor: true });
        rect.on('pointerdown', () => this.toggleCell(key, rect));
        this.add
          .text(x, y, `${col},${row}`, {
            fontFamily: 'Arial',
            fontSize: '14px',
            color: '#1e3a8a',
          })
          .setOrigin(0.5);
        this.cells.push({ key, rect });
      }
    }
  }

  private renderSubmitButton(): void {
    const cam = this.cameras.main;
    this.add
      .text(cam.width / 2, cam.height - 116, '提交坐标', buttonStyle())
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.submit());
  }

  private toggleCell(key: string, rect: Phaser.GameObjects.Rectangle): void {
    if (this.selectedKeys.has(key)) {
      this.selectedKeys.delete(key);
      rect.setFillStyle(0xf8fafc);
      rect.setStrokeStyle(2, 0x93c5fd);
      this.showFeedback(`已取消坐标 (${key})。`);
      return;
    }
    this.selectedKeys.add(key);
    rect.setFillStyle(0xfde68a);
    rect.setStrokeStyle(3, 0xfacc15);
    this.showFeedback(`已选择坐标 (${key})。`);
  }

  private submit(): void {
    this.attempts += 1;
    const targetKeys = new Set(
      this.targets.map((target) => cellKey(target.x, target.y)),
    );
    let correct = 0;
    for (const cell of this.cells) {
      const selected = this.selectedKeys.has(cell.key);
      const shouldSelect = targetKeys.has(cell.key);
      const isCorrect = selected === shouldSelect;
      if (isCorrect) correct += 1;
      cell.rect.setFillStyle(cellFill(selected, isCorrect));
      cell.rect.setStrokeStyle(selected ? 3 : 2, cellStroke(isCorrect));
    }

    if (correct === this.cells.length) {
      this.finish('success', {
        attempts: this.attempts,
        evidence: [`${playletId}:coordinates:${[...targetKeys].join('|')}`],
      });
      return;
    }

    const missed = this.targets.find(
      (target) => !this.selectedKeys.has(cellKey(target.x, target.y)),
    );
    this.showFeedback(
      missed?.hint ??
        `当前 ${correct}/${this.cells.length} 个坐标判断正确，红色格子需要调整。`,
    );
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  targetSummary: string;
  successCriteria: string;
  grid: GridConfig;
  targets: CoordinateTarget[];
} {
  const prompt = readString(config.prompt, '请在坐标网格中定位目标点。');
  const grid = normalizeGrid(config.grid);
  const targets = readArray(config.targets ?? config.items)
    .map(normalizeTarget)
    .filter(Boolean) as CoordinateTarget[];
  const normalizedTargets =
    targets.length > 0
      ? targets
      : [
          {
            id: 'area_point',
            label: '面积公式起点',
            x: 3,
            y: 2,
            hint: '先横向找到 3，再纵向找到 2。',
          },
        ];
  const targetSummary = readString(
    config.targetSummary,
    `目标：${normalizedTargets
      .map((target) => `${target.label} (${target.x},${target.y})`)
      .join('、')}`,
  );
  return {
    prompt,
    targetSummary,
    successCriteria: readString(config.successCriteria, '点选所有目标坐标。'),
    grid,
    targets: normalizedTargets,
  };
}

function normalizeGrid(value: unknown): GridConfig {
  if (!value || typeof value !== 'object') {
    return { columns: 5, rows: 4 };
  }
  const grid = value as Record<string, unknown>;
  return {
    columns: clampInt(grid.columns ?? grid.cols, 5),
    rows: clampInt(grid.rows, 4),
  };
}

function normalizeTarget(value: unknown): CoordinateTarget | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const id = readString(item.id, '');
  const label = readString(item.label, '');
  const x = readNumber(item.x, Number.NaN);
  const y = readNumber(item.y, Number.NaN);
  if (!id || !label || Number.isNaN(x) || Number.isNaN(y)) return undefined;
  return {
    id,
    label,
    x,
    y,
    hint: readString(item.hint, ''),
  };
}

function cellKey(x: number, y: number): string {
  return `${Math.round(x)},${Math.round(y)}`;
}

function cellFill(selected: boolean, correct: boolean): number {
  if (correct && selected) return 0xbbf7d0;
  if (!correct) return 0xfca5a5;
  return selected ? 0xfde68a : 0xf8fafc;
}

function cellStroke(correct: boolean): number {
  return correct ? 0x16a34a : 0xdc2626;
}

function clampInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(2, Math.min(8, Math.round(value)));
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
