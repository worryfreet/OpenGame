import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-等式平衡';
export const playletTitle = '等式平衡';

interface EquationOption {
  id: string;
  label: string;
  value: number | string;
}

interface EquationSlot {
  id: string;
  label: string;
  side: 'left' | 'right';
  accepts: string;
}

interface EquationTerm {
  id: string;
  label: string;
  value: number;
  side: 'left' | 'right';
}

export class PlayletScene extends BasePlayletScene {
  private readonly assignments = new Map<string, string>();
  private selectedOptionId?: string;
  private attempts = 0;
  private feedbackText?: Phaser.GameObjects.Text;
  private balanceText?: Phaser.GameObjects.Text;
  private optionCards: Array<{
    option: EquationOption;
    card: Phaser.GameObjects.Text;
  }> = [];
  private slotCards: Array<{ slot: EquationSlot; card: Phaser.GameObjects.Text }> =
    [];
  private config?: ReturnType<typeof normalizeConfig>;

  constructor() {
    super('等式平衡PlayletScene');
  }

  create(): void {
    const cam = this.cameras.main;
    const config = normalizeConfig(this.node.config);
    this.config = config;
    this.setRuntimeStatus('playlet', this.scene.key);
    this.add.rectangle(
      cam.width / 2,
      cam.height / 2,
      cam.width,
      cam.height,
      0x12343b,
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
    this.add
      .text(cam.width * 0.3, 104, '左侧', headingStyle())
      .setOrigin(0.5);
    this.add
      .text(cam.width * 0.7, 104, '右侧', headingStyle())
      .setOrigin(0.5);
    this.add
      .text(cam.width / 2, 178, '=', {
        fontFamily: 'Arial',
        fontSize: '46px',
        color: '#facc15',
      })
      .setOrigin(0.5);
    this.renderTerms(config.terms, 'left', cam.width * 0.3);
    this.renderTerms(config.terms, 'right', cam.width * 0.7);
    this.renderSlots(config.slots);
    this.renderOptions(config.options);
    this.renderSubmitButton();
    this.balanceText = this.add
      .text(cam.width / 2, cam.height - 150, this.describeBalance(), {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#a7f3d0',
        align: 'center',
        wordWrap: { width: Math.min(720, cam.width - 80) },
      })
      .setOrigin(0.5);
    this.feedbackText = this.add
      .text(cam.width / 2, cam.height - 52, config.successCriteria, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#d1fae5',
        align: 'center',
        wordWrap: { width: Math.min(760, cam.width - 80) },
      })
      .setOrigin(0.5);
  }

  private renderTerms(
    terms: EquationTerm[],
    side: 'left' | 'right',
    x: number,
  ): void {
    const labels = terms
      .filter((term) => term.side === side)
      .map((term) => term.label);
    this.add
      .text(x, 148, labels.length > 0 ? labels.join(' + ') : '待补全', {
        fontFamily: 'Arial',
        fontSize: '22px',
        color: '#ecfeff',
        align: 'center',
        wordWrap: { width: 260 },
      })
      .setOrigin(0.5);
  }

  private renderSlots(slots: EquationSlot[]): void {
    const cam = this.cameras.main;
    const leftSlots = slots.filter((slot) => slot.side === 'left');
    const rightSlots = slots.filter((slot) => slot.side === 'right');
    leftSlots.forEach((slot, index) =>
      this.renderSlot(slot, cam.width * 0.3, 214 + index * 66),
    );
    rightSlots.forEach((slot, index) =>
      this.renderSlot(slot, cam.width * 0.7, 214 + index * 66),
    );
  }

  private renderSlot(slot: EquationSlot, x: number, y: number): void {
    const card = this.add
      .text(x, y, slot.label, slotStyle(false))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    card.on('pointerdown', () => this.assignSlot(slot, card));
    this.slotCards.push({ slot, card });
  }

