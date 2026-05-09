import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-模块装配';
export const playletTitle = '模块装配';

interface ModulePart {
  id: string;
  label: string;
  description?: string;
}

interface AssemblySlot {
  id: string;
  label: string;
  accepts: string;
  hint?: string;
}

export class PlayletScene extends BasePlayletScene {
  private readonly assignments = new Map<string, string>();
  private selectedPartId?: string;
  private attempts = 0;
  private feedbackText?: Phaser.GameObjects.Text;
  private partCards: Array<{ part: ModulePart; card: Phaser.GameObjects.Text }> =
    [];
  private slotCards: Array<{ slot: AssemblySlot; card: Phaser.GameObjects.Text }> =
    [];

  constructor() {
    super('模块装配PlayletScene');
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
      0x1f2937,
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
      .text(cam.width * 0.28, 94, '组件库', headingStyle())
      .setOrigin(0.5);
    this.add
      .text(cam.width * 0.72, 94, config.assemblyTitle, headingStyle())
      .setOrigin(0.5);

    config.parts.forEach((part, index) => this.renderPart(part, index));
    config.slots.forEach((slot, index) => this.renderSlot(slot, index));
    this.renderSubmitButton();
    this.feedbackText = this.add
      .text(cam.width / 2, cam.height - 52, config.successCriteria, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#e5e7eb',
        align: 'center',
        wordWrap: { width: Math.min(760, cam.width - 80) },
      })
      .setOrigin(0.5);
  }

  private renderPart(part: ModulePart, index: number): void {
    const cam = this.cameras.main;
    const card = this.add
      .text(cam.width * 0.28, 145 + index * 72, partLabel(part), partStyle(false))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    card.on('pointerdown', () => this.selectPart(part, card));
    this.partCards.push({ part, card });
  }

  private renderSlot(slot: AssemblySlot, index: number): void {
    const cam = this.cameras.main;
    const card = this.add
      .text(cam.width * 0.72, 145 + index * 72, slotLabel(slot), slotStyle(false))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    card.on('pointerdown', () => this.assignSlot(slot, card));
    this.slotCards.push({ slot, card });
  }

  private renderSubmitButton(): void {
    const cam = this.cameras.main;
    this.add
      .text(cam.width / 2, cam.height - 116, '提交装配', buttonStyle())
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.submit());
  }

  private selectPart(part: ModulePart, card: Phaser.GameObjects.Text): void {
    this.selectedPartId = part.id;
    this.partCards.forEach((entry) => {
      entry.card.setStyle(partStyle(entry.part.id === part.id));
    });
    this.showFeedback(`已选择「${part.label}」，请选择右侧装配槽。`);
    card.setStyle(partStyle(true));
  }

  private assignSlot(slot: AssemblySlot, card: Phaser.GameObjects.Text): void {
    if (!this.selectedPartId) {
      this.showFeedback('请先从左侧选择一个组件。');
      return;
    }
    this.assignments.set(slot.id, this.selectedPartId);
    const selectedPart = this.partCards.find(
      (entry) => entry.part.id === this.selectedPartId,
    )?.part;
    card.setText(`${slot.label}\n已装入：${selectedPart?.label ?? this.selectedPartId}`);
    card.setStyle(slotStyle(true));
    this.showFeedback(`已把「${selectedPart?.label ?? this.selectedPartId}」放入「${slot.label}」。`);
    this.selectedPartId = undefined;
    this.partCards.forEach((entry) => entry.card.setStyle(partStyle(false)));
  }

  private submit(): void {
    this.attempts += 1;
    let correct = 0;
    for (const { slot, card } of this.slotCards) {
      const assigned = this.assignments.get(slot.id);
      const isCorrect = assigned === slot.accepts;
      if (isCorrect) correct += 1;
      card.setStyle(slotStyle(Boolean(assigned), isCorrect));
    }
    if (correct === this.slotCards.length) {
      this.finish('success', {
        attempts: this.attempts,
        evidence: [
          `${playletId}:assembly:${[...this.assignments.entries()]
            .map(([slotId, partId]) => `${slotId}=${partId}`)
            .join('|')}`,
        ],
      });
      return;
    }
    const firstWrong = this.slotCards.find(
      ({ slot }) => this.assignments.get(slot.id) !== slot.accepts,
    );
    this.showFeedback(
      firstWrong?.slot.hint ??
        `当前 ${correct}/${this.slotCards.length} 个槽位正确，红色槽位需要重新装配。`,
    );
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  assemblyTitle: string;
  successCriteria: string;
  parts: ModulePart[];
  slots: AssemblySlot[];
} {
  const parts = readArray(config.parts ?? config.modules ?? config.items)
    .map(normalizePart)
    .filter(Boolean) as ModulePart[];
  const slots = readArray(config.slots ?? config.targets)
    .map(normalizeSlot)
    .filter(Boolean) as AssemblySlot[];
  if (parts.length > 0 && slots.length > 0) {
    return {
      prompt: readString(config.prompt, '请把组件装配到正确槽位。'),
      assemblyTitle: readString(config.assemblyTitle, '装配区'),
      successCriteria: readString(config.successCriteria, '每个槽位只能放入匹配的功能组件。'),
      parts,
      slots,
    };
  }
  return {
    prompt: readString(config.prompt, '请把组件装配到正确槽位。'),
    assemblyTitle: readString(config.assemblyTitle, '面积模型'),
    successCriteria: readString(config.successCriteria, '把输入、计算和反馈模块放到正确位置。'),
    parts: [
      { id: 'input', label: '输入模块', description: '读取题目条件' },
      { id: 'formula', label: '公式模块', description: '执行面积计算' },
      { id: 'feedback', label: '反馈模块', description: '解释错因与提示' },
    ],
    slots: [
      { id: 'slot_1', label: '第一步：读取条件', accepts: 'input' },
      { id: 'slot_2', label: '第二步：套用公式', accepts: 'formula' },
      { id: 'slot_3', label: '第三步：给出反馈', accepts: 'feedback' },
    ],
  };
}

