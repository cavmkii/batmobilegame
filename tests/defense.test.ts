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

/**
 * A simple player: commander first, then roosts into the columns tonight's enemies use,
 * preferring terrain and same-clan neighbours. Keeps 2 energy for a held spell.
 * At night, fires damage/stun spells once an enemy gets close to the cave.
 */
export function botDay(d: Defense) {
  const cols = new Set(d.tonight.map((g) => g.col));
  const score = (slot: number, batId: string) => {
    const s = d.slots[slot];
    return (cols.has(s.col) ? 10 : 0) + (2 - s.row) * 2 + (d.terrainMatches(slot, batId) ? 6 : 0) + d.neighbourMatches(slot, batId) * 2;
  };
  const bestSlot = (batId: string) => {
    let best = -1;
    for (const s of d.slots) if (!s.roost && (best < 0 || score(s.idx, batId) > score(best, batId))) best = s.idx;
    return best;
  };
  if (!d.commander.inPlay) {
    const s = bestSlot(d.commander.bp.batId);
    if (s >= 0 && d.canPlace('cmd', s)) d.place('cmd', s);
  }
  // Heals are worth casting by day if anything is hurt.
  const hurt = d.cave.hp < d.cave.max * 0.8 || d.slots.some((s) => s.roost && s.roost.hp < s.roost.maxHp * 0.6);
  const heal = d.hand.findIndex((c, idx) => c.kind === 'spell' && SPELL_BY_ID[c.id].effect.kind === 'healAll' && d.canCast(idx));
  if (hurt && heal >= 0) d.cast(heal);
  for (let guard = 0; guard < 10; guard++) {
    const nightSpell = d.hand.find((c) => c.kind === 'spell' && SPELL_BY_ID[c.id].effect.kind !== 'healAll');
    const reserve = nightSpell ? d.cardCost(nightSpell) : 0;
    const i = d.hand.findIndex((c) => c.kind === 'bat' && d.cardCost(c) <= d.energy - reserve);
    if (i < 0) break;
    const s = bestSlot(d.hand[i].id);
    if (s < 0 || !d.place(i, s)) break;
  }
}

export function botNight(d: Defense) {
  for (let i = 0; i < 60 * 120 && d.phase === 'night'; i++) {
    const near = d.units.some((u) => u.side === 'enemy' && u.y > 6);
    if (near && i % 30 === 0) {
      const healNow = d.cave.hp < d.cave.max * 0.6;
      const k = d.hand.findIndex((c, idx) => c.kind === 'spell' && d.canCast(idx) && (SPELL_BY_ID[c.id].effect.kind !== 'healAll' || healNow));
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

describe('defense rules', () => {
  it('ramps energy and draws per day', () => {
    const d = new Defense(cfg({ encounterId: 'snake_den' }));
    expect(d.hand.length).toBe(BALANCE.day.openingHand);
    expect(d.energy).toBe(3);
    d.endDay();
    runNight(d);
    expect(d.phase).not.toBe('night');
    if (d.phase === 'day') {
      expect(d.day).toBe(2);
      expect(d.energy).toBe(4);
      expect(d.hand.length).toBe(Math.min(BALANCE.day.maxHand, BALANCE.day.openingHand + BALANCE.day.drawPerDay));
    }
  });

  it('only places bats by day, and spells are instants', () => {
    const deck: Card[] = [newCard('bat', 'fledgling'), newCard('spell', 'guano_bomb'), newCard('spell', 'ripe_harvest'),
      newCard('bat', 'fledgling'), newCard('bat', 'fledgling')];
    const d = new Defense(cfg({ deck }));
    const bat = d.hand.findIndex((c) => c.kind === 'bat');
    const bomb = d.hand.findIndex((c) => c.id === 'guano_bomb');
    const harvest = d.hand.findIndex((c) => c.id === 'ripe_harvest');
    expect(d.canCast(bomb)).toBe(false); // nothing to hit by day
    expect(d.canCast(harvest)).toBe(true); // heals work by day
    expect(d.canPlace(bat, 0)).toBe(true);
    d.endDay();
    expect(d.canPlace(d.hand.findIndex((c) => c.kind === 'bat'), 0)).toBe(false);
    for (let i = 0; i < 60 * 4; i++) d.step(1 / 60);
    expect(d.canCast(d.hand.findIndex((c) => c.id === 'guano_bomb'))).toBe(true);
  });

  it('carries unspent day energy into the night', () => {
    const d = new Defense(cfg());
    const before = d.energy;
    d.endDay();
    expect(d.energy).toBe(before);
  });

  it('releases bats from roosts at night and expires roosts after their nights', () => {
    // Indestructible cave, so this checks expiry rather than defense strength.
    const d = new Defense(cfg({ deck: Array.from({ length: 6 }, () => newCard('bat', 'fledgling')), caveHp: 1e9, caveMax: 1e9 }));
    d.place(0, 7);
    const nights = BAT_BY_ID.fledgling.roost.nights;
    d.endDay();
    expect(d.units.filter((u) => u.side === 'bat').length).toBe(BAT_BY_ID.fledgling.roost.count);
    for (let n = 0; n < nights; n++) {
      runNight(d);
      if (d.phase !== 'day') break;
      if (n < nights - 1) d.endDay();
    }
    expect(d.slots[7].roost).toBeNull();
    // The card left the board and is back in the deck cycle (discard, or redrawn after a reshuffle).
    expect(d.hand.length + d.drawPile.length + d.discard.length).toBe(6);
  });

  it('charges commander tax after the commander roost is destroyed', () => {
    const d = new Defense(cfg());
    const base = d.commanderCost();
    d.energy = 10;
    expect(d.place('cmd', 2)).toBe(true);
    expect(d.canPlace('cmd', 3)).toBe(false);
    d.slots[2].roost!.hp = 1;
    // Put an enemy right above it.
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

  it('plans every night within budget and adds the finale', () => {
    const d = new Defense(cfg({ encounterId: 'great_horned', row: 7 }));
    expect(d.plans.length).toBe(5);
    expect(d.plans[4].some((g) => g.enemy === 'horned_owl')).toBe(true);
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
    });
  }
});
