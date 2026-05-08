/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import process from 'node:process';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  type ToolInvocation,
  type ToolResult,
} from './tools.js';
import type { Config } from '../config/config.js';
import type { CourseGDD } from '../course/schemas.js';
import { courseGddSchema } from '../course/schemas.js';
import type { CourseContentJson } from '../course/courseGddMapper.js';
import type { CourseNarrationManifest } from '../course/tts/narrationManifest.js';
import { validateCourseWorkflow } from '../course/courseWorkflow.js';
import { getPlayletTemplate } from '../course/playletCatalog.js';
import { validateCourseGdd } from '../course/validation.js';
import { ToolDisplayNames, ToolNames } from './tool-names.js';
import { ToolErrorType } from './tool-error.js';

export type CoursePackageIssueSeverity = 'error' | 'warning' | 'info';

export interface CoursePackageValidationIssue {
  severity: CoursePackageIssueSeverity;
  code: string;
  path: string;
  message: string;
}

export interface CoursePackageValidationReport {
  passed: boolean;
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
  packageDir: string;
  issues: CoursePackageValidationIssue[];
}

export interface ValidateCoursePackageParams {
  packageDir: string;
  courseGdd: CourseGDD;
  courseContentPath?: string;
  assetPackPath?: string;
  narrationManifestPath?: string;
  mainPath?: string;
  levelManagerPath?: string;
}

interface AssetPackFileLike {
  key?: unknown;
  url?: unknown;
}

class ValidateCoursePackageInvocation extends BaseToolInvocation<
  ValidateCoursePackageParams,
  ToolResult
> {
  constructor(
    private config: Config,
    params: ValidateCoursePackageParams,
  ) {
    super(params);
  }

  getDescription(): string {
    return `验证课程包 ${this.params.packageDir} 的 Course GDD、课程配置、资产、旁白和场景注册。`;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    try {
      const report = await validateCoursePackage(this.config, this.params);
      const reportJson = JSON.stringify({ report }, null, 2);

      return {
        llmContent: `<course-package-validation>
${reportJson}
</course-package-validation>`,
        returnDisplay: formatDisplayReport(report),
        ...(report.passed
          ? {}
          : {
              error: {
                message: `课程包验证失败：${report.summary.errors} 个 error，${report.summary.warnings} 个 warning。`,
                type: ToolErrorType.EXECUTION_FAILED,
              },
            }),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Error validating course package: ${errorMessage}`,
        returnDisplay: `**课程包验证失败**\n\nError: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }
}

export class ValidateCoursePackageTool extends BaseDeclarativeTool<
  ValidateCoursePackageParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.VALIDATE_COURSE_PACKAGE;

  constructor(private config: Config) {
    super(
      ValidateCoursePackageTool.Name,
      ToolDisplayNames.VALIDATE_COURSE_PACKAGE,
      '验证生成后的课程游戏包，检查 Course GDD、courseContent.json、asset-pack.json、旁白 manifest、场景注册、首场景和适龄安全规则。',
      Kind.Think,
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          packageDir: { type: 'string', minLength: 1 },
          courseGdd: courseGddSchema,
          courseContentPath: { type: 'string', minLength: 1 },
          assetPackPath: { type: 'string', minLength: 1 },
          narrationManifestPath: { type: 'string', minLength: 1 },
          mainPath: { type: 'string', minLength: 1 },
          levelManagerPath: { type: 'string', minLength: 1 },
        },
        required: ['packageDir', 'courseGdd'],
      },
      false,
      true,
    );
  }

  protected override validateToolParamValues(
    params: ValidateCoursePackageParams,
  ): string | null {
    const gddValidation = validateCourseGdd(params.courseGdd);
    if (!gddValidation.valid) {
      return `Course GDD 校验失败：${formatCourseIssues(gddValidation.errors)}`;
    }
    return null;
  }

  protected createInvocation(
    params: ValidateCoursePackageParams,
  ): ToolInvocation<ValidateCoursePackageParams, ToolResult> {
    return new ValidateCoursePackageInvocation(this.config, params);
  }
}

