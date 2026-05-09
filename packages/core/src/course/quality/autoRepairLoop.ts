/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CourseGDD, CoursePlanOption, CourseSpec } from '../schemas.js';
import type { GuardianPolicy } from '../product/guardianPolicy.js';
import type { CourseExcitementReview } from './excitementRubric.js';

export type AutoRepairTarget =
  | 'plan'
  | 'gdd'
  | 'asset'
  | 'tts'
  | 'build'
  | 'browser'
  | 'quality';

export type AutoRepairAction =
  | 'rewrite_plan'
  | 'revise_gdd'
  | 'static_asset_fallback'
  | 'subtitle_tts_fallback'
  | 'fix_build_blocker'
  | 'adjust_browser_flow'
  | 'quality_gate_rewrite'
  | 'return_explainable_error';

export type AutoRepairStatus = 'continue' | 'fallback' | 'blocked';

export interface AutoRepairArtifacts {
  courseSpec?: CourseSpec;
  selectedPlan?: CoursePlanOption;
  courseGdd?: CourseGDD;
  assetManifestPath?: string;
  narrationManifestPath?: string;
  packageDir?: string;
}

export interface AutoRepairIssue {
  target: AutoRepairTarget;
  severity: 'warning' | 'blocking';
  message: string;
  path?: string;
  estimatedCostCents?: number;
  qualityReview?: CourseExcitementReview;
}

export interface AutoRepairAttempt {
  attemptId: string;
  target: AutoRepairTarget;
  action: AutoRepairAction;
  status: AutoRepairStatus;
  reason: string;
  startedAtIso: string;
  estimatedCostCents: number;
  cumulativeCostCents: number;
  roundNumber: number;
  fallbackChecks: string[];
}

export interface AutoRepairLoopState {
  sessionId: string;
  profileId: string;
  attempts: AutoRepairAttempt[];
  artifacts: AutoRepairArtifacts;
  spentCostCents: number;
}

export interface AutoRepairLoopOptions {
  maxRounds?: number;
  defaultEstimatedCostCents?: Partial<Record<AutoRepairTarget, number>>;
  nowIso?: string;
}

export interface AutoRepairDecision {
  status: AutoRepairStatus;
  action: AutoRepairAction;
  target: AutoRepairTarget;
  reason: string;
  nextArtifacts: AutoRepairArtifacts;
  executionPlan: string[];
  attempt?: AutoRepairAttempt;
  remainingRounds: number;
  remainingCostCents?: number;
  fallbackChecks: string[];
}

export interface DecideAutoRepairInput {
  state: AutoRepairLoopState;
  policy: GuardianPolicy;
  issue: AutoRepairIssue;
  options?: AutoRepairLoopOptions;
}

const DEFAULT_MAX_ROUNDS = 3;

const DEFAULT_COST_BY_TARGET: Record<AutoRepairTarget, number> = {
  plan: 8,
  gdd: 12,
  asset: 18,
  tts: 6,
  build: 4,
  browser: 4,
  quality: 10,
};

const ACTION_BY_TARGET: Record<AutoRepairTarget, AutoRepairAction> = {
  plan: 'rewrite_plan',
  gdd: 'revise_gdd',
  asset: 'static_asset_fallback',
  tts: 'subtitle_tts_fallback',
  build: 'fix_build_blocker',
  browser: 'adjust_browser_flow',
  quality: 'quality_gate_rewrite',
};

export function createAutoRepairLoopState(input: {
  sessionId: string;
  profileId: string;
  artifacts?: AutoRepairArtifacts;
}): AutoRepairLoopState {
  if (!input.sessionId.trim()) {
    throw new Error('AutoRepairLoopState 必须包含 sessionId。');
  }
  if (!input.profileId.trim()) {
    throw new Error('AutoRepairLoopState 必须包含 profileId。');
  }

  return {
    sessionId: input.sessionId,
    profileId: input.profileId,
    attempts: [],
    artifacts: input.artifacts ?? {},
    spentCostCents: 0,
  };
}

