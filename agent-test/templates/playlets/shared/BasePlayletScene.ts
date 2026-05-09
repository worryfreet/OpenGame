import Phaser from 'phaser';
import type { PlayletNode, WorkflowRunner } from '../../course_runtime';

export abstract class BasePlayletScene extends Phaser.Scene {
  protected runner!: WorkflowRunner;
  protected node!: PlayletNode;

  init(data: { runner: WorkflowRunner; node: PlayletNode }): void {
    this.runner = data.runner;
    this.node = data.node;
  }

  protected finish(
    status: 'success' | 'fail' | 'partial',
    options: {
      accuracy?: number;
      attempts?: number;
      misconceptionTags?: string[];
      evidence?: string[];
    } = {},
  ): void {
    const accuracy =
      options.accuracy ??
      (status === 'success' ? 1 : status === 'partial' ? 0.5 : 0);
    const next = this.runner.completeCurrent({
      status,
      accuracy,
      attempts: options.attempts ?? 1,
      misconceptionTags:
        options.misconceptionTags ??
        (status === 'success' ? [] : ['needs_review']),
      evidence: options.evidence ?? [`${this.node.playletId}:${status}`],
    });
    if (next) {
      this.scene.start(resolvePlayletSceneKey(next.playletId), {
        runner: this.runner,
        node: next,
      });
    } else {
      this.scene.start('CourseReportScene', { runner: this.runner });
    }
  }

  protected setRuntimeStatus(stage: string, sceneKey: string): void {
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
    status.setAttribute('data-playlet-id', this.node.playletId);
  }
}

export function buildPlayletSceneKey(playletId: string): string {
  return `${playletId
    .replace(/^playlet-/, '')
    .replace(/[^a-zA-Z0-9\u4E00-\u9FFF]+/g, '-')
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('')}PlayletScene`;
}

export function resolvePlayletSceneKey(playletId: string): string {
  const key = buildPlayletSceneKey(playletId);
  return key || 'GenericPlayletScene';
}
