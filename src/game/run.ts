import { BALANCE } from '../data/balance';
import { BIOMES, BIOME_BY_ID, MODIFIER_BY_ID, rewardBonusPct } from '../data/setup';
import { BAT_BY_ID } from '../data/bats';
import { RELICS } from '../data/relics';
import { SPELL_BY_ID } from '../data/spells';
import type { Card, CardMod, ClanId, Rarity } from '../data/types';
import { CHARMS, CHARM_BY_ID, CHARM_PRICE, CHARM_SLOTS, charmSellValue } from '../data/charms';
import { ENHANCEMENTS, ENHANCE_BY_ID } from '../data/enhance';
import { FORMATIONS, type FormationId } from '../data/formations';
import { GOALS, SAGA_ROWS, sagaMaxDepth, sagaNode, type GoalId } from '../data/saga';
import { buildStartingDeck, draftPool, newCard, validateSetup } from './deck';
import { generateMap, type MapNode, type RunMap } from './map';
import type { Profile } from './profile';
import { Rng } from './rng';

export interface Offer {
  kind: Card['kind'];
  id: string;
  price?: number;
}

export interface ShopState {
  cards: Offer[];
  relic: string | null;
  charms: string[];
  enhance: CardMod[];
  chart: FormationId | null;
  removeUsed: boolean;
  healUsed: boolean;
}

export interface RunState {
  rngState: number;
  /** Leads the run with one rule (see data/matriarchs.ts). */
  matriarchId: string;
  /** Map choice (biome id). Older saves may lack it. */
  biome?: string;
  /** Modifier ids chosen on the Play screen. */
  modifiers?: string[];
  deck: Card[];
  relics: string[];
  caveHp: number;
  caveMax: number;
  figs: number;
  map: RunMap;
  /** Last cleared node; null before the first. */
  currentNode: string | null;
  /** Node being played (battle in progress, shop open, ...). */
  activeNode: string | null;
  cleared: string[];
  xpEarned: number;
  glowEarned: number;
  /** Card choices waiting after a battle. */
  draft: Offer[] | null;
  /** Relic granted after an elite, shown on the reward screen. */
  rewardRelic: string | null;
  shop: ShopState | null;
  event: string | null;
  status: 'active' | 'won' | 'lost';
  /** Charm ids (up to CHARM_SLOTS). */
  charms: string[];
  /** Formation levels from star charts. */
  formations: Partial<Record<FormationId, number>>;
  /** Charm choice waiting after an elite. */
  charmOffer: string[] | null;
  /** A star chart offered after a battle (instead of a card). */
  chartOffer: FormationId | null;
  /** Saga node number, if this run is a saga node. */
  saga?: number;
  restrict?: ClanId;
  objective?: 'nursery';
  difficulty?: number;
  /** Star-goal bookkeeping across the run. */
  tally: { leaks: number; rerolls: number; maxRoosts: number; maxLevel: number };
}

export const runRng = (run: RunState) => new Rng(run.rngState);
const saveRng = (run: RunState, rng: Rng) => (run.rngState = rng.state);

export interface RunSetup {
  biome?: string;
  modifiers?: string[];
  /** Play this saga node (its biome, modifiers and twists override the above). */
  saga?: number;
}

