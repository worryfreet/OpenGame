import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-找目标';
export const playletTitle = '找目标';

interface TargetItem {
  id: string;
  label: string;
  answer: boolean;
  hint?: string;
  explanation?: string;
}

export class PlayletScene extends BasePlayletScene {
  private readonly selectedIds = new Set<string>();
  private attempts = 0;
  private feedbackText?: Phaser.GameObjects.Text;
  private itemCards: Array<{ item: TargetItem; card: Phaser.GameObjects.Text }> =
    [];

  constructor() {
    super('找目标PlayletScene');
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
      0x123047,
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
        color: '#dbeafe',
        align: 'center',
        wordWrap: { width: Math.min(720, cam.width - 80) },
      })
      .setOrigin(0.5);
  }

  private renderItem(item: TargetItem, index: number): void {
    const cam = this.cameras.main;
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = cam.width / 2 + (col === 0 ? -180 : 180);
    const y = 138 + row * 88;
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
      .text(cam.width / 2, cam.height - 116, '提交目标', buttonStyle())
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.submit());
  }

  private toggleItem(item: TargetItem, card: Phaser.GameObjects.Text): void {
    if (this.selectedIds.has(item.id)) {
      this.selectedIds.delete(item.id);
      card.setStyle(cardStyle(false));
      this.showFeedback(`已取消「${item.label}」。`);
      return;
    }
    this.selectedIds.add(item.id);
    card.setStyle(cardStyle(true));
    this.showFeedback(item.hint ?? `已选择「${item.label}」。`);
  }

  private submit(): void {
    this.attempts += 1;
    const targetIds = new Set(
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
        evidence: [`${playletId}:targets:${[...targetIds].join('|')}`],
      });
      return;
    }
    const missed = this.itemCards.find(
      ({ item }) => item.answer && !this.selectedIds.has(item.id),
    );
    this.showFeedback(
      missed?.item.explanation ??
        `当前正确 ${correct}/${this.itemCards.length}，蓝色是已选项，红色需要调整。`,
    );
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  successCriteria: string;
  items: TargetItem[];
} {
  const prompt = readString(config.prompt, '请找出符合目标条件的项目。');
  const successCriteria = readString(
    config.successCriteria,
    '选中所有目标项后提交。',
  );
  const items = readArray(config.items)
    .map(normalizeItem)
    .filter(Boolean) as TargetItem[];
  if (items.length > 0) return { prompt, successCriteria, items };
  return {
    prompt,
    successCriteria: '找出所有面积单位。',
    items: [
      { id: 'square_meter', label: '平方米', answer: true },
      { id: 'meter', label: '米', answer: false },
      { id: 'square_centimeter', label: '平方厘米', answer: true },
      { id: 'kilogram', label: '千克', answer: false },
    ],
  };
}

function normalizeItem(value: unknown): TargetItem | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const id = readString(item.id, '');
  const label = readString(item.label, '');
  const answer = readBoolean(item.answer, readBoolean(item.target, false));
  if (!id || !label) return undefined;
  return {
    id,
    label,
    answer,
    hint: readString(item.hint, ''),
    explanation: readString(item.explanation, ''),
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
          ? '#93c5fd'
          : '#f8fafc';
  return {
    fontFamily: 'Arial',
    fontSize: '18px',
    color: '#111827',
    backgroundColor,
    padding: { left: 16, right: 16, top: 12, bottom: 12 },
    fixedWidth: 280,
    fixedHeight: 62,
    align: 'center',
    wordWrap: { width: 246 },
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
