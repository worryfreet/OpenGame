import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-滑杆调参';
export const playletTitle = '滑杆调参';

interface SliderParam {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  targetMin: number;
  targetMax: number;
  unit?: string;
  hint?: string;
}

interface SliderControl {
  param: SliderParam;
  knob: Phaser.GameObjects.Rectangle;
  valueText: Phaser.GameObjects.Text;
  trackX: number;
  trackWidth: number;
}

export class PlayletScene extends BasePlayletScene {
  private attempts = 0;
  private feedbackText?: Phaser.GameObjects.Text;
  private readonly controls: SliderControl[] = [];

  constructor() {
    super('滑杆调参PlayletScene');
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
      0x172554,
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
    config.params.forEach((param, index) => this.renderSlider(param, index));
    this.renderSubmitButton();
    this.feedbackText = this.add
      .text(cam.width / 2, cam.height - 52, config.successCriteria, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#dbeafe',
        align: 'center',
        wordWrap: { width: Math.min(760, cam.width - 80) },
      })
      .setOrigin(0.5);
  }

  private renderSlider(param: SliderParam, index: number): void {
    const cam = this.cameras.main;
    const y = 130 + index * 92;
    const trackWidth = Math.min(430, cam.width - 260);
    const trackX = cam.width / 2 - trackWidth / 2;
    this.add
      .text(trackX, y - 30, param.label, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5);
    const valueText = this.add
      .text(trackX + trackWidth, y - 30, formatValue(param), {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#bfdbfe',
      })
      .setOrigin(1, 0.5);
    const track = this.add
      .rectangle(trackX + trackWidth / 2, y, trackWidth, 10, 0x93c5fd)
      .setInteractive({ useHandCursor: true });
    const target = targetRect(param, trackX, trackWidth);
    this.add.rectangle(target.x, y, target.width, 18, 0x86efac, 0.55);
    const knob = this.add
      .rectangle(valueToX(param.value, param, trackX, trackWidth), y, 22, 34, 0xfacc15)
      .setStrokeStyle(2, 0x111827)
      .setInteractive({ draggable: true, useHandCursor: true });
    track.on('pointerdown', (pointer: Phaser.Input.Pointer) =>
      this.updateSlider(param, knob, valueText, pointer.worldX, trackX, trackWidth),
    );
    knob.on('drag', (pointer: Phaser.Input.Pointer, dragX: number) =>
      this.updateSlider(param, knob, valueText, dragX, trackX, trackWidth),
    );
    this.input.setDraggable(knob);
    this.controls.push({ param, knob, valueText, trackX, trackWidth });
  }

  private renderSubmitButton(): void {
    const cam = this.cameras.main;
    this.add
      .text(cam.width / 2, cam.height - 116, '提交参数', buttonStyle())
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.submit());
  }

  private updateSlider(
    param: SliderParam,
    knob: Phaser.GameObjects.Rectangle,
    valueText: Phaser.GameObjects.Text,
    pointerX: number,
    trackX: number,
    trackWidth: number,
  ): void {
    param.value = snapValue(xToValue(pointerX, param, trackX, trackWidth), param.step);
    knob.x = valueToX(param.value, param, trackX, trackWidth);
    valueText.setText(formatValue(param));
    this.showFeedback(`${param.label} 调整为 ${formatValue(param)}。`);
  }

  private submit(): void {
    this.attempts += 1;
    let correct = 0;
    const wrong: SliderParam[] = [];
    for (const control of this.controls) {
      const inRange =
        control.param.value >= control.param.targetMin &&
        control.param.value <= control.param.targetMax;
      if (inRange) correct += 1;
      else wrong.push(control.param);
      control.knob.setFillStyle(inRange ? 0x86efac : 0xfca5a5);
    }
    if (correct === this.controls.length) {
      this.finish('success', {
        attempts: this.attempts,
        evidence: [
          `${playletId}:params:${this.controls
            .map(({ param }) => `${param.id}=${param.value}`)
            .join('|')}`,
        ],
      });
      return;
    }
    const firstWrong = wrong[0];
    this.showFeedback(
      firstWrong?.hint ??
        `${firstWrong?.label ?? '参数'} 还没有进入目标区间，绿色区段代表可接受范围。`,
    );
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  successCriteria: string;
  params: SliderParam[];
} {
  const params = readArray(config.params ?? config.sliders ?? config.items)
    .map(normalizeParam)
    .filter(Boolean) as SliderParam[];
  return {
    prompt: readString(config.prompt, '请调节参数，让系统进入目标状态。'),
    successCriteria: readString(config.successCriteria, '所有参数都需要落入绿色目标区间。'),
    params:
      params.length > 0
        ? params
        : [
            {
              id: 'speed',
              label: '讲解速度',
              min: 0,
              max: 10,
              step: 1,
              value: 3,
              targetMin: 5,
              targetMax: 7,
              unit: '档',
              hint: '速度太低会拖慢练习节奏，试着调到 5 到 7 档。',
            },
            {
              id: 'hint',
              label: '提示强度',
              min: 0,
              max: 10,
              step: 1,
              value: 8,
              targetMin: 3,
              targetMax: 5,
              unit: '档',
              hint: '提示过强会直接暴露答案，调低到中间区间。',
            },
          ],
  };
}

function normalizeParam(value: unknown): SliderParam | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const id = readString(item.id, '');
  const label = readString(item.label, '');
  if (!id || !label) return undefined;
  const min = readNumber(item.min, 0);
  const max = readNumber(item.max, 10);
  const targetMin = readNumber(item.targetMin ?? item.answerMin, min);
  const targetMax = readNumber(item.targetMax ?? item.answerMax, max);
  return {
    id,
    label,
    min,
    max,
    step: Math.max(0.1, readNumber(item.step, 1)),
    value: clamp(readNumber(item.value ?? item.initial, min), min, max),
    targetMin: clamp(targetMin, min, max),
    targetMax: clamp(targetMax, min, max),
    unit: readString(item.unit, ''),
    hint: readString(item.hint, ''),
  };
}

function targetRect(
  param: SliderParam,
  trackX: number,
  trackWidth: number,
): { x: number; width: number } {
  const left = valueToX(param.targetMin, param, trackX, trackWidth);
  const right = valueToX(param.targetMax, param, trackX, trackWidth);
  return { x: (left + right) / 2, width: Math.max(8, right - left) };
}

function valueToX(
  value: number,
  param: SliderParam,
  trackX: number,
  trackWidth: number,
): number {
  const ratio = (value - param.min) / Math.max(1, param.max - param.min);
  return trackX + clamp(ratio, 0, 1) * trackWidth;
}

function xToValue(
  x: number,
  param: SliderParam,
  trackX: number,
  trackWidth: number,
): number {
  const ratio = clamp((x - trackX) / trackWidth, 0, 1);
  return param.min + ratio * (param.max - param.min);
}

function snapValue(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function formatValue(param: SliderParam): string {
  return `${Number(param.value.toFixed(2))}${param.unit ?? ''}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
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
