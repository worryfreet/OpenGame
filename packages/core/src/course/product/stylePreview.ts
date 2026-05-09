/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AssetComplexity,
  CoursePlanOption,
  CourseSpec,
  ExplanationDepthLevel,
  ExplanationDepthSpec,
  StyleSpec,
} from '../schemas.js';
import {
  mapSubjectToGameplayCandidates,
  type GameplayCandidate,
} from '../gameplayMapping.js';
import { scoreCoursePlan } from '../planScoring.js';

export interface StylePreviewInput {
  styleSpec: StyleSpec;
  subject?: string;
  topic?: string;
  grade?: number;
  referenceImageAnalysis?: string;
}

export interface StylePreview {
  styleSpec: StyleSpec;
  palette: string[];
  characterDirection: string;
  uiMood: string;
  referenceImageAnalysis?: string;
  forbiddenElements: string[];
  previewPrompt: string;
  safetyWarnings: string[];
}

export interface CoursePlanConfirmationOption {
  id: string;
  title: string;
  courseArchetype: CoursePlanOption['courseArchetype'];
  gameplayType: string;
  score: CoursePlanOption['score'];
  risks: string[];
  estimatedCostCents: number;
  estimatedDurationMinutes: number;
  explanationDepthLevel: ExplanationDepthLevel;
  explanationDepthSummary: string;
  learningLoopSummary: string;
}

export interface CoursePlanConfirmationSummary {
  options: CoursePlanConfirmationOption[];
  recommendedOptionId: string;
}

export interface AdjustCoursePlanDepthResult {
  courseSpec: CourseSpec;
  confirmationSummary: CoursePlanConfirmationSummary;
}

const KNOWN_IP_PATTERNS = [
  /pokemon|pokémon|宝可梦|皮卡丘/i,
  /disney|迪士尼|冰雪奇缘|frozen/i,
  /mario|马里奥|任天堂/i,
  /marvel|漫威|蜘蛛侠|钢铁侠|复仇者/i,
  /harry\s*potter|哈利波特/i,
  /minion|小黄人/i,
  /minecraft|我的世界/i,
] as const;

export function generateStylePreview(input: StylePreviewInput): StylePreview {
  const ipMatches = collectKnownIpMatches([
    input.styleSpec.theme,
    input.styleSpec.visualMood,
    input.styleSpec.characterStyle,
    input.referenceImageAnalysis,
    ...input.styleSpec.forbidden,
  ]);
  const safeStyleSpec = sanitizeStyleSpec(input.styleSpec, ipMatches);
  const referenceImageAnalysis = sanitizeText(
    input.referenceImageAnalysis,
    ipMatches,
  );
  const forbiddenElements = dedupeNonEmpty([
    ...safeStyleSpec.forbidden,
    ...ipMatches.map((match) => `禁止直接使用知名 IP 风格：${match}`),
  ]);

  return {
    styleSpec: {
      ...safeStyleSpec,
      forbidden: forbiddenElements,
    },
    palette: normalizePalette(safeStyleSpec.palette),
    characterDirection: buildCharacterDirection(safeStyleSpec, input.grade),
    uiMood: buildUiMood(safeStyleSpec),
    referenceImageAnalysis,
    forbiddenElements,
    previewPrompt: buildPreviewPrompt({
      ...input,
      styleSpec: safeStyleSpec,
      referenceImageAnalysis,
    }),
    safetyWarnings: ipMatches.map(
      (match) => `已移除知名 IP 风格引用：${match}，改为原创同类气质描述。`,
    ),
  };
}

export function buildCoursePlanConfirmationSummary(
  courseSpec: CourseSpec,
  options: CoursePlanOption[],
): CoursePlanConfirmationSummary {
  const confirmationOptions = options.map((option) =>
    buildConfirmationOption(courseSpec, option),
  );
  return {
    options: confirmationOptions,
    recommendedOptionId: selectRecommendedOption(confirmationOptions),
  };
}

export function adjustCoursePlanDepth(
  courseSpec: CourseSpec,
  options: CoursePlanOption[],
  depthLevel: ExplanationDepthLevel,
): AdjustCoursePlanDepthResult {
  const adjustedSpec = {
    ...courseSpec,
    explanationDepth: adjustExplanationDepth(
      courseSpec.explanationDepth,
      depthLevel,
    ),
  };
  const rescoredOptions = options.map((option) => ({
    ...option,
    score: scoreCoursePlan({
      courseSpec: adjustedSpec,
      candidate: resolveCandidate(adjustedSpec, option),
      assetComplexity: option.assetComplexity,
      risks: option.risks,
    }),
  }));

  return {
    courseSpec: adjustedSpec,
    confirmationSummary: buildCoursePlanConfirmationSummary(
      adjustedSpec,
      rescoredOptions,
    ),
  };
}

