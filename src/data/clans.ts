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

/**
 * Clan bonuses. A clan's strength is the summed level of its standing roosts on the field
 * (dual-clan bats count for both), so both building wide and merging tall feed it.
 * Bonuses lock in at dusk for the night.
 */
export const SYNERGY_TIERS = [3, 6, 10] as const;

export type SynergyKind = 'dawnHeal' | 'haste' | 'lifesteal' | 'atk' | 'guano';

export interface SynergyInfo {
  kind: SynergyKind;
  /** Value at tiers 1..3. */
  values: [number, number, number];
  /** Applies only to this clan's bats (otherwise colony-wide). */
  clanOnly: boolean;
  text: (v: number) => string;
}

export const SYNERGY: Record<ClanId, SynergyInfo> = {
  FRU: { kind: 'dawnHeal', values: [20, 40, 70], clanOnly: false, text: (v) => `Dawn: every roost heals ${v}%` },
  INS: { kind: 'haste', values: [15, 30, 50], clanOnly: true, text: (v) => `Insectivores attack ${v}% faster` },
  SAN: { kind: 'lifesteal', values: [10, 20, 35], clanOnly: true, text: (v) => `Sanguivores +${v}% lifesteal` },
  PIS: { kind: 'atk', values: [15, 30, 50], clanOnly: true, text: (v) => `Piscivores +${v}% damage` },
  NEC: { kind: 'guano', values: [1, 2, 3], clanOnly: false, text: (v) => `+${v} guano each dawn` },
};

/** 0 (none) to 3. */
export const synergyTier = (levels: number): number => SYNERGY_TIERS.filter((t) => levels >= t).length;
