import Phaser from 'phaser';
import {
  courseContent,
  type CourseAssessmentItem,
  type CourseInteraction,
  type CourseLessonUnit,
  getVideoTransitionForScene,
} from '../courseContent';
import { TaskObjectiveManager } from '../systems/TaskObjectiveManager';
import { StepFeedbackManager } from '../systems/StepFeedbackManager';
import { playOptionalVideoTransition } from '../systems/VideoTransitionManager';

const objectiveManager = new TaskObjectiveManager(courseContent);
const feedbackManager = new StepFeedbackManager(courseContent);

export class GridLessonScene extends Phaser.Scene {
  constructor() {
    super('GridLessonScene');
  }

  create(): void {
    updateCourseRuntimeStatus(
      'lesson',
      'GridLessonScene',
      courseContent.course.id,
    );
    createGridBackground(this, 0x12344d, '网格讲解');
    const units = getUnitsForScene('GridLessonScene');
    createTextPanel(
      this,
      units
        .map(
          (unit) =>
            `${unit.concept}\n${unit.script}\n例题：${unit.workedExample}`,
        )
        .join('\n\n'),
    );
    createActionButton(this, '进入网格练习', () => {
      this.scene.start('GridPracticeScene');
    });
    playOptionalVideoTransition(
      this,
      getVideoTransitionForScene('GridLessonScene'),
      () => undefined,
    );
  }
}

export class GridPracticeScene extends Phaser.Scene {
  private completedAssessments = new Set<string>();
  private correctAssessments = new Set<string>();
  private feedbackText?: Phaser.GameObjects.Text;

  constructor() {
    super('GridPracticeScene');
  }

  create(): void {
    updateCourseRuntimeStatus(
      'practice',
      'GridPracticeScene',
      courseContent.course.id,
    );
    createGridBackground(this, 0x183d36, '网格练习');
    this.drawBoard();
    this.createObjectives();
    this.createAssessments();
  }

  private drawBoard(): void {
    const startX = 220;
    const startY = 150;
    const size = 70;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        this.add
          .rectangle(startX + col * size, startY + row * size, 58, 58, 0x2dd4bf)
          .setStrokeStyle(2, 0xf8fafc);
      }
    }
  }

  private createObjectives(): void {
    const interactions = getInteractionsForScene('GridPracticeScene');
    interactions.forEach((interaction, index) => {
      const y = 135 + index * 86;
      this.add.text(450, y, interaction.prompt, {
        fontSize: '18px',
        fontFamily: 'Arial',
        color: '#ffffff',
        wordWrap: { width: 500 },
      });
      createSmallButton(this, 450, y + 46, '完成步骤', () => {
        objectiveManager.completeObjective(interaction.id);
        this.showFeedback(
          feedbackManager.buildInteractionFeedback(interaction.id, true)
            .message,
        );
      });
    });
  }

  private createAssessments(): void {
    const assessments = getAssessmentsForScene('GridPracticeScene');
    assessments.forEach((assessment, index) => {
      createSmallButton(
        this,
        450,
        390 + index * 58,
        assessment.question,
        () => {
          this.completedAssessments.add(assessment.id);
          this.correctAssessments.add(assessment.id);
          this.showFeedback(
            feedbackManager.buildAssessmentFeedback(
              assessment.id,
              assessment.correctIndex,
            ).message,
          );
          if (this.completedAssessments.size === assessments.length) {
            this.renderReport();
          }
        },
      );
    });
  }

  private showFeedback(message: string): void {
    this.feedbackText?.destroy();
    this.feedbackText = this.add.text(80, 430, message, {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#fde68a',
      wordWrap: { width: 820 },
    });
  }

  private renderReport(): void {
    updateCourseRuntimeStatus(
      'report',
      'GridPracticeScene',
      courseContent.course.id,
    );
    const accuracy =
      this.completedAssessments.size === 0
        ? 0
        : this.correctAssessments.size / this.completedAssessments.size;
    this.add.rectangle(512, 300, 650, 250, 0x0f172a, 0.92);
    this.add
      .text(
        512,
        300,
        [
          '学习报告',
          `完成目标：${objectiveManager.getCompletionRatio() * courseContent.learningGoals.length}/${courseContent.learningGoals.length}`,
          `正确率：${Math.round(accuracy * 100)}%`,
        ].join('\n'),
        {
          fontSize: '30px',
          fontFamily: 'Arial',
          color: '#ffffff',
          align: 'center',
          lineSpacing: 14,
        },
      )
      .setOrigin(0.5);
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

function createGridBackground(
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
    .text(32, 28, `${label} | ${courseContent.course.title}`, {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontStyle: 'bold',
      wordWrap: { width: cam.width - 64 },
    })
    .setDepth(10);
}

function createTextPanel(scene: Phaser.Scene, text: string): void {
  scene.add
    .text(90, 130, text, {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#f8fafc',
      lineSpacing: 10,
      wordWrap: { width: 840 },
    })
    .setDepth(10);
}

function createActionButton(
  scene: Phaser.Scene,
  label: string,
  onClick: () => void,
): void {
  createSmallButton(scene, 372, 520, label, onClick, 280);
}

function createSmallButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  width = 340,
): void {
  const button = scene.add
    .rectangle(x + width / 2, y, width, 42, 0x2563eb)
    .setInteractive({ useHandCursor: true });
  scene.add
    .text(x + width / 2, y, label, {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#ffffff',
    })
    .setOrigin(0.5);
  button.on('pointerdown', onClick);
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
