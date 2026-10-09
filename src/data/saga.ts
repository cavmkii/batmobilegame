import { Rng } from '../game/rng';
import { BOSS_RULES, type BossRuleId } from './bossRules';
import { BIOMES } from './setup';
import type { ClanId } from './types';

/**
 * The saga map: an endless path of nodes, each a short run (a few levels and a boss) with a fixed
 * twist. Your collection carries between nodes; each run's deck, charms and star charts don't.
 * The first nodes are hand-made; after that they're generated from the node number, with
 * difficulty climbing like Balatro's stakes.
 */
export type GoalId = 'noLeak' | 'healthy' | 'unbroken' | 'small' | 'tall';

export const GOALS: Record<GoalId, { name: string; desc: string }> = {
  noLeak: { name: 'Sealed', desc: 'No enemy reaches the cave all run' },
  healthy: { name: 'Healthy', desc: 'Finish with at least 75% cave HP' },
  unbroken: { name: 'Unbroken', desc: 'Never let a roost be wrecked' },
  small: { name: 'Small colony', desc: 'Never have more than 7 roosts at once' },
  tall: { name: 'Tower', desc: 'Build a level-6 roost' },
};

export type ObjectiveId = 'nursery' | 'hunt' | 'fragile';

export const OBJECTIVES: Record<ObjectiveId, { icon: string; name: string; desc: string }> = {
  nursery: { icon: '🍼', name: 'Protect the nursery', desc: 'A roost of pups sits mid-field in each regular battle. If it is wrecked, the level is lost.' },
  hunt: { icon: '🎯', name: 'Hunt', desc: `In each regular battle, kill at least ${85}% of the enemies that come, or the level is lost.` },
  fragile: { icon: '🕳', name: 'Fragile cave', desc: 'The cave can\'t be healed this run: no rest, spell or charm healing.' },
};

/** Share of a level's enemies a Hunt objective needs killed. */
export const HUNT_PCT = 85;

export interface SagaNode {
  n: number;
  name: string;
  blurb: string;
  biome: string;
  modifiers: string[];
  /** Deck restriction: only bats of this clan (Fledglings and spells always allowed). */
  restrict?: ClanId;
  /** Objective: nursery and hunt apply to regular battles; fragile to the whole run. */
  objective?: ObjectiveId;
  bossRule: BossRuleId;
  goals: [GoalId, GoalId];
  /** Enemy HP and attack multiplier. */
  difficulty: number;
}

type Authored = Omit<SagaNode, 'n' | 'difficulty'>;