export function startRun(p: Profile, matriarchId: string, flock: string[], seed: number, setup: RunSetup = {}): RunState {
  const node = setup.saga ? sagaNode(setup.saga) : null;
  const err = validateSetup(p, matriarchId, flock, node?.restrict);
  if (err) throw new Error(err);
  const rng = new Rng(seed);
  const map = node ? generateMap(rng, SAGA_ROWS, node.bossRule, sagaMaxDepth(node.n)) : generateMap(rng);
  const modifiers = (node ? node.modifiers : setup.modifiers ?? []).filter((id) => MODIFIER_BY_ID[id]);
  if (node) setup = { ...setup, biome: node.biome };
  let cave = BALANCE.run.caveHp;
  for (const id of modifiers) {
    const e = MODIFIER_BY_ID[id].effect;
    if (e.kind === 'caveHp') cave = Math.round(cave * (1 + e.pct / 100));
  }
  const run: RunState = {
    rngState: rng.state,
    matriarchId,
    biome: BIOME_BY_ID[setup.biome ?? ''] ? setup.biome! : BIOMES[0].id,
    modifiers,
    deck: buildStartingDeck(flock),
    relics: [],
    caveHp: cave,
    caveMax: cave,
    figs: 0,
    map,
    currentNode: null,
    activeNode: null,
    cleared: [],
    xpEarned: 0,
    glowEarned: 0,
    draft: null,
    rewardRelic: null,
    shop: null,
    event: null,
    status: 'active',
    charms: [],
    formations: {},
    charmOffer: null,
    chartOffer: null,
    saga: node?.n,
    restrict: node?.restrict,
    objective: node?.objective,
    difficulty: node?.difficulty,
    tally: { leaks: 0, rerolls: 0, maxRoosts: 0, maxLevel: 0 },
  };
  p.flock = [...flock];
  p.lastMatriarch = matriarchId;
  p.lastSetup = { biome: run.biome!, modifiers: [...modifiers] };
  p.stats.runs++;
  return run;
}

export function availableNodes(run: RunState): MapNode[] {
  if (run.status !== 'active' || run.activeNode) return [];
  const ids = run.currentNode ? run.map.nodes[run.currentNode].next : run.map.rows[0];
  return ids.map((id) => run.map.nodes[id]);
}

export function enterNode(run: RunState, nodeId: string): MapNode {
  const node = run.map.nodes[nodeId];
  if (!availableNodes(run).some((n) => n.id === nodeId)) throw new Error('Node not reachable');
  run.activeNode = nodeId;
  const rng = runRng(run);
  if (node.type === 'shop') run.shop = makeShop(run, rng);
  if (node.type === 'event') run.event = rng.pick(EVENTS).id;
  if (node.type === 'treasure') run.rewardRelic = randomRelic(run, rng);
  saveRng(run, rng);
  return node;
}

/** Mark the active node done and move the cursor onto it. */
export function leaveNode(run: RunState) {
  if (!run.activeNode) return;
  run.cleared.push(run.activeNode);
  run.currentNode = run.activeNode;
  run.activeNode = null;
  run.shop = null;
  run.event = null;
  run.draft = null;
  run.rewardRelic = null;
  run.charmOffer = null;
  run.chartOffer = null;
}

export function combatRewards(type: MapNode['type'], row: number) {
  const r = BALANCE.rewards;
  const key = type === 'elite' ? 'elite' : type === 'boss' ? 'boss' : 'battle';
  return {
    xp: r.xp[key] + r.xp.perRow * row,
    glow: r.glow[key] + r.glow.perRow * row,
    figs: r.figs[key],
  };
}

/** Called when a battle on the active node ends. */
export function resolveBattle(run: RunState, won: boolean, caveHpLeft: number) {
  const node = run.map.nodes[run.activeNode!];
  run.caveHp = Math.max(0, Math.round(caveHpLeft));
  if (!won) {
    run.status = 'lost';
    return;
  }
  const rw = combatRewards(node.type, node.row);
  run.xpEarned += rw.xp;
  run.glowEarned += rw.glow;
  run.figs += rw.figs;
  for (const id of run.relics) {
    const e = RELICS.find((r) => r.id === id)!.effect;
    if (e.kind === 'healAfterBattle') run.caveHp = Math.min(run.caveMax, run.caveHp + e.amount);
  }
  if (node.type === 'boss') {
    run.status = 'won';
    return;
  }
  const rng = runRng(run);
  run.draft = draftOffers(run, rng, 3);
  // Elites offer a charm (pick 1 of 2); battles sometimes offer a star chart instead of a card.
  if (node.type === 'elite') run.charmOffer = charmOffers(run, rng, 2);
  else if (rng.next() < 0.4) run.chartOffer = rng.pick(FORMATIONS).id;
  saveRng(run, rng);
}

