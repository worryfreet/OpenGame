import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-拖拽分箱';
export const playletTitle = '拖拽分箱';

interface BinItem {
  id: string;
  label: string;
  binId: string;
  explanation?: string;
}

interface BinConfig {
  id: string;
  label: string;
}

export class PlayletScene extends BasePlayletScene {
  private readonly placements = new Map<string, string>();
  private readonly itemSprites = new Map<string, Phaser.GameObjects.Text>();
  private readonly binZones = new Map<string, Phaser.Geom.Rectangle>();
  private attempts = 0;
  private feedbackText?: Phaser.GameObjects.Text;
  private items: BinItem[] = [];

  constructor() {
    super('拖拽分箱PlayletScene');
  }

  create(): void {
    const cam = this.cameras.main;
    const config = normalizeConfig(this.node.config);
    this.items = config.items;
    this.setRuntimeStatus('playlet', this.scene.key);
    this.add.rectangle(
      cam.width / 2,
      cam.height / 2,
      cam.width,
      cam.height,
      0x1d3a2f,
    );
    this.add
      .text(cam.width / 2, 48, config.prompt, {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: Math.min(760, cam.width - 80) },
      })
      .setOrigin(0.5);

    this.renderBins(config.bins);
    this.renderItems(config.items);
    this.feedbackText = this.add
      .text(
        cam.width / 2,
        cam.height - 50,
        '把每张卡拖进正确分箱，全部放好后会自动检查。',
        {
          fontFamily: 'Arial',
          fontSize: '18px',
          color: '#dcfce7',
          align: 'center',
          wordWrap: { width: Math.min(720, cam.width - 80) },
        },
      )
      .setOrigin(0.5);
  }

  private renderBins(bins: BinConfig[]): void {
    const cam = this.cameras.main;
    const gap = 36;
    const width = Math.min(
      250,
      (cam.width - 120 - gap * (bins.length - 1)) / bins.length,
    );
    bins.forEach((bin, index) => {
      const x = 60 + width / 2 + index * (width + gap);
      const rect = new Phaser.Geom.Rectangle(x - width / 2, 118, width, 168);
      this.binZones.set(bin.id, rect);
      this.add
        .rectangle(x, 202, width, 168, 0xf8fafc, 0.94)
        .setStrokeStyle(3, 0x86efac);
      this.add
        .text(x, 132, bin.label, {
          fontFamily: 'Arial',
          fontSize: '20px',
          color: '#14532d',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
    });
  }

  private renderItems(items: BinItem[]): void {
    const startX = 150;
    const startY = 370;
    items.forEach((item, index) => {
      const x = startX + (index % 3) * 250;
      const y = startY + Math.floor(index / 3) * 74;
      const sprite = this.add
        .text(x, y, item.label, cardStyle(0xfef3c7, '#111827'))
        .setOrigin(0.5)
        .setInteractive({ draggable: true, useHandCursor: true });
      this.input.setDraggable(sprite);
      sprite.on(
        'drag',
        (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
          sprite.setPosition(dragX, dragY);
        },
      );
      sprite.on('dragend', () => this.placeItem(item, sprite));
      this.itemSprites.set(item.id, sprite);
    });
  }

  private placeItem(item: BinItem, sprite: Phaser.GameObjects.Text): void {
    const binId = this.findBinAt(sprite.x, sprite.y);
    if (!binId) {
      this.showFeedback('还没有放入分箱，把卡片拖到上方区域。');
      return;
    }
    this.placements.set(item.id, binId);
    const rect = this.binZones.get(binId)!;
    const placedInBin = [...this.placements.values()].filter(
      (id) => id === binId,
    ).length;
    sprite.setPosition(rect.centerX, rect.y + 72 + placedInBin * 34);
    sprite.setStyle(
      cardStyle(binId === item.binId ? 0xbbf7d0 : 0xfca5a5, '#111827'),
    );
    this.showFeedback(`「${item.label}」已放入分箱，继续处理剩余卡片。`);
    if (this.placements.size === this.items.length) {
      this.finishIfComplete();
    }
  }

  private finishIfComplete(): void {
    this.attempts += 1;
    const correct = this.items.filter(
      (item) => this.placements.get(item.id) === item.binId,
    ).length;
    if (correct === this.items.length) {
      this.finish('success', {
        attempts: this.attempts,
        evidence: [`${playletId}:classified:${correct}/${this.items.length}`],
      });
      return;
    }
    this.showFeedback(
      `当前正确 ${correct}/${this.items.length}，红色卡片需要重新分类。`,
    );
  }

  private findBinAt(x: number, y: number): string | undefined {
    for (const [binId, rect] of this.binZones) {
      if (Phaser.Geom.Rectangle.Contains(rect, x, y)) return binId;
    }
    return undefined;
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  bins: BinConfig[];
  items: BinItem[];
} {
  const prompt = readString(config.prompt, '请把卡片拖入正确分箱。');
  const bins = readArray(config.bins)
    .map(normalizeBin)
    .filter(Boolean) as BinConfig[];
  const items = readArray(config.items)
    .map(normalizeItem)
    .filter(Boolean) as BinItem[];
  if (bins.length > 0 && items.length > 0) return { prompt, bins, items };
  return {
    prompt,
    bins: [
      { id: 'producer', label: '生产者' },
      { id: 'consumer', label: '消费者' },
    ],
    items: [
      { id: 'grass', label: '草', binId: 'producer' },
      { id: 'rabbit', label: '兔子', binId: 'consumer' },
    ],
  };
}

function normalizeBin(value: unknown): BinConfig | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const bin = value as Record<string, unknown>;
  const id = readString(bin.id, '');
  const label = readString(bin.label, '');
  return id && label ? { id, label } : undefined;
}

function normalizeItem(value: unknown): BinItem | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const id = readString(item.id, '');
  const label = readString(item.label, '');
  const binId = readString(item.binId, readString(item.categoryId, ''));
  if (!id || !label || !binId) return undefined;
  return {
    id,
    label,
    binId,
    explanation: readString(item.explanation, ''),
  };
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function cardStyle(
  backgroundColor: number,
  color: string,
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '17px',
    color,
    backgroundColor: `#${backgroundColor.toString(16).padStart(6, '0')}`,
    padding: { left: 16, right: 16, top: 10, bottom: 10 },
    fixedWidth: 190,
    align: 'center',
    wordWrap: { width: 160 },
  };
}
