import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-单选判断';
export const playletTitle = '单选判断';

interface ChoiceItem {
  id: string;
  label: string;
  answer: boolean;
  explanation?: string;
}

export class PlayletScene extends BasePlayletScene {
  private readonly answered = new Map<string, boolean>();
  private attempts = 0;
  private feedbackText?: Phaser.GameObjects.Text;
  private itemCards: Array<{
    item: ChoiceItem;
    yes: Phaser.GameObjects.Text;
    no: Phaser.GameObjects.Text;
  }> = [];

  constructor() {
    super('单选判断PlayletScene');
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
      0x1e293b,
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
    this.feedbackText = this.add
      .text(cam.width / 2, cam.height - 54, config.successCriteria, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#dbeafe',
        align: 'center',
        wordWrap: { width: Math.min(720, cam.width - 80) },
      })
      .setOrigin(0.5);
  }

  private renderItem(item: ChoiceItem, index: number): void {
    const cam = this.cameras.main;
    const y = 142 + index * 92;
    this.add
      .text(cam.width / 2 - 120, y, item.label, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#f8fafc',
        wordWrap: { width: Math.min(420, cam.width - 360) },
      })
      .setOrigin(0.5);
    const yes = this.add
      .text(cam.width / 2 + 180, y, '正确', buttonStyle(false))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const no = this.add
      .text(cam.width / 2 + 300, y, '不正确', buttonStyle(false))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    yes.on('pointerdown', () => this.answer(item, true));
    no.on('pointerdown', () => this.answer(item, false));
    this.itemCards.push({ item, yes, no });
  }

  private answer(item: ChoiceItem, answer: boolean): void {
    this.attempts += 1;
    this.answered.set(item.id, answer);
    const card = this.itemCards.find((entry) => entry.item.id === item.id);
    card?.yes.setStyle(buttonStyle(answer, answer === item.answer));
    card?.no.setStyle(buttonStyle(!answer, answer === item.answer));
    if (answer === item.answer) {
      this.showFeedback(item.explanation ?? '判断正确，继续完成剩余项目。');
    } else {
      this.showFeedback('这个判断还不准确，结合概念条件再选一次。');
    }
    if (this.answered.size === this.itemCards.length) {
      this.finishIfComplete();
    }
  }

  private finishIfComplete(): void {
    const correct = this.itemCards.filter(
      ({ item }) => this.answered.get(item.id) === item.answer,
    ).length;
    if (correct === this.itemCards.length) {
      this.finish('success', {
        attempts: Math.max(this.attempts, 1),
        evidence: [`${playletId}:judged:${correct}/${this.itemCards.length}`],
      });
      return;
    }
    this.showFeedback(
      `当前正确 ${correct}/${this.itemCards.length}，请修正高亮错误项。`,
    );
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  successCriteria: string;
  items: ChoiceItem[];
} {
  const prompt = readString(config.prompt, '请判断每个说法是否正确。');
  const successCriteria = readString(
    config.successCriteria,
    '逐项判断，全部正确后进入下一段。',
  );
  const items = readArray(config.items)
    .map(normalizeItem)
    .filter(Boolean) as ChoiceItem[];
  if (items.length > 0) return { prompt, successCriteria, items };
  return {
    prompt,
    successCriteria,
    items: [
      {
        id: 'area_unit',
        label: '面积单位用于描述平面区域的大小。',
        answer: true,
      },
      {
        id: 'perimeter_area',
        label: '周长和面积表示完全相同的量。',
        answer: false,
      },
    ],
  };
}

function normalizeItem(value: unknown): ChoiceItem | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const id = readString(item.id, '');
  const label = readString(item.label, '');
  if (!id || !label || typeof item.answer !== 'boolean') return undefined;
  return {
    id,
    label,
    answer: item.answer,
    explanation: readString(item.explanation, ''),
  };
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function buttonStyle(
  selected: boolean,
  correct = true,
): Phaser.Types.GameObjects.Text.TextStyle {
  const backgroundColor = !selected
    ? '#f8fafc'
    : correct
      ? '#86efac'
      : '#fca5a5';
  return {
    fontFamily: 'Arial',
    fontSize: '17px',
    color: '#111827',
    backgroundColor,
    padding: { left: 14, right: 14, top: 10, bottom: 10 },
    fixedWidth: 94,
    align: 'center',
  };
}
