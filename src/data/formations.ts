/**
 * Formations: named shapes on the 5×3 roost grid (Balatro's hand types). A formation standing at
 * dusk gives its bonus for the night. Star charts level a formation up for the rest of the run.
 */
export type FormationId = 'pair' | 'line' | 'column' | 'cluster' | 'full_row';

export interface FormationDef {
  id: FormationId;
  name: string;
  icon: string;
  shape: string;
  /** Bonus at formation level 1, and per extra level. */
  base: number;
  step: number;
  text: (v: number) => string;
}

export const FORMATIONS: FormationDef[] = [
  { id: 'pair', name: 'Pair', icon: '◫', shape: 'Two roosts of the same species side by side or stacked',
    base: 20, step: 10, text: (v) => `those bats +${v}% attack` },
  { id: 'line', name: 'Line', icon: '▭', shape: 'Three or more roosts of one clan in a row',
    base: 20, step: 10, text: (v) => `those bats attack ${v}% faster` },
  { id: 'column', name: 'Column', icon: '▯', shape: 'A full column: three roosts stacked, any species',
    base: 30, step: 15, text: (v) => `those bats +${v}% HP` },
  { id: 'cluster', name: 'Cluster', icon: '▦', shape: 'A 2×2 block of roosts sharing a clan',
    base: 2, step: 1, text: (v) => `+${v} guano at dawn` },
  { id: 'full_row', name: 'Full Row', icon: '▬', shape: 'All five tiles of a row filled',
    base: 25, step: 10, text: (v) => `those roosts take ${v}% less damage` },
];

export const FORMATION_BY_ID: Record<string, FormationDef> = Object.fromEntries(FORMATIONS.map((f) => [f.id, f]));

export const formationValue = (id: FormationId, level: number): number => {
  const f = FORMATION_BY_ID[id];
  const v = f.base + f.step * (Math.max(1, level) - 1);
  return id === 'full_row' ? Math.min(75, v) : v;
};

export const STAR_CHART_PRICE = 35;
