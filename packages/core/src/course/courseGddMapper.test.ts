/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type {
  CourseArchetype,
  CourseGDD,
  CoursePlanOption,
  CourseSpec,
} from './schemas.js';
import { mapCourseGddToOpenGameScaffold } from './courseGddMapper.js';

describe('mapCourseGddToOpenGameScaffold', () => {
  it.each<CourseArchetype>(['course_ui', 'course_grid', 'course_td'])(
    '把 Course GDD 映射到受控课程模板：%s',
    (archetype) => {
      const gdd = buildCourseGdd(archetype);

      const result = mapCourseGddToOpenGameScaffold(gdd, {
        outputDir: './student-course',
      });

      expect(result.archetype).toBe(archetype);
      expect(result.templateModule).toBe(
        `agent-test/templates/modules/${archetype}`,
      );
      expect(
        result.copyInstructions.map((instruction) => instruction.from),
      ).toEqual(
        expect.arrayContaining([
          'agent-test/templates/course_runtime/*',
          'agent-test/templates/playlets/shared/*',
          'agent-test/templates/core/*',
          `agent-test/templates/modules/${archetype}/src/*`,
          `agent-test/docs/modules/${archetype}/*`,
          'generated:courseContent',
        ]),
      );
      expect(result.writeFiles[0].path).toBe(
        './student-course/src/courseContent.json',
      );
      const content = getCourseContent(result);
      expect(content.course.archetype).toBe(archetype);
      expect(content.learningGoals).toHaveLength(2);
      expect(content.lessonUnits[0].goalId).toBe('goal_1');
      expect(content.interactions[0].successFeedback).toContain('顺序正确');
      expect(content.videoTransitions).toEqual([]);
      expect(content.workflow?.startNodeId).toBeTruthy();
      expect(content.workflow?.nodes.length).toBeGreaterThan(0);
      expect(content.styleBible?.theme).toBe('森林调查');
      expect(
        result.copyInstructions.some((instruction) =>
          instruction.from.startsWith('agent-test/templates/playlets/playlet-'),
        ),
      ).toBe(true);
      expect(getGeneratedText(result, 'src/main.ts')).toContain(
        sceneImportFor(archetype),
      );
      expect(getGeneratedText(result, 'src/main.ts')).toContain(
        'WorkflowEntryScene',
      );
      expect(getGeneratedText(result, 'src/main.ts')).toContain(
        `game.scene.add('${firstSceneFor(archetype)}'`,
      );
      expect(getGeneratedText(result, 'src/LevelManager.ts')).toContain(
        firstSceneFor(archetype),
      );
      expect(result.nextTools).toEqual([
        'generate_game_assets',
        'course_tts_manifest',
        'validate_course_package',
      ]);
    },
  );

  it('不会输出普通游戏模板复制指令', () => {
    const result = mapCourseGddToOpenGameScaffold(
      buildCourseGdd('course_grid'),
    );
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('platformer');
    expect(serialized).not.toContain('top_down');
    expect(serialized).not.toContain('modules/grid_logic');
    expect(serialized).not.toContain('modules/tower_defense');
    expect(serialized).not.toContain('modules/ui_heavy');
  });

  it('校验 Course GDD 后再映射', () => {
    const gdd = buildCourseGdd('course_ui');
    gdd.lessonUnits[0].assessmentPointId = 'missing_assessment';

    expect(() => mapCourseGddToOpenGameScaffold(gdd)).toThrow(
      'Course GDD 无法映射到课程模板',
    );
  });

  it('把可选视频资产映射成 courseContent 的可跳过过场', () => {
    const gdd = buildCourseGdd('course_ui');
    gdd.courseSpec.studentProfile.guardianLimits!.allowGeneratedVideo = true;
    gdd.assetPlan.video = [
      {
        key: 'intro_transition_video',
        description: '课程开场过场视频',
        optional: true,
      },
    ];

    const result = mapCourseGddToOpenGameScaffold(gdd);
    const content = getCourseContent(result);

    expect(content.videoTransitions).toEqual([
      {
        key: 'intro_transition_video',
        targetScene: 'LessonScene',
        description: '课程开场过场视频',
        optional: true,
        skipLabel: '跳过过场',
      },
    ]);
  });
});