/** Merge a finished level's results into the run: shattered Glass, broken charms, goal tallies. */
export function applyLevelResult(run: RunState, res: { shattered: string[]; brokenCharms: string[]; tally: RunState['tally'] }) {
  const gone = new Set(res.shattered);
  run.deck = run.deck.filter((c) => !gone.has(c.uid));
  run.charms = run.charms.filter((c) => !res.brokenCharms.includes(c));
  run.tally.leaks += res.tally.leaks;
  run.tally.rerolls += res.tally.rerolls;
  run.tally.maxRoosts = Math.max(run.tally.maxRoosts, res.tally.maxRoosts);
  run.tally.maxLevel = Math.max(run.tally.maxLevel, res.tally.maxLevel);
}

// ---------------- Charms, star charts, enhancements ----------------

export function charmOffers(run: RunState, rng: Rng, n: number): string[] {
  const weights = { common: 6, uncommon: 3, rare: 1 } as const;
  const left = CHARMS.filter((c) => !run.charms.includes(c.id));
  const out: string[] = [];
  while (out.length < n) {
    const avail = left.filter((x) => !out.includes(x.id));
    if (!avail.length) break;
    out.push(rng.weighted(Object.fromEntries(avail.map((x) => [x.id, weights[x.rarity]]))));
  }
  return out;
}

export const charmsFull = (run: RunState) => run.charms.length >= CHARM_SLOTS;

export function takeCharm(run: RunState, id: string): boolean {
  if (!CHARM_BY_ID[id] || run.charms.includes(id) || charmsFull(run)) return false;
  run.charms.push(id);
  return true;
}

export function sellCharm(run: RunState, id: string): boolean {
  if (!run.charms.includes(id)) return false;
  run.charms = run.charms.filter((c) => c !== id);
  run.figs += charmSellValue(id);
  return true;
}

export function studyChart(run: RunState, id: FormationId) {
  run.formations[id] = (run.formations[id] ?? 1) + 1;
}

/** Enhance a bat card. Replaces any previous enhancement. */
export function enhanceCard(run: RunState, uid: string, mod: CardMod): boolean {
  const c = run.deck.find((x) => x.uid === uid);
  if (!c || c.kind !== 'bat' || !ENHANCE_BY_ID[mod]) return false;
  c.mod = mod;
  return true;
}

// ---------------- Saga results ----------------

export function goalMet(run: RunState, g: GoalId): boolean {
  const t = run.tally;
  switch (g) {
    case 'noLeak': return t.leaks === 0;
    case 'healthy': return run.caveHp >= run.caveMax * 0.75;
    case 'frugal': return t.rerolls === 0;
    case 'small': return t.maxRoosts <= 7;
    case 'tall': return t.maxLevel >= 6;
  }
}
export { GOALS };

function rollRarity(rng: Rng): Rarity {
  return rng.weighted(BALANCE.draft.weights);
}

/**
 * Up to n distinct offers. Some are copies of bats already in the deck (merging needs copies),
 * the rest are new species by rarity, or spells.
 */
export function draftOffers(run: RunState, rng: Rng, n: number): Offer[] {
  const all = draftPool();
  const pool = { ...all, bats: run.restrict ? all.bats.filter((b) => BAT_BY_ID[b].clans.includes(run.restrict!)) : all.bats };
  const owned = [...new Set(run.deck.filter((c) => c.kind === 'bat' && !BAT_BY_ID[c.id].basic).map((c) => c.id))];
  const offers: Offer[] = [];
  const taken = (o: Offer) => offers.some((x) => x.kind === o.kind && x.id === o.id);
  for (let tries = 0; offers.length < n && tries < 60; tries++) {
    let o: Offer;
    const roll = rng.next();
    if (owned.length && roll < BALANCE.draft.copyChance) {
      o = { kind: 'bat', id: rng.pick(owned) };
    } else if (roll < BALANCE.draft.copyChance + BALANCE.draft.spellChance) {
      o = { kind: 'spell', id: rng.pick(pool.spells) };
    } else {
      const rarity = rollRarity(rng);
      const bats = pool.bats.filter((b) => BAT_BY_ID[b].rarity === rarity);
      if (!bats.length) continue;
      o = { kind: 'bat', id: rng.pick(bats) };
    }
    if (taken(o)) continue;
    offers.push(o);
  }
  return offers;
}

