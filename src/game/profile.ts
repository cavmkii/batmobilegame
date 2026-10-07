import { BAT_BY_ID, STARTER_COMMONS } from '../data/bats';
import { RELIC_BY_ID } from '../data/relics';
import { BALANCE } from '../data/balance';
import { newOwnedBat, type OwnedBat } from './progression';
import type { RunState } from './run';

export interface Profile {
  version: 1;
  roster: Record<string, OwnedBat>;
  xp: number;
  glow: number;
  pity: { sinceEpic: number; sinceLegendary: number };
  starterChosen: boolean;
  /** Saved core per commander, so the deck screen remembers your picks. */
  cores: Record<string, string[]>;
  lastCommander?: string;
  /** Duplicates pulled but not yet resolved (plus-level vs XP). */
  pendingDupes: string[];
  run?: RunState;
  stats: { runs: number; clears: number; pulls: number; bestRow: number };
}

const KEY = 'batmobile.save';

export function newProfile(): Profile {
  return {
    version: 1,
    roster: { fledgling: newOwnedBat() },
    xp: 0,
    glow: BALANCE.gacha.ten,
    pity: { sinceEpic: 0, sinceLegendary: 0 },
    starterChosen: false,
    cores: {},
    pendingDupes: [],
    stats: { runs: 0, clears: 0, pulls: 0, bestRow: 0 },
  };
}

export function chooseStarter(p: Profile, commanderId: string) {
  p.roster[commanderId] = newOwnedBat();
  for (const id of STARTER_COMMONS) p.roster[id] ??= newOwnedBat();
  p.starterChosen = true;
  p.lastCommander = commanderId;
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return newProfile();
    const p = JSON.parse(raw) as Profile;
    if (p.version !== 1) return newProfile();
    // Drop bats removed from the data set since the save was written.
    for (const id of Object.keys(p.roster)) if (!BAT_BY_ID[id]) delete p.roster[id];
    p.pendingDupes = (p.pendingDupes ?? []).filter((id) => BAT_BY_ID[id]);
    // Relics can be renamed or removed between versions.
    if (p.run) p.run.relics = p.run.relics.filter((id) => RELIC_BY_ID[id]);
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
