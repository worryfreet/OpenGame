import { BasePlayletScene } from './BasePlayletScene';

export class GenericPlayletScene extends BasePlayletScene {
  constructor() {
    super('GenericPlayletScene');
  }

  create(): void {
    const cam = this.cameras.main;
    updateCourseRuntimeStatus('playlet', this.node.playletId);
    this.add.rectangle(
      cam.width / 2,
      cam.height / 2,
      cam.width,
      cam.height,
      0x182033,
    );
    this.add
      .text(cam.width / 2, 80, this.node.playletId, {
        fontFamily: 'Arial',
        fontSize: '28px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.add
      .text(
        cam.width / 2,
        170,
        String(this.node.config.prompt ?? '完成玩法任务'),
        {
          fontFamily: 'Arial',
          fontSize: '22px',
          color: '#dbeafe',
          align: 'center',
          wordWrap: { width: Math.min(720, cam.width - 80) },
        },
      )
      .setOrigin(0.5);

    const success = this.add
      .text(cam.width / 2 - 150, cam.height - 120, '完成', buttonStyle())
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const retry = this.add
      .text(cam.width / 2 + 150, cam.height - 120, '需要提示', buttonStyle())
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    success.on('pointerdown', () => this.finish('success'));
    retry.on('pointerdown', () => this.finish('partial'));
  }
}

function buttonStyle(): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: 'Arial',
    fontSize: '20px',
    color: '#111827',
    backgroundColor: '#facc15',
    padding: { left: 22, right: 22, top: 12, bottom: 12 },
  };
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
}
