import { describe, expect, it, vi } from 'vitest';
import type {
  SDKAssistantMessage,
  SDKResultMessage,
} from '../../src/types/protocol.js';
import type {
  CoursePlanOption,
  CourseSpec,
} from '../../src/course/createCourseGame.js';

const queryMock = vi.hoisted(() => vi.fn(() => ({ mocked: true })));

vi.mock('../../src/query/createQuery.js', () => ({
  query: queryMock,
}));

describe('createCourseGame', () => {
  it('构造只生成课程方案的 prompt，并等待外部确认', async () => {
    const { buildCourseGamePrompt } =
      await import('../../src/course/createCourseGame.js');

    const prompt = buildCourseGamePrompt({ courseSpec: buildCourseSpec() });

    expect(prompt).toContain('调用 `generate_course_plan` 后');
    expect(prompt).toContain('score_course_quality');
    expect(prompt).toContain('repair_course_generation');
    expect(prompt).toContain('不要调用 `generate_course_gdd`');
    expect(prompt).toContain('等待用户或外部 ToC 服务确认 `selectedPlanId`');
    expect(prompt).toContain('"subject": "数学"');
  });

  it('构造已确认方案后的课程生成 prompt', async () => {
    const { buildCourseGamePrompt } =
      await import('../../src/course/createCourseGame.js');
    const selectedPlan = buildCoursePlanOption();

    const prompt = buildCourseGamePrompt({
      courseSpec: buildCourseSpec(),
      mode: 'confirmed_generation',
      selectedPlan,
      selectedPlanId: selectedPlan.id,
      outputDir: 'agent-test/games/math-area-course',
    });

    expect(prompt).toContain('userConfirmed: true');
    expect(prompt).toContain('generate_course_gdd');
    expect(prompt).toContain('course_tts_manifest');
    expect(prompt).toContain('validate_course_package');
    expect(prompt).toContain('agent-test/games/math-area-course');
    expect(prompt).toContain('"id": "balanced"');
  });

  it('拒绝缺少 confirmed_generation 必需确认信息的请求', async () => {
    const { buildCourseGamePrompt } =
      await import('../../src/course/createCourseGame.js');

    expect(() =>
      buildCourseGamePrompt({
        courseSpec: buildCourseSpec(),
        mode: 'confirmed_generation',
      }),
    ).toThrow('selectedPlan');
  });

  it('创建 SDK 查询时默认启用课程工具和 partial stream', async () => {
    const { createCourseGame } =
      await import('../../src/course/createCourseGame.js');

    const result = createCourseGame({
      courseSpec: buildCourseSpec(),
      options: {
        cwd: '/tmp/opengame-course',
        coreTools: ['ReadManyFiles'],
      },
    });

    expect(result).toEqual({ mocked: true });
    expect(queryMock).toHaveBeenCalledWith({
      prompt: expect.stringContaining('generate_course_plan'),
      options: expect.objectContaining({
        cwd: '/tmp/opengame-course',
        includePartialMessages: true,
        coreTools: expect.arrayContaining([
          'GenerateNextCourseSpec',
          'GenerateOneShotCoursePlan',
          'GenerateCoursePlan',
          'ScoreCourseQuality',
          'RepairCourseGeneration',
          'RecordCourseExperience',
          'GenerateCourseGDD',
          'GenerateAssets',
          'CourseTTSManifest',
          'ValidateCoursePackage',
          'ReadManyFiles',
        ]),
      }),
    });
  });

  it('支持只传一句话目标的一句话课程生成入口', async () => {
    const { buildCourseGameFromPromptPrompt, createCourseGameFromPrompt } =
      await import('../../src/course/createCourseGame.js');

    const prompt = buildCourseGameFromPromptPrompt({
      text: '四年级数学，太空基地主题，让孩子理解长方形面积公式不是死背。',
      profileId: 'profile_1',
    });

    expect(prompt).toContain('generate_one_shot_course_plan 参数 JSON');
    expect(prompt).toContain('generate_course_plan');
    expect(prompt).toContain('score_course_quality');
    expect(prompt).toContain('等待用户或外部 ToC 服务确认 `selectedPlanId`');

    const result = createCourseGameFromPrompt({
      text: '四年级数学，太空基地主题，让孩子理解长方形面积公式不是死背。',
      options: { cwd: '/tmp/opengame-one-shot' },
    });

    expect(result).toEqual({ mocked: true });
    expect(queryMock).toHaveBeenLastCalledWith({
      prompt: expect.stringContaining('generate_one_shot_course_plan'),
      options: expect.objectContaining({
        cwd: '/tmp/opengame-one-shot',
        includePartialMessages: true,
        coreTools: expect.arrayContaining([
          'GenerateOneShotCoursePlan',
          'GenerateCoursePlan',
          'ScoreCourseQuality',
          'RepairCourseGeneration',
        ]),
      }),
    });
  });

  it('一句话入口拒绝空目标和确认生成模式', async () => {
    const { buildCourseGameFromPromptPrompt } =
      await import('../../src/course/createCourseGame.js');

    expect(() => buildCourseGameFromPromptPrompt({ text: '   ' })).toThrow(
      '一句话课程目标不能为空',
    );
    expect(() =>
      buildCourseGameFromPromptPrompt({
        text: '四年级数学面积课',
        mode: 'confirmed_generation' as never,
      }),
    ).toThrow('一句话入口只支持 plan_only');
  });

  it('从 assistant tool_use 和 tool_result 生成课程进度事件', async () => {
    const { createCourseProgressTracker } =
      await import('../../src/course/createCourseGame.js');
    const track = createCourseProgressTracker();

    const startEvents = track(
      buildAssistantMessage([
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'generate_course_plan',
          input: { courseSpec: {} },
        },
      ]),
    );
    const doneEvents = track(
      buildAssistantMessage([
        {
          type: 'tool_result',
          tool_use_id: 'tool-1',
          content: 'ok',
        },
      ]),
    );

    expect(startEvents).toEqual([
      expect.objectContaining({
        stage: 'course_plan_options',
        status: 'running',
        toolName: 'generate_course_plan',
      }),
    ]);
    expect(doneEvents).toEqual([
      expect.objectContaining({
        stage: 'course_plan_options',
        status: 'completed',
        toolName: 'generate_course_plan',
      }),
    ]);
  });

  it('跟踪 MVP 3.0 一句话、质量、修复和经验工具进度事件', async () => {
    const { createCourseProgressTracker } =
      await import('../../src/course/createCourseGame.js');
    const track = createCourseProgressTracker();

    expect(
      track(
        buildAssistantMessage([
          {
            type: 'tool_use',
            id: 'tool-one-shot',
            name: 'generate_one_shot_course_plan',
            input: { text: '四年级数学面积课' },
          },
          {
            type: 'tool_use',
            id: 'tool-quality',
            name: 'score_course_quality',
            input: {},
          },
          {
            type: 'tool_use',
            id: 'tool-repair',
            name: 'repair_course_generation',
            input: {},
          },
          {
            type: 'tool_use',
            id: 'tool-exp',
            name: 'record_course_experience',
            input: {},
          },
        ]),
      ),
    ).toEqual([
      expect.objectContaining({
        stage: 'one_shot_course_plan',
        toolName: 'generate_one_shot_course_plan',
      }),
      expect.objectContaining({
        stage: 'course_quality_score',
        toolName: 'score_course_quality',
      }),
      expect.objectContaining({
        stage: 'course_generation_repair',
        toolName: 'repair_course_generation',
      }),
      expect.objectContaining({
        stage: 'course_experience_record',
        toolName: 'record_course_experience',
      }),
    ]);
  });

  it('构造课程续作 prompt，先生成下一课 CourseSpec 再进入方案生成', async () => {
    const { buildNextCourseGamePrompt } =
      await import('../../src/course/createCourseGame.js');

    const prompt = buildNextCourseGamePrompt({
      profileId: 'profile_1',
      previousCourseSpec: buildCourseSpec(),
      previousGameplayType: '网格建造',
      learningReport: {
        profileId: 'profile_1',
        subject: '数学',
        weakPoints: ['单位混淆'],
        masteredGoals: ['理解面积含义'],
        misconceptionTags: ['area_unit_confusion'],
      },
    });

    expect(prompt).toContain('先调用 `generate_next_course_spec`');
    expect(prompt).toContain('只调用 `generate_course_plan`');
    expect(prompt).toContain('不能盲目重复相同玩法');
    expect(prompt).toContain('"previousGameplayType": "网格建造"');
    expect(prompt).toContain('"weakPoints": [');
  });

  it('创建课程续作 SDK 查询时默认启用下一课工具', async () => {
    const { createNextCourseGame } =
      await import('../../src/course/createCourseGame.js');

    const result = createNextCourseGame({
      profileId: 'profile_1',
      previousCourseSpec: buildCourseSpec(),
      learningReport: {
        profileId: 'profile_1',
        subject: '数学',
        weakPoints: ['单位混淆'],
      },
      options: {
        cwd: '/tmp/opengame-course',
      },
    });

    expect(result).toEqual({ mocked: true });
    expect(queryMock).toHaveBeenCalledWith({
      prompt: expect.stringContaining('generate_next_course_spec'),
      options: expect.objectContaining({
        cwd: '/tmp/opengame-course',
        includePartialMessages: true,
        coreTools: expect.arrayContaining([
          'GenerateNextCourseSpec',
          'GenerateCoursePlan',
        ]),
      }),
    });
  });

  it('拒绝缺少学习报告和学习状态的课程续作请求', async () => {
    const { buildNextCourseGamePrompt } =
      await import('../../src/course/createCourseGame.js');

    expect(() =>
      buildNextCourseGamePrompt({
        profileId: 'profile_1',
        previousCourseSpec: buildCourseSpec(),
      }),
    ).toThrow('learningReport 或 learningState');
  });

  it('跟踪下一课 CourseSpec 生成进度事件', async () => {
    const { createCourseProgressTracker } =
      await import('../../src/course/createCourseGame.js');
    const track = createCourseProgressTracker();

    expect(
      track(
        buildAssistantMessage([
          {
            type: 'tool_use',
            id: 'tool-next',
            name: 'generate_next_course_spec',
            input: { profileId: 'profile_1' },
          },
        ]),
      ),
    ).toEqual([
      expect.objectContaining({
        stage: 'next_course_spec',
        status: 'running',
        toolName: 'generate_next_course_spec',
      }),
    ]);
  });

  it('从 result 消息生成完成事件', async () => {
    const { createCourseProgressTracker } =
      await import('../../src/course/createCourseGame.js');
    const track = createCourseProgressTracker();

    expect(track(buildResultMessage(false))).toEqual([
      expect.objectContaining({
        stage: 'completed',
        status: 'completed',
      }),
    ]);
    expect(track(buildResultMessage(true))).toEqual([
      expect.objectContaining({
        stage: 'completed',
        status: 'failed',
      }),
    ]);
  });
});

