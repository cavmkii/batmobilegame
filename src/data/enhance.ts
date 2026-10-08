import type { CardMod } from './types';

/** Card enhancements (Balatro's tarot effects): they change a card already in the deck. */
export interface EnhanceDef {
  id: CardMod;
  name: string;
  icon: string;
  desc: string;
  price: number;
}

export const ENHANCEMENTS: EnhanceDef[] = [
  { id: 'foil', name: 'Foil', icon: '✨', price: 55, desc: 'Its roost starts at level 2.' },
  { id: 'wild', name: 'Wild', icon: '🃏', price: 45, desc: 'Merges onto any level-1 roost of the same clan (a wild Fledgling, onto any).' },
  { id: 'echo', name: 'Echo', icon: '📣', price: 40, desc: 'When placed, a Fledgling joins the discard for the rest of the level.' },
  { id: 'glass', name: 'Glass', icon: '🔮', price: 35, desc: 'Its roost deals +60% damage. If that roost is wrecked, the card shatters and leaves your deck.' },
];

export const ENHANCE_BY_ID: Record<string, EnhanceDef> = Object.fromEntries(ENHANCEMENTS.map((e) => [e.id, e]));
