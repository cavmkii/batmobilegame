import type { Rarity } from './types';

export const BALANCE = {
  lane: { length: 1000, playerSpawnX: 950, enemySpawnX: 50, playerBaseX: 985, enemyBaseX: 15 },
  energy: { max: 10, regen: 0.8, start: 3 },
  hand: { size: 4 },
  commander: { tax: 2 },
  knockback: { distance: 55, duration: 0.45 },
  /** Stats gain this fraction of base per level above 1. */
  levelScaling: 0.2,
  /** Enemy stats scale this much per map row. */
  enemyRowScaling: 0.15,
  evolvedMult: 1.25,
  upgradedCardMult: 1.3,
  levelCap: 10,
  evolvedLevelCap: 20,
  plusCap: 10,
  xp: {
    rarityMult: { common: 1, rare: 1.5, epic: 2, legendary: 3 } as Record<Rarity, number>,
    perLevel: 200,
    evolve: 5000,
    talent: 2000,
    dupeValue: { common: 500, rare: 1500, epic: 4000, legendary: 10000 } as Record<Rarity, number>,
  },
  gacha: {
    single: 150,
    ten: 1500,
    rates: { common: 0.65, rare: 0.26, epic: 0.08, legendary: 0.01 } as Record<Rarity, number>,
    pityEpic: 10,
    pityLegendary: 60,
  },
  run: {
    caveHp: 1500,
    deckCap: 20,
    coreMax: 8,
    startDeckSize: 8,
    rows: 8,
    restHealPct: 0.3,
  },
  rewards: {
    xp: { battle: 300, elite: 700, boss: 2500, perRow: 80 },
    glow: { battle: 20, elite: 50, boss: 300, perRow: 5 },
    figs: { battle: 25, elite: 60, boss: 0 },
    clearBonusMult: 1.5,
  },
  shop: {
    cardPrice: { common: 45, rare: 75, epic: 120, legendary: 200 } as Record<Rarity, number>,
    relic: 150,
    remove: 75,
    heal: 50,
  },
  draft: { weights: { common: 60, rare: 30, epic: 10, legendary: 0 } as Record<Rarity, number>, spellChance: 0.3 },
};
