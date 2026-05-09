/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CourseSpec } from '../schemas.js';
import type {
  GuardianPolicyIssue,
  GuardianPolicy,
} from '../product/guardianPolicy.js';
import type {
  IntakeFieldName,
  IntakeMissingField,
  IntakeQuestion,
} from '../product/intakeSession.js';

export interface OneShotClarificationInput {
  courseSpec: Partial<CourseSpec>;
  guardianPolicy?: GuardianPolicy;
  guardianIssues?: GuardianPolicyIssue[];
  safetyBlockedReasons?: string[];
  depthConflict?: boolean;
}

export interface ClarificationPolicyResult {
  missingFields: IntakeMissingField[];
  requiredClarifications: IntakeQuestion[];
  blockedReasons: string[];
}

export function evaluateOneShotClarifications(
  input: OneShotClarificationInput,
): ClarificationPolicyResult {
  const missingFields = collectOneShotMissingFields(input);
  const blockedReasons = buildBlockedReasons(input);

  return {
    missingFields,
    requiredClarifications: missingFields
      .filter((field) => field.impact === 'high')
      .map(buildOneShotQuestion),
    blockedReasons,
  };
}

function collectOneShotMissingFields(
  input: OneShotClarificationInput,
): IntakeMissingField[] {
  const missing: IntakeMissingField[] = [];
  const spec = input.courseSpec;

  if (!spec.studentProfile?.grade) {
    missing.push(
      buildMissingField('grade', 'high', '缺少年级会影响课程难度、阅读量和题目复杂度。'),
    );
  }
  if (!spec.subject?.trim()) {
    missing.push(
      buildMissingField('subject', 'high', '缺少学科无法进入受控玩法和课程目标映射。'),
    );
  }
  if (!spec.topic?.trim()) {
    missing.push(
      buildMissingField('topic', 'high', '缺少学习主题无法生成课程主线。'),
    );
  }
  if (!spec.learningGoals?.length) {
    missing.push(
      buildMissingField('learningGoals', 'high', '缺少学习目标无法验证课程闭环。'),
    );
  }
  if (!spec.explanationDepth || input.depthConflict) {
    missing.push(
      buildMissingField(
        'explanationDepth',
        'high',
        input.depthConflict
          ? '讲解深度表达存在冲突，需要确认课程难度。'
          : '缺少讲解深度无法保证教学质量。',
      ),
    );
  }
  if (!spec.durationMinutes) {
    missing.push(
      buildMissingField('durationMinutes', 'low', '未提供时长时可默认使用 20 分钟。'),
    );
  }
  if (!spec.styleSpec) {
    missing.push(
      buildMissingField('style', 'low', '未提供风格时可用偏好或默认明亮风格补齐。'),
    );
  }

  return missing;
}

function buildMissingField(
  field: IntakeFieldName,
  impact: IntakeMissingField['impact'],
  reason: string,
): IntakeMissingField {
  return { field, impact, reason };
}

function buildOneShotQuestion(field: IntakeMissingField): IntakeQuestion {
  const promptByField: Record<IntakeFieldName, string> = {
    grade: '这节课面向几年级学生？',
    subject: '这节课属于哪个学科？',
    topic: '这节课想学习哪个具体主题？',
    learningGoals: '完成课程后，希望学生能掌握什么？',
    durationMinutes: '这节课预计学习多长时间？',
    style: '希望课程使用什么主题或视觉风格？',
    explanationDepth: '希望讲解深度是入门、标准、深入还是挑战？',
  };

  return {
    id: `one_shot_ask_${field.field}`,
    field: field.field,
    prompt: promptByField[field.field],
    required: field.impact === 'high',
  };
}

function buildBlockedReasons(input: OneShotClarificationInput): string[] {
  const policyReasons =
    input.guardianIssues
      ?.filter((issue) => issue.severity === 'error')
      .map((issue) => issue.message) ?? [];

  return [
    ...(input.safetyBlockedReasons ?? []),
    ...policyReasons,
  ];
}
