import Phaser from 'phaser';

export const resetOriginAndOffset = (
  sprite: any,
  facingDirection: 'left' | 'right' | 'up' | 'down',
): void => {
  if (
    facingDirection !== 'up' &&
    facingDirection !== 'down' &&
    facingDirection !== 'left' &&
    facingDirection !== 'right'
  ) {
    throw new Error(
      'resetOriginAndOffset: facingDirection must be up, down, left, or right',
    );
  }

  const targetDisplayHeight = (sprite as any)._targetDisplayHeight;
  if (targetDisplayHeight && sprite.height > 0) {
    const newScale = targetDisplayHeight / sprite.height;
    sprite.setScale(newScale);
  }

  let baseOriginX = 0.5;
  let baseOriginY = 1.0;
  const animationsData = sprite.scene?.cache?.json?.get('animations');
  if (animationsData?.anims) {
    const currentAnim = sprite.anims?.currentAnim;
    if (currentAnim) {
      const animConfig = animationsData.anims.find(
        (anim: any) => anim.key === currentAnim.key,
      );
      if (animConfig) {
        baseOriginX = animConfig.originX ?? 0.5;
        baseOriginY = animConfig.originY ?? 1.0;
      }
    }
  }

  const animOriginX =
    facingDirection === 'left' ? 1 - baseOriginX : baseOriginX;
  const animOriginY = baseOriginY;

  sprite.setOrigin(animOriginX, animOriginY);

  const body = sprite.body as Phaser.Physics.Arcade.Body;
  if (!body) return;

  const unscaledBodyWidth = body.sourceWidth;
  const unscaledBodyHeight = body.sourceHeight;

  const offsetX = sprite.width * animOriginX - unscaledBodyWidth / 2;
  const offsetY = sprite.height * animOriginY - unscaledBodyHeight;

  body.setOffset(offsetX, offsetY);
};

export const safeAddSound = (
  scene: Phaser.Scene,
  key: string,
  config?: Phaser.Types.Sound.SoundConfig,
): Phaser.Sound.BaseSound | undefined => {
  if (!scene.cache.audio.exists(key)) {
    return undefined;
  }
  try {
    return scene.sound.add(key, config);
  } catch (e) {
    console.warn(`Failed to add sound: ${key}`, e);
    return undefined;
  }
};

export const audioExists = (scene: Phaser.Scene, key: string): boolean => {
  return scene.cache.audio.exists(key);
};

export const textureExists = (scene: Phaser.Scene, key: string): boolean => {
  return scene.textures.exists(key);
};

export const initScale = (
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
  origin: { x: number; y: number },
  maxDisplayWidth?: number,
  maxDisplayHeight?: number,
  bodyWidthFactorToDisplayWidth?: number,
  bodyHeightFactorToDisplayHeight?: number,
): void => {
  sprite.setOrigin(origin.x, origin.y);

  (sprite as any)._initWidth = sprite.width;
  (sprite as any)._initHeight = sprite.height;

  let displayScale: number;
  let displayHeight: number;
  let displayWidth: number;

  if (maxDisplayHeight && maxDisplayWidth) {
    if (sprite.height / sprite.width > maxDisplayHeight / maxDisplayWidth) {
      displayHeight = maxDisplayHeight;
      displayScale = maxDisplayHeight / sprite.height;
      displayWidth = sprite.width * displayScale;
    } else {
      displayWidth = maxDisplayWidth;
      displayScale = maxDisplayWidth / sprite.width;
      displayHeight = sprite.height * displayScale;
    }
  } else if (maxDisplayHeight) {
    displayHeight = maxDisplayHeight;
    displayScale = maxDisplayHeight / sprite.height;
    displayWidth = sprite.width * displayScale;
  } else if (maxDisplayWidth) {
    displayWidth = maxDisplayWidth;
    displayScale = maxDisplayWidth / sprite.width;
    displayHeight = sprite.height * displayScale;
  } else {
    throw new Error(
      'initScale: maxDisplayHeight and maxDisplayWidth cannot both be undefined',
    );
  }

  (sprite as any)._targetDisplayHeight = displayHeight;
  sprite.setScale(displayScale);

  const widthFactor = bodyWidthFactorToDisplayWidth ?? 1.0;
  const heightFactor = bodyHeightFactorToDisplayHeight ?? 1.0;

  const displayBodyWidth = displayWidth * widthFactor;
  const displayBodyHeight = displayHeight * heightFactor;

  if (sprite.body instanceof Phaser.Physics.Arcade.Body) {
    const unscaledBodyWidth = displayBodyWidth / displayScale;
    const unscaledBodyHeight = displayBodyHeight / displayScale;
    sprite.body.setSize(unscaledBodyWidth, unscaledBodyHeight);
    const unscaledOffsetX =
      sprite.width * origin.x - unscaledBodyWidth * origin.x;
    const unscaledOffsetY =
      sprite.height * origin.y - unscaledBodyHeight * origin.y;
    sprite.body.setOffset(unscaledOffsetX, unscaledOffsetY);
  } else if (sprite.body instanceof Phaser.Physics.Arcade.StaticBody) {
    sprite.body.setSize(displayBodyWidth, displayBodyHeight);
    const displayTopLeft = sprite.getTopLeft();
    const bodyPositionX =
      displayTopLeft.x +
      (sprite.displayWidth * origin.x - displayBodyWidth * origin.x);
    const bodyPositionY =
      displayTopLeft.y +
      (sprite.displayHeight * origin.y - displayBodyHeight * origin.y);
    sprite.body.position.set(bodyPositionX, bodyPositionY);
  }
};

