import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-框选标注';
export const playletTitle = '框选标注';

interface AnnotationRegion {
  id: string;
  label: string;
  target: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  hint?: string;
  explanation?: string;
}

export class PlayletScene extends BasePlayletScene {
  private readonly selectedIds = new Set<string>();
  private attempts = 0;
  private feedbackText?: Phaser.GameObjects.Text;
  private regionViews: Array<{
    region: AnnotationRegion;
    box: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
  }> = [];

  constructor() {
    super('框选标注PlayletScene');
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
      0x1f2a44,
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

    const panel = this.buildPanel(config.canvasText);
    config.regions.forEach((region) => this.renderRegion(region, panel));
    this.renderSubmitButton();
    this.feedbackText = this.add
      .text(cam.width / 2, cam.height - 52, config.successCriteria, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#dbeafe',
        align: 'center',
        wordWrap: { width: Math.min(720, cam.width - 80) },
      })
      .setOrigin(0.5);
  }

  private buildPanel(canvasText: string): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    const cam = this.cameras.main;
    const panel = {
      x: cam.width / 2,
      y: 245,
      width: Math.min(720, cam.width - 100),
      height: 300,
    };
    this.add
      .rectangle(panel.x, panel.y, panel.width, panel.height, 0xf8fafc)
      .setStrokeStyle(3, 0x93c5fd);
    this.add
      .text(panel.x, panel.y, canvasText, {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#111827',
        align: 'left',
        wordWrap: { width: panel.width - 56 },
      })
      .setOrigin(0.5);
    return panel;
  }

  private renderRegion(
    region: AnnotationRegion,
    panel: { x: number; y: number; width: number; height: number },
  ): void {
    const x = panel.x - panel.width / 2 + region.x * panel.width;
    const y = panel.y - panel.height / 2 + region.y * panel.height;
    const width = region.width * panel.width;
    const height = region.height * panel.height;
    const box = this.add
      .rectangle(x, y, width, height, 0xffffff, 0.001)
      .setStrokeStyle(2, 0x64748b, 0.9)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(x, y - height / 2 - 14, region.label, tagStyle(false))
      .setOrigin(0.5);
    box.on('pointerdown', () => this.toggleRegion(region));
    label.setInteractive({ useHandCursor: true }).on('pointerdown', () =>
      this.toggleRegion(region),
    );
    this.regionViews.push({ region, box, label });
  }

  private renderSubmitButton(): void {
    const cam = this.cameras.main;
    this.add
      .text(cam.width / 2, cam.height - 116, '提交标注', buttonStyle())
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.submit());
  }

  private toggleRegion(region: AnnotationRegion): void {
    if (this.selectedIds.has(region.id)) {
      this.selectedIds.delete(region.id);
      this.updateRegionStyle(region.id);
      this.showFeedback(`已取消「${region.label}」。`);
      return;
    }
    this.selectedIds.add(region.id);
    this.updateRegionStyle(region.id);
    this.showFeedback(region.hint ?? `已框选「${region.label}」。`);
  }

  private updateRegionStyle(regionId: string, correct?: boolean): void {
    const view = this.regionViews.find(({ region }) => region.id === regionId);
    if (!view) return;
    const selected = this.selectedIds.has(regionId);
    const stroke =
      correct === true
        ? 0x16a34a
        : correct === false
          ? 0xdc2626
          : selected
            ? 0xfacc15
            : 0x64748b;
    view.box.setStrokeStyle(selected ? 4 : 2, stroke, 0.95);
    view.label.setStyle(tagStyle(selected, correct));
  }

  private submit(): void {
    this.attempts += 1;
    const targetIds = this.regionViews
      .filter(({ region }) => region.target)
      .map(({ region }) => region.id);
    let correct = 0;
    for (const { region } of this.regionViews) {
      const selected = this.selectedIds.has(region.id);
      const isCorrect = selected === region.target;
      if (isCorrect) correct += 1;
      this.updateRegionStyle(region.id, isCorrect);
    }

    if (correct === this.regionViews.length) {
      this.finish('success', {
        attempts: this.attempts,
        evidence: [`${playletId}:regions:${targetIds.join('|')}`],
      });
      return;
    }

    const missed = this.regionViews.find(
      ({ region }) => region.target && !this.selectedIds.has(region.id),
    );
    this.showFeedback(
      missed?.region.explanation ??
        `当前 ${correct}/${this.regionViews.length} 个标注判断正确，红框需要调整。`,
    );
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  canvasText: string;
  successCriteria: string;
  regions: AnnotationRegion[];
} {
  const prompt = readString(config.prompt, '请框选材料中的目标区域。');
  const canvasText = readString(
    config.canvasText,
    readString(
      config.text,
      '面积：平面图形或物体表面的大小。周长：围成图形一周的长度。',
    ),
  );
  const successCriteria = readString(
    config.successCriteria,
    '框选所有目标区域，避开干扰区域。',
  );
  const regions = readArray(config.regions ?? config.items)
    .map(normalizeRegion)
    .filter(Boolean) as AnnotationRegion[];
  if (regions.length > 0) return { prompt, canvasText, successCriteria, regions };
  return {
    prompt,
    canvasText,
    successCriteria: '框选面积定义和面积单位。',
    regions: [
      {
        id: 'area_definition',
        label: '面积定义',
        target: true,
        x: 0.36,
        y: 0.42,
        width: 0.42,
        height: 0.18,
      },
      {
        id: 'perimeter_definition',
        label: '周长定义',
        target: false,
        x: 0.38,
        y: 0.66,
        width: 0.46,
        height: 0.18,
      },
    ],
  };
}

function normalizeRegion(value: unknown): AnnotationRegion | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const region = value as Record<string, unknown>;
  const id = readString(region.id, '');
  const label = readString(region.label, '');
  const target = readBoolean(region.target, readBoolean(region.answer, false));
  if (!id || !label) return undefined;
  return {
    id,
    label,
    target,
    x: clampNumber(region.x, 0.5),
    y: clampNumber(region.y, 0.5),
    width: clampNumber(region.width, 0.24),
    height: clampNumber(region.height, 0.16),
    hint: readString(region.hint, ''),
    explanation: readString(region.explanation, ''),
  };
}

function clampNumber(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(0.04, Math.min(0.96, value));
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

function tagStyle(
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
          : '#e0f2fe';
  return {
    fontFamily: 'Arial',
    fontSize: '15px',
    color: '#111827',
    backgroundColor,
    padding: { left: 8, right: 8, top: 5, bottom: 5 },
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
