/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Config } from '../config/config.js';
import type {
  CourseGDD,
  CoursePlanOption,
  CourseSpec,
} from '../course/schemas.js';
import type { CourseContentJson } from '../course/courseGddMapper.js';
import { ValidateCoursePackageTool } from './validate-course-package.js';

describe('ValidateCoursePackageTool', () => {
  let tempDir: string;
  let config: Config;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'course-package-'));
    config = {
      getProjectRoot: () => tempDir,
    } as Config;
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('通过完整课程包，并把缺失本地 TTS 音频降级为 warning', async () => {
    const packageDir = await writeCoursePackage({
      extraSourceContent: `
// this.load.image('comment_only_bg', 'unused.png');
/*
this.textures.exists('comment_only_texture');
*/
this.load.image('forest_grid_bg', 'assets/forest_grid_bg.png');
`,
    });
    const tool = new ValidateCoursePackageTool(config);

    const result = await tool.buildAndExecute(
      {
        packageDir,
        courseGdd: buildCourseGdd(),
      },
      new AbortController().signal,
    );

    expect(result.error).toBeUndefined();
    expect(result.llmContent).toContain('"passed": true');
    expect(result.llmContent).toContain('"errors": 0');
    expect(result.llmContent).toContain(
      'narration_local_audio_missing_with_fallback',
    );
    expect(result.llmContent).not.toContain('comment_only_bg');
    expect(result.llmContent).not.toContain('comment_only_texture');
  });

  it('支持 generate_game_assets 产出的分组 asset-pack 格式', async () => {
    const gdd = buildCourseGdd();
    gdd.courseSpec.studentProfile.guardianLimits!.allowGeneratedVideo = true;
    gdd.assetPlan.video = [
      {
        key: 'intro_video',
        description: '课程开场视频',
        optional: true,
      },
    ];
    const packageDir = await writeCoursePackage({
      assetPack: {
        images: {
          files: [
            {
              type: 'image',
              key: 'forest_grid_bg',
              url: 'assets/forest_grid_bg.png',
            },
          ],
        },
        audio: {
          files: [
            {
              type: 'audio',
              key: 'sfx_correct',
              url: 'assets/sfx_correct.wav',
            },
          ],
        },
        video: {
          files: [
            {
              type: 'video',
              key: 'intro_video',
              url: 'assets/intro_video.mp4',
            },
          ],
        },
      },
      extraSourceContent: `
this.load.pack('assetPack', 'assets/asset-pack.json');
this.load.image('forest_grid_bg', 'assets/forest_grid_bg.png');
`,
      mutateCourseContent: (content) => {
        content.videoTransitions = [
          {
            key: 'intro_video',
            targetScene: 'GridLessonScene',
            description: '课程开场视频',
            optional: true,
            skipLabel: '跳过过场',
          },
        ];
      },
    });
    const tool = new ValidateCoursePackageTool(config);

    const result = await tool.buildAndExecute(
      {
        packageDir,
        courseGdd: gdd,
      },
      new AbortController().signal,
    );

    expect(result.error).toBeUndefined();
    expect(result.llmContent).not.toContain('code_asset_key_missing');
    expect(result.llmContent).not.toContain('asset_key_missing');
  });

  it('缺少评价题 explanation 时阻断课程包', async () => {
    const packageDir = await writeCoursePackage({
      mutateCourseContent: (content) => {
        content.assessments[0]!.explanation = '答案是 A';
      },
    });
    const tool = new ValidateCoursePackageTool(config);

    const result = await tool.buildAndExecute(
      {
        packageDir,
        courseGdd: buildCourseGdd(),
      },
      new AbortController().signal,
    );

    expect(result.error?.message).toContain('课程包验证失败');
    expect(result.llmContent).toContain('assessment_explanation_too_short');
  });

  it('缺少课程场景注册时阻断课程包', async () => {
    const packageDir = await writeCoursePackage({
      mainContent: buildMainTs({ includePracticeScene: false }),
    });
    const tool = new ValidateCoursePackageTool(config);

    const result = await tool.buildAndExecute(
      {
        packageDir,
        courseGdd: buildCourseGdd(),
      },
      new AbortController().signal,
    );

    expect(result.error?.message).toContain('课程包验证失败');
    expect(result.llmContent).toContain('scene_not_registered');
    expect(result.llmContent).toContain('GridPracticeScene');
  });

  it('缺少 workflow 引用的玩法模板包文件时阻断课程包', async () => {
    const packageDir = await writeCoursePackage({
      skipPlayletPackages: true,
    });
    const tool = new ValidateCoursePackageTool(config);

    const result = await tool.buildAndExecute(
      {
        packageDir,
        courseGdd: buildCourseGdd(),
      },
      new AbortController().signal,
    );

    expect(result.error?.message).toContain('课程包验证失败');
    expect(result.llmContent).toContain('playlet_package_file_missing');
  });

  it('生成阶段新增玩法引擎代码时阻断课程包', async () => {
    const packageDir = await writeCoursePackage();
    await fs.writeFile(
      path.join(packageDir, 'src/playlets/playlet-步骤排序/custom-engine.ts'),
      'export const illegal = true;',
    );
    const tool = new ValidateCoursePackageTool(config);

    const result = await tool.buildAndExecute(
      {
        packageDir,
        courseGdd: buildCourseGdd(),
      },
      new AbortController().signal,
    );

    expect(result.error?.message).toContain('课程包验证失败');
    expect(result.llmContent).toContain(
      'generated_playlet_engine_code_forbidden',
    );
  });

  async function writeCoursePackage(
    options: {
      mutateCourseContent?: (content: CourseContentJson) => void;
      mainContent?: string;
      extraSourceContent?: string;
      assetPack?: Record<string, unknown>;
      skipPlayletPackages?: boolean;
    } = {},
  ): Promise<string> {
    const packageDir = path.join(tempDir, 'generated-course');
    const content = buildCourseContent();
    options.mutateCourseContent?.(content);

    await fs.mkdir(path.join(packageDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(packageDir, 'public/assets/narration'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(packageDir, 'src/courseContent.json'),
      JSON.stringify(content, null, 2),
    );
    await fs.writeFile(
      path.join(packageDir, 'public/assets/asset-pack.json'),
      JSON.stringify(options.assetPack ?? buildAssetPack(), null, 2),
    );
    await fs.writeFile(
      path.join(packageDir, 'public/assets/narration/narration-manifest.json'),
      JSON.stringify(buildNarrationManifest(), null, 2),
    );
    await fs.writeFile(
      path.join(packageDir, 'src/main.ts'),
      options.mainContent ?? buildMainTs(),
    );
    await fs.writeFile(
      path.join(packageDir, 'src/LevelManager.ts'),
      buildLevelManagerTs(),
    );
    if (options.extraSourceContent) {
      await fs.writeFile(
        path.join(packageDir, 'src/asset-comments.ts'),
        options.extraSourceContent,
      );
    }
    if (!options.skipPlayletPackages) {
      await writePlayletPackage(packageDir, 'playlet-步骤排序');
      await writePlayletPackage(packageDir, 'playlet-卡片配对');
    }

    return packageDir;
  }
});

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
      forbidden: ['惊吓', '付费诱导'],
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

