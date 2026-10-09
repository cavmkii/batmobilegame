import type { Trait } from './types';

/**
 * Skill trees. Every bat that fights has three forks, unlocked at SKILL_LEVELS by roster level.
 * At each fork you pick one of two skills; picks can be changed at any time from the bat's page.
 * Skills shape how a bat plays (wider spread, more bats, a new attack) more than raw stats.
 */
export const SKILL_LEVELS = [3, 6, 9] as const;
/** The fourth fork (the bat's two old talents) unlocks with evolution instead of a level. */
export const EVOLVED_FORK = 3;

export type SkillEffect =
  | { kind: 'hpPct'; pct: number }
  | { kind: 'atkPct'; pct: number }
  /** Attacks this much faster. */
  | { kind: 'hastePct'; pct: number }
  | { kind: 'rangePct'; pct: number }
  | { kind: 'roostHpPct'; pct: number }
  /** Roost keeps this many more bats out. */
  | { kind: 'bats'; n: number }
  /** Roost refills this much faster. */
  | { kind: 'refillPct'; pct: number }
  /** Bats released per refill. */
  | { kind: 'batch'; n: number }
  | { kind: 'trait'; trait: Trait }
  /** Extra pattern tiles (dCol, dRow), so merges spread further. */
  | { kind: 'spread'; tiles: [number, number][] }
  /** Bats fly faster. */
  | { kind: 'speedPct'; pct: number }
  /** Guano cost change. */
  | { kind: 'cost'; delta: number };

export interface SkillNode {
  name: string;
  effect: SkillEffect;
}

export type SkillTree = [[SkillNode, SkillNode], [SkillNode, SkillNode], [SkillNode, SkillNode]];

// Builders: default names, overridable.
const hp = (pct: number, name = 'Thick Fur'): SkillNode => ({ name, effect: { kind: 'hpPct', pct } });
const atk = (pct: number, name = 'Sharp Teeth'): SkillNode => ({ name, effect: { kind: 'atkPct', pct } });
const haste = (pct: number, name = 'Quick Wings'): SkillNode => ({ name, effect: { kind: 'hastePct', pct } });
const range = (pct: number, name = 'Keen Echo'): SkillNode => ({ name, effect: { kind: 'rangePct', pct } });
const roostHp = (pct: number, name = 'Deep Crevice'): SkillNode => ({ name, effect: { kind: 'roostHpPct', pct } });
const bats = (n: number, name = 'Bigger Colony'): SkillNode => ({ name, effect: { kind: 'bats', n } });
const refill = (pct: number, name = 'Fast Nursery'): SkillNode => ({ name, effect: { kind: 'refillPct', pct } });
const batch = (n: number, name = 'Swarm Out'): SkillNode => ({ name, effect: { kind: 'batch', n } });
const spread = (tiles: [number, number][], name = 'Wide Range'): SkillNode => ({ name, effect: { kind: 'spread', tiles } });
const trait = (t: Trait, name: string): SkillNode => ({ name, effect: { kind: 'trait', trait: t } });
const multi = (targets: number, name = 'Multi-catch') => trait({ kind: 'multiHit', targets }, name);
const knock = (chance: number, name = 'Body Slam') => trait({ kind: 'knockChance', chance }, name);
const steal = (pct: number, name = 'Deep Bite') => trait({ kind: 'lifesteal', pct }, name);
const aoe = (name: string) => trait({ kind: 'aoe' }, name);
const healAura = (amount: number, name = 'Groom Roost-mates') => trait({ kind: 'healAura', amount, every: 2, radius: 110 }, name);
const atkAura = (pct: number, name = 'Pollen Dust') => trait({ kind: 'atkAura', pct, radius: 130 }, name);
const hasteAura = (pct: number, name = 'Buzzing Flock') => trait({ kind: 'hasteAura', pct, radius: 130 }, name);
const deathHeal = (amount: number, name = 'Blood Share') => trait({ kind: 'deathHeal', amount, radius: 130 }, name);

