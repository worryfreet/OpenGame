/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import AjvPkg from 'ajv';
import type { ErrorObject } from 'ajv';
import type { CourseGDD, CoursePlanOption, CourseSpec } from './schemas.js';
import {
  courseGddSchema,
  coursePlanOptionSchema,
  courseSpecSchema,
  type ExplanationDepthSpec,
} from './schemas.js';
import { mapSubjectToGameplayCandidates } from './gameplayMapping.js';
import { validateCourseWorkflow } from './courseWorkflow.js';

// Ajv 的 ESM/CJS 互操作类型不稳定，这里与项目现有 SchemaValidator 保持一致。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AjvClass = (AjvPkg as any).default || AjvPkg;
const ajv = new AjvClass({ allErrors: true, strictSchema: false });

export interface CourseValidationIssue {
  path: string;
  message: string;
}

export interface CourseValidationResult<T> {
  valid: boolean;
  data?: T;
  errors: CourseValidationIssue[];
  warnings: CourseValidationIssue[];
}

export function validateCourseSpec(
  input: unknown,
): CourseValidationResult<CourseSpec> {
  const schemaErrors = validateWithSchema(courseSpecSchema, input);
  if (schemaErrors.length > 0) {
    return {
      valid: false,
      errors: schemaErrors,
      warnings: [],
    };
  }

  const spec = input as CourseSpec;
  const errors: CourseValidationIssue[] = [];
  const warnings: CourseValidationIssue[] = [];

  validateGuardianLimits(spec, errors);
  validateExplanationDepth(spec.explanationDepth, errors);
  validateLearningGoalCoverage(spec, errors);
  validateGameplayAvailability(spec, errors);

  return {
    valid: errors.length === 0,
    data: spec,
    errors,
    warnings,
  };
}

export function validateCoursePlanOption(
  input: unknown,
): CourseValidationResult<CoursePlanOption> {
  const errors = validateWithSchema(coursePlanOptionSchema, input);
  if (errors.length === 0) {
    const option = input as CoursePlanOption;
    if (option.workflow) {
      errors.push(
        ...validateCourseWorkflow(
          option.workflow,
          option.assessmentPoints.map((_, index) => `goal_${index + 1}`),
        ).errors,
      );
    }
  }
  return {
    valid: errors.length === 0,
    data: errors.length === 0 ? (input as CoursePlanOption) : undefined,
    errors,
    warnings: [],
  };
}

export function validateCoursePlanOptions(
  input: unknown,
): CourseValidationResult<CoursePlanOption[]> {
  if (!Array.isArray(input)) {
    return {
      valid: false,
      errors: [{ path: '', message: '课程方案必须是数组。' }],
      warnings: [],
    };
  }

  const errors: CourseValidationIssue[] = [];
  const plans: CoursePlanOption[] = [];
  input.forEach((option, index) => {
    const result = validateCoursePlanOption(option);
    if (result.data) {
      plans.push(result.data);
    }
    for (const error of result.errors) {
      errors.push({
        path: `[${index}]${error.path}`,
        message: error.message,
      });
    }
  });

  if (input.length < 3) {
    errors.push({
      path: '',
      message: '课程方案至少需要 3 个，分别覆盖稳定型、平衡型和创意型。',
    });
  }

  return {
    valid: errors.length === 0,
    data: errors.length === 0 ? plans : undefined,
    errors,
    warnings: [],
  };
}