function getCourseContent(
  result: ReturnType<typeof mapCourseGddToOpenGameScaffold>,
) {
  const contentFile = result.writeFiles.find((file) =>
    file.path.endsWith('src/courseContent.json'),
  );
  if (!contentFile || typeof contentFile.content === 'string') {
    throw new Error('测试需要 scaffold 输出 courseContent.json 对象。');
  }
  return contentFile.content;
}

function getGeneratedText(
  result: ReturnType<typeof mapCourseGddToOpenGameScaffold>,
  pathSuffix: string,
): string {
  const generatedFile = result.writeFiles.find((file) =>
    file.path.endsWith(pathSuffix),
  );
  if (!generatedFile || typeof generatedFile.content !== 'string') {
    throw new Error(`测试需要 scaffold 输出 ${pathSuffix} 文本。`);
  }
  return generatedFile.content;
}

function sceneImportFor(archetype: CourseArchetype): string {
  if (archetype === 'course_grid') return 'CourseGridScenes';
  if (archetype === 'course_td') return 'CourseTDScenes';
  return 'CourseUIScenes';
}

function firstSceneFor(archetype: CourseArchetype): string {
  if (archetype === 'course_grid') return 'GridLessonScene';
  if (archetype === 'course_td') return 'ReviewPrepScene';
  return 'LessonScene';
}

function buildCourseSpec(): CourseSpec {
  return {
    subject: '科学',
    topic: '生态系统',
    learningGoals: ['解释食物链', '识别生态系统中的角色'],
    durationMinutes: 25,
    studentProfile: {
      grade: 5,
      age: 11,
      readingLevel: 'medium',
      interests: ['探险', '收集'],
      weakPoints: ['概念混淆'],
      preferredInteraction: ['分类', '选择'],
      guardianLimits: {
        maxSessionMinutes: 30,
        allowUploadedImages: true,
        allowGeneratedVideo: false,
        contentStrictness: 'strict',
      },
    },
    styleSpec: {
      theme: '森林调查',
      palette: ['#14532D', '#FDE68A', '#38BDF8'],
      visualMood: '自然明亮',
      characterStyle: '调查员',
      uiDensity: 'medium',
      forbidden: ['惊吓', '抽卡'],
    },
    explanationDepth: {
      depthLevel: 'deep',
      priorKnowledgeCheck: true,
      conceptLayers: [
        {
          concept: '生产者',
          whyItMatters: '帮助理解能量来源。',
          misconceptionToAddress: ['把所有植物和动物作用混为一谈'],
          representation: 'case',
        },
        {
          concept: '消费者',
          whyItMatters: '帮助理解食物链关系。',
          misconceptionToAddress: ['只按体型判断捕食关系'],
          representation: 'visual_model',
        },
      ],
      examplePlan: {
        workedExamples: 2,
        guidedPractice: 2,
        independentChallenges: 2,
        transferTasks: 1,
      },
      feedbackDepth: 'step_by_step',
      masteryEvidence: ['能画出食物链', '能解释角色关系'],
    },
  };
}

function buildPlan(archetype: CourseArchetype): CoursePlanOption {
  return {
    id: 'balanced',
    title: '生态网格调查',
    courseArchetype: archetype,
    gameplayType: archetype === 'course_td' ? '复习波次' : '分类观察',
    learningLoop: ['讲解', '示例', '互动练习', '反馈', '评价'],
    scenePlan: ['导入', '网格分类', '迁移挑战'],
    assessmentPoints: ['解释食物链', '识别生态系统中的角色'],
    assetComplexity: 'medium',
    score: {
      learningFit: 90,
      explanationDepthFit: 84,
      fun: 82,
      ageFit: 88,
      implementationStability: 85,
      cost: 80,
      safety: 94,
    },
    recommendationReason: '分类任务适合承载角色关系推理。',
    risks: ['需要控制网格数量，避免认知负担。'],
  };
}