export const SKILL_TREES: Record<string, SkillTree> = {
  fledgling: [[hp(20, 'Growth Spurt'), refill(15)], [atk(20), bats(1)], [roostHp(30), spread([[0, -1]], 'First Flight')]],

  // ---------- Frugivores ----------
  egyptian_fruit: [[roostHp(25), hp(20)], [spread([[-1, 0]], 'Cave Colony'), healAura(10, 'Fig Share')], [bats(1), atk(30)]],
  straw_fruit: [[bats(1, 'Mass Roost'), roostHp(30)], [healAura(25, 'Feeding Frenzy'), hp(25)], [spread([[0, -1], [0, 1]], 'Migration'), refill(25)]],
  hammerhead: [[hp(20), atk(20)], [knock(0.5, 'Honking Call'), roostHp(40)], [bats(1, 'Lek'), healAura(15)]],
  jamaican_fruit: [[roostHp(30), hp(20)], [healAura(10, 'Fig Share'), atk(25)], [bats(1), spread([[-1, -1]], 'Tent Builder')]],
  sebas: [[bats(1), healAura(20, 'Pioneer Seeds')], [hp(25), refill(20)], [spread([[1, 0], [0, -1]], 'Seed Rain'), roostHp(40)]],
  epauletted: [[hp(25), knock(0.35, 'Shoulder Tufts')], [atkAura(15, 'Courtship Song'), roostHp(30)], [bats(1), spread([[0, 1]])]],

  // ---------- Insectivores ----------
  little_brown: [[batch(1), hp(30)], [atk(20), refill(20)], [spread([[0, -2]], 'Long Forage'), bats(2, 'Maternity Colony')]],
  long_eared: [[range(25, 'Huge Ears'), atk(20)], [multi(3, 'Gleaner'), hp(30)], [knock(0.2), haste(20)]],
  free_tailed: [[haste(15, 'Jet Stream'), hp(25)], [bats(1), atk(25)], [multi(2, 'Strafing Run'), refill(25, 'Bracken Cave')]],
  tricolored: [[batch(1), hp(30)], [haste(20), atk(25)], [spread([[1, -1], [-1, 1]], 'Banded Flight'), bats(2)]],
  northern_long_eared: [[range(20), atk(20)], [multi(3, 'Gleaner'), hp(30)], [knock(0.2), refill(25)]],
  indiana: [[hasteAura(25, 'Tight Cluster'), bats(1)], [hp(30), atk(25)], [batch(1), spread([[-1, -1], [1, -1]], 'Hibernaculum')]],
  hoary: [[atk(25), hp(25)], [knock(0.4, 'Power Dive'), haste(20)], [aoe('Hawk Stoop'), spread([[-1, 0], [1, 0]], 'Long Migration')]],
  big_brown: [[hp(25), atk(25)], [knock(0.2, 'Beetle Crusher'), roostHp(30)], [bats(1), spread([[0, -1]])]],
  eastern_red: [[roostHp(40, 'Furred Tail'), bats(1)], [haste(20), atk(25)], [spread([[1, 0]], 'Leaf Roost'), batch(1)]],
  townsends: [[range(25, 'Whisper Echo'), atk(20)], [multi(3, 'Gleaner'), refill(20)], [knock(0.2), hp(30)]],
  pallid: [[hp(25), atk(20)], [knock(0.25, 'Pounce'), steal(15, 'Scorpion Feast')], [bats(1), roostHp(40)]],

  // ---------- Sanguivores ----------
  common_vampire: [[steal(70), hp(25)], [deathHeal(40), bats(1)], [atk(30), spread([[-1, -1], [1, 1]], 'Food Sharing')]],
  hairy_legged: [[atk(20), steal(55)], [knock(0.35, 'Talon Grip'), roostHp(30)], [multi(2, 'Bird Hunter'), hp(30)]],
  white_winged: [[hp(20), atk(20)], [deathHeal(140, 'Blood Pact'), steal(45)], [bats(1), refill(25)]],

  // ---------- Piscivores ----------
  lesser_bulldog: [[range(20), atk(20)], [multi(2), haste(20)], [spread([[0, -1]], 'River Run'), bats(1)]],
  greater_bulldog: [[atk(20), range(15)], [multi(4, 'Gaffing Claws'), knock(0.2)], [aoe('Rake the Water'), hp(40)]],
  fishing_bat: [[atk(20), refill(20)], [range(20), hp(40)], [bats(1), haste(25)]],
  rickett: [[atk(20), range(20)], [multi(2), haste(20)], [aoe('Trawl'), bats(1)]],
  daubentons: [[range(20), atk(25)], [bats(1), haste(20)], [multi(2, 'Water Trawler'), spread([[-1, 0]])]],

  // ---------- Nectarivores ----------
  pallas_tongue: [[atkAura(30), bats(1)], [hasteAura(15), hp(30)], [spread([[0, 1]], 'Pollinator'), refill(25)]],
  long_nosed: [[hasteAura(40, 'Nectar Corridor'), hp(25)], [atkAura(15), bats(1)], [spread([[0, -1]], 'Migration'), refill(25)]],
  tube_lipped: [[atkAura(50, 'Chalice Tongue'), hasteAura(35)], [hp(30), roostHp(30)], [healAura(15), bats(1)]],
  mexican_long_tongued: [[atkAura(30), bats(1)], [hasteAura(15), hp(30)], [spread([[0, 1]], 'Agave Trail'), refill(25)]],
  greater_long_nosed: [[hasteAura(35), healAura(20, 'Nectar Sharing')], [hp(30), bats(1)], [atkAura(15), refill(25)]],
  geoffroys_tailless: [[hasteAura(25), bats(1)], [atkAura(15), hp(30)], [spread([[-1, 1]], 'Pollinator'), refill(25)]],
};

export function describeSkill(e: SkillEffect, describeTrait: (t: Trait) => string): string {
  switch (e.kind) {
    case 'hpPct': return `Bats +${e.pct}% HP`;
    case 'atkPct': return `Bats +${e.pct}% attack`;
    case 'hastePct': return `Attacks ${e.pct}% faster`;
    case 'rangePct': return `+${e.pct}% range`;
    case 'roostHpPct': return `Roost +${e.pct}% HP`;
    case 'bats': return `Roost keeps +${e.n} bat${e.n > 1 ? 's' : ''} out`;
    case 'refillPct': return `Roost refills ${e.pct}% faster`;
    case 'batch': return `Releases +${e.n} bat per refill`;
    case 'trait': return describeTrait(e.trait);
    case 'spread': return `Pattern +${e.tiles.length} tile${e.tiles.length > 1 ? 's' : ''}`;
    case 'speedPct': return `Bats fly ${e.pct}% faster`;
    case 'cost': return `Costs ${Math.abs(e.delta)} ${e.delta < 0 ? 'less' : 'more'} guano`;
  }
}
