import { BATS } from './bats';

/**
 * The collection layer: where each bat lives, a conservation note where it matters,
 * region sets to complete, and milestones for species discovered.
 */
export type Region = 'North America' | 'Latin America' | 'Africa' | 'Eurasia' | 'Asia-Pacific';

export const REGION_ICON: Record<Region, string> = {
  'North America': '🌲',
  'Latin America': '🌴',
  Africa: '🌍',
  Eurasia: '🏔',
  'Asia-Pacific': '🌏',
};

export const REGION: Record<string, Region> = {
  egyptian_fruit: 'Africa',
  straw_fruit: 'Africa',
  hammerhead: 'Africa',
  epauletted: 'Africa',
  little_brown: 'North America',
  big_brown: 'North America',
  eastern_red: 'North America',
  hoary: 'North America',
  tricolored: 'North America',
  northern_long_eared: 'North America',
  indiana: 'North America',
  townsends: 'North America',
  pallid: 'North America',
  free_tailed: 'North America',
  long_nosed: 'North America',
  mexican_long_tongued: 'North America',
  greater_long_nosed: 'North America',
  common_vampire: 'Latin America',
  hairy_legged: 'Latin America',
  white_winged: 'Latin America',
  lesser_bulldog: 'Latin America',
  greater_bulldog: 'Latin America',
  fishing_bat: 'Latin America',
  pallas_tongue: 'Latin America',
  tube_lipped: 'Latin America',
  jamaican_fruit: 'Latin America',
  sebas: 'Latin America',
  geoffroys_tailless: 'Latin America',
  spectral_bat: 'Latin America',
  long_eared: 'Eurasia',
  daubentons: 'Eurasia',
  rickett: 'Eurasia',
  greater_noctule: 'Eurasia',
  flying_fox: 'Asia-Pacific',
  ghost_bat: 'Asia-Pacific',
};

/** Short conservation notes, only where the status is notable and well established. */
export const STATUS: Record<string, string> = {
  indiana: 'US endangered (since 1967)',
  northern_long_eared: 'US endangered (2023)',
  greater_long_nosed: 'US endangered',
  tricolored: 'Severe declines from white-nose syndrome',
  little_brown: 'Severe declines from white-nose syndrome',
  ghost_bat: 'Listed as vulnerable in Australia',
};

/** Every collectable species (the basic Fledgling isn't one). */
export const COLLECTABLE = BATS.filter((b) => !b.basic).map((b) => b.id);

export const REGIONS: Region[] = ['North America', 'Latin America', 'Africa', 'Eurasia', 'Asia-Pacific'];

export const regionMembers = (r: Region) => COLLECTABLE.filter((id) => REGION[id] === r);

export interface Reward {
  id: string;
  label: string;
  glow: number;
  xp: number;
  /** Bats that must all be owned. */
  needs: (owned: Set<string>) => boolean;
  progress: (owned: Set<string>) => [number, number];
}

const count = (owned: Set<string>, ids: string[]) => ids.filter((id) => owned.has(id)).length;

export const MILESTONES: Reward[] = [10, 15, 20, 25, 30, COLLECTABLE.length].map((n) => ({
  id: `species_${n}`,
  label: n === COLLECTABLE.length ? 'Complete field guide' : `${n} species`,
  glow: n === COLLECTABLE.length ? 3000 : n * 40,
  xp: n * 200,
  needs: (o) => count(o, COLLECTABLE) >= n,
  progress: (o) => [Math.min(n, count(o, COLLECTABLE)), n],
}));

export const REGION_SETS: Reward[] = REGIONS.map((r) => {
  const ids = regionMembers(r);
  return {
    id: `region_${r}`,
    label: `${REGION_ICON[r]} ${r} set`,
    glow: 150 + ids.length * 40,
    xp: ids.length * 300,
    needs: (o) => ids.every((id) => o.has(id)),
    progress: (o) => [count(o, ids), ids.length],
  };
});
