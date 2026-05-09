/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ContentStrictness,
  CourseAssetPlan,
  CourseGDD,
  CourseSpec,
  ValidationPlan,
} from '../schemas.js';

export interface GuardianPolicy {
  policyId: string;
  profileId: string;
  maxSessionMinutes: number;
  allowUploadedImages: boolean;
  allowGeneratedVideo: boolean;
  contentStrictness: ContentStrictness;
  maxRetryCount: number;
  maxEstimatedCostCents?: number;
}

export interface GuardianPolicyIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface GuardianPolicyResult {
  valid: boolean;
  courseSpec?: CourseSpec;
  courseGdd?: CourseGDD;
  issues: GuardianPolicyIssue[];
}

export interface GuardianPublishValidationResult {
  passed: boolean;
  issues: GuardianPolicyIssue[];
}

export interface AssetGenerationGuard {
  shouldGenerateVideo: boolean;
  shouldGenerateImages: boolean;
  blockedReasons: GuardianPolicyIssue[];
}

export function buildDefaultGuardianPolicy(profileId: string): GuardianPolicy {
  return {
    policyId: `${profileId}:default-policy`,
    profileId,
    maxSessionMinutes: 25,
    allowUploadedImages: false,
    allowGeneratedVideo: false,
    contentStrictness: 'strict',
    maxRetryCount: 2,
    maxEstimatedCostCents: 80,
  };
}

export function applyGuardianPolicyToCourseSpec(
  courseSpec: CourseSpec,
  policy: GuardianPolicy,
): GuardianPolicyResult {
  const issues: GuardianPolicyIssue[] = [];
  const policyIssues = validateGuardianPolicy(policy);
  issues.push(...policyIssues);
  const limitedSpec: CourseSpec = {
    ...courseSpec,
    durationMinutes: Math.min(
      courseSpec.durationMinutes,
      policy.maxSessionMinutes,
    ),
    studentProfile: {
      ...courseSpec.studentProfile,
      guardianLimits: {
        maxSessionMinutes: policy.maxSessionMinutes,
        allowUploadedImages: policy.allowUploadedImages,
        allowGeneratedVideo: policy.allowGeneratedVideo,
        contentStrictness: policy.contentStrictness,
      },
    },
    styleSpec: {
      ...courseSpec.styleSpec,
      referenceImages: policy.allowUploadedImages
        ? courseSpec.styleSpec.referenceImages
        : undefined,
    },
  };

  if (courseSpec.durationMinutes > policy.maxSessionMinutes) {
    issues.push({
      path: '/durationMinutes',
      message: '课程时长超过家长设置，已缩短到允许范围。',
      severity: 'warning',
    });
  }

  if (
    !policy.allowUploadedImages &&
    (courseSpec.styleSpec.referenceImages?.length ?? 0) > 0
  ) {
    issues.push({
      path: '/styleSpec/referenceImages',
      message: '家长关闭上传图片，参考图已从课程输入中移除。',
      severity: 'warning',
    });
  }

  return {
    valid: policyIssues.every((issue) => issue.severity !== 'error'),
    courseSpec: limitedSpec,
    issues,
  };
}

export function applyGuardianPolicyToCourseGdd(
  courseGdd: CourseGDD,
  policy: GuardianPolicy,
): GuardianPolicyResult {
  const specResult = applyGuardianPolicyToCourseSpec(
    courseGdd.courseSpec,
    policy,
  );
  const issues = [...specResult.issues];
  const boundedAssetPlan = applyPolicyToAssetPlan(
    courseGdd.assetPlan,
    policy,
    issues,
  );
  const boundedValidationPlan = applyPolicyToValidationPlan(
    courseGdd.validationPlan,
    policy,
  );
  const boundedGdd: CourseGDD = {
    ...courseGdd,
    courseSpec: specResult.courseSpec ?? courseGdd.courseSpec,
    selectedPlan: {
      ...courseGdd.selectedPlan,
      assetComplexity:
        policy.maxEstimatedCostCents !== undefined &&
        policy.maxEstimatedCostCents <= 40
          ? 'low'
          : courseGdd.selectedPlan.assetComplexity,
    },
    assetPlan: boundedAssetPlan,
    validationPlan: boundedValidationPlan,
  };

  return {
    valid: issues.every((issue) => issue.severity !== 'error'),
    courseSpec: boundedGdd.courseSpec,
    courseGdd: boundedGdd,
    issues,
  };
}

export function getAssetGenerationGuard(
  courseGdd: CourseGDD,
  policy: GuardianPolicy,
): AssetGenerationGuard {
  const blockedReasons: GuardianPolicyIssue[] = [];
  const hasVideoPlan = (courseGdd.assetPlan.video?.length ?? 0) > 0;
  if (!policy.allowGeneratedVideo && hasVideoPlan) {
    blockedReasons.push({
      path: '/assetPlan/video',
      message: '家长关闭生成视频，必须跳过视频资产生成。',
      severity: 'warning',
    });
  }

  return {
    shouldGenerateVideo: policy.allowGeneratedVideo && hasVideoPlan,
    shouldGenerateImages: courseGdd.assetPlan.images.length > 0,
    blockedReasons,
  };
}

