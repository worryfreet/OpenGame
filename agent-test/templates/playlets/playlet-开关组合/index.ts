import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-开关组合';
export const playletTitle = '开关组合';

interface SwitchRule {
  id: string;
  label: string;
  description?: string;
  initialOn: boolean;
  targetOn: boolean;
  hint?: string;
}

export class PlayletScene extends BasePlayletScene {
  private attempts = 0;
  private feedbackText?: Phaser.GameObjects.Text;
  private stateText?: Phaser.GameObjects.Text;
  private readonly switches: Array<{
    rule: SwitchRule;
    currentOn: boolean;
    card: Phaser.GameObjects.Text;
  }> = [];

  constructor() {
    super('开关组合PlayletScene');
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
      0x3b2f12,
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
    this.stateText = this.add
      .text(cam.width / 2, 88, config.targetSummary, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#fde68a',
        align: 'center',
        wordWrap: { width: Math.min(760, cam.width - 80) },
      })
      .setOrigin(0.5);
    config.switches.forEach((rule, index) => this.renderSwitch(rule, index));
    this.renderSubmitButton();
    this.feedbackText = this.add
      .text(cam.width / 2, cam.height - 52, config.successCriteria, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#fef3c7',
        align: 'center',
        wordWrap: { width: Math.min(760, cam.width - 80) },
      })
      .setOrigin(0.5);
  }

  private renderSwitch(rule: SwitchRule, index: number): void {
    const cam = this.cameras.main;
    const columns = 2;
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = cam.width / 2 + (col - 0.5) * 310;
    const y = 154 + row * 112;
    const card = this.add
      .text(x, y, switchLabel(rule, rule.initialOn), switchStyle(rule.initialOn))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const entry = { rule, currentOn: rule.initialOn, card };
    card.on('pointerdown', () => this.toggle(entry));
    this.switches.push(entry);
  }

  private renderSubmitButton(): void {
    const cam = this.cameras.main;
    this.add
      .text(cam.width / 2, cam.height - 116, '运行组合', buttonStyle())
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.submit());
  }

  private toggle(entry: {
    rule: SwitchRule;
    currentOn: boolean;
    card: Phaser.GameObjects.Text;
  }): void {
    entry.currentOn = !entry.currentOn;
    entry.card.setText(switchLabel(entry.rule, entry.currentOn));
    entry.card.setStyle(switchStyle(entry.currentOn));
    this.showFeedback(
      `「${entry.rule.label}」已切换为${entry.currentOn ? '开启' : '关闭'}。`,
    );
    this.stateText?.setText(this.describeCurrentState());
  }

  private submit(): void {
    this.attempts += 1;
    let correct = 0;
    for (const entry of this.switches) {
      const ok = entry.currentOn === entry.rule.targetOn;
      if (ok) correct += 1;
      entry.card.setStyle(switchStyle(entry.currentOn, ok));
    }
    if (correct === this.switches.length) {
      this.finish('success', {
        attempts: this.attempts,
        evidence: [
          `${playletId}:switches:${this.switches
            .map(({ rule, currentOn }) => `${rule.id}=${currentOn ? 'on' : 'off'}`)
            .join('|')}`,
        ],
      });
      return;
    }
    const firstWrong = this.switches.find(
      (entry) => entry.currentOn !== entry.rule.targetOn,
    );
    this.showFeedback(
      firstWrong?.rule.hint ??
        `当前 ${correct}/${this.switches.length} 个开关正确，红色开关需要重新判断。`,
    );
  }

  private describeCurrentState(): string {
    return this.switches
      .map(({ rule, currentOn }) => `${rule.label}:${currentOn ? '开' : '关'}`)
      .join('  ');
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  targetSummary: string;
  successCriteria: string;
  switches: SwitchRule[];
} {
  const switches = readArray(config.switches ?? config.items)
    .map(normalizeSwitch)
    .filter(Boolean) as SwitchRule[];
  const normalizedSwitches =
    switches.length > 0
      ? switches
      : [
          {
            id: 'example',
            label: '显示例题',
            description: '开启后先出现示范题。',
            initialOn: false,
            targetOn: true,
            hint: '学生第一次接触概念时需要示范题。',
          },
          {
            id: 'hard_mode',
            label: '挑战模式',
            description: '开启后直接进入高难题。',
            initialOn: true,
            targetOn: false,
            hint: '当前目标是入门理解，挑战模式应先关闭。',
          },
          {
            id: 'hint',
            label: '分步提示',
            description: '错误后给出分步提示。',
            initialOn: false,
            targetOn: true,
          },
        ];
  return {
    prompt: readString(config.prompt, '请调整开关组合，让系统满足目标条件。'),
    targetSummary: readString(
      config.targetSummary,
      '目标：适合第一次学习，先示范，再分步提示，不直接进入挑战。',
    ),
    successCriteria: readString(
      config.successCriteria,
      '所有开关状态都要符合目标条件。',
    ),
    switches: normalizedSwitches,
  };
}

function normalizeSwitch(value: unknown): SwitchRule | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const id = readString(item.id, '');
  const label = readString(item.label, '');
  if (!id || !label) return undefined;
  return {
    id,
    label,
    description: readString(item.description, ''),
    initialOn: readBoolean(item.initialOn ?? item.initial, false),
    targetOn: readBoolean(item.targetOn ?? item.answer ?? item.required, true),
    hint: readString(item.hint, ''),
  };
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function switchLabel(rule: SwitchRule, on: boolean): string {
  const detail = rule.description ? `\n${rule.description}` : '';
  return `${rule.label}\n${on ? 'ON' : 'OFF'}${detail}`;
}

function switchStyle(
  on: boolean,
  correct = true,
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '18px',
    color: '#111827',
    backgroundColor: !correct ? '#fca5a5' : on ? '#86efac' : '#e5e7eb',
    padding: { left: 16, right: 16, top: 12, bottom: 12 },
    fixedWidth: 250,
    fixedHeight: 74,
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
