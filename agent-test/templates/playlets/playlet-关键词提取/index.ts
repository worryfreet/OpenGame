import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-关键词提取';
export const playletTitle = '关键词提取';

interface KeywordItem {
  id: string;
  label: string;
  answer: boolean;
  hint?: string;
  explanation?: string;
}

export class PlayletScene extends BasePlayletScene {
  private readonly selectedIds = new Set<string>();
  private attempts = 0;
  private feedbackText?: Phaser.GameObjects.Text;
  private keywordCards: Array<{
    item: KeywordItem;
    card: Phaser.GameObjects.Text;
  }> = [];

  constructor() {
    super('关键词提取PlayletScene');
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
      0x17352f,
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
      .text(cam.width / 2, 138, config.sourceText, {
        fontFamily: 'Arial',
        fontSize: '19px',
        color: '#ecfeff',
        backgroundColor: '#0f766e',
        padding: { left: 18, right: 18, top: 14, bottom: 14 },
        fixedWidth: Math.min(720, cam.width - 100),
        fixedHeight: 108,
        align: 'left',
        wordWrap: { width: Math.min(680, cam.width - 140) },
      })
      .setOrigin(0.5);

    config.keywords.forEach((item, index) => this.renderKeyword(item, index));
    this.renderSubmitButton();
    this.feedbackText = this.add
      .text(cam.width / 2, cam.height - 52, config.successCriteria, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ccfbf1',
        align: 'center',
        wordWrap: { width: Math.min(720, cam.width - 80) },
      })
      .setOrigin(0.5);
  }

  private renderKeyword(item: KeywordItem, index: number): void {
    const cam = this.cameras.main;
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = cam.width / 2 - 210 + col * 210;
    const y = 260 + row * 76;
    const card = this.add
      .text(x, y, item.label, cardStyle(false))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    card.on('pointerdown', () => this.toggleKeyword(item, card));
    this.keywordCards.push({ item, card });
  }

  private renderSubmitButton(): void {
    const cam = this.cameras.main;
    this.add
      .text(cam.width / 2, cam.height - 116, '提交关键词', buttonStyle())
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.submit());
  }

  private toggleKeyword(
    item: KeywordItem,
    card: Phaser.GameObjects.Text,
  ): void {
    if (this.selectedIds.has(item.id)) {
      this.selectedIds.delete(item.id);
      card.setStyle(cardStyle(false));
      this.showFeedback(`已取消「${item.label}」。`);
      return;
    }
    this.selectedIds.add(item.id);
    card.setStyle(cardStyle(true));
    this.showFeedback(item.hint ?? `已标记「${item.label}」。`);
  }

  private submit(): void {
    this.attempts += 1;
    const answerIds = this.keywordCards
      .filter(({ item }) => item.answer)
      .map(({ item }) => item.id);
    let correct = 0;
    for (const { item, card } of this.keywordCards) {
      const selected = this.selectedIds.has(item.id);
      const isCorrect = selected === item.answer;
      if (isCorrect) correct += 1;
      card.setStyle(cardStyle(selected, isCorrect));
    }

    if (correct === this.keywordCards.length) {
      this.finish('success', {
        attempts: this.attempts,
        evidence: [`${playletId}:keywords:${answerIds.join('|')}`],
      });
      return;
    }

    const missed = this.keywordCards.find(
      ({ item }) => item.answer && !this.selectedIds.has(item.id),
    );
    this.showFeedback(
      missed?.item.explanation ??
        `当前 ${correct}/${this.keywordCards.length} 个判断正确，保留绿色并调整红色。`,
    );
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  sourceText: string;
  successCriteria: string;
  keywords: KeywordItem[];
} {
  const prompt = readString(config.prompt, '请从材料中提取关键概念。');
  const sourceText = readString(
    config.sourceText,
    readString(config.text, '面积表示平面图形或物体表面的大小，常用单位有平方米和平方厘米。'),
  );
  const successCriteria = readString(
    config.successCriteria,
    '选中所有关键概念，避开干扰词。',
  );
  const keywords = readArray(config.keywords ?? config.items)
    .map(normalizeKeyword)
    .filter(Boolean) as KeywordItem[];
  if (keywords.length > 0) {
    return { prompt, sourceText, successCriteria, keywords };
  }
  return {
    prompt,
    sourceText,
    successCriteria: '提取核心概念和单位。',
    keywords: [
      { id: 'area', label: '面积', answer: true },
      { id: 'surface_size', label: '表面大小', answer: true },
      { id: 'meter', label: '米', answer: false },
      { id: 'square_meter', label: '平方米', answer: true },
    ],
  };
}

function normalizeKeyword(value: unknown): KeywordItem | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const id = readString(item.id, '');
  const label = readString(item.label, readString(item.keyword, ''));
  const answer = readBoolean(item.answer, readBoolean(item.target, false));
  if (!id || !label) return undefined;
  return {
    id,
    label,
    answer,
    hint: readString(item.hint, ''),
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
          ? '#99f6e4'
          : '#f8fafc';
  return {
    fontFamily: 'Arial',
    fontSize: '18px',
    color: '#111827',
    backgroundColor,
    padding: { left: 14, right: 14, top: 12, bottom: 12 },
    fixedWidth: 178,
    fixedHeight: 56,
    align: 'center',
    wordWrap: { width: 150 },
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
