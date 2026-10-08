import type { ClanId } from './types';

export interface ClanInfo {
  id: ClanId;
  name: string;
  color: string;
  blurb: string;
}

export const CLANS: Record<ClanId, ClanInfo> = {
  FRU: { id: 'FRU', name: 'Frugivore', color: '#e0782f', blurb: 'Fruit bats. Tanky, healing.' },
  INS: { id: 'INS', name: 'Insectivore', color: '#7fb04a', blurb: 'Echolocators. Fast, cheap, swarming.' },
  SAN: { id: 'SAN', name: 'Sanguivore', color: '#c0304a', blurb: 'Vampire bats. Lifesteal, sharing.' },
  PIS: { id: 'PIS', name: 'Piscivore', color: '#3a8fd0', blurb: 'Fishing bats. Long range, pierce.' },
  NEC: { id: 'NEC', name: 'Nectarivore', color: '#c76fd6', blurb: 'Nectar bats. Auras and buffs.' },
};

export const CLAN_ORDER: ClanId[] = ['FRU', 'INS', 'SAN', 'PIS', 'NEC'];

export const RARITY_COLOR = {
  common: '#a7a7b3',
  rare: '#4fa3ff',
  epic: '#b56cff',
  legendary: '#ffc23d',
} as const;

