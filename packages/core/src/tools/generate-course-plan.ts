/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

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
  CoursePlanOption,
  CourseSpec,
  ExplanationDepthLevel,
} from '../course/schemas.js';
import { courseSpecSchema } from '../course/schemas.js';
import { buildCoursePlanConfirmationSummary } from '../course/product/stylePreview.js';
import {
  mapSubjectToGameplayCandidates,
  type GameplayCandidate,
} from '../course/gameplayMapping.js';
import { scoreCoursePlan } from '../course/planScoring.js';
import {
  validateCoursePlanOptions,
  validateCourseSpec,
  type CourseValidationIssue,
} from '../course/validation.js';
import { resolveProviderConfig } from '../services/providerConfig.js';
import { safeJsonParse } from '../utils/safeJsonParse.js';

export interface GenerateCoursePlanParams {
  courseSpec: CourseSpec;
}

export interface CoursePlanModelConfig {
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

interface ModelCoursePlanResponse {
  options?: CoursePlanOption[];
  coursePlanOptions?: CoursePlanOption[];
}

class GenerateCoursePlanInvocation extends BaseToolInvocation<
  GenerateCoursePlanParams,
  ToolResult
> {
  private resolvedModelConfig?: CoursePlanModelConfig;

  constructor(
    private config: Config,
    params: GenerateCoursePlanParams,
    private overrideModelConfig?: CoursePlanModelConfig,
  ) {
    super(params);
  }

  private get modelConfig(): CoursePlanModelConfig {
    if (this.overrideModelConfig) return this.overrideModelConfig;
    if (!this.resolvedModelConfig) {
      this.resolvedModelConfig = GenerateCoursePlanTool.resolveModelConfig(
        this.config,
      );
    }
    return this.resolvedModelConfig;
  }

  getDescription(): string {
    return `生成 ${this.params.courseSpec.subject}「${this.params.courseSpec.topic}」的 3 个课程游戏方案。`;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    try {
      const specValidation = validateCourseSpec(this.params.courseSpec);
      if (!specValidation.valid || !specValidation.data) {
        throw new Error(
          `CourseSpec 校验失败：${formatIssues(specValidation.errors)}`,
        );
      }

      const candidates = mapSubjectToGameplayCandidates(specValidation.data);
      const result = await this.callModel(
        this.buildSystemPrompt(),
        this.buildUserPrompt(specValidation.data, candidates),
        signal,
      );
      const options = this.parseAndValidateOptions(result, specValidation.data);
      const confirmationSummary = buildCoursePlanConfirmationSummary(
        specValidation.data,
        options,
      );
      const responseJson = JSON.stringify(
        { options, confirmationSummary },
        null,
        2,
      );

      return {
        llmContent: `<course-plan-options>
${responseJson}
</course-plan-options>

<system-reminder>
COURSE PLAN OPTIONS GENERATED.

必须等待用户确认 selectedPlanId 后，才可以调用 \`generate_course_gdd\` 生成 Course GDD。
不要跳过确认步骤，也不要直接进入资产生成或模板代码生成。
</system-reminder>`,
        returnDisplay: this.formatDisplayOutput(options),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Error generating course plan: ${errorMessage}`,
        returnDisplay: `**课程方案生成失败**\n\nError: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }

  private buildSystemPrompt(): string {
    return `# Course Game Plan Generator

你是面向小学生 ToC 游戏化课程的课程策划与技术方案分析器。你的任务是基于结构化 CourseSpec 生成 3 个可控、可验证、可落地的课程游戏方案。

硬规则：
1. 只输出 JSON，不输出 Markdown、注释或解释性正文。
2. 顶层 JSON 必须是 {"options": CoursePlanOption[]}。
3. 必须生成 3 个方案，id 固定为 "stable"、"balanced"、"creative"。
4. 只能使用用户提示中给出的 courseArchetype 候选，不允许输出 platformer、top_down、ui_heavy 等普通游戏模板。
5. 每个方案必须覆盖所有 learningGoals，每个 learningGoal 至少出现在 assessmentPoints 中。
6. standard/deep/challenge 深度不能退化为纯选择题；learningLoop 必须包含讲解、示例、互动练习、反馈、评价。
7. 每个方案必须包含 score.explanationDepthFit 和 recommendationReason。
8. 风险必须具体说明，不能写空泛的“有风险”。如果风险很低，写明可控风险。
9. 每个方案必须包含 workflow DAG。workflow.nodes 只能使用 ready playlet，第一批可选 id 包括：
playlet-找目标、playlet-找异常、playlet-单选判断、playlet-拖拽分箱、playlet-连线匹配、playlet-卡片配对、playlet-证据配对、playlet-框选标注、playlet-步骤排序、playlet-时间线排序、playlet-流程接线、playlet-条件组合推理、playlet-证据链拼接、playlet-证明步骤补全、playlet-口算挑战、playlet-等式平衡、playlet-图形拼装、playlet-坐标定位、playlet-迷宫寻路、playlet-模块装配、playlet-滑杆调参、playlet-开关组合、playlet-ab-对比、playlet-控制变量实验、playlet-点击射击、playlet-接落物、playlet-节奏点击、playlet-错题回炉、playlet-词块排序、playlet-对话选择、playlet-关键词提取、playlet-论证表达、playlet-模块定位、playlet-失败输出归因、playlet-回归测试、playlet-资源分配、playlet-多角色决策、playlet-分镜板、playlet-需求清单验收、playlet-调参-plus-对比。
10. workflow 必须是 DAG，所有节点从 startNodeId 可达，每个 learningGoal 都要被至少一个 node.goalIds 覆盖。

CoursePlanOption JSON 结构：
{
  "id": "stable" | "balanced" | "creative",
  "title": "方案标题",
  "courseArchetype": "course_ui" | "course_grid" | "course_td",
  "gameplayType": "玩法类型",
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
    "recoveryPolicy": "retry_same" | "hint_then_retry" | "remediate_then_return"
  },
  "learningLoop": ["讲解", "示例", "互动练习", "反馈", "评价"],
  "scenePlan": ["场景规划"],
  "assessmentPoints": ["评价点"],
  "assetComplexity": "low" | "medium" | "high",
  "score": {
    "learningFit": 0-100,
    "explanationDepthFit": 0-100,
    "fun": 0-100,
    "ageFit": 0-100,
    "implementationStability": 0-100,
    "cost": 0-100,
    "safety": 0-100
  },
  "recommendationReason": "推荐理由",
  "risks": ["风险或降级点"]
}`;
  }

  private buildUserPrompt(
    courseSpec: CourseSpec,
    candidates: GameplayCandidate[],
  ): string {
    const candidatePlans = candidates.map((candidate, index) => ({
      idHint:
        ['stable', 'balanced', 'creative'][index] ?? `option_${index + 1}`,
      ...candidate,
      baselineScore: scoreCoursePlan({ courseSpec, candidate }),
    }));

    return `请基于以下 CourseSpec 生成 3 个课程游戏方案。

CourseSpec:
${JSON.stringify(courseSpec, null, 2)}

可用玩法候选与基线评分：
${JSON.stringify(candidatePlans, null, 2)}

输出要求：
- stable：优先选择 implementationStability 和 safety 高的方案，素材复杂度通常为 low。
- balanced：兼顾学习匹配、趣味和成本。
- creative：可以更有趣，但不能牺牲讲解深度、适龄安全和可实现性。
- 每个方案的 workflow 至少包含 2 个 playlet node；复杂主题应包含 3 个以上 node。
- workflow.config 只能写课程内容、参数和反馈文案，不允许要求后续生成玩法引擎代码。
- deep/challenge 深度下，方案必须体现迁移任务、错因反馈和复盘评价。
- 如果候选少于 3 个，可以复用同一 courseArchetype，但玩法、场景和学习循环必须有明确差异。`;
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
      temperature: this.modelConfig.temperature ?? 0.4,
      max_tokens: 5000,
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

  private parseAndValidateOptions(
    result: string,
    courseSpec: CourseSpec,
  ): CoursePlanOption[] {
    const parsed = safeJsonParse<ModelCoursePlanResponse | CoursePlanOption[]>(
      stripMarkdownCodeFence(result),
      {},
    );
    const options = Array.isArray(parsed)
      ? parsed
      : (parsed.options ?? parsed.coursePlanOptions);

    const validation = validateCoursePlanOptions(options);
    if (!validation.valid || !validation.data) {
      throw new Error(
        `课程方案 JSON 不符合 schema：${formatIssues(validation.errors)}`,
      );
    }

    const qualityIssues = validatePlanQuality(validation.data, courseSpec);
    if (qualityIssues.length > 0) {
      throw new Error(
        `课程方案不满足深度和覆盖要求：${qualityIssues.join('；')}`,
      );
    }

    return validation.data.map((option) => ({
      ...option,
      score: recomputeScore(option, courseSpec),
    }));
  }

  private formatDisplayOutput(options: CoursePlanOption[]): string {
    const confirmationSummary = buildCoursePlanConfirmationSummary(
      this.params.courseSpec,
      options,
    );
    const rows = options
      .map((option) => {
        const confirmation = confirmationSummary.options.find(
          (item) => item.id === option.id,
        );
        return `| ${option.id} | ${option.title} | ${option.courseArchetype} | ${option.score.learningFit} | ${option.score.explanationDepthFit} | ${option.score.implementationStability} | ${confirmation?.estimatedCostCents ?? '-'} | ${confirmation?.estimatedDurationMinutes ?? '-'} |`;
      })
      .join('\n');

    return `**课程游戏方案已生成**

| ID | 标题 | 模板 | 学习匹配 | 深度匹配 | 稳定性 | 预计成本 | 预计时长 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
${rows}

推荐优先确认：${confirmationSummary.recommendedOptionId}

请先让用户确认 selectedPlanId，再调用 \`generate_course_gdd\`。`;
  }
}

export class GenerateCoursePlanTool extends BaseDeclarativeTool<
  GenerateCoursePlanParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.GENERATE_COURSE_PLAN;

  static resolveModelConfig(config?: Config): CoursePlanModelConfig {
    const providers = config?.getOpenGameProviders();
    const resolved = resolveProviderConfig('reasoning', providers);
    return {
      apiKey: resolved.apiKey,
      baseUrl: resolved.baseUrl,
      modelName: resolved.model,
      temperature: 0.4,
      timeout: 45000,
    };
  }

  constructor(
    private config: Config,
    private modelConfig?: CoursePlanModelConfig,
  ) {
    super(
      GenerateCoursePlanTool.Name,
      ToolDisplayNames.GENERATE_COURSE_PLAN,
      '基于结构化 CourseSpec 生成 3 个受控课程游戏方案。必须在生成 Course GDD 前调用，并等待用户确认 selectedPlanId。',
      Kind.Think,
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          courseSpec: courseSpecSchema,
        },
        required: ['courseSpec'],
      },
      false,
      true,
    );
  }

  protected override validateToolParamValues(
    params: GenerateCoursePlanParams,
  ): string | null {
    const result = validateCourseSpec(params.courseSpec);
    if (!result.valid) {
      return `CourseSpec 校验失败：${formatIssues(result.errors)}`;
    }
    return null;
  }

  protected createInvocation(
    params: GenerateCoursePlanParams,
  ): ToolInvocation<GenerateCoursePlanParams, ToolResult> {
    return new GenerateCoursePlanInvocation(
      this.config,
      params,
      this.modelConfig,
    );
  }
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

function validatePlanQuality(
  options: CoursePlanOption[],
  courseSpec: CourseSpec,
): string[] {
  const issues: string[] = [];
  const requiredIds = new Set(['stable', 'balanced', 'creative']);
  for (const id of requiredIds) {
    if (!options.some((option) => option.id === id)) {
      issues.push(`缺少 ${id} 方案`);
    }
  }

  for (const option of options) {
    for (const goal of courseSpec.learningGoals) {
      if (!option.assessmentPoints.some((point) => point.includes(goal))) {
        issues.push(`${option.id} 未覆盖学习目标：${goal}`);
      }
    }

    const loopText = option.learningLoop.join('');
    for (const required of ['讲解', '示例', '互动', '反馈', '评价']) {
      if (!loopText.includes(required)) {
        issues.push(`${option.id} 的 learningLoop 缺少${required}`);
      }
    }

    if (
      isAdvancedDepth(courseSpec.explanationDepth.depthLevel) &&
      option.score.explanationDepthFit < 70
    ) {
      issues.push(`${option.id} 的 explanationDepthFit 低于 70`);
    }
  }

  return issues;
}

function recomputeScore(
  option: CoursePlanOption,
  courseSpec: CourseSpec,
): CoursePlanOption['score'] {
  const candidate = mapSubjectToGameplayCandidates(courseSpec).find(
    (item) =>
      item.archetype === option.courseArchetype &&
      item.gameplayType === option.gameplayType,
  );
  if (!candidate) {
    return option.score;
  }
  return scoreCoursePlan({
    courseSpec,
    candidate,
    assetComplexity: option.assetComplexity,
    risks: option.risks,
  });
}

function isAdvancedDepth(depthLevel: ExplanationDepthLevel): boolean {
  return (
    depthLevel === 'standard' ||
    depthLevel === 'deep' ||
    depthLevel === 'challenge'
  );
}

function formatIssues(issues: CourseValidationIssue[]): string {
  return issues
    .map((issue) => `${issue.path || '/'} ${issue.message}`)
    .join('；');
}
