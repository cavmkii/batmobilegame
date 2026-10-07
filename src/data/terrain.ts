import type { ClanId, TerrainId } from './types';

export interface TerrainDef {
  id: TerrainId;
  name: string;
  icon: string;
  clan: ClanId;
  desc: string;
  /** Why this clan likes it: real ecology. */
  basis: string;
  color: string;
}

export const TERRAIN: Record<TerrainId, TerrainDef> = {
  pond: { id: 'pond', name: 'Pond', icon: '💧', clan: 'PIS', color: '#2a5a8a',
    desc: 'Piscivore roost: bats +40% attack.', basis: 'Fishing bats trawl still water for fish.' },
  fig: { id: 'fig', name: 'Fig Tree', icon: '🌳', clan: 'FRU', color: '#3a6a2a',
    desc: 'Frugivore roost: +50% roost HP, bats +30% HP.', basis: 'Fig trees are a staple food and roost for fruit bats.' },
  cactus: { id: 'cactus', name: 'Flowering Cactus', icon: '🌵', clan: 'NEC', color: '#6a8a3a',
    desc: 'Nectarivore roost: auras +50% stronger.', basis: 'Nectar bats are key pollinators of columnar cacti.' },
  lamp: { id: 'lamp', name: 'Street Lamp', icon: '💡', clan: 'INS', color: '#8a7a2a',
    desc: 'Insectivore roost: bats attack 35% faster.', basis: 'Lights draw insects, and many insect-eating bats hunt around them.' },
  pen: { id: 'pen', name: 'Cattle Pen', icon: '🐄', clan: 'SAN', color: '#6a3a3a',
    desc: 'Sanguivore roost: bats +25% lifesteal.', basis: 'Common vampire bats feed mostly on livestock.' },
};

export const TERRAIN_IDS = Object.keys(TERRAIN) as TerrainId[];
