/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AssessmentItem,
  CourseArchetype,
  CourseWorkflow,
  CourseGDD,
  InteractionSpec,
  LessonUnit,
  StyleBible,
} from './schemas.js';
import { validateCourseGdd } from './validation.js';
import {
  buildDefaultStyleBible,
  buildLinearCourseWorkflow,
} from './courseWorkflow.js';
import { getPlayletTemplate } from './playletCatalog.js';

export interface CourseTemplateCopyInstruction {
  from: string;
  to: string;
  mode: 'copy_recursive' | 'copy_file' | 'write_json';
  description: string;
}

export interface CourseContentJson {
  course: {
    id: string;
    title: string;
    subject: string;
    topic: string;
    grade: number;
    archetype: CourseArchetype;
    depthLevel: CourseGDD['courseSpec']['explanationDepth']['depthLevel'];
    durationMinutes: number;
  };
  learningGoals: Array<{
    id: string;
    text: string;
    masteryEvidence: string[];
  }>;
  lessonUnits: Array<{
    id: string;
    goalId: string;
    sceneKey: string;
    concept: string;
    script: string;
    workedExample: string;
    misconceptions: string[];
    interactionIds: string[];
    assessmentItemIds: string[];
  }>;
  interactions: Array<{
    id: string;
    goalId: string;
    sceneKey: string;
    type: string;
    prompt: string;
    successFeedback: string;
    failureFeedback: string;
  }>;
  assessments: Array<{
    id: string;
    goalId: string;
    sceneKey: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    misconceptionTag: string;
    hint: string;
  }>;
  narration: {
    segments: Array<{
      id: string;
      targetScene: string;
      text: string;
      audio_uri?: string;
      fallbackSubtitle: string;
    }>;
  };
  videoTransitions: Array<{
    key: string;
    targetScene: string;
    description: string;
    optional: true;
    skipLabel: string;
  }>;
  workflow?: CourseWorkflow;
  styleBible?: StyleBible;
  report: {
    masteryEvidence: string[];
    metrics: string[];
  };
  templateRules: {
    allowedUse: string;
    requiresFeedback: boolean;
    reviewOnly: boolean;
  };
}

export interface CourseScaffoldPlan {
  archetype: CourseArchetype;
  courseId: string;
  templateModule: string;
  templateDocs: string[];
  copyInstructions: CourseTemplateCopyInstruction[];
  writeFiles: Array<{
    path: string;
    content: CourseGeneratedFileContent;
  }>;
  nextTools: string[];
  warnings: string[];
}

type CourseGeneratedFileContent = CourseContentJson | string;

export interface CourseGddMapperOptions {
  outputDir?: string;
  courseId?: string;
}

const TEMPLATE_RULES: Record<
  CourseArchetype,
  {
    allowedUse: string;
    reviewOnly: boolean;
    lessonScene: string;
    practiceScene: string;
    assessmentScene: string;
    metrics: string[];
  }
> = {
  course_ui: {
    allowedUse: '讲解、对话、选择题、卡牌问答和结算报告',
    reviewOnly: false,
    lessonScene: 'LessonScene',
    practiceScene: 'PracticeScene',
    assessmentScene: 'BattleScene',
    metrics: ['accuracy', 'hintUsage', 'completedGoals'],
  },
  course_grid: {
    allowedUse: '分类、排序、路径、步骤推理和即时反馈',
    reviewOnly: false,
    lessonScene: 'GridLessonScene',
    practiceScene: 'GridPracticeScene',
    assessmentScene: 'GridPracticeScene',
    metrics: ['accuracy', 'stepErrors', 'completedGoals'],
  },
  course_td: {
    allowedUse: '复习、巩固、策略选择和波次反馈',
    reviewOnly: true,
    lessonScene: 'ReviewPrepScene',
    practiceScene: 'ReviewWaveScene',
    assessmentScene: 'ReviewWaveScene',
    metrics: ['accuracy', 'waveClearRate', 'completedGoals'],
  },
};

const NEXT_TOOLS = [
  'generate_game_assets',
  'course_tts_manifest',
  'validate_course_package',
] as const;

