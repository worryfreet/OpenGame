import type { Query } from '../query/Query.js';
import { query, type QueryOptions } from '../query/createQuery.js';
import type {
  ContentBlock,
  SDKMessage,
  ToolResultBlock,
  ToolUseBlock,
} from '../types/protocol.js';

export type StudentGrade = 1 | 2 | 3 | 4 | 5 | 6;
export type ExplanationDepthLevel = 'intro' | 'standard' | 'deep' | 'challenge';
export type NextCourseMode =
  | 'next_lesson'
  | 'reinforcement'
  | 'same_topic_new_gameplay';

export interface CourseSpec {
  subject: string;
  topic: string;
  learningGoals: string[];
  durationMinutes: number;
  studentProfile: {
    grade: StudentGrade;
    age?: number;
    readingLevel?: 'low' | 'medium' | 'high';
    interests: string[];
    weakPoints?: string[];
    preferredInteraction?: string[];
    ttsPreference?: {
      voice?: string;
      speed?: number;
      emotion?: string;
    };
    guardianLimits?: {
      maxSessionMinutes: number;
      allowUploadedImages: boolean;
      allowGeneratedVideo: boolean;
      contentStrictness: 'normal' | 'strict';
    };
  };
  styleSpec: {
    theme: string;
    palette: string[];
    referenceImages?: string[];
    visualMood: string;
    characterStyle: string;
    uiDensity: 'low' | 'medium' | 'high';
    forbidden: string[];
  };
  explanationDepth: {
    depthLevel: ExplanationDepthLevel;
    priorKnowledgeCheck: boolean;
    conceptLayers: Array<{
      concept: string;
      whyItMatters: string;
      misconceptionToAddress: string[];
      representation:
        | 'story'
        | 'visual_model'
        | 'formula'
        | 'experiment'
        | 'case'
        | 'dialogue';
    }>;
    examplePlan: {
      workedExamples: number;
      guidedPractice: number;
      independentChallenges: number;
      transferTasks: number;
    };
    feedbackDepth:
      | 'answer_only'
      | 'short_reason'
      | 'step_by_step'
      | 'socratic_hint';
    masteryEvidence: string[];
  };
}

export interface CoursePlanOption {
  id: string;
  title: string;
  courseArchetype: 'course_ui' | 'course_grid' | 'course_td';
  gameplayType: string;
  learningLoop: string[];
  scenePlan: string[];
  assessmentPoints: string[];
  assetComplexity: 'low' | 'medium' | 'high';
  score: {
    learningFit: number;
    explanationDepthFit: number;
    fun: number;
    ageFit: number;
    implementationStability: number;
    cost: number;
    safety: number;
  };
  recommendationReason: string;
  risks: string[];
}

export type CreateCourseGameMode = 'plan_only' | 'confirmed_generation';

export interface StudentPreferenceProfile {
  profileId: string;
  grade: StudentGrade;
  interests: string[];
  preferredThemes: string[];
  preferredPalette?: string[];
  preferredGameplayTypes: string[];
  readingLevel: 'low' | 'medium' | 'high';
  ttsPreference?: {
    voice?: string;
    speed?: number;
    emotion?: string;
  };
}

export interface LearningReportSummary {
  profileId?: string;
  subject: string;
  weakPoints?: string[];
  masteredGoals?: string[];
  misconceptionTags?: string[];
  hintUsageCount?: number;
  completionRate?: number;
  coursePackageId?: string;
}

export interface LearningState {
  profileId: string;
  subjectStates: Array<{
    subject: string;
    weakPoints: string[];
    masteredGoals: string[];
    misconceptionTags: string[];
    hintUsageCount?: number;
    completionRate?: number;
    lastCoursePackageId?: string;
  }>;
}

export interface CreateCourseGameOptions {
  courseSpec: CourseSpec;
  mode?: CreateCourseGameMode;
  selectedPlan?: CoursePlanOption;
  selectedPlanId?: string;
  outputDir?: string;
  options?: QueryOptions;
}

