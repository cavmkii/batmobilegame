import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/balance';
import { BAT_BY_ID } from '../src/data/bats';
import { ENCOUNTERS } from '../src/data/enemies';
import { SPELL_BY_ID } from '../src/data/spells';
import type { Card } from '../src/data/types';
import { Defense, type DefenseConfig } from '../src/game/defense';
import { buildStartingDeck, newCard } from '../src/game/deck';
import { blueprint, newOwnedBat, type OwnedBat } from '../src/game/progression';

const roster = (ids: string[], level = 1): Record<string, OwnedBat> =>
  Object.fromEntries(ids.map((id) => [id, { ...newOwnedBat(), level, skills: [0, 0, 0] }]));

function cfg(over: Partial<DefenseConfig> = {}): DefenseConfig {
  return {
    encounterId: 'moth_cloud',
    row: 0,
    deck: buildStartingDeck(['little_brown', 'common_vampire']),
    matriarchId: 'ghost_bat',
    roster: roster(['ghost_bat', 'little_brown', 'common_vampire', 'fledgling']),
    caveHp: 1000,
    caveMax: 1000,
    seed: 3,
    ...over,
  };
}

const runNight = (d: Defense) => {
  for (let i = 0; i < 60 * 120 && d.phase === 'night'; i++) d.step(1 / 60);
};

const deckOf = (...ids: string[]) => ids.map((id) => newCard(SPELL_BY_ID[id] ? 'spell' : 'bat', id));

/**
 * A simple player. For each pool card: stack it onto its roost if one
 * exists, else roost it in a column tonight's enemies use (front rows, terrain first).
 * Takes spells. Refreshes when the pool has nothing it can use. Casts spells when enemies get close.
 */
export function botDay(d: Defense) {
  const cols = new Set(d.tonight.map((g) => g.col));
  const score = (slot: number, batId: string) => {
    const s = d.slots[slot];
    return (cols.has(s.col) ? 10 : 0) + (2 - s.row) * 2 + (d.terrainMatches(slot, batId) ? 6 : 0);
  };
  const bestEmpty = (batId: string) => {
    let best = -1;
    for (const s of d.slots) if (!s.roost && (best < 0 || score(s.idx, batId) > score(best, batId))) best = s.idx;
    return best;
  };
  for (let refreshes = 0; refreshes < 3; refreshes++) {
    for (let i = 0; i < d.pool.length; i++) {
      const c = d.pool[i];
      if (!c) continue;
      if (c.kind === 'spell') { d.takeSpell(i); continue; }
      const stack = d.slots.find((s) => d.canStackOn(s, c.id));
      const target = stack ? stack.idx : bestEmpty(c.id);
      if (target >= 0) d.place(i, target);
    }
    mergeAll(d);
    const reserve = d.spells.length ? 1 : 0;
    if (d.guano - d.refreshCost < 2 + reserve) break;
    if (!d.refresh()) break;
  }
  mergeAll(d);
}

/** Merge every same-bat, same-level pair, keeping the copy in the better spot (front row, threatened column). */
function mergeAll(d: Defense) {
  const cols = new Set(d.tonight.map((g) => g.col));
  const value = (idx: number) => (cols.has(d.slots[idx].col) ? 10 : 0) + (2 - d.slots[idx].row) * 2;
  for (let guard = 0; guard < 20; guard++) {
    let best: [number, number] | null = null;
    for (const a of d.slots) {
      if (!a.roost) continue;
      for (const b of d.mergeTargets(a.idx)) {
        if (value(b.idx) >= value(a.idx) && (!best || value(b.idx) > value(best[1]))) best = [a.idx, b.idx];
      }
    }
    if (!best || !d.merge(best[0], best[1])) return;
  }
}

export function botNight(d: Defense) {
  for (let i = 0; i < 60 * 120 && d.phase === 'night'; i++) {
    const near = d.units.some((u) => u.side === 'enemy' && u.y > 6);
    if (near && i % 30 === 0) {
      const healNow = d.cave.hp < d.cave.max * 0.6;
      const k = d.spells.findIndex((c, idx) => d.canCast(idx) && (SPELL_BY_ID[c.id].effect.kind !== 'healAll' || healNow));
      if (k >= 0) d.cast(k);
    }
    d.step(1 / 60);
  }
}

