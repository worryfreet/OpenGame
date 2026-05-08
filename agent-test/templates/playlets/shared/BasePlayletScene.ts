import Phaser from 'phaser';
import type { PlayletNode, WorkflowRunner } from '../../course_runtime';

export abstract class BasePlayletScene extends Phaser.Scene {
  protected runner!: WorkflowRunner;
  protected node!: PlayletNode;

  init(data: { runner: WorkflowRunner; node: PlayletNode }): void {
    this.runner = data.runner;
    this.node = data.node;
  }

  protected finish(status: 'success' | 'fail' | 'partial'): void {
    const next = this.runner.completeCurrent({
      status,
      accuracy: status === 'success' ? 1 : status === 'partial' ? 0.5 : 0,
      attempts: 1,
      misconceptionTags: status === 'success' ? [] : ['needs_review'],
      evidence: [`${this.node.playletId}:${status}`],
    });
    if (next) {
      this.scene.start('GenericPlayletScene', {
        runner: this.runner,
        node: next,
      });
    } else {
      this.scene.start('CourseReportScene', { runner: this.runner });
    }
  }
}