export interface CreateNextCourseGameOptions {
  profileId: string;
  subject?: string;
  previousCourseSpec?: CourseSpec;
  learningState?: LearningState;
  learningReport?: LearningReportSummary;
  preferenceProfile?: StudentPreferenceProfile;
  previousGameplayType?: string;
  requestedMode?: NextCourseMode;
  mode?: CreateCourseGameMode;
  selectedPlan?: CoursePlanOption;
  selectedPlanId?: string;
  outputDir?: string;
  options?: QueryOptions;
}

export type CourseGenerationStage =
  | 'next_course_spec'
  | 'course_plan_options'
  | 'course_gdd'
  | 'course_scaffold'
  | 'game_assets'
  | 'course_tts_manifest'
  | 'course_package_validation'
  | 'completed';

export interface CourseProgressEvent {
  type: 'course_progress';
  stage: CourseGenerationStage;
  status: 'running' | 'completed' | 'failed';
  message: string;
  toolName?: string;
}

const COURSE_CORE_TOOLS = [
  'GenerateNextCourseSpec',
  'GenerateCoursePlan',
  'GenerateCourseGDD',
  'GenerateAssets',
  'CourseTTSManifest',
  'ValidateCoursePackage',
  'ReadFile',
  'WriteFile',
  'Edit',
  'Shell',
  'ListFiles',
] as const;

const TOOL_STAGE_MAP: Record<string, CourseGenerationStage> = {
  generate_next_course_spec: 'next_course_spec',
  generate_course_plan: 'course_plan_options',
  generate_course_gdd: 'course_gdd',
  generate_game_assets: 'game_assets',
  course_tts_manifest: 'course_tts_manifest',
  validate_course_package: 'course_package_validation',
};

export function createCourseGame(params: CreateCourseGameOptions): Query {
  validateCreateCourseGameOptions(params);

  const prompt = buildCourseGamePrompt(params);
  const options = mergeCourseQueryOptions(params.options);

  return query({ prompt, options });
}

export function createNextCourseGame(
  params: CreateNextCourseGameOptions,
): Query {
  validateCreateNextCourseGameOptions(params);

  const prompt = buildNextCourseGamePrompt(params);
  const options = mergeCourseQueryOptions(params.options);

  return query({ prompt, options });
}

export function buildCourseGamePrompt(params: CreateCourseGameOptions): string {
  validateCreateCourseGameOptions(params);

  const mode = params.mode ?? 'plan_only';
  const courseSpecJson = stableJson(params.courseSpec);
  const selectedPlanJson = params.selectedPlan
    ? stableJson(params.selectedPlan)
    : undefined;
  const outputDir = params.outputDir ?? 'agent-test/games/generated-course';

  if (mode === 'plan_only') {
    return [
      '你正在通过 OpenGame SDK 运行课程游戏生成的第一阶段。',
      '',
      '目标：只调用 `generate_course_plan`，基于下面的结构化 CourseSpec 生成 3 个受控课程游戏方案。',
      '硬性约束：',
      '- 不要调用 `generate_course_gdd`，也不要复制模板或生成素材。',
      '- 输出方案后必须停下，等待用户或外部 ToC 服务确认 `selectedPlanId`。',
      '- 保留普通 OpenGame 游戏生成链路，不要调用普通 `generate_gdd` 替代课程工具。',
      '',
      'CourseSpec JSON：',
      '```json',
      courseSpecJson,
      '```',
    ].join('\n');
  }

  return [
    '你正在通过 OpenGame SDK 运行已确认方案后的课程游戏生成链路。',
    '',
    '目标：按顺序完成 Course GDD、课程模板 scaffold、普通素材、课程 TTS manifest、课程包验证。',
    '硬性约束：',
    '- 先调用 `generate_course_gdd`，参数必须包含 `userConfirmed: true`、`selectedPlanId` 和下方 `selectedPlan`。',
    '- 必须使用 `generate_course_gdd` 返回的 `<course-scaffold>` 写入课程模板和 `src/courseContent.json`。',
    '- 普通图片、BGM、SFX 调用 `generate_game_assets`；讲解旁白必须调用 `course_tts_manifest` 生成 manifest，失败时使用该工具写入字幕降级。',
    '- 发布或浏览器验证之前必须调用 `validate_course_package`；如果存在 error，停止并报告阻断项。',
    '- 不要调用普通 `generate_gdd` 替代 Course GDD。',
    '',
    `输出目录：${outputDir}`,
    '',
    'CourseSpec JSON：',
    '```json',
    courseSpecJson,
    '```',
    '',
    `selectedPlanId：${params.selectedPlanId}`,
    '',
    'selectedPlan JSON：',
    '```json',
    selectedPlanJson ?? '{}',
    '```',
  ].join('\n');
}