export function botLevel(d: Defense) {
  while (d.phase === 'day') {
    botDay(d);
    d.endDay();
    botNight(d);
  }
  return d.phase;
}

describe('pool and guano', () => {
  it('starts with guano and a full pool, and earns guano at dawn', () => {
    const d = new Defense(cfg({ caveHp: 1e9, caveMax: 1e9 }));
    expect(d.guano).toBe(BALANCE.economy.startGuano);
    expect(d.pool.filter(Boolean).length).toBe(BALANCE.economy.poolSize);
    const before = d.guano;
    d.endDay();
    runNight(d);
    expect(d.phase).toBe('day');
    expect(d.guano).toBeGreaterThanOrEqual(before + BALANCE.economy.perDawn);
  });

  it('leaves a used slot empty until a paid refresh or dawn', () => {
    const d = new Defense(cfg({ deck: deckOf('fledgling', 'fledgling', 'fledgling', 'fledgling', 'fledgling', 'fledgling'), caveHp: 1e9, caveMax: 1e9 }));
    expect(d.place(0, 7)).toBe(true);
    expect(d.pool[0]).toBeNull();
    const g = d.guano;
    expect(d.refresh()).toBe(true);
    expect(d.guano).toBe(g - d.refreshCost);
    expect(d.pool.every(Boolean)).toBe(true);
    d.place(0, 8);
    d.endDay();
    runNight(d);
    expect(d.pool.every(Boolean)).toBe(true); // dawn refill
  });

  it('cycles placed cards through the discard so they can be drawn again', () => {
    const d = new Defense(cfg({ deck: deckOf('little_brown', 'common_vampire'), caveHp: 1e9, caveMax: 1e9 }));
    d.guano = 99;
    const first = d.pool[0]!.id;
    d.place(0, 0);
    d.place(1, 1);
    d.refresh(); // draw pile empty -> reshuffles the discard
    expect(d.pool.some((c) => c?.id === first)).toBe(true);
  });

  it('takes spells into a hand and casts them as instants at night', () => {
    const d = new Defense(cfg({ deck: deckOf('guano_bomb', 'ripe_harvest') }));
    const bomb = d.pool.findIndex((c) => c?.id === 'guano_bomb');
    expect(d.takeSpell(bomb)).toBe(true);
    expect(d.canCast(0)).toBe(false); // nothing to hit by day
    d.endDay();
    for (let i = 0; i < 60 * 4; i++) d.step(1 / 60);
    expect(d.canCast(0)).toBe(true);
  });
});

