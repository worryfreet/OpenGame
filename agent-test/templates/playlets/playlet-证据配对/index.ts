import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-证据配对';
export const playletTitle = '证据配对';

interface EvidenceItem {
  id: string;
  label: string;
  claimId?: string;
  side?: 'claim' | 'evidence';
  explanation?: string;
}

export class PlayletScene extends BasePlayletScene {
  private selectedClaimId?: string;
  private readonly matchedEvidenceIds = new Set<string>();
  private attempts = 0;
  private feedbackText?: Phaser.GameObjects.Text;
  private claimCards: Array<{
    item: EvidenceItem;
    card: Phaser.GameObjects.Text;
  }> = [];
  private evidenceCards: Array<{
    item: EvidenceItem;
    card: Phaser.GameObjects.Text;
  }> = [];

  constructor() {
    super('证据配对PlayletScene');
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
      0x2f1d3a,
    );
    this.add
      .text(cam.width / 2, 48, config.prompt, {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: Math.min(760, cam.width - 80) },
      })
      .setOrigin(0.5);

    this.renderColumn('结论', config.claims, 190, true);
    this.renderColumn('证据', config.evidence, cam.width - 190, false);
    this.feedbackText = this.add
      .text(
        cam.width / 2,
        cam.height - 58,
        '先选择左侧结论，再选择右侧最能支持它的证据。',
        {
          fontFamily: 'Arial',
          fontSize: '18px',
          color: '#f3e8ff',
          align: 'center',
          wordWrap: { width: Math.min(720, cam.width - 80) },
        },
      )
      .setOrigin(0.5);
  }

  private renderColumn(
    title: string,
    items: EvidenceItem[],
    x: number,
    isClaim: boolean,
  ): void {
    this.add
      .text(x, 106, title, {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#f5d0fe',
      })
      .setOrigin(0.5);
    items.forEach((item, index) => {
      const card = this.add
        .text(x, 174 + index * 88, item.label, cardStyle('#faf5ff', '#2e1065'))
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      card.on('pointerdown', () =>
        isClaim
          ? this.selectClaim(item, card)
          : this.selectEvidence(item, card),
      );
      if (isClaim) this.claimCards.push({ item, card });
      else this.evidenceCards.push({ item, card });
    });
  }

  private selectClaim(item: EvidenceItem, card: Phaser.GameObjects.Text): void {
    this.selectedClaimId = item.id;
    for (const entry of this.claimCards) {
      entry.card.setStyle(cardStyle('#faf5ff', '#2e1065'));
    }
    card.setStyle(cardStyle('#fde68a', '#111827'));
    this.showFeedback(`已选择「${item.label}」，请选择能支撑它的证据。`);
  }

  private selectEvidence(
    item: EvidenceItem,
    card: Phaser.GameObjects.Text,
  ): void {
    if (!this.selectedClaimId) {
      this.showFeedback('先选择一个需要证明的结论。');
      return;
    }
    if (this.matchedEvidenceIds.has(item.id)) return;
    this.attempts += 1;
    if (item.claimId !== this.selectedClaimId) {
      card.setStyle(cardStyle('#fca5a5', '#111827'));
      this.showFeedback('这条证据不能直接支撑当前结论，换一条试试。');
      return;
    }
    this.matchedEvidenceIds.add(item.id);
    card.setStyle(cardStyle('#86efac', '#052e16'));
    const claim = this.claimCards.find(
      (entry) => entry.item.id === this.selectedClaimId,
    );
    claim?.card.setStyle(cardStyle('#86efac', '#052e16'));
    this.showFeedback(item.explanation ?? '证据配对正确。');
    this.selectedClaimId = undefined;
    if (this.claimCards.length === this.matchedEvidenceIds.size) {
      this.finish('success', {
        attempts: Math.max(this.attempts, 1),
        evidence: [`${playletId}:paired:${this.matchedEvidenceIds.size}`],
      });
    }
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  claims: EvidenceItem[];
  evidence: EvidenceItem[];
} {
  const prompt = readString(config.prompt, '请把结论和证据配对。');
  const items = readArray(config.items)
    .map(normalizeItem)
    .filter(Boolean) as EvidenceItem[];
  const claims = [
    ...readArray(config.claims).map(normalizeItem).filter(Boolean),
    ...items.filter((item) => item.side === 'claim'),
  ] as EvidenceItem[];
  const evidence = [
    ...readArray(config.evidence).map(normalizeItem).filter(Boolean),
    ...items.filter((item) => item.side === 'evidence'),
  ] as EvidenceItem[];
  if (claims.length > 0 && evidence.length > 0) {
    return { prompt, claims, evidence };
  }
  return {
    prompt,
    claims: [{ id: 'plant_maker', label: '植物是生产者' }],
    evidence: [
      {
        id: 'plant_photosynthesis',
        label: '植物能利用阳光制造养分',
        claimId: 'plant_maker',
      },
    ],
  };
}

function normalizeItem(value: unknown): EvidenceItem | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  const id = readString(item.id, '');
  const label = readString(item.label, '');
  if (!id || !label) return undefined;
  return {
    id,
    label,
    claimId: readString(item.claimId, readString(item.pairId, '')),
    side:
      item.side === 'claim' || item.side === 'evidence' ? item.side : undefined,
    explanation: readString(item.explanation, ''),
  };
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function cardStyle(
  backgroundColor: string,
  color: string,
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '17px',
    color,
    backgroundColor,
    padding: { left: 16, right: 16, top: 12, bottom: 12 },
    fixedWidth: 280,
    align: 'center',
    wordWrap: { width: 246 },
  };
}