export function mapCourseGddToOpenGameScaffold(
  input: CourseGDD,
  options: CourseGddMapperOptions = {},
): CourseScaffoldPlan {
  const validation = validateCourseGdd(input);
  if (!validation.valid || !validation.data) {
    throw new Error(
      `Course GDD 无法映射到课程模板：${validation.errors
        .map((issue) => `${issue.path || '/'} ${issue.message}`)
        .join('；')}`,
    );
  }

  const gdd = validation.data;
  const archetype = gdd.selectedPlan.courseArchetype;
  const courseId = options.courseId ?? buildCourseId(gdd);
  const outputDir = normalizeOutputDir(options.outputDir ?? '.');
  const content = buildCourseContent(gdd, courseId);
  const selectedPlayletIds = unique(
    (content.workflow?.nodes ?? []).map((node) => node.playletId),
  );
  const warnings = [...validation.warnings.map((issue) => issue.message)];

  if (archetype === 'course_td' && !isReviewOrPracticePlan(gdd)) {
    warnings.push('course_td 只适合复习巩固；当前 Course GDD 未明确复习边界。');
  }

  return {
    archetype,
    courseId,
    templateModule: `agent-test/templates/modules/${archetype}`,
    templateDocs: [
      `agent-test/docs/modules/${archetype}/design_rules.md`,
      `agent-test/docs/modules/${archetype}/template_api.md`,
      'agent-test/docs/course/gameplay_mapping.md',
    ],
    copyInstructions: [
      {
        from: 'agent-test/templates/course_runtime/*',
        to: `${outputDir}/src/course_runtime/`,
        mode: 'copy_recursive',
        description: '复制课程工作流 runtime，统一执行玩法 DAG、状态和过渡。',
      },
      {
        from: 'agent-test/templates/playlets/shared/*',
        to: `${outputDir}/src/playlets/shared/`,
        mode: 'copy_recursive',
        description: '复制玩法模板共享入口与注册表。',
      },
      ...selectedPlayletIds.map((playletId) => ({
        from: `agent-test/templates/playlets/${playletId}/*`,
        to: `${outputDir}/src/playlets/${playletId}/`,
        mode: 'copy_recursive' as const,
        description: `复制课程工作流需要的玩法模板包 ${playletId}。`,
      })),
      {
        from: 'agent-test/templates/core/*',
        to: `${outputDir}/`,
        mode: 'copy_recursive',
        description: '复制 OpenGame 核心模板，创建 src、public 和基础配置。',
      },
      {
        from: `agent-test/templates/modules/${archetype}/src/*`,
        to: `${outputDir}/src/`,
        mode: 'copy_recursive',
        description: `复制课程模板 ${archetype} 的源码到游戏工程。`,
      },
      {
        from: `agent-test/docs/modules/${archetype}/*`,
        to: `${outputDir}/docs/modules/${archetype}/`,
        mode: 'copy_recursive',
        description: `复制课程模板 ${archetype} 的设计规则和 API 文档。`,
      },
      {
        from: 'generated:courseContent',
        to: `${outputDir}/src/courseContent.json`,
        mode: 'write_json',
        description: '写入由 Course GDD 标准化生成的课程内容配置。',
      },
      {
        from: 'generated:courseEntrypoints',
        to: `${outputDir}/src/main.ts + ${outputDir}/src/LevelManager.ts`,
        mode: 'write_json',
        description: '写入课程模板可直接运行的场景注册入口和关卡顺序。',
      },
    ],
    writeFiles: [
      {
        path: `${outputDir}/src/courseContent.json`,
        content,
      },
      {
        path: `${outputDir}/src/main.ts`,
        content: buildMainSource(archetype, selectedPlayletIds),
      },
      {
        path: `${outputDir}/src/LevelManager.ts`,
        content: buildLevelManagerSource(archetype),
      },
    ],
    nextTools: [...NEXT_TOOLS],
    warnings,
  };
}