export async function validateCoursePackage(
  config: Config,
  params: ValidateCoursePackageParams,
): Promise<CoursePackageValidationReport> {
  const packageDir = resolvePackageDir(config, params.packageDir);
  const issues: CoursePackageValidationIssue[] = [];
  const gddValidation = validateCourseGdd(params.courseGdd);
  pushCourseIssues(issues, gddValidation.errors, 'error', 'course_gdd_schema');
  pushCourseIssues(
    issues,
    gddValidation.warnings,
    'warning',
    'course_gdd_warning',
  );
  validateCourseGddAssessmentItems(params.courseGdd, issues);

  const courseContent = await readJsonOrIssue<CourseContentJson>(
    resolveInsidePackage(
      packageDir,
      params.courseContentPath ?? 'src/courseContent.json',
    ),
    issues,
    'course_content_missing',
    '课程包必须包含 src/courseContent.json。',
  );
  const assetPack = await readJsonOrIssue<Record<string, unknown>>(
    resolveInsidePackage(
      packageDir,
      params.assetPackPath ?? 'public/assets/asset-pack.json',
    ),
    issues,
    'asset_pack_missing',
    '课程包必须包含 public/assets/asset-pack.json。',
  );
  const narrationManifest = await readJsonOrIssue<CourseNarrationManifest>(
    resolveInsidePackage(
      packageDir,
      params.narrationManifestPath ??
        'public/assets/narration/narration-manifest.json',
    ),
    issues,
    'narration_manifest_missing',
    '课程包必须包含课程旁白 narration manifest；TTS 失败时也要写入字幕降级 manifest。',
  );
  const mainContent = await readTextOrIssue(
    resolveInsidePackage(packageDir, params.mainPath ?? 'src/main.ts'),
    issues,
    'main_missing',
    '课程包必须包含 src/main.ts 并注册课程场景。',
  );
  const levelManagerContent = await readTextOrIssue(
    resolveInsidePackage(
      packageDir,
      params.levelManagerPath ?? 'src/LevelManager.ts',
    ),
    issues,
    'level_manager_missing',
    '课程包必须包含 src/LevelManager.ts 并声明 LEVEL_ORDER。',
  );

  if (courseContent) {
    validateCourseContent(params.courseGdd, courseContent, issues);
    await validateWorkflowPackage(packageDir, courseContent, issues);
  }
  if (assetPack) {
    validateAssetPack(params.courseGdd, assetPack, packageDir, issues);
  }
  if (narrationManifest) {
    await validateNarrationManifest(
      params.courseGdd,
      narrationManifest,
      packageDir,
      issues,
    );
  }
  if (mainContent && levelManagerContent && courseContent) {
    validateSceneRegistration(
      courseContent,
      mainContent,
      levelManagerContent,
      issues,
    );
  }
  await validateCodeAssetReferences(packageDir, assetPack, issues);
  validateSafetyRules(params.courseGdd, courseContent, issues);

  const summary = {
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
    info: issues.filter((issue) => issue.severity === 'info').length,
  };

  if (summary.errors === 0) {
    issues.push({
      severity: 'info',
      code: 'course_package_passed',
      path: '/',
      message: '课程包通过阻断性检查，可以进入本地 build/test/browser 验证。',
    });
    summary.info += 1;
  }

  return {
    passed: summary.errors === 0,
    summary,
    packageDir,
    issues,
  };
}

async function validateWorkflowPackage(
  packageDir: string,
  content: CourseContentJson,
  issues: CoursePackageValidationIssue[],
): Promise<void> {
  const goalIds = content.learningGoals.map((goal) => goal.id);
  const workflow = content.workflow;
  const result = validateCourseWorkflow(workflow, goalIds);
  for (const error of result.errors) {
    issues.push({
      severity: 'error',
      code: 'course_workflow_invalid',
      path: `/src/courseContent.json${error.path}`,
      message: error.message,
    });
  }
  if (!workflow) {
    return;
  }

  const playletIds = [...new Set(workflow.nodes.map((node) => node.playletId))];
  for (const playletId of playletIds) {
    const template = getPlayletTemplate(playletId);
    if (!template) {
      issues.push({
        severity: 'error',
        code: 'playlet_unknown',
        path: `/src/courseContent.json/workflow/nodes/${playletId}`,
        message: `课程工作流引用未知玩法模板「${playletId}」。`,
      });
      continue;
    }
    await validatePlayletPackageFiles(packageDir, playletId, issues);
  }
  await validateNoGeneratedPlayletEngine(packageDir, playletIds, issues);
}

