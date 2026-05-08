/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { CourseSpec, CourseWorkflow } from './schemas.js';
import {
  buildDefaultStyleBible,
  buildLinearCourseWorkflow,
  validateCourseWorkflow,
} from './courseWorkflow.js';

describe('courseWorkflow', () => {
  it('接受由 ready playlet 组成的线性 DAG', () => {
    const workflow = buildLinearCourseWorkflow(
      ['playlet-找目标', 'playlet-拖拽分箱', 'playlet-证据配对'],
      ['goal_1', 'goal_2'],
    );

    const result = validateCourseWorkflow(workflow, ['goal_1', 'goal_2']);

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('拒绝 planned playlet 进入生成链路', () => {
    const workflow = buildLinearCourseWorkflow(['playlet-找不同'], ['goal_1']);

    const result = validateCourseWorkflow(workflow, ['goal_1']);

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.message).join('\n')).toContain(
      '仍为 planned',
    );
  });

  it('拒绝有环工作流', () => {
    const workflow: CourseWorkflow = {
      startNodeId: 'node_1',
      nodes: [
        buildNode('node_1', 'playlet-找目标', ['goal_1']),
        buildNode('node_2', 'playlet-拖拽分箱', ['goal_1']),
      ],
      edges: [
        { from: 'node_1', to: 'node_2', when: 'success' },
        { from: 'node_2', to: 'node_1', when: 'fail' },
      ],
      recoveryPolicy: 'remediate_then_return',
    };

    const result = validateCourseWorkflow(workflow, ['goal_1']);

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.message).join('\n')).toContain(
      '必须是 DAG',
    );
  });

  it('拒绝不可达节点和缺失目标覆盖', () => {
    const workflow: CourseWorkflow = {
      startNodeId: 'node_1',
      nodes: [
        buildNode('node_1', 'playlet-找目标', ['goal_1']),
        buildNode('node_2', 'playlet-拖拽分箱', ['goal_1']),
      ],
      edges: [],
      recoveryPolicy: 'hint_then_retry',
    };

    const result = validateCourseWorkflow(workflow, ['goal_1', 'goal_2']);

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.message).join('\n')).toContain(
      '无法从 startNodeId 到达',
    );
    expect(result.errors.map((error) => error.message).join('\n')).toContain(
      '没有被任何玩法节点覆盖',
    );
  });

  it('从 CourseSpec 生成默认 StyleBible', () => {
    const styleBible = buildDefaultStyleBible(buildCourseSpec());

    expect(styleBible.theme).toBe('森林调查');
    expect(styleBible.uiTokens.density).toBe('medium');
    expect(styleBible.forbiddenElements).toContain('惊吓');
  });
});

function buildNode(
  id: string,
  playletId: string,
  goalIds: string[],
): CourseWorkflow['nodes'][number] {
  return {
    id,
    playletId,
    goalIds,
    config: {
      prompt: '完成任务',
      items: [{ id: 'item_1', label: '项目' }],
      successCriteria: '完成并说明理由',
    },
    styleBindingId: 'default',
  };
}

function buildCourseSpec(): CourseSpec {
  return {
    subject: '科学',
    topic: '生态系统',
    learningGoals: ['解释食物链'],
    durationMinutes: 20,
    studentProfile: {
      grade: 5,
      interests: ['探险'],
    },
    styleSpec: {
      theme: '森林调查',
      palette: ['#14532D', '#FDE68A'],
      visualMood: '自然明亮',
      characterStyle: '调查员',
      uiDensity: 'medium',
      forbidden: ['惊吓'],
    },
    explanationDepth: {
      depthLevel: 'intro',
      priorKnowledgeCheck: false,
      conceptLayers: [
        {
          concept: '食物链',
          whyItMatters: '理解能量流动',
          misconceptionToAddress: [],
          representation: 'visual_model',
        },
      ],
      examplePlan: {
        workedExamples: 1,
        guidedPractice: 2,
        independentChallenges: 0,
        transferTasks: 0,
      },
      feedbackDepth: 'short_reason',
      masteryEvidence: ['能说出食物链方向'],
    },
  };
}
