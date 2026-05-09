/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { CourseExcitementReview } from './excitementRubric.js';
import type { CourseGDD } from '../schemas.js';
import { buildDefaultGuardianPolicy } from '../product/guardianPolicy.js';
import {
  createAutoRepairLoopState,
  decideAutoRepair,
  recordAutoRepairAttempt,
} from './autoRepairLoop.js';

describe('MVP 3.0 自动修复循环', () => {
  it('七类修复对象都有明确动作', () => {
    const policy = buildDefaultGuardianPolicy('profile_1');
    const targets = [
      ['plan', 'rewrite_plan'],
      ['gdd', 'revise_gdd'],
      ['asset', 'static_asset_fallback'],
      ['tts', 'subtitle_tts_fallback'],
      ['build', 'fix_build_blocker'],
      ['browser', 'adjust_browser_flow'],
      ['quality', 'quality_gate_rewrite'],
    ] as const;

    for (const [target, action] of targets) {
      const decision = decideAutoRepair({
        state: createAutoRepairLoopState({
          sessionId: `session_${target}`,
          profileId: 'profile_1',
          artifacts: {
            courseGdd: buildCourseGdd(),
          },
        }),
        policy,
        issue: {
          target,
          severity: 'blocking',
          message: `${target} failed`,
        },
      });

      expect(decision.action).toBe(action);
    }
  });

  it('低质量 plan 触发重写动作并记录 AutoRepairAttempt', () => {
    const policy = buildDefaultGuardianPolicy('profile_1');
    const state = createAutoRepairLoopState({
      sessionId: 'session_1',
      profileId: 'profile_1',
      artifacts: {
        courseGdd: buildCourseGdd(),
      },
    });

    const decision = decideAutoRepair({
      state,
      policy,
      issue: {
        target: 'plan',
        severity: 'blocking',
        message: '玩法循环低于精彩度门槛',
        qualityReview: buildLowQualityReview(),
      },
      options: { nowIso: '2026-05-09T03:00:00.000Z' },
    });
    const nextState = recordAutoRepairAttempt(state, decision);

    expect(decision).toEqual(
      expect.objectContaining({
        status: 'continue',
        action: 'rewrite_plan',
        target: 'plan',
        reason: '玩法循环低于精彩度门槛',
      }),
    );
    expect(nextState.attempts).toEqual([
      expect.objectContaining({
        attemptId: 'session_1:repair:1',
        target: 'plan',
        action: 'rewrite_plan',
        roundNumber: 1,
        estimatedCostCents: 8,
      }),
    ]);
  });

  it('素材失败时降级为低成本静态素材并清空视频计划', () => {
    const policy = buildDefaultGuardianPolicy('profile_1');
    const state = createAutoRepairLoopState({
      sessionId: 'session_1',
      profileId: 'profile_1',
      artifacts: {
        courseGdd: buildCourseGdd(),
      },
    });

    const decision = decideAutoRepair({
      state,
      policy,
      issue: {
        target: 'asset',
        severity: 'blocking',
        message: '图片服务配额耗尽',
        estimatedCostCents: 12,
      },
    });

    expect(decision.status).toBe('fallback');
    expect(decision.action).toBe('static_asset_fallback');
    expect(decision.nextArtifacts.courseGdd?.selectedPlan.assetComplexity).toBe(
      'low',
    );
    expect(decision.nextArtifacts.courseGdd?.assetPlan.video).toEqual([]);
    expect(
      decision.nextArtifacts.courseGdd?.validationPlan.fallbackChecks,
    ).toContain('图片生成失败使用模板占位图');
  });

  it('TTS 失败时走字幕降级并补充校验项', () => {
    const policy = buildDefaultGuardianPolicy('profile_1');
    const state = createAutoRepairLoopState({
      sessionId: 'session_1',
      profileId: 'profile_1',
      artifacts: {
        courseGdd: buildCourseGdd(),
      },
    });

    const decision = decideAutoRepair({
      state,
      policy,
      issue: {
        target: 'tts',
        severity: 'blocking',
        message: 'lessonin-server timeout',
      },
    });

    expect(decision.status).toBe('fallback');
    expect(decision.action).toBe('subtitle_tts_fallback');
    expect(decision.fallbackChecks).toEqual([
      'TTS 失败显示字幕',
      '旁白 manifest 包含 fallbackSubtitle',
    ]);
    expect(
      decision.nextArtifacts.courseGdd?.validationPlan.fallbackChecks,
    ).toContain('旁白 manifest 包含 fallbackSubtitle');
  });

  it('超过轮数或成本上限后阻断自动修复', () => {
    const policy = {
      ...buildDefaultGuardianPolicy('profile_1'),
      maxEstimatedCostCents: 10,
    };
    const baseState = createAutoRepairLoopState({
      sessionId: 'session_1',
      profileId: 'profile_1',
    });
    const firstDecision = decideAutoRepair({
      state: baseState,
      policy,
      issue: {
        target: 'build',
        severity: 'blocking',
        message: 'tsc failed',
        estimatedCostCents: 4,
      },
      options: { maxRounds: 1 },
    });
    const spentState = recordAutoRepairAttempt(baseState, firstDecision);

    const roundBlocked = decideAutoRepair({
      state: spentState,
      policy,
      issue: {
        target: 'browser',
        severity: 'blocking',
        message: 'smoke failed',
      },
      options: { maxRounds: 1 },
    });
    const costBlocked = decideAutoRepair({
      state: baseState,
      policy,
      issue: {
        target: 'quality',
        severity: 'blocking',
        message: '质量门禁失败',
        estimatedCostCents: 12,
      },
    });

    expect(roundBlocked).toEqual(
      expect.objectContaining({
        status: 'blocked',
        action: 'return_explainable_error',
        reason: '自动修复轮数超过上限，需要返回可解释错误。',
      }),
    );
    expect(costBlocked).toEqual(
      expect.objectContaining({
        status: 'blocked',
        action: 'return_explainable_error',
        reason: '自动修复成本超过 GuardianPolicy 预算上限。',
        remainingCostCents: -2,
      }),
    );
  });
});

