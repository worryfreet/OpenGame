import { BasePlayletScene } from '../shared';

export const playletId = 'playlet-流程接线';
export const playletTitle = '流程接线';

interface FlowNode {
  id: string;
  label: string;
  role?: string;
  x?: number;
  y?: number;
}

interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  explanation?: string;
}

export class PlayletScene extends BasePlayletScene {
  private selectedNodeId?: string;
  private readonly connectedEdges = new Set<string>();
  private attempts = 0;
  private expectedEdges: FlowEdge[] = [];
  private feedbackText?: Phaser.GameObjects.Text;
  private lineLayer?: Phaser.GameObjects.Graphics;
  private nodeCards: Array<{ node: FlowNode; card: Phaser.GameObjects.Text }> =
    [];

  constructor() {
    super('流程接线PlayletScene');
  }

  create(): void {
    const cam = this.cameras.main;
    const config = normalizeConfig(this.node.config);
    this.expectedEdges = config.edges;
    this.setRuntimeStatus('playlet', this.scene.key);
    this.add.rectangle(
      cam.width / 2,
      cam.height / 2,
      cam.width,
      cam.height,
      0x0f172a,
    );
    this.lineLayer = this.add.graphics();
    this.add
      .text(cam.width / 2, 46, config.prompt, {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: Math.min(780, cam.width - 80) },
      })
      .setOrigin(0.5);

    config.nodes.forEach((node, index) =>
      this.renderNode(node, resolvePosition(node, index, config.nodes.length, cam)),
    );
    this.feedbackText = this.add
      .text(
        cam.width / 2,
        cam.height - 54,
        '先点流程上游节点，再点它的下一步，完成所有正确接线。',
        {
          fontFamily: 'Arial',
          fontSize: '18px',
          color: '#bfdbfe',
          align: 'center',
          wordWrap: { width: Math.min(760, cam.width - 80) },
        },
      )
      .setOrigin(0.5);
  }

  private renderNode(
    node: FlowNode,
    position: { x: number; y: number },
  ): void {
    const card = this.add
      .text(position.x, position.y, formatNodeLabel(node), nodeStyle(false))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    card.on('pointerdown', () => this.selectNode(node, card));
    this.nodeCards.push({ node, card });
  }

  private selectNode(node: FlowNode, card: Phaser.GameObjects.Text): void {
    if (!this.selectedNodeId) {
      this.selectedNodeId = node.id;
      this.nodeCards.forEach((entry) => {
        entry.card.setStyle(nodeStyle(entry.node.id === node.id));
      });
      this.showFeedback(`已选择「${node.label}」，请选择下一步节点。`);
      return;
    }

    if (this.selectedNodeId === node.id) {
      this.selectedNodeId = undefined;
      card.setStyle(nodeStyle(false));
      this.showFeedback('已取消选择，请重新选择流程上游节点。');
      return;
    }

    this.attempts += 1;
    const edge = this.expectedEdges.find(
      (candidate) =>
        candidate.from === this.selectedNodeId && candidate.to === node.id,
    );
    const selectedCard = this.nodeCards.find(
      (entry) => entry.node.id === this.selectedNodeId,
    )?.card;
    if (!edge || !selectedCard) {
      card.setStyle(nodeStyle(false, false));
      this.showFeedback('这条接线不符合流程因果，重新选择上游节点。');
      this.selectedNodeId = undefined;
      return;
    }

    const edgeKey = serializeEdge(edge);
    if (this.connectedEdges.has(edgeKey)) {
      this.showFeedback('这条线已经接好，继续寻找其他流程关系。');
      this.selectedNodeId = undefined;
      return;
    }

    this.connectedEdges.add(edgeKey);
    selectedCard.setStyle(nodeStyle(false, true));
    card.setStyle(nodeStyle(false, true));
    this.drawEdge(selectedCard, card, edge.label);
    this.selectedNodeId = undefined;
    this.showFeedback(edge.explanation ?? '接线正确。');
    if (this.connectedEdges.size === this.expectedEdges.length) {
      this.finish('success', {
        attempts: Math.max(this.attempts, 1),
        evidence: [
          `${playletId}:wired:${[...this.connectedEdges].join('|')}`,
        ],
      });
    }
  }

  private drawEdge(
    from: Phaser.GameObjects.Text,
    to: Phaser.GameObjects.Text,
    label?: string,
  ): void {
    this.lineLayer?.lineStyle(4, 0x38bdf8, 0.9).lineBetween(from.x, from.y, to.x, to.y);
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    this.add.circle(to.x, to.y, 7, 0x38bdf8).setDepth(1);
    if (label) {
      this.add
        .text(midX, midY - 18, label, {
          fontFamily: 'Arial',
          fontSize: '14px',
          color: '#e0f2fe',
          backgroundColor: '#0f172a',
          padding: { left: 6, right: 6, top: 3, bottom: 3 },
        })
        .setOrigin(0.5)
        .setDepth(2);
    }
  }

  private showFeedback(message: string): void {
    this.feedbackText?.setText(message);
  }
}

