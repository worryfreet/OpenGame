import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-条件组合推理';
export const playletTitle = '条件组合推理';

interface ConditionItem {
  id: string;
  label: string;
  required: boolean;
  explanation?: string;
}

interface ConclusionItem {
  id: string;
  label: string;
  correct: boolean;
  explanation?: string;
}

export class PlayletScene extends BasePlayletScene {
  private readonly selectedConditionIds = new Set<string>();
  private selectedConclusionId?: string;
  private attempts = 0;
  private conditions: ConditionItem[] = [];
  private conclusions: ConclusionItem[] = [];
  private feedbackText?: Phaser.GameObjects.Text;
  private conditionCards: Array<{
    item: ConditionItem;
    card: Phaser.GameObjects.Text;
  }> = [];
  private conclusionCards: Array<{
    item: ConclusionItem;
    card: Phaser.GameObjects.Text;
  }> = [];

  constructor() {
    super('条件组合推理PlayletScene');
  }

  create(): void {
    const cam = this.cameras.main;
    const config = normalizeConfig(this.node.config);
    this.conditions = config.conditions;
    this.conclusions = config.conclusions;
    this.setRuntimeStatus('playlet', this.scene.key);
    this.add.rectangle(
      cam.width / 2,
      cam.height / 2,
      cam.width,
      cam.height,
      0x263238,
    );
    this.add
      .text(cam.width / 2, 44, config.prompt, {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: Math.min(780, cam.width - 80) },
      })
      .setOrigin(0.5);
    this.add
      .text(cam.width / 2, 88, config.rule, {
        fontFamily: 'Arial',
        fontSize: '17px',
        color: '#d1fae5',
        align: 'center',
        wordWrap: { width: Math.min(760, cam.width - 80) },
      })
      .setOrigin(0.5);