describe('roost levels', () => {
  const stackDeck = () => deckOf('egyptian_fruit', 'egyptian_fruit', 'egyptian_fruit', 'egyptian_fruit');

  it('a pool card merges only onto a level-1 roost of the same bat', () => {
    const d = new Defense(cfg({ matriarchId: 'ghost_bat', roster: roster(['egyptian_fruit', 'pallas_tongue']), deck: stackDeck() }));
    d.guano = 99;
    d.place(0, 7);
    expect(d.canPlace(1, 7)).toBe(true);
    d.place(1, 7);
    expect(d.slots[7].roost!.level).toBe(2);
    d.refresh();
    expect(d.canPlace(0, 7)).toBe(false); // level 2 now: needs another level 2
    expect(d.canPlace(0, 12)).toBe(true); // an empty tile is fine
  });

  it('two roosts merge only at the same level, freeing a tile and firing the pattern', () => {
    // Egyptian Fruit Bat pattern: the tile to its right.
    const d = new Defense(cfg({ matriarchId: 'ghost_bat', roster: roster(['egyptian_fruit']), deck: stackDeck() }));
    d.guano = 99;
    d.place(0, 5);
    d.place(1, 6);
    d.slots[5].roost!.level = 2;
    expect(d.canMerge(6, 5)).toBe(false); // levels 1 and 2
    d.slots[6].roost!.level = 2;
    d.refresh();
    d.place(0, 7); // right of tile 6
    expect(d.merge(5, 6)).toBe(true);
    expect(d.slots[5].roost).toBeNull();
    expect(d.slots[6].roost!.level).toBe(3);
    expect(d.slots[7].roost!.level).toBe(2); // pattern bump
    expect(d.canMerge(7, 6)).toBe(false); // levels 2 and 3
  });

  it('each level adds a bat, up to the cap', () => {
    const d = new Defense(cfg({ deck: stackDeck(), matriarchId: 'ghost_bat', roster: roster(['egyptian_fruit']) }));
    d.place(0, 7);
    const r = d.slots[7].roost!;
    const base = BAT_BY_ID.egyptian_fruit.roost.count;
    expect(d.batsPerRoost(r)).toBe(base);
    r.level = 3;
    expect(d.batsPerRoost(r)).toBe(base + 2);
    r.level = 9;
    expect(d.batsPerRoost(r)).toBe(base + BALANCE.roostLevel.maxExtraBats);
  });

  it('a stack also levels the roosts in the bat pattern, without chaining', () => {
    // Egyptian Fruit Bat pattern: the tile to its right.
    const d = new Defense(cfg({ matriarchId: 'ghost_bat', roster: roster(['egyptian_fruit']), deck: stackDeck() }));
    d.guano = 99;
    d.place(0, 8); // to the right of tile 7
    d.place(1, 7);
    d.refresh();
    d.place(0, 7);
    expect(d.slots[7].roost!.level).toBe(2);
    expect(d.slots[8].roost!.level).toBe(2);
    expect(d.slots[9].roost).toBeNull();
  });

  it('level 10 holds one mega bat that only returns after it dies', () => {
    const d = new Defense(cfg({ deck: deckOf('little_brown', 'fledgling'), caveHp: 1e9, caveMax: 1e9 }));
    d.guano = 99;
    const i = d.pool.findIndex((c) => c?.id === 'little_brown');
    d.place(i, 7);
    const r = d.slots[7].roost!;
    r.level = BALANCE.roostLevel.megaLevel;
    d.endDay();
    const mine = () => d.units.filter((u) => u.side === 'bat' && u.home === 7 && !u.dead);
    expect(mine().length).toBe(0); // nothing out at dusk: the cooldown runs first
    for (let k = 0; k < 60 * (d.respawnTime(r) + 0.1); k++) d.step(1 / 60);
    expect(mine().length).toBe(1);
    expect(mine()[0].mega).toBe(true);
    expect(mine()[0].maxHp).toBeGreaterThan(BAT_BY_ID.little_brown.stats.hp * BAT_BY_ID.little_brown.roost.count * 2);
    mine()[0].dead = true;
    d.step(1 / 60);
    for (let k = 0; k < 60 * (d.respawnTime(r) - 1); k++) d.step(1 / 60);
    expect(mine().length).toBe(0);
    for (let k = 0; k < 60 * 1.2; k++) d.step(1 / 60);
    expect(mine().length).toBe(1);
  });

  it('roosts do not expire between nights', () => {
    const d = new Defense(cfg({ deck: deckOf('fledgling', 'fledgling'), caveHp: 1e9, caveMax: 1e9 }));
    d.place(0, 7);
    d.slots[7].roost!.hp = d.slots[7].roost!.maxHp = 1e9; // can't be destroyed: this checks expiry only
    for (let n = 0; n < 4 && d.phase === 'day'; n++) {
      d.endDay();
      runNight(d);
    }
    expect(d.slots[7].roost).not.toBeNull();
  });
});

