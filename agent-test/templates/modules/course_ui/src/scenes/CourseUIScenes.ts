import Phaser from 'phaser';
import {
  courseContent,
  type CourseAssessmentItem,
  type CourseInteraction,
  type CourseLessonUnit,
  getVideoTransitionForScene,
} from '../courseContent';
import {
  BaseChapterScene,
  type ChoiceOption,
  type DialogueEntry,
} from './BaseChapterScene';
import { LessonProgressManager } from '../systems/LessonProgressManager';
import { HintManager } from '../systems/HintManager';
import { LearningReportManager } from '../systems/LearningReportManager';
import { playOptionalVideoTransition } from '../systems/VideoTransitionManager';

const progressManager = new LessonProgressManager(courseContent);
const hintManager = new HintManager(courseContent);
const reportManager = new LearningReportManager(courseContent);

export class LessonScene extends BaseChapterScene {
  constructor() {
    super({ key: 'LessonScene' });
  }

  protected override initializeDialogues(): DialogueEntry[] {
    const units = getUnitsForScene('LessonScene');
    return units.flatMap((unit) => [
      {
        type: 'text',
        speaker: '导师',
        text: `${unit.concept}：${unit.script}`,
      },
      {
        type: 'text',
        speaker: '导师',
        text: `例题：${unit.workedExample}`,
      },
    ]);
  }

  protected override createBackground(): void {
    createCourseBackground(this, 0x17324d, '课程讲解');
  }

  protected override createUI(): void {
    createCourseHeader(this, '课程讲解', courseContent.course.title);
  }

  protected override initializeScene(): void {
    updateCourseRuntimeStatus('lesson', 'LessonScene', courseContent.course.id);
    for (const unit of getUnitsForScene('LessonScene')) {
      progressManager.startGoal(unit.goalId);
      progressManager.completeLessonUnit(unit);
    }
    playOptionalVideoTransition(
      this,
      getVideoTransitionForScene('LessonScene'),
      () => undefined,
    );
  }

  protected override onChapterComplete(): void {
    this.scene.start('PracticeScene');
  }
}

export class PracticeScene extends BaseChapterScene {
  constructor() {
    super({ key: 'PracticeScene' });
  }

  protected override initializeDialogues(): DialogueEntry[] {
    return getInteractionsForScene('PracticeScene').map((interaction) => ({
      type: 'choice',
      id: interaction.id,
      prompt: interaction.prompt,
      options: [
        {
          text: '我能说明理由',
          effects: { courseCorrect: 1 } as Record<string, number>,
        },
        {
          text: '我还需要提示',
          effects: { courseHint: 1 } as Record<string, number>,
        },
      ],
    }));
  }

  protected override createBackground(): void {
    createCourseBackground(this, 0x244c3a, '互动练习');
  }

  protected override createUI(): void {
    updateCourseRuntimeStatus(
      'practice',
      'PracticeScene',
      courseContent.course.id,
    );
    createCourseHeader(this, '互动练习', courseContent.course.topic);
  }

  protected override onChoiceMade(
    choiceId: string,
    option: ChoiceOption,
  ): void {
    const interaction = courseContent.interactions.find(
      (item) => item.id === choiceId,
    );
    if (!interaction) return;
    progressManager.completeInteraction(interaction);
    const feedback =
      option.effects?.courseCorrect === 1
        ? interaction.successFeedback
        : interaction.failureFeedback;
    createFeedbackText(this, feedback);
  }

  protected override onChapterComplete(): void {
    this.scene.start('BattleScene');
  }
}

export class BattleScene extends BaseChapterScene {
  constructor() {
    super({ key: 'BattleScene' });
  }

  protected override initializeDialogues(): DialogueEntry[] {
    return getAssessmentsForScene('BattleScene').map((assessment) => ({
      type: 'choice',
      id: assessment.id,
      prompt: assessment.question,
      options: assessment.options.map((text) => ({ text })),
    }));
  }

  protected override createBackground(): void {
    createCourseBackground(this, 0x3b2f63, '学习评价');
  }

