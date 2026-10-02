import type { RelicDef } from './types';

export const RELICS: RelicDef[] = [
  { id: 'echo_chamber', name: 'Echo Chamber', icon: '🔔', desc: '+2 max energy.', effect: { kind: 'maxEnergy', amount: 2 } },
  { id: 'moon_roost', name: 'Moonlit Roost', icon: '🌙', desc: '+20% energy regen.', effect: { kind: 'regenPct', pct: 20 } },
  { id: 'guano_pile', name: 'Guano Pile', icon: '⛰', desc: 'Start battles with +4 energy.', effect: { kind: 'startEnergy', amount: 4 } },
  { id: 'silk_wings', name: 'Silk Wings', icon: '🪽', desc: 'Bats move 15% faster.', effect: { kind: 'speedPct', pct: 15 } },
  { id: 'thick_fur', name: 'Winter Fur', icon: '🧥', desc: 'Bats have +15% HP.', effect: { kind: 'hpPct', pct: 15 } },
  { id: 'fangs', name: 'Whetted Fangs', icon: '🦷', desc: 'Bats deal +12% damage.', effect: { kind: 'atkPct', pct: 12 } },
  { id: 'blood_pact', name: 'Blood Pact', icon: '🩸', desc: 'Commander tax is +1 instead of +2.', effect: { kind: 'commanderTax', delta: -1 } },
  { id: 'fig_tree', name: 'Fig Tree', icon: '🌳', desc: 'Heal the cave 80 after each battle.', effect: { kind: 'healAfterBattle', amount: 80 } },
  { id: 'big_colony', name: 'Big Colony', icon: '🦇', desc: 'Hand size +1.', effect: { kind: 'handSize', amount: 1 } },
];

export const RELIC_BY_ID: Record<string, RelicDef> = Object.fromEntries(RELICS.map((r) => [r.id, r]));
