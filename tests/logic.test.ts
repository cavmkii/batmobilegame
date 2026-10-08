import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/balance';
import { BAT_BY_ID } from '../src/data/bats';
import { buildStartingDeck, copiesIn, flockOptions, validateSetup } from '../src/game/deck';
import { pull, resolveDupe } from '../src/game/gacha';
import { generateMap } from '../src/game/map';
import { chooseStarter, newProfile } from '../src/game/profile';
import { blueprint, newOwnedBat } from '../src/game/progression';
import { Rng } from '../src/game/rng';
import { addCard, availableNodes, draftOffers, enterNode, finishRun, resolveBattle, startRun } from '../src/game/run';

const starter = (cmd = 'ghost_bat') => {
  const p = newProfile();
  chooseStarter(p, cmd);
  return p;
};

describe('matriarch and starting flock', () => {
  it('offers owned bats for the flock, never matriarchs or Fledglings', () => {
    const p = starter('ghost_bat');
    expect(flockOptions(p).sort()).toEqual(['common_vampire', 'egyptian_fruit', 'lesser_bulldog', 'little_brown', 'pallas_tongue']);
  });

  it('validates the setup', () => {
    const p = starter('ghost_bat');
    expect(validateSetup(p, 'ghost_bat', ['little_brown', 'egyptian_fruit', 'pallas_tongue'])).toBeNull();
    expect(validateSetup(p, 'ghost_bat', ['little_brown', 'egyptian_fruit', 'pallas_tongue', 'lesser_bulldog'])).toMatch(/up to/);
    expect(validateSetup(p, 'ghost_bat', ['little_brown', 'little_brown'])).toMatch(/once/);
    expect(validateSetup(p, 'ghost_bat', ['hammerhead'])).toMatch(/collection/);
    expect(validateSetup(p, 'flying_fox', [])).toMatch(/own/);
    expect(validateSetup(p, 'little_brown', [])).toMatch(/matriarch/);
  });

  it('starts with copies of each species plus Fledglings, at a fixed size', () => {
    const F = BALANCE.run.flock;
    const full = buildStartingDeck(['little_brown', 'egyptian_fruit', 'pallas_tongue']);
    expect(full.length).toBe(F.species * F.copies + F.fledglings);
    expect(copiesIn(full, { kind: 'bat', id: 'little_brown' })).toBe(F.copies);
    expect(buildStartingDeck(['little_brown']).length).toBe(full.length);
  });
});

describe('gacha', () => {
  it('guarantees an epic or better by the pity count', () => {
    for (let seed = 0; seed < 50; seed++) {
      const p = starter();
      p.glow = 1e9;
      const rng = new Rng(seed);
      const res = [...pull(p, rng, 10)];
      expect(res.some((r) => r.rarity === 'epic' || r.rarity === 'legendary')).toBe(true);
    }
  });

  it('guarantees a legendary at the legendary pity', () => {
    const p = starter();
    p.glow = 1e9;
    p.pity.sinceLegendary = BALANCE.gacha.pityLegendary - 1;
    const [r] = pull(p, new Rng(1), 1);
    expect(r.rarity).toBe('legendary');
    expect(r.pity).toBe(true);
    expect(p.pity.sinceLegendary).toBe(0);
  });

  it('charges glow and refuses when short', () => {
    const p = starter();
    p.glow = 100;
    expect(pull(p, new Rng(1), 1)).toEqual([]);
    expect(p.glow).toBe(100);
  });

  it('lets a duplicate become a plus-level or XP', () => {
    const p = starter();
    p.pendingDupes = ['little_brown', 'little_brown'];
    resolveDupe(p, 'little_brown', 'plus');
    expect(p.roster.little_brown.plus).toBe(1);
    resolveDupe(p, 'little_brown', 'xp');
    expect(p.xp).toBe(BALANCE.xp.dupeValue.common);
    expect(p.pendingDupes).toEqual([]);
  });
});

describe('progression', () => {
  it('scales stats with level, plus-levels, evolution and card upgrades', () => {
    const base = blueprint('egyptian_fruit', newOwnedBat());
    expect(base.stats.hp).toBe(220);
    const o = { ...newOwnedBat(), level: 6, plus: 5 }; // effective level 11 → ×3
    expect(blueprint('egyptian_fruit', o).stats.hp).toBe(660);
    const evo = blueprint('egyptian_fruit', { ...o, evolved: true });
    expect(evo.name).toBe('Pharaoh Fruit Bat');
    expect(evo.stats.hp).toBe(825);
    expect(evo.traits.some((t) => t.kind === 'knockChance')).toBe(true);
    expect(blueprint('egyptian_fruit', newOwnedBat(), true).stats.hp).toBe(286);
  });

  it('applies talents', () => {
    const o = { ...newOwnedBat(), evolved: true, talents: [false, true] as [boolean, boolean] };
    expect(blueprint('egyptian_fruit', o).cost).toBe(BAT_BY_ID.egyptian_fruit.cost - 1);
  });
});

