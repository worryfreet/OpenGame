import type { VideoTransition } from '../courseContent';

export function playOptionalVideoTransition(
  scene: Phaser.Scene,
  transition: VideoTransition | undefined,
  onComplete: () => void,
): void {
  if (!transition) {
    onComplete();
    return;
  }

  const cam = scene.cameras.main;
  const overlay = scene.add
    .rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height, 0x020617, 0.94)
    .setDepth(1000);
  const title = scene.add
    .text(cam.width / 2, 118, transition.description, {
      fontSize: '28px',
      fontFamily: 'Arial',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: cam.width - 96 },
    })
    .setOrigin(0.5)
    .setDepth(1001);
  const hint = scene.add
    .text(
      cam.width / 2,
      cam.height - 82,
      `${transition.skipLabel || '跳过过场'} / SPACE`,
      {
        fontSize: '18px',
        fontFamily: 'Arial',
        color: '#fde68a',
      },
    )
    .setOrigin(0.5)
    .setDepth(1001);

  let video: Phaser.GameObjects.Video | undefined;
  let completed = false;
  const finish = (): void => {
    if (completed) return;
    completed = true;
    scene.input.keyboard?.off('keydown-SPACE', finish);
    video?.off('complete', finish);
    video?.destroy();
    title.destroy();
    hint.destroy();
    overlay.destroy();
    onComplete();
  };

  if (scene.cache.video.exists(transition.key)) {
    video = scene.add
      .video(cam.width / 2, cam.height / 2, transition.key)
      .setDisplaySize(cam.width, cam.height)
      .setDepth(1000);
    video.once('complete', finish);
    video.play(false);
  } else {
    hint.setText(`${transition.skipLabel || '跳过过场'} / SPACE（视频资源未加载，已降级为静态过场）`);
    scene.time.delayedCall(1200, finish);
  }

  scene.input.keyboard?.once('keydown-SPACE', finish);
  overlay.setInteractive({ useHandCursor: true }).once('pointerdown', finish);
}