async function validatePlayletPackageFiles(
  packageDir: string,
  playletId: string,
  issues: CoursePackageValidationIssue[],
): Promise<void> {
  const playletDir = path.join(packageDir, 'src/playlets', playletId);
  for (const fileName of ['manifest.json', 'schema.json', 'sample.json']) {
    const filePath = path.join(playletDir, fileName);
    if (!(await fileExists(filePath))) {
      issues.push({
        severity: 'error',
        code: 'playlet_package_file_missing',
        path: path.relative(packageDir, filePath),
        message: `玩法模板包「${playletId}」缺少 ${fileName}。`,
      });
    }
  }
}

async function validateNoGeneratedPlayletEngine(
  packageDir: string,
  playletIds: string[],
  issues: CoursePackageValidationIssue[],
): Promise<void> {
  const playletsDir = path.join(packageDir, 'src/playlets');
  const sourceFiles = await collectSourceFiles(playletsDir);
  const allowedPrefixes = new Set([
    'shared/',
    ...playletIds.flatMap((playletId) => [
      `${playletId}/index.ts`,
      `${playletId}/manifest.json`,
      `${playletId}/schema.json`,
      `${playletId}/sample.json`,
    ]),
  ]);

  for (const filePath of sourceFiles) {
    const relative = path.relative(playletsDir, filePath).replace(/\\/g, '/');
    const allowed = [...allowedPrefixes].some((prefix) =>
      prefix.endsWith('/') ? relative.startsWith(prefix) : relative === prefix,
    );
    if (!allowed) {
      issues.push({
        severity: 'error',
        code: 'generated_playlet_engine_code_forbidden',
        path: path.relative(packageDir, filePath),
        message:
          '生成阶段不允许新增玩法引擎代码；只能复制已登记 playlet 包并写配置。',
      });
    }
  }
}

function validateCourseContent(
  gdd: CourseGDD,
  content: CourseContentJson,
  issues: CoursePackageValidationIssue[],
): void {
  if (content.course.archetype !== gdd.selectedPlan.courseArchetype) {
    issues.push({
      severity: 'error',
      code: 'course_content_archetype_mismatch',
      path: '/src/courseContent.json/course/archetype',
      message: 'courseContent.json 的 archetype 必须与已确认 Course GDD 一致。',
    });
  }

  for (const goal of gdd.courseSpec.learningGoals) {
    const contentGoal = content.learningGoals.find(
      (item) => item.text === goal,
    );
    if (!contentGoal) {
      issues.push({
        severity: 'error',
        code: 'course_content_goal_missing',
        path: '/src/courseContent.json/learningGoals',
        message: `学习目标「${goal}」没有写入 courseContent.json。`,
      });
      continue;
    }

    const hasLesson = content.lessonUnits.some(
      (unit) =>
        unit.goalId === contentGoal.id && unit.script && unit.workedExample,
    );
    const hasInteraction = content.interactions.some(
      (interaction) =>
        interaction.goalId === contentGoal.id &&
        interaction.successFeedback &&
        interaction.failureFeedback,
    );
    const hasAssessment = content.assessments.some(
      (assessment) =>
        assessment.goalId === contentGoal.id &&
        typeof assessment.correctIndex === 'number' &&
        assessment.explanation &&
        assessment.misconceptionTag &&
        assessment.hint,
    );

    if (!hasLesson || !hasInteraction || !hasAssessment) {
      issues.push({
        severity: 'error',
        code: 'course_content_goal_loop_missing',
        path: '/src/courseContent.json',
        message: `学习目标「${goal}」必须同时有讲解、互动反馈和评价闭环。`,
      });
    }
  }

  for (const assessment of content.assessments) {
    if (assessment.explanation.trim().length < 12) {
      issues.push({
        severity: 'error',
        code: 'assessment_explanation_too_short',
        path: `/src/courseContent.json/assessments/${assessment.id}/explanation`,
        message: '评价题 explanation 必须说明关键推理步骤，不能只给答案。',
      });
    }
  }
}