  private renderOptions(options: EquationOption[]): void {
    const cam = this.cameras.main;
    options.forEach((option, index) => {
      const x = cam.width / 2 + (index - (options.length - 1) / 2) * 118;
      const card = this.add
        .text(x, cam.height - 224, option.label, optionStyle(false))
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => this.selectOption(option, card));
      this.optionCards.push({ option, card });
    });
  }

  private renderSubmitButton(): void {
    const cam = this.cameras.main;
    this.add
      .text(cam.width / 2, cam.height - 104, '检查平衡', buttonStyle())
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.submit());
  }

  private selectOption(
    option: EquationOption,
    card: Phaser.GameObjects.Text,
  ): void {
    this.selectedOptionId = option.id;
    this.optionCards.forEach((entry) => {
      entry.card.setStyle(optionStyle(entry.option.id === option.id));
    });
    card.setStyle(optionStyle(true));
    this.showFeedback(`已选择「${option.label}」，请选择一个空格。`);
  }

  private assignSlot(slot: EquationSlot, card: Phaser.GameObjects.Text): void {
    if (!this.selectedOptionId) {
      this.showFeedback('请先选择下方的数值或符号。');
      return;
    }
    const option = this.optionCards.find(
      (entry) => entry.option.id === this.selectedOptionId,
    )?.option;
    if (!option) return;
    this.assignments.set(slot.id, option.id);
    card.setText(`${slot.label}\n${option.label}`);
    card.setStyle(slotStyle(true));
    this.selectedOptionId = undefined;
    this.optionCards.forEach((entry) => entry.card.setStyle(optionStyle(false)));
    this.balanceText?.setText(this.describeBalance());
    this.showFeedback(`已把「${option.label}」放入「${slot.label}」。`);
  }

  private submit(): void {
    this.attempts += 1;
    const config = this.config;
    if (!config) return;
    let correctSlots = 0;
    for (const { slot, card } of this.slotCards) {
      const assigned = this.assignments.get(slot.id);
      const correct = assigned === slot.accepts;
      if (correct) correctSlots += 1;
      card.setStyle(slotStyle(Boolean(assigned), correct));
    }
    const balanced = this.calculateSide('left') === this.calculateSide('right');
    this.balanceText?.setText(this.describeBalance());
    if (correctSlots === this.slotCards.length && balanced) {
      this.finish('success', {
        attempts: this.attempts,
        evidence: [
          `${playletId}:equation:${[...this.assignments.entries()]
            .map(([slotId, optionId]) => `${slotId}=${optionId}`)
            .join('|')}`,
        ],
      });
      return;
    }
    this.showFeedback(
      balanced
        ? '两边数值已经相等，但仍有空格填错了。'
        : `两边还不平衡：左侧 ${this.calculateSide('left')}，右侧 ${this.calculateSide('right')}。`,
    );
  }

  private calculateSide(side: 'left' | 'right'): number {
    const config = this.config;
    if (!config) return 0;
    const fixed = config.terms
      .filter((term) => term.side === side)
      .reduce((sum, term) => sum + term.value, 0);
    const filled = config.slots
      .filter((slot) => slot.side === side)
      .reduce((sum, slot) => {
        const optionId = this.assignments.get(slot.id);
        const option = config.options.find((entry) => entry.id === optionId);
        return sum + readNumericValue(option?.value, 0);
      }, 0);
    return fixed + filled;
  }

  private describeBalance(): string {
    return `当前：左侧 ${this.calculateSide('left')}，右侧 ${this.calculateSide('right')}`;
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  successCriteria: string;
  terms: EquationTerm[];
  slots: EquationSlot[];
  options: EquationOption[];
} {
  const terms = readArray(config.terms)
    .map(normalizeTerm)
    .filter(Boolean) as EquationTerm[];
  const slots = readArray(config.slots ?? config.items)
    .map(normalizeSlot)
    .filter(Boolean) as EquationSlot[];
  const options = readArray(config.options ?? config.candidates)
    .map(normalizeOption)
    .filter(Boolean) as EquationOption[];
  if (slots.length > 0 && options.length > 0) {
    return {
      prompt: readString(config.prompt, '请补全等式，让左右两边保持平衡。'),
      successCriteria: readString(
        config.successCriteria,
        '填入正确数值后，两边总量必须相等。',
      ),
      terms,
      slots,
      options,
    };
  }
  return {
    prompt: readString(config.prompt, '请补全等式，让左右两边保持平衡。'),
    successCriteria: readString(config.successCriteria, '左右两边都等于 12。'),
    terms: [
      { id: 'left_base', label: '7', value: 7, side: 'left' },
      { id: 'right_base', label: '9', value: 9, side: 'right' },
    ],
    slots: [
      { id: 'left_gap', label: '左侧空格', side: 'left', accepts: 'five' },
      { id: 'right_gap', label: '右侧空格', side: 'right', accepts: 'three' },
    ],
    options: [
      { id: 'five', label: '5', value: 5 },
      { id: 'three', label: '3', value: 3 },
      { id: 'four', label: '4', value: 4 },
    ],
  };
}

function normalizeTerm(value: unknown): EquationTerm | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const id = readString(item.id, '');
  const label = readString(item.label, '');
  const side = readSide(item.side);
  if (!id || !label || !side) return undefined;
  return {
    id,
    label,
    side,
    value: readNumericValue(item.value, Number(label)),
  };
}

function normalizeSlot(value: unknown): EquationSlot | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const id = readString(item.id, '');
  const label = readString(item.label, '');
  const side = readSide(item.side);
  const accepts = readString(item.accepts ?? item.answer, '');
  if (!id || !label || !side || !accepts) return undefined;
  return { id, label, side, accepts };
}

function normalizeOption(value: unknown): EquationOption | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const id = readString(item.id, '');
  const label = readString(item.label, '');
  if (!id || !label) return undefined;
  return {
    id,
    label,
    value:
      typeof item.value === 'number' || typeof item.value === 'string'
        ? item.value
        : label,
  };
}

function readSide(value: unknown): 'left' | 'right' | undefined {
  return value === 'left' || value === 'right' ? value : undefined;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function readNumericValue(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return Number.isFinite(fallback) ? fallback : 0;
}

function headingStyle(): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '20px',
    color: '#ccfbf1',
  };
}

function optionStyle(selected: boolean): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '24px',
    color: '#0f172a',
    backgroundColor: selected ? '#fde68a' : '#f8fafc',
    padding: { left: 18, right: 18, top: 12, bottom: 12 },
    fixedWidth: 92,
    align: 'center',
  };
}

function slotStyle(
  filled: boolean,
  correct = true,
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '18px',
    color: '#0f172a',
    backgroundColor: !filled ? '#e2e8f0' : correct ? '#86efac' : '#fca5a5',
    padding: { left: 16, right: 16, top: 10, bottom: 10 },
    fixedWidth: 190,
    align: 'center',
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
