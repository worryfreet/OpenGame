import Phaser from 'phaser';
import { courseContent } from '../courseContent';
import { GenericPlayletScene } from '../playlets/shared';
import { resolvePlayletSceneKey } from '../playlets/shared';
import { WorkflowRunner } from './WorkflowRunner';

export class WorkflowEntryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WorkflowEntryScene' });
  }

  create(): void {
    const runner = new WorkflowRunner(courseContent);
    const node = runner.getCurrentNode();
    this.scene.start(resolvePlayletSceneKey(node.playletId), { runner, node });
  }
}

export { GenericPlayletScene };

export class CourseReportScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CourseReportScene' });
  }

  create(data: { runner: WorkflowRunner }): void {
    const cam = this.cameras.main;
    const results = data.runner.state.getResults();
    this.add.rectangle(
      cam.width / 2,
      cam.height / 2,
      cam.width,
      cam.height,
      0x12302b,
    );
    this.add
      .text(cam.width / 2, 86, '学习报告', {
        fontFamily: 'Arial',
        fontSize: '34px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.add
      .text(
        cam.width / 2,
        170,
        [
          `课程：${courseContent.course.title}`,
          `完成玩法：${results.length}`,
          `学习目标：${courseContent.learningGoals.length}`,
        ].join('\n'),
        {
          fontFamily: 'Arial',
          fontSize: '22px',
          color: '#d1fae5',
          align: 'center',
          lineSpacing: 12,
        },
      )
      .setOrigin(0.5);
    updateCourseRuntimeStatus('report', 'CourseReportScene');
  }
}

function updateCourseRuntimeStatus(stage: string, sceneKey: string): void {
  if (typeof document === 'undefined') return;
  let status = document.querySelector<HTMLElement>(
    '[data-course-runtime-status]',
  );
  if (!status) {
    status = document.createElement('div');
    status.setAttribute('data-course-runtime-status', 'true');
    status.style.display = 'none';
    document.body.appendChild(status);
  }
  status.setAttribute('data-stage', stage);
  status.setAttribute('data-scene', sceneKey);
  status.setAttribute('data-course-id', courseContent.course.id);
}
