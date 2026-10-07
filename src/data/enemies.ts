import type { EnemyDef } from './types';

export const ENEMIES: EnemyDef[] = [
  { id: 'moth', name: 'Moth', sprite: 'moth', size: 1, traits: [],
    stats: { hp: 40, atk: 6, range: 20, rate: 1.0, speed: 60, knockbacks: 1 } },
  { id: 'beetle', name: 'Dung Beetle', sprite: 'beetle', size: 1.1, traits: [],
    stats: { hp: 250, atk: 10, range: 25, rate: 1.5, speed: 20, knockbacks: 2 } },
  { id: 'snake', name: 'Rat Snake', sprite: 'snake', size: 1.1, traits: [],
    stats: { hp: 140, atk: 25, range: 35, rate: 1.2, speed: 35, knockbacks: 2 } },
  { id: 'spider', name: 'Orb Weaver', sprite: 'spider', size: 1, traits: [],
    stats: { hp: 90, atk: 18, range: 140, rate: 1.6, speed: 25, knockbacks: 2 } },
  { id: 'cat', name: 'Feral Cat', sprite: 'cat', size: 1.3, traits: [],
    stats: { hp: 500, atk: 45, range: 45, rate: 1.4, speed: 35, knockbacks: 3 } },
  { id: 'hawk', name: 'Bat Hawk', sprite: 'hawk', size: 1.2, traits: [],
    stats: { hp: 200, atk: 35, range: 40, rate: 0.9, speed: 80, knockbacks: 2 } },
  { id: 'barn_owl', name: 'Barn Owl', sprite: 'owl', size: 1.5, traits: [{ kind: 'aoe' }],
    stats: { hp: 900, atk: 60, range: 60, rate: 1.5, speed: 30, knockbacks: 3 } },
  { id: 'horned_owl', name: 'Great Horned Owl', sprite: 'hornedOwl', size: 2.2,
    traits: [{ kind: 'aoe' }, { kind: 'knockChance', chance: 0.3 }],
    stats: { hp: 2000, atk: 55, range: 70, rate: 1.6, speed: 22, knockbacks: 5 } },
];

export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));

export interface WaveEntry {
  enemy: string;
  /** Seconds after battle start (ignored when triggerPct is set until triggered). */
  at: number;
  every?: number;
  max?: number;
  /** Activates once the enemy roost drops to this fraction of HP. */
  triggerPct?: number;
}

export interface Encounter {
  id: string;
  name: string;
  tier: 'battle' | 'elite' | 'boss';
  minRow: number;
  roostHp: number;
  waves: WaveEntry[];
}

export const ENCOUNTERS: Encounter[] = [
  { id: 'moth_cloud', name: 'Moth Cloud', tier: 'battle', minRow: 0, roostHp: 1440,
    waves: [{ enemy: 'moth', at: 2, every: 4, max: 20 }, { enemy: 'beetle', at: 20, every: 25, max: 3 }] },
  { id: 'dung_heap', name: 'Dung Heap', tier: 'battle', minRow: 0, roostHp: 1600,
    waves: [{ enemy: 'beetle', at: 3, every: 14, max: 6 }, { enemy: 'moth', at: 8, every: 6, max: 10 }] },
  { id: 'snake_den', name: 'Snake Den', tier: 'battle', minRow: 1, roostHp: 1920,
    waves: [{ enemy: 'snake', at: 4, every: 10, max: 8 }, { enemy: 'moth', at: 1, every: 7, max: 8 },
      { enemy: 'beetle', at: 0, triggerPct: 0.6, every: 12, max: 3 }] },
  { id: 'web_hollow', name: 'Web Hollow', tier: 'battle', minRow: 1, roostHp: 1920,
    waves: [{ enemy: 'spider', at: 6, every: 12, max: 6 }, { enemy: 'beetle', at: 2, every: 16, max: 5 }] },
  { id: 'barn_cats', name: 'The Barn', tier: 'battle', minRow: 2, roostHp: 2400,
    waves: [{ enemy: 'moth', at: 1, every: 5, max: 15 }, { enemy: 'snake', at: 10, every: 14, max: 5 },
      { enemy: 'cat', at: 0, triggerPct: 0.7, every: 20, max: 3 }] },
  { id: 'hawk_ridge', name: 'Hawk Ridge', tier: 'battle', minRow: 3, roostHp: 2560,
    waves: [{ enemy: 'hawk', at: 6, every: 11, max: 7 }, { enemy: 'spider', at: 3, every: 15, max: 4 },
      { enemy: 'cat', at: 0, triggerPct: 0.5, every: 25, max: 2 }] },
  { id: 'owl_loft', name: 'Owl Loft', tier: 'elite', minRow: 2, roostHp: 3200,
    waves: [{ enemy: 'barn_owl', at: 8, every: 35, max: 3 }, { enemy: 'moth', at: 1, every: 5, max: 20 },
      { enemy: 'snake', at: 0, triggerPct: 0.6, every: 9, max: 6 }] },
  { id: 'alley', name: 'Alley Pride', tier: 'elite', minRow: 2, roostHp: 3200,
    waves: [{ enemy: 'cat', at: 5, every: 18, max: 5 }, { enemy: 'hawk', at: 12, every: 15, max: 5 }] },
  { id: 'great_horned', name: 'Great Horned Owl', tier: 'boss', minRow: 7, roostHp: 4800,
    waves: [{ enemy: 'moth', at: 1, every: 5, max: 30 }, { enemy: 'snake', at: 8, every: 12, max: 10 },
      { enemy: 'horned_owl', at: 15 },
      { enemy: 'barn_owl', at: 0, triggerPct: 0.5, every: 30, max: 2 },
      { enemy: 'cat', at: 0, triggerPct: 0.3, every: 20, max: 3 }] },
];
