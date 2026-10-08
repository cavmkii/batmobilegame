/**
 * Charms: the run's rule-benders (Balatro's jokers). Up to CHARM_SLOTS at once, bought in the
 * Fig Market or offered after elites, sold back for half. Most break a rule outright.
 */
export const CHARM_SLOTS = 5;

export type CharmId =
  | 'ripple' | 'foster' | 'vanguard' | 'windfall' | 'phoenix' | 'beacon' | 'hoard' | 'thrift'
  | 'big_family' | 'night_shift' | 'twins' | 'scavenger' | 'deep_pockets' | 'glazier' | 'star_gazer' | 'second_wind';

export interface CharmDef {
  id: CharmId;
  name: string;
  icon: string;
  desc: string;
  rarity: 'common' | 'uncommon' | 'rare';
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
  { id: 'second_wind', name: 'Second Wind', icon: '💨', rarity: 'rare', desc: 'The first time the cave would fall, it holds at 1 HP. Then this charm breaks.' },
];

export const CHARM_BY_ID: Record<string, CharmDef> = Object.fromEntries(CHARMS.map((c) => [c.id, c]));
export const CHARM_PRICE = { common: 40, uncommon: 60, rare: 90 } as const;
export const charmSellValue = (id: string) => Math.floor(CHARM_PRICE[CHARM_BY_ID[id].rarity] / 2);
