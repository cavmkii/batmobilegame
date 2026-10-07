import type { RelicDef } from './types';

export const RELICS: RelicDef[] = [
  { id: 'echo_chamber', name: 'Echo Chamber', icon: '🔔', desc: '+1 guano every dawn.', effect: { kind: 'guanoPerDawn', amount: 1 } },
  { id: 'moon_roost', name: 'Moonlit Roost', icon: '🌙', desc: 'Refreshing the pool costs 1 less.', effect: { kind: 'refreshDiscount', amount: 1 } },
  { id: 'guano_pile', name: 'Guano Pile', icon: '⛰', desc: 'Start each level with +4 guano.', effect: { kind: 'startGuano', amount: 4 } },
  { id: 'silk_wings', name: 'Silk Wings', icon: '🪽', desc: 'Bats fly 20% faster.', effect: { kind: 'speedPct', pct: 20 } },
  { id: 'thick_fur', name: 'Winter Fur', icon: '🧥', desc: 'Bats and roosts have +15% HP.', effect: { kind: 'hpPct', pct: 15 } },
  { id: 'fangs', name: 'Whetted Fangs', icon: '🦷', desc: 'Bats deal +12% damage.', effect: { kind: 'atkPct', pct: 12 } },
  { id: 'blood_pact', name: 'Blood Pact', icon: '🩸', desc: 'Commander tax is +1 instead of +2.', effect: { kind: 'commanderTax', delta: -1 } },
  { id: 'fig_tree', name: 'Fig Tree', icon: '🌳', desc: 'Heal the cave 60 after each level.', effect: { kind: 'healAfterBattle', amount: 60 } },
  { id: 'old_growth', name: 'Old Growth', icon: '🪵', desc: 'New roosts start at level 2.', effect: { kind: 'startLevel', amount: 1 } },
];

export const RELIC_BY_ID: Record<string, RelicDef> = Object.fromEntries(RELICS.map((r) => [r.id, r]));