export const offerRarity = (o: Offer): Rarity =>
  o.kind === 'bat' ? BAT_BY_ID[o.id].rarity : SPELL_BY_ID[o.id].rarity;

export const deckFull = (run: RunState) => run.deck.length >= BALANCE.run.deckCap;

/** Add a card, optionally removing one to make room at the cap. Returns false if not allowed. */
export function addCard(run: RunState, o: Offer, removeUid?: string): boolean {
  if (deckFull(run)) {
    if (!removeUid || !removeCard(run, removeUid)) return false;
  }
  run.deck.push(newCard(o.kind, o.id));
  return true;
}

export function removeCard(run: RunState, uid: string): boolean {
  const i = run.deck.findIndex((c) => c.uid === uid);
  if (i < 0 || run.deck.length <= 4) return false;
  run.deck.splice(i, 1);
  return true;
}

export function upgradeCard(run: RunState, uid: string): boolean {
  const c = run.deck.find((x) => x.uid === uid);
  if (!c || c.upgraded) return false;
  c.upgraded = true;
  return true;
}

export function heal(run: RunState, amount: number) {
  run.caveHp = Math.min(run.caveMax, Math.round(run.caveHp + amount));
}

export function randomRelic(run: RunState, rng: Rng): string | null {
  const left = RELICS.filter((r) => !run.relics.includes(r.id));
  return left.length ? rng.pick(left).id : null;
}

export function takeRelic(run: RunState, id: string | null) {
  if (id && !run.relics.includes(id)) run.relics.push(id);
}

function makeShop(run: RunState, rng: Rng): ShopState {
  const cards = draftOffers(run, rng, 3).map((o) => ({ ...o, price: BALANCE.shop.cardPrice[offerRarity(o)] }));
  return {
    cards,
    relic: rng.next() < 0.5 ? randomRelic(run, rng) : null,
    charms: charmOffers(run, rng, 2),
    enhance: rng.shuffle(ENHANCEMENTS.map((e) => e.id)).slice(0, 2),
    chart: rng.pick(FORMATIONS).id,
    removeUsed: false,
    healUsed: false,
  };
}

export const charmPrice = (id: string) => CHARM_PRICE[CHARM_BY_ID[id].rarity];

// ---------------- Events ----------------

export interface EventOption {
  label: string;
  detail: string;
  apply: (run: RunState, rng: Rng) => string;
}

export interface RunEvent {
  id: string;
  title: string;
  text: string;
  options: EventOption[];
}

