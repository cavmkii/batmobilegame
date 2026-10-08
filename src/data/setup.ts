import type { TerrainId } from './types';

/**
 * Run setup choices on the Play screen: the map (biome) and optional modifiers.
 * A biome changes which terrain tiles appear (and so which clans thrive); modifiers make a
 * run harder in a specific way and pay a reward bonus for it.
 */
export interface Biome {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** Relative chance of each terrain type showing up on a level's grid. */
  terrain: Record<TerrainId, number>;
  /** Bottom colour of the night sky gradient, for a bit of identity. */
  tint: string;
}

export const BIOMES: Biome[] = [
  {
    id: 'cave_country', name: 'Cave Country', icon: '🏔', tint: '#14201a',
    desc: 'Karst hills riddled with caves. Every kind of terrain turns up.',
    terrain: { pond: 1, fig: 1, cactus: 1, lamp: 1, pen: 1 },
  },
  {
    id: 'sonoran', name: 'Sonoran Desert', icon: '🌵', tint: '#2a2014',
    desc: 'Saguaro and agave country. Flowering cacti everywhere; water is scarce. Good for nectar bats.',
    terrain: { pond: 0.3, fig: 0.2, cactus: 4, lamp: 1, pen: 1 },
  },
  {
    id: 'rainforest', name: 'Lowland Rainforest', icon: '🌴', tint: '#0e2418',
    desc: 'Fig trees and rivers. Good for fruit bats and fishing bats.',
    terrain: { pond: 3, fig: 4, cactus: 0.2, lamp: 0.3, pen: 0.5 },
  },
  {
    id: 'farmland', name: 'Farmland', icon: '🐄', tint: '#1e1e14',
    desc: 'Barns, yard lights and cattle. Good for insect-eaters and vampire bats.',
    terrain: { pond: 0.8, fig: 0.5, cactus: 0.2, lamp: 3, pen: 4 },
  },
];

export const BIOME_BY_ID: Record<string, Biome> = Object.fromEntries(BIOMES.map((b) => [b.id, b]));

export type ModifierEffect =
  | { kind: 'guanoPerDawn'; amount: number }
  | { kind: 'extraNights'; amount: number }
  | { kind: 'hidePreview' }
  | { kind: 'waveSize'; pct: number }
  | { kind: 'caveHp'; pct: number };

export interface Modifier {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** Extra run rewards (XP and Glowbugs), in percent. */
  bonusPct: number;
  effect: ModifierEffect;
}

export const MODIFIERS: Modifier[] = [
  { id: 'lean_times', name: 'Lean Times', icon: '🪨', bonusPct: 25,
    desc: '1 less guano every dawn.', effect: { kind: 'guanoPerDawn', amount: -1 } },
  { id: 'long_nights', name: 'Long Nights', icon: '🌑', bonusPct: 20,
    desc: 'Every level has 2 extra nights.', effect: { kind: 'extraNights', amount: 2 } },
  { id: 'new_moon', name: 'New Moon', icon: '🌚', bonusPct: 30,
    desc: "Tonight's enemies aren't shown during the day.", effect: { kind: 'hidePreview' } },
  { id: 'swarm_season', name: 'Swarm Season', icon: '🦗', bonusPct: 30,
    desc: 'Waves are 25% bigger.', effect: { kind: 'waveSize', pct: 25 } },
  { id: 'old_cave', name: 'Crumbling Cave', icon: '🕳', bonusPct: 20,
    desc: 'The cave starts with 30% less HP.', effect: { kind: 'caveHp', pct: -30 } },
];

export const MODIFIER_BY_ID: Record<string, Modifier> = Object.fromEntries(MODIFIERS.map((m) => [m.id, m]));

export const rewardBonusPct = (ids: string[]) => ids.reduce((a, id) => a + (MODIFIER_BY_ID[id]?.bonusPct ?? 0), 0);
