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
import { ToolErrorType } from './tool-error.js';
import type { Config } from '../config/config.js';
import { ToolDisplayNames, ToolNames } from './tool-names.js';
import type {
  CourseGDD,
  CoursePlanOption,
  CourseSpec,
} from '../course/schemas.js';
import { coursePlanOptionSchema, courseSpecSchema } from '../course/schemas.js';
import { mapCourseGddToOpenGameScaffold } from '../course/courseGddMapper.js';
import {
  validateCourseGdd,
  validateCoursePlanOption,
  validateCourseSpec,
  type CourseValidationIssue,
} from '../course/validation.js';
import { resolveProviderConfig } from '../services/providerConfig.js';
import { safeJsonParse } from '../utils/safeJsonParse.js';
import { scoreCourseQuality } from '../course/quality/courseQualityScorer.js';

export interface GenerateCourseGDDParams {
  courseSpec: CourseSpec;
  selectedPlan: CoursePlanOption;
  selectedPlanId: string;
  userConfirmed: boolean;
  confirmationNote?: string;
}

export interface CourseGDDModelConfig {
  apiKey: string;
  baseUrl: string;
  modelName: string;
  temperature?: number;
  timeout?: number;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message: string;
  };
}

interface ModelCourseGDDResponse {
  courseGdd?: CourseGDD;
  courseGDD?: CourseGDD;
}

class GenerateCourseGDDInvocation extends BaseToolInvocation<
  GenerateCourseGDDParams,
  ToolResult