export function validateCourseGdd(
  input: unknown,
): CourseValidationResult<CourseGDD> {
  const schemaErrors = validateWithSchema(courseGddSchema, input);
  if (schemaErrors.length > 0) {
    return {
      valid: false,
      errors: schemaErrors,
      warnings: [],
    };
  }

  const gdd = input as CourseGDD;
  const errors: CourseValidationIssue[] = [];
  const warnings: CourseValidationIssue[] = [];

  const specValidation = validateCourseSpec(gdd.courseSpec);
  errors.push(...prefixIssues('/courseSpec', specValidation.errors));
  warnings.push(...prefixIssues('/courseSpec', specValidation.warnings));

  const planValidation = validateCoursePlanOption(gdd.selectedPlan);
  errors.push(...prefixIssues('/selectedPlan', planValidation.errors));

  validateCourseGddGoalCoverage(gdd, errors);
  validateCourseGddReferences(gdd, errors);
  validateCourseGddDepth(gdd, errors);
  validateCourseGddAssets(gdd, errors, warnings);
  validateCourseGddValidationPlan(gdd, errors);
  validateCourseGddWorkflow(gdd, errors);

  return {
    valid: errors.length === 0,
    data: errors.length === 0 ? gdd : undefined,
    errors,
    warnings,
  };
}

function validateCourseGddWorkflow(
  gdd: CourseGDD,
  errors: CourseValidationIssue[],
): void {
  const goalIds = gdd.courseSpec.learningGoals.map(
    (_goal, index) => `goal_${index + 1}`,
  );
  const workflow = gdd.workflow ?? gdd.selectedPlan.workflow;
  const result = validateCourseWorkflow(workflow, goalIds);
  errors.push(...result.errors);
}

function validateWithSchema(
  schema: unknown,
  input: unknown,
): CourseValidationIssue[] {
  const validate = ajv.compile(schema);
  const valid = validate(input);
  if (valid) {
    return [];
  }

  return (validate.errors ?? []).map(formatAjvError);
}

function formatAjvError(error: ErrorObject): CourseValidationIssue {
  return {
    path: error.instancePath || '',
    message: error.message ?? '字段不符合课程 schema。',
  };
}

function prefixIssues(
  prefix: string,
  issues: CourseValidationIssue[],
): CourseValidationIssue[] {
  return issues.map((issue) => ({
    path: `${prefix}${issue.path}`,
    message: issue.message,
  }));
}

function validateGuardianLimits(
  spec: CourseSpec,
  errors: CourseValidationIssue[],
): void {
  const limits = spec.studentProfile.guardianLimits;
  if (!limits) {
    return;
  }

  const referenceImages = spec.styleSpec.referenceImages ?? [];
  if (!limits.allowUploadedImages && referenceImages.length > 0) {
    errors.push({
      path: '/styleSpec/referenceImages',
      message: '监护人关闭上传图片时，不允许提供 referenceImages。',
    });
  }

  if (spec.durationMinutes > limits.maxSessionMinutes) {
    errors.push({
      path: '/durationMinutes',
      message: '课程时长不能超过监护人设置的单次使用时长。',
    });
  }
}

function validateExplanationDepth(
  depth: ExplanationDepthSpec,
  errors: CourseValidationIssue[],
): void {
  const conceptCount = depth.conceptLayers.length;
  const misconceptionCount = depth.conceptLayers.reduce(
    (total, layer) => total + layer.misconceptionToAddress.length,
    0,
  );
  const plan = depth.examplePlan;

  if (depth.depthLevel === 'intro') {
    if (
      conceptCount < 1 ||
      plan.guidedPractice + plan.independentChallenges < 2
    ) {
      errors.push({
        path: '/explanationDepth',
        message: 'intro 深度至少需要 1 个核心概念和 2 个即时练习。',
      });
    }
    return;
  }

  if (!depth.priorKnowledgeCheck) {
    errors.push({
      path: '/explanationDepth/priorKnowledgeCheck',
      message: 'standard/deep/challenge 深度必须包含前置诊断。',
    });
  }

  if (depth.depthLevel === 'standard') {
    if (conceptCount < 2 || conceptCount > 3) {
      errors.push({
        path: '/explanationDepth/conceptLayers',
        message: 'standard 深度需要 2-3 个概念层。',
      });
    }
    if (
      plan.workedExamples < 2 ||
      plan.guidedPractice + plan.independentChallenges < 3
    ) {
      errors.push({
        path: '/explanationDepth/examplePlan',
        message: 'standard 深度至少需要 2 个例题和 3 个练习。',
      });
    }
  }

  if (depth.depthLevel === 'deep') {
    if (conceptCount < 2 || misconceptionCount < 1 || plan.transferTasks < 1) {
      errors.push({
        path: '/explanationDepth',
        message: 'deep 深度必须包含多层概念、常见误区和迁移任务。',
      });
    }
  }

  if (depth.depthLevel === 'challenge') {
    if (plan.transferTasks < 2 || depth.masteryEvidence.length < 2) {
      errors.push({
        path: '/explanationDepth',
        message: 'challenge 深度必须包含开放迁移任务和反思复盘证据。',
      });
    }
  }

  if (depth.feedbackDepth === 'answer_only') {
    errors.push({
      path: '/explanationDepth/feedbackDepth',
      message: 'standard/deep/challenge 深度不允许只反馈答案。',
    });
  }
}

