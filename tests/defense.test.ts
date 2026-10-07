import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/balance';
import { BAT_BY_ID } from '../src/data/bats';
import { ENCOUNTERS } from '../src/data/enemies';
import { SPELL_BY_ID } from '../src/data/spells';
import type { Card } from '../src/data/types';
import { Defense, type DefenseConfig } from '../src/game/defense';
import { buildStartingDeck, newCard } from '../src/game/deck';
import { newOwnedBat, type OwnedBat } from '../src/game/progression';

const roster = (ids: string[], level = 1): Record<string, OwnedBat> =>
  Object.fromEntries(ids.map((id) => [id, { ...newOwnedBat(), level }]));

function cfg(over: Partial<DefenseConfig> = {}): DefenseConfig {
  return {
    encounterId: 'moth_cloud',
    row: 0,
    deck: buildStartingDeck(['little_brown', 'common_vampire']),
    commanderId: 'ghost_bat',
    roster: roster(['ghost_bat', 'little_brown', 'common_vampire', 'fledgling']),
    relics: [],
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
 * A simple player. Commander first; then for each pool card: stack it onto its roost if one
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
  if (!d.commander.inPlay) {
    const s = bestEmpty(d.commander.bp.batId);
    if (s >= 0) d.place('cmd', s);
  }
  for (let refreshes = 0; refreshes < 3; refreshes++) {
    for (let i = 0; i < d.pool.length; i++) {
      const c = d.pool[i];
      if (!c) continue;
      if (c.kind === 'spell') { d.takeSpell(i); continue; }
      const stack = d.slots.find((s) => d.canStackOn(s, c.id));
      const target = stack ? stack.idx : bestEmpty(c.id);
      if (target >= 0) d.place(i, target);
    }
    const reserve = d.spells.length ? 1 : 0;
    if (d.guano - d.refreshCost < 2 + reserve) break;
    if (!d.refresh()) break;
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

  it('stacking the same bat levels its roost; a different bat cannot stack', () => {
    const d = new Defense(cfg({ commanderId: 'flying_fox', roster: roster(['flying_fox', 'egyptian_fruit', 'pallas_tongue']), deck: stackDeck() }));
    d.guano = 99;
    d.place(0, 7);
    expect(d.canPlace(1, 7)).toBe(true);
    d.place(1, 7);
    expect(d.slots[7].roost!.level).toBe(2);
    d.slots[7].roost!.batId = 'pallas_tongue';
    d.refresh();
    expect(d.canPlace(0, 7)).toBe(false);
  });

  it('a stack also levels the roosts in the bat pattern, without chaining', () => {
    // Egyptian Fruit Bat pattern: the tile to its right.
    const d = new Defense(cfg({ commanderId: 'flying_fox', roster: roster(['flying_fox', 'egyptian_fruit']), deck: stackDeck() }));
    d.guano = 99;
    d.place('cmd', 8); // commander to the right of tile 7
    d.place(0, 7);
    d.place(1, 7);
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
    r.level = BALANCE.roostLevel.max;
    d.endDay();
    const mine = () => d.units.filter((u) => u.side === 'bat' && u.home === 7 && !u.dead);
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
  it('charges commander tax after the commander roost is destroyed', () => {
    const d = new Defense(cfg());
    const base = d.commanderCost();
    d.guano = 99;
    expect(d.place('cmd', 2)).toBe(true);
    d.slots[2].roost!.hp = 1;
    d.endDay();
    for (const u of d.units) u.dead = true; // ground the commander's bats so the cat reaches the roost
    (d as unknown as { spawnEnemy(id: string, x: number): void }).spawnEnemy('cat', 2.5);
    d.units[d.units.length - 1].y = 5.5;
    for (let i = 0; i < 60 * 10 && d.slots[2].roost; i++) d.step(1 / 60);
    expect(d.slots[2].roost).toBeNull();
    expect(d.commanderCost()).toBe(base + 2);
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

  it('enemies rush the cave once nothing blocks their column', () => {
    const d = new Defense(cfg({ caveHp: 1e9, caveMax: 1e9 }));
    d.endDay();
    (d as unknown as { spawnEnemy(id: string, x: number): void }).spawnEnemy('beetle', 0.5);
    const beetle = d.units[d.units.length - 1];
    beetle.y = BALANCE.field.roostTopY;
    const y0 = beetle.y;
    d.step(0.5);
    expect((beetle.y - y0) / 0.5).toBeCloseTo(beetle.stats.speed * BALANCE.night.rushMult, 1);
  });
});

/** Balance report. Run: npx vitest run tests/defense.test.ts -t balance --reporter=verbose */
describe('balance smoke', () => {
  const decks: Record<string, { cmd: string; core: string[]; extra: Card[]; level: number }> = {
    'ghost starter L1': { cmd: 'ghost_bat', core: ['little_brown', 'common_vampire'], extra: [], level: 1 },
    'fox starter L1': { cmd: 'flying_fox', core: ['egyptian_fruit', 'pallas_tongue'], extra: [], level: 1 },
    'fox drafted L1': { cmd: 'flying_fox', core: ['egyptian_fruit', 'pallas_tongue'], level: 1,
      extra: [newCard('bat', 'straw_fruit', true), newCard('bat', 'long_nosed'), newCard('bat', 'hammerhead'),
        newCard('spell', 'ripe_harvest'), newCard('spell', 'screech'), newCard('spell', 'pollen_burst')] },
    'ghost starter L5': { cmd: 'ghost_bat', core: ['little_brown', 'common_vampire'], extra: [], level: 5 },
    'fox drafted L5': { cmd: 'flying_fox', core: ['egyptian_fruit', 'pallas_tongue'], level: 5,
      extra: [newCard('bat', 'straw_fruit', true), newCard('bat', 'long_nosed'), newCard('bat', 'hammerhead'),
        newCard('spell', 'ripe_harvest'), newCard('spell', 'screech'), newCard('spell', 'pollen_burst')] },
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
          const deck = [...buildStartingDeck(d.core), ...d.extra.map((c) => newCard(c.kind, c.id, c.upgraded))];
          const def = new Defense(cfg({
            encounterId: enc.id, row, deck, commanderId: d.cmd, seed: s * 7 + 1,
            roster: roster([d.cmd, 'fledgling', ...d.core, ...d.extra.filter((c) => c.kind === 'bat').map((c) => c.id)], d.level),
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