function buildCourseContent(
  gdd: CourseGDD,
  courseId: string,
): CourseContentJson {
  const archetype = gdd.selectedPlan.courseArchetype;
  const rules = TEMPLATE_RULES[archetype];
  const goalIds = new Map(
    gdd.courseSpec.learningGoals.map((goal, index) => [
      goal,
      `goal_${index + 1}`,
    ]),
  );

  const interactionsByLessonId = groupBy(
    gdd.interactionSpecs,
    (interaction) => interaction.lessonUnitId,
  );
  const assessmentsByGoal = groupBy(
    gdd.assessmentSpec.items,
    (item) => item.learningGoal,
  );

  return {
    course: {
      id: courseId,
      title: gdd.selectedPlan.title,
      subject: gdd.courseSpec.subject,
      topic: gdd.courseSpec.topic,
      grade: gdd.courseSpec.studentProfile.grade,
      archetype,
      depthLevel: gdd.courseSpec.explanationDepth.depthLevel,
      durationMinutes: gdd.courseSpec.durationMinutes,
    },
    learningGoals: gdd.courseSpec.learningGoals.map((goal) => ({
      id: requireGoalId(goalIds, goal),
      text: goal,
      masteryEvidence: gdd.courseSpec.explanationDepth.masteryEvidence,
    })),
    lessonUnits: gdd.lessonUnits.map((unit) =>
      mapLessonUnit(
        unit,
        goalIds,
        interactionsByLessonId,
        assessmentsByGoal,
        rules,
      ),
    ),
    interactions: gdd.interactionSpecs.map((interaction) =>
      mapInteraction(interaction, gdd.lessonUnits, goalIds, rules),
    ),
    assessments: gdd.assessmentSpec.items.map((item) =>
      mapAssessment(item, goalIds, rules),
    ),
    narration: {
      segments: gdd.narrationPlan.segments.map((segment) => ({
        id: segment.id,
        targetScene: normalizeSceneKey(segment.targetScene, rules.lessonScene),
        text: segment.text,
        fallbackSubtitle: segment.text,
      })),
    },
    videoTransitions: mapVideoTransitions(gdd, rules),
    workflow: buildWorkflow(gdd, goalIds),
    styleBible: gdd.styleBible ?? buildDefaultStyleBible(gdd.courseSpec),
    report: {
      masteryEvidence: gdd.assessmentSpec.masteryCriteria,
      metrics: rules.metrics,
    },
    templateRules: {
      allowedUse: rules.allowedUse,
      requiresFeedback: true,
      reviewOnly: rules.reviewOnly,
    },
  };
}

function buildWorkflow(
  gdd: CourseGDD,
  goalIds: Map<string, string>,
): CourseWorkflow {
  if (gdd.workflow) {
    return gdd.workflow;
  }
  if (gdd.selectedPlan.workflow) {
    return gdd.selectedPlan.workflow;
  }

  const fallbackPlaylets = gdd.interactionSpecs
    .map((interaction) => pickFallbackPlaylet(interaction.type))
    .filter((playletId, index, values) => values.indexOf(playletId) === index);
  const playletIds =
    fallbackPlaylets.length > 0
      ? fallbackPlaylets
      : ['playlet-单选判断', 'playlet-错题回炉'];
  return buildLinearCourseWorkflow(playletIds, [...goalIds.values()]);
}

function pickFallbackPlaylet(interactionType: string): string {
  if (/sort|sequence|步骤|排序/.test(interactionType))
    return 'playlet-步骤排序';
  if (/path|maze|路径|迷宫/.test(interactionType)) return 'playlet-迷宫寻路';
  if (/match|card|配对/.test(interactionType)) return 'playlet-卡片配对';
  if (/drag|class|分类|分箱/.test(interactionType)) return 'playlet-拖拽分箱';
  if (/evidence|证据/.test(interactionType)) return 'playlet-证据配对';
  if (/review|wave|复习|错题/.test(interactionType)) return 'playlet-错题回炉';
  if (getPlayletTemplate(`playlet-${interactionType}`)) {
    return `playlet-${interactionType}`;
  }
  return 'playlet-单选判断';
}

function mapLessonUnit(
  unit: LessonUnit,
  goalIds: Map<string, string>,
  interactionsByLessonId: Map<string, InteractionSpec[]>,
  assessmentsByGoal: Map<string, AssessmentItem[]>,
  rules: (typeof TEMPLATE_RULES)[CourseArchetype],
): CourseContentJson['lessonUnits'][number] {
  const assessments = assessmentsByGoal.get(unit.learningGoal) ?? [];
  return {
    id: unit.id,
    goalId: requireGoalId(goalIds, unit.learningGoal),
    sceneKey: rules.lessonScene,
    concept: unit.concept,
    script: unit.explanationScript,
    workedExample: unit.interactionTask,
    misconceptions: [unit.feedbackStrategy],
    interactionIds: (interactionsByLessonId.get(unit.id) ?? []).map(
      (interaction) => interaction.id,
    ),
    assessmentItemIds:
      assessments.length > 0
        ? assessments.map((assessment) => assessment.id)
        : [unit.assessmentPointId],
  };
}

function mapInteraction(
  interaction: InteractionSpec,
  lessonUnits: LessonUnit[],
  goalIds: Map<string, string>,
  rules: (typeof TEMPLATE_RULES)[CourseArchetype],
): CourseContentJson['interactions'][number] {
  const lessonUnit = lessonUnits.find(
    (unit) => unit.id === interaction.lessonUnitId,
  );
  if (!lessonUnit) {
    throw new Error(
      `interactionSpec 引用的 lessonUnitId 不存在：${interaction.lessonUnitId}`,
    );
  }

  return {
    id: interaction.id,
    goalId: requireGoalId(goalIds, lessonUnit.learningGoal),
    sceneKey: rules.practiceScene,
    type: normalizeInteractionType(interaction.type),
    prompt: interaction.prompt,
    successFeedback: interaction.feedback.correct,
    failureFeedback: `${interaction.feedback.incorrect} ${interaction.feedback.hint}`,
  };
}

