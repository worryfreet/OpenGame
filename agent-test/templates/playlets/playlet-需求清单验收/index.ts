import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-需求清单验收';
export const playletTitle = '需求清单验收';

type ReviewStatus = 'unset' | 'pass' | 'fail';

interface RequirementItem {
  id: string;
  label: string;
  required: boolean;
  forbidden: boolean;
  expected?: boolean;
  hint?: string;
  explanation?: string;
}

export class PlayletScene extends BasePlayletScene {
  private readonly statuses = new Map<string, ReviewStatus>();
  private attempts = 0;
  private feedbackText?: Phaser.GameObjects.Text;
  private requirementRows: Array<{
    item: RequirementItem;
    passButton: Phaser.GameObjects.Text;
    failButton: Phaser.GameObjects.Text;
  }> = [];

  constructor() {
    super('需求清单验收PlayletScene');
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
      0x2f2a1d,
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
      .text(cam.width / 2, 92, config.reviewTarget, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#fef3c7',
        align: 'center',
        wordWrap: { width: Math.min(720, cam.width - 80) },
      })
      .setOrigin(0.5);

    config.requirements.forEach((item, index) =>
      this.renderRequirement(item, index),
    );
    this.renderSubmitButton();
    this.feedbackText = this.add
      .text(cam.width / 2, cam.height - 50, config.successCriteria, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#fde68a',
        align: 'center',
        wordWrap: { width: Math.min(720, cam.width - 80) },
      })
      .setOrigin(0.5);
  }

  private renderRequirement(item: RequirementItem, index: number): void {
    const cam = this.cameras.main;
    const y = 150 + index * 66;
    const badge = item.forbidden ? '禁止' : item.required ? '必需' : '可选';
    this.statuses.set(item.id, 'unset');
    this.add
      .text(cam.width / 2 - 190, y, `${badge}｜${item.label}`, labelStyle())
      .setOrigin(0.5);
    const passButton = this.add
      .text(cam.width / 2 + 125, y, '通过', statusStyle(false))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const failButton = this.add
      .text(cam.width / 2 + 250, y, '未通过', statusStyle(false))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    passButton.on('pointerdown', () => this.setStatus(item, 'pass'));
    failButton.on('pointerdown', () => this.setStatus(item, 'fail'));
    this.requirementRows.push({ item, passButton, failButton });
  }

  private renderSubmitButton(): void {
    const cam = this.cameras.main;
    this.add
      .text(cam.width / 2, cam.height - 112, '提交验收', buttonStyle())
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.submit());
  }

  private setStatus(item: RequirementItem, status: ReviewStatus): void {
    this.statuses.set(item.id, status);
    const row = this.requirementRows.find(({ item: rowItem }) =>
      rowItem.id === item.id,
    );
    row?.passButton.setStyle(statusStyle(status === 'pass'));
    row?.failButton.setStyle(statusStyle(status === 'fail'));
    this.showFeedback(item.hint ?? `已标记「${item.label}」为${statusLabel(status)}。`);
  }

  private submit(): void {
    this.attempts += 1;
    let correct = 0;
    for (const row of this.requirementRows) {
      const selected = this.statuses.get(row.item.id) ?? 'unset';
      const isCorrect = isExpectedStatus(row.item, selected);
      if (isCorrect) correct += 1;
      row.passButton.setStyle(statusStyle(selected === 'pass', isCorrect));
      row.failButton.setStyle(statusStyle(selected === 'fail', isCorrect));
    }

    if (correct === this.requirementRows.length) {
      this.finish('success', {
        attempts: this.attempts,
        evidence: [
          `${playletId}:accepted:${this.serializeStatuses()}`,
        ],
      });
      return;
    }

    const pending = this.requirementRows.find(({ item }) => {
      const selected = this.statuses.get(item.id) ?? 'unset';
      return !isExpectedStatus(item, selected);
    });
    this.showFeedback(
      pending?.item.explanation ??
        `当前 ${correct}/${this.requirementRows.length} 项验收正确，红色项需要重新判断。`,
    );
  }

  private serializeStatuses(): string {
    return this.requirementRows
      .map(({ item }) => `${item.id}:${this.statuses.get(item.id) ?? 'unset'}`)
      .join('|');
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  reviewTarget: string;
  successCriteria: string;
  requirements: RequirementItem[];
} {
  const prompt = readString(config.prompt, '请按需求清单验收作品。');
  const reviewTarget = readString(
    config.reviewTarget,
    '检查作品是否满足所有必需项，并打回禁止项。',
  );
  const successCriteria = readString(
    config.successCriteria,
    '必需项通过，禁止项未通过。',
  );
  const requirements = readArray(config.requirements ?? config.items)
    .map(normalizeRequirement)
    .filter(Boolean) as RequirementItem[];
  if (requirements.length > 0) {
    return { prompt, reviewTarget, successCriteria, requirements };
  }
  return {
    prompt,
    reviewTarget,
    successCriteria,
    requirements: [
      { id: 'has_goal', label: '写清学习目标', required: true, forbidden: false },
      { id: 'has_feedback', label: '每步都有反馈', required: true, forbidden: false },
      { id: 'hidden_answer', label: '直接暴露答案', required: false, forbidden: true },
    ],
  };
}

function normalizeRequirement(value: unknown): RequirementItem | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const id = readString(item.id, '');
  const label = readString(item.label, '');
  const forbidden = readBoolean(item.forbidden, false);
  const required = readBoolean(item.required, !forbidden);
  const expected =
    typeof item.expected === 'boolean'
      ? item.expected
      : typeof item.answer === 'boolean'
        ? item.answer
        : undefined;
  if (!id || !label) return undefined;
  return {
    id,
    label,
    required,
    forbidden,
    expected,
    hint: readString(item.hint, ''),
    explanation: readString(item.explanation, ''),
  };
}

function isExpectedStatus(item: RequirementItem, selected: ReviewStatus): boolean {
  if (selected === 'unset') return false;
  if (typeof item.expected === 'boolean') {
    return selected === (item.expected ? 'pass' : 'fail');
  }
  if (item.forbidden) return selected === 'fail';
  if (item.required) return selected === 'pass';
  return true;
}

function statusLabel(status: ReviewStatus): string {
  if (status === 'pass') return '通过';
  if (status === 'fail') return '未通过';
  return '未验收';
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

function labelStyle(): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '17px',
    color: '#111827',
    backgroundColor: '#fffbeb',
    padding: { left: 14, right: 14, top: 10, bottom: 10 },
    fixedWidth: 360,
    fixedHeight: 46,
    align: 'left',
    wordWrap: { width: 330 },
  };
}

function statusStyle(
  selected: boolean,
  correct?: boolean,
): Phaser.Types.GameObjects.Text.TextStyle {
  const backgroundColor =
    correct === true
      ? '#bbf7d0'
      : correct === false && selected
        ? '#fca5a5'
        : selected
          ? '#fde68a'
          : '#f8fafc';
  return {
    fontFamily: 'Arial',
    fontSize: '17px',
    color: '#111827',
    backgroundColor,
    padding: { left: 14, right: 14, top: 10, bottom: 10 },
    fixedWidth: 96,
    fixedHeight: 46,
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
