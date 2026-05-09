/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { CourseGDD } from '../schemas.js';
import { buildDefaultGuardianPolicy } from './guardianPolicy.js';
import {
  createGenerationRecoveryState,
  decideGenerationRecovery,
  recordGenerationFailure,
} from './generationRecovery.js';

describe('MVP 2.0 生成失败恢复', () => {
  it('TTS 失败后可降级为字幕模式并继续验证', () => {
    const policy = buildDefaultGuardianPolicy('profile_1');
    const initialState = createGenerationRecoveryState({
      sessionId: 'session_1',
      profileId: 'profile_1',
      currentStage: 'tts',
      reusableArtifacts: {
        courseGdd: buildCourseGdd(),
      },
    });
    const failedState = recordGenerationFailure({
      state: initialState,
      policy,
      stage: 'tts',
      reason: 'lessonin-server timeout',
      estimatedCostCents: 8,
      nowIso: '2026-05-09T02:00:00.000Z',
    });

    const decision = decideGenerationRecovery(failedState, policy);

    expect(decision).toEqual(
      expect.objectContaining({
        status: 'recoverable',
        action: 'subtitle_fallback',
        resumeFromStage: 'package_validation',
        retryCount: 1,
        remainingRetryCount: 1,
        remainingCostCents: 72,
      }),
    );
    expect(decision.fallbackChecks).toEqual([
      'TTS 失败显示字幕',
      '旁白 manifest 包含 fallbackSubtitle',
    ]);
  });

  it('素材生成失败时复用 CourseGDD 并降级为静态视觉', () => {
    const policy = buildDefaultGuardianPolicy('profile_1');
    const failedState = recordGenerationFailure({
      state: createGenerationRecoveryState({
        sessionId: 'session_1',
        profileId: 'profile_1',
        currentStage: 'asset_generation',
        reusableArtifacts: {
          courseGdd: buildCourseGdd(),
        },
      }),
      policy,
      stage: 'asset_generation',
      reason: 'image provider quota',
      estimatedCostCents: 20,
    });

    const decision = decideGenerationRecovery(failedState, policy);

    expect(decision.status).toBe('recoverable');
    expect(decision.action).toBe('static_visual_fallback');
    expect(decision.resumeFromStage).toBe('package_validation');
    expect(decision.fallbackChecks).toContain('图片生成失败使用模板占位图');
  });

  it('连续失败超过上限后返回可解释错误', () => {
    const policy = {
      ...buildDefaultGuardianPolicy('profile_1'),
      maxRetryCount: 1,
    };
    const first = recordGenerationFailure({
      state: createGenerationRecoveryState({
        sessionId: 'session_1',
        profileId: 'profile_1',
        currentStage: 'course_gdd',
      }),
      policy,
      stage: 'course_gdd',
      reason: 'schema invalid',
    });
    const second = recordGenerationFailure({
      state: first,
      policy,
      stage: 'course_gdd',
      reason: 'schema invalid again',
    });

    const decision = decideGenerationRecovery(second, policy);

    expect(decision.status).toBe('blocked');
    expect(decision.action).toBe('return_explainable_error');
    expect(decision.message).toBe('连续失败超过家长设置的自动重试上限。');
    expect(decision.remainingRetryCount).toBe(0);
  });

  it('超过成本上限后停止恢复', () => {
    const policy = {
      ...buildDefaultGuardianPolicy('profile_1'),
      maxRetryCount: 3,
      maxEstimatedCostCents: 10,
    };
    const failedState = recordGenerationFailure({
      state: createGenerationRecoveryState({
        sessionId: 'session_1',
        profileId: 'profile_1',
        currentStage: 'package_validation',
      }),
      policy,
      stage: 'package_validation',
      reason: 'validation failed',
      estimatedCostCents: 12,
    });

    const decision = decideGenerationRecovery(failedState, policy);

    expect(decision.status).toBe('blocked');
    expect(decision.action).toBe('return_explainable_error');
    expect(decision.message).toBe('生成成本超过家长设置的预算上限。');
    expect(decision.remainingCostCents).toBe(-2);
  });
});

function buildCourseGdd(): CourseGDD {
  return {
    courseSpec: {
      subject: '数学',
      topic: '面积',
      learningGoals: ['理解面积含义'],
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
        depthLevel: 'intro',
        priorKnowledgeCheck: false,
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
          independentChallenges: 0,
          transferTasks: 0,
        },
        feedbackDepth: 'short_reason',
        masteryEvidence: ['能解释面积含义'],
      },
    },
    selectedPlan: {
      id: 'balanced',
      title: '太空面积任务',
      courseArchetype: 'course_grid',
      gameplayType: '网格建造',
      learningLoop: ['讲解', '互动', '反馈', '评价'],
      scenePlan: ['GridLessonScene'],
      assessmentPoints: ['理解面积含义'],
      assetComplexity: 'medium',
      score: {
        learningFit: 80,
        explanationDepthFit: 80,
        fun: 80,
        ageFit: 80,
        implementationStability: 80,
        cost: 70,
        safety: 90,
      },
      recommendationReason: '网格适合面积概念。',
      risks: [],
    },
    lessonUnits: [],
    interactionSpecs: [],
    assessmentSpec: { items: [], masteryCriteria: [] },
    assetPlan: { images: [], audio: [] },
    narrationPlan: { segments: [] },
    validationPlan: {
      requiredChecks: [],
      browserFlow: [],
      fallbackChecks: [],
    },
  };
}