describe('defense rules', () => {
  const wreck = (d: Defense, slot: number) => {
    d.slots[slot].roost!.hp = 1;
    d.endDay();
    for (const u of d.units) u.dead = true; // ground the roost's bats so the cat reaches it
    (d as unknown as { spawnEnemy(id: string, x: number): void }).spawnEnemy('cat', d.slots[slot].x);
    d.units[d.units.length - 1].y = 5.5;
    for (let i = 0; i < 60 * 10 && d.slots[slot].roost && !d.slots[slot].roost!.ruined; i++) d.step(1 / 60);
  };
  const finishNight = (d: Defense) => {
    for (let i = 0; i < 60 * 120 && d.phase === 'night'; i++) d.step(1 / 60);
  };

  it('a destroyed roost stops blocking for the night and is rebuilt at dawn at the same level', () => {
    const d = new Defense(cfg({ deck: [newCard('bat', 'common_vampire'), newCard('bat', 'little_brown')], caveHp: 1e9, caveMax: 1e9 }));
    d.guano = 99;
    expect(d.place(0, 2)).toBe(true);
    const r = d.slots[2].roost!;
    r.level = 4;
    wreck(d, 2);
    expect(r.ruined).toBe(true);
    for (let i = 0; i < 60 * 20; i++) d.step(1 / 60);
    expect(d.units.some((u) => u.side === 'bat' && u.home === 2)).toBe(false);
    finishNight(d);
    expect(d.phase).toBe('day');
    expect(d.slots[2].roost).toBe(r);
    expect(r.ruined).toBe(false);
    expect(r.level).toBe(4);
    expect(r.hp).toBe(Math.round((r.maxHp * BALANCE.rebuildHpPct) / 100));
  });

  it('gives terrain bonuses only to the matching clan', () => {
    const d = new Defense(cfg());
    const pen = d.slots.find((s) => s.terrain === 'pen');
    if (pen) {
      expect(d.terrainMatches(pen.idx, 'common_vampire')).toBe(true);
      expect(d.terrainMatches(pen.idx, 'little_brown')).toBe(false);
    }
  });

  it('plans every night and adds the finale', () => {
    const d = new Defense(cfg({ encounterId: 'great_horned', row: 7 }));
    expect(d.plans.length).toBe(d.nights);
    expect(d.plans[d.nights - 1].some((g) => g.enemy === 'horned_owl')).toBe(true);
    for (const p of d.plans) expect(p.length).toBeGreaterThan(0);
  });

  it('loses when nothing defends the cave', () => {
    const d = new Defense(cfg({ encounterId: 'barn_cats', row: 2, caveHp: 100 }));
    while (d.phase === 'day') {
      d.endDay();
      runNight(d);
    }
    expect(d.phase).toBe('lost');
  });

  it('enemies keep walking speed through the roost zone with nothing blocking', () => {
    const d = new Defense(cfg({ caveHp: 1e9, caveMax: 1e9 }));
    d.endDay();
    (d as unknown as { spawnEnemy(id: string, x: number): void }).spawnEnemy('beetle', 0.5);
    const beetle = d.units[d.units.length - 1];
    beetle.y = BALANCE.field.roostTopY;
    const y0 = beetle.y;
    d.step(0.5);
    expect((beetle.y - y0) / 0.5).toBeCloseTo(beetle.stats.speed, 1);
  });
});

describe('matriarchs', () => {
  const two = (id: string) => deckOf(id, id, id, id);

  it('Seed Spreader refunds guano on every merge', () => {
    const d = new Defense(cfg({ matriarchId: 'flying_fox', roster: roster(['flying_fox', 'egyptian_fruit']), deck: two('egyptian_fruit') }));
    d.guano = 20;
    d.place(0, 7);
    const g = d.guano;
    d.place(1, 7);
    expect(d.guano).toBe(g - BAT_BY_ID.egyptian_fruit.cost + 1);
  });

  it('Pair Bond merges into a roost one level higher, not two', () => {
    const d = new Defense(cfg({ matriarchId: 'spectral_bat', roster: roster(['spectral_bat', 'egyptian_fruit']), deck: two('egyptian_fruit') }));
    d.guano = 99;
    d.place(0, 5);
    d.place(1, 10);
    d.slots[5].roost!.level = 2;
    expect(d.canMerge(10, 5)).toBe(true); // 1 into 2
    expect(d.canMerge(5, 10)).toBe(false); // never downward
    d.slots[5].roost!.level = 3;
    expect(d.canMerge(10, 5)).toBe(false); // 1 into 3
    const plain = new Defense(cfg({ deck: two('egyptian_fruit'), roster: roster(['ghost_bat', 'egyptian_fruit']) }));
    plain.guano = 99;
    plain.place(0, 5);
    plain.place(1, 10);
    plain.slots[5].roost!.level = 2;
    expect(plain.canMerge(10, 5)).toBe(false);
  });

  it('Long Range shows three cards and Feeding Roost pays more for kills', () => {
    const n = new Defense(cfg({ matriarchId: 'greater_noctule', roster: roster(['greater_noctule', 'little_brown']), deck: two('little_brown') }));
    expect(n.pool.length).toBe(BALANCE.economy.poolSize + 1);
    const g = new Defense(cfg());
    expect(g.rule.killsPerGuano).toBe(2);
  });

  it('a levelled matriarch adds starting guano', () => {
    const lv1 = new Defense(cfg()).guano;
    const lv7 = new Defense(cfg({ roster: { ...roster(['little_brown', 'common_vampire', 'fledgling']), ghost_bat: { ...newOwnedBat(), level: 7 } } })).guano;
    expect(lv7).toBe(lv1 + 2);
  });
});

