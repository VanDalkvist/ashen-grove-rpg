export const ASSETS = {
  hero: 'sprite:hero',
  elder: 'sprite:elder',
  slime: 'sprite:slime',
  chestClosed: 'sprite:chest-closed',
  chestOpen: 'sprite:chest-open',
  shard: 'sprite:shard',
  shrine: 'sprite:shrine',
  campfire: 'sprite:campfire',
  gold: 'sprite:gold',
  wood: 'sprite:wood',
  ore: 'sprite:ore',
  crystal: 'sprite:crystal',
  sawmill: 'sprite:sawmill',
  mine: 'sprite:mine',
  town: 'sprite:town',
  obelisk: 'sprite:obelisk',
  banner: 'sprite:banner'
} as const;

export const SVG_ASSETS: Array<{ key: string; url: string }> = [
  { key: ASSETS.hero, url: '/assets/sprites/hero.svg' },
  { key: ASSETS.elder, url: '/assets/sprites/elder.svg' },
  { key: ASSETS.slime, url: '/assets/sprites/slime.svg' },
  { key: ASSETS.chestClosed, url: '/assets/sprites/chest-closed.svg' },
  { key: ASSETS.chestOpen, url: '/assets/sprites/chest-open.svg' },
  { key: ASSETS.shard, url: '/assets/sprites/shard.svg' },
  { key: ASSETS.shrine, url: '/assets/sprites/shrine.svg' },
  { key: ASSETS.campfire, url: '/assets/sprites/campfire.svg' },
  { key: ASSETS.gold, url: '/assets/sprites/gold.svg' },
  { key: ASSETS.wood, url: '/assets/sprites/wood.svg' },
  { key: ASSETS.ore, url: '/assets/sprites/ore.svg' },
  { key: ASSETS.crystal, url: '/assets/sprites/crystal.svg' },
  { key: ASSETS.sawmill, url: '/assets/sprites/sawmill.svg' },
  { key: ASSETS.mine, url: '/assets/sprites/mine.svg' },
  { key: ASSETS.town, url: '/assets/sprites/town.svg' },
  { key: ASSETS.obelisk, url: '/assets/sprites/obelisk.svg' },
  { key: ASSETS.banner, url: '/assets/sprites/banner.svg' }
];
