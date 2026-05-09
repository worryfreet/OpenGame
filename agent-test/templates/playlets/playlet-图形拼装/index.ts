import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-图形拼装';
export const playletTitle = '图形拼装';

interface ShapePiece {
  id: string;
  label: string;
  shape: 'rect' | 'circle' | 'triangle';
  color: number;
}

interface ShapeSlot {
  id: string;
  label: string;
  accepts: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hint?: string;
}

export class PlayletScene extends BasePlayletScene {
  private readonly assignments = new Map<string, string>();
  private selectedPieceId?: string;
  private attempts = 0;
  private feedbackText?: Phaser.GameObjects.Text;
  private pieceCards: Array<{
    piece: ShapePiece;
    card: Phaser.GameObjects.Text;
  }> = [];
  private slotCards: Array<{ slot: ShapeSlot; card: Phaser.GameObjects.Text }> =
    [];

  constructor() {
    super('图形拼装PlayletScene');
  }

  create(): void {
    const cam = this.cameras.main;
    const config = normalizeConfig(this.node.config);
    this.setRuntimeStatus('playlet', this.scene.key);
    this.add.rectangle(
      cam.width / 2,
      cam.height / 2,
      cam.width,
      cam.height,
      0x312e81,
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
      .text(cam.width * 0.24, 94, '零件', headingStyle())
      .setOrigin(0.5);
    this.add
      .text(cam.width * 0.66, 94, config.targetTitle, headingStyle())
      .setOrigin(0.5);
    this.renderTargetArea();
    config.slots.forEach((slot) => this.renderSlot(slot));
    config.pieces.forEach((piece, index) => this.renderPiece(piece, index));
    this.renderSubmitButton();
    this.feedbackText = this.add
      .text(cam.width / 2, cam.height - 52, config.successCriteria, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ddd6fe',
        align: 'center',
        wordWrap: { width: Math.min(760, cam.width - 80) },
      })
      .setOrigin(0.5);
  }

  private renderTargetArea(): void {
    const cam = this.cameras.main;
    this.add
      .rectangle(cam.width * 0.66, cam.height * 0.47, 360, 280, 0x1e1b4b)
      .setStrokeStyle(2, 0xa78bfa);
  }

  private renderPiece(piece: ShapePiece, index: number): void {
    const cam = this.cameras.main;
    const y = 142 + index * 72;
    this.drawShape(cam.width * 0.13, y, piece.shape, piece.color, 36, 34);
    const card = this.add
      .text(cam.width * 0.26, y, piece.label, pieceStyle(false))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    card.on('pointerdown', () => this.selectPiece(piece, card));
    this.pieceCards.push({ piece, card });
  }

  private renderSlot(slot: ShapeSlot): void {
    const cam = this.cameras.main;
    const x = cam.width * slot.x;
    const y = cam.height * slot.y;
    this.add
      .rectangle(x, y, slot.width, slot.height, 0x4c1d95, 0.7)
      .setStrokeStyle(2, 0xc4b5fd);
    const card = this.add
      .text(x, y, slot.label, slotStyle(false))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    card.on('pointerdown', () => this.assignSlot(slot, card));
    this.slotCards.push({ slot, card });
  }