function buildAssistantMessage(
  content: SDKAssistantMessage['message']['content'],
): SDKAssistantMessage {
  return {
    type: 'assistant',
    uuid: 'assistant-1',
    session_id: 'session-1',
    parent_tool_use_id: null,
    message: {
      id: 'message-1',
      type: 'message',
      role: 'assistant',
      model: 'test-model',
      content,
      usage: { input_tokens: 1, output_tokens: 1 },
    },
  };
}

function buildResultMessage(isError: boolean): SDKResultMessage {
  return isError
    ? {
        type: 'result',
        subtype: 'error_during_execution',
        uuid: 'result-1',
        session_id: 'session-1',
        is_error: true,
        duration_ms: 1,
        duration_api_ms: 1,
        num_turns: 1,
        usage: { input_tokens: 1, output_tokens: 1 },
        permission_denials: [],
        error: { message: 'failed' },
      }
    : {
        type: 'result',
        subtype: 'success',
        uuid: 'result-1',
        session_id: 'session-1',
        is_error: false,
        duration_ms: 1,
        duration_api_ms: 1,
        num_turns: 1,
        result: 'ok',
        usage: { input_tokens: 1, output_tokens: 1 },
        permission_denials: [],
      };
}

function buildCourseSpec(): CourseSpec {
  return {
    subject: '数学',
    topic: '面积和周长',
    learningGoals: ['区分面积和周长', '用方格估算面积'],
    durationMinutes: 20,
    studentProfile: {
      grade: 3,
      readingLevel: 'medium',
      interests: ['探险', '建造'],
      guardianLimits: {
        maxSessionMinutes: 30,
        allowUploadedImages: false,
        allowGeneratedVideo: false,
        contentStrictness: 'strict',
      },
    },
    styleSpec: {
      theme: '森林工坊',
      palette: ['#2F7D32', '#F9C74F', '#277DA1'],
      visualMood: '明快',
      characterStyle: '卡通',
      uiDensity: 'medium',
      forbidden: ['恐怖', '抽卡'],
    },
    explanationDepth: {
      depthLevel: 'standard',
      priorKnowledgeCheck: true,
      conceptLayers: [
        {
          concept: '周长',
          whyItMatters: '帮助学生理解边界长度。',
          misconceptionToAddress: ['把周长当成格子数量'],
          representation: 'visual_model',
        },
        {
          concept: '面积',
          whyItMatters: '帮助学生理解覆盖大小。',
          misconceptionToAddress: ['把面积当成边长相加'],
          representation: 'visual_model',
        },
      ],
      examplePlan: {
        workedExamples: 2,
        guidedPractice: 3,
        independentChallenges: 2,
        transferTasks: 1,
      },
      feedbackDepth: 'step_by_step',
      masteryEvidence: ['能解释面积和周长差异'],
    },
  };
}

function buildCoursePlanOption(): CoursePlanOption {
  return {
    id: 'balanced',
    title: '森林工坊面积挑战',
    courseArchetype: 'course_grid',
    gameplayType: '网格建造',
    learningLoop: ['讲解', '示例', '互动', '反馈', '评价'],
    scenePlan: ['GridLessonScene', 'GridPracticeScene'],
    assessmentPoints: ['区分面积和周长'],
    assetComplexity: 'medium',
    score: {
      learningFit: 90,
      explanationDepthFit: 88,
      fun: 82,
      ageFit: 92,
      implementationStability: 90,
      cost: 78,
      safety: 95,
    },
    recommendationReason: '网格适合面积和周长的可视化操作。',
    risks: [],
  };
}
