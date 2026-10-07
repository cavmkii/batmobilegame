import type { Rarity } from './types';

export const BALANCE = {
  /** Field in tiles: 5 columns; enemies enter at y=0 and walk down to the cave. */
  field: { cols: 5, roostRows: 3, height: 10, roostTopY: 6, caveY: 9.4 },
  /** Old lane stats (range/speed in lane units) convert to tiles with these factors. */
  units: { rangePerTile: 100, minMelee: 0.35, batSpeed: 2.5 / 100, enemySpeed: 1.6 / 100 },
  /** Guano: the in-level currency for placing bats, refreshing the pool and casting spells. */
  economy: { startGuano: 6, perDawn: 5, killsPerGuano: 4, refreshCost: 2, poolSize: 2, spellHandMax: 3 },
  /**
   * Roost levels. Two roosts of the same bat and the same level merge into one a level higher
   * (a pool card counts as a level-1 roost). Each level adds a bat (up to maxExtraBats) and
   * statPct to bat stats, so a merged roost is worth roughly the two it replaced.
   * Level 10 holds one mega bat instead of a group.
   */
  roostLevel: { max: 10, statPct: 25, hpPct: 20, batsPerLevel: 1, maxExtraBats: 4, megaHpMult: 3, megaAtkMult: 1.5, megaRespawnMult: 2 },
  /** An enemy that reaches the cave hits once for atk × leakMult, then is gone (classic TD leak).
   *  Inside the roost zone with nothing blocking its column, an enemy rushes at speed × rushMult. */
  night: { maxSeconds: 75, groupGap: 3, spawnGap: 0.7, leakMult: 4, rushMult: 3 },
  /** A roost destroyed at night is rebuilt at dawn with this fraction of its max HP. */
  rebuildHpPct: 50,
  /** The commander instead returns to the command zone; each placement costs `tax` more than the last. */
  commander: { tax: 2 },
  knockback: { distance: 0.5, duration: 0.4 },
  adjacency: { vampireDawnHealPct: 20 },
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
    caveHp: 1000,
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
