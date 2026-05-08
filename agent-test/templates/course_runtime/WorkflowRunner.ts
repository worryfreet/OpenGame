import type { CourseContent } from '../courseContent';
import { CourseStateStore, type PlayletResult } from './CourseStateStore';

export type WorkflowEdgeCondition = 'success' | 'fail' | 'partial' | 'always';

export interface PlayletNode {
  id: string;
  playletId: string;
  goalIds: string[];
  config: Record<string, unknown>;
  styleBindingId: string;
  enterTransition?: string;
  exitTransition?: string;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  when: WorkflowEdgeCondition;
}

export interface CourseWorkflow {
  startNodeId: string;
  nodes: PlayletNode[];
  edges: WorkflowEdge[];
  recoveryPolicy: 'retry_same' | 'hint_then_retry' | 'remediate_then_return';
}

export class WorkflowRunner {
  readonly state = new CourseStateStore();
  private currentNodeId: string;

  constructor(private readonly content: CourseContent) {
    const workflow = this.requireWorkflow();
    this.currentNodeId = workflow.startNodeId;
  }

  getCurrentNode(): PlayletNode {
    const node = this.requireWorkflow().nodes.find(
      (candidate) => candidate.id === this.currentNodeId,
    );
    if (!node) {
      throw new Error(`课程工作流节点不存在：${this.currentNodeId}`);
    }
    return node;
  }

  completeCurrent(
    result: Omit<PlayletResult, 'nodeId' | 'playletId'>,
  ): PlayletNode | null {
    const node = this.getCurrentNode();
    this.state.recordResult(node.goalIds, {
      ...result,
      nodeId: node.id,
      playletId: node.playletId,
    });
    const next = this.findNextNode(node.id, result.status);
    if (next) {
      this.currentNodeId = next.id;
    }
    return next;
  }

  private findNextNode(
    nodeId: string,
    status: PlayletResult['status'],
  ): PlayletNode | null {
    const workflow = this.requireWorkflow();
    const edge = workflow.edges.find(
      (candidate) =>
        candidate.from === nodeId &&
        (candidate.when === status || candidate.when === 'always'),
    );
    if (!edge) return null;
    return workflow.nodes.find((node) => node.id === edge.to) ?? null;
  }

  private requireWorkflow(): CourseWorkflow {
    if (!this.content.workflow) {
      throw new Error(
        'courseContent.json 缺少 workflow，无法运行玩法积木课程。',
      );
    }
    return this.content.workflow;
  }
}