function validateCourseGddAssessmentItems(
  gdd: CourseGDD,
  issues: CoursePackageValidationIssue[],
): void {
  for (const item of gdd.assessmentSpec.items) {
    if (typeof item.correctIndex !== 'number') {
      issues.push({
        severity: 'error',
        code: 'course_gdd_correct_index_missing',
        path: `/assessmentSpec/items/${item.id}/correctIndex`,
        message: 'Course GDD 中每道评价题都必须包含 correctIndex。',
      });
    }
    if (item.explanation.trim().length < 12) {
      issues.push({
        severity: 'error',
        code: 'course_gdd_explanation_too_short',
        path: `/assessmentSpec/items/${item.id}/explanation`,
        message:
          'Course GDD 中每道评价题都必须有解释关键推理步骤的 explanation。',
      });
    }
    if (!item.misconceptionTag || !item.hint) {
      issues.push({
        severity: 'error',
        code: 'course_gdd_feedback_missing',
        path: `/assessmentSpec/items/${item.id}`,
        message: 'Course GDD 中每道评价题都必须包含 misconceptionTag 和 hint。',
      });
    }
  }
}

function validateAssetPack(
  gdd: CourseGDD,
  assetPack: Record<string, unknown>,
  packageDir: string,
  issues: CoursePackageValidationIssue[],
): void {
  const registeredKeys = extractAssetKeys(assetPack);
  const plannedAssets = [
    ...gdd.assetPlan.images.map((asset) => ({ ...asset, type: 'image' })),
    ...gdd.assetPlan.audio.map((asset) => ({
      ...asset,
      type: asset.audioType,
    })),
    ...(gdd.assetPlan.video ?? []).map((asset) => ({
      ...asset,
      type: 'video',
    })),
  ];

  for (const asset of plannedAssets) {
    if (!registeredKeys.has(asset.key)) {
      issues.push({
        severity: 'error',
        code: 'asset_key_missing',
        path: '/public/assets/asset-pack.json',
        message: `Course GDD 规划的素材 key「${asset.key}」没有出现在 asset-pack.json。`,
      });
    }
  }

  for (const file of extractAssetFiles(assetPack)) {
    if (typeof file.url !== 'string' || file.url.length === 0) {
      issues.push({
        severity: 'error',
        code: 'asset_url_missing',
        path: `/public/assets/asset-pack.json/${String(file.key ?? '')}`,
        message: 'asset-pack.json 中每个素材都必须有可加载 url。',
      });
      continue;
    }

    if (!file.url.startsWith('assets/') && !/^https?:\/\//.test(file.url)) {
      issues.push({
        severity: 'warning',
        code: 'asset_url_unusual',
        path: `/public/assets/asset-pack.json/${String(file.key ?? '')}`,
        message: `素材「${String(file.key ?? '')}」的 url 不是本地 assets 路径或 HTTP URL，运行时需额外确认。`,
      });
    }
  }
}

