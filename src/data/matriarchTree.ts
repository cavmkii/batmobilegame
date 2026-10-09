import type { FormationId } from './formations';

/**
 * Matriarch passive trees (Path of Exile, much smaller). A matriarch earns one point per level
 * above 1. Points go into nodes connected to ones you already have, starting from her root.
 * Three shared branches end in keystones: big effects with a real cost. The fourth branch is her
 * own and strengthens her rule. Points can be moved freely between runs.
 */
export type TreeEffect =
  | { kind: 'startGuano'; n: number }
  | { kind: 'perDawn'; n: number }
  | { kind: 'interestCap'; n: number }
  /** Positive = cheaper rerolls; negative = dearer. */
  | { kind: 'refreshDiscount'; n: number }
  | { kind: 'poolSize'; n: number }
  | { kind: 'roostHpPct'; pct: number }
  | { kind: 'hpPct'; pct: number }
  | { kind: 'atkPct'; pct: number }
  | { kind: 'hastePct'; pct: number }
  | { kind: 'speedPct'; pct: number }
  | { kind: 'armor'; n: number }
  | { kind: 'charmSlot'; n: number }
  | { kind: 'formation'; id: FormationId; n: number }
  | { kind: 'mergeRefund'; n: number }
  | { kind: 'mergeReach'; n: number }
  /** Feeding Roost levels this many extra top hunters. */
  | { kind: 'feedingRoost'; n: number };

export interface TreeNode {
  id: string;
  name: string;
  desc: string;
  effects: TreeEffect[];
  /** 'small' passives, the matriarch's 'notable', or a 'keystone' with a drawback. */
  size: 'root' | 'small' | 'notable' | 'keystone';
  /** Layout, 0..1 (y = 1 at the bottom). */
  x: number;
  y: number;
}

const SHARED: TreeNode[] = [
  { id: 'root', name: 'Matriarch', desc: 'Where every path starts.', effects: [], size: 'root', x: 0.5, y: 0.94 },
  // Hoard (economy), far left.
  { id: 'h1', name: 'Guano Cache', desc: 'Start each level with +2 guano.', effects: [{ kind: 'startGuano', n: 2 }], size: 'small', x: 0.2, y: 0.78 },
  { id: 'h2', name: 'Thrifty', desc: 'Interest cap +1.', effects: [{ kind: 'interestCap', n: 1 }], size: 'small', x: 0.08, y: 0.58 },
  { id: 'h3', name: 'Deep Midden', desc: '+1 guano every dawn.', effects: [{ kind: 'perDawn', n: 1 }], size: 'small', x: 0.08, y: 0.36 },
  { id: 'hK', name: 'Miser', desc: 'Keystone. Interest cap +4, but rerolls cost 1 more.', effects: [{ kind: 'interestCap', n: 4 }, { kind: 'refreshDiscount', n: -1 }], size: 'keystone', x: 0.08, y: 0.1 },
  // Colony (toughness), centre left.
  { id: 'c1', name: 'Thick Walls', desc: 'Roosts +15% HP.', effects: [{ kind: 'roostHpPct', pct: 15 }], size: 'small', x: 0.36, y: 0.74 },
  { id: 'c2', name: 'Huddle', desc: 'Bats +10% HP.', effects: [{ kind: 'hpPct', pct: 10 }], size: 'small', x: 0.36, y: 0.54 },
  { id: 'c3', name: 'Scarred Hide', desc: 'Bats +10 armour.', effects: [{ kind: 'armor', n: 10 }], size: 'small', x: 0.36, y: 0.34 },
  { id: 'cK', name: 'Fortress', desc: 'Keystone. Bats +25 armour and roosts +30% HP, but bats deal 15% less damage.', effects: [{ kind: 'armor', n: 25 }, { kind: 'roostHpPct', pct: 30 }, { kind: 'atkPct', pct: -15 }], size: 'keystone', x: 0.36, y: 0.1 },
  // Hunt (damage), far right.
  { id: 't1', name: 'Keen Teeth', desc: 'Bats +8% attack.', effects: [{ kind: 'atkPct', pct: 8 }], size: 'small', x: 0.8, y: 0.78 },
  { id: 't2', name: 'Quick Strike', desc: 'Bats attack 8% faster.', effects: [{ kind: 'hastePct', pct: 8 }], size: 'small', x: 0.92, y: 0.58 },
  { id: 't3', name: 'Ambush', desc: 'Bats +12% attack.', effects: [{ kind: 'atkPct', pct: 12 }], size: 'small', x: 0.92, y: 0.36 },
  { id: 'tK', name: 'Bloodlust', desc: 'Keystone. Bats +30% attack, but roosts have 25% less HP.', effects: [{ kind: 'atkPct', pct: 30 }, { kind: 'roostHpPct', pct: -25 }], size: 'keystone', x: 0.92, y: 0.1 },
  // Between Colony and the matriarch's branch.
  { id: 'sl', name: 'Trinket Pouch', desc: '+1 charm slot.', effects: [{ kind: 'charmSlot', n: 1 }], size: 'small', x: 0.5, y: 0.44 },
];

