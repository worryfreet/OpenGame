import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-步骤排序';
export const playletTitle = '步骤排序';

interface StepItem {
  id: string;
  label: string;
  order: number;
  explanation?: string;
}

export class PlayletScene extends BasePlayletScene {
  private steps: StepItem[] = [];
  private selectedIndex?: number;
  private attempts = 0;
  private feedbackText?: Phaser.GameObjects.Text;
  private stepCards: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('步骤排序PlayletScene');
  }

  create(): void {
    const cam = this.cameras.main;
    const config = normalizeConfig(this.node.config);
    this.steps = shuffle(config.steps);
    this.setRuntimeStatus('playlet', this.scene.key);
    this.add.rectangle(
      cam.width / 2,
      cam.height / 2,
      cam.width,
      cam.height,
      0x312e81,
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

    this.renderSteps();
    this.renderActions();
    this.feedbackText = this.add
      .text(
        cam.width / 2,
        cam.height - 52,
        '选择一个步骤后，用上移/下移调整顺序，再提交检查。',
        {
          fontFamily: 'Arial',
          fontSize: '18px',
          color: '#e0e7ff',
          align: 'center',
          wordWrap: { width: Math.min(720, cam.width - 80) },
        },
      )
      .setOrigin(0.5);
  }

  private renderSteps(): void {
    for (const card of this.stepCards) {
      card.destroy();
    }
    this.stepCards = this.steps.map((step, index) => {
      const card = this.add
        .text(
          160 + index * 160,
          230,
          `${index + 1}. ${step.label}`,
          cardStyle(false),
        )
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => this.selectStep(index));
      return card;
    });
  }

  private renderActions(): void {
    const cam = this.cameras.main;
    const actions = [
      {
        label: '上移',
        x: cam.width / 2 - 190,
        run: () => this.moveSelected(-1),
      },
      { label: '下移', x: cam.width / 2, run: () => this.moveSelected(1) },
      { label: '提交', x: cam.width / 2 + 190, run: () => this.submit() },
    ];
    for (const action of actions) {
      this.add
        .text(action.x, 390, action.label, buttonStyle())
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', action.run);
    }
  }

  private selectStep(index: number): void {
    this.selectedIndex = index;
    this.stepCards.forEach((card, cardIndex) => {
      card.setStyle(cardStyle(cardIndex === index));
    });
    this.showFeedback(`已选择第 ${index + 1} 步，可以上移或下移。`);
  }

  private moveSelected(delta: number): void {
    if (this.selectedIndex === undefined) {
      this.showFeedback('先选择一个步骤。');
      return;
    }
    const nextIndex = this.selectedIndex + delta;
    if (nextIndex < 0 || nextIndex >= this.steps.length) return;
    const current = this.steps[this.selectedIndex];
    this.steps[this.selectedIndex] = this.steps[nextIndex];
    this.steps[nextIndex] = current;
    this.selectedIndex = nextIndex;
    this.renderSteps();
    this.selectStep(nextIndex);
  }

  private submit(): void {
    this.attempts += 1;
    const correctPositions = this.steps.filter(
      (step, index) => step.order === index + 1,
    ).length;
    if (correctPositions === this.steps.length) {
      this.finish('success', {
        attempts: this.attempts,
        evidence: [
          `${playletId}:ordered:${this.steps.map((step) => step.id).join('>')}`,
        ],
      });
      return;
    }
    this.steps.forEach((step, index) => {
      this.stepCards[index].setStyle(
        cardStyle(false, step.order === index + 1),
      );
    });
    this.showFeedback(
      `当前 ${correctPositions}/${this.steps.length} 个步骤位置正确，继续调整。`,
    );
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  steps: StepItem[];
} {
  const prompt = readString(config.prompt, '请把步骤排成正确顺序。');
  const steps = (Array.isArray(config.steps) ? config.steps : config.items) as
    | unknown[]
    | undefined;
  const normalized = (steps ?? [])
    .map(normalizeStep)
    .filter(Boolean) as StepItem[];
  if (normalized.length > 1) return { prompt, steps: normalized };
  return {
    prompt,
    steps: [
      { id: 'find_start', label: '先找起点信息', order: 1 },
      { id: 'apply_rule', label: '按规则逐步判断', order: 2 },
      { id: 'check_result', label: '检查结论是否符合题意', order: 3 },
    ],
  };
}

function normalizeStep(value: unknown, index: number): StepItem | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const step = value as Record<string, unknown>;
  const id = readString(step.id, `step_${index + 1}`);
  const label = readString(step.label, '');
  if (!label) return undefined;
  const order = typeof step.order === 'number' ? step.order : index + 1;
  return {
    id,
    label,
    order,
    explanation: readString(step.explanation, ''),
  };
}

function shuffle<T>(values: T[]): T[] {
  if (values.length <= 2) return [...values].reverse();
  return [values[1], values[2], values[0], ...values.slice(3)];
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
          ? '#fde68a'
          : '#f8fafc';
  return {
    fontFamily: 'Arial',
    fontSize: '17px',
    color: '#111827',
    backgroundColor,
    padding: { left: 14, right: 14, top: 12, bottom: 12 },
    fixedWidth: 140,
    fixedHeight: 92,
    align: 'center',
    wordWrap: { width: 112 },
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
