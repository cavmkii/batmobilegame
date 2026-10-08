import { BAT_BY_ID, STARTER_COMMONS } from '../data/bats';
import { CHARM_BY_ID, CHARM_SLOTS } from '../data/charms';
import { BALANCE } from '../data/balance';
import { newOwnedBat, type OwnedBat } from './progression';
import type { RunState } from './run';

/**
 * Bump to start everyone fresh: older saves are discarded on load.
 * v2: the Roost Defense / field guide era, and the first-play tutorial.
 */
export const SAVE_VERSION = 2;

export interface Profile {
  version: typeof SAVE_VERSION;
  /** First-level tutorial finished (or skipped). */
  tutorialDone: boolean;
  roster: Record<string, OwnedBat>;
  xp: number;
  glow: number;
  pity: { sinceEpic: number; sinceLegendary: number };
  starterChosen: boolean;
  /** Last starting flock, so the Play screen remembers your picks. */
  flock?: string[];
  lastMatriarch?: string;
  /** Last Play-screen choices, remembered for next time. */
  lastSetup?: { biome: string; modifiers: string[] };
  /** Enemy ids met in a level (unlocks entries in the Predators field guide). */
  seenEnemies: string[];
  /** Duplicates pulled but not yet resolved (plus-level vs XP). */
  pendingDupes: string[];
  /** Saga progress: highest node unlocked, best stars per node. */
  saga: { unlocked: number; stars: Record<number, number> };
  /** Field-guide rewards already claimed (milestones and region sets). */
  claimed: string[];
  run?: RunState;
  stats: { runs: number; clears: number; pulls: number; bestRow: number };
}

const KEY = 'batmobile.save';

export function newProfile(): Profile {
  return {
    version: SAVE_VERSION,
    tutorialDone: false,
    roster: { fledgling: newOwnedBat() },
    xp: 0,
    glow: BALANCE.gacha.ten,
    pity: { sinceEpic: 0, sinceLegendary: 0 },
    starterChosen: false,
    pendingDupes: [],
    claimed: [],
    seenEnemies: [],
    saga: { unlocked: 1, stars: {} },
    stats: { runs: 0, clears: 0, pulls: 0, bestRow: 0 },
  };
}

export function chooseStarter(p: Profile, matriarchId: string) {
  p.roster[matriarchId] = newOwnedBat();
  for (const id of STARTER_COMMONS) p.roster[id] ??= newOwnedBat();
  p.starterChosen = true;
  p.lastMatriarch = matriarchId;
}

/** Saves from the commander era (same version): rename fields in place. */
function migrate(p: Profile) {
  const legacy = p as Profile & { cores?: unknown; lastCommander?: string };
  p.lastMatriarch ??= legacy.lastCommander;
  delete legacy.cores;
  for (const o of Object.values(p.roster)) o.skills ??= [];
  p.saga ??= { unlocked: 1, stars: {} };
  if (p.run) {
    // Runs started before charms and the saga.
    p.run.charms ??= [];
    p.run.formations ??= {};
    p.run.charmOffer ??= null;
    p.run.chartOffer ??= null;
    p.run.tally ??= { leaks: 0, rerolls: 0, maxRoosts: 0, maxLevel: 0 };
    // Relics became charms: carry over the ones that still exist, while slots last.
    const legacyRun = p.run as typeof p.run & { relics?: string[]; rewardRelic?: unknown };
    for (const id of legacyRun.relics ?? []) {
      if (CHARM_BY_ID[id] && !p.run.charms.includes(id) && p.run.charms.length < CHARM_SLOTS) p.run.charms.push(id);
    }
    delete legacyRun.relics;
    delete legacyRun.rewardRelic;
    p.run.charms = p.run.charms.filter((id) => CHARM_BY_ID[id]);
    // Card upgrades became the Sharp enhancement.
    for (const c of p.run.deck) {
      if (c.upgraded && !c.mod) c.mod = 'sharp';
      delete c.upgraded;
    }
    if (p.run.shop) delete (p.run.shop as { relic?: unknown }).relic;
    if (p.run.shop) Object.assign(p.run.shop, { charms: p.run.shop.charms ?? [], enhance: p.run.shop.enhance ?? [], chart: p.run.shop.chart ?? null });
  }
  delete legacy.lastCommander;
  const run = p.run as (RunState & { commanderId?: string }) | undefined;
  if (run && !run.matriarchId) {
    run.matriarchId = run.commanderId ?? 'flying_fox';
    delete run.commanderId;
  }
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return newProfile();
    const p = JSON.parse(raw) as Profile;
    if (p.version !== SAVE_VERSION) return newProfile();
    // Drop bats removed from the data set since the save was written.
    for (const id of Object.keys(p.roster)) if (!BAT_BY_ID[id]) delete p.roster[id];
    p.pendingDupes = (p.pendingDupes ?? []).filter((id) => BAT_BY_ID[id]);
    p.claimed ??= [];
    p.seenEnemies ??= [];
    migrate(p);
    // Relics can be renamed or removed between versions.
    return p;
  } catch {
    return newProfile();
  }
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage unavailable (private mode, quota). The game still plays; progress won't persist.
  }
}

export function resetProfile(): Profile {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return newProfile();
}

/** A copyable backup code for the save (base64 JSON). */
export function exportSave(p: Profile): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(p))));
}

/** Restore from a backup code. Returns null if the code isn't a valid save for this version. */
export function importSave(code: string): Profile | null {
  try {
    const p = JSON.parse(decodeURIComponent(escape(atob(code.trim())))) as Profile;
    if (!p || p.version !== SAVE_VERSION || typeof p.roster !== 'object') return null;
    migrate(p);
    return p;
  } catch {
    return null;
  }
}