    this.renderConditions();
    this.renderConclusions();
    this.renderSubmitButton();
    this.feedbackText = this.add
      .text(cam.width / 2, cam.height - 50, config.successCriteria, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#bbf7d0',
        align: 'center',
        wordWrap: { width: Math.min(760, cam.width - 80) },
      })
      .setOrigin(0.5);
  }

  private renderConditions(): void {
    const cam = this.cameras.main;
    this.add
      .text(cam.width / 2 - 210, 130, '选择成立条件', sectionStyle())
      .setOrigin(0.5);
    this.conditions.forEach((item, index) => {
      const card = this.add
        .text(
          cam.width / 2 - 210,
          182 + index * 60,
          item.label,
          optionStyle(false),
        )
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => this.toggleCondition(item, card));
      this.conditionCards.push({ item, card });
    });
  }

  private renderConclusions(): void {
    const cam = this.cameras.main;
    this.add
      .text(cam.width / 2 + 210, 130, '选择可推出结论', sectionStyle())
      .setOrigin(0.5);
    this.conclusions.forEach((item, index) => {
      const card = this.add
        .text(
          cam.width / 2 + 210,
          182 + index * 68,
          item.label,
          optionStyle(false),
        )
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => this.selectConclusion(item, card));
      this.conclusionCards.push({ item, card });
    });
  }

  private renderSubmitButton(): void {
    const cam = this.cameras.main;
    this.add
      .text(cam.width / 2, cam.height - 112, '提交推理', buttonStyle())
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.submit());
  }

  private toggleCondition(
    item: ConditionItem,
    card: Phaser.GameObjects.Text,
  ): void {
    if (this.selectedConditionIds.has(item.id)) {
      this.selectedConditionIds.delete(item.id);
      card.setStyle(optionStyle(false));
    } else {
      this.selectedConditionIds.add(item.id);
      card.setStyle(optionStyle(true));
    }
    this.showFeedback(`已更新条件组合：${this.selectedConditionIds.size} 个条件被选中。`);
  }

  private selectConclusion(
    item: ConclusionItem,
    card: Phaser.GameObjects.Text,
  ): void {
    this.selectedConclusionId = item.id;
    this.conclusionCards.forEach((entry) =>
      entry.card.setStyle(optionStyle(entry.item.id === item.id)),
    );
    card.setStyle(optionStyle(true));
    this.showFeedback(`已选择结论「${item.label}」，请提交推理。`);
  }

  private submit(): void {
    this.attempts += 1;
    const conditionResult = this.conditions.map((condition) => ({
      condition,
      correct:
        this.selectedConditionIds.has(condition.id) === condition.required,
    }));
    const selectedConclusion = this.conclusions.find(
      (conclusion) => conclusion.id === this.selectedConclusionId,
    );
    const allConditionsCorrect = conditionResult.every((result) => result.correct);
    const conclusionCorrect = selectedConclusion?.correct === true;

    for (const { condition, correct } of conditionResult) {
      const row = this.conditionCards.find((entry) => entry.item.id === condition.id);
      row?.card.setStyle(
        optionStyle(this.selectedConditionIds.has(condition.id), correct),
      );
    }
    for (const row of this.conclusionCards) {
      const isSelected = row.item.id === this.selectedConclusionId;
      row.card.setStyle(optionStyle(isSelected, isSelected ? row.item.correct : undefined));
    }

    if (allConditionsCorrect && conclusionCorrect) {
      this.finish('success', {
        attempts: this.attempts,
        evidence: [
          `${playletId}:conditions:${[...this.selectedConditionIds].join('+')}:conclusion:${this.selectedConclusionId}`,
        ],
      });
      return;
    }

    const wrongCondition = conditionResult.find((result) => !result.correct);
    this.showFeedback(
      wrongCondition?.condition.explanation ??
        selectedConclusion?.explanation ??
        '条件组合或结论还不成立，检查哪些条件真正必要。',
    );
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  rule: string;
  successCriteria: string;
  conditions: ConditionItem[];
  conclusions: ConclusionItem[];
} {
  const prompt = readString(config.prompt, '请选择必要条件并推出正确结论。');
  const rule = readString(
    config.rule,
    '只有同时满足关键条件时，结论才可以成立。',
  );
  const successCriteria = readString(
    config.successCriteria,
    '选出全部必要条件，并选择它们共同支持的结论。',
  );
  const conditions = readArray(config.conditions ?? config.items)
    .map(normalizeCondition)
    .filter(Boolean) as ConditionItem[];
  const conclusions = readArray(config.conclusions ?? config.options)
    .map(normalizeConclusion)
    .filter(Boolean) as ConclusionItem[];
  if (conditions.length > 0 && conclusions.length > 0) {
    return { prompt, rule, successCriteria, conditions, conclusions };
  }
  return {
    prompt,
    rule,
    successCriteria,
    conditions: [
      { id: 'same_unit', label: '两个数使用同一单位', required: true },
      { id: 'known_formula', label: '已经知道对应公式', required: true },
      { id: 'bigger_number', label: '只看哪个数字更大', required: false },
    ],
    conclusions: [
      { id: 'can_compare', label: '可以进行有效比较', correct: true },
      { id: 'always_bigger', label: '数字大的答案一定更大', correct: false },
    ],
  };
}

function normalizeCondition(value: unknown): ConditionItem | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const id = readString(item.id, '');
  const label = readString(item.label, '');
  if (!id || !label) return undefined;
  return {
    id,
    label,
    required: readBoolean(item.required ?? item.answer ?? item.correct, false),
    explanation: readString(item.explanation, ''),
  };
}

function normalizeConclusion(value: unknown): ConclusionItem | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const id = readString(item.id, '');
  const label = readString(item.label, '');
  if (!id || !label) return undefined;
  return {
    id,
    label,
    correct: readBoolean(item.correct ?? item.answer, false),
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

function sectionStyle(): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '19px',
    color: '#ecfeff',
    backgroundColor: '#0f766e',
    padding: { left: 14, right: 14, top: 7, bottom: 7 },
  };
}

function optionStyle(
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
    fontSize: '16px',
    color: '#111827',
    backgroundColor,
    padding: { left: 13, right: 13, top: 10, bottom: 10 },
    fixedWidth: 300,
    fixedHeight: 50,
    align: 'center',
    wordWrap: { width: 270 },
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