async function validateNarrationManifest(
  gdd: CourseGDD,
  manifest: CourseNarrationManifest,
  packageDir: string,
  issues: CoursePackageValidationIssue[],
): Promise<void> {
  const manifestSegments = new Map(
    manifest.segments.map((segment) => [segment.id, segment]),
  );

  for (const segment of gdd.narrationPlan.segments) {
    const manifestSegment = manifestSegments.get(segment.id);
    if (!manifestSegment) {
      issues.push({
        severity: 'error',
        code: 'narration_segment_missing',
        path: '/public/assets/narration/narration-manifest.json',
        message: `旁白分段「${segment.id}」没有写入 narration manifest。`,
      });
      continue;
    }

    if (!manifestSegment.audio_uri && !manifestSegment.fallbackSubtitle) {
      issues.push({
        severity: 'error',
        code: 'narration_audio_or_fallback_missing',
        path: `/public/assets/narration/narration-manifest.json/${segment.id}`,
        message:
          '旁白分段必须有 audio_uri，或在 TTS 失败时提供 fallbackSubtitle。',
      });
      continue;
    }

    if (
      manifestSegment.status === 'fallback_subtitle' ||
      !manifestSegment.audio_uri
    ) {
      issues.push({
        severity: 'warning',
        code: 'narration_subtitle_fallback',
        path: `/public/assets/narration/narration-manifest.json/${segment.id}`,
        message: `旁白「${segment.id}」使用字幕降级，不阻断课程发布。`,
      });
      continue;
    }

    if (manifestSegment.local_path) {
      const localPath = path.isAbsolute(manifestSegment.local_path)
        ? manifestSegment.local_path
        : path.join(packageDir, manifestSegment.local_path);
      if (!(await fileExists(localPath))) {
        if (manifestSegment.fallbackSubtitle) {
          issues.push({
            severity: 'warning',
            code: 'narration_local_audio_missing_with_fallback',
            path: localPath,
            message: `旁白「${segment.id}」缺少本地音频文件，但存在字幕降级，不阻断课程发布。`,
          });
        } else {
          issues.push({
            severity: 'error',
            code: 'narration_local_audio_missing',
            path: localPath,
            message: `旁白「${segment.id}」缺少本地音频文件且没有字幕降级。`,
          });
        }
      }
    }
  }
}

function validateSceneRegistration(
  content: CourseContentJson,
  mainContent: string,
  levelManagerContent: string,
  issues: CoursePackageValidationIssue[],
): void {
  const registeredScenes = extractRegisteredScenes(mainContent);
  const levelOrder = extractLevelOrder(levelManagerContent);
  const courseSceneKeys = new Set([
    ...content.lessonUnits.map((unit) => unit.sceneKey),
    ...content.interactions.map((interaction) => interaction.sceneKey),
    ...content.assessments.map((assessment) => assessment.sceneKey),
  ]);

  for (const sceneKey of courseSceneKeys) {
    if (!registeredScenes.has(sceneKey)) {
      issues.push({
        severity: 'error',
        code: 'scene_not_registered',
        path: '/src/main.ts',
        message: `课程场景「${sceneKey}」没有通过 game.scene.add 注册。`,
      });
    }
  }

  const firstScene = levelOrder[0];
  if (!firstScene) {
    issues.push({
      severity: 'error',
      code: 'first_scene_missing',
      path: '/src/LevelManager.ts',
      message: 'LevelManager.LEVEL_ORDER 必须声明真实第一场景。',
    });
    return;
  }

  if (!registeredScenes.has(firstScene)) {
    issues.push({
      severity: 'error',
      code: 'first_scene_not_registered',
      path: '/src/LevelManager.ts',
      message: `LEVEL_ORDER[0] 指向「${firstScene}」，但 main.ts 没有注册该场景。`,
    });
  }
}

async function validateCodeAssetReferences(
  packageDir: string,
  assetPack: Record<string, unknown> | undefined,
  issues: CoursePackageValidationIssue[],
): Promise<void> {
  if (!assetPack) {
    return;
  }

  const registeredKeys = extractAssetKeys(assetPack);
  const sourceFiles = await collectSourceFiles(path.join(packageDir, 'src'));
  for (const filePath of sourceFiles) {
    const content = stripTypeScriptComments(
      await fs.readFile(filePath, 'utf-8'),
    );
    const usedKeys = extractUsedAssetKeys(content);
    for (const key of usedKeys) {
      if (!registeredKeys.has(key)) {
        issues.push({
          severity: 'error',
          code: 'code_asset_key_missing',
          path: path.relative(packageDir, filePath),
          message: `代码引用素材 key「${key}」，但 asset-pack.json 没有注册。`,
        });
      }
    }
  }
}

