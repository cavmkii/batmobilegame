import { MILESTONES, REGION_SETS, type Reward } from '../data/fieldguide';
import type { Profile } from './profile';

export const ownedSet = (p: Profile) => new Set(Object.keys(p.roster));

/** Rewards earned but not yet claimed. */
export function claimable(p: Profile): Reward[] {
  const owned = ownedSet(p);
  return [...MILESTONES, ...REGION_SETS].filter((r) => r.needs(owned) && !p.claimed.includes(r.id));
}

export function claim(p: Profile, id: string): Reward | null {
  const r = claimable(p).find((x) => x.id === id);
  if (!r) return null;
  p.claimed.push(r.id);
  p.glow += r.glow;
  p.xp += r.xp;
  return r;
}
