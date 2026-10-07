import { BALANCE } from '../data/balance';
import { BATS, BAT_BY_ID } from '../data/bats';
import type { Rarity } from '../data/types';
import { dupeXp, newOwnedBat } from './progression';
import type { Profile } from './profile';
import type { Rng } from './rng';

export const GACHA_POOL: Record<Rarity, string[]> = {
  common: [],
  rare: [],
  epic: [],
  legendary: [],
};
for (const b of BATS) if (!b.basic) GACHA_POOL[b.rarity].push(b.id);

export interface PullResult {
  batId: string;
  rarity: Rarity;
  isNew: boolean;
  pity: boolean;
}

const RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

function rollRarity(rng: Rng, floor: Rarity): Rarity {
  const rates = { ...BALANCE.gacha.rates };
  for (const r of Object.keys(rates) as Rarity[]) if (RANK[r] < RANK[floor]) rates[r] = 0;
  return rng.weighted(rates);
}

/** Pull `count` bats. Applies pity and the ten-pull rare guarantee. Mutates the profile. */
export function pull(p: Profile, rng: Rng, count: 1 | 10): PullResult[] {
  const cost = count === 10 ? BALANCE.gacha.ten : BALANCE.gacha.single;
  if (p.glow < cost) return [];
  p.glow -= cost;
  const results: PullResult[] = [];
  for (let i = 0; i < count; i++) {
    let floor: Rarity = 'common';
    let pity = false;
    if (p.pity.sinceLegendary >= BALANCE.gacha.pityLegendary - 1) {
      floor = 'legendary';
      pity = true;
    } else if (p.pity.sinceEpic >= BALANCE.gacha.pityEpic - 1) {
      floor = 'epic';
      pity = true;
    } else if (count === 10 && i === 9 && results.every((r) => r.rarity === 'common')) {
      floor = 'rare';
    }
    const rarity = rollRarity(rng, floor);
    const batId = rng.pick(GACHA_POOL[rarity]);

    p.pity.sinceEpic = RANK[rarity] >= RANK.epic ? 0 : p.pity.sinceEpic + 1;
    p.pity.sinceLegendary = rarity === 'legendary' ? 0 : p.pity.sinceLegendary + 1;
    p.stats.pulls++;

    const isNew = !p.roster[batId];
    if (isNew) p.roster[batId] = newOwnedBat();
    else p.pendingDupes.push(batId);
    results.push({ batId, rarity, isNew, pity });
  }
  return results;
}

export const canTakePlus = (p: Profile, batId: string) => (p.roster[batId]?.plus ?? 0) < BALANCE.plusCap;

/** Resolve one pending duplicate as +1 plus-level or as XP. */
export function resolveDupe(p: Profile, batId: string, choice: 'plus' | 'xp') {
  const i = p.pendingDupes.indexOf(batId);
  if (i < 0) return;
  p.pendingDupes.splice(i, 1);
  if (choice === 'plus' && canTakePlus(p, batId)) p.roster[batId].plus++;
  else p.xp += dupeXp(BAT_BY_ID[batId]);
}