export const addCollider = (
  scene: Phaser.Scene,
  object1: Phaser.Types.Physics.Arcade.ArcadeColliderType,
  object2: Phaser.Types.Physics.Arcade.ArcadeColliderType,
  collideCallback?: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
  processCallback?: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
  callbackContext?: any,
): Phaser.Physics.Arcade.Collider => {
  if (shouldSwap(object1, object2)) {
    return scene.physics.add.collider(
      object1,
      object2,
      (obj1: any, obj2: any) => {
        collideCallback?.call(callbackContext, obj2, obj1);
      },
      (obj1: any, obj2: any) => {
        return processCallback?.call(callbackContext, obj2, obj1);
      },
      callbackContext,
    );
  }
  return scene.physics.add.collider(
    object1,
    object2,
    collideCallback,
    processCallback,
    callbackContext,
  );
};

export const addOverlap = (
  scene: Phaser.Scene,
  object1: Phaser.Types.Physics.Arcade.ArcadeColliderType,
  object2: Phaser.Types.Physics.Arcade.ArcadeColliderType,
  collideCallback?: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
  processCallback?: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
  callbackContext?: any,
): Phaser.Physics.Arcade.Collider => {
  if (shouldSwap(object1, object2)) {
    return scene.physics.add.overlap(
      object1,
      object2,
      (obj1: any, obj2: any) => {
        collideCallback?.call(callbackContext, obj2, obj1);
      },
      (obj1: any, obj2: any) => {
        return processCallback?.call(callbackContext, obj2, obj1);
      },
      callbackContext,
    );
  }
  return scene.physics.add.overlap(
    object1,
    object2,
    collideCallback,
    processCallback,
    callbackContext,
  );
};

export const initUIDom = (
  scene: Phaser.Scene,
  html: string,
): Phaser.GameObjects.DOMElement => {
  const dom = scene.add
    .dom(0, 0, 'div', 'width: 100%; height: 100%;')
    .setHTML(html);
  dom.pointerEvents = 'none';
  dom.setOrigin(0, 0);
  dom.setScrollFactor(0);
  return dom;
};

export const createDecoration = (
  scene: Phaser.Scene,
  group: Phaser.GameObjects.Group,
  key: string,
  x: number,
  y: number,
  maxDisplayHeight: number,
): Phaser.GameObjects.Image => {
  const decoration = scene.add.image(x, y, key);
  initScale(decoration, { x: 0.5, y: 1.0 }, undefined, maxDisplayHeight);
  group.add(decoration);
  return decoration;
};

const shouldSwap = (object1: any, object2: any): boolean => {
  const object1IsPhysicsGroup =
    object1 &&
    (object1 as any).isParent &&
    !((object1 as any).physicsType === undefined);
  const object1IsTilemap = object1 && (object1 as any).isTilemap;
  const object2IsPhysicsGroup =
    object2 &&
    (object2 as any).isParent &&
    !((object2 as any).physicsType === undefined);
  const object2IsTilemap = object2 && (object2 as any).isTilemap;

  return (
    (object1IsPhysicsGroup && !object2IsPhysicsGroup && !object2IsTilemap) ||
    (object1IsTilemap && !object2IsPhysicsGroup && !object2IsTilemap) ||
    (object1IsTilemap && object2IsPhysicsGroup)
  );
};