/** Put a roost straight onto a tile (bypassing the pool), for rule tests. */
const put = (d: Defense, idx: number, batId: string, level = 1) => {
  (d as unknown as { newRoost(s: unknown, bp: unknown): void }).newRoost(d.slots[idx], blueprint(batId, undefined));
  d.slots[idx].roost!.level = level;
  return d.slots[idx].roost!;
};
const at = (col: number, row: number) => row * 5 + col;
const big = () => new Defense(cfg({ caveHp: 1e9, caveMax: 1e9 }));

describe('formations', () => {
  const ids = (d: Defense) => d.formations().map((f) => f.id).sort();

  it('finds pairs, lines, columns, clusters and full rows', () => {
    let d = big();
    put(d, at(0, 0), 'little_brown');
    put(d, at(1, 0), 'little_brown');
    expect(ids(d)).toEqual(['pair']);
    put(d, at(2, 0), 'big_brown'); // insectivore: makes a Line of 3, no new pair
    expect(ids(d)).toEqual(['line', 'pair']);
    d = big();
    for (const r of [0, 1, 2]) put(d, at(4, r), r === 1 ? 'common_vampire' : 'egyptian_fruit');
    expect(ids(d)).toEqual(['column']);
    d = big();
    put(d, at(0, 1), 'little_brown'); put(d, at(1, 1), 'big_brown'); put(d, at(0, 2), 'eastern_red'); put(d, at(1, 2), 'hoary');
    expect(ids(d)).toContain('cluster');
    d = big();
    for (let c = 0; c < 5; c++) put(d, at(c, 2), ['little_brown', 'egyptian_fruit', 'common_vampire', 'lesser_bulldog', 'pallas_tongue'][c]);
    expect(ids(d)).toEqual(['full_row']);
  });

  it('ignores wrecked roosts, and star charts raise the bonus', () => {
    const d = new Defense(cfg({ caveHp: 1e9, caveMax: 1e9, formationLevels: { pair: 3 } }));
    put(d, at(0, 0), 'little_brown');
    put(d, at(1, 0), 'little_brown').ruined = true;
    expect(d.formations()).toEqual([]);
    expect(d.formationValue('pair')).toBe(20 + 10 * 2);
  });

  it('locks in at dusk: a pair gives its bats attack', () => {
    const d = big();
    put(d, at(0, 0), 'little_brown');
    put(d, at(1, 0), 'little_brown');
    d.endDay();
    expect(d.nightFormations.map((f) => f.id)).toEqual(['pair']);
    for (let k = 0; k < 60 * (BAT_BY_ID.little_brown.roost.respawn + 0.1); k++) d.step(1 / 60);
    const bat = d.units.find((u) => u.side === 'bat' && u.home === at(0, 0))!;
    expect(bat.mods.atkPct).toBe(20);
  });

  it('clusters pay guano at dawn', () => {
    const d = big();
    const before = d.projectedIncome();
    put(d, at(0, 1), 'egyptian_fruit'); put(d, at(1, 1), 'egyptian_fruit'); put(d, at(0, 2), 'jamaican_fruit'); put(d, at(1, 2), 'sebas');
    const housed = Math.floor(d.housedBats() / BALANCE.economy.batsPerGuano);
    expect(d.projectedIncome()).toBe(before + housed + 2);
  });
});

