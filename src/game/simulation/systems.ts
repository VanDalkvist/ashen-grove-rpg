import {
  CAMPFIRE_POSITION,
  CHESTS,
  ELDER_POSITION,
  ENEMIES,
  MAP_SITES,
  MAP_HEIGHT,
  MAP_WIDTH,
  NPCS,
  SHRINE_POSITION,
  WORLD_MAP,
  isPassableTile
} from '../content/world';
import { addLog, REQUIRED_SHARDS } from './state';
import type { BattleAction, ChestDefinition, EnemyDefinition, GameState, Point, ResourceReward, SiteDefinition } from './types';

export type Direction = 'up' | 'down' | 'left' | 'right';

export type ActionResult = {
  moved?: boolean;
  positionChanged?: boolean;
  battleChanged?: boolean;
  completed?: boolean;
};

const DIRECTIONS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

function samePoint(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y;
}

function isAdjacent(a: Point, b: Point) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

function occupiedByBlockingObject(state: GameState, position: Point) {
  if (samePoint(position, ELDER_POSITION) || samePoint(position, CAMPFIRE_POSITION) || samePoint(position, SHRINE_POSITION)) {
    return true;
  }

  return (
    CHESTS.some((chest) => !state.flags.openedChests.includes(chest.id) && samePoint(chest.position, position)) ||
    ENEMIES.some((enemy) => !state.flags.defeatedEnemies.includes(enemy.id) && samePoint(enemy.position, position)) ||
    MAP_SITES.some((site) => !isSiteCleared(state, site) && samePoint(site.position, position))
  );
}

function enemyAt(state: GameState, position: Point) {
  return ENEMIES.find((enemy) => !state.flags.defeatedEnemies.includes(enemy.id) && samePoint(enemy.position, position));
}

function adjacentEnemy(state: GameState) {
  return ENEMIES.find((enemy) => !state.flags.defeatedEnemies.includes(enemy.id) && isAdjacent(state.player, enemy.position));
}

function adjacentChest(state: GameState) {
  return CHESTS.find((chest) => !state.flags.openedChests.includes(chest.id) && isAdjacent(state.player, chest.position));
}

function adjacentSite(state: GameState) {
  return MAP_SITES.find((site) => isAdjacent(state.player, site.position));
}

function adjacentNpc(state: GameState) {
  return NPCS.find((npc) => isAdjacent(state.player, npc.position));
}

function adjacentTo(state: GameState, position: Point) {
  return isAdjacent(state.player, position);
}

export function canMoveTo(state: GameState, position: Point) {
  if (position.x < 0 || position.y < 0 || position.x >= MAP_WIDTH || position.y >= MAP_HEIGHT) {
    return false;
  }

  return isPassableTile(WORLD_MAP[position.y]?.[position.x]) && !occupiedByBlockingObject(state, position);
}

export function movePlayer(state: GameState, direction: Direction): ActionResult {
  if (state.battle || state.flags.won) {
    return {};
  }

  if (state.player.movement <= 0) {
    addLog(state, 'Ход героя закончился. Заверши день, чтобы восстановить движение.');
    return {};
  }

  const delta = DIRECTIONS[direction];
  const next = { x: state.player.x + delta.x, y: state.player.y + delta.y };
  const enemy = enemyAt(state, next);

  if (enemy) {
    const defeated = autoResolveEncounter(state, enemy);
    if (defeated) {
      state.player.x = next.x;
      state.player.y = next.y;
      spendMovement(state, next);
      return { moved: true, positionChanged: true };
    }
    return { positionChanged: true };
  }

  if (!canMoveTo(state, next)) {
    return {};
  }

  state.player.x = next.x;
  state.player.y = next.y;
  spendMovement(state, next);
  return { moved: true, positionChanged: true };
}

export function interact(state: GameState): ActionResult {
  if (state.battle) {
    return {};
  }

  if (state.player.hp <= 0) {
    state.player.hp = Math.ceil(state.player.maxHp * 0.55);
    addLog(state, 'Ты приходишь в себя у костра. Роща дает второй шанс.');
    return { positionChanged: true };
  }

  if (adjacentTo(state, CAMPFIRE_POSITION)) {
    state.player.hp = state.player.maxHp;
    state.player.movement = Math.min(state.player.maxMovement, state.player.movement + 4);
    addLog(state, 'Лагерь восстанавливает силы: здоровье полное, ход героя немного вырос.');
    return {};
  }

  const site = adjacentSite(state);
  if (site) {
    visitSite(state, site);
    return { positionChanged: true };
  }

  const chest = adjacentChest(state);
  if (chest) {
    openChest(state, chest);
    return { positionChanged: true };
  }

  const enemy = adjacentEnemy(state);
  if (enemy) {
    autoResolveEncounter(state, enemy);
    return { positionChanged: true };
  }

  if (adjacentTo(state, SHRINE_POSITION)) {
    return activateShrine(state);
  }

  if (adjacentNpc(state)) {
    return talkToElder(state);
  }

  addLog(state, 'Здесь нечего трогать.');
  return {};
}

