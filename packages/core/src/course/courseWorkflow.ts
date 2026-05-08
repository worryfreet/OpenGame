/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CourseSpec, CourseWorkflow, StyleBible } from './schemas.js';
import { getPlayletTemplate, isReadyPlaylet } from './playletCatalog.js';
import { RECOVERY_POLICIES, WORKFLOW_EDGE_CONDITIONS } from './schemas.js';
import type { WorkflowEdge } from './schemas.js';

export interface CourseWorkflowIssue {
  path: string;
  message: string;
}

export interface CourseWorkflowValidationResult {
  valid: boolean;
  errors: CourseWorkflowIssue[];
}

export function buildDefaultStyleBible(courseSpec: CourseSpec): StyleBible {
  return {
    theme: courseSpec.styleSpec.theme,
    palette: courseSpec.styleSpec.palette,
    characterDirection: courseSpec.styleSpec.characterStyle,
    uiTokens: {
      density: courseSpec.styleSpec.uiDensity,
      mood: courseSpec.styleSpec.visualMood,
    },
    motionMood: courseSpec.styleSpec.visualMood,
    audioMood: '清晰、鼓励、不过度刺激',
    forbiddenElements: courseSpec.styleSpec.forbidden,
  };
}

export function buildLinearCourseWorkflow(
  playletIds: string[],
  goalIds: string[],
): CourseWorkflow {
  const nodes = playletIds.map((playletId, index) => ({
    id: `node_${index + 1}`,
    playletId,
    goalIds,
    config: {
      prompt: `完成第 ${index + 1} 个玩法任务。`,
      items: goalIds.map((goalId) => ({ id: goalId, label: goalId })),
      successCriteria: '完成玩法并产出学习证据。',
    },
    styleBindingId: 'default',
    enterTransition: index === 0 ? 'course_intro' : 'playlet_bridge',
    exitTransition: 'result_bridge',
  }));

  return {
    startNodeId: nodes[0]?.id ?? '',
    nodes,
    edges: nodes.slice(0, -1).map((node, index) => ({
      from: node.id,
      to: nodes[index + 1]!.id,
      when: 'success',
    })),
    recoveryPolicy: 'hint_then_retry',
  };
}