export function buildNextCourseGamePrompt(
  params: CreateNextCourseGameOptions,
): string {
  validateCreateNextCourseGameOptions(params);

  const mode = params.mode ?? 'plan_only';
  const outputDir = params.outputDir ?? 'agent-test/games/generated-course';
  const nextCourseInput = {
    profileId: params.profileId,
    subject: params.subject,
    previousCourseSpec: params.previousCourseSpec,
    learningState: params.learningState,
    learningReport: params.learningReport,
    preferenceProfile: params.preferenceProfile,
    previousGameplayType: params.previousGameplayType,
    requestedMode: params.requestedMode,
  };

  const lines = [
    '你正在通过 OpenGame SDK 运行课程续作生成。',
    '',
    '第一目标：先调用 `generate_next_course_spec`，基于学习报告、学习状态、上一课和偏好生成下一课 CourseSpec。',
    '硬性约束：',
    '- 如果 `generate_next_course_spec` 返回 needs_intake 或工具错误，停止并把追问返回给外部 ToC 服务。',
    '- 拿到下一课 CourseSpec 后，才能进入既有课程方案生成流程。',
    '- 下一课必须继承必要偏好，但不能盲目重复相同玩法。',
    '',
    'generate_next_course_spec 参数 JSON：',
    '```json',
    stableJson(nextCourseInput),
    '```',
  ];

  if (mode === 'plan_only') {
    lines.push(
      '',
      '第二目标：只调用 `generate_course_plan`，基于下一课 CourseSpec 生成 3 个受控课程游戏方案。',
      '生成方案后必须停下，等待外部服务确认 `selectedPlanId`；不要调用 `generate_course_gdd`。',
    );
    return lines.join('\n');
  }

  lines.push(
    '',
    '第二目标：基于下一课 CourseSpec 和已确认方案完成课程生成链路。',
    '硬性约束：',
    '- 调用 `generate_course_gdd` 时必须包含 `userConfirmed: true`、`selectedPlanId` 和下方 `selectedPlan`。',
    '- 必须继续调用课程模板 scaffold、普通素材、`course_tts_manifest` 和 `validate_course_package`。',
    '- 如果课程包验证存在 error，停止并报告阻断项。',
    '',
    `输出目录：${outputDir}`,
    '',
    `selectedPlanId：${params.selectedPlanId}`,
    '',
    'selectedPlan JSON：',
    '```json',
    stableJson(params.selectedPlan ?? {}),
    '```',
  );
  return lines.join('\n');
}

export function createCourseProgressTracker(): (
  message: SDKMessage,
) => CourseProgressEvent[] {
  const toolUseIds = new Map<string, string>();

  return (message: SDKMessage): CourseProgressEvent[] => {
    const events: CourseProgressEvent[] = [];

    if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (isToolUseBlock(block)) {
          toolUseIds.set(block.id, block.name);
          const stage = TOOL_STAGE_MAP[block.name];
          if (stage) {
            events.push({
              type: 'course_progress',
              stage,
              status: 'running',
              toolName: block.name,
              message: buildProgressMessage(stage, 'running'),
            });
          }
        }

        if (isToolResultBlock(block)) {
          const toolName = toolUseIds.get(block.tool_use_id);
          const stage = toolName ? TOOL_STAGE_MAP[toolName] : undefined;
          if (stage) {
            events.push({
              type: 'course_progress',
              stage,
              status: block.is_error ? 'failed' : 'completed',
              toolName,
              message: buildProgressMessage(
                stage,
                block.is_error ? 'failed' : 'completed',
              ),
            });
          }
        }
      }
    }

    if (message.type === 'result') {
      events.push({
        type: 'course_progress',
        stage: 'completed',
        status: message.is_error ? 'failed' : 'completed',
        message: message.is_error ? '课程生成链路失败。' : '课程生成链路完成。',
      });
    }

    return events;
  };
}

