import { BALANCE } from '../data/balance';
import { BAT_BY_ID } from '../data/bats';
import type { BatDef, Stats, Trait } from '../data/types';

/** Permanent per-bat progress. */
export interface OwnedBat {
  level: number;
  plus: number;
  evolved: boolean;
  talents: [boolean, boolean];
}

export const newOwnedBat = (): OwnedBat => ({ level: 1, plus: 0, evolved: false, talents: [false, false] });

const rm = (def: BatDef) => BALANCE.xp.rarityMult[def.rarity];

export const levelCap = (o: OwnedBat): number => (o.evolved ? BALANCE.evolvedLevelCap : BALANCE.levelCap);

export const levelUpCost = (def: BatDef, o: OwnedBat): number =>
  Math.round(BALANCE.xp.perLevel * rm(def) * o.level);

export const evolveCost = (def: BatDef): number => Math.round(BALANCE.xp.evolve * rm(def));
export const talentCost = (def: BatDef): number => Math.round(BALANCE.xp.talent * rm(def));
export const dupeXp = (def: BatDef): number => BALANCE.xp.dupeValue[def.rarity];

export const canLevelUp = (def: BatDef, o: OwnedBat, xp: number) => o.level < levelCap(o) && xp >= levelUpCost(def, o);
export const canEvolve = (def: BatDef, o: OwnedBat, xp: number) =>
  !def.basic && !o.evolved && o.level >= BALANCE.levelCap && xp >= evolveCost(def);
export const canTalent = (def: BatDef, o: OwnedBat, i: 0 | 1, xp: number) =>
  o.evolved && !o.talents[i] && xp >= talentCost(def);

export const displayName = (def: BatDef, o?: OwnedBat): string => (o?.evolved ? def.evolved.name : def.name);

export interface UnitBlueprint {
  batId: string;
  name: string;
  cost: number;
  stats: Stats;
  traits: Trait[];
  roost: { hp: number; count: number; respawn: number; batch: number };
}

/**
 * Final in-battle stats for a bat: roster level (incl. plus-levels), evolution, talents,
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
  def.talents.forEach((t, i) => {
    if (!o.talents[i]) return;
    const e = t.effect;
    if (e.kind === 'hpPct') hpMult *= 1 + e.pct / 100;
    else if (e.kind === 'atkPct') atkMult *= 1 + e.pct / 100;
    else if (e.kind === 'speedPct') speedMult *= 1 + e.pct / 100;
    else if (e.kind === 'cost') cost += e.delta;
    else mergeTrait(traits, e.trait);
  });
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
    },
    traits: traits.filter((t) => t.kind !== 'swarm'),
    roost: {
      hp: Math.round(def.roost.hp * hpMult),
      count: swarm && swarm.kind === 'swarm' ? swarm.count : def.roost.count,
      respawn: def.roost.respawn,
      batch: def.roost.batch ?? 1,
    },
  };
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
