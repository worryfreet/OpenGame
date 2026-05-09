import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-证明步骤补全';
export const playletTitle = '证明步骤补全';

interface ProofStep {
  id: string;
  label: string;
  order: number;
  locked: boolean;
  explanation?: string;
}

export class PlayletScene extends BasePlayletScene {
  private selectedChoiceId?: string;
  private attempts = 0;
  private proofSteps: ProofStep[] = [];
  private filledSlots = new Map<number, string>();
  private feedbackText?: Phaser.GameObjects.Text;
  private slotCards: Array<{ order: number; card: Phaser.GameObjects.Text }> = [];
  private choiceCards: Array<{ step: ProofStep; card: Phaser.GameObjects.Text }> =
    [];

  constructor() {
    super('证明步骤补全PlayletScene');
  }

  create(): void {
    const cam = this.cameras.main;
    const config = normalizeConfig(this.node.config);
    this.proofSteps = config.steps;
    this.setRuntimeStatus('playlet', this.scene.key);
    this.add.rectangle(
      cam.width / 2,
      cam.height / 2,
      cam.width,
      cam.height,
      0x1e1b4b,
    );
    this.add
      .text(cam.width / 2, 40, config.prompt, {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: Math.min(780, cam.width - 80) },
      })
      .setOrigin(0.5);
    this.add
      .text(cam.width / 2, 78, config.goal, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ddd6fe',
        align: 'center',
        wordWrap: { width: Math.min(760, cam.width - 80) },
      })
      .setOrigin(0.5);

    this.renderProofSlots();
    this.renderChoices(shuffle(this.proofSteps.filter((step) => !step.locked)));
    this.renderSubmitButton();
    this.feedbackText = this.add
      .text(cam.width / 2, cam.height - 50, config.successCriteria, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#e0e7ff',
        align: 'center',
        wordWrap: { width: Math.min(760, cam.width - 80) },
      })
      .setOrigin(0.5);
  }

  private renderProofSlots(): void {
    const cam = this.cameras.main;
    const ordered = [...this.proofSteps].sort((a, b) => a.order - b.order);
    ordered.forEach((step, index) => {
      const y = 130 + index * 58;
      if (step.locked) {
        this.add
          .text(
            cam.width / 2 - 180,
            y,
            `${step.order}. ${step.label}`,
            lockedStepStyle(),
          )
          .setOrigin(0.5);
        return;
      }
      const card = this.add
        .text(cam.width / 2 - 180, y, `${step.order}. 点击填入证明步骤`, slotStyle())
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => this.fillSlot(step.order, card));
      this.slotCards.push({ order: step.order, card });
    });
  }

  private renderChoices(choices: ProofStep[]): void {
    const cam = this.cameras.main;
    this.add
      .text(cam.width / 2 + 230, 118, '候选步骤', {
        fontFamily: 'Arial',
        fontSize: '19px',
        color: '#f5f3ff',
      })
      .setOrigin(0.5);
    choices.forEach((step, index) => {
      const card = this.add
        .text(cam.width / 2 + 230, 168 + index * 64, step.label, choiceStyle(false))
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => this.selectChoice(step, card));
      this.choiceCards.push({ step, card });
    });
  }

  private renderSubmitButton(): void {
    const cam = this.cameras.main;
    this.add
      .text(cam.width / 2, cam.height - 106, '提交证明', buttonStyle())
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.submit());
  }

  private selectChoice(step: ProofStep, card: Phaser.GameObjects.Text): void {
    if ([...this.filledSlots.values()].includes(step.id)) {
      this.showFeedback('这个步骤已经填入证明。');
      return;
    }
    this.selectedChoiceId = step.id;
    this.choiceCards.forEach((entry) => {
      const used = [...this.filledSlots.values()].includes(entry.step.id);
      entry.card.setStyle(choiceStyle(entry.step.id === step.id, used));
    });
    card.setStyle(choiceStyle(true));
    this.showFeedback(`已选择「${step.label}」，点击左侧空位填入。`);
  }

  private fillSlot(order: number, card: Phaser.GameObjects.Text): void {
    if (!this.selectedChoiceId) {
      this.showFeedback('先从右侧选择一个候选步骤。');
      return;
    }
    const step = this.proofSteps.find((candidate) => candidate.id === this.selectedChoiceId);
    if (!step) return;
    const oldStepId = this.filledSlots.get(order);
    this.filledSlots.set(order, step.id);
    card.setText(`${order}. ${step.label}`);
    card.setStyle(slotStyle(true));
    this.choiceCards.forEach((entry) => {
      const used = [...this.filledSlots.values()].includes(entry.step.id);
      if (entry.step.id === oldStepId) entry.card.setStyle(choiceStyle(false));
      else entry.card.setStyle(choiceStyle(false, used));
    });
    this.selectedChoiceId = undefined;
    this.showFeedback('已填入步骤，可以继续补全或提交检查。');
  }

  private submit(): void {
    this.attempts += 1;
    if (this.filledSlots.size < this.slotCards.length) {
      this.showFeedback('证明还有空位没有补全。');
      return;
    }
    const wrongSlot = this.slotCards.find(({ order }) => {
      const stepId = this.filledSlots.get(order);
      const step = this.proofSteps.find((candidate) => candidate.id === stepId);
      return step?.order !== order;
    });
    if (!wrongSlot) {
      const orderedIds = [...this.proofSteps]
        .sort((a, b) => a.order - b.order)
        .map((step) => step.id);
      this.finish('success', {
        attempts: this.attempts,
        evidence: [`${playletId}:proof:${orderedIds.join('>')}`],
      });
      return;
    }
    wrongSlot.card.setStyle(slotStyle(false));
    const wrongStep = this.proofSteps.find(
      (step) => step.id === this.filledSlots.get(wrongSlot.order),
    );
    this.showFeedback(
      wrongStep?.explanation ??
        `第 ${wrongSlot.order} 步不适合放在这里，检查前一步是否已经提供依据。`,
    );
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  goal: string;
  successCriteria: string;
  steps: ProofStep[];
} {
  const prompt = readString(config.prompt, '请补全证明中的关键步骤。');
  const goal = readString(config.goal ?? config.claim, '完成一段有依据的证明。');
  const successCriteria = readString(
    config.successCriteria,
    '把候选步骤放入正确空位，使证明链条成立。',
  );
  const steps = readArray(config.steps ?? config.items)
    .map(normalizeStep)
    .filter(Boolean) as ProofStep[];
  if (steps.filter((step) => !step.locked).length > 0) {
    return { prompt, goal, successCriteria, steps };
  }
  return {
    prompt,
    goal,
    successCriteria,
    steps: [
      { id: 'given', label: '已知长方形长为 6、宽为 4', order: 1, locked: true },
      { id: 'formula', label: '长方形面积 = 长 x 宽', order: 2, locked: false },
      { id: 'substitute', label: '代入得到 6 x 4 = 24', order: 3, locked: false },
      { id: 'conclude', label: '所以面积为 24 平方单位', order: 4, locked: true },
    ],
  };
}

