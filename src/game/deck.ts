import { BALANCE } from '../data/balance';
import { BATS, BAT_BY_ID } from '../data/bats';
import { SPELLS, SPELL_BY_ID } from '../data/spells';
import type { Card, ClanId } from '../data/types';
import type { Profile } from './profile';

/** Commander rules: a card is legal if all its clans are inside the commander's identity. */
export function withinIdentity(cardClans: ClanId[], identity: ClanId[]): boolean {
  return cardClans.every((c) => identity.includes(c));
}

export const identityOf = (commanderId: string): ClanId[] => BAT_BY_ID[commanderId].clans;

export function cardClans(card: Pick<Card, 'kind' | 'id'>): ClanId[] {
  return card.kind === 'bat' ? BAT_BY_ID[card.id].clans : SPELL_BY_ID[card.id].clans;
}

export const isBasic = (card: Pick<Card, 'kind' | 'id'>) => card.kind === 'bat' && !!BAT_BY_ID[card.id].basic;

/** Owned bats that can go in this commander's core. */
export function legalCoreBats(p: Profile, commanderId: string): string[] {
  const id = identityOf(commanderId);
  return Object.keys(p.roster).filter((b) => {
    const def = BAT_BY_ID[b];
    return b !== commanderId && !def.basic && !def.commander && withinIdentity(def.clans, id);
  });
}

export function validateCore(p: Profile, commanderId: string, core: string[]): string | null {
  const cmd = BAT_BY_ID[commanderId];
  if (!cmd?.commander) return 'Not a commander.';
  if (!p.roster[commanderId]) return 'You do not own this commander.';
  if (core.length > BALANCE.run.coreMax) return `Core is limited to ${BALANCE.run.coreMax} bats.`;
  if (new Set(core).size !== core.length) return 'Singleton: one copy of each bat.';
  const legal = new Set(legalCoreBats(p, commanderId));
  const bad = core.find((b) => !legal.has(b));
  if (bad) return `${BAT_BY_ID[bad]?.name ?? bad} is outside ${cmd.name}'s identity or not owned.`;
  return null;
}

let uidCounter = 0;
export const newCard = (kind: Card['kind'], id: string, upgraded = false): Card => ({
  uid: `${Date.now().toString(36)}-${(uidCounter++).toString(36)}`,
  kind,
  id,
  upgraded,
});

/** Core + Fledglings up to the starting deck size. */
export function buildStartingDeck(core: string[]): Card[] {
  const deck = core.map((id) => newCard('bat', id));
  while (deck.length < BALANCE.run.startDeckSize) deck.push(newCard('bat', 'fledgling'));
  return deck;
}

/** Singleton check for adding a card (basics exempt). */
export function canAddToDeck(deck: Card[], card: Pick<Card, 'kind' | 'id'>): boolean {
  if (isBasic(card)) return true;
  return !deck.some((c) => c.kind === card.kind && c.id === card.id);
}

/** Every card that could ever be drafted for this commander. */
export function draftPool(commanderId: string): { bats: string[]; spells: string[] } {
  const identity = identityOf(commanderId);
  return {
    bats: BATS.filter((b) => !b.basic && !b.commander && withinIdentity(b.clans, identity)).map((b) => b.id),
    spells: SPELLS.filter((s) => withinIdentity(s.clans, identity)).map((s) => s.id),
  };
}