export function validateCourseWorkflow(
  workflow: CourseWorkflow | undefined,
  goalIds: string[],
): CourseWorkflowValidationResult {
  const errors: CourseWorkflowIssue[] = [];
  if (!workflow) {
    return {
      valid: true,
      errors,
    };
  }

  const nodeIds = new Set(workflow.nodes.map((node) => node.id));
  if (!nodeIds.has(workflow.startNodeId)) {
    errors.push({
      path: '/workflow/startNodeId',
      message: '课程工作流 startNodeId 必须指向真实玩法节点。',
    });
  }

  if (!RECOVERY_POLICIES.includes(workflow.recoveryPolicy)) {
    errors.push({
      path: '/workflow/recoveryPolicy',
      message: '课程工作流 recoveryPolicy 不合法。',
    });
  }

  validateNodes(workflow, goalIds, errors);
  validateEdges(workflow, nodeIds, errors);
  validateReachability(workflow, errors);
  validateAcyclic(workflow, errors);
  validateGoalCoverage(workflow, goalIds, errors);

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateNodes(
  workflow: CourseWorkflow,
  goalIds: string[],
  errors: CourseWorkflowIssue[],
): void {
  const allowedGoals = new Set(goalIds);
  const seen = new Set<string>();

  for (const node of workflow.nodes) {
    if (seen.has(node.id)) {
      errors.push({
        path: `/workflow/nodes/${node.id}`,
        message: `玩法节点 id「${node.id}」重复。`,
      });
    }
    seen.add(node.id);

    const template = getPlayletTemplate(node.playletId);
    if (!template) {
      errors.push({
        path: `/workflow/nodes/${node.id}/playletId`,
        message: `玩法节点引用未知 playlet「${node.playletId}」。`,
      });
      continue;
    }
    if (!isReadyPlaylet(node.playletId)) {
      errors.push({
        path: `/workflow/nodes/${node.id}/playletId`,
        message: `玩法「${node.playletId}」仍为 planned，不能进入生成链路。`,
      });
    }
    if (template.outputContract.resultEvent !== 'playlet_completed') {
      errors.push({
        path: `/workflow/nodes/${node.id}/outputContract`,
        message: `玩法「${node.playletId}」必须输出 playlet_completed 事件。`,
      });
    }
    if (!template.transitionContract.supportsSubtitleFallback) {
      errors.push({
        path: `/workflow/nodes/${node.id}/transitionContract`,
        message: `玩法「${node.playletId}」必须支持字幕降级过渡。`,
      });
    }

    if (node.goalIds.length === 0) {
      errors.push({
        path: `/workflow/nodes/${node.id}/goalIds`,
        message: '每个玩法节点至少要绑定一个学习目标。',
      });
    }
    for (const goalId of node.goalIds) {
      if (!allowedGoals.has(goalId)) {
        errors.push({
          path: `/workflow/nodes/${node.id}/goalIds`,
          message: `玩法节点引用未知学习目标 id「${goalId}」。`,
        });
      }
    }
  }
}

function validateEdges(
  workflow: CourseWorkflow,
  nodeIds: Set<string>,
  errors: CourseWorkflowIssue[],
): void {
  for (const edge of workflow.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      errors.push({
        path: '/workflow/edges',
        message: `工作流边「${edge.from} -> ${edge.to}」引用不存在的节点。`,
      });
    }
    if (!WORKFLOW_EDGE_CONDITIONS.includes(edge.when)) {
      errors.push({
        path: '/workflow/edges/when',
        message: `工作流边条件「${edge.when}」不合法。`,
      });
    }
  }
}

function validateReachability(
  workflow: CourseWorkflow,
  errors: CourseWorkflowIssue[],
): void {
  const reachable = new Set<string>();
  const outgoing = groupOutgoing(workflow.edges);
  const stack = [workflow.startNodeId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    for (const edge of outgoing.get(current) ?? []) {
      stack.push(edge.to);
    }
  }

  for (const node of workflow.nodes) {
    if (!reachable.has(node.id)) {
      errors.push({
        path: `/workflow/nodes/${node.id}`,
        message: `玩法节点「${node.id}」无法从 startNodeId 到达。`,
      });
    }
  }
}

function validateAcyclic(
  workflow: CourseWorkflow,
  errors: CourseWorkflowIssue[],
): void {
  const outgoing = groupOutgoing(workflow.edges);
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) return false;
    if (visited.has(nodeId)) return true;
    visiting.add(nodeId);
    for (const edge of outgoing.get(nodeId) ?? []) {
      if (!visit(edge.to)) return false;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return true;
  };

  for (const node of workflow.nodes) {
    if (!visit(node.id)) {
      errors.push({
        path: '/workflow/edges',
        message:
          '课程工作流必须是 DAG；复习回流请用 remediate_then_return 策略表达，不允许真实环。',
      });
      return;
    }
  }
}

function validateGoalCoverage(
  workflow: CourseWorkflow,
  goalIds: string[],
  errors: CourseWorkflowIssue[],
): void {
  const covered = new Set(workflow.nodes.flatMap((node) => node.goalIds));
  for (const goalId of goalIds) {
    if (!covered.has(goalId)) {
      errors.push({
        path: '/workflow/nodes',
        message: `学习目标「${goalId}」没有被任何玩法节点覆盖。`,
      });
    }
  }
}

function groupOutgoing(edges: WorkflowEdge[]): Map<string, WorkflowEdge[]> {
  const grouped = new Map<string, WorkflowEdge[]>();
  for (const edge of edges) {
    grouped.set(edge.from, [...(grouped.get(edge.from) ?? []), edge]);
  }
  return grouped;
}