> {
  private resolvedModelConfig?: CourseGDDModelConfig;

  constructor(
    private config: Config,
    params: GenerateCourseGDDParams,
    private overrideModelConfig?: CourseGDDModelConfig,
  ) {
    super(params);
  }

  private get modelConfig(): CourseGDDModelConfig {
    if (this.overrideModelConfig) return this.overrideModelConfig;
    if (!this.resolvedModelConfig) {
      this.resolvedModelConfig = GenerateCourseGDDTool.resolveModelConfig(
        this.config,
      );
    }
    return this.resolvedModelConfig;
  }

  getDescription(): string {
    return `生成 ${this.params.courseSpec.subject}「${this.params.courseSpec.topic}」的 Course GDD。`;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    try {
      validateConfirmedPlan(this.params);

      const systemPrompt = await this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt();
      const result = await this.callModel(systemPrompt, userPrompt, signal);
      const courseGdd = this.parseAndValidateCourseGdd(result);
      const scaffoldPlan = mapCourseGddToOpenGameScaffold(courseGdd);
      const responseJson = JSON.stringify({ courseGdd }, null, 2);
      const scaffoldJson = JSON.stringify({ scaffoldPlan }, null, 2);

      return {
        llmContent: `<course-gdd>
${responseJson}
</course-gdd>

<course-scaffold>
${scaffoldJson}
</course-scaffold>

<system-reminder>
COURSE GDD GENERATED.

下一步必须按 course-scaffold.copyInstructions 复制 \`agent-test/templates/core\`、\`agent-test/templates/course_runtime\`、被 workflow 选中的 \`agent-test/templates/playlets/*\` 和兼容 \`course_ui/course_grid/course_td\` 模板族，并写入 \`src/courseContent.json\`。
之后再调用 \`generate_game_assets\` 处理图片/BGM/SFX，调用课程 TTS manifest 生成旁白音频或字幕降级，最后调用 \`validate_course_package\`。
不要调用普通 \`generate_gdd\` 替代 Course GDD，不要生成玩法引擎 TS 代码，也不要跳过后续 \`validate_course_package\`。
</system-reminder>`,
        returnDisplay: this.formatDisplayOutput(courseGdd, scaffoldPlan),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Error generating Course GDD: ${errorMessage}`,
        returnDisplay: `**Course GDD 生成失败**\n\nError: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }

  private async buildSystemPrompt(): Promise<string> {
    const docs = await loadCourseDocs(this.config);
    return `# Course GDD Generator

你是面向小学 ToC 游戏化课程的课程架构师。你必须在用户已确认课程方案后，把 CourseSpec 和 selectedPlan 转成可执行 Course GDD。

硬规则：
1. 只输出 JSON，不输出 Markdown、注释或解释性正文。
2. 顶层 JSON 必须是 {"courseGdd": CourseGDD}。
3. courseGdd.courseSpec 必须逐字段保留输入 CourseSpec，不允许改写学习目标、年级、时长或监护人限制。
4. courseGdd.selectedPlan 必须逐字段保留输入 selectedPlan，不允许改成其他方案。
5. 每个 learningGoal 必须至少对应一个 lessonUnit、一个 interactionSpec 和一个 assessmentSpec.items 项。
6. lessonUnits 中每个知识点必须有讲解脚本、互动任务、反馈策略和 assessmentPointId。
7. 每道 assessment item 必须有 answer、explanation、misconceptionTag、hint；explanation 必须写出关键推理步骤。
8. narrationPlan.segments 必须输出逐字稿分段，供本地 TTS 批量生成。
9. assetPlan.audio 只规划 bgm/sfx，讲解旁白不要混入普通 audio 资产。
10. assetPlan.images 必须围绕 workflow 节点精准规划，至少覆盖主场景、角色/引导员、关键道具、正确反馈状态和错误反馈状态；不能只写泛泛“背景图”。
11. 视频只能可选；监护人关闭 allowGeneratedVideo 时不能规划 video；允许视频时优先规划 1 个开场或章节过场视频，用于建立身份、任务或关键状态变化。
12. validationPlan.requiredChecks 必须覆盖 schema、学习目标、讲解、互动、评价。
13. 输出必须面向 course_ui/course_grid/course_td 模板族，不允许要求修改 ui_heavy/grid_logic/tower_defense 原模板。
14. 如果 selectedPlan 包含 workflow，courseGdd.workflow 必须逐字段保留该 workflow；如果没有，必须生成一个只使用 ready playlet 的 DAG。
15. workflow 只能引用 ready playlet，不允许引用 planned playlet；玩法引擎由模板包提供，Course GDD 只能写 config、风格、素材和旁白。
16. 必须输出 styleBible，统一主题、配色、角色方向、UI token、动效情绪、音频情绪和禁止元素。
17. 图片/视频 prompt 应服务课程动作和反馈后果：动作玩法要体现瞄准目标、命中反馈、移动靶或参数变化；禁止真实枪械、子弹、伤害、血腥和击杀。

CourseGDD JSON 结构：
{
  "courseSpec": CourseSpec,
  "selectedPlan": CoursePlanOption,
  "workflow": {
    "startNodeId": "node_1",
    "nodes": [
      {
        "id": "node_1",
        "playletId": "playlet-拖拽分箱",
        "goalIds": ["goal_1"],
        "config": {
          "prompt": "学生看到的玩法任务",
          "items": [{"id": "item_1", "label": "项目"}],
          "successCriteria": "完成条件"
        },
        "styleBindingId": "default",
        "enterTransition": "过渡说明",
        "exitTransition": "过渡说明"
      }
    ],
    "edges": [{"from": "node_1", "to": "node_2", "when": "success"}],
    "recoveryPolicy": "hint_then_retry"
  },
  "styleBible": {
    "theme": "主题",
    "palette": ["#颜色"],
    "characterDirection": "角色方向",
    "uiTokens": {"density": "medium"},
    "motionMood": "动效情绪",
    "audioMood": "音频情绪",
    "forbiddenElements": ["禁止元素"]
  },
  "lessonUnits": [
    {
      "id": "lesson_goal_1",
      "learningGoal": "必须等于 CourseSpec.learningGoals 中的一项",
      "concept": "知识点",
      "explanationScript": "面向学生的讲解逐字稿",
      "interactionTask": "互动任务，deep/challenge 下要包含迁移或复盘",
      "feedbackStrategy": "正确反馈、错因类型、下一步提示",
      "assessmentPointId": "assessment item id"
    }
  ],
  "interactionSpecs": [
    {
      "id": "interaction_1",
      "lessonUnitId": "lesson_goal_1",
      "type": "dialogue_choice | quiz | card_match | grid_sort | grid_path | tower_review",
      "prompt": "学生看到的任务",
      "expectedAction": "学生应该执行的动作",
      "feedback": {
        "correct": "正确反馈",
        "incorrect": "错误反馈",
        "misconceptionTag": "错因类型",
        "hint": "下一步提示"
      }
    }
  ],
  "assessmentSpec": {
    "items": [
      {
        "id": "assessment_1",
        "learningGoal": "必须等于 CourseSpec.learningGoals 中的一项",
        "prompt": "题目",
        "options": ["可选"],
        "correctIndex": 0,
        "answer": "答案",
        "explanation": "关键推理步骤",
        "misconceptionTag": "错因类型",
        "hint": "提示"
      }
    ],
    "masteryCriteria": ["掌握标准"]
  },
  "assetPlan": {
    "images": [{"key": "asset_key", "description": "图片描述"}],
    "audio": [{"key": "sfx_correct", "description": "普通音效", "audioType": "sfx"}],
    "video": [{"key": "intro_video", "description": "可选过场", "optional": true}]
  },
  "narrationPlan": {
    "segments": [{"id": "lesson_goal_1", "name": "旁白名称", "text": "逐字稿", "targetScene": "scenePlan 中的场景"}]
  },
  "validationPlan": {
    "requiredChecks": ["schema 合法", "学习目标闭环", "讲解深度", "互动反馈", "评价解析"],
    "browserFlow": ["打开首场景", "完成第一道互动", "看到反馈"],
    "fallbackChecks": ["TTS 失败显示字幕", "视频关闭不阻断流程"]
  }
}

${docs}`;
  }

  private buildUserPrompt(): string {
    return `用户已经确认 selectedPlanId="${this.params.selectedPlanId}"。

CourseSpec:
${JSON.stringify(this.params.courseSpec, null, 2)}

Selected CoursePlanOption:
${JSON.stringify(this.params.selectedPlan, null, 2)}

Confirmation note:
${this.params.confirmationNote ?? '用户确认该方案，进入 Course GDD。'}

请生成 Course GDD JSON。`;
  }

  private async callModel(
    systemPrompt: string,
    userPrompt: string,
    signal: AbortSignal,
  ): Promise<string> {
    const payload = {
      model: this.modelConfig.modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: this.modelConfig.temperature ?? 0.3,
      max_tokens: 7000,
      stream: false,
    };

    const response = await fetch(
      `${this.modelConfig.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.modelConfig.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal,
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API Request Failed: ${response.status} - ${errorBody}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    if (data.error) {
      throw new Error(`Model API Error: ${data.error.message}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content returned from the model');
    }
    return content;
  }

  private parseAndValidateCourseGdd(result: string): CourseGDD {
    const parsed = safeJsonParse<ModelCourseGDDResponse | CourseGDD>(
      stripMarkdownCodeFence(result),
      {},
    );
    const courseGdd =
      'courseGdd' in parsed || 'courseGDD' in parsed
        ? ((parsed as ModelCourseGDDResponse).courseGdd ??
          (parsed as ModelCourseGDDResponse).courseGDD)
        : (parsed as CourseGDD);

    const validation = validateCourseGdd(courseGdd);
    if (!validation.valid || !validation.data) {
      throw new Error(
        `Course GDD JSON 不符合 schema 或课程闭环规则：${formatIssues(
          validation.errors,
        )}`,
      );
    }

    const immutableInputIssues = validateModelDidNotMutateInput(
      validation.data,
      this.params,
    );
    if (immutableInputIssues.length > 0) {
      throw new Error(
        `Course GDD 不允许改写已确认输入：${immutableInputIssues.join('；')}`,
      );
    }

    return validation.data;
  }

  private formatDisplayOutput(
    courseGdd: CourseGDD,
    scaffoldPlan: ReturnType<typeof mapCourseGddToOpenGameScaffold>,
  ): string {
    return `**Course GDD 已生成**

- 已选模板：${courseGdd.selectedPlan.courseArchetype}
- 讲解单元：${courseGdd.lessonUnits.length}
- 互动任务：${courseGdd.interactionSpecs.length}
- 评价题：${courseGdd.assessmentSpec.items.length}
- 旁白分段：${courseGdd.narrationPlan.segments.length}
- 课程配置：${scaffoldPlan.writeFiles[0].path}

下一步：复制 \`${scaffoldPlan.templateModule}\` 并写入 \`src/courseContent.json\`，再生成普通素材、TTS manifest 和课程包验证。`;
  }
}

export class GenerateCourseGDDTool extends BaseDeclarativeTool<
  GenerateCourseGDDParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.GENERATE_COURSE_GDD;

  static resolveModelConfig(config?: Config): CourseGDDModelConfig {
    const providers = config?.getOpenGameProviders();
    const resolved = resolveProviderConfig('reasoning', providers);
    return {
      apiKey: resolved.apiKey,
      baseUrl: resolved.baseUrl,
      modelName: resolved.model,
      temperature: 0.3,
      timeout: 60000,
    };
  }

  constructor(
    private config: Config,
    private modelConfig?: CourseGDDModelConfig,
  ) {
    super(
      GenerateCourseGDDTool.Name,
      ToolDisplayNames.GENERATE_COURSE_GDD,
      '在用户确认课程方案后，基于 CourseSpec 和 selectedPlan 生成 Course GDD。',
      Kind.Think,
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          courseSpec: courseSpecSchema,
          selectedPlan: coursePlanOptionSchema,
          selectedPlanId: { type: 'string', minLength: 1 },
          userConfirmed: { type: 'boolean' },
          confirmationNote: { type: 'string' },
        },
        required: [
          'courseSpec',
          'selectedPlan',
          'selectedPlanId',
          'userConfirmed',
        ],
      },
      false,
      true,
    );
  }

  protected override validateToolParamValues(
    params: GenerateCourseGDDParams,
  ): string | null {
    try {
      validateConfirmedPlan(params);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  protected createInvocation(
    params: GenerateCourseGDDParams,
  ): ToolInvocation<GenerateCourseGDDParams, ToolResult> {
    return new GenerateCourseGDDInvocation(
      this.config,
      params,
      this.modelConfig,
    );
  }
}

async function loadCourseDocs(config: Config): Promise<string> {
  const projectRoot = getProjectRoot(config);
  const docsDir = await findCourseDocsDir(projectRoot);
  if (!docsDir) {
    return '';
  }

  const files = [
    'course_gdd.md',
    'explanation_depth.md',
    'gameplay_mapping.md',
  ];
  const chunks: string[] = [];
  for (const file of files) {
    try {
      const content = await fs.readFile(path.join(docsDir, file), 'utf-8');
      chunks.push(`---\n\n## ${file}\n\n${content}`);
    } catch {
      // 文档缺失时仍保留内置硬规则，避免工具不可用。
    }
  }
  return chunks.join('\n\n');
}

function getProjectRoot(config: Config): string {
  const maybeConfig = config as Config & { getProjectRoot?: () => string };
  return maybeConfig.getProjectRoot?.() ?? process.cwd();
}

async function findCourseDocsDir(projectRoot: string): Promise<string> {
  let searchDir = projectRoot;
  while (searchDir !== path.dirname(searchDir)) {
    const candidate = path.join(searchDir, 'agent-test', 'docs', 'course');
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      searchDir = path.dirname(searchDir);
    }
  }
  return '';
}