describe('charms, enhancements, boss rules, interest', () => {
  it('pays interest on unspent guano, capped, and Hoarder raises the cap', () => {
    const d = big();
    d.guano = 12;
    expect(d.interestNow()).toBe(2);
    d.guano = 100;
    expect(d.interestNow()).toBe(BALANCE.interest.cap);
    const h = new Defense(cfg({ charms: ['hoard'] }));
    h.guano = 100;
    expect(h.interestNow()).toBe(BALANCE.interest.cap + 3);
  });

  it('Foster Mother lets a Fledgling merge into any roost of its level', () => {
    const plain = big();
    put(plain, at(0, 0), 'little_brown');
    put(plain, at(1, 0), 'fledgling');
    expect(plain.canMerge(at(1, 0), at(0, 0))).toBe(false);
    const d = new Defense(cfg({ charms: ['foster'], caveHp: 1e9, caveMax: 1e9 }));
    put(d, at(0, 0), 'little_brown');
    put(d, at(1, 0), 'fledgling');
    expect(d.canMerge(at(1, 0), at(0, 0))).toBe(true);
  });

  it('Ripple chains a pattern bump once; Windfall pays for big merges', () => {
    // Egyptian Fruit Bat pattern: the tile to its right.
    const d = new Defense(cfg({ charms: ['ripple', 'windfall'], deck: deckOf('egyptian_fruit', 'egyptian_fruit'), caveHp: 1e9, caveMax: 1e9 }));
    d.guano = 99;
    put(d, at(1, 0), 'egyptian_fruit');
    put(d, at(2, 0), 'egyptian_fruit', 3);
    put(d, at(3, 0), 'little_brown');
    d.place(0, at(1, 0)); // merge: 1→2, bumps tile 2 (3→4), which ripples to tile 3
    expect(d.slots[at(2, 0)].roost!.level).toBe(4);
    expect(d.slots[at(3, 0)].roost!.level).toBe(2);
  });

  it('Foil starts at level 2; Glass shatters out of the deck when its roost falls', () => {
    const foil = { ...newCard('bat', 'little_brown'), mod: 'foil' as const };
    const glass = { ...newCard('bat', 'common_vampire'), mod: 'glass' as const };
    const d = new Defense(cfg({ deck: [foil, glass], caveHp: 1e9, caveMax: 1e9 }));
    d.guano = 99;
    d.place(d.pool.findIndex((c) => c?.uid === foil.uid), at(0, 0));
    expect(d.slots[at(0, 0)].roost!.level).toBe(2);
    d.place(d.pool.findIndex((c) => c?.uid === glass.uid), at(2, 0));
    const r = d.slots[at(2, 0)].roost!;
    expect(r.glass).toEqual([glass.uid]);
    r.hp = 1;
    d.endDay();
    for (const u of d.units) u.dead = true;
    (d as unknown as { spawnEnemy(id: string, x: number): void }).spawnEnemy('cat', d.slots[at(2, 0)].x);
    d.units[d.units.length - 1].y = 5.5;
    for (let i = 0; i < 60 * 10 && !r.ruined; i++) d.step(1 / 60);
    expect(d.shattered).toEqual([glass.uid]);
  });

  it("Owl's Watch closes the left column; Storm shrinks the pool; Drought stops roost income", () => {
    const owl = new Defense(cfg({ bossRule: 'owl_watch' }));
    owl.guano = 99;
    const i = owl.pool.findIndex((c) => c?.kind === 'bat');
    expect(owl.canPlace(i, at(0, 0))).toBe(false);
    expect(owl.canPlace(i, at(1, 0))).toBe(true);
    expect(new Defense(cfg({ bossRule: 'storm' })).pool.length).toBe(BALANCE.economy.poolSize - 1);
    const dr = new Defense(cfg({ bossRule: 'drought', caveHp: 1e9, caveMax: 1e9 }));
    put(dr, at(0, 0), 'little_brown');
    dr.endDay();
    for (let k = 0; k < 60 * 120 && dr.phase === 'night'; k++) dr.step(1 / 60);
    expect(dr.lastIncomeParts.roosts).toBe(0);
  });

  it('Second Wind holds the cave once, then breaks', () => {
    const d = new Defense(cfg({ charms: ['second_wind'], caveHp: 1, caveMax: 1000 }));
    d.endDay();
    for (let k = 0; k < 60 * 120 && d.phase === 'night' && !d.brokenCharms.length; k++) d.step(1 / 60);
    expect(d.brokenCharms).toEqual(['second_wind']);
    expect(d.cave.hp).toBeGreaterThan(0);
  });

  it('the nursery holds no bats, never merges, and losing it loses the level', () => {
    const d = new Defense(cfg({ objective: 'nursery', caveHp: 1e9, caveMax: 1e9 }));
    const n = d.slots.find((s) => s.roost?.nursery)!;
    expect(d.batsPerRoost(n.roost!)).toBe(0);
    expect(d.formations()).toEqual([]);
    n.roost!.hp = 1;
    d.endDay();
    (d as unknown as { spawnEnemy(id: string, x: number): void }).spawnEnemy('cat', n.x);
    d.units[d.units.length - 1].y = 5.5;
    for (let k = 0; k < 60 * 30 && d.phase === 'night'; k++) d.step(1 / 60);
    expect(d.phase).toBe('lost');
  });

  it('forecasts weak columns as danger and well-held ones as safe', () => {
    const d = big();
    const col = d.tonight[0].col;
    expect(d.forecast().find((f) => f.col === col)!.label).toBe('danger');
    for (const r of [0, 1, 2]) put(d, at(col, r), 'little_brown', 6);
    expect(d.forecast().find((f) => f.col === col)!.label).toBe('safe');
  });
});

