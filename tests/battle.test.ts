import { describe, expect, it } from 'vitest';
import { ENCOUNTERS } from '../src/data/enemies';
import type { Card } from '../src/data/types';
import { Battle, type BattleConfig } from '../src/game/battle';
import { buildStartingDeck, newCard } from '../src/game/deck';
import { newOwnedBat, type OwnedBat } from '../src/game/progression';

const roster = (ids: string[], level = 1): Record<string, OwnedBat> =>
  Object.fromEntries(ids.map((id) => [id, { ...newOwnedBat(), level }]));

function cfg(over: Partial<BattleConfig> = {}): BattleConfig {
  return {
    encounterId: 'moth_cloud',
    row: 0,
    deck: buildStartingDeck(['little_brown', 'common_vampire']),
    commanderId: 'ghost_bat',
    roster: roster(['ghost_bat', 'little_brown', 'common_vampire', 'fledgling']),
    relics: [],
    caveHp: 1500,
    caveMax: 1500,
    seed: 7,
    ...over,
  };
}

/**
 * Simple bot that plays roughly like a person: save for the commander when it's down,
 * otherwise wait until the priciest card in hand is affordable and play it.
 */
function autoplay(b: Battle, maxSeconds = 600) {
  const dt = 1 / 30;
  let plays = 0;
  while (!b.result && b.time < maxSeconds) {
    if (b.canDeployCommander()) b.deployCommander();
    const savingForCommander = !b.commander.alive && b.commanderCost() <= b.maxEnergy;
    if (!savingForCommander) {
      let best = -1;
      for (let i = 0; i < b.hand.length; i++) {
        if (b.hand[i] && (best < 0 || b.cardCost(b.hand[i]!) > b.cardCost(b.hand[best]!))) best = i;
      }
      if (best >= 0 && b.playCard(best)) plays++;
    }
    b.step(dt);
  }
  return plays;
}

describe('battle', () => {
  it('loses if the player does nothing', () => {
    const b = new Battle(cfg({ caveHp: 200 }));
    for (let i = 0; i < 30 * 300 && !b.result; i++) b.step(1 / 30);
    expect(b.result).toBe('lost');
  });

  it('wins the first encounter with a starter deck on autoplay', () => {
    const b = new Battle(cfg());
    autoplay(b);
    expect(b.result).toBe('won');
  });

  it('rotates played cards to the bottom of the draw pile', () => {
    const b = new Battle(cfg());
    b.energy = 10;
    const played = b.hand[0]!;
    expect(b.playCard(0)).toBe(true);
    expect(b.drawPile[b.drawPile.length - 1]).toBe(played);
    expect(b.hand[0]).not.toBe(played);
  });

  it('charges commander tax after each death', () => {
    const b = new Battle(cfg());
    const base = b.commanderCost();
    b.energy = 10;
    b.deployCommander();
    expect(b.canDeployCommander()).toBe(false);
    const cmd = b.entities.find((e) => e.commander)!;
    cmd.hp = 1;
    // Park a heavy hitter on top of the commander.
    (b as unknown as { spawnEnemy(id: string): void }).spawnEnemy('cat');
    const cat = b.entities[b.entities.length - 1];
    cat.x = cmd.x - 5;
    for (let i = 0; i < 60 && b.commander.alive; i++) b.step(1 / 30);
    expect(b.commander.alive).toBe(false);
    expect(b.commanderCost()).toBe(base + 2);
  });

  it('knocks units back as they cross HP thresholds', () => {
    const b = new Battle(cfg());
    b.energy = 10;
    b.deployCommander(); // 3 knockbacks → thresholds at 2/3 and 1/3
    const cmd = b.entities.find((e) => e.commander)!;
    expect(cmd.kbThresholds.length).toBe(2);
    (b as unknown as { damage(t: unknown, n: number): number }).damage(cmd, cmd.maxHp * 0.4);
    expect(cmd.knockTimer).toBeGreaterThan(0);
    expect(cmd.kbThresholds.length).toBe(1);
  });
});

/**
 * Balance report, not a pass/fail gate beyond sanity: starter decks vs every encounter.
 * Run with `npx vitest run tests/battle.test.ts --reporter=verbose` to read the table.
 */
describe('balance smoke', () => {
  const decks: Record<string, { core: string[]; extra: Card[] }> = {
    ghost_bat: { core: ['little_brown', 'common_vampire'], extra: [] },
    flying_fox: { core: ['egyptian_fruit', 'pallas_tongue'], extra: [] },
    spectral_bat: { core: ['lesser_bulldog', 'common_vampire'], extra: [] },
    // A plausible mid-run deck: starter plus six drafts, one upgraded.
    'ghost_bat+drafts': {
      core: ['little_brown', 'common_vampire'],
      extra: [newCard('bat', 'hairy_legged', true), newCard('bat', 'long_eared'), newCard('bat', 'white_winged'),
        newCard('spell', 'blood_moon'), newCard('spell', 'guano_bomb'), newCard('spell', 'swarm_call')],
    },
    'flying_fox+drafts': {
      core: ['egyptian_fruit', 'pallas_tongue'],
      extra: [newCard('bat', 'straw_fruit', true), newCard('bat', 'long_nosed'), newCard('bat', 'hammerhead'),
        newCard('spell', 'ripe_harvest'), newCard('spell', 'screech'), newCard('spell', 'pollen_burst')],
    },
  };
  for (const [name, d] of Object.entries(decks)) {
    const cmd = name.split('+')[0];
    it(`${name}`, () => {
      const rows: string[] = [];
      for (const enc of ENCOUNTERS) {
        const row = enc.tier === 'boss' ? 7 : enc.minRow;
        let wins = 0;
        let time = 0;
        let plays = 0;
        const N = 6;
        for (let s = 0; s < N; s++) {
          const deck = [...buildStartingDeck(d.core), ...d.extra.map((c) => newCard(c.kind, c.id))];
          const b = new Battle(cfg({
            encounterId: enc.id, row, deck, commanderId: cmd, seed: s,
            roster: roster([cmd, 'fledgling', ...d.core]),
          }));
          plays += autoplay(b);
          if (b.result === 'won') wins++;
          time += b.time;
        }
        rows.push(`${enc.id.padEnd(14)} row ${row}  win ${wins}/${N}  avg ${(time / N).toFixed(0)}s  plays ${(plays / N).toFixed(0)}`);
      }
      console.log(`\n${name}\n  ${rows.join('\n  ')}`);
      expect(rows.length).toBe(ENCOUNTERS.length);
    });
  }
});