  protected override createUI(): void {
    updateCourseRuntimeStatus(
      'assessment',
      'BattleScene',
      courseContent.course.id,
    );
    createCourseHeader(this, '学习评价', '完成题目后生成学习报告');
  }

  protected override onChoiceMade(
    choiceId: string,
    option: ChoiceOption,
  ): void {
    const assessment = courseContent.assessments.find(
      (item) => item.id === choiceId,
    );
    if (!assessment) return;
    const selectedIndex = assessment.options.indexOf(option.text);
    const correct = selectedIndex === assessment.correctIndex;
    progressManager.completeAssessment(assessment, correct);
    if (!correct) {
      hintManager.getHintForAssessment(assessment);
    }
    createFeedbackText(
      this,
      correct
        ? assessment.explanation
        : hintManager.getFailureFeedback(assessment),
    );
  }

  protected override onChapterComplete(): void {
    renderLearningReport(this);
  }
}

function getUnitsForScene(sceneKey: string): CourseLessonUnit[] {
  return courseContent.lessonUnits.filter((unit) => unit.sceneKey === sceneKey);
}

function getInteractionsForScene(sceneKey: string): CourseInteraction[] {
  return courseContent.interactions.filter(
    (interaction) => interaction.sceneKey === sceneKey,
  );
}

function getAssessmentsForScene(sceneKey: string): CourseAssessmentItem[] {
  return courseContent.assessments.filter(
    (assessment) => assessment.sceneKey === sceneKey,
  );
}

function createCourseBackground(
  scene: Phaser.Scene,
  color: number,
  label: string,
): void {
  const cam = scene.cameras.main;
  scene.add.rectangle(
    cam.width / 2,
    cam.height / 2,
    cam.width,
    cam.height,
    color,
  );
  scene.add
    .text(cam.width / 2, 74, label, {
      fontSize: '30px',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    .setOrigin(0.5);
}

function createCourseHeader(
  scene: Phaser.Scene,
  title: string,
  subtitle: string,
): void {
  scene.add
    .text(32, 28, `${title} | ${subtitle}`, {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#f8fafc',
      wordWrap: { width: scene.cameras.main.width - 64 },
    })
    .setDepth(80);
}

function createFeedbackText(scene: Phaser.Scene, text: string): void {
  const cam = scene.cameras.main;
  scene.add
    .text(cam.width / 2, 155, text, {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#fde68a',
      align: 'center',
      wordWrap: { width: Math.min(760, cam.width - 80) },
    })
    .setOrigin(0.5)
    .setDepth(120);
}

function renderLearningReport(scene: Phaser.Scene): void {
  updateCourseRuntimeStatus('report', scene.scene.key, courseContent.course.id);
  const report = reportManager.buildReport(
    progressManager.getAllProgress(),
    hintManager.getUsage(),
  );
  const cam = scene.cameras.main;
  scene.children.removeAll();
  createCourseBackground(scene, 0x102a43, '学习报告');
  scene.add
    .text(
      cam.width / 2,
      cam.height / 2,
      [
        `课程：${report.title}`,
        `已完成目标：${report.completedGoals}/${report.totalGoals}`,
        `正确率：${Math.round(report.accuracy * 100)}%`,
        `提示使用：${report.hintUsageCount} 次`,
      ].join('\n'),
      {
        fontSize: '28px',
        fontFamily: 'Arial',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 12,
      },
    )
    .setOrigin(0.5);
}

function updateCourseRuntimeStatus(
  stage: string,
  sceneKey: string,
  detail: string,
): void {
  const doc = globalThis.document;
  if (!doc) return;
  let status = doc.querySelector<HTMLElement>('[data-course-runtime-status]');
  if (!status) {
    status = doc.createElement('div');
    status.setAttribute('data-course-runtime-status', 'true');
    status.style.display = 'none';
    doc.body.appendChild(status);
  }
  status.setAttribute('data-stage', stage);
  status.setAttribute('data-scene', sceneKey);
  status.textContent = detail;
}
