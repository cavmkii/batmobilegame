import { BALANCE } from '../data/balance';
import { BIOMES, BIOME_BY_ID, MODIFIER_BY_ID } from '../data/setup';
import { BAT_BY_ID } from '../data/bats';
import { SPELL_BY_ID } from '../data/spells';
import type { Card, CardMod, ClanId, Rarity } from '../data/types';
import { CHARMS, CHARM_BY_ID, CHARM_PRICE, CHARM_SLOTS, charmSellValue } from '../data/charms';
import { ENHANCEMENTS, ENHANCE_BY_ID, isSharp } from '../data/enhance';
import { FORMATIONS, type FormationId } from '../data/formations';
import { CHAPTER_ROWS, CHECKPOINT_FIGS, GOALS, sagaNode, type GoalId, type ObjectiveId } from '../data/saga';
import { buildStartingDeck, draftPool, newCard, validateSetup } from './deck';
import { treeEffects, treeSum } from './matriarchTree';
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
  shop: ShopState | null;
  event: string | null;
  status: 'active' | 'won' | 'lost';
  /** Charm ids (up to charmSlots). */
  charms: string[];
  /** CHARM_SLOTS plus the matriarch tree's Trinket Pouch. */
  charmSlots?: number;
  /** Formation levels from star charts. */
  formations: Partial<Record<FormationId, number>>;
  /** Charm choice waiting after an elite. */
  charmOffer: string[] | null;
  /** A star chart offered after a battle (instead of a card). */
  chartOffer: FormationId | null;
  /** The chapter being played (the run continues chapter after chapter until it's lost). */
  chapter: number;
  /** Chapter the run started from (a checkpoint). */
  startChapter: number;
  /** The boss of this chapter has fallen: the next leaveNode moves to the next chapter. */
  chapterCleared?: boolean;
  /** This chapter's twists. */
  restrict?: ClanId;
  objective?: ObjectiveId;
  difficulty?: number;
  /** Star-goal bookkeeping for the current chapter. */
  tally: { leaks: number; rerolls: number; maxRoosts: number; maxLevel: number; wrecks: number };
}

export const runRng = (run: RunState) => new Rng(run.rngState);
const saveRng = (run: RunState, rng: Rng) => (run.rngState = rng.state);

/**
 * Start a run at a chapter (1, or any checkpoint reached). Later checkpoints come with supplies:
 * figs, and a free charm pick shown on the map.
 */
export function startRun(p: Profile, matriarchId: string, flock: string[], seed: number, chapter = 1): RunState {
  chapter = Math.max(1, Math.min(chapter, p.saga.unlocked));
  const err = validateSetup(p, matriarchId, flock, sagaNode(chapter).restrict);
  if (err) throw new Error(err);
  const cave = BALANCE.run.caveHp;
  const run: RunState = {
    rngState: seed,
    matriarchId,
    deck: buildStartingDeck(flock),
    caveHp: cave,
    caveMax: cave,
    figs: CHECKPOINT_FIGS * (chapter - 1),
    map: { nodes: {}, rows: [] },
    currentNode: null,
    activeNode: null,
    cleared: [],
    xpEarned: 0,
    glowEarned: 0,
    draft: null,
    shop: null,
    event: null,
    status: 'active',
    charms: [],
    charmSlots: CHARM_SLOTS + treeSum(treeEffects(matriarchId, p.roster[matriarchId]), 'charmSlot'),
    formations: {},
    charmOffer: null,
    chartOffer: null,
    chapter,
    startChapter: chapter,
    tally: { leaks: 0, rerolls: 0, maxRoosts: 0, maxLevel: 0, wrecks: 0 },
  };
  enterChapter(run, chapter);
  if (chapter > 1) {
    const rng = runRng(run);
    run.charmOffer = charmOffers(run, rng, 2); // supply cache, on the map
    saveRng(run, rng);
  }
  p.flock = [...flock];
  p.lastMatriarch = matriarchId;
  p.stats.runs++;
  return run;
}

