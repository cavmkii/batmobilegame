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

  it('every commander identity has legal bats to draft', () => {
    for (const cmd of BATS.filter((b) => b.commander)) {
      const legal = BATS.filter((b) => !b.basic && !b.commander && b.clans.every((c) => cmd.clans.includes(c)));
      expect(legal.length, cmd.id).toBeGreaterThanOrEqual(6);
    }
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