export function decideAutoRepair(
  input: DecideAutoRepairInput,
): AutoRepairDecision {
  const maxRounds = Math.min(
    input.options?.maxRounds ?? DEFAULT_MAX_ROUNDS,
    input.policy.maxRetryCount,
  );
  const roundNumber = input.state.attempts.length + 1;
  const estimatedCostCents = estimateCost(input.issue, input.options);
  const remainingRounds = maxRounds - roundNumber;
  const remainingCostBeforeAttempt = getRemainingCost(
    input.policy,
    input.state.spentCostCents,
  );

  if (roundNumber > maxRounds) {
    return blockedDecision(
      input,
      '自动修复轮数超过上限，需要返回可解释错误。',
      remainingRounds,
      remainingCostBeforeAttempt,
    );
  }

  const remainingCostAfterAttempt = getRemainingCost(
    input.policy,
    input.state.spentCostCents + estimatedCostCents,
  );
  if (
    remainingCostAfterAttempt !== undefined &&
    remainingCostAfterAttempt < 0
  ) {
    return blockedDecision(
      input,
      '自动修复成本超过 GuardianPolicy 预算上限。',
      remainingRounds,
      remainingCostAfterAttempt,
    );
  }

  const action = ACTION_BY_TARGET[input.issue.target];
  const fallbackChecks = buildFallbackChecks(input.issue.target);
  const status: AutoRepairStatus =
    input.issue.target === 'asset' || input.issue.target === 'tts'
      ? 'fallback'
      : 'continue';
  const attempt: AutoRepairAttempt = {
    attemptId: `${input.state.sessionId}:repair:${roundNumber}`,
    target: input.issue.target,
    action,
    status,
    reason: input.issue.message.trim() || '自动修复触发',
    startedAtIso: input.options?.nowIso ?? new Date().toISOString(),
    estimatedCostCents,
    cumulativeCostCents: input.state.spentCostCents + estimatedCostCents,
    roundNumber,
    fallbackChecks,
  };

  return {
    status,
    action,
    target: input.issue.target,
    reason: buildRepairReason(input.issue),
    nextArtifacts: applyFallbackToArtifacts(
      input.state.artifacts,
      input.issue.target,
    ),
    executionPlan: buildExecutionPlan(input.issue.target),
    attempt,
    remainingRounds: Math.max(0, remainingRounds),
    remainingCostCents: remainingCostAfterAttempt,
    fallbackChecks,
  };
}

export function recordAutoRepairAttempt(
  state: AutoRepairLoopState,
  decision: AutoRepairDecision,
): AutoRepairLoopState {
  if (!decision.attempt) {
    return state;
  }

  return {
    ...state,
    attempts: [...state.attempts, decision.attempt],
    artifacts: decision.nextArtifacts,
    spentCostCents: decision.attempt.cumulativeCostCents,
  };
}

function blockedDecision(
  input: DecideAutoRepairInput,
  reason: string,
  remainingRounds: number,
  remainingCostCents?: number,
): AutoRepairDecision {
  return {
    status: 'blocked',
    action: 'return_explainable_error',
    target: input.issue.target,
    reason,
    nextArtifacts: input.state.artifacts,
    executionPlan: ['停止生成，向用户说明阻断原因和可调整选项。'],
    remainingRounds: Math.max(0, remainingRounds),
    remainingCostCents,
    fallbackChecks: [],
  };
}

function estimateCost(
  issue: AutoRepairIssue,
  options?: AutoRepairLoopOptions,
): number {
  const cost =
    issue.estimatedCostCents ??
    options?.defaultEstimatedCostCents?.[issue.target] ??
    DEFAULT_COST_BY_TARGET[issue.target];
  if (cost < 0) {
    throw new Error('AutoRepairIssue.estimatedCostCents 不能为负数。');
  }
  return cost;
}

