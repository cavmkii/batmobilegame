import { BALANCE } from '../data/balance';
import { BAT_BY_ID } from '../data/bats';
import { EVOLVED_FORK, SKILL_LEVELS, SKILL_TREES, type SkillNode } from '../data/skills';
import type { BatDef, Stats, Trait } from '../data/types';

/** Permanent per-bat progress. */
export interface OwnedBat {
  level: number;
  plus: number;
  evolved: boolean;
  /** Legacy: talents became the evolved skill fork (migrated on load). */
  talents?: [boolean, boolean];
  /** Skill-tree picks per fork (0 or 1), -1 or missing = not chosen. */
  skills?: number[];
  /** Matriarchs: allocated passive-tree node ids (see data/matriarchTree.ts). */
  tree?: string[];
}

export const newOwnedBat = (): OwnedBat => ({ level: 1, plus: 0, evolved: false, skills: [] });

/** A bat's full tree: three level forks, then the evolved fork (its two talents). */
export function skillTree(batId: string): [SkillNode, SkillNode][] | null {
  const tree = SKILL_TREES[batId];
  const def = BAT_BY_ID[batId];
  if (!tree || !def) return null;
  return [...tree, [def.talents[0], def.talents[1]].map((t) => ({ name: `★ ${t.name}`, effect: t.effect })) as [SkillNode, SkillNode]];
}

/** Level forks unlock by roster level; the last one by evolution. */
export const forkUnlocked = (o: OwnedBat, fork: number): boolean =>
  fork === EVOLVED_FORK ? o.evolved : o.level >= SKILL_LEVELS[fork];

/** The skills that apply: chosen and unlocked. */
export function activeSkills(batId: string, o: OwnedBat | undefined): SkillNode[] {
  const tree = skillTree(batId);
  if (!tree || !o) return [];
  const out: SkillNode[] = [];
  tree.forEach((pair, i) => {
    const pick = o.skills?.[i];
    if (forkUnlocked(o, i) && (pick === 0 || pick === 1)) out.push(pair[pick]);
  });
  return out;
}

/** Unlocked forks with no pick yet (for "skill ready" badges). */
export function skillsReady(batId: string, o: OwnedBat | undefined): number {
  const tree = skillTree(batId);
  if (!tree || !o) return 0;
  return tree.filter((_, i) => forkUnlocked(o, i) && o.skills?.[i] !== 0 && o.skills?.[i] !== 1).length;
}

export function chooseSkill(o: OwnedBat, fork: number, pick: 0 | 1) {
  if (!forkUnlocked(o, fork)) return;
  o.skills ??= [];
  while (o.skills.length <= fork) o.skills.push(-1);
  o.skills[fork] = pick;
}

const rm = (def: BatDef) => BALANCE.xp.rarityMult[def.rarity];

export const levelCap = (o: OwnedBat): number => (o.evolved ? BALANCE.evolvedLevelCap : BALANCE.levelCap);

export const levelUpCost = (def: BatDef, o: OwnedBat): number =>
  Math.round(BALANCE.xp.perLevel * rm(def) * o.level);

export const evolveCost = (def: BatDef): number => Math.round(BALANCE.xp.evolve * rm(def));
export const dupeXp = (def: BatDef): number => BALANCE.xp.dupeValue[def.rarity];

export const canLevelUp = (def: BatDef, o: OwnedBat, xp: number) => o.level < levelCap(o) && xp >= levelUpCost(def, o);
export const canEvolve = (def: BatDef, o: OwnedBat, xp: number) =>
  !def.basic && !o.evolved && o.level >= BALANCE.levelCap && xp >= evolveCost(def);

export const displayName = (def: BatDef, o?: OwnedBat): string => (o?.evolved ? def.evolved.name : def.name);

export interface UnitBlueprint {
  batId: string;
  name: string;
  cost: number;
  stats: Stats;
  traits: Trait[];
  roost: { hp: number; count: number; respawn: number; batch: number };
  /** Base pattern plus any spread skills. */
  pattern: [number, number][];
}

/**
 * Final in-battle stats for a bat: roster level (incl. plus-levels), evolution, skills,
 * and the in-run card upgrade. Unowned bats (drafted) fight at level 1.
 */