export function validateGuardianPolicyForPublish(
  courseGdd: CourseGDD,
  policy: GuardianPolicy,
): GuardianPublishValidationResult {
  const issues = validateGuardianPolicy(policy);
  const limits = courseGdd.courseSpec.studentProfile.guardianLimits;

  if (courseGdd.courseSpec.durationMinutes > policy.maxSessionMinutes) {
    issues.push({
      path: '/courseSpec/durationMinutes',
      message: '课程包时长超过家长设置，发布前必须缩短。',
      severity: 'error',
    });
  }

  if (!policy.allowUploadedImages && hasReferenceImages(courseGdd.courseSpec)) {
    issues.push({
      path: '/courseSpec/styleSpec/referenceImages',
      message: '家长关闭上传图片，发布包不能保留参考图。',
      severity: 'error',
    });
  }

  if (
    !policy.allowGeneratedVideo &&
    (courseGdd.assetPlan.video?.length ?? 0) > 0
  ) {
    issues.push({
      path: '/assetPlan/video',
      message: '家长关闭生成视频，发布包不能包含视频资产计划。',
      severity: 'error',
    });
  }

  if (
    limits &&
    (limits.maxSessionMinutes !== policy.maxSessionMinutes ||
      limits.allowUploadedImages !== policy.allowUploadedImages ||
      limits.allowGeneratedVideo !== policy.allowGeneratedVideo ||
      limits.contentStrictness !== policy.contentStrictness)
  ) {
    issues.push({
      path: '/courseSpec/studentProfile/guardianLimits',
      message: 'CourseSpec 中的家长限制与当前 GuardianPolicy 不一致。',
      severity: 'error',
    });
  }

  return {
    passed: issues.every((issue) => issue.severity !== 'error'),
    issues,
  };
}

export function validateGuardianPolicy(
  policy: GuardianPolicy,
): GuardianPolicyIssue[] {
  const issues: GuardianPolicyIssue[] = [];

  if (!policy.policyId.trim()) {
    issues.push({
      path: '/policyId',
      message: 'GuardianPolicy 必须包含 policyId。',
      severity: 'error',
    });
  }

  if (!policy.profileId.trim()) {
    issues.push({
      path: '/profileId',
      message: 'GuardianPolicy 必须通过 profileId 关联学生档案。',
      severity: 'error',
    });
  }

  if (policy.maxSessionMinutes < 5 || policy.maxSessionMinutes > 60) {
    issues.push({
      path: '/maxSessionMinutes',
      message: '单次课程时长必须在 5 到 60 分钟之间。',
      severity: 'error',
    });
  }

  if (policy.maxRetryCount < 0 || policy.maxRetryCount > 5) {
    issues.push({
      path: '/maxRetryCount',
      message: '自动重试次数必须在 0 到 5 次之间。',
      severity: 'error',
    });
  }

  if (
    policy.maxEstimatedCostCents !== undefined &&
    (policy.maxEstimatedCostCents < 0 || policy.maxEstimatedCostCents > 500)
  ) {
    issues.push({
      path: '/maxEstimatedCostCents',
      message: '单次课程生成预算必须在 0 到 500 分之间。',
      severity: 'error',
    });
  }

  return issues;
}

function applyPolicyToAssetPlan(
  assetPlan: CourseAssetPlan,
  policy: GuardianPolicy,
  issues: GuardianPolicyIssue[],
): CourseAssetPlan {
  if (policy.allowGeneratedVideo) {
    return assetPlan;
  }

  if ((assetPlan.video?.length ?? 0) > 0) {
    issues.push({
      path: '/assetPlan/video',
      message: '家长关闭生成视频，视频资产计划已移除。',
      severity: 'warning',
    });
  }

  return {
    ...assetPlan,
    video: [],
  };
}

function applyPolicyToValidationPlan(
  validationPlan: ValidationPlan,
  policy: GuardianPolicy,
): ValidationPlan {
  if (policy.allowGeneratedVideo) {
    return validationPlan;
  }

  return {
    ...validationPlan,
    requiredChecks: validationPlan.requiredChecks.filter(
      (check) => !/视频|video/i.test(check),
    ),
    browserFlow: validationPlan.browserFlow.filter(
      (step) => !/视频|video/i.test(step),
    ),
    fallbackChecks: unique([
      ...validationPlan.fallbackChecks,
      '视频关闭时使用静态过场和字幕说明',
    ]),
  };
}

function hasReferenceImages(courseSpec: CourseSpec): boolean {
  return (courseSpec.styleSpec.referenceImages?.length ?? 0) > 0;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
