import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-证据链拼接';
export const playletTitle = '证据链拼接';

interface EvidenceItem {
  id: string;
  label: string;
  order: number;
  role?: string;
  explanation?: string;
}

export class PlayletScene extends BasePlayletScene {
  private readonly selectedIds: string[] = [];
  private attempts = 0;
  private chainItems: EvidenceItem[] = [];
  private feedbackText?: Phaser.GameObjects.Text;
  private poolCards: Array<{ item: EvidenceItem; card: Phaser.GameObjects.Text }> =
    [];
  private slotCards: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('证据链拼接PlayletScene');
  }

  create(): void {
    const cam = this.cameras.main;
    const config = normalizeConfig(this.node.config);
    this.chainItems = config.chainItems;
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
        wordWrap: { width: Math.min(780, cam.width - 80) },
      })
      .setOrigin(0.5);
    this.add
      .text(cam.width / 2, 84, config.claim, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#bfdbfe',
        align: 'center',
        wordWrap: { width: Math.min(760, cam.width - 80) },
      })
      .setOrigin(0.5);

    this.renderSlots();
    this.renderPool(shuffle(this.chainItems));
    this.renderActions();
    this.feedbackText = this.add
      .text(cam.width / 2, cam.height - 50, config.successCriteria, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#dbeafe',
        align: 'center',
        wordWrap: { width: Math.min(760, cam.width - 80) },
      })
      .setOrigin(0.5);
  }

  private renderSlots(): void {
    const cam = this.cameras.main;
    const width = Math.min(700, cam.width - 100);
    const gap =
      this.chainItems.length <= 1
        ? 0
        : width / Math.max(this.chainItems.length - 1, 1);
    const startX = cam.width / 2 - width / 2;
    this.slotCards = this.chainItems.map((_, index) => {
      const card = this.add
        .text(startX + index * gap, 178, `第 ${index + 1} 环\n待选择`, slotStyle())
        .setOrigin(0.5);
      if (index < this.chainItems.length - 1) {
        this.add
          .text(startX + index * gap + gap / 2, 178, '->', {
            fontFamily: 'Arial',
            fontSize: '22px',
            color: '#93c5fd',
          })
          .setOrigin(0.5);
      }
      return card;
    });
  }

  private renderPool(items: EvidenceItem[]): void {
    const cam = this.cameras.main;
    this.add
      .text(cam.width / 2, 266, '选择证据卡，按“事实 -> 推理 -> 结论”的顺序拼接', {
        fontFamily: 'Arial',
        fontSize: '17px',
        color: '#e0f2fe',
      })
      .setOrigin(0.5);
    const columns = Math.min(3, Math.max(items.length, 1));
    items.forEach((item, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = cam.width / 2 + (col - (columns - 1) / 2) * 230;
      const y = 328 + row * 76;
      const card = this.add
        .text(x, y, formatEvidenceLabel(item), poolStyle(false))
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => this.selectEvidence(item, card));
      this.poolCards.push({ item, card });
    });
  }

  private renderActions(): void {
    const cam = this.cameras.main;
    this.add
      .text(cam.width / 2 - 110, cam.height - 106, '撤回一步', buttonStyle())
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.undo());
    this.add
      .text(cam.width / 2 + 120, cam.height - 106, '提交证据链', buttonStyle())
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.submit());
  }

  private selectEvidence(
    item: EvidenceItem,
    card: Phaser.GameObjects.Text,
  ): void {
    if (this.selectedIds.includes(item.id)) {
      this.showFeedback('这张证据卡已经放入链条。');
      return;
    }
    if (this.selectedIds.length >= this.chainItems.length) {
      this.showFeedback('证据链已经填满，可以提交或先撤回。');
      return;
    }
    this.selectedIds.push(item.id);
    card.setStyle(poolStyle(true));
    const slot = this.slotCards[this.selectedIds.length - 1];
    slot?.setText(`第 ${this.selectedIds.length} 环\n${item.label}`);
    this.showFeedback(`已放入「${item.label}」，继续选择下一环证据。`);
  }

  private undo(): void {
    const removedId = this.selectedIds.pop();
    if (!removedId) {
      this.showFeedback('当前还没有可撤回的证据。');
      return;
    }
    const slot = this.slotCards[this.selectedIds.length];
    slot?.setText(`第 ${this.selectedIds.length + 1} 环\n待选择`);
    const pool = this.poolCards.find((entry) => entry.item.id === removedId);
    pool?.card.setStyle(poolStyle(false));
    this.showFeedback('已撤回上一环，可以重新选择。');
  }

  private submit(): void {
    this.attempts += 1;
    if (this.selectedIds.length < this.chainItems.length) {
      this.showFeedback('证据链还没有拼完整。');
      return;
    }
    const ordered = [...this.chainItems].sort((a, b) => a.order - b.order);
    const wrongIndex = this.selectedIds.findIndex(
      (id, index) => id !== ordered[index]?.id,
    );
    if (wrongIndex === -1) {
      this.finish('success', {
        attempts: this.attempts,
        evidence: [`${playletId}:chain:${this.selectedIds.join('>')}`],
      });
      return;
    }
    this.slotCards.forEach((slot, index) =>
      slot.setStyle(slotStyle(index !== wrongIndex)),
    );
    const selected = this.chainItems.find(
      (item) => item.id === this.selectedIds[wrongIndex],
    );
    this.showFeedback(
      selected?.explanation ??
        `第 ${wrongIndex + 1} 环证据顺序不成立，先找最基础事实，再接推理。`,
    );
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  claim: string;
  successCriteria: string;
  chainItems: EvidenceItem[];
} {
  const prompt = readString(config.prompt, '请把证据卡拼成完整证据链。');
  const claim = readString(config.claim ?? config.question, '用证据支持结论。');
  const successCriteria = readString(
    config.successCriteria,
    '按事实、推理、结论的顺序完成证据链。',
  );
  const chainItems = readArray(config.chain ?? config.items)
    .map(normalizeEvidence)
    .filter(Boolean) as EvidenceItem[];
  if (chainItems.length > 1) {
    return { prompt, claim, successCriteria, chainItems };
  }
  return {
    prompt,
    claim,
    successCriteria,
    chainItems: [
      { id: 'fact', label: '题目给出长方形长 6、宽 4', order: 1, role: '事实' },
      { id: 'rule', label: '长方形面积 = 长 x 宽', order: 2, role: '规则' },
      { id: 'result', label: '面积是 24 平方单位', order: 3, role: '结论' },
    ],
  };
}