function validateConfirmedPlan(params: GenerateCourseGDDParams): void {
  if (!params.userConfirmed) {
    throw new Error(
      '必须先让用户确认 selectedPlanId，userConfirmed=true 后才能生成 Course GDD。',
    );
  }

  if (params.selectedPlanId !== params.selectedPlan.id) {
    throw new Error('selectedPlanId 必须与 selectedPlan.id 完全一致。');
  }

  const specValidation = validateCourseSpec(params.courseSpec);
  if (!specValidation.valid) {
    throw new Error(
      `CourseSpec 校验失败：${formatIssues(specValidation.errors)}`,
    );
  }

  const planValidation = validateCoursePlanOption(params.selectedPlan);
  if (!planValidation.valid) {
    throw new Error(
      `selectedPlan 校验失败：${formatIssues(planValidation.errors)}`,
    );
  }

  const qualityReview = scoreCourseQuality({
    courseSpec: params.courseSpec,
    plan: params.selectedPlan,
  });
  if (!qualityReview.passed) {
    throw new Error(
      `selectedPlan 未通过课程质量门禁，不能生成 Course GDD：总分 ${qualityReview.score.total}，阻断问题：${
        qualityReview.score.blockingIssues.join('；') || '质量总分未达门槛'
      }`,
    );
  }
}

function validateModelDidNotMutateInput(
  gdd: CourseGDD,
  params: GenerateCourseGDDParams,
): string[] {
  const issues: string[] = [];
  if (JSON.stringify(gdd.courseSpec) !== JSON.stringify(params.courseSpec)) {
    issues.push('courseSpec 被改写');
  }
  if (
    JSON.stringify(gdd.selectedPlan) !== JSON.stringify(params.selectedPlan)
  ) {
    issues.push('selectedPlan 被改写');
  }
  return issues;
}

function stripMarkdownCodeFence(content: string): string {
  const trimmed = content.trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function formatIssues(issues: CourseValidationIssue[]): string {
  return issues
    .map((issue) => `${issue.path || '/'} ${issue.message}`)
    .join('；');
}