function talkToElder(state: GameState): ActionResult {
  if (!state.flags.talkedToElder) {
    state.flags.talkedToElder = true;
    addLog(state, 'Мира: "Захватывай шахты, собирай ресурсы и принеси три осколка к святилищу."');
    return {};
  }

  if (state.flags.shrineLit && !state.flags.won) {
    state.flags.won = true;
    addLog(state, 'Мира завершает ритуал. Туман расступается, роща снова дышит.');
    return { completed: true };
  }

  if (state.player.shards >= REQUIRED_SHARDS) {
    addLog(state, 'Мира кивает на северо-восток: "Теперь к святилищу."');
  } else {
    addLog(state, 'Мира ждет осколки и советует держаться дорог.');
  }

  return {};
}

function openChest(state: GameState, chest: ChestDefinition) {
  state.flags.openedChests.push(chest.id);
  state.player.potions += chest.loot.potions ?? 0;
  state.player.shards += chest.loot.shards ?? 0;
  state.player.gold += chest.loot.shards ? 150 : 80;
  addLog(state, chest.message);
}

function activateShrine(state: GameState): ActionResult {
  if (!state.flags.talkedToElder) {
    addLog(state, 'Святилище молчит. Возможно, Старшая Мира знает больше.');
    return {};
  }

  if (state.player.shards < REQUIRED_SHARDS) {
    addLog(state, 'Осколков не хватает: святилище гаснет под пальцами.');
    return {};
  }

  if (!state.flags.defeatedEnemies.includes('shrine-guard')) {
    const guard = ENEMIES.find((enemy) => enemy.id === 'shrine-guard');
    if (guard) {
      autoResolveEncounter(state, guard);
      return { positionChanged: true };
    }
  }

  state.flags.shrineLit = true;
  addLog(state, 'Три осколка загораются в чаше святилища.');
  return {};
}

function startBattle(state: GameState, enemy: EnemyDefinition) {
  state.battle = {
    enemyId: enemy.id,
    enemyHp: enemy.maxHp,
    enemyMaxHp: enemy.maxHp,
    enemyName: enemy.name
  };
  addLog(state, `${enemy.name} преграждает путь.`);
}

function visitSite(state: GameState, site: SiteDefinition) {
  const wasClaimed = state.flags.claimedSites.includes(site.id);
  const wasVisited = state.flags.visitedSites.includes(site.id);

  if ((site.kind === 'resource' || site.kind === 'lore') && wasVisited) {
    addLog(state, site.claimedMessage ?? `${site.name} уже осмотрен.`);
    return;
  }

  if ((site.kind === 'mine' || site.kind === 'town') && wasClaimed) {
    addLog(state, site.claimedMessage ?? `${site.name} уже под твоим знаменем.`);
    return;
  }

  if (site.kind === 'mine' || site.kind === 'town') {
    state.flags.claimedSites.push(site.id);
  } else {
    state.flags.visitedSites.push(site.id);
  }

  applyReward(state, site.reward ?? {});
  addLog(state, site.message);
}

function applyReward(state: GameState, reward: ResourceReward) {
  state.player.gold += reward.gold ?? 0;
  state.player.wood += reward.wood ?? 0;
  state.player.ore += reward.ore ?? 0;
  state.player.crystals += reward.crystals ?? 0;
  state.player.army += reward.army ?? 0;
  state.player.movement = Math.min(state.player.maxMovement, state.player.movement + (reward.movement ?? 0));
  state.player.shards += reward.shards ?? 0;
  state.player.potions += reward.potions ?? 0;
}

function isSiteCleared(state: GameState, site: SiteDefinition) {
  if (site.kind === 'resource' || site.kind === 'lore') {
    return state.flags.visitedSites.includes(site.id);
  }
  return false;
}

function spendMovement(state: GameState, position: Point) {
  const tile = WORLD_MAP[position.y]?.[position.x];
  const cost = tile === 'r' ? 1 : tile === 'm' || tile === 's' ? 3 : 2;
  state.player.movement = Math.max(0, state.player.movement - cost);
}