/** Balance report. Run: npx vitest run tests/defense.test.ts -t balance --reporter=verbose */
describe('balance smoke', () => {
  const drafted = () => [newCard('bat', 'egyptian_fruit'), newCard('bat', 'egyptian_fruit', true), newCard('bat', 'straw_fruit'),
    newCard('bat', 'pallas_tongue'), newCard('spell', 'ripe_harvest'), newCard('spell', 'screech')];
  const decks: Record<string, { mat: string; flock: string[]; extra: Card[]; level: number }> = {
    'ghost starter L1': { mat: 'ghost_bat', flock: ['little_brown', 'common_vampire', 'egyptian_fruit'], extra: [], level: 1 },
    'fox starter L1': { mat: 'flying_fox', flock: ['egyptian_fruit', 'pallas_tongue', 'little_brown'], extra: [], level: 1 },
    'spectral starter L1': { mat: 'spectral_bat', flock: ['lesser_bulldog', 'common_vampire', 'little_brown'], extra: [], level: 1 },
    'fox drafted L1': { mat: 'flying_fox', flock: ['egyptian_fruit', 'pallas_tongue', 'little_brown'], level: 1, extra: drafted() },
    'ghost starter L5': { mat: 'ghost_bat', flock: ['little_brown', 'common_vampire', 'egyptian_fruit'], extra: [], level: 5 },
    'fox drafted L5': { mat: 'flying_fox', flock: ['egyptian_fruit', 'pallas_tongue', 'little_brown'], level: 5, extra: drafted() },
    'ghost starter L9 + skills': { mat: 'ghost_bat', flock: ['little_brown', 'common_vampire', 'egyptian_fruit'], extra: [], level: 9 },
  };
  for (const [name, d] of Object.entries(decks)) {
    it(name, () => {
      const rows: string[] = [];
      for (const enc of ENCOUNTERS) {
        const row = enc.tier === 'boss' ? 7 : enc.minRow;
        let wins = 0;
        let lost = 0;
        const N = 8;
        for (let s = 0; s < N; s++) {
          const deck = [...buildStartingDeck(d.flock), ...d.extra.map((c) => newCard(c.kind, c.id, c.upgraded))];
          const def = new Defense(cfg({
            encounterId: enc.id, row, deck, matriarchId: d.mat, seed: s * 7 + 1,
            roster: roster([d.mat, 'fledgling', ...d.flock, ...d.extra.filter((c) => c.kind === 'bat').map((c) => c.id)], d.level),
          }));
          if (botLevel(def) === 'won') wins++;
          lost += 1000 - def.cave.hp;
        }
        rows.push(`${enc.id.padEnd(14)} row ${row}  win ${wins}/${N}  avg cave dmg ${(lost / N).toFixed(0)}`);
      }
      console.log(`\n${name}\n  ${rows.join('\n  ')}`);
      expect(rows.length).toBe(ENCOUNTERS.length);
    }, 120_000);
  }
});

