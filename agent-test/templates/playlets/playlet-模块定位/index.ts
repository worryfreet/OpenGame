import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-模块定位';
export const playletTitle = '模块定位';

interface ModuleItem {
  id: string;
  label: string;
  description?: string;
  target: boolean;
  x: number;
  y: number;
  hint?: string;
  explanation?: string;
}

export class PlayletScene extends BasePlayletScene {
  private readonly selectedIds = new Set<string>();
  private attempts = 0;
  private feedbackText?: Phaser.GameObjects.Text;
  private moduleViews: Array<{
    item: ModuleItem;
    card: Phaser.GameObjects.Text;
  }> = [];

  constructor() {
    super('模块定位PlayletScene');
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
      0x18322f,
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
      .text(cam.width / 2, 82, config.systemTitle, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ccfbf1',
        align: 'center',
        wordWrap: { width: Math.min(720, cam.width - 80) },
      })
      .setOrigin(0.5);

    const panel = this.buildPanel();
    config.modules.forEach((item) => this.renderModule(item, panel));
    this.renderSubmitButton();
    this.feedbackText = this.add
      .text(cam.width / 2, cam.height - 52, config.successCriteria, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ccfbf1',
        align: 'center',
        wordWrap: { width: Math.min(760, cam.width - 80) },
      })
      .setOrigin(0.5);
  }

  private buildPanel(): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    const cam = this.cameras.main;
    const panel = {
      x: cam.width / 2,
      y: 262,
      width: Math.min(720, cam.width - 100),
      height: 300,
    };
    this.add
      .rectangle(panel.x, panel.y, panel.width, panel.height, 0xf0fdfa)
      .setStrokeStyle(3, 0x2dd4bf);
    return panel;
  }

  private renderModule(
    item: ModuleItem,
    panel: { x: number; y: number; width: number; height: number },
  ): void {
    const x = panel.x - panel.width / 2 + item.x * panel.width;
    const y = panel.y - panel.height / 2 + item.y * panel.height;
    const label = item.description
      ? `${item.label}\n${item.description}`
      : item.label;
    const card = this.add
      .text(x, y, label, moduleStyle(false))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    card.on('pointerdown', () => this.toggleModule(item, card));
    this.moduleViews.push({ item, card });
  }

  private renderSubmitButton(): void {
    const cam = this.cameras.main;
    this.add
      .text(cam.width / 2, cam.height - 116, '提交定位', buttonStyle())
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.submit());
  }

  private toggleModule(item: ModuleItem, card: Phaser.GameObjects.Text): void {
    if (this.selectedIds.has(item.id)) {
      this.selectedIds.delete(item.id);
      card.setStyle(moduleStyle(false));
      this.showFeedback(`已取消「${item.label}」。`);
      return;
    }
    this.selectedIds.add(item.id);
    card.setStyle(moduleStyle(true));
    this.showFeedback(item.hint ?? `已定位「${item.label}」。`);
  }

  private submit(): void {
    this.attempts += 1;
    const targetIds = this.moduleViews
      .filter(({ item }) => item.target)
      .map(({ item }) => item.id);
    let correct = 0;
    for (const { item, card } of this.moduleViews) {
      const selected = this.selectedIds.has(item.id);
      const isCorrect = selected === item.target;
      if (isCorrect) correct += 1;
      card.setStyle(moduleStyle(selected, isCorrect));
    }

    if (correct === this.moduleViews.length) {
      this.finish('success', {
        attempts: this.attempts,
        evidence: [`${playletId}:modules:${targetIds.join('|')}`],
      });
      return;
    }

    const missed = this.moduleViews.find(
      ({ item }) => item.target && !this.selectedIds.has(item.id),
    );
    const falsePositive = this.moduleViews.find(
      ({ item }) => !item.target && this.selectedIds.has(item.id),
    );
    this.showFeedback(
      missed?.item.explanation ??
        falsePositive?.item.explanation ??
        `当前 ${correct}/${this.moduleViews.length} 个模块判断正确，红色模块需要调整。`,
    );
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  systemTitle: string;
  successCriteria: string;
  modules: ModuleItem[];
} {
  const prompt = readString(config.prompt, '请在系统图中定位目标模块。');
  const systemTitle = readString(
    config.systemTitle,
    readString(config.diagramTitle, '面积学习流程模块图'),
  );
  const successCriteria = readString(
    config.successCriteria,
    '选中所有负责当前任务的模块。',
  );
  const modules = readArray(config.modules ?? config.items)
    .map(normalizeModule)
    .filter(Boolean) as ModuleItem[];
  if (modules.length > 0) return { prompt, systemTitle, successCriteria, modules };
  return {
    prompt,
    systemTitle,
    successCriteria: '定位负责单位判断和公式应用的模块。',
    modules: [
      {
        id: 'unit_checker',
        label: '单位判断',
        description: '识别平方单位',
        target: true,
        x: 0.25,
        y: 0.36,
      },
      {
        id: 'formula_engine',
        label: '公式应用',
        description: '长 x 宽',
        target: true,
        x: 0.5,
        y: 0.58,
      },
      {
        id: 'avatar_skin',
        label: '角色装扮',
        description: '外观选择',
        target: false,
        x: 0.75,
        y: 0.36,
      },
    ],
  };
}

function normalizeModule(value: unknown): ModuleItem | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const id = readString(item.id, '');
  const label = readString(item.label, '');
  if (!id || !label) return undefined;
  return {
    id,
    label,
    description: readString(item.description, ''),
    target: readBoolean(item.target ?? item.answer ?? item.correct, false),
    x: clamp01(item.x, 0.5),
    y: clamp01(item.y, 0.5),
    hint: readString(item.hint, ''),
    explanation: readString(item.explanation ?? item.reason, ''),
  };
}

function clamp01(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(0.08, Math.min(0.92, value));
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

function moduleStyle(
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
          : '#ffffff';
  return {
    fontFamily: 'Arial',
    fontSize: '15px',
    color: '#111827',
    backgroundColor,
    padding: { left: 10, right: 10, top: 8, bottom: 8 },
    fixedWidth: 150,
    fixedHeight: 64,
    align: 'center',
    lineSpacing: 3,
    wordWrap: { width: 130 },
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