export function mergeCourseQueryOptions(
  options: QueryOptions = {},
): QueryOptions {
  return {
    ...options,
    includePartialMessages: options.includePartialMessages ?? true,
    coreTools: mergeUnique([...COURSE_CORE_TOOLS], options.coreTools ?? []),
  };
}

function validateCreateCourseGameOptions(
  params: CreateCourseGameOptions,
): void {
  validateCourseSpecShape(params.courseSpec);

  const mode = params.mode ?? 'plan_only';
  if (mode === 'confirmed_generation') {
    if (!params.selectedPlan) {
      throw new Error('confirmed_generation 模式必须提供 selectedPlan。');
    }
    if (!params.selectedPlanId) {
      throw new Error('confirmed_generation 模式必须提供 selectedPlanId。');
    }
    if (params.selectedPlan.id !== params.selectedPlanId) {
      throw new Error('selectedPlan.id 必须与 selectedPlanId 一致。');
    }
  }
}

function validateCreateNextCourseGameOptions(
  params: CreateNextCourseGameOptions,
): void {
  if (!params.profileId?.trim()) {
    throw new Error('profileId 不能为空。');
  }
  if (!params.learningReport && !params.learningState) {
    throw new Error('课程续作必须提供 learningReport 或 learningState。');
  }
  if (params.previousCourseSpec) {
    validateCourseSpecShape(params.previousCourseSpec);
  }

  const mode = params.mode ?? 'plan_only';
  if (mode === 'confirmed_generation') {
    if (!params.selectedPlan) {
      throw new Error('confirmed_generation 模式必须提供 selectedPlan。');
    }
    if (!params.selectedPlanId) {
      throw new Error('confirmed_generation 模式必须提供 selectedPlanId。');
    }
    if (params.selectedPlan.id !== params.selectedPlanId) {
      throw new Error('selectedPlan.id 必须与 selectedPlanId 一致。');
    }
  }
}

function validateCourseSpecShape(spec: CourseSpec): void {
  if (!spec || typeof spec !== 'object') {
    throw new Error('courseSpec 必须是结构化对象。');
  }

  if (!spec.subject || !spec.topic) {
    throw new Error('courseSpec 必须包含 subject 和 topic。');
  }

  if (!Array.isArray(spec.learningGoals) || spec.learningGoals.length === 0) {
    throw new Error('courseSpec.learningGoals 至少需要 1 个学习目标。');
  }

  if (
    ![1, 2, 3, 4, 5, 6].includes(spec.studentProfile?.grade) ||
    !Array.isArray(spec.studentProfile?.interests)
  ) {
    throw new Error(
      'courseSpec.studentProfile 必须包含小学 1-6 年级和兴趣列表。',
    );
  }

  if (
    !spec.explanationDepth ||
    !Array.isArray(spec.explanationDepth.conceptLayers) ||
    spec.explanationDepth.conceptLayers.length === 0
  ) {
    throw new Error('courseSpec.explanationDepth 必须包含概念层。');
  }
}

function isToolUseBlock(block: ContentBlock): block is ToolUseBlock {
  return block.type === 'tool_use';
}

function isToolResultBlock(block: ContentBlock): block is ToolResultBlock {
  return block.type === 'tool_result';
}

function buildProgressMessage(
  stage: CourseGenerationStage,
  status: CourseProgressEvent['status'],
): string {
  const label = {
    next_course_spec: '下一课 CourseSpec 生成',
    course_plan_options: '课程方案生成',
    course_gdd: 'Course GDD 生成',
    course_scaffold: '课程模板 scaffold',
    game_assets: '普通素材生成',
    course_tts_manifest: '课程旁白 manifest',
    course_package_validation: '课程包验证',
    completed: '课程生成链路',
  }[stage];

  const statusText = {
    running: '进行中',
    completed: '已完成',
    failed: '失败',
  }[status];

  return `${label}${statusText}。`;
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function mergeUnique<T>(left: T[], right: T[]): T[] {
  return Array.from(new Set([...left, ...right]));
}
