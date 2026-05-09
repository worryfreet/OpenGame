/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CourseGDD, CoursePlanOption, CourseSpec } from '../schemas.js';
import type { GuardianPolicy } from './guardianPolicy.js';

export type CourseGenerationStage =
  | 'intake'
  | 'plan_confirmation'
  | 'course_gdd'
  | 'asset_generation'
  | 'tts'
  | 'package_validation';

export type GenerationRecoveryAction =
  | 'retry_stage'
  | 'reuse_artifacts'
  | 'subtitle_fallback'
  | 'static_visual_fallback'
  | 'return_explainable_error';

export interface ReusableGenerationArtifacts {
  courseSpec?: CourseSpec;
  selectedPlan?: CoursePlanOption;
  courseGdd?: CourseGDD;
  assetManifestPath?: string;
  narrationManifestPath?: string;
  packageDir?: string;
}

export interface GenerationFailureRecord {
  stage: CourseGenerationStage;
  reason: string;
  failedAtIso: string;
  attemptNumber: number;
  estimatedCostCents: number;
  reusableArtifacts: ReusableGenerationArtifacts;
}

export interface GenerationRecoveryState {
  sessionId: string;
  profileId: string;
  currentStage: CourseGenerationStage;
  failures: GenerationFailureRecord[];
  reusableArtifacts: ReusableGenerationArtifacts;
  spentCostCents: number;
}

export interface RecoveryDecision {
  status: 'recoverable' | 'blocked';
  action: GenerationRecoveryAction;
  resumeFromStage?: CourseGenerationStage;
  reusableArtifacts: ReusableGenerationArtifacts;
  retryCount: number;
  remainingRetryCount: number;
  remainingCostCents?: number;
  fallbackChecks: string[];
  message: string;
}

export interface RecordGenerationFailureInput {
  state: GenerationRecoveryState;
  policy: GuardianPolicy;
  stage: CourseGenerationStage;
  reason: string;
  estimatedCostCents?: number;
  reusableArtifacts?: ReusableGenerationArtifacts;
  nowIso?: string;
}

const RECOVERABLE_STAGES: CourseGenerationStage[] = [
  'plan_confirmation',
  'course_gdd',
  'asset_generation',
  'tts',
  'package_validation',
];

export function createGenerationRecoveryState(input: {
  sessionId: string;
  profileId: string;
  currentStage?: CourseGenerationStage;
  reusableArtifacts?: ReusableGenerationArtifacts;
}): GenerationRecoveryState {
  if (!input.sessionId.trim()) {
    throw new Error('GenerationRecoveryState 必须包含 sessionId。');
  }
  if (!input.profileId.trim()) {
    throw new Error('GenerationRecoveryState 必须包含 profileId。');
  }

  return {
    sessionId: input.sessionId,
    profileId: input.profileId,
    currentStage: input.currentStage ?? 'intake',
    failures: [],
    reusableArtifacts: input.reusableArtifacts ?? {},
    spentCostCents: 0,
  };
}

export function recordGenerationFailure(
  input: RecordGenerationFailureInput,
): GenerationRecoveryState {
  const estimatedCostCents = input.estimatedCostCents ?? 0;
  if (estimatedCostCents < 0) {
    throw new Error('失败记录的 estimatedCostCents 不能为负数。');
  }

  const reusableArtifacts = mergeArtifacts(
    input.state.reusableArtifacts,
    input.reusableArtifacts ?? {},
  );
  const failure: GenerationFailureRecord = {
    stage: input.stage,
    reason: input.reason.trim() || '未知生成失败',
    failedAtIso: input.nowIso ?? new Date().toISOString(),
    attemptNumber: countStageFailures(input.state, input.stage) + 1,
    estimatedCostCents,
    reusableArtifacts,
  };

  return {
    ...input.state,
    currentStage: input.stage,
    failures: [...input.state.failures, failure],
    reusableArtifacts,
    spentCostCents: input.state.spentCostCents + estimatedCostCents,
  };
}

