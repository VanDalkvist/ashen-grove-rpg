import Phaser from 'phaser';
import { SVG_ASSETS } from '../../game/assets/manifest';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    for (const asset of SVG_ASSETS) {
      this.load.svg(asset.key, asset.url, { width: 64, height: 64 });
    }
  }

  create() {
    this.scene.start('GameScene');
  }
}