function validateLearningGoalCoverage(
  spec: CourseSpec,
  errors: CourseValidationIssue[],
): void {
  if (spec.explanationDepth.conceptLayers.length < spec.learningGoals.length) {
    errors.push({
      path: '/explanationDepth/conceptLayers',
      message: '每个 learningGoal 至少需要对应一个 conceptLayer。',
    });
  }

  if (
    spec.explanationDepth.masteryEvidence.length < spec.learningGoals.length
  ) {
    errors.push({
      path: '/explanationDepth/masteryEvidence',
      message: '每个 learningGoal 至少需要一个评价证据。',
    });
  }
}

function validateGameplayAvailability(
  spec: CourseSpec,
  errors: CourseValidationIssue[],
): void {
  const candidates = mapSubjectToGameplayCandidates(spec);
  if (candidates.length === 0) {
    errors.push({
      path: '/subject',
      message: '当前学科没有可用的受控课程玩法族。',
    });
  }
}

function validateCourseGddGoalCoverage(
  gdd: CourseGDD,
  errors: CourseValidationIssue[],
): void {
  for (const goal of gdd.courseSpec.learningGoals) {
    const hasLessonUnit = gdd.lessonUnits.some(
      (unit) => unit.learningGoal === goal,
    );
    const hasInteraction = gdd.interactionSpecs.some((interaction) => {
      const unit = gdd.lessonUnits.find(
        (lessonUnit) => lessonUnit.id === interaction.lessonUnitId,
      );
      return unit?.learningGoal === goal;
    });
    const hasAssessment = gdd.assessmentSpec.items.some(
      (item) => item.learningGoal === goal,
    );

    if (!hasLessonUnit || !hasInteraction || !hasAssessment) {
      errors.push({
        path: '/lessonUnits',
        message: `学习目标「${goal}」必须同时有讲解、互动和评价闭环。`,
      });
    }
  }
}

function validateCourseGddReferences(
  gdd: CourseGDD,
  errors: CourseValidationIssue[],
): void {
  const lessonUnitIds = new Set(gdd.lessonUnits.map((unit) => unit.id));
  const assessmentIds = new Set(
    gdd.assessmentSpec.items.map((item) => item.id),
  );

  for (const unit of gdd.lessonUnits) {
    if (!assessmentIds.has(unit.assessmentPointId)) {
      errors.push({
        path: `/lessonUnits/${unit.id}/assessmentPointId`,
        message: `lessonUnit 引用的 assessmentPointId「${unit.assessmentPointId}」不存在。`,
      });
    }
  }

  for (const interaction of gdd.interactionSpecs) {
    if (!lessonUnitIds.has(interaction.lessonUnitId)) {
      errors.push({
        path: `/interactionSpecs/${interaction.id}/lessonUnitId`,
        message: `interactionSpec 引用的 lessonUnitId「${interaction.lessonUnitId}」不存在。`,
      });
    }
  }

  for (const segment of gdd.narrationPlan.segments) {
    const referencesLessonUnit = lessonUnitIds.has(segment.id);
    const referencesTargetScene = gdd.selectedPlan.scenePlan.some((scene) =>
      segment.targetScene.includes(scene),
    );
    if (!referencesLessonUnit && !referencesTargetScene) {
      errors.push({
        path: `/narrationPlan/segments/${segment.id}`,
        message:
          '旁白分段必须能对应 lessonUnit 或 selectedPlan.scenePlan 中的场景。',
      });
    }
  }
}