function getRemainingCost(
  policy: GuardianPolicy,
  spentCostCents: number,
): number | undefined {
  return policy.maxEstimatedCostCents === undefined
    ? undefined
    : policy.maxEstimatedCostCents - spentCostCents;
}

function buildRepairReason(issue: AutoRepairIssue): string {
  if (issue.target === 'quality' && issue.qualityReview) {
    return `质量评分 ${issue.qualityReview.score.total} 未达门槛，进入质量重写。`;
  }
  return issue.message.trim() || '根据生成问题进入自动修复。';
}

function buildFallbackChecks(target: AutoRepairTarget): string[] {
  if (target === 'asset') {
    return ['图片生成失败使用模板占位图', '视频失败使用静态过场'];
  }
  if (target === 'tts') {
    return ['TTS 失败显示字幕', '旁白 manifest 包含 fallbackSubtitle'];
  }
  if (target === 'build') {
    return ['修复 TypeScript 构建阻断项后重新验证'];
  }
  if (target === 'browser') {
    return ['浏览器 smoke 失败后重跑关键流程'];
  }
  return [];
}

function buildExecutionPlan(target: AutoRepairTarget): string[] {
  if (target === 'quality' || target === 'plan') {
    return [
      '基于阻断问题重写 CoursePlanOption，保留原 CourseSpec。',
      '重新调用 score_course_quality 复评修复后的方案。',
      '只有复评通过后才允许等待用户确认或进入 generate_course_gdd。',
    ];
  }
  if (target === 'gdd') {
    return [
      '基于校验问题修订 Course GDD，保留已确认 CourseSpec 和 selectedPlan。',
      '重新执行 Course GDD schema、学习目标闭环和质量复核。',
    ];
  }
  if (target === 'asset') {
    return [
      '把高风险图片或视频降级为模板占位图或静态过场。',
      '重新运行 validate_course_package，确认降级不破坏课程闭环。',
    ];
  }
  if (target === 'tts') {
    return [
      '写入字幕旁白 fallbackSubtitle，保留 narration manifest。',
      '重新运行 validate_course_package，确认无音频时仍可完成课程。',
    ];
  }
  if (target === 'build') {
    return [
      '修复 TypeScript 或模板复制阻断项。',
      '重新运行课程包构建和 validate_course_package。',
    ];
  }
  return [
    '调整浏览器 smoke 流程或运行时状态暴露。',
    '重新运行课程浏览器 smoke，确认可到达学习报告。',
  ];
}

function applyFallbackToArtifacts(
  artifacts: AutoRepairArtifacts,
  target: AutoRepairTarget,
): AutoRepairArtifacts {
  if (target === 'asset' && artifacts.courseGdd) {
    return {
      ...artifacts,
      courseGdd: {
        ...artifacts.courseGdd,
        selectedPlan: {
          ...artifacts.courseGdd.selectedPlan,
          assetComplexity: 'low',
        },
        assetPlan: {
          ...artifacts.courseGdd.assetPlan,
          video: [],
        },
        validationPlan: {
          ...artifacts.courseGdd.validationPlan,
          fallbackChecks: unique([
            ...artifacts.courseGdd.validationPlan.fallbackChecks,
            '图片生成失败使用模板占位图',
            '视频失败使用静态过场',
          ]),
        },
      },
    };
  }

  if (target === 'tts' && artifacts.courseGdd) {
    return {
      ...artifacts,
      courseGdd: {
        ...artifacts.courseGdd,
        validationPlan: {
          ...artifacts.courseGdd.validationPlan,
          fallbackChecks: unique([
            ...artifacts.courseGdd.validationPlan.fallbackChecks,
            'TTS 失败显示字幕',
            '旁白 manifest 包含 fallbackSubtitle',
          ]),
        },
      },
    };
  }

  return artifacts;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
