import type { PassiveEffect } from './types';

/**
 * Charms: the run's rule-benders (Balatro's jokers). Up to CHARM_SLOTS at once, bought in the
 * Fig Market or offered after elites, sold back for half. Most break a rule outright.
 */
export const CHARM_SLOTS = 5;

export type CharmId =
  | 'ripple' | 'foster' | 'vanguard' | 'windfall' | 'phoenix' | 'beacon' | 'hoard' | 'thrift'
  | 'big_family' | 'night_shift' | 'twins' | 'scavenger' | 'deep_pockets' | 'glazier' | 'star_gazer' | 'second_wind'
  // Former relics: flat passives.
  | 'echo_chamber' | 'moon_roost' | 'guano_pile' | 'silk_wings' | 'thick_fur' | 'fangs' | 'fig_tree' | 'old_growth';

export interface CharmDef {
  id: CharmId;
  name: string;
  icon: string;
  desc: string;
  rarity: 'common' | 'uncommon' | 'rare';
  /** Flat passive (most charms are rules handled in the engine instead). */
  effect?: PassiveEffect;
}

export const CHARMS: CharmDef[] = [
  { id: 'ripple', name: 'Ripple', icon: '🌀', rarity: 'rare', desc: 'Pattern bumps chain once: a roost bumped by a merge fires its own pattern too.' },
  { id: 'foster', name: 'Foster Mother', icon: '🍼', rarity: 'uncommon', desc: 'Fledglings merge into any bat\'s roost of the same level.' },
  { id: 'vanguard', name: 'Vanguard', icon: '🛡', rarity: 'uncommon', desc: 'Each dusk, a random front-row roost gains +1 level.' },
  { id: 'windfall', name: 'Windfall', icon: '💰', rarity: 'common', desc: 'A merge that bumps 2 or more roosts pays 2 guano.' },
  { id: 'phoenix', name: 'Phoenix Roost', icon: '🔥', rarity: 'uncommon', desc: 'Wrecked roosts rebuild at full HP, but lose a level.' },
  { id: 'beacon', name: 'Beacon', icon: '🗼', rarity: 'rare', desc: 'Each dusk, your highest-level roost fires its pattern (+1 to roosts it reaches).' },
  { id: 'hoard', name: 'Hoarder', icon: '🏦', rarity: 'common', desc: 'Interest cap +3.' },
  { id: 'thrift', name: 'Thrift', icon: '🪙', rarity: 'common', desc: 'The first reroll each day is free.' },
  { id: 'big_family', name: 'Big Family', icon: '👪', rarity: 'common', desc: 'Roosts at level 3 or higher keep +1 bat out.' },
  { id: 'night_shift', name: 'Night Shift', icon: '🌙', rarity: 'common', desc: 'Spells cost 1 less guano (minimum 0).' },
  { id: 'twins', name: 'Twins', icon: '👯', rarity: 'rare', desc: 'Building a roost next to one of the same species gives that neighbour +1 level.' },
  { id: 'scavenger', name: 'Scavenger', icon: '🦴', rarity: 'common', desc: '+1 guano at dawn for every 3 kills.' },
  { id: 'deep_pockets', name: 'Deep Pockets', icon: '🎒', rarity: 'uncommon', desc: 'The pool shows one more card.' },
  { id: 'glazier', name: 'Glazier', icon: '🪟', rarity: 'uncommon', desc: 'Roosts holding a Glass card deal +60% more damage (+120% total).' },
  { id: 'star_gazer', name: 'Star Gazer', icon: '🔭', rarity: 'uncommon', desc: 'Every formation counts as one level higher.' },
  { id: 'echo_chamber', name: 'Echo Chamber', icon: '🔔', rarity: 'common', desc: '+1 guano every dawn.', effect: { kind: 'guanoPerDawn', amount: 1 } },
  { id: 'moon_roost', name: 'Moonlit Roost', icon: '🌛', rarity: 'common', desc: 'Rerolls cost 1 less.', effect: { kind: 'refreshDiscount', amount: 1 } },
  { id: 'guano_pile', name: 'Guano Pile', icon: '⛰', rarity: 'common', desc: 'Start each level with +4 guano.', effect: { kind: 'startGuano', amount: 4 } },
  { id: 'silk_wings', name: 'Silk Wings', icon: '🪽', rarity: 'common', desc: 'Bats fly 20% faster.', effect: { kind: 'speedPct', pct: 20 } },
  { id: 'thick_fur', name: 'Winter Fur', icon: '🧥', rarity: 'common', desc: 'Bats and roosts have +15% HP.', effect: { kind: 'hpPct', pct: 15 } },
  { id: 'fangs', name: 'Whetted Fangs', icon: '🦷', rarity: 'common', desc: 'Bats deal +12% damage.', effect: { kind: 'atkPct', pct: 12 } },
  { id: 'fig_tree', name: 'Fig Tree', icon: '🌳', rarity: 'common', desc: 'Heal the cave 60 after each level.', effect: { kind: 'healAfterBattle', amount: 60 } },
  { id: 'old_growth', name: 'Old Growth', icon: '🪵', rarity: 'rare', desc: 'New roosts start at level 2.', effect: { kind: 'startLevel', amount: 1 } },
  { id: 'second_wind', name: 'Second Wind', icon: '💨', rarity: 'rare', desc: 'The first time the cave would fall, it holds at 1 HP. Then this charm breaks.' },
];

export const CHARM_BY_ID: Record<string, CharmDef> = Object.fromEntries(CHARMS.map((c) => [c.id, c]));
export const CHARM_PRICE = { common: 40, uncommon: 60, rare: 90 } as const;
export const charmSellValue = (id: string) => Math.floor(CHARM_PRICE[CHARM_BY_ID[id].rarity] / 2);
