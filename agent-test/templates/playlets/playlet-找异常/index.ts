import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-找异常';
export const playletTitle = '找异常';

interface AnomalyItem {
  id: string;
  label: string;
  answer: boolean;
  reason?: string;
}

export class PlayletScene extends BasePlayletScene {
  private readonly selectedIds = new Set<string>();
  private attempts = 0;
  private feedbackText?: Phaser.GameObjects.Text;
  private itemCards: Array<{
    item: AnomalyItem;
    card: Phaser.GameObjects.Text;
  }> = [];

  constructor() {
    super('找异常PlayletScene');
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
      0x3a1d2a,
    );
    this.add
      .text(cam.width / 2, 46, config.prompt, {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: Math.min(760, cam.width - 80) },
      })
      .setOrigin(0.5);

    config.items.forEach((item, index) => this.renderItem(item, index));
    this.renderSubmitButton();
    this.feedbackText = this.add
      .text(cam.width / 2, cam.height - 52, config.successCriteria, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ffe4e6',
        align: 'center',
        wordWrap: { width: Math.min(720, cam.width - 80) },
      })
      .setOrigin(0.5);
  }

  private renderItem(item: AnomalyItem, index: number): void {
    const cam = this.cameras.main;
    const x = 130 + (index % 4) * 180;
    const y = 150 + Math.floor(index / 4) * 96;
    const card = this.add
      .text(x, y, item.label, cardStyle(false))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    card.on('pointerdown', () => this.toggleItem(item, card));
    this.itemCards.push({ item, card });
  }

  private renderSubmitButton(): void {
    const cam = this.cameras.main;
    this.add
      .text(cam.width / 2, cam.height - 116, '提交异常项', buttonStyle())
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.submit());
  }

  private toggleItem(item: AnomalyItem, card: Phaser.GameObjects.Text): void {
    if (this.selectedIds.has(item.id)) {
      this.selectedIds.delete(item.id);
      card.setStyle(cardStyle(false));
      this.showFeedback(`已取消「${item.label}」。`);
      return;
    }
    this.selectedIds.add(item.id);
    card.setStyle(cardStyle(true));
    this.showFeedback(
      item.answer
        ? (item.reason ?? '这项可能是异常，提交后验证。')
        : '这项看起来不一定异常，先对照规则再判断。',
    );
  }

  private submit(): void {
    this.attempts += 1;
    const anomalyIds = new Set(
      this.itemCards
        .filter(({ item }) => item.answer)
        .map(({ item }) => item.id),
    );
    let correct = 0;
    for (const { item, card } of this.itemCards) {
      const selected = this.selectedIds.has(item.id);
      const isCorrect = selected === item.answer;
      if (isCorrect) correct += 1;
      card.setStyle(cardStyle(selected, isCorrect));
    }

    if (correct === this.itemCards.length) {
      this.finish('success', {
        attempts: Math.max(this.attempts, 1),
        evidence: [`${playletId}:anomalies:${[...anomalyIds].join('|')}`],
      });
      return;
    }
    this.showFeedback(
      `当前正确 ${correct}/${this.itemCards.length}，红色项目需要重新判断。`,
    );
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  successCriteria: string;
  items: AnomalyItem[];
} {
  const prompt = readString(config.prompt, '请找出不符合规则的异常项。');
  const successCriteria = readString(
    config.successCriteria,
    '选中所有异常项后提交。',
  );
  const items = readArray(config.items)
    .map(normalizeItem)
    .filter(Boolean) as AnomalyItem[];
  if (items.length > 0) return { prompt, successCriteria, items };
  return {
    prompt,
    successCriteria: '找出不是面积单位的项目。',
    items: [
      { id: 'square_meter', label: '平方米', answer: false },
      { id: 'meter', label: '米', answer: true, reason: '米是长度单位。' },
      { id: 'square_centimeter', label: '平方厘米', answer: false },
      { id: 'kilogram', label: '千克', answer: true, reason: '千克是质量单位。' },
    ],
  };
}

function normalizeItem(value: unknown): AnomalyItem | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const id = readString(item.id, '');
  const label = readString(item.label, '');
  const answer = readBoolean(
    item.answer,
    readBoolean(item.anomaly, readBoolean(item.isAnomaly, false)),
  );
  if (!id || !label) return undefined;
  return {
    id,
    label,
    answer,
    reason: readString(item.reason, readString(item.explanation, '')),
  };
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function cardStyle(
  selected: boolean,
  correct?: boolean,
): Phaser.Types.GameObjects.Text.TextStyle {
  const backgroundColor =
    correct === true
      ? '#bbf7d0'
      : correct === false
        ? '#fca5a5'
        : selected
          ? '#fda4af'
          : '#fff7ed';
  return {
    fontFamily: 'Arial',
    fontSize: '18px',
    color: '#111827',
    backgroundColor,
    padding: { left: 14, right: 14, top: 12, bottom: 12 },
    fixedWidth: 150,
    fixedHeight: 70,
    align: 'center',
    wordWrap: { width: 122 },
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