  private renderSubmitButton(): void {
    const cam = this.cameras.main;
    this.add
      .text(cam.width / 2, cam.height - 116, '提交拼装', buttonStyle())
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.submit());
  }

  private selectPiece(
    piece: ShapePiece,
    card: Phaser.GameObjects.Text,
  ): void {
    this.selectedPieceId = piece.id;
    this.pieceCards.forEach((entry) => {
      entry.card.setStyle(pieceStyle(entry.piece.id === piece.id));
    });
    card.setStyle(pieceStyle(true));
    this.showFeedback(`已选择「${piece.label}」，请选择目标轮廓。`);
  }

  private assignSlot(slot: ShapeSlot, card: Phaser.GameObjects.Text): void {
    if (!this.selectedPieceId) {
      this.showFeedback('请先选择左侧图形零件。');
      return;
    }
    const piece = this.pieceCards.find(
      (entry) => entry.piece.id === this.selectedPieceId,
    )?.piece;
    if (!piece) return;
    this.assignments.set(slot.id, piece.id);
    card.setText(`${slot.label}\n${piece.label}`);
    card.setStyle(slotStyle(true));
    this.drawShape(card.x, card.y - 4, piece.shape, piece.color, 28, 24);
    this.selectedPieceId = undefined;
    this.pieceCards.forEach((entry) => entry.card.setStyle(pieceStyle(false)));
    this.showFeedback(`已把「${piece.label}」装入「${slot.label}」。`);
  }

  private submit(): void {
    this.attempts += 1;
    let correct = 0;
    for (const { slot, card } of this.slotCards) {
      const assigned = this.assignments.get(slot.id);
      const isCorrect = assigned === slot.accepts;
      if (isCorrect) correct += 1;
      card.setStyle(slotStyle(Boolean(assigned), isCorrect));
    }
    if (correct === this.slotCards.length) {
      this.finish('success', {
        attempts: this.attempts,
        evidence: [
          `${playletId}:shape:${[...this.assignments.entries()]
            .map(([slotId, pieceId]) => `${slotId}=${pieceId}`)
            .join('|')}`,
        ],
      });
      return;
    }
    const firstWrong = this.slotCards.find(
      ({ slot }) => this.assignments.get(slot.id) !== slot.accepts,
    );
    this.showFeedback(
      firstWrong?.slot.hint ??
        `当前 ${correct}/${this.slotCards.length} 个轮廓正确，红色轮廓需要重放。`,
    );
  }

  private drawShape(
    x: number,
    y: number,
    shape: ShapePiece['shape'],
    color: number,
    width: number,
    height: number,
  ): void {
    if (shape === 'circle') {
      this.add.circle(x, y, Math.min(width, height) / 2, color);
      return;
    }
    if (shape === 'triangle') {
      this.add.triangle(x, y, 0, height, width / 2, 0, width, height, color);
      return;
    }
    this.add.rectangle(x, y, width, height, color);
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  targetTitle: string;
  successCriteria: string;
  pieces: ShapePiece[];
  slots: ShapeSlot[];
} {
  const pieces = readArray(config.pieces ?? config.items)
    .map(normalizePiece)
    .filter(Boolean) as ShapePiece[];
  const slots = readArray(config.slots ?? config.targets)
    .map(normalizeSlot)
    .filter(Boolean) as ShapeSlot[];
  if (pieces.length > 0 && slots.length > 0) {
    return {
      prompt: readString(config.prompt, '请把图形零件拼到正确轮廓里。'),
      targetTitle: readString(config.targetTitle, '目标图形'),
      successCriteria: readString(
        config.successCriteria,
        '每个零件都需要匹配形状、位置或含义。',
      ),
      pieces,
      slots,
    };
  }
  return {
    prompt: readString(config.prompt, '请把图形零件拼到正确轮廓里。'),
    targetTitle: readString(config.targetTitle, '面积模型'),
    successCriteria: readString(config.successCriteria, '拼出完整的长方形面积模型。'),
    pieces: [
      { id: 'rect_long', label: '长条矩形', shape: 'rect', color: 0x38bdf8 },
      { id: 'rect_small', label: '小矩形', shape: 'rect', color: 0xfacc15 },
      { id: 'marker', label: '单位标记', shape: 'circle', color: 0x86efac },
    ],
    slots: [
      {
        id: 'slot_a',
        label: '主体区域',
        accepts: 'rect_long',
        x: 0.62,
        y: 0.42,
        width: 150,
        height: 72,
      },
      {
        id: 'slot_b',
        label: '补充区域',
        accepts: 'rect_small',
        x: 0.73,
        y: 0.56,
        width: 120,
        height: 62,
      },
      {
        id: 'slot_c',
        label: '单位标记',
        accepts: 'marker',
        x: 0.58,
        y: 0.62,
        width: 104,
        height: 52,
      },
    ],
  };
}

function normalizePiece(value: unknown): ShapePiece | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const id = readString(item.id, '');
  const label = readString(item.label, '');
  if (!id || !label) return undefined;
  return {
    id,
    label,
    shape: readShape(item.shape),
    color: readColor(item.color, 0x38bdf8),
  };
}

function normalizeSlot(value: unknown): ShapeSlot | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const id = readString(item.id, '');
  const label = readString(item.label, '');
  const accepts = readString(item.accepts ?? item.answer ?? item.pieceId, '');
  if (!id || !label || !accepts) return undefined;
  return {
    id,
    label,
    accepts,
    x: clamp(readNumber(item.x, 0.66), 0.35, 0.88),
    y: clamp(readNumber(item.y, 0.48), 0.2, 0.75),
    width: readNumber(item.width, 120),
    height: readNumber(item.height, 62),
    hint: readString(item.hint, ''),
  };
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readShape(value: unknown): ShapePiece['shape'] {
  return value === 'circle' || value === 'triangle' || value === 'rect'
    ? value
    : 'rect';
}

function readColor(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^#?[0-9a-f]{6}$/i.test(value)) {
    return Number.parseInt(value.replace('#', ''), 16);
  }
  return fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function headingStyle(): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '20px',
    color: '#ddd6fe',
  };
}

function pieceStyle(selected: boolean): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '18px',
    color: '#111827',
    backgroundColor: selected ? '#fde68a' : '#f8fafc',
    padding: { left: 16, right: 16, top: 12, bottom: 12 },
    fixedWidth: 160,
    align: 'center',
  };
}

function slotStyle(
  filled: boolean,
  correct = true,
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '16px',
    color: '#111827',
    backgroundColor: !filled ? '#ede9fe' : correct ? '#86efac' : '#fca5a5',
    padding: { left: 10, right: 10, top: 8, bottom: 8 },
    fixedWidth: 118,
    align: 'center',
  };
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
