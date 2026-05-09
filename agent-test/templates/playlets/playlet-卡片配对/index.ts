import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-卡片配对';
export const playletTitle = '卡片配对';

interface MatchItem {
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
  private leftCards: Array<{ item: MatchItem; card: Phaser.GameObjects.Text }> =
    [];
  private rightCards: Array<{
    item: MatchItem;
    card: Phaser.GameObjects.Text;
  }> = [];

  constructor() {
    super('卡片配对PlayletScene');
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
      0x16324a,
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

    this.renderColumn('线索卡', config.leftItems, 180, true);
    this.renderColumn('答案卡', config.rightItems, cam.width - 180, false);
    this.feedbackText = this.add
      .text(
        cam.width / 2,
        cam.height - 64,
        '先选择左侧卡片，再选择右侧配对卡片。',
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
    items: MatchItem[],
    x: number,
    isLeft: boolean,
  ): void {
    this.add
      .text(x, 104, title, {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#bae6fd',
      })
      .setOrigin(0.5);
    items.forEach((item, index) => {
      const card = this.add
        .text(x, 170 + index * 76, item.label, cardStyle(0xf8fafc, '#0f172a'))
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      card.on('pointerdown', () =>
        isLeft ? this.selectLeft(item, card) : this.selectRight(item, card),
      );
      if (isLeft) this.leftCards.push({ item, card });
      else this.rightCards.push({ item, card });
    });
  }

  private selectLeft(item: MatchItem, card: Phaser.GameObjects.Text): void {
    if (this.matchedIds.has(item.id)) return;
    this.selectedLeftId = item.id;
    for (const entry of this.leftCards) {
      if (!this.matchedIds.has(entry.item.id)) {
        entry.card.setStyle(cardStyle(0xf8fafc, '#0f172a'));
      }
    }
    card.setStyle(cardStyle(0xfacc15, '#111827'));
    this.showFeedback(`已选择「${item.label}」，请选择右侧对应卡片。`);
  }

  private selectRight(item: MatchItem, card: Phaser.GameObjects.Text): void {
    if (!this.selectedLeftId || this.matchedIds.has(item.id)) {
      this.showFeedback('先选择左侧还没有配对的卡片。');
      return;
    }
    this.attempts += 1;
    const left = this.leftCards.find(
      (entry) => entry.item.id === this.selectedLeftId,
    );
    if (!left) return;
    const matched =
      left.item.pairId === item.id || item.pairId === left.item.id;
    if (!matched) {
      card.setStyle(cardStyle(0xfca5a5, '#111827'));
      this.showFeedback('这组还不匹配，想一想两张卡之间的概念关系。');
      return;
    }

    this.matchedIds.add(left.item.id);
    this.matchedIds.add(item.id);
    left.card.setStyle(cardStyle(0x86efac, '#052e16'));
    card.setStyle(cardStyle(0x86efac, '#052e16'));
    this.selectedLeftId = undefined;
    this.showFeedback(
      item.explanation ?? left.item.explanation ?? '配对正确。',
    );
    if (this.leftCards.every((entry) => this.matchedIds.has(entry.item.id))) {
      this.finish('success', {
        attempts: Math.max(this.attempts, 1),
        evidence: [`${playletId}:matched:${this.leftCards.length}`],
      });
    }
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  leftItems: MatchItem[];
  rightItems: MatchItem[];
} {
  const prompt = readString(config.prompt, '请完成卡片配对。');
  const items = Array.isArray(config.items) ? config.items : [];
  const normalized = items.map(normalizeItem).filter(Boolean) as MatchItem[];
  const leftItems = normalized.filter(
    (item, index) => item.side === 'left' || index % 2 === 0,
  );
  const rightItems = normalized.filter(
    (item, index) => item.side === 'right' || index % 2 === 1,
  );
  if (leftItems.length > 0 && rightItems.length > 0) {
    return { prompt, leftItems, rightItems };
  }
  return {
    prompt,
    leftItems: [{ id: 'producer', label: '生产者', pairId: 'plant' }],
    rightItems: [{ id: 'plant', label: '植物能制造养分', pairId: 'producer' }],
  };
}

function normalizeItem(value: unknown): MatchItem | undefined {
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

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function cardStyle(
  backgroundColor: number,
  color: string,
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '18px',
    color,
    backgroundColor: `#${backgroundColor.toString(16).padStart(6, '0')}`,
    padding: { left: 18, right: 18, top: 12, bottom: 12 },
    fixedWidth: 260,
    align: 'center',
    wordWrap: { width: 226 },
  };
}
