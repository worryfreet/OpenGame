import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-失败输出归因';
export const playletTitle = '失败输出归因';

interface CauseItem {
  id: string;
  label: string;
  correct: boolean;
  hint?: string;
  explanation?: string;
}

export class PlayletScene extends BasePlayletScene {
  private readonly selectedIds = new Set<string>();
  private attempts = 0;
  private feedbackText?: Phaser.GameObjects.Text;
  private causeCards: Array<{ item: CauseItem; card: Phaser.GameObjects.Text }> =
    [];

  constructor() {
    super('失败输出归因PlayletScene');
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
      0x2d2238,
    );
    this.add
      .text(cam.width / 2, 42, config.prompt, {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: Math.min(760, cam.width - 80) },
      })
      .setOrigin(0.5);

    this.renderOutputPanel(config);
    config.causes.forEach((item, index) => this.renderCause(item, index));
    this.renderSubmitButton();
    this.feedbackText = this.add
      .text(cam.width / 2, cam.height - 52, config.successCriteria, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#f3e8ff',
        align: 'center',
        wordWrap: { width: Math.min(760, cam.width - 80) },
      })
      .setOrigin(0.5);
  }

  private renderOutputPanel(config: {
    outputTitle: string;
    output: string;
    expectedBehavior: string;
  }): void {
    const cam = this.cameras.main;
    this.add
      .rectangle(cam.width / 2, 142, Math.min(720, cam.width - 90), 116, 0xf8fafc)
      .setStrokeStyle(3, 0xc084fc);
    this.add
      .text(cam.width / 2, 98, config.outputTitle, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#581c87',
        align: 'center',
      })
      .setOrigin(0.5);
    this.add
      .text(
        cam.width / 2,
        142,
        [`观察输出：${config.output}`, `期望表现：${config.expectedBehavior}`].join(
          '\n',
        ),
        {
          fontFamily: 'Arial',
          fontSize: '16px',
          color: '#111827',
          align: 'left',
          lineSpacing: 8,
          wordWrap: { width: Math.min(660, cam.width - 140) },
        },
      )
      .setOrigin(0.5);
  }

  private renderCause(item: CauseItem, index: number): void {
    const cam = this.cameras.main;
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = cam.width / 2 + (col === 0 ? -190 : 190);
    const y = 246 + row * 78;
    const card = this.add
      .text(x, y, item.label, cardStyle(false))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    card.on('pointerdown', () => this.toggleCause(item, card));
    this.causeCards.push({ item, card });
  }

  private renderSubmitButton(): void {
    const cam = this.cameras.main;
    this.add
      .text(cam.width / 2, cam.height - 116, '提交归因', buttonStyle())
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.submit());
  }

  private toggleCause(item: CauseItem, card: Phaser.GameObjects.Text): void {
    if (this.selectedIds.has(item.id)) {
      this.selectedIds.delete(item.id);
      card.setStyle(cardStyle(false));
      this.showFeedback(`已取消「${item.label}」。`);
      return;
    }
    this.selectedIds.add(item.id);
    card.setStyle(cardStyle(true));
    this.showFeedback(item.hint ?? `已选择「${item.label}」，提交后验证。`);
  }

  private submit(): void {
    this.attempts += 1;
    const correctIds = this.causeCards
      .filter(({ item }) => item.correct)
      .map(({ item }) => item.id);
    let correct = 0;
    for (const { item, card } of this.causeCards) {
      const selected = this.selectedIds.has(item.id);
      const isCorrect = selected === item.correct;
      if (isCorrect) correct += 1;
      card.setStyle(cardStyle(selected, isCorrect));
    }

    if (correct === this.causeCards.length) {
      this.finish('success', {
        attempts: this.attempts,
        evidence: [`${playletId}:causes:${correctIds.join('|')}`],
      });
      return;
    }

    const missed = this.causeCards.find(
      ({ item }) => item.correct && !this.selectedIds.has(item.id),
    );
    const falsePositive = this.causeCards.find(
      ({ item }) => !item.correct && this.selectedIds.has(item.id),
    );
    this.showFeedback(
      missed?.item.explanation ??
        falsePositive?.item.explanation ??
        `当前 ${correct}/${this.causeCards.length} 个归因判断正确，红色项需要调整。`,
    );
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  outputTitle: string;
  output: string;
  expectedBehavior: string;
  successCriteria: string;
  causes: CauseItem[];
} {
  const prompt = readString(config.prompt, '观察失败输出，找出真正原因。');
  const outputTitle = readString(config.outputTitle, '失败输出记录');
  const output = readString(
    config.output ?? config.actualOutput,
    '系统把 3 平方米判断成 3 米。',
  );
  const expectedBehavior = readString(
    config.expectedBehavior,
    '应区分面积单位和长度单位。',
  );
  const successCriteria = readString(
    config.successCriteria,
    '选出所有导致失败的原因，避开表面现象。',
  );
  const causes = readArray(config.causes ?? config.items)
    .map(normalizeCause)
    .filter(Boolean) as CauseItem[];
  if (causes.length > 0) {
    return {
      prompt,
      outputTitle,
      output,
      expectedBehavior,
      successCriteria,
      causes,
    };
  }
  return {
    prompt,
    outputTitle,
    output,
    expectedBehavior,
    successCriteria,
    causes: [
      {
        id: 'unit_confusion',
        label: '把面积单位当成长度单位',
        correct: true,
        explanation: '平方单位描述面积，不能直接当作长度。',
      },
      {
        id: 'number_wrong',
        label: '数字 3 本身看错了',
        correct: false,
        explanation: '输出中的数字没有错，错在单位含义。',
      },
      {
        id: 'missing_concept',
        label: '没有先判断量的类型',
        correct: true,
      },
      {
        id: 'slow_answer',
        label: '回答速度太慢',
        correct: false,
      },
    ],
  };
}

function normalizeCause(value: unknown): CauseItem | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const id = readString(item.id, '');
  const label = readString(item.label, '');
  if (!id || !label) return undefined;
  return {
    id,
    label,
    correct: readBoolean(
      item.correct ?? item.answer ?? item.cause ?? item.target,
      false,
    ),
    hint: readString(item.hint, ''),
    explanation: readString(item.explanation ?? item.reason, ''),
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
          ? '#fde68a'
          : '#faf5ff';
  return {
    fontFamily: 'Arial',
    fontSize: '16px',
    color: '#111827',
    backgroundColor,
    padding: { left: 14, right: 14, top: 10, bottom: 10 },
    fixedWidth: 330,
    fixedHeight: 58,
    align: 'center',
    wordWrap: { width: 300 },
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