function buildCourseGdd(archetype: CourseArchetype): CourseGDD {
  const courseSpec = buildCourseSpec();
  return {
    courseSpec,
    selectedPlan: buildPlan(archetype),
    lessonUnits: [
      {
        id: 'lesson_food_chain',
        learningGoal: '解释食物链',
        concept: '食物链',
        explanationScript:
          '食物链表示能量从生产者开始，沿着吃与被吃的关系传递。先找到能自己制造养分的植物，再观察动物之间的取食关系，就能判断箭头方向。',
        interactionTask: '把森林角色拖到正确顺序，并完成一次迁移应用复盘。',
        feedbackStrategy:
          '正确时强调能量流向；错误时标记捕食关系混淆，并提示先找生产者。',
        assessmentPointId: 'assessment_food_chain',
      },
      {
        id: 'lesson_roles',
        learningGoal: '识别生态系统中的角色',
        concept: '生产者和消费者',
        explanationScript:
          '生态系统中的角色可以按获取能量的方式区分。植物通常是生产者，动物多为消费者，判断时不能只看体型大小。',
        interactionTask: '分类森林角色，并说明一个新场景中的迁移判断理由。',
        feedbackStrategy:
          '正确时连接判断依据；错误时标记按体型判断的错因，并给出下一步观察提示。',
        assessmentPointId: 'assessment_roles',
      },
    ],
    interactionSpecs: [
      {
        id: 'interaction_food_chain',
        lessonUnitId: 'lesson_food_chain',
        type: 'grid_sort',
        prompt: '把草、兔子、狐狸放入正确的食物链顺序。',
        expectedAction: '按能量流向完成排序。',
        feedback: {
          correct: '顺序正确，能量从生产者流向消费者。',
          incorrect: '顺序还不对，先找能自己制造养分的角色。',
          misconceptionTag: 'energy_flow_reversed',
          hint: '先找植物，再看谁吃谁。',
        },
      },
      {
        id: 'interaction_roles',
        lessonUnitId: 'lesson_roles',
        type: 'card_match',
        prompt: '把角色卡片分到生产者或消费者。',
        expectedAction: '按获取能量方式分类。',
        feedback: {
          correct: '分类正确，你用了能量来源作为依据。',
          incorrect: '不要只看体型大小，想一想它怎样获得能量。',
          misconceptionTag: 'size_based_role_guess',
          hint: '植物通常能自己制造养分。',
        },
      },
    ],
    assessmentSpec: {
      items: [
        {
          id: 'assessment_food_chain',
          learningGoal: '解释食物链',
          prompt: '为什么草应该放在食物链开头？',
          options: ['因为草是生产者', '因为草体型最小'],
          correctIndex: 0,
          answer: '因为草是生产者。',
          explanation:
            '草能通过光合作用制造养分，是能量进入食物链的起点，所以应放在开头。',
          misconceptionTag: 'size_based_order',
          hint: '判断开头时先看谁能制造养分。',
        },
        {
          id: 'assessment_roles',
          learningGoal: '识别生态系统中的角色',
          prompt: '兔子为什么是消费者？',
          options: ['因为它吃植物获得能量', '因为它生活在森林'],
          correctIndex: 0,
          answer: '因为兔子吃植物获得能量。',
          explanation:
            '消费者不能像植物一样自己制造养分，需要通过取食获得能量，兔子吃植物所以是消费者。',
          misconceptionTag: 'habitat_based_role',
          hint: '角色分类要看能量来源。',
        },
      ],
      masteryCriteria: [
        '能解释食物链中的能量流向',
        '能迁移判断新角色的分类理由',
      ],
    },
    assetPlan: {
      images: [{ key: 'forest_grid_bg', description: '明亮森林网格背景' }],
      audio: [
        { key: 'sfx_correct', description: '答对提示音', audioType: 'sfx' },
      ],
    },
    narrationPlan: {
      segments: [
        {
          id: 'lesson_food_chain',
          name: '食物链讲解',
          text: '食物链表示能量从生产者开始传递。',
          targetScene: '导入',
        },
        {
          id: 'lesson_roles',
          name: '生态角色讲解',
          text: '按获取能量的方式区分生产者和消费者。',
          targetScene: '网格分类',
        },
      ],
    },
    validationPlan: {
      requiredChecks: [
        'schema 合法',
        '学习目标闭环',
        '讲解深度',
        '互动反馈',
        '评价解析',
      ],
      browserFlow: ['进入导入', '完成网格分类', '看到反馈'],
      fallbackChecks: ['TTS 失败显示字幕', '视频关闭不阻断流程'],
    },
  };
}
