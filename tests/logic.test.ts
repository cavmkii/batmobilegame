import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/balance';
import { BAT_BY_ID } from '../src/data/bats';
import { canAddToDeck, legalCoreBats, newCard, validateCore, withinIdentity } from '../src/game/deck';
import { pull, resolveDupe } from '../src/game/gacha';
import { generateMap } from '../src/game/map';
import { chooseStarter, newProfile } from '../src/game/profile';
import { blueprint, newOwnedBat } from '../src/game/progression';
import { Rng } from '../src/game/rng';
import { addCard, availableNodes, enterNode, finishRun, resolveBattle, startRun } from '../src/game/run';

const starter = (cmd = 'ghost_bat') => {
  const p = newProfile();
  chooseStarter(p, cmd);
  return p;
};

describe('commander rules', () => {
  it('checks identity', () => {
    expect(withinIdentity(['SAN'], ['SAN', 'INS'])).toBe(true);
    expect(withinIdentity(['FRU'], ['SAN', 'INS'])).toBe(false);
    expect(withinIdentity([], ['SAN', 'INS'])).toBe(true);
  });

  it('only offers owned, on-identity, non-commander bats for the core', () => {
    const p = starter('ghost_bat');
    expect(legalCoreBats(p, 'ghost_bat').sort()).toEqual(['common_vampire', 'little_brown']);
  });

  it('rejects off-identity and duplicate cores', () => {
    const p = starter('ghost_bat');
    expect(validateCore(p, 'ghost_bat', ['egyptian_fruit'])).toMatch(/identity/);
    expect(validateCore(p, 'ghost_bat', ['little_brown', 'little_brown'])).toMatch(/Singleton/);
    expect(validateCore(p, 'ghost_bat', ['little_brown', 'common_vampire'])).toBeNull();
    expect(validateCore(p, 'flying_fox', [])).toMatch(/own/);
  });

  it('is singleton except for Fledglings', () => {
    const deck = [newCard('bat', 'little_brown'), newCard('bat', 'fledgling')];
    expect(canAddToDeck(deck, { kind: 'bat', id: 'little_brown' })).toBe(false);
    expect(canAddToDeck(deck, { kind: 'bat', id: 'fledgling' })).toBe(true);
    expect(canAddToDeck(deck, { kind: 'spell', id: 'screech' })).toBe(true);
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

describe('run flow', () => {
  it('starts, clears a battle, drafts, and banks rewards on loss', () => {
    const p = starter('ghost_bat');
    const run = startRun(p, 'ghost_bat', ['little_brown', 'common_vampire'], 42);
    expect(run.deck.length).toBe(BALANCE.run.startDeckSize);
    expect(run.deck.filter((c) => c.id === 'fledgling').length).toBe(6);

    const first = availableNodes(run)[0];
    enterNode(run, first.id);
    resolveBattle(run, true, 1400);
    expect(run.draft?.length).toBe(3);
    for (const o of run.draft!) expect(withinIdentity(BAT_BY_ID[o.id]?.clans ?? [], ['SAN', 'INS'])).toBe(true);
    expect(addCard(run, run.draft![0])).toBe(true);
    expect(addCard(run, run.draft![0])).toBe(false); // singleton

    run.status = 'lost';
    const xpBefore = p.xp;
    const res = finishRun(p, run);
    expect(res.cleared).toBe(false);
    expect(p.xp).toBe(xpBefore + run.xpEarned);
    expect(p.run).toBeUndefined();
  });
});
