/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runCourseBrowserSmoke } from './helpers/courseBrowserSmoke.js';

type CourseArchetype = 'course_ui' | 'course_grid' | 'course_td';

interface CourseSpec {
  subject: string;
  topic: string;
  learningGoals: string[];
  durationMinutes: number;
  studentProfile: {
    grade: 1 | 2 | 3 | 4 | 5 | 6;
    age?: number;
    readingLevel?: 'low' | 'medium' | 'high';
    interests: string[];
    weakPoints?: string[];
    preferredInteraction?: string[];
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
    depthLevel: 'intro' | 'standard' | 'deep' | 'challenge';
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

interface CoursePlanOption {
  id: string;
  title: string;
  courseArchetype: CourseArchetype;
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

interface CourseGDD {
  courseSpec: CourseSpec;
  selectedPlan: CoursePlanOption;
  lessonUnits: Array<{
    id: string;
    learningGoal: string;
    concept: string;
    explanationScript: string;
    interactionTask: string;
    feedbackStrategy: string;
    assessmentPointId: string;
  }>;
  interactionSpecs: Array<{
    id: string;
    lessonUnitId: string;
    type: string;
    prompt: string;
    expectedAction: string;
    feedback: {
      correct: string;
      incorrect: string;
      misconceptionTag: string;
      hint: string;
    };
  }>;
  assessmentSpec: {
    items: Array<{
      id: string;
      learningGoal: string;
      prompt: string;
      options: string[];
      correctIndex: number;
      answer: string;
      explanation: string;
      misconceptionTag: string;
      hint: string;
    }>;
    masteryCriteria: string[];
  };
  assetPlan: {
    images: Array<{ key: string; description: string }>;
    audio: Array<{
      key: string;
      description: string;
      audioType: 'bgm' | 'sfx';
    }>;
  };
  narrationPlan: {
    segments: Array<{
      id: string;
      name: string;
      text: string;
      targetScene: string;
    }>;
  };
  validationPlan: {
    requiredChecks: string[];
    browserFlow: string[];
    fallbackChecks: string[];
  };
}

interface CourseContentJson {
  course: {
    archetype: CourseArchetype;
  };
  learningGoals: Array<{ id: string; text: string }>;
  lessonUnits: Array<{ id: string; goalId: string; sceneKey: string }>;
  interactions: Array<{ id: string; goalId: string; sceneKey: string }>;
  assessments: Array<{
    id: string;
    goalId: string;
    sceneKey: string;
    hint: string;
    misconceptionTag: string;
  }>;
  report: { metrics: string[] };
  templateRules: { reviewOnly: boolean };
}

interface CourseTemplateCopyInstruction {
  from: string;
  to: string;
  mode: 'copy_recursive' | 'copy_file' | 'write_json';
}

interface CourseScaffoldPlan {
  archetype: CourseArchetype;
  copyInstructions: CourseTemplateCopyInstruction[];
  writeFiles: Array<{ path: string; content: CourseContentJson | string }>;
  nextTools: string[];
}

interface CourseRuntime {
  mapCourseGddToOpenGameScaffold: (
    gdd: CourseGDD,
    options?: { outputDir?: string; courseId?: string },
  ) => CourseScaffoldPlan;
  validateCourseGdd: (input: CourseGDD) => {
    valid: boolean;
    errors: Array<{ path: string; message: string }>;
  };
  validateCourseSpec: (input: CourseSpec) => {
    valid: boolean;
    errors: Array<{ path: string; message: string }>;
  };
  validateCoursePackage: (
    config: { getProjectRoot: () => string },
    params: { packageDir: string; courseGdd: CourseGDD },
  ) => Promise<{
    passed: boolean;
    issues: Array<{ severity: string; code: string }>;
  }>;
}

interface GoalProgress {
  completedUnits: Set<string>;
  completedInteractions: Set<string>;
  completedAssessments: Set<string>;
  correctAssessments: Set<string>;
}

interface CourseFixture {
  id: string;
  title: string;
  expectedArchetype: CourseArchetype;
  courseSpec: CourseSpec;
}

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const fixturesDir = path.join(repoRoot, 'agent-test/course-fixtures');
let runtimePromise: Promise<CourseRuntime> | undefined;

describe('课程生成端到端基准', () => {
  it('覆盖 5 个跨学科 CourseSpec fixture 并满足课程深度校验', async () => {
    const fixtures = await loadCourseFixtures();

    expect(fixtures.map((fixture) => fixture.id)).toEqual([
      'grade1-chinese-word-match',
      'grade3-math-area-perimeter',
      'grade4-english-listening-dialogue',
      'grade5-science-circuit',
      'grade6-math-ratio-fraction',
    ]);

    const subjects = new Set(
      fixtures.map((fixture) => fixture.courseSpec.subject),
    );
    expect(subjects).toEqual(new Set(['语文', '数学', '英语', '科学']));

    for (const fixture of fixtures) {
      const runtime = await loadCourseRuntime();
      const result = runtime.validateCourseSpec(fixture.courseSpec);
      expect(result.errors, `${fixture.id} CourseSpec 不应有校验错误`).toEqual(
        [],
      );
      expect(result.valid).toBe(true);
      expect(fixture.courseSpec.learningGoals.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('把 5 个基准 Course GDD 映射为课程包并通过发布前验证', async () => {
    const fixtures = await loadCourseFixtures();

    for (const fixture of fixtures) {
      const runtime = await loadCourseRuntime();
      const gdd = buildBenchmarkCourseGdd(fixture);
      const gddValidation = runtime.validateCourseGdd(gdd);
      expect(
        gddValidation.errors,
        `${fixture.id} CourseGDD 不应有校验错误`,
      ).toEqual([]);

      const scaffold = runtime.mapCourseGddToOpenGameScaffold(gdd, {
        outputDir: '.',
        courseId: fixture.id,
      });
      expect(scaffold.archetype).toBe(fixture.expectedArchetype);
      expect(JSON.stringify(scaffold.copyInstructions)).not.toContain(
        'modules/ui_heavy',
      );
      expect(scaffold.nextTools).toEqual([
        'generate_game_assets',
        'course_tts_manifest',
        'validate_course_package',
      ]);

      const packageDir = await assembleCoursePackage(fixture.id, gdd);
      const report = await runtime.validateCoursePackage(
        { getProjectRoot: () => repoRoot },
        {
          packageDir,
          courseGdd: gdd,
        },
      );

      expect(
        report.issues.filter((issue) => issue.severity === 'error'),
        `${fixture.id} 课程包不应有阻断错误`,
      ).toEqual([]);
      expect(report.passed).toBe(true);
      expect(
        report.issues.some(
          (issue) => issue.code === 'narration_subtitle_fallback',
        ),
      ).toBe(true);

      const courseContent = getCourseContent(scaffold);
      expect(courseContent?.templateRules.reviewOnly).toBe(
        fixture.expectedArchetype === 'course_td',
      );
      expect(courseContent?.learningGoals).toHaveLength(
        fixture.courseSpec.learningGoals.length,
      );
      expect(courseContent?.report.metrics).toContain('completedGoals');
    }
  });

  it('课程 UI 模板的首轮互动能生成学习报告', async () => {
    const fixture = (await loadCourseFixtures()).find(
      (item) => item.expectedArchetype === 'course_ui',
    );
    expect(fixture).toBeDefined();
    const runtime = await loadCourseRuntime();
    const gdd = buildBenchmarkCourseGdd(fixture!);
    const content = runtime.mapCourseGddToOpenGameScaffold(gdd, {
      courseId: fixture!.id,
    });
    const courseContent = getCourseContent(content);

    const progressByGoal = new Map<string, GoalProgress>(
      courseContent.learningGoals.map((goal) => [
        goal.id,
        {
          completedUnits: new Set<string>(),
          completedInteractions: new Set<string>(),
          completedAssessments: new Set<string>(),
          correctAssessments: new Set<string>(),
        },
      ]),
    );

    for (const unit of courseContent.lessonUnits) {
      progressByGoal.get(unit.goalId)?.completedUnits.add(unit.id);
    }
    for (const interaction of courseContent.interactions) {
      progressByGoal
        .get(interaction.goalId)
        ?.completedInteractions.add(interaction.id);
    }
    for (const assessment of courseContent.assessments) {
      const progress = progressByGoal.get(assessment.goalId);
      progress?.completedAssessments.add(assessment.id);
      progress?.correctAssessments.add(assessment.id);
    }

    const completedGoals = [...progressByGoal.values()].filter((progress) => {
      return (
        progress.completedUnits.size > 0 &&
        progress.completedInteractions.size > 0 &&
        progress.completedAssessments.size > 0
      );
    }).length;
    const totalAnswers = [...progressByGoal.values()].reduce(
      (sum, progress) => sum + progress.completedAssessments.size,
      0,
    );
    const correctAnswers = [...progressByGoal.values()].reduce(
      (sum, progress) => sum + progress.correctAssessments.size,
      0,
    );

    expect(completedGoals).toBe(courseContent.learningGoals.length);
    expect(correctAnswers / totalAnswers).toBe(1);
    expect(courseContent.assessments[0]!.hint).toContain('先');
    expect(courseContent.assessments[0]!.misconceptionTag).toBeTruthy();
  });

  it('课程模板可在浏览器 smoke 中走到学习报告', async () => {
    const fixtures = await loadCourseFixtures();
    const representativeFixtures = uniqueByArchetype(fixtures);
    const results: string[] = [];

    for (const fixture of representativeFixtures) {
      const gdd = buildBenchmarkCourseGdd(fixture);
      const packageDir = await assembleCoursePackage(fixture.id, gdd);
      const result = await runCourseBrowserSmoke({
        packageDir,
        repoRoot,
        archetype: fixture.expectedArchetype,
      });

      if (result.status === 'passed') {
        expect(result.finalStatus.stage).toBe('report');
        results.push(`${fixture.id}: passed`);
        continue;
      }

      if (
        result.status === 'skipped' &&
        process.env['OPENGAME_REQUIRE_COURSE_BROWSER_SMOKE'] !== 'true'
      ) {
        results.push(`${fixture.id}: skipped - ${result.reason}`);
        continue;
      }

      const reason = result.status === 'failed' ? result.reason : result.reason;
      throw new Error(`${fixture.id} 浏览器 smoke 未通过：${reason}`);
    }

    expect(results).toHaveLength(representativeFixtures.length);
  });
});

function uniqueByArchetype(fixtures: CourseFixture[]): CourseFixture[] {
  const seen = new Set<CourseArchetype>();
  const result: CourseFixture[] = [];
  for (const fixture of fixtures) {
    if (seen.has(fixture.expectedArchetype)) continue;
    seen.add(fixture.expectedArchetype);
    result.push(fixture);
  }
  return result;
}

function getCourseContent(scaffold: CourseScaffoldPlan): CourseContentJson {
  const file = scaffold.writeFiles.find((item) =>
    item.path.endsWith('src/courseContent.json'),
  );
  if (!file || typeof file.content === 'string') {
    throw new Error('scaffold 缺少 courseContent.json 对象输出。');
  }
  return file.content;
}

async function loadCourseFixtures(): Promise<CourseFixture[]> {
  const entries = (await fs.readdir(fixturesDir))
    .filter((file) => file.endsWith('.json'))
    .sort();
  return Promise.all(
    entries.map(async (file) => {
      const content = await fs.readFile(path.join(fixturesDir, file), 'utf-8');
      return JSON.parse(content) as CourseFixture;
    }),
  );
}

async function loadCourseRuntime(): Promise<CourseRuntime> {
  runtimePromise ??= Promise.all([
    importModule('packages/core/src/course/courseGddMapper.ts'),
    importModule('packages/core/src/course/validation.ts'),
    importModule('packages/core/src/tools/validate-course-package.ts'),
  ]).then(([mapper, validation, packageValidation]) => ({
    mapCourseGddToOpenGameScaffold:
      mapper.mapCourseGddToOpenGameScaffold as CourseRuntime['mapCourseGddToOpenGameScaffold'],
    validateCourseGdd:
      validation.validateCourseGdd as CourseRuntime['validateCourseGdd'],
    validateCourseSpec:
      validation.validateCourseSpec as CourseRuntime['validateCourseSpec'],
    validateCoursePackage:
      packageValidation.validateCoursePackage as CourseRuntime['validateCoursePackage'],
  }));
  return runtimePromise;
}

async function importModule(
  relativePath: string,
): Promise<Record<string, unknown>> {
  return import(
    pathToFileURL(path.join(repoRoot, relativePath)).href
  ) as Promise<Record<string, unknown>>;
}

function buildBenchmarkCourseGdd(fixture: CourseFixture): CourseGDD {
  const spec = fixture.courseSpec;
  const sceneKeys = sceneKeysForArchetype(fixture.expectedArchetype);
  const plan = buildPlan(fixture, sceneKeys);
  const lessonUnits = spec.learningGoals.map((goal, index) => {
    const concept =
      spec.explanationDepth.conceptLayers[index]?.concept ??
      spec.explanationDepth.conceptLayers[0]!.concept;
    return {
      id: `lesson_${index + 1}`,
      learningGoal: goal,
      concept,
      explanationScript: buildExplanationScript(spec, goal, concept),
      interactionTask: buildInteractionTask(spec, goal),
      feedbackStrategy:
        '正确时说明关键依据；错误时标记错因类型，并提示学生回到概念层重新观察下一步。',
      assessmentPointId: `assessment_${index + 1}`,
    };
  });

  return {
    courseSpec: spec,
    selectedPlan: plan,
    lessonUnits,
    interactionSpecs: lessonUnits.map((unit, index) => ({
      id: `interaction_${index + 1}`,
      lessonUnitId: unit.id,
      type:
        fixture.expectedArchetype === 'course_grid'
          ? 'grid_sort'
          : fixture.expectedArchetype === 'course_td'
            ? 'review_choice'
            : 'choice',
      prompt: `完成「${unit.learningGoal}」的第一轮互动任务。`,
      expectedAction: '学生先观察提示，再选择或排序到正确答案。',
      feedback: {
        correct: `你已经抓住「${unit.concept}」的关键依据。`,
        incorrect: `这一步容易混淆「${unit.concept}」的判断依据。`,
        misconceptionTag: `misconception_${index + 1}`,
        hint: '先回到讲解里的关键概念，再比较选项之间的差别。',
      },
    })),
    assessmentSpec: {
      items: lessonUnits.map((unit, index) => ({
        id: `assessment_${index + 1}`,
        learningGoal: unit.learningGoal,
        prompt: `下面哪一项最能说明「${unit.learningGoal}」？`,
        options: ['抓住关键概念并说明理由', '只记住一个孤立答案'],
        correctIndex: 0,
        answer: '抓住关键概念并说明理由。',
        explanation: `正确答案需要先识别「${unit.concept}」，再把它应用到题目情境中，所以不能只记孤立答案。`,
        misconceptionTag: `misconception_${index + 1}`,
        hint: '先找题目中的关键词，再对应讲解中的概念层。',
      })),
      masteryCriteria:
        spec.explanationDepth.depthLevel === 'challenge'
          ? ['能完成开放迁移任务', '能反思复盘不同解法']
          : spec.explanationDepth.depthLevel === 'deep'
            ? ['能解释关键概念', '能完成迁移应用']
            : ['能完成讲解互动', '能说出判断理由'],
    },
    assetPlan: {
      images: [
        {
          key: `${fixture.id}_background`,
          description: `${spec.styleSpec.theme} 背景图`,
        },
      ],
      audio: [
        {
          key: `${fixture.id}_correct_sfx`,
          description: '答对提示音',
          audioType: 'sfx',
        },
      ],
    },
    narrationPlan: {
      segments: lessonUnits.map((unit, index) => ({
        id: unit.id,
        name: `${unit.concept}讲解`,
        text: unit.explanationScript,
        targetScene: index === 0 ? sceneKeys.lesson : sceneKeys.practice,
      })),
    },
    validationPlan: {
      requiredChecks: [
        'schema 合法',
        '学习目标闭环',
        '讲解深度',
        '互动反馈',
        '评价解析',
        ...(spec.explanationDepth.depthLevel === 'deep' ||
        spec.explanationDepth.depthLevel === 'challenge'
          ? ['迁移应用或反思复盘']
          : []),
      ],
      browserFlow: ['进入首场景', '完成第一轮互动', '看到反馈', '生成学习报告'],
      fallbackChecks: ['TTS 失败显示字幕', '视频关闭不阻断流程'],
    },
  };
}

function buildPlan(
  fixture: CourseFixture,
  sceneKeys: ReturnType<typeof sceneKeysForArchetype>,
): CoursePlanOption {
  const spec = fixture.courseSpec;
  return {
    id: 'balanced',
    title: fixture.title,
    courseArchetype: fixture.expectedArchetype,
    gameplayType:
      fixture.expectedArchetype === 'course_td'
        ? '复习波次'
        : fixture.expectedArchetype === 'course_grid'
          ? '网格推理'
          : '对话选择',
    learningLoop: ['讲解', '示例', '互动练习', '反馈', '评价'],
    scenePlan: [sceneKeys.lesson, sceneKeys.practice, sceneKeys.assessment],
    assessmentPoints: [...spec.learningGoals],
    assetComplexity:
      spec.explanationDepth.depthLevel === 'challenge' ? 'medium' : 'low',
    score: {
      learningFit: 88,
      explanationDepthFit:
        spec.explanationDepth.depthLevel === 'intro' ? 78 : 86,
      fun: 80,
      ageFit: 90,
      implementationStability: 88,
      cost: 84,
      safety: 95,
    },
    recommendationReason: '该模板能稳定承载讲解、互动、反馈和评价闭环。',
    risks: ['需要控制单轮互动数量，避免超出学生注意力范围。'],
  };
}

function sceneKeysForArchetype(archetype: CourseArchetype): {
  lesson: string;
  practice: string;
  assessment: string;
} {
  if (archetype === 'course_grid') {
    return {
      lesson: 'GridLessonScene',
      practice: 'GridPracticeScene',
      assessment: 'GridPracticeScene',
    };
  }
  if (archetype === 'course_td') {
    return {
      lesson: 'ReviewPrepScene',
      practice: 'ReviewWaveScene',
      assessment: 'ReviewWaveScene',
    };
  }
  return {
    lesson: 'LessonScene',
    practice: 'PracticeScene',
    assessment: 'BattleScene',
  };
}

function buildExplanationScript(
  spec: CourseSpec,
  goal: string,
  concept: string,
): string {
  const transfer =
    spec.explanationDepth.depthLevel === 'deep' ||
    spec.explanationDepth.depthLevel === 'challenge'
      ? '最后把这个方法迁移到一个新情境中，并复盘为什么这一步能帮助判断。'
      : '再用一个短例题把概念应用到题目中。';
  return `学习目标是「${goal}」。先观察「${concept}」的关键特征，再比较常见误区和正确依据。${transfer}`;
}

function buildInteractionTask(spec: CourseSpec, goal: string): string {
  const transfer =
    spec.explanationDepth.depthLevel === 'deep' ||
    spec.explanationDepth.depthLevel === 'challenge'
      ? '并完成一次迁移应用或反思复盘'
      : '并说明选择理由';
  return `围绕「${goal}」完成第一轮互动练习，${transfer}。`;
}

async function assembleCoursePackage(
  fixtureId: string,
  gdd: CourseGDD,
): Promise<string> {
  const runtime = await loadCourseRuntime();
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), `opengame-course-${fixtureId}-`),
  );
  const scaffold = runtime.mapCourseGddToOpenGameScaffold(gdd, {
    outputDir: '.',
    courseId: fixtureId,
  });
  await applyCopyInstructions(tempRoot, scaffold);
  await writeSmokePostcssFallback(tempRoot);
  await writeScaffoldFiles(tempRoot, scaffold);
  await writeAssetPack(tempRoot, gdd);
  await writeNarrationManifest(tempRoot, gdd);
  return tempRoot;
}

async function applyCopyInstructions(
  packageDir: string,
  scaffold: CourseScaffoldPlan,
): Promise<void> {
  for (const instruction of scaffold.copyInstructions) {
    if (instruction.mode !== 'copy_recursive') continue;
    const source = resolveTemplateGlob(instruction.from);
    const target = path.join(packageDir, normalizeScaffoldPath(instruction.to));
    await copyDir(source, target);
  }
}

function resolveTemplateGlob(from: string): string {
  const normalized = from.endsWith('/*') ? from.slice(0, -2) : from;
  return path.join(repoRoot, normalized);
}

function normalizeScaffoldPath(scaffoldPath: string): string {
  return scaffoldPath.replace(/^\.\//, '').replace(/\/$/, '');
}

async function writeSmokePostcssFallback(packageDir: string): Promise<void> {
  await fs.writeFile(
    path.join(packageDir, 'postcss.config.js'),
    'export default { plugins: {} };\n',
  );
}

async function writeScaffoldFiles(
  packageDir: string,
  scaffold: CourseScaffoldPlan,
): Promise<void> {
  await Promise.all(
    scaffold.writeFiles.map(async (file) => {
      const relativePath = file.path.replace(/^\.\//, '');
      const target = path.join(packageDir, relativePath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      const content =
        typeof file.content === 'string'
          ? file.content
          : JSON.stringify(file.content, null, 2);
      await fs.writeFile(target, content);
    }),
  );
}

async function writeAssetPack(
  packageDir: string,
  gdd: CourseGDD,
): Promise<void> {
  const assetDir = path.join(packageDir, 'public/assets');
  await fs.mkdir(assetDir, { recursive: true });
  const files = [
    ...gdd.assetPlan.images.map((asset) => ({
      key: asset.key,
      url: `assets/${asset.key}.png`,
      type: 'image',
    })),
    ...gdd.assetPlan.audio.map((asset) => ({
      key: asset.key,
      url: `assets/${asset.key}.mp3`,
      type: asset.audioType,
    })),
    ...(gdd.selectedPlan.courseArchetype === 'course_td'
      ? [
          {
            key: 'tower_bullet',
            url: 'assets/tower_bullet.png',
            type: 'image',
          },
        ]
      : []),
    ...(gdd.selectedPlan.courseArchetype === 'course_ui'
      ? [
          {
            key: '__DEFAULT',
            url: 'assets/default-character.png',
            type: 'image',
          },
        ]
      : []),
    ...(gdd.selectedPlan.courseArchetype === 'course_grid'
      ? [
          {
            key: 'level1_bg',
            url: 'assets/level1_bg.png',
            type: 'image',
          },
        ]
      : []),
  ];
  await fs.writeFile(
    path.join(assetDir, 'asset-pack.json'),
    JSON.stringify({ files }, null, 2),
  );
  await Promise.all(
    files.map(async (file) => {
      const target = path.join(packageDir, 'public', file.url);
      await fs.mkdir(path.dirname(target), { recursive: true });
      if (file.type === 'image') {
        await fs.writeFile(target, ONE_PIXEL_PNG);
      } else {
        await fs.writeFile(target, EMPTY_MP3);
      }
    }),
  );
}

async function writeNarrationManifest(
  packageDir: string,
  gdd: CourseGDD,
): Promise<void> {
  const narrationDir = path.join(packageDir, 'public/assets/narration');
  await fs.mkdir(narrationDir, { recursive: true });
  const manifest = {
    courseId: gdd.selectedPlan.id,
    fallbackMode: 'subtitle_only',
    segments: gdd.narrationPlan.segments.map((segment) => ({
      id: segment.id,
      name: segment.name,
      text: segment.text,
      targetScene: segment.targetScene,
      status: 'fallback_subtitle',
      fallbackSubtitle: segment.text,
    })),
  };
  await fs.writeFile(
    path.join(narrationDir, 'narration-manifest.json'),
    JSON.stringify(manifest, null, 2),
  );
}

async function copyDir(from: string, to: string): Promise<void> {
  await fs.mkdir(to, { recursive: true });
  const entries = await fs.readdir(from, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const source = path.join(from, entry.name);
      const target = path.join(to, entry.name);
      if (entry.isDirectory()) {
        await copyDir(source, target);
      } else if (entry.isFile()) {
        await fs.copyFile(source, target);
      }
    }),
  );
}

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lV8fWQAAAABJRU5ErkJggg==',
  'base64',
);

const EMPTY_MP3 = Buffer.from(
  'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjQ1LjEwMAAAAAAAAAAAAAAA//tQxAADBQAA',
  'base64',
);