function validateSafetyRules(
  gdd: CourseGDD,
  content: CourseContentJson | undefined,
  issues: CoursePackageValidationIssue[],
): void {
  const strictness =
    gdd.courseSpec.studentProfile.guardianLimits?.contentStrictness ?? 'normal';
  const forbiddenTerms = new Set([
    ...gdd.courseSpec.styleSpec.forbidden,
    '抽卡',
    '氪金',
    '充值',
    '排行榜攀比',
    '暴力血腥',
    '恐怖惊吓',
    '陌生人聊天',
  ]);
  if (strictness === 'strict') {
    ['赌博', '成瘾', '诱导分享', '真实品牌 IP'].forEach((term) =>
      forbiddenTerms.add(term),
    );
  }

  const safeContent = content
    ? {
        ...content,
        styleBible: content.styleBible
          ? {
              ...content.styleBible,
              forbiddenElements: [],
            }
          : undefined,
      }
    : undefined;
  const text = JSON.stringify({
    course: {
      subject: gdd.courseSpec.subject,
      topic: gdd.courseSpec.topic,
      theme: gdd.courseSpec.styleSpec.theme,
      visualMood: gdd.courseSpec.styleSpec.visualMood,
      characterStyle: gdd.courseSpec.styleSpec.characterStyle,
    },
    selectedPlan: {
      title: gdd.selectedPlan.title,
      gameplayType: gdd.selectedPlan.gameplayType,
      learningLoop: gdd.selectedPlan.learningLoop,
      scenePlan: gdd.selectedPlan.scenePlan,
    },
    lessonUnits: gdd.lessonUnits,
    interactionSpecs: gdd.interactionSpecs,
    assessmentSpec: gdd.assessmentSpec,
    assetPlan: gdd.assetPlan,
    content: safeContent,
  });
  for (const term of forbiddenTerms) {
    if (term && text.includes(term)) {
      issues.push({
        severity: 'error',
        code: 'age_safety_forbidden_term',
        path: '/',
        message: `课程包内容命中不适龄或监护人禁止项「${term}」。`,
      });
    }
  }
}

function resolvePackageDir(config: Config, packageDir: string): string {
  if (path.isAbsolute(packageDir)) {
    return path.normalize(packageDir);
  }
  const root = getProjectRoot(config);
  return path.resolve(root, packageDir);
}

function resolveInsidePackage(packageDir: string, filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(packageDir, filePath);
}

function getProjectRoot(config: Config): string {
  const maybeConfig = config as Config & { getProjectRoot?: () => string };
  return maybeConfig.getProjectRoot?.() ?? process.cwd();
}

async function readJsonOrIssue<T>(
  filePath: string,
  issues: CoursePackageValidationIssue[],
  code: string,
  missingMessage: string,
): Promise<T | undefined> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T;
  } catch (error) {
    issues.push({
      severity: 'error',
      code,
      path: filePath,
      message:
        error instanceof SyntaxError
          ? `${filePath} 不是合法 JSON。`
          : missingMessage,
    });
    return undefined;
  }
}

async function readTextOrIssue(
  filePath: string,
  issues: CoursePackageValidationIssue[],
  code: string,
  missingMessage: string,
): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    issues.push({
      severity: 'error',
      code,
      path: filePath,
      message: missingMessage,
    });
    return undefined;
  }
}

function pushCourseIssues(
  target: CoursePackageValidationIssue[],
  issues: Array<{ path?: string; message: string }>,
  severity: CoursePackageIssueSeverity,
  code: string,
): void {
  for (const issue of issues) {
    target.push({
      severity,
      code,
      path: issue.path || '/',
      message: issue.message,
    });
  }
}

function extractAssetKeys(assetPack: Record<string, unknown>): Set<string> {
  return new Set(
    extractAssetFiles(assetPack)
      .map((file) => file.key)
      .filter((key): key is string => typeof key === 'string'),
  );
}