describe('map', () => {
  it('connects every node and ends in a single boss', () => {
    for (let seed = 0; seed < 100; seed++) {
      const m = generateMap(new Rng(seed));
      const last = m.rows[m.rows.length - 1];
      expect(last.length).toBe(1);
      expect(m.nodes[last[0]].type).toBe('boss');
      for (let r = 1; r < m.rows.length; r++) {
        for (const id of m.rows[r]) {
          expect(m.rows[r - 1].some((p) => m.nodes[p].next.includes(id))).toBe(true);
        }
      }
      for (let r = 0; r < m.rows.length - 1; r++) {
        for (const id of m.rows[r]) expect(m.nodes[id].next.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('drafting', () => {
  it('leans toward copies of bats already in the deck', () => {
    const p = starter('ghost_bat');
    const run = startRun(p, 'ghost_bat', ['little_brown', 'common_vampire'], 7);
    const rng = new Rng(3);
    let copies = 0;
    let total = 0;
    for (let i = 0; i < 300; i++) {
      for (const o of draftOffers(run, rng, 3)) {
        total++;
        if (o.kind === 'bat' && (o.id === 'little_brown' || o.id === 'common_vampire')) copies++;
      }
    }
    expect(copies / total).toBeGreaterThan(0.2);
    expect(copies / total).toBeLessThan(0.6);
  });
});

describe('run flow', () => {
  it('starts, clears a battle, drafts, and banks rewards on loss', () => {
    const p = starter('ghost_bat');
    const run = startRun(p, 'ghost_bat', ['little_brown', 'common_vampire'], 42);
    expect(run.deck.length).toBe(8);
    expect(run.deck.filter((c) => c.id === 'fledgling').length).toBe(4);
    expect(p.flock).toEqual(['little_brown', 'common_vampire']);

    const first = availableNodes(run)[0];
    enterNode(run, first.id);
    resolveBattle(run, true, 1400);
    expect(run.draft?.length).toBe(3);
    for (const o of run.draft!) expect(o.kind === 'spell' || !BAT_BY_ID[o.id].matriarch).toBe(true);
    expect(addCard(run, run.draft![0])).toBe(true);
    expect(addCard(run, run.draft![0])).toBe(true); // no singleton: copies are how you merge

    run.status = 'lost';
    const xpBefore = p.xp;
    const res = finishRun(p, run);
    expect(res.cleared).toBe(false);
    expect(p.xp).toBe(xpBefore + run.xpEarned);
    expect(p.run).toBeUndefined();
  });
});

describe('saga', async () => {
  const { sagaNode, SAGA_ROWS, AUTHORED_COUNT } = await import('../src/data/saga');
  const { applyLevelResult, charmOffers, sellCharm, takeCharm } = await import('../src/game/run');

  it('generates stable, valid nodes forever, with rising difficulty', () => {
    for (let n = 1; n <= 80; n++) {
      const a = sagaNode(n);
      expect(sagaNode(n)).toEqual(a);
      expect(a.goals[0]).not.toBe(a.goals[1]);
      if (n > 1) expect(a.difficulty).toBeGreaterThanOrEqual(sagaNode(n - 1).difficulty);
    }
    expect(sagaNode(AUTHORED_COUNT + 1).name.length).toBeGreaterThan(0);
  });

  it('runs a saga node as a short map with its twists, then awards stars and unlocks the next', () => {
    const p = starter('ghost_bat');
    const run = startRun(p, 'ghost_bat', ['little_brown'], 9, { saga: 5 }); // insectivores only
    expect(run.map.rows.length).toBe(SAGA_ROWS);
    expect(run.restrict).toBe('INS');
    const boss = Object.values(run.map.nodes).find((n) => n.type === 'boss')!;
    expect(boss.bossRule).toBe(sagaNode(5).bossRule);
    expect(boss.depth).toBe(Math.min(BALANCE.run.rows - 1, 2 + 5));
    // A non-insectivore can't join the flock.
    expect(() => startRun(starter('ghost_bat'), 'ghost_bat', ['egyptian_fruit'], 9, { saga: 5 })).toThrow(/only allows/);
    const rng = new Rng(4);
    for (let i = 0; i < 30; i++) for (const o of draftOffers(run, rng, 3)) if (o.kind === 'bat') expect(BAT_BY_ID[o.id].clans).toContain('INS');
    run.status = 'won';
    run.tally.maxLevel = 6; // 'tall' goal on node 5
    const res = finishRun(p, run);
    expect(res.stars).toBe(3); // cleared + noLeak (no leaks tallied) + tall
    expect(p.saga.unlocked).toBe(6);
  });

  it('takes, sells and breaks charms; shattered glass leaves the deck', () => {
    const p = starter('ghost_bat');
    const run = startRun(p, 'ghost_bat', ['little_brown'], 3);
    const offers = charmOffers(run, new Rng(1), 2);
    expect(new Set(offers).size).toBe(2);
    expect(takeCharm(run, offers[0])).toBe(true);
    expect(takeCharm(run, offers[0])).toBe(false);
    const figs = run.figs;
    expect(sellCharm(run, offers[0])).toBe(true);
    expect(run.figs).toBeGreaterThan(figs);
    takeCharm(run, 'second_wind');
    const uid = run.deck[0].uid;
    applyLevelResult(run, { shattered: [uid], brokenCharms: ['second_wind'], tally: { leaks: 2, rerolls: 1, maxRoosts: 5, maxLevel: 3 } });
    expect(run.deck.some((c) => c.uid === uid)).toBe(false);
    expect(run.charms).toEqual([]);
    expect(run.tally).toEqual({ leaks: 2, rerolls: 1, maxRoosts: 5, maxLevel: 3 });
  });
});
