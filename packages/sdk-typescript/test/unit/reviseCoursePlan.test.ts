import { describe, expect, it, vi } from 'vitest';
import type {
  CoursePlanOption,
  CourseSpec,
} from '../../src/course/createCourseGame.js';
import type { CourseGDD } from '../../src/course/reviseCoursePlan.js';

const queryMock = vi.hoisted(() => vi.fn(() => ({ mocked: true })));

vi.mock('../../src/query/createQuery.js', () => ({
  query: queryMock,
}));

describe('reviseCoursePlan', () => {
  it('构造只调用 revise_course_plan 的课程修订 prompt', async () => {
    const { buildReviseCoursePlanPrompt } = await import(
      '../../src/course/reviseCoursePlan.js'
    );
    const prompt = buildReviseCoursePlanPrompt({
      request: {
        basePlanId: 'balanced',
        changes: [{ type: 'change_depth', value: 'deep' }],
      },
      courseSpec: buildCourseSpec(),
      selectedPlan: buildCoursePlanOption(),
    });

    expect(prompt).toContain('只调用 `revise_course_plan`');
    expect(prompt).toContain('不要直接修改生成后的源码文件');
    expect(prompt).toContain('"type": "change_depth"');
    expect(prompt).toContain('"selectedPlan"');
  });

  it('创建 SDK 查询时启用 ReviseCoursePlan 工具并保留调用方选项', async () => {
    const { reviseCoursePlan } = await import(
      '../../src/course/reviseCoursePlan.js'
    );

    const result = reviseCoursePlan({
      request: {
        basePlanId: 'balanced',
        changes: [{ type: 'disable_video' }],
      },
      courseGdd: buildCourseGdd(),
      options: {
        cwd: '/tmp/opengame-course',
        coreTools: ['ReadFile'],
      },
    });

    expect(result).toEqual({ mocked: true });
    expect(queryMock).toHaveBeenCalledWith({
      prompt: expect.stringContaining('revise_course_plan 参数 JSON'),
      options: expect.objectContaining({
        cwd: '/tmp/opengame-course',
        includePartialMessages: true,
        coreTools: expect.arrayContaining(['ReviseCoursePlan', 'ReadFile']),
      }),
    });
  });

  it('拒绝缺少结构化修订对象的请求', async () => {
    const { buildReviseCoursePlanPrompt } = await import(
      '../../src/course/reviseCoursePlan.js'
    );

    expect(() =>
      buildReviseCoursePlanPrompt({
        request: {
          basePlanId: 'balanced',
          changes: [{ type: 'change_theme', value: '海底实验室' }],
        },
      }),
    ).toThrow('courseSpec、selectedPlan 或 courseGdd');
  });
});

function buildCourseSpec(): CourseSpec {
  return {
    subject: '数学',
    topic: '面积和周长',
    learningGoals: ['理解面积含义'],
    durationMinutes: 15,
    studentProfile: {
      grade: 3,
      interests: ['太空'],
    },
    styleSpec: {
      theme: '太空基地',
      palette: ['#2563EB'],
      visualMood: '明亮清晰',
      characterStyle: '学习助手',
      uiDensity: 'medium',
      forbidden: ['抽卡'],
    },
    explanationDepth: {
      depthLevel: 'intro',
      priorKnowledgeCheck: false,
      conceptLayers: [
        {
          concept: '面积',
          whyItMatters: '帮助理解覆盖大小。',
          misconceptionToAddress: ['把面积和周长混淆'],
          representation: 'visual_model',
        },
      ],
      examplePlan: {
        workedExamples: 1,
        guidedPractice: 1,
        independentChallenges: 1,
        transferTasks: 0,
      },
      feedbackDepth: 'short_reason',
      masteryEvidence: ['能解释面积含义'],
    },
  };
}

function buildCoursePlanOption(): CoursePlanOption {
  return {
    id: 'balanced',
    title: '太空网格面积调查',
    courseArchetype: 'course_grid',
    gameplayType: '网格建造',
    learningLoop: ['讲解', '互动', '反馈'],
    scenePlan: ['导入', '任务'],
    assessmentPoints: ['理解面积含义'],
    assetComplexity: 'low',
    score: {
      learningFit: 80,
      explanationDepthFit: 80,
      fun: 80,
      ageFit: 80,
      implementationStability: 80,
      cost: 80,
      safety: 90,
    },
    recommendationReason: '适合面积学习。',
    risks: [],
  };
}

function buildCourseGdd(): CourseGDD {
  return {
    courseSpec: buildCourseSpec(),
    selectedPlan: buildCoursePlanOption(),
    lessonUnits: [],
    interactionSpecs: [],
    assessmentSpec: {
      items: [],
      masteryCriteria: [],
    },
    assetPlan: {
      images: [],
      audio: [],
      video: [],
    },
    narrationPlan: {
      segments: [],
    },
    validationPlan: {
      requiredChecks: [],
      browserFlow: [],
      fallbackChecks: [],
    },
  };
}
