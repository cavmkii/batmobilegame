import type { EnemyDef } from './types';

/** Range and speed are in lane units (100 = 1 tile), like bat stats. */
export const ENEMIES: EnemyDef[] = [
  { id: 'moth', name: 'Moth', sprite: 'moth', size: 1, traits: [], threat: 2,
    fact: 'A staple food for many insect-eating bats. Many moths have evolved ears that hear bat calls, so they can dodge at the last moment.',

    stats: { hp: 40, atk: 6, range: 25, rate: 1.0, speed: 60, knockbacks: 1 } },
  { id: 'tiger_moth', name: 'Tiger Moth', sprite: 'tigerMoth', size: 1.1, threat: 5,
    traits: [{ kind: 'jammer', pct: 40, radius: 160 }],
    fact: "Some tiger moths answer an attacking bat with ultrasonic clicks. In at least one species, Bertholdia trigona, the clicks jam the bat's sonar.",
    stats: { hp: 70, atk: 6, range: 25, rate: 1.0, speed: 50, knockbacks: 1 } },
  { id: 'beetle', name: 'Dung Beetle', sprite: 'beetle', size: 1.1, traits: [], threat: 7,
    fact: 'Dung beetles roll balls of dung many times their own weight, and some species steer by the light of the Milky Way.',

    stats: { hp: 250, atk: 10, range: 30, rate: 1.5, speed: 25, knockbacks: 2 } },
  { id: 'snake', name: 'Rat Snake', sprite: 'snake', size: 1.1, traits: [], threat: 7,
    fact: 'Rat snakes are agile climbers that raid nests in trees and buildings, and are among the snakes recorded eating bats.',

    stats: { hp: 140, atk: 25, range: 35, rate: 1.2, speed: 35, knockbacks: 2 } },
  { id: 'spider', name: 'Orb Weaver', sprite: 'spider', size: 1, traits: [], threat: 6,
    fact: 'Large orb-weaving spiders occasionally catch small bats in their webs, a rare but documented event.',

    stats: { hp: 90, atk: 18, range: 140, rate: 1.6, speed: 25, knockbacks: 2 } },
  { id: 'hawk', name: 'Bat Hawk', sprite: 'hawk', size: 1.2, traits: [], threat: 11,
    fact: 'The bat hawk of Africa and Asia hunts at dusk, catching bats as they leave their roosts and swallowing them whole in flight.',

    stats: { hp: 200, atk: 35, range: 40, rate: 0.9, speed: 70, knockbacks: 2 } },
  { id: 'cat', name: 'Feral Cat', sprite: 'cat', size: 1.3, traits: [], threat: 18,
    fact: 'Domestic and feral cats are a significant predator of bats, especially around roosts in buildings.',

    stats: { hp: 500, atk: 45, range: 45, rate: 1.4, speed: 35, knockbacks: 3 } },
  { id: 'barn_owl', name: 'Barn Owl', sprite: 'owl', size: 1.5, traits: [{ kind: 'aoe' }], threat: 30,
    fact: 'Barn owls hunt mostly small rodents, but take bats when they can; bat bones turn up in their pellets.',

    stats: { hp: 900, atk: 60, range: 60, rate: 1.5, speed: 30, knockbacks: 3 } },
  { id: 'horned_owl', name: 'Great Horned Owl', sprite: 'hornedOwl', size: 2.2, threat: 60,
    traits: [{ kind: 'aoe' }, { kind: 'knockChance', chance: 0.3 }],
    fact: 'One of the most powerful owls in the Americas, taking prey as large as skunks, and bats when it gets the chance.',

    stats: { hp: 2000, atk: 55, range: 70, rate: 1.6, speed: 22, knockbacks: 5 } },
];

export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));

export interface PoolEntry {
  enemy: string;
  weight: number;
  /** First night (1-based) this enemy can appear. */
  minNight?: number;
}

/** A defense level: a number of nights, each generated from a growing threat budget. */
export interface Encounter {
  id: string;
  name: string;
  tier: 'battle' | 'elite' | 'boss';
  minRow: number;
  nights: number;
  budget: { first: number; perNight: number };
  pool: PoolEntry[];
  /** Always added to the final night. */
  finale?: string[];
}

export const ENCOUNTERS: Encounter[] = [
  { id: 'moth_cloud', name: 'Moth Cloud', tier: 'battle', minRow: 0, nights: 4, budget: { first: 13, perNight: 12 },
    pool: [{ enemy: 'moth', weight: 6 }, { enemy: 'beetle', weight: 2, minNight: 2 }] },
  { id: 'dung_heap', name: 'Dung Heap', tier: 'battle', minRow: 0, nights: 4, budget: { first: 13, perNight: 12 },
    pool: [{ enemy: 'beetle', weight: 4 }, { enemy: 'moth', weight: 4 }] },
  { id: 'snake_den', name: 'Snake Den', tier: 'battle', minRow: 1, nights: 4, budget: { first: 17, perNight: 16 },
    pool: [{ enemy: 'snake', weight: 4 }, { enemy: 'moth', weight: 4 }, { enemy: 'tiger_moth', weight: 2, minNight: 2 }] },
  { id: 'web_hollow', name: 'Web Hollow', tier: 'battle', minRow: 1, nights: 4, budget: { first: 17, perNight: 16 },
    pool: [{ enemy: 'spider', weight: 4 }, { enemy: 'beetle', weight: 3 }, { enemy: 'moth', weight: 2 }] },
  { id: 'barn_cats', name: 'The Barn', tier: 'battle', minRow: 2, nights: 4, budget: { first: 19, perNight: 18 },
    pool: [{ enemy: 'moth', weight: 4 }, { enemy: 'snake', weight: 3 }, { enemy: 'cat', weight: 2, minNight: 3 }] },
  { id: 'hawk_ridge', name: 'Hawk Ridge', tier: 'battle', minRow: 3, nights: 4, budget: { first: 20, perNight: 16 },
    pool: [{ enemy: 'hawk', weight: 4 }, { enemy: 'spider', weight: 3 }, { enemy: 'tiger_moth', weight: 2 }] },
  { id: 'owl_loft', name: 'Owl Loft', tier: 'elite', minRow: 2, nights: 5, budget: { first: 22, perNight: 18 },
    pool: [{ enemy: 'moth', weight: 4 }, { enemy: 'tiger_moth', weight: 3 }, { enemy: 'snake', weight: 3 }],
    finale: ['barn_owl'] },
  { id: 'alley', name: 'Alley Pride', tier: 'elite', minRow: 2, nights: 5, budget: { first: 22, perNight: 18 },
    pool: [{ enemy: 'cat', weight: 3 }, { enemy: 'hawk', weight: 3 }, { enemy: 'moth', weight: 3 }] },
  { id: 'great_horned', name: 'Great Horned Owl', tier: 'boss', minRow: 7, nights: 6, budget: { first: 20, perNight: 15 },
    pool: [{ enemy: 'moth', weight: 4 }, { enemy: 'tiger_moth', weight: 3 }, { enemy: 'snake', weight: 3 },
      { enemy: 'cat', weight: 2, minNight: 3 }, { enemy: 'barn_owl', weight: 1, minNight: 4 }],
    finale: ['horned_owl'] },
];