function mapAssessment(
  item: AssessmentItem,
  goalIds: Map<string, string>,
  rules: (typeof TEMPLATE_RULES)[CourseArchetype],
): CourseContentJson['assessments'][number] {
  return {
    id: item.id,
    goalId: requireGoalId(goalIds, item.learningGoal),
    sceneKey: rules.assessmentScene,
    question: item.prompt,
    options: normalizeAssessmentOptions(item),
    correctIndex: item.correctIndex ?? 0,
    explanation: item.explanation,
    misconceptionTag: item.misconceptionTag,
    hint: item.hint,
  };
}

function mapVideoTransitions(
  gdd: CourseGDD,
  rules: (typeof TEMPLATE_RULES)[CourseArchetype],
): CourseContentJson['videoTransitions'] {
  return (gdd.assetPlan.video ?? []).map((video, index) => ({
    key: video.key,
    targetScene: index === 0 ? rules.lessonScene : rules.practiceScene,
    description: video.description,
    optional: true,
    skipLabel: '跳过过场',
  }));
}

function normalizeAssessmentOptions(item: AssessmentItem): string[] {
  if (item.options && item.options.length > 0) {
    return item.options;
  }
  return [item.answer];
}

function normalizeInteractionType(type: string): string {
  if (/grid_sort|sort|sequence/.test(type)) return 'sequence';
  if (/grid_path|path/.test(type)) return 'path';
  if (/card_match|match/.test(type)) return 'match';
  if (/tower_review|review_wave|wave/.test(type)) return 'review_wave';
  return 'choice';
}

function buildMainSource(
  archetype: CourseArchetype,
  playletIds: string[] = [],
): string {
  const sceneImports = buildSceneImports(archetype, playletIds);
  const sceneRegistrations = uniqueSceneRegistrations([
    ...sceneKeysForArchetype(archetype).map((sceneKey) => ({
      key: sceneKey,
      symbol: sceneKey,
    })),
    ...playletIds.map((playletId, index) => ({
      key: buildPlayletSceneKey(playletId),
      symbol: buildPlayletSceneSymbol(index),
    })),
  ])
    .map(({ key, symbol }) => `game.scene.add('${key}', ${symbol});`)
    .join('\n');

  return `import Phaser from 'phaser';
import { screenSize, debugConfig, renderConfig } from './gameConfig.json';
import './styles/tailwind.css';
import { Preloader } from './scenes/Preloader';
import { TitleScreen } from './scenes/TitleScreen';
import UIScene from './scenes/UIScene';
import { PauseUIScene } from './scenes/PauseUIScene';
import { VictoryUIScene } from './scenes/VictoryUIScene';
import { GameCompleteUIScene } from './scenes/GameCompleteUIScene';
import { GameOverUIScene } from './scenes/GameOverUIScene';
${sceneImports}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: screenSize.width.value,
  height: screenSize.height.value,
  backgroundColor: '#172033',
  parent: 'game-container',
  dom: {
    createContainer: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      fps: 120,
      debug: debugConfig.debug.value,
      debugShowBody: debugConfig.debug.value,
      debugShowStaticBody: debugConfig.debug.value,
      debugShowVelocity: debugConfig.debug.value,
    },
  },
  pixelArt: renderConfig.pixelArt.value,
};

const game = new Phaser.Game(config);

game.scene.add('Preloader', Preloader, true);
game.scene.add('TitleScreen', TitleScreen);
${sceneRegistrations}
game.scene.add('UIScene', UIScene);
game.scene.add('PauseUIScene', PauseUIScene);
game.scene.add('VictoryUIScene', VictoryUIScene);
game.scene.add('GameCompleteUIScene', GameCompleteUIScene);
game.scene.add('GameOverUIScene', GameOverUIScene);
`;
}

function uniqueSceneRegistrations(
  registrations: Array<{ key: string; symbol: string }>,
): Array<{ key: string; symbol: string }> {
  const seen = new Set<string>();
  return registrations.filter((registration) => {
    if (seen.has(registration.key)) {
      return false;
    }
    seen.add(registration.key);
    return true;
  });
}

