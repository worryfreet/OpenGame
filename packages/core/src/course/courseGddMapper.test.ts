/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { CourseArchetype } from './schemas.js';
import { mapCourseGddToOpenGameScaffold } from './courseGddMapper.js';
import { buildCourseGdd } from './courseGddMapper.fixtures.js';

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
        "import { PlayletScene as WorkflowPlayletScene1 } from './playlets/playlet-步骤排序';",
      );
      expect(getGeneratedText(result, 'src/main.ts')).toContain(
        "game.scene.add('步骤排序PlayletScene', WorkflowPlayletScene1);",
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

  it('按 workflow 中的 playlet 注册本轮新增的专用 Scene', () => {
    const gdd = buildCourseGdd('course_ui');
    gdd.selectedPlan.workflow = {
      startNodeId: 'judge',
      nodes: [
        {
          id: 'judge',
          playletId: 'playlet-单选判断',
          goalIds: ['goal_1'],
          config: {
            prompt: '判断说法是否正确。',
            items: [
              {
                id: 'producer',
                label: '植物通常是生产者。',
                answer: true,
              },
            ],
            successCriteria: '判断正确。',
          },
          styleBindingId: 'default',
        },
        {
          id: 'evidence',
          playletId: 'playlet-证据配对',
          goalIds: ['goal_1'],
          config: {
            prompt: '配对结论与证据。',
            claims: [{ id: 'plant_maker', label: '植物是生产者' }],
            evidence: [
              {
                id: 'plant_photosynthesis',
                label: '植物能制造养分',
                claimId: 'plant_maker',
              },
            ],
            successCriteria: '完成证据配对。',
          },
          styleBindingId: 'default',
        },
        {
          id: 'dialogue',
          playletId: 'playlet-对话选择',
          goalIds: ['goal_2'],
          config: {
            prompt: '选择合适回应。',
            startStepId: 'ask',
            steps: [
              {
                id: 'ask',
                speaker: '同伴',
                text: '兔子为什么是消费者？',
                choices: [
                  {
                    id: 'energy',
                    text: '因为它吃植物获得能量。',
                    correct: true,
                  },
                ],
              },
            ],
            successCriteria: '选出合适回应。',
          },
          styleBindingId: 'default',
        },
      ],
      edges: [
        { from: 'judge', to: 'evidence', when: 'success' },
        { from: 'evidence', to: 'dialogue', when: 'success' },
      ],
      recoveryPolicy: 'hint_then_retry',
    };

    const result = mapCourseGddToOpenGameScaffold(gdd);
    const main = getGeneratedText(result, 'src/main.ts');

    expect(main).toContain(
      "import { PlayletScene as WorkflowPlayletScene1 } from './playlets/playlet-单选判断';",
    );
    expect(main).toContain(
      "game.scene.add('单选判断PlayletScene', WorkflowPlayletScene1);",
    );
    expect(main).toContain(
      "import { PlayletScene as WorkflowPlayletScene2 } from './playlets/playlet-证据配对';",
    );
    expect(main).toContain(
      "game.scene.add('证据配对PlayletScene', WorkflowPlayletScene2);",
    );
    expect(main).toContain(
      "import { PlayletScene as WorkflowPlayletScene3 } from './playlets/playlet-对话选择';",
    );
    expect(main).toContain(
      "game.scene.add('对话选择PlayletScene', WorkflowPlayletScene3);",
    );
  });

  it('按 workflow 注册第三轮新增的真实 playlet Scene', () => {
    const gdd = buildCourseGdd('course_ui');
    gdd.selectedPlan.workflow = {
      startNodeId: 'target',
      nodes: [
        {
          id: 'target',
          playletId: 'playlet-找目标',
          goalIds: ['goal_1'],
          config: {
            prompt: '找出面积单位。',
            items: [
              { id: 'square_meter', label: '平方米', answer: true },
              { id: 'meter', label: '米', answer: false },
            ],
            successCriteria: '选出所有目标项。',
          },
          styleBindingId: 'default',
        },
        {
          id: 'anomaly',
          playletId: 'playlet-找异常',
          goalIds: ['goal_1'],
          config: {
            prompt: '找出异常单位。',
            items: [
              { id: 'square_meter', label: '平方米', answer: false },
              { id: 'meter', label: '米', answer: true },
            ],
            successCriteria: '选出所有异常项。',
          },
          styleBindingId: 'default',
        },
        {
          id: 'link',
          playletId: 'playlet-连线匹配',
          goalIds: ['goal_2'],
          config: {
            prompt: '连接概念和含义。',
            items: [
              {
                id: 'area',
                label: '面积',
                pairId: 'surface_size',
                side: 'left',
              },
              {
                id: 'surface_size',
                label: '平面区域大小',
                pairId: 'area',
                side: 'right',
              },
            ],
            successCriteria: '完成所有连线。',
          },
          styleBindingId: 'default',
        },
      ],
      edges: [
        { from: 'target', to: 'anomaly', when: 'success' },
        { from: 'anomaly', to: 'link', when: 'success' },
      ],
      recoveryPolicy: 'hint_then_retry',
    };

    const result = mapCourseGddToOpenGameScaffold(gdd);
    const main = getGeneratedText(result, 'src/main.ts');

    expect(main).toContain(
      "import { PlayletScene as WorkflowPlayletScene1 } from './playlets/playlet-找目标';",
    );
    expect(main).toContain(
      "game.scene.add('找目标PlayletScene', WorkflowPlayletScene1);",
    );
    expect(main).toContain(
      "import { PlayletScene as WorkflowPlayletScene2 } from './playlets/playlet-找异常';",
    );
    expect(main).toContain(
      "game.scene.add('找异常PlayletScene', WorkflowPlayletScene2);",
    );
    expect(main).toContain(
      "import { PlayletScene as WorkflowPlayletScene3 } from './playlets/playlet-连线匹配';",
    );
    expect(main).toContain(
      "game.scene.add('连线匹配PlayletScene', WorkflowPlayletScene3);",
    );
  });

  it('按 workflow 注册第四轮新增的真实 playlet Scene', () => {
    const gdd = buildCourseGdd('course_ui');
    gdd.selectedPlan.workflow = {
      startNodeId: 'keywords',
      nodes: [
        {
          id: 'keywords',
          playletId: 'playlet-关键词提取',
          goalIds: ['goal_1'],
          config: {
            prompt: '提取面积关键词。',
            sourceText: '面积表示平面图形或物体表面的大小。',
            keywords: [
              { id: 'area', label: '面积', answer: true },
              { id: 'length', label: '长度', answer: false },
            ],
            successCriteria: '选出关键词。',
          },
          styleBindingId: 'default',
        },
        {
          id: 'acceptance',
          playletId: 'playlet-需求清单验收',
          goalIds: ['goal_1'],
          config: {
            prompt: '验收课程作品。',
            reviewTarget: '检查课程是否有讲解、练习且不泄露答案。',
            requirements: [
              {
                id: 'has_explanation',
                label: '包含概念讲解',
                required: true,
                expected: true,
              },
              {
                id: 'leak_answer',
                label: '直接暴露答案',
                forbidden: true,
                expected: false,
              },
            ],
            successCriteria: '必需项通过，禁止项未通过。',
          },
          styleBindingId: 'default',
        },
        {
          id: 'annotation',
          playletId: 'playlet-框选标注',
          goalIds: ['goal_2'],
          config: {
            prompt: '框选面积定义。',
            canvasText: '面积表示平面图形或物体表面的大小。',
            regions: [
              {
                id: 'area_definition',
                label: '面积定义',
                target: true,
                x: 0.5,
                y: 0.45,
                width: 0.5,
                height: 0.2,
              },
            ],
            successCriteria: '框选目标区域。',
          },
          styleBindingId: 'default',
        },
      ],
      edges: [
        { from: 'keywords', to: 'acceptance', when: 'success' },
        { from: 'acceptance', to: 'annotation', when: 'success' },
      ],
      recoveryPolicy: 'hint_then_retry',
    };

    const result = mapCourseGddToOpenGameScaffold(gdd);
    const main = getGeneratedText(result, 'src/main.ts');

    expect(main).toContain(
      "import { PlayletScene as WorkflowPlayletScene1 } from './playlets/playlet-关键词提取';",
    );
    expect(main).toContain(
      "game.scene.add('关键词提取PlayletScene', WorkflowPlayletScene1);",
    );
    expect(main).toContain(
      "import { PlayletScene as WorkflowPlayletScene2 } from './playlets/playlet-需求清单验收';",
    );
    expect(main).toContain(
      "game.scene.add('需求清单验收PlayletScene', WorkflowPlayletScene2);",
    );
    expect(main).toContain(
      "import { PlayletScene as WorkflowPlayletScene3 } from './playlets/playlet-框选标注';",
    );
    expect(main).toContain(
      "game.scene.add('框选标注PlayletScene', WorkflowPlayletScene3);",
    );
  });

  it('按 workflow 注册第五轮新增的真实 playlet Scene', () => {
    const gdd = buildCourseGdd('course_grid');
    gdd.selectedPlan.workflow = {
      startNodeId: 'timeline',
      nodes: [
        {
          id: 'timeline',
          playletId: 'playlet-时间线排序',
          goalIds: ['goal_1'],
          config: {
            prompt: '排序解题流程。',
            events: [
              { id: 'read', label: '读题', timeLabel: '第一步', order: 1 },
              { id: 'solve', label: '计算', timeLabel: '第二步', order: 2 },
            ],
            successCriteria: '时间线正确。',
          },
          styleBindingId: 'default',
        },
        {
          id: 'wire',
          playletId: 'playlet-流程接线',
          goalIds: ['goal_1'],
          config: {
            prompt: '接好问题到结论。',
            nodes: [
              { id: 'question', label: '问题' },
              { id: 'evidence', label: '证据' },
              { id: 'conclusion', label: '结论' },
            ],
            edges: [
              { from: 'question', to: 'evidence' },
              { from: 'evidence', to: 'conclusion' },
            ],
            successCriteria: '流程正确。',
          },
          styleBindingId: 'default',
        },
        {
          id: 'conditions',
          playletId: 'playlet-条件组合推理',
          goalIds: ['goal_2'],
          config: {
            prompt: '选择必要条件。',
            conditions: [
              { id: 'same_unit', label: '单位一致', required: true },
              { id: 'number_only', label: '只看数字', required: false },
            ],
            conclusions: [
              { id: 'valid', label: '可以比较', correct: true },
            ],
            successCriteria: '条件和结论正确。',
          },
          styleBindingId: 'default',
        },
      ],
      edges: [
        { from: 'timeline', to: 'wire', when: 'success' },
        { from: 'wire', to: 'conditions', when: 'success' },
      ],
      recoveryPolicy: 'hint_then_retry',
    };

    const result = mapCourseGddToOpenGameScaffold(gdd);
    const main = getGeneratedText(result, 'src/main.ts');

    expect(main).toContain(
      "import { PlayletScene as WorkflowPlayletScene1 } from './playlets/playlet-时间线排序';",
    );
    expect(main).toContain(
      "game.scene.add('时间线排序PlayletScene', WorkflowPlayletScene1);",
    );
    expect(main).toContain(
      "import { PlayletScene as WorkflowPlayletScene2 } from './playlets/playlet-流程接线';",
    );
    expect(main).toContain(
      "game.scene.add('流程接线PlayletScene', WorkflowPlayletScene2);",
    );
    expect(main).toContain(
      "import { PlayletScene as WorkflowPlayletScene3 } from './playlets/playlet-条件组合推理';",
    );
    expect(main).toContain(
      "game.scene.add('条件组合推理PlayletScene', WorkflowPlayletScene3);",
    );
  });

  it('按 workflow 注册第六轮新增的真实 playlet Scene', () => {
    const gdd = buildCourseGdd('course_grid');
    gdd.selectedPlan.workflow = {
      startNodeId: 'chain',
      nodes: [
        {
          id: 'chain',
          playletId: 'playlet-证据链拼接',
          goalIds: ['goal_1'],
          config: {
            prompt: '拼接面积证据链。',
            claim: '长方形面积是 24 平方厘米。',
            chain: [
              { id: 'given', label: '长 6、宽 4', order: 1 },
              { id: 'formula', label: '面积 = 长 x 宽', order: 2 },
              { id: 'result', label: '面积为 24', order: 3 },
            ],
            successCriteria: '证据链顺序正确。',
          },
          styleBindingId: 'default',
        },
        {
          id: 'proof',
          playletId: 'playlet-证明步骤补全',
          goalIds: ['goal_1'],
          config: {
            prompt: '补全证明步骤。',
            goal: '证明面积计算过程。',
            steps: [
              { id: 'given', label: '已知长 6、宽 4', order: 1, locked: true },
              { id: 'formula', label: '面积 = 长 x 宽', order: 2 },
              { id: 'substitute', label: '6 x 4 = 24', order: 3 },
            ],
            successCriteria: '证明步骤完整。',
          },
          styleBindingId: 'default',
        },
        {
          id: 'mental',
          playletId: 'playlet-口算挑战',
          goalIds: ['goal_2'],
          config: {
            prompt: '完成口算。',
            problems: [
              {
                id: 'p1',
                prompt: '6 x 4 = ?',
                answer: 24,
                choices: [20, 24, 28],
              },
            ],
            successCriteria: '完成全部题目。',
          },
          styleBindingId: 'default',
        },
      ],
      edges: [
        { from: 'chain', to: 'proof', when: 'success' },
        { from: 'proof', to: 'mental', when: 'success' },
      ],
      recoveryPolicy: 'hint_then_retry',
    };

    const result = mapCourseGddToOpenGameScaffold(gdd);
    const main = getGeneratedText(result, 'src/main.ts');

    expect(main).toContain(
      "import { PlayletScene as WorkflowPlayletScene1 } from './playlets/playlet-证据链拼接';",
    );
    expect(main).toContain(
      "game.scene.add('证据链拼接PlayletScene', WorkflowPlayletScene1);",
    );
    expect(main).toContain(
      "import { PlayletScene as WorkflowPlayletScene2 } from './playlets/playlet-证明步骤补全';",
    );
    expect(main).toContain(
      "game.scene.add('证明步骤补全PlayletScene', WorkflowPlayletScene2);",
    );
    expect(main).toContain(
      "import { PlayletScene as WorkflowPlayletScene3 } from './playlets/playlet-口算挑战';",
    );
    expect(main).toContain(
      "game.scene.add('口算挑战PlayletScene', WorkflowPlayletScene3);",
    );
  });

  it('按 workflow 注册第七轮新增的真实 playlet Scene', () => {
    const gdd = buildCourseGdd('course_grid');
    gdd.selectedPlan.workflow = {
      startNodeId: 'failure',
      nodes: [
        {
          id: 'failure',
          playletId: 'playlet-失败输出归因',
          goalIds: ['goal_1'],
          config: {
            prompt: '找出面积单位失败原因。',
            output: '把 4 平方米解释成 4 米长。',
            expectedBehavior: '区分面积和长度。',
            causes: [
              { id: 'unit', label: '单位类型混淆', correct: true },
              { id: 'number', label: '数字看错', correct: false },
            ],
            successCriteria: '选出根因。',
          },
          styleBindingId: 'default',
        },
        {
          id: 'module',
          playletId: 'playlet-模块定位',
          goalIds: ['goal_1'],
          config: {
            prompt: '定位修复模块。',
            systemTitle: '面积诊断流程',
            modules: [
              {
                id: 'unit_checker',
                label: '单位判断',
                target: true,
                x: 0.25,
                y: 0.35,
              },
              {
                id: 'skin',
                label: '角色装扮',
                target: false,
                x: 0.75,
                y: 0.35,
              },
            ],
            successCriteria: '定位目标模块。',
          },
          styleBindingId: 'default',
        },
        {
          id: 'coordinate',
          playletId: 'playlet-坐标定位',
          goalIds: ['goal_2'],
          config: {
            prompt: '点选目标坐标。',
            grid: { columns: 5, rows: 4 },
            targets: [{ id: 'point', label: '目标点', x: 2, y: 3 }],
            successCriteria: '坐标正确。',
          },
          styleBindingId: 'default',
        },
      ],
      edges: [
        { from: 'failure', to: 'module', when: 'success' },
        { from: 'module', to: 'coordinate', when: 'success' },
      ],
      recoveryPolicy: 'hint_then_retry',
    };

    const result = mapCourseGddToOpenGameScaffold(gdd);
    const main = getGeneratedText(result, 'src/main.ts');

    expect(main).toContain(
      "import { PlayletScene as WorkflowPlayletScene1 } from './playlets/playlet-失败输出归因';",
    );
    expect(main).toContain(
      "game.scene.add('失败输出归因PlayletScene', WorkflowPlayletScene1);",
    );
    expect(main).toContain(
      "import { PlayletScene as WorkflowPlayletScene2 } from './playlets/playlet-模块定位';",
    );
    expect(main).toContain(
      "game.scene.add('模块定位PlayletScene', WorkflowPlayletScene2);",
    );
    expect(main).toContain(
      "import { PlayletScene as WorkflowPlayletScene3 } from './playlets/playlet-坐标定位';",
    );
    expect(main).toContain(
      "game.scene.add('坐标定位PlayletScene', WorkflowPlayletScene3);",
    );
  });

  it('按 workflow 注册第八轮新增的真实 playlet Scene', () => {
    const gdd = buildCourseGdd('course_grid');
    gdd.selectedPlan.workflow = {
      startNodeId: 'maze',
      nodes: [
        {
          id: 'maze',
          playletId: 'playlet-迷宫寻路',
          goalIds: ['goal_1'],
          config: {
            prompt: '规划迷宫路线。',
            columns: 5,
            rows: 5,
            start: { x: 1, y: 1 },
            end: { x: 5, y: 5 },
            walls: [{ x: 2, y: 1 }],
            expectedPath: [
              { x: 1, y: 1 },
              { x: 1, y: 2 },
              { x: 2, y: 2 },
              { x: 3, y: 2 },
              { x: 4, y: 2 },
              { x: 5, y: 2 },
              { x: 5, y: 3 },
              { x: 5, y: 4 },
              { x: 5, y: 5 },
            ],
            successCriteria: '路线连续且避开障碍。',
          },
          styleBindingId: 'default',
        },
        {
          id: 'assembly',
          playletId: 'playlet-模块装配',
          goalIds: ['goal_1'],
          config: {
            prompt: '装配课程生成链路。',
            parts: [
              { id: 'intake', label: '输入理解' },
              { id: 'plan', label: '方案规划' },
            ],
            slots: [
              { id: 'slot_1', label: '第一步', accepts: 'intake' },
              { id: 'slot_2', label: '第二步', accepts: 'plan' },
            ],
            successCriteria: '组件放入正确槽位。',
          },
          styleBindingId: 'default',
        },
        {
          id: 'slider',
          playletId: 'playlet-滑杆调参',
          goalIds: ['goal_2'],
          config: {
            prompt: '调节课程参数。',
            params: [
              {
                id: 'pace',
                label: '讲解速度',
                min: 0,
                max: 10,
                value: 4,
                targetMin: 5,
                targetMax: 7,
              },
            ],
            successCriteria: '参数进入目标区间。',
          },
          styleBindingId: 'default',
        },
      ],
      edges: [
        { from: 'maze', to: 'assembly', when: 'success' },
        { from: 'assembly', to: 'slider', when: 'success' },
      ],
      recoveryPolicy: 'hint_then_retry',
    };

    const result = mapCourseGddToOpenGameScaffold(gdd);
    const main = getGeneratedText(result, 'src/main.ts');

    expect(main).toContain(
      "import { PlayletScene as WorkflowPlayletScene1 } from './playlets/playlet-迷宫寻路';",
    );
    expect(main).toContain(
      "game.scene.add('迷宫寻路PlayletScene', WorkflowPlayletScene1);",
    );
    expect(main).toContain(
      "import { PlayletScene as WorkflowPlayletScene2 } from './playlets/playlet-模块装配';",
    );
    expect(main).toContain(
      "game.scene.add('模块装配PlayletScene', WorkflowPlayletScene2);",
    );
    expect(main).toContain(
      "import { PlayletScene as WorkflowPlayletScene3 } from './playlets/playlet-滑杆调参';",
    );
    expect(main).toContain(
      "game.scene.add('滑杆调参PlayletScene', WorkflowPlayletScene3);",
    );
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