function normalizePart(value: unknown): ModulePart | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const id = readString(item.id, '');
  const label = readString(item.label, '');
  if (!id || !label) return undefined;
  return {
    id,
    label,
    description: readString(item.description ?? item.role, ''),
  };
}

function normalizeSlot(value: unknown): AssemblySlot | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const id = readString(item.id, '');
  const label = readString(item.label, '');
  const accepts = readString(item.accepts ?? item.answer ?? item.moduleId, '');
  if (!id || !label || !accepts) return undefined;
  return {
    id,
    label,
    accepts,
    hint: readString(item.hint, ''),
  };
}

function partLabel(part: ModulePart): string {
  return part.description ? `${part.label}\n${part.description}` : part.label;
}

function slotLabel(slot: AssemblySlot): string {
  return `${slot.label}\n等待组件`;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function headingStyle(): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '20px',
    color: '#bfdbfe',
  };
}

function partStyle(selected: boolean): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '17px',
    color: selected ? '#111827' : '#f8fafc',
    backgroundColor: selected ? '#fde68a' : '#334155',
    align: 'center',
    fixedWidth: 250,
    fixedHeight: 54,
    padding: { left: 12, right: 12, top: 8, bottom: 8 },
  };
}

function slotStyle(
  assigned: boolean,
  correct?: boolean,
): Phaser.Types.GameObjects.Text.TextStyle {
  const backgroundColor =
    correct === true ? '#bbf7d0' : correct === false ? '#fecaca' : assigned ? '#dbeafe' : '#f8fafc';
  return {
    fontFamily: 'Arial',
    fontSize: '17px',
    color: '#0f172a',
    backgroundColor,
    align: 'center',
    fixedWidth: 280,
    fixedHeight: 54,
    padding: { left: 12, right: 12, top: 8, bottom: 8 },
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