function normalizeEvidence(
  value: unknown,
  index: number,
): EvidenceItem | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const id = readString(item.id, `evidence_${index + 1}`);
  const label = readString(item.label ?? item.text, '');
  if (!label) return undefined;
  return {
    id,
    label,
    order: typeof item.order === 'number' ? item.order : index + 1,
    role: readString(item.role ?? item.type, ''),
    explanation: readString(item.explanation, ''),
  };
}

function shuffle<T>(values: T[]): T[] {
  if (values.length <= 2) return [...values].reverse();
  return [values[1], values[2], values[0], ...values.slice(3)];
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function formatEvidenceLabel(item: EvidenceItem): string {
  return item.role ? `${item.role}\n${item.label}` : item.label;
}

function slotStyle(correct = true): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '16px',
    color: '#111827',
    backgroundColor: correct ? '#dbeafe' : '#fca5a5',
    padding: { left: 10, right: 10, top: 9, bottom: 9 },
    fixedWidth: 160,
    fixedHeight: 82,
    align: 'center',
    wordWrap: { width: 138 },
  };
}

function poolStyle(selected: boolean): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '16px',
    color: '#111827',
    backgroundColor: selected ? '#86efac' : '#f8fafc',
    padding: { left: 12, right: 12, top: 10, bottom: 10 },
    fixedWidth: 200,
    fixedHeight: 58,
    align: 'center',
    wordWrap: { width: 176 },
  };
}

function buttonStyle(): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '18px',
    color: '#111827',
    backgroundColor: '#facc15',
    padding: { left: 20, right: 20, top: 10, bottom: 10 },
  };
}