/** Set up a chapter: its map, biome, twists and difficulty. The deck, charms and cave carry over. */
export function enterChapter(run: RunState, n: number) {
  const node = sagaNode(n);
  const rng = runRng(run);
  run.chapter = n;
  run.map = generateMap(rng, CHAPTER_ROWS, node.bossRule);
  run.biome = BIOME_BY_ID[node.biome] ? node.biome : BIOMES[0].id;
  run.modifiers = node.modifiers.filter((id) => MODIFIER_BY_ID[id]);
  run.restrict = node.restrict;
  run.objective = node.objective;
  run.difficulty = node.difficulty;
  run.currentNode = null;
  run.activeNode = null;
  run.cleared = [];
  run.chapterCleared = false;
  run.tally = { leaks: 0, rerolls: 0, maxRoosts: 0, maxLevel: 0, wrecks: 0 };
  // Crumbling Cave: the cave loses part of its strength going in.
  for (const id of run.modifiers) {
    const e = MODIFIER_BY_ID[id].effect;
    if (e.kind === 'caveHp') run.caveHp = Math.max(1, Math.min(run.caveHp, Math.round(run.caveMax * (1 + e.pct / 100))));
  }
  saveRng(run, rng);
}

/** Global depth reached: levels of every chapter before this one, plus rows cleared here. */
export const runDepth = (run: RunState) =>
  (run.chapter - 1) * CHAPTER_ROWS + Math.max(0, ...run.cleared.map((id) => run.map.nodes[id].row + 1));

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
  if (node.type === 'treasure') run.charmOffer = charmOffers(run, rng, 2);
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
  run.charmOffer = null;
  run.chartOffer = null;
  if (run.chapterCleared) enterChapter(run, run.chapter + 1);
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
export function resolveBattle(run: RunState, won: boolean, caveHpLeft: number, p?: Profile) {
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
  for (const id of run.charms) {
    const e = CHARM_BY_ID[id]?.effect;
    if (e?.kind === 'healAfterBattle') heal(run, e.amount);
  }
  if (node.type === 'boss') {
    // The chapter's boss falls: stars, checkpoint, and a big reward; the run goes on.
    run.chapterCleared = true;
    if (p) clearChapter(p, run);
    const rng = runRng(run);
    run.figs += 50;
    heal(run, run.caveMax * 0.25);
    run.draft = draftOffers(run, rng, 3, true);
    run.charmOffer = charmOffers(run, rng, 3);
    saveRng(run, rng);
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
  run.tally.wrecks += res.tally.wrecks ?? 0;
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

export const charmSlots = (run: RunState) => run.charmSlots ?? CHARM_SLOTS;
export const charmsFull = (run: RunState) => run.charms.length >= charmSlots(run);

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
  if (!c || !ENHANCE_BY_ID[mod] || (c.kind === 'spell' && mod !== 'sharp')) return false;
  c.mod = mod;
  return true;
}

// ---------------- Saga results ----------------

export function goalMet(run: RunState, g: GoalId): boolean {
  const t = run.tally;
  switch (g) {
    case 'noLeak': return t.leaks === 0;
    case 'healthy': return run.caveHp >= run.caveMax * 0.75;
    case 'unbroken': return (t.wrecks ?? 0) === 0;
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
export function draftOffers(run: RunState, rng: Rng, n: number, rareOnly = false): Offer[] {
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
      const rarity = rareOnly ? rng.pick<Rarity>(['rare', 'rare', 'epic']) : rollRarity(rng);
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

/** Rest site / events: make a card Sharp (replaces any other enhancement). */
export function upgradeCard(run: RunState, uid: string): boolean {
  const c = run.deck.find((x) => x.uid === uid);
  if (!c || c.mod === 'sharp') return false;
  c.mod = 'sharp';
  return true;
}

/** Heal the cave (no-op on a Fragile-cave saga node; damage still applies). */
export function heal(run: RunState, amount: number) {
  if (amount > 0 && run.objective === 'fragile') return;
  run.caveHp = Math.min(run.caveMax, Math.round(run.caveHp + amount));
}

function makeShop(run: RunState, rng: Rng): ShopState {
  const cards = draftOffers(run, rng, 3).map((o) => ({ ...o, price: BALANCE.shop.cardPrice[offerRarity(o)] }));
  return {
    cards,
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
        detail: 'Lose 15% max cave HP, gain a random charm',
        apply: (r, rng) => {
          const [id] = charmOffers(r, rng, 1);
          r.caveMax = Math.round(r.caveMax * 0.85);
          r.caveHp = Math.min(r.caveHp, r.caveMax);
          if (!id) return 'The owl has nothing left to give. It keeps its taste anyway.';
          if (!takeCharm(r, id)) return 'Your charm slots are full; the owl keeps its trinket, and its taste.';
          return `The owl keeps its word: ${CHARM_BY_ID[id].name}.`;
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
          const c = r.deck.filter((x) => !x.mod);
          if (!c.length) return 'Everyone is already sharp.';
          const pick = rng.pick(c);
          pick.mod = 'sharp';
          return `${cardName(pick)} improved.`;
        },
      },
      {
        label: 'Practise all night',
        detail: 'Upgrade 2 random cards, lose 10% cave HP',
        apply: (r, rng) => {
          const c = rng.shuffle(r.deck.filter((x) => !x.mod)).slice(0, 2);
          c.forEach((x) => (x.mod = 'sharp'));
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
  {
    id: 'guano_miners',
    title: 'Guano Miners',
    text: 'Miners with sacks and lanterns. For centuries bat guano was dug out of caves for fertiliser and for the saltpetre in gunpowder.',
    options: [
      {
        label: 'Trade with them', detail: '+45 Figs, lose 10% cave HP',
        apply: (r) => { r.figs += 45; r.caveHp = Math.max(1, Math.round(r.caveHp - r.caveMax * 0.1)); return 'They pay well, and dig too deep.'; },
      },
      { label: 'Drive them off', detail: 'Nothing happens', apply: () => 'The cave goes quiet again.' },
    ],
  },
  {
    id: 'white_nose',
    title: 'Sick Colony',
    text: 'A neighbouring colony wakes too often in winter, muzzles dusted white. White-nose syndrome, a fungal disease, has killed millions of hibernating bats in North America.',
    options: [
      {
        label: 'Keep apart', detail: 'Remove a random Fledgling from your deck',
        apply: (r, rng) => {
          const f = r.deck.filter((c) => c.id === 'fledgling');
          if (!f.length || r.deck.length <= 4) return 'You keep your distance; nothing changes.';
          removeCard(r, rng.pick(f).uid);
          return 'One young bat stays behind. The rest stay healthy.';
        },
      },
      {
        label: 'Take in the healthy ones', detail: 'Add 2 Fledglings, heal 10%',
        apply: (r) => {
          let n = 0;
          for (let k = 0; k < 2 && !deckFull(r); k++) n += addCard(r, { kind: 'bat', id: 'fledgling' }) ? 1 : 0;
          heal(r, r.caveMax * 0.1);
          return n ? `${n} Fledgling${n > 1 ? 's' : ''} join the colony.` : 'No room; you share what food you can.';
        },
      },
    ],
  },
  {
    id: 'moth_bloom',
    title: 'Moth Bloom',
    text: 'A warm wet night and the air is thick with moths. A single little brown bat can catch hundreds of insects in a night.',
    options: [
      {
        label: 'Feast', detail: 'Copy a random bat card in your deck',
        apply: (r, rng) => {
          const bats = r.deck.filter((c) => c.kind === 'bat');
          if (!bats.length || deckFull(r)) return 'Everyone eats well, but there is no room for more.';
          const c = rng.pick(bats);
          addCard(r, { kind: 'bat', id: c.id });
          return `Well fed, another ${BAT_BY_ID[c.id].name} joins.`;
        },
      },
      { label: 'Stockpile', detail: '+30 Figs', apply: (r) => ((r.figs += 30), 'You trade the surplus for figs.') },
    ],
  },
  {
    id: 'thunderstorm',
    title: 'Thunderstorm',
    text: 'Rain hammers the hillside. Bats mostly stay in on stormy nights: wet wings cost a lot of energy to fly.',
    options: [
      { label: 'Shelter', detail: 'Heal 15%', apply: (r) => (heal(r, r.caveMax * 0.15), 'The colony waits it out.') },
      {
        label: 'Fly through it', detail: 'A random card becomes Sharp, lose 10% cave HP',
        apply: (r, rng) => {
          const c = r.deck.filter((x) => !x.mod);
          r.caveHp = Math.max(1, Math.round(r.caveHp - r.caveMax * 0.1));
          if (!c.length) return 'Soaked, and nothing learned.';
          const pick = rng.pick(c);
          pick.mod = 'sharp';
          return `${cardName(pick)} comes back hardened.`;
        },
      },
    ],
  },
  {
    id: 'mist_nets',
    title: 'Mist Nets',
    text: 'Researchers string fine nets across a flyway, then measure, band and release every bat they catch. Long-term banding is how we know some small bats live over 30 years.',
    options: [
      {
        label: 'Get banded', detail: 'Study a random star chart',
        apply: (r, rng) => {
          const f = rng.pick(FORMATIONS);
          studyChart(r, f.id);
          return `The researchers' notes give you an idea: ${f.name} is now level ${r.formations[f.id]}.`;
        },
      },
      { label: 'Slip past', detail: '+20 Figs', apply: (r) => ((r.figs += 20), 'You find a dropped snack bag.') },
    ],
  },
  {
    id: 'old_roost',
    title: 'Abandoned Roost',
    text: 'An old roost, empty for years. The ceiling is stained dark where thousands of bats once hung.',
    options: [
      {
        label: 'Search it', detail: 'A random enhancement on a random bat card',
        apply: (r, rng) => {
          const bats = r.deck.filter((c) => c.kind === 'bat' && !c.mod);
          if (!bats.length) return 'Nothing here your colony can use.';
          const c = rng.pick(bats);
          const e = rng.pick(ENHANCEMENTS);
          c.mod = e.id;
          return `${BAT_BY_ID[c.id].name} becomes ${e.name}: ${e.desc}`;
        },
      },
      { label: 'Rest here', detail: 'Heal 20%', apply: (r) => (heal(r, r.caveMax * 0.2), 'A quiet day in an old home.') },
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

export function cardName(c: Pick<Card, 'kind' | 'id' | 'upgraded' | 'mod'>): string {
  const base = c.kind === 'bat' ? BAT_BY_ID[c.id].name : SPELL_BY_ID[c.id].name;
  return isSharp(c) ? `${base}+` : base;
}

/** Bank the run's rewards into the profile and close the run. */
/** Stars, checkpoint and first-clear bonus when a chapter's boss falls. */
export function clearChapter(p: Profile, run: RunState) {
  const node = sagaNode(run.chapter);
  const stars = 1 + node.goals.filter((g) => goalMet(run, g)).length;
  p.saga.stars[run.chapter] = Math.max(p.saga.stars[run.chapter] ?? 0, stars);
  if (run.chapter >= p.saga.unlocked) {
    p.saga.unlocked = run.chapter + 1;
    p.glow += 100 + 25 * run.chapter; // first clear
  }
  p.stats.clears++;
  return stars;
}

/** Bank the run's rewards when it ends (the cave fell, or it was abandoned). */
export function finishRun(p: Profile, run: RunState): { xp: number; glow: number; chapter: number; depth: number; startChapter: number; checkpoint: number } {
  const chaptersCleared = Math.max(0, run.chapter - run.startChapter);
  const mult = 1 + 0.25 * chaptersCleared;
  const xp = Math.round(run.xpEarned * mult);
  const glow = Math.round(run.glowEarned * mult);
  p.xp += xp;
  p.glow += glow;
  const depth = runDepth(run);
  p.stats.bestRow = Math.max(p.stats.bestRow, depth);
  p.run = undefined;
  return { xp, glow, chapter: run.chapter, depth, startChapter: run.startChapter, checkpoint: p.saga.unlocked };
}