function validateCourseGddDepth(
  gdd: CourseGDD,
  errors: CourseValidationIssue[],
): void {
  const advancedDepth =
    gdd.courseSpec.explanationDepth.depthLevel === 'standard' ||
    gdd.courseSpec.explanationDepth.depthLevel === 'deep' ||
    gdd.courseSpec.explanationDepth.depthLevel === 'challenge';

  for (const unit of gdd.lessonUnits) {
    if (advancedDepth && unit.explanationScript.length < 40) {
      errors.push({
        path: `/lessonUnits/${unit.id}/explanationScript`,
        message: 'standard/deep/challenge 深度的讲解脚本不能过短。',
      });
    }
    if (advancedDepth && unit.feedbackStrategy.length < 12) {
      errors.push({
        path: `/lessonUnits/${unit.id}/feedbackStrategy`,
        message: 'feedbackStrategy 必须说明错因和下一步提示。',
      });
    }
  }

  for (const item of gdd.assessmentSpec.items) {
    if (advancedDepth && item.explanation.length < 20) {
      errors.push({
        path: `/assessmentSpec/items/${item.id}/explanation`,
        message: '评价题解析必须说明关键推理步骤，不能只给答案。',
      });
    }
    if (!item.misconceptionTag || !item.hint) {
      errors.push({
        path: `/assessmentSpec/items/${item.id}`,
        message: '评价题必须包含错因类型和下一步提示。',
      });
    }
  }

  if (
    (gdd.courseSpec.explanationDepth.depthLevel === 'deep' ||
      gdd.courseSpec.explanationDepth.depthLevel === 'challenge') &&
    !hasTransferOrReflection(gdd)
  ) {
    errors.push({
      path: '/validationPlan',
      message: 'deep/challenge 深度必须包含迁移任务或反思复盘。',
    });
  }
}

function validateCourseGddAssets(
  gdd: CourseGDD,
  errors: CourseValidationIssue[],
  warnings: CourseValidationIssue[],
): void {
  const guardianLimits = gdd.courseSpec.studentProfile.guardianLimits;
  if (
    !guardianLimits?.allowGeneratedVideo &&
    (gdd.assetPlan.video?.length ?? 0) > 0
  ) {
    errors.push({
      path: '/assetPlan/video',
      message: '监护人关闭生成视频时，Course GDD 不允许规划视频资产。',
    });
  }

  for (const video of gdd.assetPlan.video ?? []) {
    if (!video.optional) {
      errors.push({
        path: `/assetPlan/video/${video.key}`,
        message: 'MVP 1.0 视频只能作为可选资产，必须可关闭。',
      });
    }
  }

  if (gdd.narrationPlan.segments.length < gdd.lessonUnits.length) {
    warnings.push({
      path: '/narrationPlan/segments',
      message: '旁白分段少于讲解单元，后续 TTS 可能无法覆盖全部讲解。',
    });
  }
}

function validateCourseGddValidationPlan(
  gdd: CourseGDD,
  errors: CourseValidationIssue[],
): void {
  const checks = gdd.validationPlan.requiredChecks.join('');
  for (const required of ['schema', '学习目标', '讲解', '互动', '评价']) {
    if (!checks.includes(required)) {
      errors.push({
        path: '/validationPlan/requiredChecks',
        message: `validationPlan.requiredChecks 必须包含「${required}」检查。`,
      });
    }
  }
}

function hasTransferOrReflection(gdd: CourseGDD): boolean {
  const text = [
    ...gdd.lessonUnits.map((unit) => unit.interactionTask),
    ...gdd.assessmentSpec.masteryCriteria,
    ...gdd.validationPlan.requiredChecks,
  ].join('');
  return /迁移|应用|反思|复盘|开放/.test(text);
}