function buildSelectedPlan(): CoursePlanOption {
  return {
    id: 'balanced',
    title: '生态网格调查',
    courseArchetype: 'course_grid',
    gameplayType: '分类观察',
    learningLoop: ['讲解', '示例', '互动练习', '反馈', '评价'],
    scenePlan: ['GridLessonScene', 'GridPracticeScene'],
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
    recommendationReason: '网格分类适合承载角色关系推理。',
    risks: ['需要控制网格数量，避免认知负担。'],
  };
}

function buildCourseGdd(): CourseGDD {
  return {
    courseSpec: buildCourseSpec(),
    selectedPlan: buildSelectedPlan(),
    lessonUnits: [
      {
        id: 'lesson_food_chain',
        learningGoal: '解释食物链',
        concept: '食物链',
        explanationScript:
          '食物链表示能量从生产者开始，沿着吃与被吃的关系传递。先找到能自己制造养分的植物，再观察动物之间的取食关系。',
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
          targetScene: 'GridLessonScene',
        },
        {
          id: 'lesson_roles',
          name: '生态角色讲解',
          text: '按获取能量的方式区分生产者和消费者。',
          targetScene: 'GridPracticeScene',
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

function buildCourseContent(): CourseContentJson {
  return {
    course: {
      id: 'science_ecosystem_balanced',
      title: '生态网格调查',
      subject: '科学',
      topic: '生态系统',
      grade: 5,
      archetype: 'course_grid',
      depthLevel: 'deep',
      durationMinutes: 25,
    },
    learningGoals: [
      {
        id: 'goal_1',
        text: '解释食物链',
        masteryEvidence: ['能画出食物链'],
      },
      {
        id: 'goal_2',
        text: '识别生态系统中的角色',
        masteryEvidence: ['能解释角色关系'],
      },
    ],
    lessonUnits: [
      {
        id: 'lesson_food_chain',
        goalId: 'goal_1',
        sceneKey: 'GridLessonScene',
        concept: '食物链',
        script: '食物链表示能量从生产者开始传递。',
        workedExample: '草到兔子再到狐狸，表示能量沿吃与被吃的关系移动。',
        misconceptions: ['按体型排序'],
        interactionIds: ['interaction_food_chain'],
        assessmentItemIds: ['assessment_food_chain'],
      },
      {
        id: 'lesson_roles',
        goalId: 'goal_2',
        sceneKey: 'GridPracticeScene',
        concept: '生产者和消费者',
        script: '生态系统角色可以按获取能量的方式区分。',
        workedExample: '植物通常是生产者，兔子通过吃植物获得能量。',
        misconceptions: ['只按生活地点判断'],
        interactionIds: ['interaction_roles'],
        assessmentItemIds: ['assessment_roles'],
      },
    ],
    interactions: [
      {
        id: 'interaction_food_chain',
        goalId: 'goal_1',
        sceneKey: 'GridPracticeScene',
        type: 'grid_sort',
        prompt: '把草、兔子、狐狸放入正确顺序。',
        successFeedback: '顺序正确，能量流向清楚。',
        failureFeedback: '先找能自己制造养分的角色。',
      },
      {
        id: 'interaction_roles',
        goalId: 'goal_2',
        sceneKey: 'GridPracticeScene',
        type: 'card_match',
        prompt: '把角色卡片分到生产者或消费者。',
        successFeedback: '分类正确，你用了能量来源作为依据。',
        failureFeedback: '不要只看体型大小，想一想它怎样获得能量。',
      },
    ],
    assessments: [
      {
        id: 'assessment_food_chain',
        goalId: 'goal_1',
        sceneKey: 'GridPracticeScene',
        question: '为什么草应该放在食物链开头？',
        options: ['因为草是生产者', '因为草体型最小'],
        correctIndex: 0,
        explanation:
          '草能通过光合作用制造养分，是能量进入食物链的起点，所以应放在开头。',
        misconceptionTag: 'size_based_order',
        hint: '判断开头时先看谁能制造养分。',
      },
      {
        id: 'assessment_roles',
        goalId: 'goal_2',
        sceneKey: 'GridPracticeScene',
        question: '兔子为什么是消费者？',
        options: ['因为它吃植物获得能量', '因为它生活在森林'],
        correctIndex: 0,
        explanation:
          '消费者不能自己制造养分，需要通过取食获得能量，兔子吃植物所以是消费者。',
        misconceptionTag: 'habitat_based_role',
        hint: '角色分类要看能量来源。',
      },
    ],
    narration: {
      segments: [
        {
          id: 'lesson_food_chain',
          targetScene: 'GridLessonScene',
          text: '食物链表示能量从生产者开始传递。',
          fallbackSubtitle: '食物链表示能量从生产者开始传递。',
        },
        {
          id: 'lesson_roles',
          targetScene: 'GridPracticeScene',
          text: '按获取能量的方式区分生产者和消费者。',
          fallbackSubtitle: '按获取能量的方式区分生产者和消费者。',
        },
      ],
    },
    videoTransitions: [],
    workflow: {
      startNodeId: 'node_1',
      nodes: [
        {
          id: 'node_1',
          playletId: 'playlet-步骤排序',
          goalIds: ['goal_1'],
          config: {
            prompt: '把草、兔子、狐狸放入正确顺序。',
            items: [{ id: 'grass', label: '草' }],
            successCriteria: '完成排序并解释能量流向。',
          },
          styleBindingId: 'default',
          enterTransition: '森林调查开始',
          exitTransition: '进入角色分类',
        },
        {
          id: 'node_2',
          playletId: 'playlet-卡片配对',
          goalIds: ['goal_2'],
          config: {
            prompt: '把角色卡片分到生产者或消费者。',
            items: [{ id: 'rabbit', label: '兔子' }],
            successCriteria: '完成配对并说明依据。',
          },
          styleBindingId: 'default',
        },
      ],
      edges: [{ from: 'node_1', to: 'node_2', when: 'success' }],
      recoveryPolicy: 'hint_then_retry',
    },
    styleBible: {
      theme: '森林调查',
      palette: ['#14532D', '#FDE68A', '#38BDF8'],
      characterDirection: '调查员',
      uiTokens: { density: 'medium', mood: '自然明亮' },
      motionMood: '自然明亮',
      audioMood: '清晰鼓励',
      forbiddenElements: ['惊吓', '付费诱导'],
    },
    report: {
      masteryEvidence: ['能画出食物链', '能解释角色关系'],
      metrics: ['accuracy', 'stepErrors', 'completedGoals'],
    },
    templateRules: {
      allowedUse: '分类、排序、路径、步骤推理和即时反馈',
      requiresFeedback: true,
      reviewOnly: false,
    },
  };
}

function buildAssetPack(): Record<string, unknown> {
  return {
    images: {
      files: [
        {
          type: 'image',
          key: 'forest_grid_bg',
          url: 'assets/forest_grid_bg.png',
        },
      ],
    },
    audio: {
      files: [
        { type: 'audio', key: 'sfx_correct', url: 'assets/sfx_correct.wav' },
      ],
    },
  };
}

function buildNarrationManifest(): Record<string, unknown> {
  return {
    courseId: 'science_ecosystem_balanced',
    basePath: 'science_ecosystem_balanced/audio/narration',
    type: 'mp3',
    outputDir: 'public/assets/narration',
    fallbackMode: 'none',
    warnings: [],
    segments: [
      {
        id: 'lesson_food_chain',
        name: 'lesson_food_chain',
        targetScene: 'GridLessonScene',
        text: '食物链表示能量从生产者开始传递。',
        audio_uri: 'oss://course/lesson_food_chain.mp3',
        local_path: 'public/assets/narration/lesson_food_chain.mp3',
        fallbackSubtitle: '食物链表示能量从生产者开始传递。',
        status: 'ready',
      },
      {
        id: 'lesson_roles',
        name: 'lesson_roles',
        targetScene: 'GridPracticeScene',
        text: '按获取能量的方式区分生产者和消费者。',
        audio_uri: 'oss://course/lesson_roles.mp3',
        local_path: 'public/assets/narration/lesson_roles.mp3',
        fallbackSubtitle: '按获取能量的方式区分生产者和消费者。',
        status: 'ready',
      },
    ],
  };
}

function buildMainTs(options: { includePracticeScene?: boolean } = {}): string {
  const includePracticeScene = options.includePracticeScene ?? true;
  return `
import Phaser from 'phaser';
import { GridLessonScene, GridPracticeScene } from './scenes';
const game = new Phaser.Game({});
game.scene.add('Preloader', Phaser.Scene, true);
game.scene.add('TitleScreen', Phaser.Scene);
game.scene.add('GridLessonScene', GridLessonScene);
${includePracticeScene ? "game.scene.add('GridPracticeScene', GridPracticeScene);" : ''}
game.scene.add('UIScene', Phaser.Scene);
`;
}

function buildLevelManagerTs(): string {
  return `
export class LevelManager {
  static readonly LEVEL_ORDER: string[] = ['GridLessonScene', 'GridPracticeScene'];
}
`;
}

async function writePlayletPackage(
  packageDir: string,
  playletId: string,
): Promise<void> {
  const playletDir = path.join(packageDir, 'src/playlets', playletId);
  await fs.mkdir(playletDir, { recursive: true });
  await fs.writeFile(
    path.join(playletDir, 'manifest.json'),
    JSON.stringify({ id: playletId, status: 'ready' }, null, 2),
  );
  await fs.writeFile(
    path.join(playletDir, 'schema.json'),
    JSON.stringify({ type: 'object' }, null, 2),
  );
  await fs.writeFile(
    path.join(playletDir, 'sample.json'),
    JSON.stringify(
      {
        prompt: '样例任务',
        items: [{ id: 'item_1' }],
        successCriteria: '完成样例',
      },
      null,
      2,
    ),
  );
  await fs.writeFile(
    path.join(playletDir, 'index.ts'),
    `export const playletId = '${playletId}';\n`,
  );
}
