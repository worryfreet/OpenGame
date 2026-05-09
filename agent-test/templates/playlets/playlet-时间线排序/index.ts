import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-时间线排序';
export const playletTitle = '时间线排序';

interface TimelineItem {
  id: string;
  label: string;
  timeLabel: string;
  order: number;
  explanation?: string;
}

export class PlayletScene extends BasePlayletScene {
  private timelineItems: TimelineItem[] = [];
  private selectedIndex?: number;
  private attempts = 0;
  private feedbackText?: Phaser.GameObjects.Text;
  private eventCards: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('时间线排序PlayletScene');
  }

  create(): void {
    const cam = this.cameras.main;
    const config = normalizeConfig(this.node.config);
    this.timelineItems = shuffle(config.events);
    this.setRuntimeStatus('playlet', this.scene.key);
    this.add.rectangle(
      cam.width / 2,
      cam.height / 2,
      cam.width,
      cam.height,
      0x1f2937,
    );
    this.add
      .text(cam.width / 2, 46, config.prompt, {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: Math.min(780, cam.width - 80) },
      })
      .setOrigin(0.5);
    this.add
      .rectangle(cam.width / 2, 240, Math.min(720, cam.width - 120), 6, 0xf59e0b)
      .setAlpha(0.9);

    this.renderEvents();
    this.renderActions();
    this.feedbackText = this.add
      .text(
        cam.width / 2,
        cam.height - 54,
        '选择事件卡片后调整前后顺序，让时间线从早到晚成立。',
        {
          fontFamily: 'Arial',
          fontSize: '18px',
          color: '#fde68a',
          align: 'center',
          wordWrap: { width: Math.min(760, cam.width - 80) },
        },
      )
      .setOrigin(0.5);
  }

  private renderEvents(): void {
    for (const card of this.eventCards) card.destroy();
    const cam = this.cameras.main;
    const totalWidth = Math.min(720, cam.width - 100);
    const gap =
      this.timelineItems.length <= 1
        ? 0
        : totalWidth / Math.max(this.timelineItems.length - 1, 1);
    const startX = cam.width / 2 - totalWidth / 2;
    this.eventCards = this.timelineItems.map((event, index) => {
      const y = index % 2 === 0 ? 176 : 318;
      const card = this.add
        .text(
          startX + index * gap,
          y,
          `${event.timeLabel}\n${event.label}`,
          cardStyle(false),
        )
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => this.selectEvent(index));
      return card;
    });
  }

  private renderActions(): void {
    const cam = this.cameras.main;
    const actions = [
      { label: '前移', x: cam.width / 2 - 190, run: () => this.moveSelected(-1) },
      { label: '后移', x: cam.width / 2, run: () => this.moveSelected(1) },
      { label: '提交时间线', x: cam.width / 2 + 205, run: () => this.submit() },
    ];
    for (const action of actions) {
      this.add
        .text(action.x, cam.height - 116, action.label, buttonStyle())
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', action.run);
    }
  }

  private selectEvent(index: number): void {
    this.selectedIndex = index;
    this.eventCards.forEach((card, cardIndex) => {
      card.setStyle(cardStyle(cardIndex === index));
    });
    this.showFeedback(
      `已选择「${this.timelineItems[index].label}」，可以前移或后移。`,
    );
  }

  private moveSelected(delta: number): void {
    if (this.selectedIndex === undefined) {
      this.showFeedback('先选择一个事件。');
      return;
    }
    const nextIndex = this.selectedIndex + delta;
    if (nextIndex < 0 || nextIndex >= this.timelineItems.length) return;
    const current = this.timelineItems[this.selectedIndex];
    this.timelineItems[this.selectedIndex] = this.timelineItems[nextIndex];
    this.timelineItems[nextIndex] = current;
    this.selectedIndex = nextIndex;
    this.renderEvents();
    this.selectEvent(nextIndex);
  }

  private submit(): void {
    this.attempts += 1;
    const correctPositions = this.timelineItems.filter(
      (event, index) => event.order === index + 1,
    ).length;
    if (correctPositions === this.timelineItems.length) {
      this.finish('success', {
        attempts: this.attempts,
        evidence: [
          `${playletId}:timeline:${this.timelineItems.map((event) => event.id).join('>')}`,
        ],
      });
      return;
    }
    this.timelineItems.forEach((event, index) => {
      this.eventCards[index].setStyle(
        cardStyle(false, event.order === index + 1),
      );
    });
    const firstWrong = this.timelineItems.find(
      (event, index) => event.order !== index + 1,
    );
    this.showFeedback(
      firstWrong?.explanation ??
        `当前 ${correctPositions}/${this.timelineItems.length} 个事件位置正确，继续调整。`,
    );
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  events: TimelineItem[];
} {
  const prompt = readString(config.prompt, '请把事件按时间线排序。');
  const events = readArray(config.events ?? config.items)
    .map(normalizeEvent)
    .filter(Boolean) as TimelineItem[];
  if (events.length > 1) return { prompt, events };
  return {
    prompt,
    events: [
      {
        id: 'observe',
        label: '先观察题目给出的事实',
        timeLabel: '第一步',
        order: 1,
      },
      {
        id: 'compare',
        label: '再比较关键条件',
        timeLabel: '第二步',
        order: 2,
      },
      {
        id: 'conclude',
        label: '最后写出结论',
        timeLabel: '第三步',
        order: 3,
      },
    ],
  };
}

function normalizeEvent(value: unknown, index: number): TimelineItem | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const event = value as Record<string, unknown>;
  const id = readString(event.id, `event_${index + 1}`);
  const label = readString(event.label, '');
  if (!label) return undefined;
  const order = typeof event.order === 'number' ? event.order : index + 1;
  return {
    id,
    label,
    order,
    timeLabel: readString(
      event.timeLabel ?? event.time ?? event.date,
      `第 ${order} 步`,
    ),
    explanation: readString(event.explanation, ''),
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
          : '#f8fafc';
  return {
    fontFamily: 'Arial',
    fontSize: '16px',
    color: '#111827',
    backgroundColor,
    padding: { left: 12, right: 12, top: 10, bottom: 10 },
    fixedWidth: 140,
    fixedHeight: 96,
    align: 'center',
    wordWrap: { width: 116 },
  };
}

function buttonStyle(): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '19px',
    color: '#111827',
    backgroundColor: '#facc15',
    padding: { left: 22, right: 22, top: 11, bottom: 11 },
  };
}
