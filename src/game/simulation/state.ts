import { START_POSITION } from '../content/world';
import type { GameState, HudSnapshot, QuestSnapshot } from './types';

export const REQUIRED_SHARDS = 3;
const SAVE_KEY = 'ashen-grove-rpg:v1';

export function createGameState(): GameState {
  return {
    player: {
      ...START_POSITION,
      hp: 24,
      maxHp: 24,
      attack: 5,
      level: 1,
      xp: 0,
      nextLevelXp: 6,
      potions: 1,
      shards: 0,
      gold: 1200,
      wood: 4,
      ore: 3,
      crystals: 0,
      army: 12,
      movement: 24,
      maxMovement: 24,
      day: 1
    },
    battle: null,
    flags: {
      talkedToElder: false,
      shrineLit: false,
      won: false,
      openedChests: [],
      defeatedEnemies: [],
      claimedSites: [],
      visitedSites: []
    },
    log: ['День 1. Герой выходит на карту приключений у Форта Рассвета.']
  };
}

function normalizeGameState(state: GameState): GameState {
  const fresh = createGameState();
  return {
    ...fresh,
    ...state,
    player: {
      ...fresh.player,
      ...state.player
    },
    flags: {
      ...fresh.flags,
      ...state.flags
    },
    log: Array.isArray(state.log) ? state.log : fresh.log,
    battle: null
  };
}

export function loadGameState(): GameState {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    return createGameState();
  }

  try {
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed.player || !parsed.flags || !Array.isArray(parsed.log)) {
      return createGameState();
    }
    return normalizeGameState(parsed);
  } catch {
    return createGameState();
  }
}

export function saveGameState(state: GameState) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function clearSavedGame() {
  localStorage.removeItem(SAVE_KEY);
}

export function addLog(state: GameState, message: string) {
  state.log.push(message);
  state.log = state.log.slice(-24);
}

export function getQuestSnapshot(state: GameState): QuestSnapshot {
  if (state.flags.won) {
    return {
      text: 'Карта очищена. Можно начать новую неделю или продолжить собирать ресурсы.',
      requiredShards: REQUIRED_SHARDS
    };
  }

  if (!state.flags.talkedToElder) {
    return {
      text: 'Посети Старшую Миру и получи цель сценария.',
      requiredShards: REQUIRED_SHARDS
    };
  }

  if (state.player.shards < REQUIRED_SHARDS) {
    return {
      text: `Собери ${REQUIRED_SHARDS} магических осколка на карте приключений. Сейчас: ${state.player.shards}.`,
      requiredShards: REQUIRED_SHARDS
    };
  }

  if (!state.flags.shrineLit) {
    return {
      text: 'Отнеси три осколка к северо-восточному святилищу.',
      requiredShards: REQUIRED_SHARDS
    };
  }

  return {
    text: 'Вернись к Старшей Мире и заверши ритуал.',
    requiredShards: REQUIRED_SHARDS
  };
}

export function toHudSnapshot(state: GameState): HudSnapshot {
  return {
    player: { ...state.player },
    battle: state.battle ? { ...state.battle } : null,
    quest: getQuestSnapshot(state),
    log: [...state.log]
  };
}