const AUTHORED: Authored[] = [
  { name: 'First Flight', blurb: 'A quiet karst valley. Learn the night.', biome: 'cave_country', modifiers: [], bossRule: 'storm', goals: ['healthy', 'tall'] },
  { name: 'Barnyard', blurb: 'Yard lights draw insects; cattle draw vampires.', biome: 'farmland', modifiers: [], bossRule: 'drought', goals: ['noLeak', 'unbroken'] },
  { name: 'Agave Trail', blurb: 'Nectar country: flowering cacti everywhere.', biome: 'sonoran', modifiers: [], bossRule: 'hawk_eye', goals: ['tall', 'unbroken'] },
  { name: 'The Nursery', blurb: 'Pups in the roost. Protect the nursery at all costs.', biome: 'cave_country', modifiers: [], objective: 'nursery', bossRule: 'owl_watch', goals: ['healthy', 'small'] },
  { name: 'Hum of Insects', blurb: 'Only insect-eaters answer the call.', biome: 'farmland', modifiers: [], restrict: 'INS', bossRule: 'storm', goals: ['noLeak', 'tall'] },
  { name: 'Fig Canopy', blurb: 'Fruit everywhere. Fruit bats only.', biome: 'rainforest', modifiers: [], restrict: 'FRU', bossRule: 'drought', goals: ['healthy', 'small'] },
  { name: 'Moonless', blurb: 'No moon tonight: you won\'t see what\'s coming.', biome: 'cave_country', modifiers: ['new_moon'], bossRule: 'owl_watch', goals: ['noLeak', 'unbroken'] },
  { name: 'Swarm Season', blurb: 'Every wave a quarter bigger, and every one must be hunted.', biome: 'rainforest', modifiers: ['swarm_season'], objective: 'hunt', bossRule: 'hawk_eye', goals: ['tall', 'healthy'] },
  { name: 'River Run', blurb: 'Fishing bats only, over dark water.', biome: 'rainforest', modifiers: [], restrict: 'PIS', bossRule: 'storm', goals: ['noLeak', 'small'] },
  { name: 'Crumbling Cave', blurb: 'The old cave is failing, and the nursery is inside.', biome: 'cave_country', modifiers: ['old_cave'], objective: 'nursery', bossRule: 'drought', goals: ['healthy', 'tall'] },
  { name: 'Blood Moon', blurb: 'Vampires only, and the cave won\'t mend.', biome: 'farmland', modifiers: ['long_nights'], objective: 'fragile', restrict: 'SAN', bossRule: 'owl_watch', goals: ['small', 'unbroken'] },
  { name: 'Long Migration', blurb: 'Nectar bats only, long nights, thin pickings.', biome: 'sonoran', modifiers: ['long_nights', 'lean_times'], restrict: 'NEC', bossRule: 'hawk_eye', goals: ['tall', 'noLeak'] },
];

export const AUTHORED_COUNT = AUTHORED.length;

/** Enemy strength by node: flat for the first three, then climbing; generated nodes keep climbing. */
export const sagaDifficulty = (n: number) => 1 + 0.05 * Math.max(0, n - 3);

const GEN_NAMES = ['Deep Karst', 'Sinkhole', 'Old Mine', 'Bridge Span', 'Hollow Oak', 'Sea Cave', 'Lava Tube', 'Church Loft', 'Bamboo Grove', 'Canyon Wall'];
const RESTRICTS: (ClanId | undefined)[] = [undefined, undefined, undefined, 'INS', 'FRU', 'SAN', 'PIS', 'NEC'];
const MODS = ['lean_times', 'long_nights', 'new_moon', 'swarm_season', 'old_cave'];
const GOAL_IDS = Object.keys(GOALS) as GoalId[];

export function sagaNode(n: number): SagaNode {
  if (n >= 1 && n <= AUTHORED.length) return { ...AUTHORED[n - 1], n, difficulty: sagaDifficulty(n) };
  // Generated: a stable mix per node number. Twists stack up slowly.
  const rng = new Rng(n * 7919 + 17);
  const mods = rng.shuffle([...MODS]).slice(0, Math.min(3, 1 + Math.floor((n - AUTHORED.length) / 6)));
  const goals = rng.shuffle([...GOAL_IDS]).slice(0, 2) as [GoalId, GoalId];
  return {
    n,
    name: `${rng.pick(GEN_NAMES)} ${toRoman(Math.ceil((n - AUTHORED.length) / GEN_NAMES.length) + 0)}`.trim(),
    blurb: 'Further than any colony has flown.',
    biome: rng.pick(BIOMES).id,
    modifiers: mods,
    restrict: rng.pick(RESTRICTS),
    objective: rng.pick<ObjectiveId | undefined>([undefined, undefined, undefined, 'nursery', 'hunt', 'fragile']),
    bossRule: rng.pick(BOSS_RULES).id,
    goals,
    difficulty: sagaDifficulty(n),
  };
}

function toRoman(k: number): string {
  if (k <= 1) return '';
  const r = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  return r[k] ?? String(k);
}

/** How deep (on the 8-row difficulty scale) a node's boss sits: the first nodes ramp up to the full act. */
export const sagaMaxDepth = (n: number) => Math.min(7, 2 + n);

/** Rows in a saga run's map: battle, mixed, battle/elite, mixed, rest, boss. */
export const SAGA_ROWS = 6;