function normalizeStep(value: unknown, index: number): ProofStep | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const step = value as Record<string, unknown>;
  const id = readString(step.id, `step_${index + 1}`);
  const label = readString(step.label ?? step.text, '');
  if (!label) return undefined;
  return {
    id,
    label,
    order: typeof step.order === 'number' ? step.order : index + 1,
    locked: readBoolean(step.locked ?? step.fixed, false),
    explanation: readString(step.explanation, ''),
  };
}

function shuffle<T>(values: T[]): T[] {
  if (values.length <= 2) return [...values].reverse();
  return [values[1], values[2], values[0], ...values.slice(3)];
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

function lockedStepStyle(): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '16px',
    color: '#111827',
    backgroundColor: '#c4b5fd',
    padding: { left: 12, right: 12, top: 9, bottom: 9 },
    fixedWidth: 360,
    fixedHeight: 46,
    align: 'center',
    wordWrap: { width: 330 },
  };
}

function slotStyle(correct = true): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '16px',
    color: '#111827',
    backgroundColor: correct ? '#f5f3ff' : '#fca5a5',
    padding: { left: 12, right: 12, top: 9, bottom: 9 },
    fixedWidth: 360,
    fixedHeight: 46,
    align: 'center',
    wordWrap: { width: 330 },
  };
}

function choiceStyle(
  selected: boolean,
  used = false,
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '16px',
    color: '#111827',
    backgroundColor: used ? '#bbf7d0' : selected ? '#fde68a' : '#f8fafc',
    padding: { left: 12, right: 12, top: 9, bottom: 9 },
    fixedWidth: 280,
    fixedHeight: 50,
    align: 'center',
    wordWrap: { width: 254 },
  };
}

function buttonStyle(): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '19px',
    color: '#111827',
    backgroundColor: '#facc15',
    padding: { left: 22, right: 22, top: 11, bottom: 11 },
  };
}