function extractAssetFiles(
  assetPack: Record<string, unknown>,
): AssetPackFileLike[] {
  const files: AssetPackFileLike[] = [];
  function walk(value: unknown): void {
    if (!value || typeof value !== 'object') {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    const record = value as Record<string, unknown>;
    if (typeof record.key === 'string') {
      files.push(record);
    }
    Object.values(record).forEach(walk);
  }
  walk(assetPack);
  return files;
}

function extractRegisteredScenes(mainContent: string): Set<string> {
  const scenes = new Set<string>();
  for (const match of mainContent.matchAll(
    /game\.scene\.add\(\s*['"]([^'"]+)['"]/g,
  )) {
    scenes.add(match[1]!);
  }
  return scenes;
}

function extractLevelOrder(levelManagerContent: string): string[] {
  const levelOrderMatch = levelManagerContent.match(
    /LEVEL_ORDER\s*:\s*string\[\]\s*=\s*\[([\s\S]*?)\]/,
  );
  if (!levelOrderMatch) {
    return [];
  }
  return [...levelOrderMatch[1]!.matchAll(/['"]([^'"]+)['"]/g)].map(
    (match) => match[1]!,
  );
}

function stripTypeScriptComments(content: string): string {
  let result = '';
  let index = 0;
  let state:
    | 'code'
    | 'single_quote'
    | 'double_quote'
    | 'template_string'
    | 'line_comment'
    | 'block_comment' = 'code';

  while (index < content.length) {
    const char = content[index]!;
    const next = content[index + 1];

    if (state === 'line_comment') {
      if (char === '\n') {
        state = 'code';
        result += char;
      }
      index += 1;
      continue;
    }

    if (state === 'block_comment') {
      if (char === '*' && next === '/') {
        state = 'code';
        index += 2;
      } else {
        if (char === '\n') {
          result += '\n';
        }
        index += 1;
      }
      continue;
    }

    if (state === 'code') {
      if (char === '/' && next === '/') {
        state = 'line_comment';
        index += 2;
        continue;
      }
      if (char === '/' && next === '*') {
        state = 'block_comment';
        index += 2;
        continue;
      }
      if (char === "'") state = 'single_quote';
      if (char === '"') state = 'double_quote';
      if (char === '`') state = 'template_string';
      result += char;
      index += 1;
      continue;
    }

    result += char;
    if (char === '\\') {
      if (next) {
        result += next;
        index += 2;
      } else {
        index += 1;
      }
      continue;
    }
    if (state === 'single_quote' && char === "'") state = 'code';
    if (state === 'double_quote' && char === '"') state = 'code';
    if (state === 'template_string' && char === '`') state = 'code';
    index += 1;
  }

  return result;
}

function extractUsedAssetKeys(content: string): Set<string> {
  const keys = new Set<string>();
  const patterns = [
    /\.load\.(?:image|audio|spritesheet)\(\s*['"]([^'"]+)['"]/g,
    /\.(?:image|sprite)\(\s*[^,\n]+,\s*[^,\n]+,\s*['"]([^'"]+)['"]/g,
    /\.sound\.play\(\s*['"]([^'"]+)['"]/g,
    /\.cache\.audio\.exists\(\s*['"]([^'"]+)['"]/g,
    /\.setTexture\(\s*['"](.+?)['"]/g,
    /textures\.exists\(\s*['"](.+?)['"]/g,
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      if (match[1]) {
        keys.add(match[1]);
      }
    }
  }
  return keys;
}

async function collectSourceFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const results = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          return collectSourceFiles(fullPath);
        }
        return entry.isFile() && fullPath.endsWith('.ts') ? [fullPath] : [];
      }),
    );
    return results.flat();
  } catch {
    return [];
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function formatDisplayReport(report: CoursePackageValidationReport): string {
  const rows = report.issues
    .map(
      (issue) =>
        `| ${issue.severity} | ${issue.code} | ${issue.path} | ${issue.message} |`,
    )
    .join('\n');

  return `**课程包验证${report.passed ? '通过' : '未通过'}**

| errors | warnings | info |
| ---: | ---: | ---: |
| ${report.summary.errors} | ${report.summary.warnings} | ${report.summary.info} |

| 级别 | 代码 | 路径 | 说明 |
| --- | --- | --- | --- |
${rows}`;
}

function formatCourseIssues(
  issues: Array<{ path?: string; message: string }>,
): string {
  return issues
    .map((issue) => `${issue.path || '/'} ${issue.message}`)
    .join(';');
}