function buildSceneImports(
  archetype: CourseArchetype,
  playletIds: string[] = [],
): string {
  const workflowImports =
    "import { WorkflowEntryScene, GenericPlayletScene, CourseReportScene } from './course_runtime/CourseWorkflowScenes';";
  const playletImports = playletIds
    .map(
      (playletId) =>
        `import { PlayletScene as ${buildPlayletSceneSymbol(playletIds.indexOf(playletId))} } from './playlets/${playletId}';`,
    )
    .join('\n');
  if (archetype === 'course_grid') {
    return `${workflowImports}
${playletImports}
import { GridLessonScene, GridPracticeScene } from './scenes/CourseGridScenes';`;
  }
  if (archetype === 'course_td') {
    return `${workflowImports}
${playletImports}
import { ReviewPrepScene, ReviewWaveScene } from './scenes/CourseTDScenes';`;
  }
  return `${workflowImports}
${playletImports}
import { LessonScene, PracticeScene, BattleScene } from './scenes/CourseUIScenes';`;
}

function buildLevelManagerSource(archetype: CourseArchetype): string {
  const sceneKeys = sceneKeysForArchetype(archetype)
    .map((sceneKey) => `'${sceneKey}'`)
    .join(', ');

  return `export class LevelManager {
  static readonly LEVEL_ORDER: string[] = [${sceneKeys}];

  static getNextLevelScene(currentSceneKey: string): string | null {
    const currentIndex = LevelManager.LEVEL_ORDER.indexOf(currentSceneKey);
    if (
      currentIndex === -1 ||
      currentIndex >= LevelManager.LEVEL_ORDER.length - 1
    ) {
      return null;
    }
    return LevelManager.LEVEL_ORDER[currentIndex + 1];
  }

  static isLastLevel(currentSceneKey: string): boolean {
    return (
      LevelManager.LEVEL_ORDER.indexOf(currentSceneKey) ===
      LevelManager.LEVEL_ORDER.length - 1
    );
  }

  static getFirstLevelScene(): string | null {
    return LevelManager.LEVEL_ORDER[0] ?? null;
  }

  static getLevelNumber(currentSceneKey: string): number {
    const index = LevelManager.LEVEL_ORDER.indexOf(currentSceneKey);
    return index >= 0 ? index + 1 : 0;
  }

  static getTotalLevels(): number {
    return LevelManager.LEVEL_ORDER.length;
  }

  static isLevelScene(sceneKey: string): boolean {
    return LevelManager.LEVEL_ORDER.includes(sceneKey);
  }
}
`;
}

function sceneKeysForArchetype(archetype: CourseArchetype): string[] {
  const rules = TEMPLATE_RULES[archetype];
  return [
    ...new Set([
      'WorkflowEntryScene',
      'GenericPlayletScene',
      'CourseReportScene',
      rules.lessonScene,
      rules.practiceScene,
      rules.assessmentScene,
    ]),
  ];
}

function normalizeSceneKey(scene: string, fallback: string): string {
  return scene.trim() || fallback;
}

function buildPlayletSceneKey(playletId: string): string {
  return `${playletId
    .replace(/^playlet-/, '')
    .replace(/[^a-zA-Z0-9\u4E00-\u9FFF]+/g, '-')
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('')}PlayletScene`;
}

function buildPlayletSceneSymbol(index: number): string {
  return `WorkflowPlayletScene${index + 1}`;
}

function requireGoalId(goalIds: Map<string, string>, goal: string): string {
  const id = goalIds.get(goal);
  if (!id) {
    throw new Error(
      `Course GDD 引用了 CourseSpec.learningGoals 之外的目标：${goal}`,
    );
  }
  return id;
}

function groupBy<T>(
  values: T[],
  getKey: (value: T) => string,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const value of values) {
    const key = getKey(value);
    grouped.set(key, [...(grouped.get(key) ?? []), value]);
  }
  return grouped;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function buildCourseId(gdd: CourseGDD): string {
  const raw = `${gdd.courseSpec.subject}-${gdd.courseSpec.topic}`;
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'course-game';
}

function normalizeOutputDir(outputDir: string): string {
  return outputDir.replace(/\/+$/g, '') || '.';
}

function isReviewOrPracticePlan(gdd: CourseGDD): boolean {
  const text = [
    gdd.selectedPlan.title,
    gdd.selectedPlan.gameplayType,
    ...gdd.selectedPlan.learningLoop,
    ...gdd.lessonUnits.map((unit) => unit.interactionTask),
  ].join('');
  return /复习|巩固|review|practice|波次|策略/i.test(text);
}
