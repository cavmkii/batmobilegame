import { BALANCE } from '../data/balance';
import { BATS, BAT_BY_ID } from '../data/bats';
import { MATRIARCH_BY_ID } from '../data/matriarchs';
import { SPELLS } from '../data/spells';
import type { Card, CardMod, ClanId } from '../data/types';
import type { Profile } from './profile';

export const isBasic = (card: Pick<Card, 'kind' | 'id'>) => card.kind === 'bat' && !!BAT_BY_ID[card.id].basic;

/** Bats that can be cards: everything except Fledglings (always included) and matriarchs (they lead). */
const isFlockBat = (id: string) => !BAT_BY_ID[id].basic && !BAT_BY_ID[id].matriarch;

/** Owned bats that can be picked for the starting flock. */
export function flockOptions(p: Profile): string[] {
  return Object.keys(p.roster).filter((id) => BAT_BY_ID[id] && isFlockBat(id));
}

export function validateSetup(p: Profile, matriarchId: string, flock: string[], restrict?: ClanId): string | null {
  if (!MATRIARCH_BY_ID[matriarchId] || !BAT_BY_ID[matriarchId]?.matriarch) return 'Not a matriarch.';
  if (!p.roster[matriarchId]) return 'You do not own this matriarch.';
  const max = BALANCE.run.flock.species;
  if (flock.length > max) return `Pick up to ${max} species.`;
  if (new Set(flock).size !== flock.length) return 'Pick each species once.';
  const legal = new Set(flockOptions(p));
  const bad = flock.find((b) => !legal.has(b));
  if (bad) return `${BAT_BY_ID[bad]?.name ?? bad} isn't in your collection.`;
  const off = restrict && flock.find((b) => !BAT_BY_ID[b].clans.includes(restrict));
  if (off) return `This node only allows ${restrict} bats: ${BAT_BY_ID[off].name} can't come.`;
  return null;
}

let uidCounter = 0;
export const newCard = (kind: Card['kind'], id: string, mod?: CardMod): Card => ({
  uid: `${Date.now().toString(36)}-${(uidCounter++).toString(36)}`,
  kind,
  id,
  ...(mod ? { mod } : {}),
});

/**
 * Copies of each chosen species, then Fledglings. Missing species slots become Fledglings too,
 * so the deck size doesn't depend on how many species you own.
 */
export function buildStartingDeck(flock: string[]): Card[] {
  const { species, copies, fledglings } = BALANCE.run.flock;
  const deck: Card[] = [];
  for (const id of flock) for (let k = 0; k < copies; k++) deck.push(newCard('bat', id));
  const size = species * copies + fledglings;
  while (deck.length < size) deck.push(newCard('bat', 'fledgling'));
  return deck;
}

/** How many copies of a card the deck holds. */
export const copiesIn = (deck: Card[], o: Pick<Card, 'kind' | 'id'>) => deck.filter((c) => c.kind === o.kind && c.id === o.id).length;

/** Every card that can be drafted. */
export function draftPool(): { bats: string[]; spells: string[] } {
  return {
    bats: BATS.filter((b) => isFlockBat(b.id)).map((b) => b.id),
    spells: SPELLS.map((s) => s.id),
  };
}