function autoResolveEncounter(state: GameState, enemy: EnemyDefinition) {
  const heroPower = state.player.army * 2 + state.player.attack + state.player.level * 3;
  const enemyPower = enemy.maxHp + enemy.attack * 3;
  const loss = Math.max(1, Math.ceil(enemy.attack + enemy.maxHp / 8));

  if (heroPower < enemyPower) {
    const hpLoss = Math.min(state.player.hp - 1, Math.max(2, enemy.attack));
    state.player.hp = Math.max(1, state.player.hp - hpLoss);
    addLog(state, `${enemy.name} слишком силен. Нужен отряд крупнее; герой отступает.`);
    return false;
  }

  state.flags.defeatedEnemies.push(enemy.id);
  state.player.army = Math.max(1, state.player.army - loss);
  state.player.xp += enemy.xp;
  state.player.shards += enemy.shardReward;
  state.player.gold += 120 + enemy.xp * 30;
  addLog(state, `${enemy.name} разбит автобоем. Потери отряда: ${loss}.`);

  if (enemy.shardReward > 0) {
    addLog(state, 'Среди трофеев найден магический осколок.');
  }

  while (state.player.xp >= state.player.nextLevelXp) {
    state.player.xp -= state.player.nextLevelXp;
    state.player.level += 1;
    state.player.maxHp += 4;
    state.player.attack += 2;
    state.player.maxMovement += 1;
    state.player.hp = state.player.maxHp;
    state.player.nextLevelXp += 4;
    addLog(state, `Уровень ${state.player.level}: атака и запас хода выросли.`);
  }

  return true;
}

export function endTurn(state: GameState): ActionResult {
  state.player.day += 1;
  state.player.movement = state.player.maxMovement;
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + 3);

  const daily: ResourceReward = {};
  for (const siteId of state.flags.claimedSites) {
    const site = MAP_SITES.find((candidate) => candidate.id === siteId);
    if (!site?.dailyYield) {
      continue;
    }
    daily.gold = (daily.gold ?? 0) + (site.dailyYield.gold ?? 0);
    daily.wood = (daily.wood ?? 0) + (site.dailyYield.wood ?? 0);
    daily.ore = (daily.ore ?? 0) + (site.dailyYield.ore ?? 0);
    daily.crystals = (daily.crystals ?? 0) + (site.dailyYield.crystals ?? 0);
  }
  applyReward(state, daily);

  const income = [
    daily.gold ? `${daily.gold} золота` : null,
    daily.wood ? `${daily.wood} дерева` : null,
    daily.ore ? `${daily.ore} руды` : null,
    daily.crystals ? `${daily.crystals} кристаллов` : null
  ].filter(Boolean);
  addLog(state, `День ${state.player.day}. ${income.length ? `Доход: ${income.join(', ')}.` : 'Дохода пока нет: захвати шахты.'}`);

  return { positionChanged: true };
}

export function performBattleAction(state: GameState, action: BattleAction): ActionResult {
  if (!state.battle) {
    return {};
  }

  const enemy = ENEMIES.find((candidate) => candidate.id === state.battle?.enemyId);
  if (!enemy) {
    state.battle = null;
    return { battleChanged: true };
  }

  if (action === 'potion') {
    if (state.player.potions <= 0) {
      addLog(state, 'Зелий больше нет.');
      return {};
    }

    state.player.potions -= 1;
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 12);
    addLog(state, 'Ты выпиваешь зелье и продолжаешь бой.');
  } else {
    const damage = action === 'spark' ? state.player.attack + 3 : state.player.attack;
    state.battle.enemyHp = Math.max(0, state.battle.enemyHp - damage);
    addLog(state, action === 'spark' ? `Искра прожигает врага на ${damage}.` : `Удар наносит ${damage} урона.`);
  }

  if (state.battle.enemyHp <= 0) {
    resolveVictory(state, enemy);
    return { battleChanged: true, positionChanged: true };
  }

  const incoming = Math.max(1, enemy.attack - Math.floor(state.player.level / 2));
  state.player.hp = Math.max(0, state.player.hp - incoming);
  addLog(state, `${enemy.name} отвечает на ${incoming} урона.`);

  if (state.player.hp <= 0) {
    addLog(state, 'Ты падаешь. Нажми E у костра, чтобы подняться.');
    state.battle = null;
    state.player.x = 5;
    state.player.y = 11;
    return { battleChanged: true, positionChanged: true };
  }

  return { battleChanged: true };
}

function resolveVictory(state: GameState, enemy: EnemyDefinition) {
  state.flags.defeatedEnemies.push(enemy.id);
  state.player.x = Math.max(1, state.player.x);
  state.player.xp += enemy.xp;
  state.player.shards += enemy.shardReward;
  state.battle = null;

  addLog(
    state,
    enemy.shardReward > 0
      ? `${enemy.name} рассыпается. Среди искр найден осколок.`
      : `${enemy.name} побежден.`
  );

  while (state.player.xp >= state.player.nextLevelXp) {
    state.player.xp -= state.player.nextLevelXp;
    state.player.level += 1;
    state.player.maxHp += 6;
    state.player.attack += 2;
    state.player.hp = state.player.maxHp;
    state.player.nextLevelXp += 4;
    addLog(state, `Уровень ${state.player.level}: здоровье и атака выросли.`);
  }
}
