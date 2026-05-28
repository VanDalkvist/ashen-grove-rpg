import Phaser from 'phaser';
import { ASSETS } from '../../game/assets/manifest';
import { MAP_HEIGHT, MAP_SITES, MAP_WIDTH, WORLD_MAP } from '../../game/content/world';
import { gameEvents } from '../../game/events';
import {
  clearSavedGame,
  createGameState,
  loadGameState,
  saveGameState,
  toHudSnapshot
} from '../../game/simulation/state';
import {
  canMoveTo,
  interact,
  movePlayer,
  performBattleAction,
  endTurn,
  type Direction
} from '../../game/simulation/systems';
import type { BattleAction, GameState, Point } from '../../game/simulation/types';
import { CAMPFIRE_POSITION, CHESTS, ELDER_POSITION, ENEMIES, SHRINE_POSITION } from '../../game/content/world';

type TileStyle = {
  fill: number;
  edge: number;
  highlight: number;
  shade: number;
  sideLeft: number;
  sideRight: number;
  depth: number;
};

const ISO_TILE_WIDTH = 64;
const ISO_TILE_HEIGHT = 32;
const ISO_TILE_DEPTH = 16;
const ISO_ORIGIN_X = 548;
const ISO_ORIGIN_Y = 82;

const TILE_STYLES: Record<string, TileStyle> = {
  g: { fill: 0x2f7a49, edge: 0x1e5232, highlight: 0x62b86c, shade: 0x1c4b2f, sideLeft: 0x1f5d38, sideRight: 0x17462d, depth: 14 },
  r: { fill: 0xad7843, edge: 0x765032, highlight: 0xd5a063, shade: 0x7a5130, sideLeft: 0x8f5e36, sideRight: 0x68442a, depth: 16 },
  f: { fill: 0x173d2b, edge: 0x0a2518, highlight: 0x2b6845, shade: 0x0e2b1c, sideLeft: 0x124027, sideRight: 0x0a281b, depth: 18 },
  w: { fill: 0x246e98, edge: 0x174760, highlight: 0x7ad0d5, shade: 0x18516f, sideLeft: 0x1c5c80, sideRight: 0x123f5c, depth: 8 },
  m: { fill: 0x68736e, edge: 0x444d49, highlight: 0x9aa39d, shade: 0x4c5651, sideLeft: 0x515c57, sideRight: 0x3a443f, depth: 18 },
  s: { fill: 0x615d78, edge: 0x403d54, highlight: 0xa89bce, shade: 0x48445f, sideLeft: 0x4e4a65, sideRight: 0x39364f, depth: 18 }
};

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private playerSprite!: Phaser.GameObjects.Image;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private objectsLayer!: Phaser.GameObjects.Container;
  private markersLayer!: Phaser.GameObjects.Container;
  private isMoving = false;
  private readonly uiHandler = (event: Event) => {
    const detail = (event as CustomEvent<{ action: string; payload?: unknown }>).detail;
    this.handleUiAction(detail.action, detail.payload);
  };

  constructor() {
    super('GameScene');
  }

  create() {
    this.state = loadGameState();
    this.cameras.main.setBounds(0, 0, 1100, 720);
    this.cameras.main.setZoom(1);
    this.cameras.main.setScroll(0, 0);

    this.drawTiles();
    this.createAtmosphere();
    this.markersLayer = this.add.container(0, 0);
    this.objectsLayer = this.add.container(0, 0);
    this.playerShadow = this.add.ellipse(0, 0, 40, 15, 0x07100a, 0.42);
    this.playerSprite = this.add.image(0, 0, ASSETS.hero).setDisplaySize(58, 58).setOrigin(0.5, 0.78);

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is unavailable.');
    }

    keyboard.on('keydown-LEFT', () => this.tryMove('left'));
    keyboard.on('keydown-A', () => this.tryMove('left'));
    keyboard.on('keydown-RIGHT', () => this.tryMove('right'));
    keyboard.on('keydown-D', () => this.tryMove('right'));
    keyboard.on('keydown-UP', () => this.tryMove('up'));
    keyboard.on('keydown-W', () => this.tryMove('up'));
    keyboard.on('keydown-DOWN', () => this.tryMove('down'));
    keyboard.on('keydown-S', () => this.tryMove('down'));
    keyboard.on('keydown-SPACE', () => this.handleInteract());
    keyboard.on('keydown-E', () => this.handleInteract());
    gameEvents.addEventListener('ui:action', this.uiHandler);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      gameEvents.removeEventListener('ui:action', this.uiHandler);
    });

    this.refreshWorld(true);
    this.publishHud();
  }

  private handleUiAction(action: string, payload?: unknown) {
    if (action === 'reset') {
      clearSavedGame();
      this.state = createGameState();
      this.refreshWorld(true);
      this.persistAndPublish();
      return;
    }

    if (action === 'interact') {
      this.handleInteract();
      return;
    }

    if (action === 'end-turn') {
      this.handleEndTurn();
      return;
    }

    if (action === 'battle') {
      this.handleBattleAction(payload as BattleAction);
    }
  }

  private handleInteract() {
    const result = interact(this.state);
    if (result.positionChanged || result.battleChanged || result.completed) {
      this.refreshWorld();
    }
    this.persistAndPublish();
  }

  private handleEndTurn() {
    endTurn(this.state);
    this.refreshWorld();
    this.persistAndPublish();
  }

  private handleBattleAction(action: BattleAction) {
    if (!this.state.battle) {
      return;
    }

    const result = performBattleAction(this.state, action);
    if (result.positionChanged || result.battleChanged) {
      this.refreshWorld();
    }
    this.persistAndPublish();
  }

  private tryMove(direction: Direction) {
    if (this.isMoving || this.state.battle) {
      return;
    }

    const before = { x: this.state.player.x, y: this.state.player.y };
    const result = movePlayer(this.state, direction);

    if (result.battleChanged) {
      this.refreshWorld();
      this.persistAndPublish();
      return;
    }

    if (!result.moved) {
      this.bumpBlocked(direction);
      return;
    }

    this.isMoving = true;
    const destination = this.tileCenter(this.state.player);
    this.updatePlayerDepth(this.state.player);
    this.tweens.add({
      targets: [this.playerSprite, this.playerShadow],
      x: destination.x,
      duration: 170,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.isMoving = false;
        this.persistAndPublish();
      }
    });
    this.tweens.add({
      targets: this.playerSprite,
      y: destination.y,
      duration: 170,
      ease: 'Sine.easeOut'
    });
    this.tweens.add({
      targets: this.playerShadow,
      y: destination.y + 8,
      duration: 170,
      ease: 'Sine.easeOut'
    });

    this.addFootstep(before, this.state.player);
  }

  private bumpBlocked(direction: Direction) {
    const offsets: Record<Direction, Point> = {
      up: { x: 7, y: -4 },
      down: { x: -7, y: 4 },
      left: { x: -7, y: -4 },
      right: { x: 7, y: 4 }
    };
    const offset = offsets[direction];

    this.tweens.add({
      targets: this.playerSprite,
      x: this.playerSprite.x + offset.x,
      y: this.playerSprite.y + offset.y,
      yoyo: true,
      duration: 45,
      ease: 'Quad.easeOut'
    });
  }

  private refreshWorld(forcePlayer = false) {
    this.objectsLayer.removeAll(true);
    this.markersLayer.removeAll(true);
    this.drawMarkers();
    this.drawObjects();

    if (forcePlayer) {
      const center = this.tileCenter(this.state.player);
      this.playerSprite.setPosition(center.x, center.y);
      this.playerShadow.setPosition(center.x, center.y + 8);
      this.updatePlayerDepth(this.state.player);
    }
  }

  private drawTiles() {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x0f1712, 1);
    graphics.fillRect(0, 0, 1100, 720);

    for (let y = 0; y < MAP_HEIGHT; y += 1) {
      for (let x = 0; x < MAP_WIDTH; x += 1) {
        const tile = WORLD_MAP[y][x];
        const style = TILE_STYLES[tile];
        this.drawIsoTile(graphics, style, x, y);
        this.drawTileDetail(graphics, tile, x, y);
      }
    }

    this.drawAmbientFrame();
  }

  private drawTileDetail(graphics: Phaser.GameObjects.Graphics, tile: string, x: number, y: number) {
    const center = this.tileCenter({ x, y });
    const seed = this.tileSeed(x, y);

    if (tile === 'g') {
      graphics.fillStyle(seed % 5 === 0 ? 0xd9c46c : 0x68a965, 0.64);
      graphics.fillRect(center.x - 15 + (seed % 20), center.y - 5 + (seed % 9), 3, 7);
      graphics.fillRect(center.x - 9 + (seed % 16), center.y + 4 + (seed % 6), 4, 2);
      graphics.fillStyle(0x1d5836, 0.55);
      graphics.fillRect(center.x + 4 + (seed % 10), center.y - 7 + (seed % 12), 3, 8);
      return;
    }

    if (tile === 'r') {
      graphics.fillStyle(0xd1a166, 0.38);
      graphics.fillRect(center.x - 17 + (seed % 10), center.y - 3, 11, 3);
      graphics.fillRect(center.x + 2, center.y + 5 + (seed % 4), 12, 3);
      graphics.fillStyle(0x765033, 0.3);
      graphics.fillRect(center.x - 6, center.y + 8, 7, 3);
      return;
    }

    if (tile === 'f') {
      graphics.fillStyle(0x0a1d14, 0.44);
      graphics.fillEllipse(center.x, center.y + 4, 40, 13);
      graphics.fillStyle(0x6b4629, 1);
      graphics.fillRect(center.x - 3, center.y - 3, 7, 21);
      graphics.fillStyle(0x123522, 1);
      graphics.fillTriangle(center.x, center.y - 56, center.x - 30, center.y - 12, center.x + 30, center.y - 12);
      graphics.fillStyle(0x1f5a39, 1);
      graphics.fillTriangle(center.x, center.y - 45, center.x - 25, center.y - 4, center.x + 26, center.y - 4);
      graphics.fillStyle(0x2f744a, 1);
      graphics.fillTriangle(center.x + 2, center.y - 35, center.x - 18, center.y + 4, center.x + 22, center.y + 4);
      graphics.fillStyle(0x68462b, 1);
      return;
    }

    if (tile === 'w') {
      graphics.fillStyle(0x7dd1d2, 0.36);
      graphics.fillRect(center.x - 20, center.y - 2 + (seed % 4), 28, 2);
      graphics.fillRect(center.x - 4, center.y + 6 + (seed % 5), 24, 2);
      graphics.fillStyle(0x103c58, 0.2);
      return;
    }

    if (tile === 'm') {
      graphics.fillStyle(0x8f9891, 0.34);
      graphics.fillRect(center.x - 18, center.y - 5, 24, 5);
      graphics.fillRect(center.x - 1, center.y + 5, 18, 5);
      graphics.fillStyle(0x39413d, 0.38);
      graphics.fillRect(center.x - 15, center.y + 11, 28, 4);
      return;
    }

    if (tile === 's') {
      graphics.fillStyle(0xb7a6d9, 0.34);
      graphics.fillRect(center.x - 19, center.y - 4, 30, 3);
      graphics.fillRect(center.x - 8, center.y + 8, 22, 3);
    }
  }

  private drawAmbientFrame() {
    const glow = this.add.graphics().setDepth(1);
    glow.fillStyle(0xf0bc65, 0.08);
    const campfire = this.tileCenter(CAMPFIRE_POSITION);
    const shrine = this.tileCenter(SHRINE_POSITION);
    glow.fillCircle(campfire.x, campfire.y, 98);
    glow.fillStyle(this.state?.flags.shrineLit ? 0x9ee7ff : 0x7662aa, this.state?.flags.shrineLit ? 0.13 : 0.07);
    glow.fillCircle(shrine.x, shrine.y, 90);
    glow.fillStyle(0x050908, 0.3);
    glow.fillRect(0, 0, 1100, 18);
    glow.fillRect(0, 702, 1100, 18);
    glow.fillRect(0, 0, 18, 720);
    glow.fillRect(1082, 0, 18, 720);
  }

  private drawMarkers() {
    const targetTiles = [
      ...MAP_SITES.filter((site) => !this.isSiteDone(site.id)).map((site) => site.position),
      ...CHESTS.filter((chest) => !this.state.flags.openedChests.includes(chest.id)).map((chest) => chest.position),
      ...ENEMIES.filter((enemy) => !this.state.flags.defeatedEnemies.includes(enemy.id)).map((enemy) => enemy.position),
      ELDER_POSITION,
      CAMPFIRE_POSITION,
      SHRINE_POSITION
    ];

    for (const tile of targetTiles) {
      const center = this.tileCenter(tile);
      const marker = this.add.polygon(
        center.x,
        center.y + 2,
        [
          0,
          -10,
          22,
          0,
          0,
          10,
          -22,
          0
        ],
        canMoveTo(this.state, tile) ? 0xffffff : 0x000000,
        0
      );
      marker.setStrokeStyle(2, 0xf2d47c, 0.22);
      marker.setDepth(this.tileDepth(tile, -1));
      this.markersLayer.add(marker);
      this.tweens.add({
        targets: marker,
        alpha: 0.42,
        scaleX: 1.08,
        scaleY: 1.08,
        yoyo: true,
        repeat: -1,
        duration: 980 + (this.tileSeed(tile.x, tile.y) % 360),
        ease: 'Sine.easeInOut'
      });
    }
  }

  private drawObjects() {
    for (const site of MAP_SITES) {
      const done = this.isSiteDone(site.id);
      if (site.kind === 'resource' && done) {
        continue;
      }
      const size = this.siteSize(site.assetKey);
      const sprite = this.addObject(site.position, site.assetKey, size.width, size.height, 5, 0.5, size.originY);
      if (done) {
        sprite.setAlpha(0.78);
        this.addBanner(site.position);
      }
    }

    this.addObject(ELDER_POSITION, ASSETS.elder, 62, 70, 6);
    this.addObject(CAMPFIRE_POSITION, ASSETS.campfire, 54, 58, 4, 0.5, 0.82);
    this.addObject(SHRINE_POSITION, ASSETS.shrine, 70, 78, 4);

    for (const chest of CHESTS) {
      this.addObject(
        chest.position,
        this.state.flags.openedChests.includes(chest.id) ? ASSETS.chestOpen : ASSETS.chestClosed,
        52,
        50,
        5,
        0.5,
        0.78
      );
    }

    for (const enemy of ENEMIES) {
      if (!this.state.flags.defeatedEnemies.includes(enemy.id)) {
        const enemySprite = this.addObject(enemy.position, ASSETS.slime, 58, 54, 7, 0.5, 0.8);
        this.tweens.add({
          targets: enemySprite,
          y: enemySprite.y - 4,
          yoyo: true,
          repeat: -1,
          duration: 850,
          ease: 'Sine.easeInOut'
        });
      } else if (enemy.shardReward > 0) {
        this.addObject(enemy.position, ASSETS.shard, 42, 48, 4).setAlpha(0.5);
      }
    }
  }

  private addObject(position: Point, key: string, width: number, height: number, depth: number, originX = 0.5, originY = 0.78) {
    const center = this.tileCenter(position);
    const baseDepth = this.tileDepth(position, depth);
    const shadow = this.add.ellipse(center.x, center.y + 8, width * 0.58, 12, 0x07100a, 0.36).setDepth(baseDepth - 1);
    const sprite = this.add.image(center.x, center.y, key).setDisplaySize(width, height).setOrigin(originX, originY).setDepth(baseDepth);
    this.objectsLayer.add(shadow);
    this.objectsLayer.add(sprite);
    return sprite;
  }

  private addBanner(position: Point) {
    const center = this.tileCenter(position);
    const banner = this.add
      .image(center.x + 18, center.y - 20, ASSETS.banner)
      .setDisplaySize(24, 32)
      .setOrigin(0.5, 0.85)
      .setDepth(this.tileDepth(position, 9));
    this.objectsLayer.add(banner);
  }

  private siteSize(assetKey: string) {
    if (assetKey === ASSETS.town) {
      return { width: 78, height: 78, originY: 0.82 };
    }
    if (assetKey === ASSETS.sawmill || assetKey === ASSETS.mine) {
      return { width: 66, height: 64, originY: 0.82 };
    }
    if (assetKey === ASSETS.obelisk) {
      return { width: 54, height: 70, originY: 0.84 };
    }
    return { width: 44, height: 42, originY: 0.78 };
  }

  private isSiteDone(siteId: string) {
    return this.state.flags.claimedSites.includes(siteId) || this.state.flags.visitedSites.includes(siteId);
  }

  private addFootstep(from: Point, to: Point) {
    const fromCenter = this.tileCenter(from);
    const toCenter = this.tileCenter(to);
    const line = this.add.line(0, 0, fromCenter.x, fromCenter.y, toCenter.x, toCenter.y, 0xf3da88, 0.36).setOrigin(0, 0);
    line.setLineWidth(3);
    line.setDepth(this.tileDepth(to, -0.5));
    this.markersLayer.add(line);
    this.tweens.add({
      targets: line,
      alpha: 0,
      duration: 260,
      onComplete: () => line.destroy()
    });
  }

  private tileCenter(point: Point) {
    return {
      x: ISO_ORIGIN_X + (point.x - point.y) * (ISO_TILE_WIDTH / 2),
      y: ISO_ORIGIN_Y + (point.x + point.y) * (ISO_TILE_HEIGHT / 2)
    };
  }

  private persistAndPublish() {
    saveGameState(this.state);
    this.publishHud();
  }

  private publishHud() {
    gameEvents.dispatchEvent(new CustomEvent('hud:update', { detail: toHudSnapshot(this.state) }));
  }

  private tileSeed(x: number, y: number) {
    return Math.abs((x * 73856093) ^ (y * 19349663));
  }

  private createAtmosphere() {
    const campfire = this.tileCenter(CAMPFIRE_POSITION);
    const shrine = this.tileCenter(SHRINE_POSITION);
    const campGlow = this.add
      .circle(campfire.x, campfire.y - 8, 78, 0xf0a94d, 0.08)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(this.tileDepth(CAMPFIRE_POSITION, -2));
    const shrineGlow = this.add
      .circle(shrine.x, shrine.y - 16, 92, 0x83d8ff, this.state.flags.shrineLit ? 0.1 : 0.05)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(this.tileDepth(SHRINE_POSITION, -2));

    this.tweens.add({
      targets: campGlow,
      alpha: 0.16,
      scaleX: 1.08,
      scaleY: 1.08,
      yoyo: true,
      repeat: -1,
      duration: 920,
      ease: 'Sine.easeInOut'
    });
    this.tweens.add({
      targets: shrineGlow,
      alpha: this.state.flags.shrineLit ? 0.18 : 0.09,
      scaleX: 1.05,
      scaleY: 1.05,
      yoyo: true,
      repeat: -1,
      duration: 1800,
      ease: 'Sine.easeInOut'
    });

    for (let i = 0; i < 7; i += 1) {
      const mote = this.add
        .circle(campfire.x - 10 + i * 4, campfire.y - 24 + (i % 3) * 5, 2, 0xffd87a, 0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(this.tileDepth(CAMPFIRE_POSITION, 6));
      this.tweens.add({
        targets: mote,
        y: mote.y - 22 - (i % 2) * 8,
        x: mote.x + (i % 2 === 0 ? 7 : -7),
        alpha: { from: 0.72, to: 0 },
        repeat: -1,
        delay: i * 140,
        duration: 1050 + i * 70,
        ease: 'Sine.easeOut',
        onRepeat: () => {
          mote.setPosition(campfire.x - 10 + i * 4, campfire.y - 24 + (i % 3) * 5);
        }
      });
    }

    for (let y = 0; y < MAP_HEIGHT; y += 1) {
      for (let x = 0; x < MAP_WIDTH; x += 1) {
        if (WORLD_MAP[y][x] !== 'w') {
          continue;
        }
        const center = this.tileCenter({ x, y });
        const seed = this.tileSeed(x, y);
        const shimmer = this.add
          .rectangle(center.x - 13 + (seed % 8), center.y + (seed % 6) - 2, 28, 2, 0x9de9ee, 0.2)
          .setDepth(this.tileDepth({ x, y }, -3));
        this.tweens.add({
          targets: shimmer,
          x: shimmer.x + 9,
          alpha: 0.52,
          yoyo: true,
          repeat: -1,
          delay: seed % 700,
          duration: 1250 + (seed % 360),
          ease: 'Sine.easeInOut'
        });
      }
    }
  }

  private drawIsoTile(graphics: Phaser.GameObjects.Graphics, style: TileStyle, x: number, y: number) {
    const center = this.tileCenter({ x, y });
    const halfWidth = ISO_TILE_WIDTH / 2;
    const halfHeight = ISO_TILE_HEIGHT / 2;
    const depth = style.depth;

    const top = { x: center.x, y: center.y - halfHeight };
    const right = { x: center.x + halfWidth, y: center.y };
    const bottom = { x: center.x, y: center.y + halfHeight };
    const left = { x: center.x - halfWidth, y: center.y };
    const rightDown = { x: right.x, y: right.y + depth };
    const bottomDown = { x: bottom.x, y: bottom.y + depth };
    const leftDown = { x: left.x, y: left.y + depth };

    graphics.fillStyle(style.sideRight, 1);
    graphics.fillTriangle(right.x, right.y, bottom.x, bottom.y, bottomDown.x, bottomDown.y);
    graphics.fillTriangle(right.x, right.y, bottomDown.x, bottomDown.y, rightDown.x, rightDown.y);

    graphics.fillStyle(style.sideLeft, 1);
    graphics.fillTriangle(left.x, left.y, bottom.x, bottom.y, bottomDown.x, bottomDown.y);
    graphics.fillTriangle(left.x, left.y, bottomDown.x, bottomDown.y, leftDown.x, leftDown.y);

    graphics.fillStyle(style.fill, 1);
    graphics.fillTriangle(top.x, top.y, right.x, right.y, bottom.x, bottom.y);
    graphics.fillTriangle(top.x, top.y, bottom.x, bottom.y, left.x, left.y);

    graphics.fillStyle(style.highlight, 0.24);
    graphics.fillTriangle(top.x, top.y + 1, right.x - 7, right.y, center.x, center.y + 3);
    graphics.fillStyle(style.shade, 0.2);
    graphics.fillTriangle(left.x + 7, left.y, bottom.x, bottom.y - 1, center.x, center.y + 4);

    graphics.lineStyle(1, style.edge, 0.55);
    graphics.lineBetween(top.x, top.y, right.x, right.y);
    graphics.lineBetween(right.x, right.y, bottom.x, bottom.y);
    graphics.lineBetween(bottom.x, bottom.y, left.x, left.y);
    graphics.lineBetween(left.x, left.y, top.x, top.y);
  }

  private tileDepth(point: Point, offset = 0) {
    return 40 + (point.x + point.y) * 10 + point.x * 0.01 + offset;
  }

  private updatePlayerDepth(point: Point) {
    const baseDepth = this.tileDepth(point, 8);
    this.playerShadow.setDepth(baseDepth - 1);
    this.playerSprite.setDepth(baseDepth);
  }
}