function normalizeConfig(config: Record<string, unknown>): {
  prompt: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
} {
  const prompt = readString(config.prompt, '请把流程节点按正确关系接线。');
  const nodes = readArray(config.nodes ?? config.items)
    .map(normalizeNode)
    .filter(Boolean) as FlowNode[];
  const edges = [
    ...readArray(config.edges).map(normalizeEdge).filter(Boolean),
    ...nodes.flatMap((node) => edgesFromNode(node, config)),
  ] as FlowEdge[];
  if (nodes.length > 1 && edges.length > 0) return { prompt, nodes, edges };
  return {
    prompt,
    nodes: [
      { id: 'question', label: '提出问题', role: '起点' },
      { id: 'evidence', label: '收集证据', role: '过程' },
      { id: 'answer', label: '形成结论', role: '终点' },
    ],
    edges: [
      { from: 'question', to: 'evidence', label: '驱动观察' },
      { from: 'evidence', to: 'answer', label: '支持结论' },
    ],
  };
}

function normalizeNode(value: unknown): FlowNode | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const node = value as Record<string, unknown>;
  const id = readString(node.id, '');
  const label = readString(node.label, '');
  if (!id || !label) return undefined;
  return {
    id,
    label,
    role: readString(node.role ?? node.type, ''),
    x: typeof node.x === 'number' ? node.x : undefined,
    y: typeof node.y === 'number' ? node.y : undefined,
  };
}

function normalizeEdge(value: unknown): FlowEdge | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const edge = value as Record<string, unknown>;
  const from = readString(edge.from, '');
  const to = readString(edge.to, '');
  if (!from || !to) return undefined;
  return {
    from,
    to,
    label: readString(edge.label, ''),
    explanation: readString(edge.explanation, ''),
  };
}

function edgesFromNode(
  node: FlowNode,
  config: Record<string, unknown>,
): FlowEdge[] {
  const rawNodes = readArray(config.nodes ?? config.items);
  const source = rawNodes.find((value) => {
    if (!value || typeof value !== 'object') return false;
    return readString((value as Record<string, unknown>).id, '') === node.id;
  }) as Record<string, unknown> | undefined;
  const nextIds = [
    readString(source?.nextId, ''),
    ...readArray(source?.nextIds).map((id) => readString(id, '')),
  ].filter(Boolean);
  return nextIds.map((to) => ({ from: node.id, to }));
}

function resolvePosition(
  node: FlowNode,
  index: number,
  total: number,
  cam: Phaser.Cameras.Scene2D.Camera,
): { x: number; y: number } {
  if (typeof node.x === 'number' && typeof node.y === 'number') {
    return {
      x: node.x <= 1 ? node.x * cam.width : node.x,
      y: node.y <= 1 ? node.y * cam.height : node.y,
    };
  }
  const columns = Math.min(4, total);
  const row = Math.floor(index / columns);
  const column = index % columns;
  const usableWidth = Math.min(700, cam.width - 120);
  const startX = cam.width / 2 - usableWidth / 2;
  const gap = columns <= 1 ? 0 : usableWidth / (columns - 1);
  return {
    x: startX + column * gap,
    y: 170 + row * 132,
  };
}

function formatNodeLabel(node: FlowNode): string {
  return node.role ? `${node.role}\n${node.label}` : node.label;
}

function serializeEdge(edge: FlowEdge): string {
  return `${edge.from}->${edge.to}`;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function nodeStyle(
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
    fontSize: '17px',
    color: '#111827',
    backgroundColor,
    padding: { left: 14, right: 14, top: 12, bottom: 12 },
    fixedWidth: 150,
    fixedHeight: 74,
    align: 'center',
    wordWrap: { width: 124 },
  };
}