describe('night pacing and economy', () => {
  it('releases bats one cooldown at a time, in batches for swarm roosts', () => {
    const d = new Defense(cfg({ deck: deckOf('little_brown', 'common_vampire'), caveHp: 1e9, caveMax: 1e9 }));
    d.guano = 99;
    d.place(d.pool.findIndex((c) => c?.id === 'little_brown'), 7);
    d.place(d.pool.findIndex((c) => c?.id === 'common_vampire'), 8);
    d.endDay();
    const out = (slot: number) => d.units.filter((u) => u.side === 'bat' && u.home === slot && !u.dead).length;
    expect(out(7) + out(8)).toBe(0);
    for (let k = 0; k < 60 * (BAT_BY_ID.little_brown.roost.respawn + 0.1); k++) d.step(1 / 60);
    expect(out(7)).toBe(2); // Little Brown Bats come in pairs
    expect(out(8)).toBe(0); // vampire cooldown is longer
    for (let k = 0; k < 60 * (BAT_BY_ID.common_vampire.roost.respawn - BAT_BY_ID.little_brown.roost.respawn); k++) d.step(1 / 60);
    expect(out(8)).toBe(1);
  });

  it('waits a moment after the last enemy falls before dawn', () => {
    const d = new Defense(cfg({ caveHp: 1e9, caveMax: 1e9 }));
    d.endDay();
    (d as unknown as { spawnQueue: unknown[] }).spawnQueue = [];
    d.units = [];
    d.step(BALANCE.night.dawnDelay / 2);
    expect(d.phase).toBe('night');
    d.step(BALANCE.night.dawnDelay);
    expect(d.phase).toBe('day');
  });

  it('pays dawn income from housed bats, so building roosts grows it', () => {
    const d = new Defense(cfg({ deck: deckOf('little_brown', 'common_vampire'), caveHp: 1e9, caveMax: 1e9 }));
    const bare = d.projectedIncome();
    expect(bare).toBe(BALANCE.economy.perDawn);
    d.guano = 99;
    d.place(d.pool.findIndex((c) => c?.id === 'little_brown'), 7); // 4 bats -> +2
    expect(d.projectedIncome()).toBe(bare + Math.floor(BAT_BY_ID.little_brown.roost.count / BALANCE.economy.batsPerGuano));
  });

  it('keeps levelling past 10 with stats still rising', () => {
    const d = new Defense(cfg({ deck: deckOf('little_brown', 'fledgling'), caveHp: 1e9, caveMax: 1e9 }));
    d.guano = 99;
    d.place(d.pool.findIndex((c) => c?.id === 'little_brown'), 7);
    d.place(d.pool.findIndex((c) => c?.id === 'fledgling'), 8);
    d.slots[7].roost!.level = 10;
    d.slots[8].roost!.level = 10;
    d.slots[8].roost!.batId = 'little_brown';
    d.slots[8].roost!.bp = d.slots[7].roost!.bp;
    expect(d.merge(8, 7)).toBe(true);
    expect(d.slots[7].roost!.level).toBe(11);
    const hpAt = (lvl: number) => {
      d.slots[7].roost!.level = lvl;
      (d as unknown as { spawnBat(s: unknown, x: number, y: number): void }).spawnBat(d.slots[7], 7.5, 7);
      return d.units[d.units.length - 1].maxHp;
    };
    d.endDay();
    expect(hpAt(12)).toBeGreaterThan(hpAt(10));
    expect(d.units[d.units.length - 1].armored).toBe(true);
  });
});
