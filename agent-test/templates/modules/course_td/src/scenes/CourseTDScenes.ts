import Phaser from 'phaser';
import {
  courseContent,
  type CourseAssessmentItem,
  type CourseLessonUnit,
  getVideoTransitionForScene,
} from '../courseContent';
import { ReviewWaveProgressManager } from '../systems/ReviewWaveProgressManager';
import { playOptionalVideoTransition } from '../systems/VideoTransitionManager';

const reviewManager = new ReviewWaveProgressManager(courseContent);

export class ReviewPrepScene extends Phaser.Scene {
  constructor() {
    super('ReviewPrepScene');
  }

  create(): void {
    updateCourseRuntimeStatus(
      'lesson',
      'ReviewPrepScene',
      courseContent.course.id,
    );
    createReviewBackground(this, 0x273449, '复习准备');
    const units = getUnitsForScene('ReviewPrepScene');
    this.add.text(
      86,
      128,
      units
        .map((unit) => `${unit.concept}\n${unit.script}\n${unit.workedExample}`)
        .join('\n\n'),
      {
        fontSize: '24px',
        fontFamily: 'Arial',
        color: '#f8fafc',
        lineSpacing: 10,
        wordWrap: { width: 850 },
      },
    );
    createButton(this, 512, 520, '开始复习波次', () => {
      this.scene.start('ReviewWaveScene');
    });
    playOptionalVideoTransition(
      this,
      getVideoTransitionForScene('ReviewPrepScene'),
      () => undefined,
    );
  }
}

export class ReviewWaveScene extends Phaser.Scene {
  private waveNumber = 1;
  private completed = 0;
  private feedbackText?: Phaser.GameObjects.Text;

  constructor() {
    super('ReviewWaveScene');
  }

  create(): void {
    updateCourseRuntimeStatus(
      'practice',
      'ReviewWaveScene',
      courseContent.course.id,
    );
    createReviewBackground(this, 0x3a2c55, '复习波次');
    this.renderCurrentWave();
  }

  private renderCurrentWave(): void {
    const assessment = getAssessmentForWave(this.waveNumber);
    if (!assessment) {
      this.renderReport();
      return;
    }

    this.add.text(
      96,
      125,
      reviewManager.getReviewPromptForWave(this.waveNumber),
      {
        fontSize: '26px',
        fontFamily: 'Arial',
        color: '#ffffff',
        wordWrap: { width: 820 },
      },
    );

    assessment.options.forEach((option, index) => {
      createButton(this, 512, 225 + index * 64, option, () => {
        const result = reviewManager.resolveWaveAnswer(this.waveNumber, index);
        this.completed += 1;
        this.showFeedback(
          result.correct
            ? assessment.explanation
            : `${assessment.explanation} 提示：${assessment.hint}`,
        );
        if (this.completed >= courseContent.assessments.length) {
          this.time.delayedCall(250, () => this.renderReport());
        } else {
          this.waveNumber += 1;
          this.time.delayedCall(250, () => this.scene.restart());
        }
      });
    });
  }

  private showFeedback(message: string): void {
    this.feedbackText?.destroy();
    this.feedbackText = this.add
      .text(512, 475, message, {
        fontSize: '22px',
        fontFamily: 'Arial',
        color: '#fde68a',
        align: 'center',
        wordWrap: { width: 820 },
      })
      .setOrigin(0.5);
  }

  private renderReport(): void {
    updateCourseRuntimeStatus(
      'report',
      'ReviewWaveScene',
      courseContent.course.id,
    );
    this.children.removeAll();
    createReviewBackground(this, 0x102a43, '学习报告');
    this.add
      .text(
        512,
        310,
        [
          `课程：${courseContent.course.title}`,
          `复习波次：${this.completed}/${courseContent.assessments.length}`,
          `正确率：${Math.round(reviewManager.getAccuracy() * 100)}%`,
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

function getAssessmentForWave(
  waveNumber: number,
): CourseAssessmentItem | undefined {
  return courseContent.assessments[
    (waveNumber - 1) % courseContent.assessments.length
  ];
}

function createReviewBackground(
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
  scene.add.text(32, 28, `${label} | ${courseContent.course.title}`, {
    fontSize: '24px',
    fontFamily: 'Arial',
    color: '#ffffff',
    fontStyle: 'bold',
    wordWrap: { width: cam.width - 64 },
  });
}

function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
): void {
  const button = scene.add
    .rectangle(x, y, 430, 46, 0x7c3aed)
    .setInteractive({ useHandCursor: true });
  scene.add
    .text(x, y, label, {
      fontSize: '19px',
      fontFamily: 'Arial',
      color: '#ffffff',
      wordWrap: { width: 390 },
      align: 'center',
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
