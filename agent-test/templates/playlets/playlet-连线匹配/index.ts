import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-连线匹配';
export const playletTitle = '连线匹配';

interface LinkItem {
  id: string;
  label: string;
  pairId?: string;
  side?: 'left' | 'right';
  explanation?: string;
}

export class PlayletScene extends BasePlayletScene {
  private selectedLeftId?: string;
  private readonly matchedIds = new Set<string>();
  private attempts = 0;
  private feedbackText?: Phaser.GameObjects.Text;
  private lineLayer?: Phaser.GameObjects.Graphics;
  private leftCards: Array<{ item: LinkItem; card: Phaser.GameObjects.Text }> =
    [];
  private rightCards: Array<{ item: LinkItem; card: Phaser.GameObjects.Text }> =
    [];

  constructor() {
    super('连线匹配PlayletScene');
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
      0x152238,
    );
    this.lineLayer = this.add.graphics();
    this.add
      .text(cam.width / 2, 46, config.prompt, {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: Math.min(760, cam.width - 80) },
      })
      .setOrigin(0.5);

    this.renderColumn('左侧项目', config.leftItems, 178, true);
    this.renderColumn('右侧项目', config.rightItems, cam.width - 178, false);
    this.feedbackText = this.add
      .text(
        cam.width / 2,
        cam.height - 58,
        '先点左侧项目，再点右侧对应项完成连线。',
        {
          fontFamily: 'Arial',
          fontSize: '18px',
          color: '#dbeafe',
          align: 'center',
          wordWrap: { width: Math.min(720, cam.width - 80) },
        },
      )
      .setOrigin(0.5);
  }

  private renderColumn(
    title: string,
    items: LinkItem[],
    x: number,
    isLeft: boolean,
  ): void {
    this.add
      .text(x, 102, title, {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#bae6fd',
      })
      .setOrigin(0.5);
    items.forEach((item, index) => {
      const card = this.add
        .text(x, 166 + index * 78, item.label, cardStyle('#f8fafc', '#0f172a'))
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      card.on('pointerdown', () =>
        isLeft ? this.selectLeft(item, card) : this.selectRight(item, card),
      );
      if (isLeft) this.leftCards.push({ item, card });
      else this.rightCards.push({ item, card });
    });
  }

  private selectLeft(item: LinkItem, card: Phaser.GameObjects.Text): void {
    if (this.matchedIds.has(item.id)) return;
    this.selectedLeftId = item.id;
    for (const entry of this.leftCards) {
      if (!this.matchedIds.has(entry.item.id)) {
        entry.card.setStyle(cardStyle('#f8fafc', '#0f172a'));
      }
    }
    card.setStyle(cardStyle('#fde68a', '#111827'));
    this.showFeedback(`已选择「${item.label}」，请选择右侧对应项。`);
  }

  private selectRight(item: LinkItem, card: Phaser.GameObjects.Text): void {
    if (!this.selectedLeftId) {
      this.showFeedback('先选择左侧还没有连线的项目。');
      return;
    }
    if (this.matchedIds.has(item.id)) return;
    this.attempts += 1;
    const left = this.leftCards.find(
      (entry) => entry.item.id === this.selectedLeftId,
    );
    if (!left) return;
    const matched =
      left.item.pairId === item.id || item.pairId === left.item.id;
    if (!matched) {
      card.setStyle(cardStyle('#fca5a5', '#111827'));
      this.showFeedback('这条线还不对，重新看两边项目的对应关系。');
      return;
    }

    this.matchedIds.add(left.item.id);
    this.matchedIds.add(item.id);
    left.card.setStyle(cardStyle('#86efac', '#052e16'));
    card.setStyle(cardStyle('#86efac', '#052e16'));
    this.drawLine(left.card, card);
    this.selectedLeftId = undefined;
    this.showFeedback(item.explanation ?? left.item.explanation ?? '连线正确。');
    if (this.leftCards.every((entry) => this.matchedIds.has(entry.item.id))) {
      this.finish('success', {
        attempts: Math.max(this.attempts, 1),
        evidence: [`${playletId}:linked:${this.leftCards.length}`],
      });
    }
  }

  private drawLine(
    left: Phaser.GameObjects.Text,
    right: Phaser.GameObjects.Text,
  ): void {
    this.lineLayer
      ?.lineStyle(4, 0x86efac, 0.88)
      .lineBetween(left.x + 132, left.y, right.x - 132, right.y);
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  leftItems: LinkItem[];
  rightItems: LinkItem[];
} {
  const prompt = readString(config.prompt, '请把左右项目连线匹配。');
  const items = readArray(config.items)
    .map(normalizeItem)
    .filter(Boolean) as LinkItem[];
  const leftItems = [
    ...readArray(config.leftItems).map(normalizeItem).filter(Boolean),
    ...items.filter((item, index) => item.side === 'left' || index % 2 === 0),
  ] as LinkItem[];
  const rightItems = [
    ...readArray(config.rightItems).map(normalizeItem).filter(Boolean),
    ...items.filter((item, index) => item.side === 'right' || index % 2 === 1),
  ] as LinkItem[];
  if (leftItems.length > 0 && rightItems.length > 0) {
    return { prompt, leftItems, rightItems };
  }
  return {
    prompt,
    leftItems: [
      { id: 'area', label: '面积', pairId: 'surface_size' },
      { id: 'perimeter', label: '周长', pairId: 'border_length' },
    ],
    rightItems: [
      { id: 'surface_size', label: '平面区域大小', pairId: 'area' },
      { id: 'border_length', label: '边线长度总和', pairId: 'perimeter' },
    ],
  };
}

function normalizeItem(value: unknown): LinkItem | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const id = readString(item.id, '');
  const label = readString(item.label, '');
  if (!id || !label) return undefined;
  return {
    id,
    label,
    pairId: readString(item.pairId, readString(item.matchId, '')),
    side: item.side === 'left' || item.side === 'right' ? item.side : undefined,
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
  backgroundColor: string,
  color: string,
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '18px',
    color,
    backgroundColor,
    padding: { left: 16, right: 16, top: 12, bottom: 12 },
    fixedWidth: 260,
    align: 'center',
    wordWrap: { width: 226 },
  };
}