function sanitizeStyleSpec(
  styleSpec: StyleSpec,
  ipMatches: string[],
): StyleSpec {
  return {
    ...styleSpec,
    theme: sanitizeText(styleSpec.theme, ipMatches) ?? '原创学习冒险',
    visualMood:
      sanitizeText(styleSpec.visualMood, ipMatches) ?? '清晰、明亮、适龄',
    characterStyle:
      sanitizeText(styleSpec.characterStyle, ipMatches) ?? '原创友好学习伙伴',
    forbidden: dedupeNonEmpty(
      styleSpec.forbidden.map(
        (item) => sanitizeText(item, ipMatches) ?? '禁止直接使用知名 IP 风格',
      ),
    ),
  };
}

function buildPreviewPrompt(input: StylePreviewInput): string {
  const context = [
    input.grade ? `${input.grade} 年级` : undefined,
    input.subject,
  ]
    .filter(Boolean)
    .join(' ');
  const topic = input.topic ? `《${input.topic}》` : '课程';
  const reference = input.referenceImageAnalysis
    ? `参考图只提取构图和色彩倾向：${input.referenceImageAnalysis}。`
    : '不依赖参考图生成。';

  return [
    `为${context ? `${context} ` : ''}${topic}生成原创风格板预览。`,
    `主题：${input.styleSpec.theme}。`,
    `配色：${normalizePalette(input.styleSpec.palette).join('、')}。`,
    `角色方向：${input.styleSpec.characterStyle}。`,
    `UI 情绪：${input.styleSpec.visualMood}，信息密度 ${input.styleSpec.uiDensity}。`,
    reference,
    `禁止元素：${dedupeNonEmpty(input.styleSpec.forbidden).join('、') || '无'}。`,
  ].join('\n');
}

function buildCharacterDirection(styleSpec: StyleSpec, grade?: number): string {
  const gradeHint = grade && grade <= 2 ? '低龄友好、轮廓简单' : '清晰可信';
  return `${gradeHint}的原创${styleSpec.characterStyle}，服务于${styleSpec.theme}主题。`;
}

function buildUiMood(styleSpec: StyleSpec): string {
  const densityMap: Record<StyleSpec['uiDensity'], string> = {
    low: '留白充足',
    medium: '信息层级清楚',
    high: '内容密集但分组明确',
  };
  return `${styleSpec.visualMood}，${densityMap[styleSpec.uiDensity]}。`;
}

function buildConfirmationOption(
  courseSpec: CourseSpec,
  option: CoursePlanOption,
): CoursePlanConfirmationOption {
  return {
    id: option.id,
    title: option.title,
    courseArchetype: option.courseArchetype,
    gameplayType: option.gameplayType,
    score: option.score,
    risks: option.risks,
    estimatedCostCents: estimateCostCents(
      option.assetComplexity,
      courseSpec.durationMinutes,
    ),
    estimatedDurationMinutes: estimateDurationMinutes(courseSpec, option),
    explanationDepthLevel: courseSpec.explanationDepth.depthLevel,
    explanationDepthSummary: summarizeExplanationDepth(
      courseSpec.explanationDepth,
      option,
    ),
    learningLoopSummary: option.learningLoop.join(' -> '),
  };
}

function adjustExplanationDepth(
  depth: ExplanationDepthSpec,
  depthLevel: ExplanationDepthLevel,
): ExplanationDepthSpec {
  const requirements = depthRequirements(depthLevel);
  return {
    ...depth,
    depthLevel,
    priorKnowledgeCheck: depth.priorKnowledgeCheck || depthLevel !== 'intro',
    examplePlan: {
      workedExamples: Math.max(
        depth.examplePlan.workedExamples,
        requirements.workedExamples,
      ),
      guidedPractice: Math.max(
        depth.examplePlan.guidedPractice,
        requirements.guidedPractice,
      ),
      independentChallenges: Math.max(
        depth.examplePlan.independentChallenges,
        requirements.independentChallenges,
      ),
      transferTasks: Math.max(
        depth.examplePlan.transferTasks,
        requirements.transferTasks,
      ),
    },
    feedbackDepth:
      depth.feedbackDepth === 'answer_only' && depthLevel !== 'intro'
        ? 'step_by_step'
        : depth.feedbackDepth,
  };
}

