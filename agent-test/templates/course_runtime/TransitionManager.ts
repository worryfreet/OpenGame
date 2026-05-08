import type Phaser from 'phaser';

export function playWorkflowTransition(
  scene: Phaser.Scene,
  label: string | undefined,
  done: () => void,
): void {
  if (!label) {
    done();
    return;
  }

  const cam = scene.cameras.main;
  const overlay = scene.add
    .rectangle(
      cam.width / 2,
      cam.height / 2,
      cam.width,
      cam.height,
      0x111827,
      0.82,
    )
    .setDepth(1000);
  const text = scene.add
    .text(cam.width / 2, cam.height / 2, label, {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: Math.min(680, cam.width - 80) },
    })
    .setOrigin(0.5)
    .setDepth(1001);

  scene.time.delayedCall(650, () => {
    overlay.destroy();
    text.destroy();
    done();
  });
}