export function blueprint(batId: string, owned: OwnedBat | undefined, upgradedCard = false): UnitBlueprint {
  const def = BAT_BY_ID[batId];
  const o = owned ?? newOwnedBat();
  const effLevel = o.level + o.plus;
  let hpMult = 1 + BALANCE.levelScaling * (effLevel - 1);
  let atkMult = hpMult;
  let speedMult = 1;
  let cost = def.cost;
  const traits: Trait[] = def.traits.map((t) => ({ ...t }));

  if (o.evolved) {
    hpMult *= BALANCE.evolvedMult;
    atkMult *= BALANCE.evolvedMult;
    if (def.evolved.trait) mergeTrait(traits, def.evolved.trait);
  }
  // Skill tree.
  let rangeMult = 1;
  let rateMult = 1;
  let roostHpMult = 1;
  let extraBats = 0;
  let refillMult = 1;
  let extraBatch = 0;
  const pattern: [number, number][] = def.pattern.map(([c, r]) => [c, r]);
  for (const sk of activeSkills(batId, owned)) {
    const e = sk.effect;
    if (e.kind === 'hpPct') hpMult *= 1 + e.pct / 100;
    else if (e.kind === 'atkPct') atkMult *= 1 + e.pct / 100;
    else if (e.kind === 'hastePct') rateMult /= 1 + e.pct / 100;
    else if (e.kind === 'rangePct') rangeMult *= 1 + e.pct / 100;
    else if (e.kind === 'roostHpPct') roostHpMult *= 1 + e.pct / 100;
    else if (e.kind === 'bats') extraBats += e.n;
    else if (e.kind === 'refillPct') refillMult /= 1 + e.pct / 100;
    else if (e.kind === 'batch') extraBatch += e.n;
    else if (e.kind === 'speedPct') speedMult *= 1 + e.pct / 100;
    else if (e.kind === 'cost') cost += e.delta;
    else if (e.kind === 'spread') {
      for (const t of e.tiles) if (!pattern.some(([c, r]) => c === t[0] && r === t[1])) pattern.push([t[0], t[1]]);
    } else strongerTrait(traits, e.trait);
  }

  if (upgradedCard) {
    hpMult *= BALANCE.upgradedCardMult;
    atkMult *= BALANCE.upgradedCardMult;
  }

  const s = def.stats;
  const swarm = traits.find((t) => t.kind === 'swarm');
  return {
    batId,
    name: displayName(def, owned),
    cost: Math.max(1, cost),
    stats: {
      ...s,
      hp: Math.round(s.hp * hpMult),
      atk: Math.round(s.atk * atkMult),
      speed: s.speed * speedMult,
      range: Math.round(s.range * rangeMult),
      rate: Math.round(s.rate * rateMult * 100) / 100,
    },
    traits: traits.filter((t) => t.kind !== 'swarm'),
    roost: {
      hp: Math.round(def.roost.hp * hpMult * roostHpMult),
      count: (swarm && swarm.kind === 'swarm' ? swarm.count : def.roost.count) + extraBats,
      respawn: Math.round(def.roost.respawn * refillMult * 10) / 10,
      batch: (def.roost.batch ?? 1) + extraBatch,
    },
    pattern,
  };
}

/** Skills never weaken a trait the bat already has (e.g. an evolved multi-hit 3 stays 3). */
function strongerTrait(traits: Trait[], t: Trait) {
  const i = traits.findIndex((x) => x.kind === t.kind);
  if (i < 0) return void traits.push({ ...t });
  const cur = traits[i] as Record<string, unknown>;
  const next = { ...cur };
  for (const [k, v] of Object.entries(t)) if (typeof v === 'number') next[k] = Math.max(Number(cur[k] ?? 0), v);
  traits[i] = next as Trait;
}

/** Evolved/talent traits replace a trait of the same kind (they are upgrades), else add. */
function mergeTrait(traits: Trait[], t: Trait) {
  const i = traits.findIndex((x) => x.kind === t.kind);
  if (i >= 0) traits[i] = { ...t };
  else traits.push({ ...t });
}

export function describeTrait(t: Trait): string {
  switch (t.kind) {
    case 'lifesteal': return `Lifesteal ${t.pct}%`;
    case 'multiHit': return `Hits ${t.targets} targets`;
    case 'aoe': return 'Area attack';
    case 'healAura': return `Heals nearby bats ${t.amount} / ${t.every}s`;
    case 'atkAura': return `Nearby bats +${t.pct}% attack`;
    case 'hasteAura': return `Nearby bats +${t.pct}% attack speed`;
    case 'knockChance': return `${Math.round(t.chance * 100)}% knockback on hit`;
    case 'deathHeal': return `On death: heal nearby ${t.amount}`;
    case 'swarm': return `Roost releases ${t.count} bats`;
    case 'jammer': return `Jams sonar: nearby bats -${t.pct}% range`;
  }
}

export type AttackStyle = 'bite' | 'sonar' | 'chain' | 'splash';

/** How a unit attacks, for visuals and card labels. Range is in lane units (100 = 1 tile). */
export function attackStyle(traits: Trait[], range: number): AttackStyle {
  if (traits.some((t) => t.kind === 'aoe')) return 'splash';
  if (traits.some((t) => t.kind === 'multiHit')) return 'chain';
  return range >= 100 ? 'sonar' : 'bite';
}

export const ATTACK_LABEL: Record<AttackStyle, { icon: string; label: string }> = {
  bite: { icon: '🦷', label: 'Melee bite' },
  sonar: { icon: '〰', label: 'Ranged sonar' },
  chain: { icon: '⋔', label: 'Hits several' },
  splash: { icon: '💥', label: 'Area attack' },
};

export function attackLabel(traits: Trait[], range: number): string {
  const st = attackStyle(traits, range);
  const multi = traits.find((t) => t.kind === 'multiHit');
  const base = st === 'chain' && multi?.kind === 'multiHit' ? `Hits ${multi.targets} at once` : ATTACK_LABEL[st].label;
  const support = traits.some((t) => t.kind === 'atkAura' || t.kind === 'hasteAura' || t.kind === 'healAura');
  return `${ATTACK_LABEL[st].icon} ${base}${range >= 100 && st !== 'sonar' ? ' (ranged)' : ''}${support ? ' · support' : ''}`;
}