/** Each matriarch's own branch (centre right): two small nodes and a notable that strengthens her rule. */
const OWN: Record<string, [TreeNode, TreeNode, TreeNode]> = {
  flying_fox: [
    { id: 'm1', name: 'Sweet Fruit', desc: 'Bats +10% HP.', effects: [{ kind: 'hpPct', pct: 10 }], size: 'small', x: 0.64, y: 0.74 },
    { id: 'm2', name: 'Seed Bank', desc: 'Start each level with +2 guano.', effects: [{ kind: 'startGuano', n: 2 }], size: 'small', x: 0.64, y: 0.54 },
    { id: 'mK', name: 'Forest Regrowth', desc: 'Notable. Every merge pays back 1 more guano.', effects: [{ kind: 'mergeRefund', n: 1 }], size: 'notable', x: 0.64, y: 0.26 },
  ],
  ghost_bat: [
    { id: 'm1', name: 'Night Hunter', desc: 'Bats +8% attack.', effects: [{ kind: 'atkPct', pct: 8 }], size: 'small', x: 0.64, y: 0.74 },
    { id: 'm2', name: 'Larder', desc: '+1 guano every dawn.', effects: [{ kind: 'perDawn', n: 1 }], size: 'small', x: 0.64, y: 0.54 },
    { id: 'mK', name: 'Apex Feeder', desc: 'Notable. Feeding Roost also levels your second-best hunting roost.', effects: [{ kind: 'feedingRoost', n: 1 }], size: 'notable', x: 0.64, y: 0.26 },
  ],
  spectral_bat: [
    { id: 'm1', name: 'Pair Roosting', desc: 'The Pair formation is one level higher.', effects: [{ kind: 'formation', id: 'pair', n: 1 }], size: 'small', x: 0.64, y: 0.74 },
    { id: 'm2', name: 'Provider', desc: 'Roosts +15% HP.', effects: [{ kind: 'roostHpPct', pct: 15 }], size: 'small', x: 0.64, y: 0.54 },
    { id: 'mK', name: 'Family Bond', desc: 'Notable. A roost can merge into one up to 2 levels above it.', effects: [{ kind: 'mergeReach', n: 1 }], size: 'notable', x: 0.64, y: 0.26 },
  ],
  greater_noctule: [
    { id: 'm1', name: 'Long Wings', desc: 'Bats fly 20% faster.', effects: [{ kind: 'speedPct', pct: 20 }], size: 'small', x: 0.64, y: 0.74 },
    { id: 'm2', name: 'Scout', desc: 'Rerolls cost 1 less.', effects: [{ kind: 'refreshDiscount', n: 1 }], size: 'small', x: 0.64, y: 0.54 },
    { id: 'mK', name: 'Open Sky', desc: 'Notable. The pool shows one more card.', effects: [{ kind: 'poolSize', n: 1 }], size: 'notable', x: 0.64, y: 0.26 },
  ],
};

export const TREE_LINKS: [string, string][] = [
  ['root', 'h1'], ['root', 'c1'], ['root', 'm1'], ['root', 't1'],
  ['h1', 'h2'], ['h2', 'h3'], ['h3', 'hK'],
  ['c1', 'c2'], ['c2', 'c3'], ['c3', 'cK'],
  ['m1', 'm2'], ['m2', 'mK'],
  ['t1', 't2'], ['t2', 't3'], ['t3', 'tK'],
  // Cross paths.
  ['h2', 'c2'], ['m2', 't2'], ['c2', 'sl'], ['sl', 'm2'],
];

export function treeNodes(matriarchId: string): TreeNode[] {
  return [...SHARED, ...(OWN[matriarchId] ?? [])];
}
