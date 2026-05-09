import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-口算挑战';
export const playletTitle = '口算挑战';

interface MentalMathProblem {
  id: string;
  prompt: string;
  answer: number | string;
  choices: Array<number | string>;
  explanation?: string;
}

export class PlayletScene extends BasePlayletScene {
  private problems: MentalMathProblem[] = [];
  private currentIndex = 0;
  private correctCount = 0;
  private attempts = 0;
  private feedbackText?: Phaser.GameObjects.Text;
  private problemText?: Phaser.GameObjects.Text;
  private progressText?: Phaser.GameObjects.Text;
  private choiceCards: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('口算挑战PlayletScene');
  }

  create(): void {
    const cam = this.cameras.main;
    const config = normalizeConfig(this.node.config);
    this.problems = config.problems;
    this.setRuntimeStatus('playlet', this.scene.key);
    this.add.rectangle(
      cam.width / 2,
      cam.height / 2,
      cam.width,
      cam.height,
      0x064e3b,
    );
    this.add
      .text(cam.width / 2, 42, config.prompt, {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: Math.min(780, cam.width - 80) },
      })
      .setOrigin(0.5);
    this.progressText = this.add
      .text(cam.width / 2, 84, '', {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#bbf7d0',
      })
      .setOrigin(0.5);
    this.problemText = this.add
      .text(cam.width / 2, 174, '', {
        fontFamily: 'Arial',
        fontSize: '42px',
        color: '#f8fafc',
        align: 'center',
        wordWrap: { width: Math.min(680, cam.width - 100) },
      })
      .setOrigin(0.5);
    this.feedbackText = this.add
      .text(cam.width / 2, cam.height - 54, config.successCriteria, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#d1fae5',
        align: 'center',
        wordWrap: { width: Math.min(760, cam.width - 80) },
      })
      .setOrigin(0.5);
    this.renderProblem();
  }

  private renderProblem(): void {
    for (const card of this.choiceCards) card.destroy();
    this.choiceCards = [];
    const cam = this.cameras.main;
    const problem = this.problems[this.currentIndex];
    if (!problem) {
      this.finish('success', {
        attempts: Math.max(this.attempts, 1),
        evidence: [
          `${playletId}:score:${this.correctCount}/${this.problems.length}`,
        ],
      });
      return;
    }
    this.progressText?.setText(
      `第 ${this.currentIndex + 1}/${this.problems.length} 题  正确 ${this.correctCount}`,
    );
    this.problemText?.setText(problem.prompt);
    problem.choices.forEach((choice, index) => {
      const x = cam.width / 2 + (index - (problem.choices.length - 1) / 2) * 150;
      const card = this.add
        .text(x, 304, String(choice), choiceStyle(false))
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => this.answer(choice, card));
      this.choiceCards.push(card);
    });
  }

  private answer(
    choice: number | string,
    card: Phaser.GameObjects.Text,
  ): void {
    const problem = this.problems[this.currentIndex];
    if (!problem) return;
    this.attempts += 1;
    const correct = normalizeAnswer(choice) === normalizeAnswer(problem.answer);
    card.setStyle(choiceStyle(true, correct));
    if (!correct) {
      this.showFeedback(problem.explanation ?? '再算一次，注意进位、退位或单位。');
      return;
    }
    this.correctCount += 1;
    this.showFeedback(problem.explanation ?? '计算正确，进入下一题。');
    this.currentIndex += 1;
    this.time.delayedCall(280, () => this.renderProblem());
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  successCriteria: string;
  problems: MentalMathProblem[];
} {
  const prompt = readString(config.prompt, '请完成口算挑战。');
  const successCriteria = readString(
    config.successCriteria,
    '连续完成所有题目，系统会记录正确率和尝试次数。',
  );
  const problems = readArray(config.problems ?? config.items)
    .map(normalizeProblem)
    .filter(Boolean) as MentalMathProblem[];
  if (problems.length > 0) return { prompt, successCriteria, problems };
  return {
    prompt,
    successCriteria,
    problems: [
      { id: 'p1', prompt: '8 + 7 = ?', answer: 15, choices: [13, 15, 16] },
      { id: 'p2', prompt: '6 x 4 = ?', answer: 24, choices: [20, 24, 28] },
      { id: 'p3', prompt: '30 - 12 = ?', answer: 18, choices: [16, 18, 22] },
    ],
  };
}

function normalizeProblem(
  value: unknown,
  index: number,
): MentalMathProblem | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const problem = value as Record<string, unknown>;
  const id = readString(problem.id, `problem_${index + 1}`);
  const prompt = readString(problem.prompt ?? problem.label, '');
  const answer = readAnswer(problem.answer);
  if (!prompt || answer === undefined) return undefined;
  const choices = readArray(problem.choices ?? problem.options)
    .map(readAnswer)
    .filter((choice): choice is number | string => choice !== undefined);
  const normalizedChoices = choices.length > 0 ? choices : buildChoices(answer);
  return {
    id,
    prompt,
    answer,
    choices: normalizedChoices,
    explanation: readString(problem.explanation, ''),
  };
}

function buildChoices(answer: number | string): Array<number | string> {
  if (typeof answer !== 'number') return [answer];
  return [answer - 1, answer, answer + 2];
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readAnswer(value: unknown): number | string | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value.trim());
    return Number.isFinite(numeric) ? numeric : value.trim();
  }
  return undefined;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeAnswer(value: number | string): string {
  return typeof value === 'number' ? String(value) : value.trim();
}

function choiceStyle(
  selected: boolean,
  correct = true,
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '26px',
    color: '#111827',
    backgroundColor: !selected ? '#f8fafc' : correct ? '#86efac' : '#fca5a5',
    padding: { left: 22, right: 22, top: 14, bottom: 14 },
    fixedWidth: 112,
    align: 'center',
  };
}