export function decideGenerationRecovery(
  state: GenerationRecoveryState,
  policy: GuardianPolicy,
): RecoveryDecision {
  const latestFailure = state.failures[state.failures.length - 1];
  if (!latestFailure) {
    return {
      status: 'recoverable',
      action: 'retry_stage',
      resumeFromStage: state.currentStage,
      reusableArtifacts: state.reusableArtifacts,
      retryCount: 0,
      remainingRetryCount: policy.maxRetryCount,
      remainingCostCents: remainingCost(policy, state),
      fallbackChecks: [],
      message: '当前没有失败记录，可以从当前阶段继续。',
    };
  }

  const retryCount = countStageFailures(state, latestFailure.stage);
  const remainingRetryCount = policy.maxRetryCount - retryCount;
  const remainingCostCents = remainingCost(policy, state);
  if (retryCount > policy.maxRetryCount) {
    return blockedDecision(
      state,
      policy,
      retryCount,
      remainingCostCents,
      '连续失败超过家长设置的自动重试上限。',
    );
  }
  if (remainingCostCents !== undefined && remainingCostCents < 0) {
    return blockedDecision(
      state,
      policy,
      retryCount,
      remainingCostCents,
      '生成成本超过家长设置的预算上限。',
    );
  }

  if (latestFailure.stage === 'tts') {
    return {
      status: 'recoverable',
      action: 'subtitle_fallback',
      resumeFromStage: 'package_validation',
      reusableArtifacts: state.reusableArtifacts,
      retryCount,
      remainingRetryCount: Math.max(0, remainingRetryCount),
      remainingCostCents,
      fallbackChecks: [
        'TTS 失败显示字幕',
        '旁白 manifest 包含 fallbackSubtitle',
      ],
      message: 'TTS 失败后可降级为字幕旁白，并继续课程包验证。',
    };
  }

  if (
    latestFailure.stage === 'asset_generation' &&
    state.reusableArtifacts.courseGdd
  ) {
    return {
      status: 'recoverable',
      action: 'static_visual_fallback',
      resumeFromStage: 'package_validation',
      reusableArtifacts: state.reusableArtifacts,
      retryCount,
      remainingRetryCount: Math.max(0, remainingRetryCount),
      remainingCostCents,
      fallbackChecks: ['图片生成失败使用模板占位图', '视频关闭不阻断流程'],
      message: '素材生成失败后可复用 Course GDD，并降级为模板静态视觉。',
    };
  }

  if (RECOVERABLE_STAGES.includes(latestFailure.stage)) {
    return {
      status: 'recoverable',
      action: hasReusableArtifactForStage(state, latestFailure.stage)
        ? 'reuse_artifacts'
        : 'retry_stage',
      resumeFromStage: latestFailure.stage,
      reusableArtifacts: state.reusableArtifacts,
      retryCount,
      remainingRetryCount: Math.max(0, remainingRetryCount),
      remainingCostCents,
      fallbackChecks: [],
      message: '当前阶段可在重试上限内恢复。',
    };
  }

  return blockedDecision(
    state,
    policy,
    retryCount,
    remainingCostCents,
    '当前失败阶段缺少可靠恢复点，需要回到输入向导。',
  );
}

function blockedDecision(
  state: GenerationRecoveryState,
  policy: GuardianPolicy,
  retryCount: number,
  remainingCostCents: number | undefined,
  message: string,
): RecoveryDecision {
  return {
    status: 'blocked',
    action: 'return_explainable_error',
    reusableArtifacts: state.reusableArtifacts,
    retryCount,
    remainingRetryCount: Math.max(0, policy.maxRetryCount - retryCount),
    remainingCostCents,
    fallbackChecks: [],
    message,
  };
}

function countStageFailures(
  state: GenerationRecoveryState,
  stage: CourseGenerationStage,
): number {
  return state.failures.filter((failure) => failure.stage === stage).length;
}

function remainingCost(
  policy: GuardianPolicy,
  state: GenerationRecoveryState,
): number | undefined {
  return policy.maxEstimatedCostCents === undefined
    ? undefined
    : policy.maxEstimatedCostCents - state.spentCostCents;
}

function hasReusableArtifactForStage(
  state: GenerationRecoveryState,
  stage: CourseGenerationStage,
): boolean {
  if (stage === 'plan_confirmation') {
    return Boolean(state.reusableArtifacts.courseSpec);
  }
  if (stage === 'course_gdd') {
    return Boolean(state.reusableArtifacts.courseSpec?.learningGoals.length);
  }
  if (stage === 'package_validation') {
    return Boolean(state.reusableArtifacts.courseGdd);
  }
  return Object.keys(state.reusableArtifacts).length > 0;
}

function mergeArtifacts(
  base: ReusableGenerationArtifacts,
  next: ReusableGenerationArtifacts,
): ReusableGenerationArtifacts {
  return {
    ...base,
    ...next,
  };
}
