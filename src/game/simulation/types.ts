export type Point = {
  x: number;
  y: number;
};

export type PlayerState = Point & {
  hp: number;
  maxHp: number;
  attack: number;
  level: number;
  xp: number;
  nextLevelXp: number;
  potions: number;
  shards: number;
  gold: number;
  wood: number;
  ore: number;
  crystals: number;
  army: number;
  movement: number;
  maxMovement: number;
  day: number;
};

export type BattleAction = 'attack' | 'spark' | 'potion';

export type BattleState = {
  enemyId: string;
  enemyHp: number;
  enemyMaxHp: number;
  enemyName: string;
};

export type GameFlags = {
  talkedToElder: boolean;
  shrineLit: boolean;
  won: boolean;
  openedChests: string[];
  defeatedEnemies: string[];
  claimedSites: string[];
  visitedSites: string[];
};

export type GameState = {
  player: PlayerState;
  battle: BattleState | null;
  flags: GameFlags;
  log: string[];
};

export type EnemyDefinition = {
  id: string;
  name: string;
  position: Point;
  maxHp: number;
  attack: number;
  xp: number;
  shardReward: number;
};

export type NpcDefinition = {
  id: string;
  name: string;
  position: Point;
};

export type ChestDefinition = {
  id: string;
  position: Point;
  loot: {
    potions?: number;
    shards?: number;
  };
  message: string;
};

export type ResourceReward = {
  gold?: number;
  wood?: number;
  ore?: number;
  crystals?: number;
  army?: number;
  movement?: number;
  shards?: number;
  potions?: number;
};

export type SiteKind = 'resource' | 'mine' | 'town' | 'lore';

export type SiteDefinition = {
  id: string;
  kind: SiteKind;
  name: string;
  position: Point;
  assetKey: string;
  reward?: ResourceReward;
  dailyYield?: ResourceReward;
  message: string;
  claimedMessage?: string;
};

export type QuestSnapshot = {
  text: string;
  requiredShards: number;
};

export type HudSnapshot = {
  player: PlayerState;
  battle: BattleState | null;
  quest: QuestSnapshot;
  log: string[];
};
