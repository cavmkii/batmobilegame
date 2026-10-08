import { describe, expect, it } from 'vitest';
import { BATS, BAT_BY_ID, STARTER_COMMONS } from '../src/data/bats';
import { COLLECTABLE, MILESTONES, REGION, REGION_SETS, REGIONS, regionMembers } from '../src/data/fieldguide';
import { claim, claimable } from '../src/game/collection';
import { GACHA_POOL } from '../src/game/gacha';
import { chooseStarter, newProfile } from '../src/game/profile';
import { newOwnedBat } from '../src/game/progression';

describe('field guide data', () => {
  it('gives every collectable bat a region, and every region at least one bat', () => {
    for (const id of COLLECTABLE) expect(REGION[id], id).toBeDefined();
    for (const r of REGIONS) expect(regionMembers(r).length).toBeGreaterThan(0);
  });

  it('keeps every bat summonable and every bat well-formed', () => {
    const pool = new Set(Object.values(GACHA_POOL).flat());
    for (const b of BATS) {
      if (b.basic) continue;
      expect(pool.has(b.id), b.id).toBe(true);
      expect(b.fact.length, b.id).toBeGreaterThan(20);
      expect(b.roost.count, b.id).toBeGreaterThan(0);
      for (const [dc, dr] of b.pattern) expect(Math.abs(dc) <= 2 && Math.abs(dr) <= 2, b.id).toBe(true);
    }
    expect(new Set(BATS.map((b) => b.id)).size).toBe(BATS.length);
  });

  it('every matriarch bat has a rule, and every rule a bat', async () => {
    const { MATRIARCHS, MATRIARCH_BY_ID } = await import('../src/data/matriarchs');
    for (const b of BATS.filter((x) => x.matriarch)) expect(MATRIARCH_BY_ID[b.id], b.id).toBeTruthy();
    for (const m of MATRIARCHS) expect(BAT_BY_ID[m.batId]?.matriarch, m.batId).toBe(true);
  });

  it('gives a new player exactly one common per clan', () => {
    expect(STARTER_COMMONS.length).toBe(5);
    const clans = STARTER_COMMONS.map((id) => BAT_BY_ID[id].clans[0]);
    expect(new Set(clans).size).toBe(5);
  });
});

describe('collection rewards', () => {
  it('pays a milestone once, when enough species are owned', () => {
    const p = newProfile();
    chooseStarter(p, 'ghost_bat');
    expect(claimable(p).length).toBe(0);
    for (const id of COLLECTABLE.slice(0, 10)) p.roster[id] ??= newOwnedBat();
    const m = MILESTONES[0];
    expect(claimable(p).some((r) => r.id === m.id)).toBe(true);
    const glow = p.glow;
    expect(claim(p, m.id)).not.toBeNull();
    expect(p.glow).toBe(glow + m.glow);
    expect(claim(p, m.id)).toBeNull();
  });

  it('pays a region set when every bat from that region is owned', () => {
    const p = newProfile();
    const africa = REGIONS.indexOf('Africa');
    for (const id of regionMembers('Africa')) p.roster[id] = newOwnedBat();
    expect(claimable(p).some((r) => r.id === REGION_SETS[africa].id)).toBe(true);
  });
});

describe('run setup: maps and modifiers', () => {
  const base = (over: Partial<import('../src/game/defense').DefenseConfig> = {}) => ({
    encounterId: 'moth_cloud', row: 0, deck: [], matriarchId: 'ghost_bat',
    roster: { ghost_bat: newOwnedBat() }, relics: [], caveHp: 1000, caveMax: 1000, seed: 1, ...over,
  });

  it('weights terrain by biome', async () => {
    const { Defense } = await import('../src/game/defense');
    const tally = (biome: string) => {
      const c: Record<string, number> = {};
      for (let s = 0; s < 200; s++) for (const sl of new Defense(base({ biome, seed: s })).slots) if (sl.terrain) c[sl.terrain] = (c[sl.terrain] ?? 0) + 1;
      return c;
    };
    const rain = tally('rainforest');
    const desert = tally('sonoran');
    expect(rain.fig).toBeGreaterThan(desert.fig ?? 0);
    expect(desert.cactus).toBeGreaterThan(rain.cactus ?? 0);
  });

  it('applies modifiers to the level and the run', async () => {
    const { Defense } = await import('../src/game/defense');
    const { startRun, finishRun } = await import('../src/game/run');
    const plain = new Defense(base());
    const long = new Defense(base({ modifiers: ['long_nights', 'new_moon'] }));
    expect(long.nights).toBe(plain.nights + 2);
    expect(long.previewHidden).toBe(true);
    expect(long.plans.length).toBe(long.nights);
    const lean = new Defense(base({ modifiers: ['lean_times'] }));
    expect(lean.projectedIncome()).toBe(plain.projectedIncome() - 1);

    const p = newProfile();
    chooseStarter(p, 'ghost_bat');
    const run = startRun(p, 'ghost_bat', [], 5, { biome: 'farmland', modifiers: ['old_cave', 'swarm_season'] });
    expect(run.biome).toBe('farmland');
    expect(run.caveMax).toBe(700);
    expect(p.lastSetup).toEqual({ biome: 'farmland', modifiers: ['old_cave', 'swarm_season'] });
    run.xpEarned = 1000;
    run.status = 'lost';
    const res = finishRun(p, run);
    expect(res.xp).toBe(1500); // +20% +30%
  });
});

describe('save versioning', () => {
  it('discards saves from an older version, so players start fresh with the tutorial', async () => {
    const { loadProfile, SAVE_VERSION } = await import('../src/game/profile');
    const store: Record<string, string> = {};
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; }, clear: () => {}, key: () => null, length: 0,
    };
    store['batmobile.save'] = JSON.stringify({ version: 1, roster: { ghost_bat: {} }, xp: 99999, starterChosen: true });
    const p = loadProfile();
    expect(p.version).toBe(SAVE_VERSION);
    expect(p.xp).toBe(0);
    expect(p.starterChosen).toBe(false);
    expect(p.tutorialDone).toBe(false);
  });
});

describe('save backup', () => {
  it('round-trips a save through a backup code and rejects junk', async () => {
    const { exportSave, importSave } = await import('../src/game/profile');
    const p = newProfile();
    chooseStarter(p, 'spectral_bat');
    p.xp = 1234;
    p.claimed = ['species_10'];
    const back = importSave(exportSave(p));
    expect(back).toEqual(p);
    expect(importSave('not a save')).toBeNull();
    expect(importSave(btoa(JSON.stringify({ version: 1 })))).toBeNull();
  });
});
