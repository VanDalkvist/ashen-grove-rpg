import Phaser from 'phaser';
import { BootScene } from './phaser/scenes/BootScene';
import { GameScene } from './phaser/scenes/GameScene';
import { gameEvents } from './game/events';
import type { HudSnapshot } from './game/simulation/types';
import './style.css';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  backgroundColor: '#162019',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1100,
    height: 720
  },
  scene: [BootScene, GameScene]
};

const byId = <T extends HTMLElement>(id: string) => {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing DOM element: ${id}`);
  }
  return element as T;
};

const hpValue = byId('hp-value');
const dayValue = byId('day-value');
const movementValue = byId('movement-value');
const armyValue = byId('army-value');
const levelValue = byId('level-value');
const xpValue = byId('xp-value');
const shardsValue = byId('shards-value');
const goldValue = byId('gold-value');
const woodValue = byId('wood-value');
const oreValue = byId('ore-value');
const crystalsValue = byId('crystals-value');
const hpBar = byId('hp-bar');
const questText = byId('quest-text');
const logList = byId<HTMLOListElement>('log-list');
const battlePanel = byId('battle-panel');
const battleTitle = byId('battle-title');
const enemyHp = byId('enemy-hp');

function renderHud(snapshot: HudSnapshot) {
  hpValue.textContent = `${snapshot.player.hp} / ${snapshot.player.maxHp}`;
  dayValue.textContent = String(snapshot.player.day);
  movementValue.textContent = `${snapshot.player.movement} / ${snapshot.player.maxMovement}`;
  armyValue.textContent = `Отряд: ${snapshot.player.army}`;
  levelValue.textContent = String(snapshot.player.level);
  xpValue.textContent = `${snapshot.player.xp} / ${snapshot.player.nextLevelXp}`;
  shardsValue.textContent = `${snapshot.player.shards} / ${snapshot.quest.requiredShards}`;
  goldValue.textContent = String(snapshot.player.gold);
  woodValue.textContent = String(snapshot.player.wood);
  oreValue.textContent = String(snapshot.player.ore);
  crystalsValue.textContent = String(snapshot.player.crystals);
  hpBar.style.width = `${Math.max(0, Math.round((snapshot.player.hp / snapshot.player.maxHp) * 100))}%`;
  questText.textContent = snapshot.quest.text;

  logList.replaceChildren(
    ...snapshot.log.slice(-5).map((entry) => {
      const item = document.createElement('li');
      item.textContent = entry;
      return item;
    })
  );

  if (snapshot.battle) {
    battlePanel.hidden = false;
    battleTitle.textContent = snapshot.battle.enemyName;
    enemyHp.textContent = `${snapshot.battle.enemyHp} / ${snapshot.battle.enemyMaxHp}`;
  } else {
    battlePanel.hidden = true;
  }
}

function emitUiAction(action: string, payload?: unknown) {
  gameEvents.dispatchEvent(new CustomEvent('ui:action', { detail: { action, payload } }));
}

gameEvents.addEventListener('hud:update', (event) => {
  renderHud((event as CustomEvent<HudSnapshot>).detail);
});

byId('reset-button').addEventListener('click', () => emitUiAction('reset'));
byId('end-turn-button').addEventListener('click', () => emitUiAction('end-turn'));

window.addEventListener('keydown', (event) => {
  if (event.repeat) {
    return;
  }

  if (event.key === ' ' || event.key.toLowerCase() === 'e') {
    event.preventDefault();
    emitUiAction('interact');
  }

  if (event.key.toLowerCase() === 'n') {
    emitUiAction('end-turn');
  }
});

new Phaser.Game(config);