function depthRequirements(depthLevel: ExplanationDepthLevel): {
  workedExamples: number;
  guidedPractice: number;
  independentChallenges: number;
  transferTasks: number;
} {
  switch (depthLevel) {
    case 'intro':
      return {
        workedExamples: 1,
        guidedPractice: 1,
        independentChallenges: 1,
        transferTasks: 0,
      };
    case 'standard':
      return {
        workedExamples: 1,
        guidedPractice: 2,
        independentChallenges: 2,
        transferTasks: 1,
      };
    case 'deep':
      return {
        workedExamples: 2,
        guidedPractice: 2,
        independentChallenges: 2,
        transferTasks: 1,
      };
    case 'challenge':
      return {
        workedExamples: 2,
        guidedPractice: 2,
        independentChallenges: 3,
        transferTasks: 2,
      };
    default:
      return assertNever(depthLevel);
  }
}

function resolveCandidate(
  courseSpec: CourseSpec,
  option: CoursePlanOption,
): GameplayCandidate {
  return (
    mapSubjectToGameplayCandidates(courseSpec).find(
      (candidate) =>
        candidate.archetype === option.courseArchetype &&
        candidate.gameplayType === option.gameplayType,
    ) ?? {
      archetype: option.courseArchetype,
      gameplayType: option.gameplayType,
      fitReason: option.recommendationReason,
      maxRecommendedDepth: 'challenge',
      stability: option.score.implementationStability,
      subjectCategory: 'general',
    }
  );
}

function summarizeExplanationDepth(
  depth: ExplanationDepthSpec,
  option: CoursePlanOption,
): string {
  const plan = depth.examplePlan;
  return [
    `深度 ${depth.depthLevel}`,
    `${plan.workedExamples} 个讲解例题`,
    `${plan.guidedPractice} 个引导练习`,
    `${plan.independentChallenges} 个独立挑战`,
    `${plan.transferTasks} 个迁移任务`,
    `方案深度匹配 ${option.score.explanationDepthFit}`,
  ].join('，');
}

function estimateCostCents(
  assetComplexity: AssetComplexity,
  durationMinutes: number,
): number {
  const base: Record<AssetComplexity, number> = {
    low: 20,
    medium: 45,
    high: 75,
  };
  return base[assetComplexity] + Math.max(0, durationMinutes - 20);
}

function estimateDurationMinutes(
  courseSpec: CourseSpec,
  option: CoursePlanOption,
): number {
  const depthExtra: Record<ExplanationDepthLevel, number> = {
    intro: -3,
    standard: 0,
    deep: 5,
    challenge: 8,
  };
  const workflowExtra = option.workflow
    ? Math.max(0, option.workflow.nodes.length - 2) * 2
    : 0;
  return Math.max(
    5,
    Math.min(
      60,
      courseSpec.durationMinutes +
        depthExtra[courseSpec.explanationDepth.depthLevel] +
        workflowExtra,
    ),
  );
}

function selectRecommendedOption(
  options: CoursePlanConfirmationOption[],
): string {
  const [best] = [...options].sort(
    (a, b) => optionDecisionScore(b) - optionDecisionScore(a),
  );
  return best?.id ?? '';
}

function optionDecisionScore(option: CoursePlanConfirmationOption): number {
  return (
    option.score.learningFit * 0.3 +
    option.score.explanationDepthFit * 0.25 +
    option.score.safety * 0.2 +
    option.score.implementationStability * 0.15 +
    option.score.fun * 0.1 -
    option.estimatedCostCents * 0.03
  );
}

function collectKnownIpMatches(values: Array<string | undefined>): string[] {
  return dedupeNonEmpty(
    values.flatMap((value) =>
      KNOWN_IP_PATTERNS.flatMap((pattern) => value?.match(pattern)?.[0] ?? []),
    ),
  );
}

function sanitizeText(
  value: string | undefined,
  ipMatches: string[],
): string | undefined {
  if (!value) return undefined;
  let sanitized = value;
  for (const match of ipMatches) {
    sanitized = sanitized.replace(
      new RegExp(escapeRegExp(match), 'gi'),
      '原创',
    );
  }
  return sanitized.trim() || undefined;
}

function normalizePalette(palette: string[]): string[] {
  const normalized = dedupeNonEmpty(palette);
  return normalized.length > 0 ? normalized : ['#2563EB', '#F8FAFC', '#F59E0B'];
}

function dedupeNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertNever(value: never): never {
  throw new Error(`未支持的讲解深度：${String(value)}`);
}
