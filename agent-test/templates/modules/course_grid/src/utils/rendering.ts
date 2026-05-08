import Phaser from 'phaser';
import { CellType, type GridPoint } from './grid';

export function drawGridLines(
  scene: Phaser.Scene,
  cols: number,
  rows: number,
  cellSize: number,
  offsetX: number = 0,
  offsetY: number = 0,
  color: number = 0xffffff,
  alpha: number = 0.15,
  lineWidth: number = 1,
  depth: number = -5,
): Phaser.GameObjects.Graphics {
  const gfx = scene.add.graphics();
  gfx.setDepth(depth);
  gfx.lineStyle(lineWidth, color, alpha);

  for (let x = 0; x <= cols; x++) {
    gfx.moveTo(offsetX + x * cellSize, offsetY);
    gfx.lineTo(offsetX + x * cellSize, offsetY + rows * cellSize);
  }
  for (let y = 0; y <= rows; y++) {
    gfx.moveTo(offsetX, offsetY + y * cellSize);
    gfx.lineTo(offsetX + cols * cellSize, offsetY + y * cellSize);
  }
  gfx.strokePath();

  return gfx;
}

export function drawCellTypeOverlay(
  scene: Phaser.Scene,
  cells: number[][],
  cols: number,
  rows: number,
  cellSize: number,
  offsetX: number = 0,
  offsetY: number = 0,
  colorMap?: Record<number, number>,
  alpha: number = 0.25,
  depth: number = -5,
): Phaser.GameObjects.Graphics {
  const gfx = scene.add.graphics();
  gfx.setDepth(depth);

  const defaultColors: Record<number, number> = {
    [CellType.EMPTY]: 0x222222,
    [CellType.WALL]: 0x444444,
    [CellType.FLOOR]: 0x228822,
    [CellType.GOAL]: 0xffaa00,
    [CellType.HAZARD]: 0xff2222,
    [CellType.SPAWN]: 0x4444ff,
    [CellType.SPECIAL]: 0xaa44aa,
    [CellType.ICE]: 0x88ccff,
    [CellType.PORTAL]: 0xff44ff,
  };

  const colors = colorMap ?? defaultColors;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellValue = cells[row]?.[col] ?? 0;
      const color = colors[cellValue] ?? 0x000000;
      gfx.fillStyle(color, alpha);
      gfx.fillRect(
        offsetX + col * cellSize,
        offsetY + row * cellSize,
        cellSize,
        cellSize,
      );
    }
  }

  return gfx;
}

export function highlightCells(
  scene: Phaser.Scene,
  cells: GridPoint[],
  cellSize: number,
  offsetX: number = 0,
  offsetY: number = 0,
  fillColor: number = 0x00aaff,
  fillAlpha: number = 0.3,
  borderColor: number = 0x00aaff,
  borderAlpha: number = 0.6,
  depth: number = 5,
): Phaser.GameObjects.Graphics {
  const gfx = scene.add.graphics();
  gfx.setDepth(depth);

  for (const cell of cells) {
    const px = offsetX + cell.gridX * cellSize;
    const py = offsetY + cell.gridY * cellSize;

    gfx.fillStyle(fillColor, fillAlpha);
    gfx.fillRect(px, py, cellSize, cellSize);

    gfx.lineStyle(2, borderColor, borderAlpha);
    gfx.strokeRect(px, py, cellSize, cellSize);
  }

  return gfx;
}

export function highlightSelectedCell(
  scene: Phaser.Scene,
  gridX: number,
  gridY: number,
  cellSize: number,
  offsetX: number = 0,
  offsetY: number = 0,
  color: number = 0xffff00,
  depth: number = 6,
): Phaser.GameObjects.Graphics {
  const gfx = scene.add.graphics();
  gfx.setDepth(depth);

  const px = offsetX + gridX * cellSize;
  const py = offsetY + gridY * cellSize;
  const pad = 2;

  gfx.lineStyle(3, color, 0.8);
  gfx.strokeRect(px + pad, py + pad, cellSize - pad * 2, cellSize - pad * 2);

  scene.tweens.add({
    targets: gfx,
    alpha: { from: 1, to: 0.4 },
    duration: 600,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  return gfx;
}

export function showFloatingText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: string = '#FFD700',
  fontSize: number = 16,
  duration: number = 1000,
  riseDistance: number = 40,
): void {
  const textObj = scene.add.text(x, y, text, {
    fontSize: `${fontSize}px`,
    color: color,
    stroke: '#000000',
    strokeThickness: 2,
    fontStyle: 'bold',
  });
  textObj.setOrigin(0.5);
  textObj.setDepth(300);

  scene.tweens.add({
    targets: textObj,
    y: y - riseDistance,
    alpha: 0,
    duration: duration,
    ease: 'Cubic.easeOut',
    onComplete: () => textObj.destroy(),
  });
}

export function scaleToCell(
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
  cellSize: number,
  padding: number = 4,
): void {
  const targetSize = cellSize - padding * 2;
  const maxDim = Math.max(sprite.width, sprite.height);
  const scale = targetSize / maxDim;
  sprite.setScale(scale);
  sprite.setOrigin(0.5, 0.5);
}