function buildLowQualityReview(): CourseExcitementReview {
  return {
    score: {
      goalClarity: 70,
      gameLoopStrength: 42,
      surpriseAndProgression: 45,
      feedbackRichness: 55,
      roleAndWorldAppeal: 72,
      challengeCurve: 50,
      total: 56,
    },
    passed: false,
    issues: [
      {
        dimension: 'gameLoopStrength',
        severity: 'blocking',
        message: '玩法循环低于最低门槛。',
        improvementAction: '补齐导入、核心操作、即时反馈和结算复盘的闭环。',
      },
    ],
  };
}

function buildCourseGdd(): CourseGDD {
  return {
    courseSpec: {
      subject: '数学',
      topic: '面积',
      learningGoals: ['理解面积含义', '区分面积和周长'],
      durationMinutes: 20,
      studentProfile: {
        grade: 3,
        interests: ['太空'],
      },
      styleSpec: {
        theme: '太空基地',
        palette: ['#2563EB', '#F59E0B'],
        visualMood: '明亮清晰',
        characterStyle: '星际助手',
        uiDensity: 'medium',
        forbidden: [],
      },
      explanationDepth: {
        depthLevel: 'standard',
        priorKnowledgeCheck: true,
        conceptLayers: [
          {
            concept: '面积',
            whyItMatters: '比较覆盖大小。',
            misconceptionToAddress: ['把面积和周长混淆'],
            representation: 'visual_model',
          },
        ],
        examplePlan: {
          workedExamples: 1,
          guidedPractice: 2,
          independentChallenges: 1,
          transferTasks: 1,
        },
        feedbackDepth: 'step_by_step',
        masteryEvidence: ['能解释面积含义', '能区分面积和周长'],
      },
    },
    selectedPlan: {
      id: 'balanced',
      title: '太空面积任务',
      courseArchetype: 'course_grid',
      gameplayType: '网格建造',
      learningLoop: ['情境导入', '观察示例', '互动挑战', '反馈复盘'],
      scenePlan: ['导入任务', '面积覆盖挑战', '迁移复盘'],
      assessmentPoints: ['理解面积含义', '区分面积和周长'],
      assetComplexity: 'high',
      score: {
        learningFit: 80,
        explanationDepthFit: 80,
        fun: 80,
        ageFit: 80,
        implementationStability: 80,
        cost: 50,
        safety: 90,
      },
      recommendationReason: '网格适合面积概念。',
      risks: [],
    },
    lessonUnits: [],
    interactionSpecs: [],
    assessmentSpec: { items: [], masteryCriteria: [] },
    assetPlan: {
      images: [{ key: 'tile', description: '面积方格' }],
      audio: [],
      video: [{ key: 'intro', description: '太空开场', optional: true }],
    },
    narrationPlan: { segments: [] },
    validationPlan: {
      requiredChecks: ['npm run build'],
      browserFlow: ['打开课程'],
      fallbackChecks: [],
    },
  };
}
