import { ASSETS } from '../assets/manifest';
import type { ChestDefinition, EnemyDefinition, NpcDefinition, Point, SiteDefinition } from '../simulation/types';

export const TILE_SIZE = 48;

export type TileCode = 'g' | 'r' | 'f' | 'w' | 'm' | 's';

const MAP_ROWS = [
  'ffffffffffffffffffff',
  'fggggggrgggggggggggf',
  'fgggwwwrgggggffffggf',
  'fggggggrgggggggggggf',
  'fggffggrrrrgggwwgggf',
  'fggfgggggggrggwwgggf',
  'fggfgggggggrgggggggf',
  'fgggrrrrgggrrrgggggf',
  'fggggggrggggggrggggf',
  'fggwwwgrggmgggrggggf',
  'fggggggrggmgggrggggf',
  'fggggggrggggggrggggf',
  'fggggggggggggggggggf',
  'ffffffffffffffffffff'
] as const;

const rowWidth = MAP_ROWS[0].length;
if (!MAP_ROWS.every((row) => row.length === rowWidth)) {
  throw new Error('WORLD_MAP rows must have equal width.');
}

export const WORLD_MAP: TileCode[][] = MAP_ROWS.map((row) => row.split('') as TileCode[]);
export const MAP_WIDTH = rowWidth;
export const MAP_HEIGHT = WORLD_MAP.length;

export const START_POSITION: Point = { x: 3, y: 11 };
export const ELDER_POSITION: Point = { x: 4, y: 10 };
export const CAMPFIRE_POSITION: Point = { x: 5, y: 10 };
export const SHRINE_POSITION: Point = { x: 15, y: 3 };

export const NPCS: NpcDefinition[] = [
  {
    id: 'elder-mira',
    name: 'Старшая Мира',
    position: ELDER_POSITION
  }
];

export const CHESTS: ChestDefinition[] = [
  {
    id: 'road-cache',
    position: { x: 8, y: 7 },
    loot: { potions: 1 },
    message: 'В дорожном тайнике лежит зелье.'
  },
  {
    id: 'river-cache',
    position: { x: 3, y: 3 },
    loot: { shards: 1, potions: 1 },
    message: 'В мокром сундуке найден первый осколок и зелье.'
  },
  {
    id: 'stone-cache',
    position: { x: 12, y: 10 },
    loot: { shards: 1 },
    message: 'Под каменной крышкой мерцает второй осколок.'
  }
];

export const ENEMIES: EnemyDefinition[] = [
  {
    id: 'west-slime',
    name: 'Страж болота',
    position: { x: 6, y: 5 },
    maxHp: 12,
    attack: 3,
    xp: 3,
    shardReward: 0
  },
  {
    id: 'road-slime',
    name: 'Дорожный страж',
    position: { x: 11, y: 7 },
    maxHp: 16,
    attack: 4,
    xp: 4,
    shardReward: 1
  },
  {
    id: 'shrine-guard',
    name: 'Страж корней',
    position: { x: 15, y: 5 },
    maxHp: 22,
    attack: 5,
    xp: 6,
    shardReward: 0
  }
];

export const MAP_SITES: SiteDefinition[] = [
  {
    id: 'dawn-town',
    kind: 'town',
    name: 'Форт Рассвета',
    position: { x: 2, y: 10 },
    assetKey: ASSETS.town,
    reward: { army: 4 },
    message: 'Форт Рассвета присоединяет к отряду новых копейщиков.',
    claimedMessage: 'Форт уже под твоим знаменем.'
  },
  {
    id: 'west-sawmill',
    kind: 'mine',
    name: 'Лесопилка',
    position: { x: 3, y: 8 },
    assetKey: ASSETS.sawmill,
    reward: { wood: 2 },
    dailyYield: { wood: 1 },
    message: 'Лесопилка захвачена. Каждый новый день она дает древесину.',
    claimedMessage: 'Рабочие лесопилки уже грузят древесину для твоего отряда.'
  },
  {
    id: 'stone-mine',
    kind: 'mine',
    name: 'Каменоломня',
    position: { x: 10, y: 9 },
    assetKey: ASSETS.mine,
    reward: { ore: 2 },
    dailyYield: { ore: 1 },
    message: 'Каменоломня под твоим контролем. Руда будет приходить каждый день.',
    claimedMessage: 'Каменоломня уже работает на тебя.'
  },
  {
    id: 'gold-pile',
    kind: 'resource',
    name: 'Сундук золота',
    position: { x: 8, y: 3 },
    assetKey: ASSETS.gold,
    reward: { gold: 650 },
    message: 'В походном сундуке найдено 650 золота.'
  },
  {
    id: 'wood-pile',
    kind: 'resource',
    name: 'Склад бревен',
    position: { x: 4, y: 6 },
    assetKey: ASSETS.wood,
    reward: { wood: 3 },
    message: 'Отряд забирает аккуратно сложенные бревна.'
  },
  {
    id: 'ore-pile',
    kind: 'resource',
    name: 'Груда руды',
    position: { x: 13, y: 8 },
    assetKey: ASSETS.ore,
    reward: { ore: 3 },
    message: 'В повозки погружена тяжелая руда.'
  },
  {
    id: 'crystal-cache',
    kind: 'resource',
    name: 'Кристаллы маны',
    position: { x: 14, y: 4 },
    assetKey: ASSETS.crystal,
    reward: { crystals: 2, shards: 1 },
    message: 'Кристаллы звенят в мешке. Один осколок подходит для ритуала.'
  },
  {
    id: 'ancient-obelisk',
    kind: 'lore',
    name: 'Обелиск',
    position: { x: 16, y: 9 },
    assetKey: ASSETS.obelisk,
    reward: { movement: 5 },
    message: 'Обелиск открывает короткую тропу. Сегодня у героя больше хода.',
    claimedMessage: 'Руны обелиска уже прочитаны.'
  }
];

export function isPassableTile(tile: TileCode | undefined) {
  return tile === 'g' || tile === 'r' || tile === 'm' || tile === 's';
}
