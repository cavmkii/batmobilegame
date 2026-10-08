/**
 * Matriarchs lead the colony for a run. A matriarch is never placed on the field: she sets one rule
 * that the whole run bends around. Each rule borrows from the species' real behaviour.
 */
export type MatriarchEffect =
  /** Every merge (pool card onto a roost, or roost onto roost) pays this much guano back. */
  | { kind: 'mergeRefund'; guano: number }
  /** At dawn, the roost whose bats killed the most tonight gains a level. */
  | { kind: 'feedingRoost' }
  /** A roost can merge into a roost up to this many levels above it (normally 0: same level only). */
  | { kind: 'mergeReach'; levels: number }
  /** Extra cards shown in the pool. */
  | { kind: 'poolSize'; extra: number };

export interface MatriarchDef {
  batId: string;
  title: string;
  rule: string;
  /** Why the rule fits the bat. */
  why: string;
  effect: MatriarchEffect;
}

export const MATRIARCHS: MatriarchDef[] = [
  {
    batId: 'flying_fox', title: 'Seed Spreader',
    rule: 'Every merge pays back 1 guano.',
    why: 'Flying foxes carry seeds for kilometres; the forest they plant feeds the next generation.',
    effect: { kind: 'mergeRefund', guano: 1 },
  },
  {
    batId: 'ghost_bat', title: 'Feeding Roost',
    rule: 'At dawn, the roost whose bats made the most kills tonight gains +1 level.',
    why: 'Ghost bats carry prey back to a feeding roost, and the floor beneath piles up with remains.',
    effect: { kind: 'feedingRoost' },
  },
  {
    batId: 'spectral_bat', title: 'Pair Bond',
    rule: 'A roost can merge into one a level above it, not only the same level.',
    why: 'Spectral bats roost in pairs and share food with their young.',
    effect: { kind: 'mergeReach', levels: 1 },
  },
  {
    batId: 'greater_noctule', title: 'Long Range',
    rule: 'The pool shows 3 cards instead of 2.',
    why: 'Noctules hunt high and far, catching migrating songbirds over open sky.',
    effect: { kind: 'poolSize', extra: 1 },
  },
];

export const MATRIARCH_BY_ID: Record<string, MatriarchDef> = Object.fromEntries(MATRIARCHS.map((m) => [m.batId, m]));

