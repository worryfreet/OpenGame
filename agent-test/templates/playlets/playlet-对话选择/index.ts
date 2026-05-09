import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-对话选择';
export const playletTitle = '对话选择';

interface DialogueChoice {
  id: string;
  text: string;
  correct?: boolean;
  nextId?: string;
  feedback?: string;
}

interface DialogueStep {
  id: string;
  speaker: string;
  text: string;
  choices: DialogueChoice[];
}

export class PlayletScene extends BasePlayletScene {
  private steps = new Map<string, DialogueStep>();
  private currentStepId = '';
  private attempts = 0;
  private correctChoices = 0;
  private speakerText?: Phaser.GameObjects.Text;
  private dialogueText?: Phaser.GameObjects.Text;
  private feedbackText?: Phaser.GameObjects.Text;
  private choiceButtons: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('对话选择PlayletScene');
  }

  create(): void {
    const cam = this.cameras.main;
    const config = normalizeConfig(this.node.config);
    this.steps = new Map(config.steps.map((step) => [step.id, step]));
    this.currentStepId = config.startStepId;
    this.setRuntimeStatus('playlet', this.scene.key);
    this.add.rectangle(
      cam.width / 2,
      cam.height / 2,
      cam.width,
      cam.height,
      0x12302f,
    );
    this.add
      .text(cam.width / 2, 44, config.prompt, {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: Math.min(760, cam.width - 80) },
      })
      .setOrigin(0.5);

    this.add
      .rectangle(
        cam.width / 2,
        188,
        Math.min(760, cam.width - 80),
        210,
        0xf8fafc,
      )
      .setStrokeStyle(3, 0x5eead4);
    this.speakerText = this.add.text(cam.width / 2 - 340, 112, '', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#0f766e',
      fontStyle: 'bold',
    });
    this.dialogueText = this.add
      .text(cam.width / 2, 188, '', {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#111827',
        align: 'left',
        wordWrap: { width: Math.min(680, cam.width - 140) },
        lineSpacing: 8,
      })
      .setOrigin(0.5);
    this.feedbackText = this.add
      .text(cam.width / 2, cam.height - 46, '选择最符合学习目标的回应。', {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ccfbf1',
        align: 'center',
        wordWrap: { width: Math.min(720, cam.width - 80) },
      })
      .setOrigin(0.5);
    this.renderStep();
  }

  private renderStep(): void {
    const step = this.steps.get(this.currentStepId);
    if (!step) {
      this.finish('success', {
        attempts: Math.max(this.attempts, 1),
        evidence: [`${playletId}:dialogue:${this.correctChoices}`],
      });
      return;
    }
    this.speakerText?.setText(step.speaker);
    this.dialogueText?.setText(step.text);
    for (const button of this.choiceButtons) {
      button.destroy();
    }
    this.choiceButtons = step.choices.map((choice, index) => {
      const button = this.add
        .text(
          this.cameras.main.width / 2,
          340 + index * 72,
          choice.text,
          choiceStyle(),
        )
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      button.on('pointerdown', () => this.choose(choice, button));
      return button;
    });
  }

  private choose(
    choice: DialogueChoice,
    button: Phaser.GameObjects.Text,
  ): void {
    this.attempts += 1;
    if (choice.correct === false) {
      button.setStyle(choiceStyle('#fca5a5'));
      this.showFeedback(choice.feedback ?? '这句回应没有解决当前学习问题。');
      return;
    }
    this.correctChoices += 1;
    button.setStyle(choiceStyle('#86efac'));
    this.showFeedback(choice.feedback ?? '回应合适，继续推进对话。');
    if (choice.nextId && this.steps.has(choice.nextId)) {
      this.currentStepId = choice.nextId;
      this.time.delayedCall(280, () => this.renderStep());
      return;
    }
    this.finish('success', {
      attempts: Math.max(this.attempts, 1),
      evidence: [`${playletId}:choices:${this.correctChoices}`],
    });
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  startStepId: string;
  steps: DialogueStep[];
} {
  const prompt = readString(config.prompt, '请选择合适的对话回应。');
  const steps = readArray(config.steps)
    .map(normalizeStep)
    .filter(Boolean) as DialogueStep[];
  if (steps.length > 0) {
    return {
      prompt,
      startStepId: readString(config.startStepId, steps[0].id),
      steps,
    };
  }
  const fallbackSteps = [
    {
      id: 'ask_reason',
      speaker: '学习伙伴',
      text: '为什么这道题不能只看数字大小就下结论？',
      choices: [
        {
          id: 'compare_unit',
          text: '因为还要比较单位和题目条件。',
          correct: true,
          feedback: '回应抓住了关键条件。',
        },
        {
          id: 'guess',
          text: '因为数字大的答案一定更接近。',
          correct: false,
          feedback: '只看数字会忽略单位和关系。',
        },
      ],
    },
  ];
  return { prompt, startStepId: fallbackSteps[0].id, steps: fallbackSteps };
}

function normalizeStep(value: unknown): DialogueStep | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const step = value as Record<string, unknown>;
  const id = readString(step.id, '');
  const speaker = readString(step.speaker, '学习伙伴');
  const text = readString(step.text, '');
  const choices = readArray(step.choices)
    .map(normalizeChoice)
    .filter(Boolean) as DialogueChoice[];
  if (!id || !text || choices.length === 0) return undefined;
  return { id, speaker, text, choices };
}

function normalizeChoice(value: unknown): DialogueChoice | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const choice = value as Record<string, unknown>;
  const id = readString(choice.id, '');
  const text = readString(choice.text, readString(choice.label, ''));
  if (!id || !text) return undefined;
  return {
    id,
    text,
    correct:
      typeof choice.correct === 'boolean'
        ? choice.correct
        : typeof choice.answer === 'boolean'
          ? choice.answer
          : undefined,
    nextId: readString(choice.nextId, ''),
    feedback: readString(choice.feedback, ''),
  };
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function choiceStyle(
  backgroundColor = '#f8fafc',
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '18px',
    color: '#111827',
    backgroundColor,
    padding: { left: 18, right: 18, top: 12, bottom: 12 },
    fixedWidth: 620,
    align: 'center',
    wordWrap: { width: 580 },
  };
}