export const EVENTS: RunEvent[] = [
  {
    id: 'fig_orchard',
    title: 'Fig Orchard',
    text: 'A strangler fig, heavy with ripe fruit. Fruit bats keep figs going by spreading their seeds; tonight the tree repays the favour.',
    options: [
      { label: 'Feast', detail: 'Heal 25% cave HP', apply: (r) => (heal(r, r.caveMax * 0.25), 'The colony gorges itself.') },
      { label: 'Gather', detail: '+40 Figs', apply: (r) => ((r.figs += 40), 'You stash the figs for later.') },
    ],
  },
  {
    id: 'owl_bargain',
    title: "Owl's Bargain",
    text: 'An old owl blinks down from a branch. "A trinket for a taste of your colony," it hoots.',
    options: [
      {
        label: 'Accept',
        detail: 'Lose 15% max cave HP, gain a relic',
        apply: (r, rng) => {
          const id = randomRelic(r, rng);
          r.caveMax = Math.round(r.caveMax * 0.85);
          r.caveHp = Math.min(r.caveHp, r.caveMax);
          takeRelic(r, id);
          return id ? 'The owl keeps its word.' : 'The owl has nothing left to give. It keeps its taste anyway.';
        },
      },
      { label: 'Refuse', detail: 'Nothing happens', apply: () => 'You fly on.' },
    ],
  },
  {
    id: 'echo_cave',
    title: 'Echoing Cave',
    text: 'Calls bounce back sharper here. Young bats practise until their echoes come back clean.',
    options: [
      {
        label: 'Practise',
        detail: 'Upgrade a random card',
        apply: (r, rng) => {
          const c = r.deck.filter((x) => !x.upgraded);
          if (!c.length) return 'Everyone is already sharp.';
          const pick = rng.pick(c);
          pick.upgraded = true;
          return `${cardName(pick)} improved.`;
        },
      },
      {
        label: 'Practise all night',
        detail: 'Upgrade 2 random cards, lose 10% cave HP',
        apply: (r, rng) => {
          const c = rng.shuffle(r.deck.filter((x) => !x.upgraded)).slice(0, 2);
          c.forEach((x) => (x.upgraded = true));
          heal(r, -r.caveMax * 0.1);
          r.caveHp = Math.max(1, r.caveHp);
          return c.length ? `${c.map(cardName).join(' and ')} improved.` : 'Nothing left to learn.';
        },
      },
    ],
  },
  {
    id: 'lost_pup',
    title: 'Lost Pup',
    text: "A pup from another colony clings to the wall, calling. Mothers find their own pup among thousands by its voice and smell. This one's mother isn't answering.",
    options: [
      {
        label: 'Adopt',
        detail: 'Add a random card to your deck',
        apply: (r, rng) => {
          const [o] = draftOffers(r, rng, 1);
          if (!o) return 'No room in the roost.';
          if (deckFull(r)) return 'Your deck is full; the pup finds another colony.';
          addCard(r, o);
          return `${o.kind === 'bat' ? BAT_BY_ID[o.id].name : SPELL_BY_ID[o.id].name} joined the deck.`;
        },
      },
      { label: 'Guide it home', detail: '+30 Figs', apply: (r) => ((r.figs += 30), 'Its colony leaves you a gift.') },
    ],
  },
];

export const EVENT_BY_ID: Record<string, RunEvent> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

export function chooseEventOption(run: RunState, index: number): string {
  const ev = EVENT_BY_ID[run.event!];
  const rng = runRng(run);
  const msg = ev.options[index].apply(run, rng);
  saveRng(run, rng);
  return msg;
}

export function cardName(c: Pick<Card, 'kind' | 'id' | 'upgraded'>): string {
  const base = c.kind === 'bat' ? BAT_BY_ID[c.id].name : SPELL_BY_ID[c.id].name;
  return c.upgraded ? `${base}+` : base;
}

/** Bank the run's rewards into the profile and close the run. */
export function finishRun(p: Profile, run: RunState): { xp: number; glow: number; cleared: boolean; stars: number; saga?: number } {
  const cleared = run.status === 'won';
  const mult = (cleared ? BALANCE.rewards.clearBonusMult : 1) * (1 + rewardBonusPct(run.modifiers ?? []) / 100);
  const xp = Math.round(run.xpEarned * mult);
  const glow = Math.round(run.glowEarned * mult);
  p.xp += xp;
  p.glow += glow;
  if (cleared) p.stats.clears++;
  let stars = 0;
  if (run.saga) {
    const node = sagaNode(run.saga);
    stars = cleared ? 1 + node.goals.filter((g) => goalMet(run, g)).length : 0;
    p.saga.stars[run.saga] = Math.max(p.saga.stars[run.saga] ?? 0, stars);
    if (cleared && run.saga >= p.saga.unlocked) {
      p.saga.unlocked = run.saga + 1;
      p.glow += 100 + 10 * run.saga; // first-clear bonus
    }
  }
  const depth = Math.max(0, ...run.cleared.map((id) => run.map.nodes[id].row + 1));
  p.stats.bestRow = Math.max(p.stats.bestRow, depth);
  p.run = undefined;
  return { xp, glow, cleared, stars, saga: run.saga };
}
