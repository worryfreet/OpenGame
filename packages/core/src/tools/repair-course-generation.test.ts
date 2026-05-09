/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { buildDefaultGuardianPolicy } from '../course/product/guardianPolicy.js';
import {
  createAutoRepairLoopState,
  decideAutoRepair,
} from '../course/quality/autoRepairLoop.js';
import { RepairCourseGenerationTool } from './repair-course-generation.js';
import type { CoursePlanOption, CourseSpec } from '../course/schemas.js';

describe('RepairCourseGenerationTool', () => {
  it('质量门禁失败时生成质量重写决策', () => {
    const state = createAutoRepairLoopState({
      sessionId: 'session_repair_quality',
      profileId: 'profile_1',
      artifacts: {
        courseSpec: buildCourseSpec(),
        selectedPlan: buildStrongPlan(),
      },
    });
    const decision = decideAutoRepair({
      state,
      policy: buildDefaultGuardianPolicy('profile_1'),
      issue: {
        target: 'quality',
        severity: 'blocking',
        message: '教学深度不足',
      },
    });

    expect(decision.status).toBe('continue');
    expect(decision.action).toBe('quality_gate_rewrite');
    expect(decision.attempt?.target).toBe('quality');
    expect(decision.executionPlan).toContain(
      '重新调用 score_course_quality 复评修复后的方案。',
    );
  });

  it('TTS 失败时降级为字幕旁白并继续验证', () => {
    const state = createAutoRepairLoopState({
      sessionId: 'session_repair_tts',
      profileId: 'profile_1',
    });
    const decision = decideAutoRepair({
      state,
      policy: buildDefaultGuardianPolicy('profile_1'),
      issue: {
        target: 'tts',
        severity: 'warning',
        message: 'lessonin 服务不可用',
      },
    });

    expect(decision.status).toBe('fallback');
    expect(decision.action).toBe('subtitle_tts_fallback');
    expect(decision.fallbackChecks).toContain('TTS 失败显示字幕');
  });

  it('工具执行输出修复决策和 nextState', async () => {
    const tool = new RepairCourseGenerationTool();
    const state = createAutoRepairLoopState({
      sessionId: 'session_tool',
      profileId: 'profile_1',
    });

    const result = await tool.buildAndExecute(
      {
        state,
        policy: buildDefaultGuardianPolicy('profile_1'),
        issue: {
          target: 'plan',
          severity: 'blocking',
          message: '模型输出格式错误',
        },
      },
      new AbortController().signal,
    );

    expect(result.error).toBeUndefined();
    expect(result.llmContent).toContain('<course-generation-repair>');
    expect(result.llmContent).toContain('nextState');
    expect(result.returnDisplay).toContain('执行链路');
  });
});

function buildCourseSpec(): CourseSpec {
  return {
    subject: '数学',
    topic: '长方形面积',
    learningGoals: ['解释面积公式的来源', '用面积公式解决情境问题'],
    durationMinutes: 25,
    studentProfile: {
      grade: 4,
      readingLevel: 'medium',
      interests: ['太空基地', '工程'],
      guardianLimits: {
        maxSessionMinutes: 30,
        allowUploadedImages: false,
        allowGeneratedVideo: false,
        contentStrictness: 'strict',
      },
    },
    styleSpec: {
      theme: '月球基地建设',
      palette: ['#2563EB', '#F59E0B', '#10B981'],
      visualMood: '明亮、有探索感',
      characterStyle: '基地工程师',
      uiDensity: 'medium',
      forbidden: [],
    },
    explanationDepth: {
      depthLevel: 'deep',
      priorKnowledgeCheck: true,
      conceptLayers: [
        {
          concept: '面积单位覆盖',
          whyItMatters: '理解公式来自单位面积的行列排列。',
          misconceptionToAddress: ['只背公式'],
          representation: 'visual_model',
        },
        {
          concept: '公式迁移',
          whyItMatters: '用于真实铺板问题。',
          misconceptionToAddress: ['混淆周长和面积'],
          representation: 'case',
        },
      ],
      examplePlan: {
        workedExamples: 2,
        guidedPractice: 2,
        independentChallenges: 2,
        transferTasks: 1,
      },
      feedbackDepth: 'step_by_step',
      masteryEvidence: ['能解释公式来源', '能解决情境问题'],
    },
  };
}

function buildStrongPlan(): CoursePlanOption {
  return {
    id: 'balanced',
    title: '月球基地面积工程',
    courseArchetype: 'course_grid',
    gameplayType: '模块装配',
    learningLoop: [
      '情境导入',
      '观察示例',
      '核心操作挑战',
      '状态变化反馈',
      '迁移复盘评价',
    ],
    scenePlan: [
      '基地导入目标',
      '模块铺设核心关卡',
      '公式控制台状态变化',
      '迁移挑战报告',
    ],
    assessmentPoints: ['解释面积公式的来源', '用面积公式解决情境问题'],
    assetComplexity: 'medium',
    score: {
      learningFit: 90,
      explanationDepthFit: 86,
      fun: 88,
      ageFit: 90,
      implementationStability: 84,
      cost: 78,
      safety: 94,
    },
    recommendationReason: '模块装配能让面积公式来源改变基地任务状态。',
    risks: ['需要控制模块数量。'],
  };
}
