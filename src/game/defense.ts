import { BALANCE } from '../data/balance';
import { BAT_BY_ID } from '../data/bats';
import { CLANS, CLAN_ORDER } from '../data/clans';
import { formationValue, type FormationId } from '../data/formations';
import { MATRIARCH_BY_ID, matriarchGuano } from '../data/matriarchs';
import type { BossRuleId } from '../data/bossRules';
import { ENCOUNTERS, ENEMY_BY_ID, type Encounter } from '../data/enemies';
import { CHARM_BY_ID } from '../data/charms';
import { isSharp } from '../data/enhance';
import { SPELL_BY_ID } from '../data/spells';
import { BIOMES, BIOME_BY_ID, MODIFIER_BY_ID } from '../data/setup';
import { TERRAIN } from '../data/terrain';
import type { Card, SpellEffect, Stats, TerrainId, Trait } from '../data/types';
import { attackStyle, blueprint, type AttackStyle, type OwnedBat, type UnitBlueprint } from './progression';
import { Rng } from './rng';

const F = BALANCE.field;
/**
 * Scales the forecast so 1.0 means "probably holds". Calibrated with the bot over every encounter:
 * columns at ≥1 leaked about 1% of nights, 0.6–1 about 13%, below 0.6 about 35–45%.
 */
const FORECAST_SECONDS = 8;
const U = BALANCE.units;
const E = BALANCE.economy;
const L = BALANCE.roostLevel;

export interface DefenseConfig {
  encounterId: string;
  row: number;
  deck: Card[];
  matriarchId: string;
  roster: Record<string, OwnedBat>;
  caveHp: number;
  caveMax: number;
  seed: number;
  /** Biome id: weights which terrain tiles appear. */
  biome?: string;
  /** Run modifier ids. */
  modifiers?: string[];
  /** Charm ids held this run. */
  charms?: string[];
  /** Boss levels bend one rule. */
  bossRule?: BossRuleId;
  /** Extra enemy strength (saga depth), as a multiplier on HP and attack. */
  difficulty?: number;
  /** Formation levels from star charts (default 1). */
  formationLevels?: Partial<Record<FormationId, number>>;
  /** 'nursery': a nursery roost sits mid-field; if it is wrecked, the level is lost. */
  objective?: 'nursery';
}

export interface Roost {
  batId: string;
  /** Uids of Glass cards built into this roost (they shatter if it's wrecked). */
  glass: string[];
  /** The objective roost: holds no bats, can't merge; losing it loses the level. */
  nursery?: boolean;
  bp: UnitBlueprint;
  /** 1..10. Raised by stacking the same bat, or by a neighbour's pattern. 10 = one mega bat. */
  level: number;
  hp: number;
  maxHp: number;
  /** Seconds accumulated toward replacing a fallen bat (night only). */
  respawnTimer: number;
  /** Destroyed tonight: no bats, doesn't block. Rebuilt at dawn. */
  ruined: boolean;
}

export interface Slot {
  idx: number;
  col: number;
  row: number;
  x: number;
  y: number;
  terrain: TerrainId | null;
  roost: Roost | null;
}

export interface NightGroup {
  enemy: string;
  count: number;
  col: number;
}

/** Per-bat bonuses from terrain and charms, fixed when the bat leaves its roost. */
interface Mods {
  atkPct: number;
  hastePct: number;
  lifesteal: number;
  auraMult: number;
}

export interface Unit {
  id: number;
  side: 'bat' | 'enemy';
  defId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  /** Range in tiles, speed in tiles/second. */
  stats: Stats;
  traits: Trait[];
  mods: Mods;
  atkTimer: number;
  stunTimer: number;
  knockTimer: number;
  kbThresholds: number[];
  healTimer: number;
  sinceAttack: number;
  /** Home slot for bats (null for summoned bats). */
  home: number | null;
  /** A level-10+ roost's single giant bat. */
  mega: boolean;
  /** From a roost at the armour level: drawn armoured. */
  armored: boolean;
  dead: boolean;
  /** Last attack target position, for the renderer. */
  aimX: number;
  aimY: number;
}

export interface FloatText { x: number; y: number; text: string; color: string; t: number }
export interface Effect { kind: 'blast' | 'stun' | 'heal' | 'buff' | 'slow' | 'death' | 'place' | 'level'; x: number; y: number; r: number; t: number }

/** One attack, for the renderer: drawn by style, coloured by the attacker's clan. */
export interface Strike {
  fx: number; fy: number; tx: number; ty: number;
  style: AttackStyle | 'drain' | 'enemy' | 'enemyShot';
  color: string;
  t: number;
}

export type Phase = 'day' | 'night' | 'won' | 'lost';

export interface FormationHit { id: FormationId; slots: number[] }

const NO_MODS: Mods = { atkPct: 0, hastePct: 0, lifesteal: 0, auraMult: 1 };

export class Defense {
  readonly encounter: Encounter;
  readonly rng: Rng;
  phase: Phase = 'day';
  /** 1-based day/night counter; night N follows day N. */
  day = 1;
  readonly nights: number;
  guano: number;
  /** The visible offers (null = used, waiting for a refresh or dawn). */
  pool: (Card | null)[];
  /** The spell hand: castable as instants. Spells never enter the pool. */
  spells: Card[] = [];
  private spellPile: Card[] = [];
  private spellDiscard: Card[] = [];
  drawPile: Card[];
  discard: Card[] = [];
  slots: Slot[] = [];
  plans: NightGroup[][];
  units: Unit[] = [];
  floats: FloatText[] = [];
  effects: Effect[] = [];
  strikes: Strike[] = [];
  cave: { hp: number; max: number };
  /** Formations locked in at dusk (bats leaving roosts tonight use these). */
  nightFormations: FormationHit[] = [];
  private nightSlots = new Map<number, Set<FormationId>>();
  /** Enemies killed this night (feeds the dawn guano bonus). */
  kills = 0;
  /** Guano earned at the last dawn, for the UI. */
  lastIncome = 0;
  lastIncomeParts = { base: 0, roosts: 0, kills: 0, charms: 0, clans: 0, interest: 0 };
  /** Seconds since the last enemy fell; dawn waits for BALANCE.night.dawnDelay. */
  private clearTimer = 0;
  /** Seconds into the current night (or total, for animation). */
  time = 0;
  clock = 0;
  buffs = { atkPct: 0, lifesteal: 0, atkUntil: 0, hastePct: 0, hasteUntil: 0, slowPct: 0, slowUntil: 0 };

  private nextId = 1;
  private spawnQueue: { at: number; enemy: string; x: number }[] = [];
  private enemyMult: number;
  /** New Moon modifier: tonight's wave isn't shown by day. */
  previewHidden = false;
  get biome(): string {
    return this.cfg.biome ?? BIOMES[0].id;
  }
  private mods = { extraNights: 0, guanoPerDawn: 0, wavePct: 0 };
  /** Flat passives from charms. */
  private passive = { guanoPerDawn: 0, refreshDiscount: 0, startGuano: 0, speedPct: 0, hpPct: 0, atkPct: 0, startLevel: 0 };
  readonly charms: Set<string>;
  /** Glass card uids that shattered this level (removed from the run deck afterwards). */
  shattered: string[] = [];
  /** Charms that broke this level (Second Wind). */
  brokenCharms: string[] = [];
  /** For star goals: leaks, rerolls, most roosts on the field, highest roost level. */
  tally = { leaks: 0, rerolls: 0, maxRoosts: 0, maxLevel: 0 };
  /** Free rerolls left today (Thrift). */
  private freeRerolls = 0;
  /** Last dawn's interest, for the UI. */
  lastInterest = 0;
  /** The matriarch's rule, unpacked. */
  readonly rule = { mergeRefund: 0, feedingRoost: false, mergeReach: 0, poolExtra: 0 };
  /** Kills tonight by home slot (Feeding Roost). */
  private killsBy = new Map<number, number>();

  constructor(private cfg: DefenseConfig) {
    const enc = ENCOUNTERS.find((e) => e.id === cfg.encounterId);
    if (!enc) throw new Error(`Unknown encounter ${cfg.encounterId}`);
    this.encounter = enc;
    for (const id of cfg.modifiers ?? []) {
      const e = MODIFIER_BY_ID[id]?.effect;
      if (!e) continue;
      if (e.kind === 'extraNights') this.mods.extraNights += e.amount;
      else if (e.kind === 'guanoPerDawn') this.mods.guanoPerDawn += e.amount;
      else if (e.kind === 'waveSize') this.mods.wavePct += e.pct;
      else if (e.kind === 'hidePreview') this.previewHidden = true;
    }
    this.nights = enc.nights + this.mods.extraNights;
    this.rng = new Rng(cfg.seed);
    this.enemyMult = (1 + BALANCE.enemyRowScaling * cfg.row) * (cfg.difficulty ?? 1);
    this.charms = new Set(cfg.charms ?? []);
    this.cave = { hp: cfg.caveHp, max: cfg.caveMax };

    for (const id of cfg.charms ?? []) {
      const e = CHARM_BY_ID[id]?.effect;
      if (!e) continue;
      if (e.kind === 'speedPct' || e.kind === 'hpPct' || e.kind === 'atkPct') this.passive[e.kind] += e.pct;
      else if (e.kind !== 'healAfterBattle') this.passive[e.kind] += e.amount;
    }
    const m = MATRIARCH_BY_ID[cfg.matriarchId]?.effect;
    if (m?.kind === 'mergeRefund') this.rule.mergeRefund = m.guano;
    else if (m?.kind === 'feedingRoost') this.rule.feedingRoost = true;
    else if (m?.kind === 'mergeReach') this.rule.mergeReach = m.levels;
    else if (m?.kind === 'poolSize') this.rule.poolExtra = m.extra;

    this.slots = this.makeSlots();
    this.plans = Array.from({ length: this.nights }, (_, i) => this.planNight(i + 1));
    this.drawPile = this.rng.shuffle(cfg.deck.filter((c) => c.kind === 'bat'));
    this.spellPile = this.rng.shuffle(cfg.deck.filter((c) => c.kind === 'spell'));
    this.drawSpells(BALANCE.spells.startHand);
    const poolSize = E.poolSize + this.rule.poolExtra + (this.charms.has('deep_pockets') ? 1 : 0) - (cfg.bossRule === 'storm' ? 1 : 0);
    this.pool = Array.from({ length: Math.max(1, poolSize) }, () => null);
    if (cfg.objective === 'nursery') this.placeNursery();
    this.freeRerolls = this.charms.has('thrift') ? 1 : 0;
    this.fillPool();
    const mo = cfg.roster[cfg.matriarchId];
    this.guano = E.startGuano + this.passive.startGuano + (mo ? matriarchGuano(mo.level, mo.plus) : 0);
  }

  // ---------------- Queries ----------------

  get tonight(): NightGroup[] {
    return this.plans[this.day - 1] ?? [];
  }

  get refreshCost(): number {
    if (this.freeRerolls > 0) return 0;
    return Math.max(0, E.refreshCost - this.passive.refreshDiscount);
  }

  get bossRule(): BossRuleId | undefined {
    return this.cfg.bossRule;
  }

  get interestCap(): number {
    return BALANCE.interest.cap + (this.charms.has('hoard') ? 3 : 0);
  }

  /** What unspent guano would earn at dawn. */
  interestNow(): number {
    return Math.min(this.interestCap, Math.floor(this.guano / BALANCE.interest.per));
  }

  /** Owl's Watch closes the leftmost column. */
  tileClosed(slotIdx: number): boolean {
    return this.cfg.bossRule === 'owl_watch' && this.slots[slotIdx]?.col === 0;
  }

  cardCost(card: Card): number {
    if (card.kind === 'bat') return this.batBlueprint(card).cost;
    return Math.max(this.charms.has('night_shift') ? 0 : 1, SPELL_BY_ID[card.id].cost - (this.charms.has('night_shift') ? 1 : 0));
  }

  /** Can the pool card at `src` go on this tile: an empty tile, or a roost it can merge onto. */
  canPlace(src: number, slotIdx: number): boolean {
    if (this.phase !== 'day') return false;
    const slot = this.slots[slotIdx];
    if (!slot || this.tileClosed(slotIdx)) return false;
    const c = this.pool[src];
    if (!c || c.kind !== 'bat' || this.guano < this.cardCost(c)) return false;
    return !slot.roost || this.canStackOn(slot, c.id, c.mod === 'wild');
  }

  /**
   * Can a roost of this bat at `level` merge into `to`? Same bat, same level
   * (Pair Bond: the target may be up to rule.mergeReach levels higher).
   */
  private mergeable(batId: string, level: number, to: Roost | null, wild = false): boolean {
    if (!to || to.ruined || to.nursery) return false;
    const sameKind = to.batId === batId
      // Foster Mother: Fledglings merge into anything. Wild cards: anything of their clan.
      || (batId === 'fledgling' && (this.charms.has('foster') || wild))
      || (wild && BAT_BY_ID[batId].clans.some((c) => BAT_BY_ID[to.batId].clans.includes(c)));
    if (!sameKind) return false;
    const gap = to.level - level;
    return gap >= 0 && gap <= this.rule.mergeReach;
  }

  /** A pool card is a level-1 roost, so it merges onto a level-1 roost of the same bat. */
  canStackOn(slot: Slot, batId: string, wild = false): boolean {
    return this.mergeable(batId, 1, slot.roost, wild);
  }

  /** Two roosts merge if they're the same bat at the same level. */
  canMerge(fromIdx: number, toIdx: number): boolean {
    if (this.phase !== 'day' || fromIdx === toIdx) return false;
    const a = this.slots[fromIdx]?.roost;
    return !!a && !a.ruined && !a.nursery && this.mergeable(a.batId, a.level, this.slots[toIdx]?.roost ?? null);
  }

  /**
   * Formations standing right now (wrecked roosts and the nursery don't count).
   * Each hit lists the slots it covers.
   */
  formations(): FormationHit[] {
    const at = (col: number, row: number) => {
      const s = this.slots.find((o) => o.col === col && o.row === row);
      return s?.roost && !s.roost.ruined && !s.roost.nursery ? s : null;
    };
    const clansOf = (s: Slot) => BAT_BY_ID[s.roost!.batId].clans;
    const hits: FormationHit[] = [];
    for (const s of this.slots) {
      if (!at(s.col, s.row)) continue;
      // Pair: same species to the right or below (each pair found once).
      for (const [dc, dr] of [[1, 0], [0, 1]] as const) {
        const o = at(s.col + dc, s.row + dr);
        if (o && o.roost!.batId === s.roost!.batId) hits.push({ id: 'pair', slots: [s.idx, o.idx] });
      }
      // Cluster: 2×2 with a shared clan, anchored top-left.
      const block = [at(s.col, s.row), at(s.col + 1, s.row), at(s.col, s.row + 1), at(s.col + 1, s.row + 1)];
      if (block.every(Boolean) && CLAN_ORDER.some((c) => block.every((b) => clansOf(b!).includes(c)))) {
        hits.push({ id: 'cluster', slots: block.map((b) => b!.idx) });
      }
    }
    for (let row = 0; row < F.roostRows; row++) {
      const cells = Array.from({ length: F.cols }, (_, col) => at(col, row));
      if (cells.every(Boolean)) hits.push({ id: 'full_row', slots: cells.map((c) => c!.idx) });
      // Line: longest runs of 3+ sharing a clan.
      for (const clan of CLAN_ORDER) {
        let run: Slot[] = [];
        const flush = () => {
          if (run.length >= 3) hits.push({ id: 'line', slots: run.map((r) => r.idx) });
          run = [];
        };
        for (const c of cells) {
          if (c && clansOf(c).includes(clan)) run.push(c);
          else flush();
        }
        flush();
      }
    }
    for (let col = 0; col < F.cols; col++) {
      const cells = Array.from({ length: F.roostRows }, (_, row) => at(col, row));
      if (cells.every(Boolean)) hits.push({ id: 'column', slots: cells.map((c) => c!.idx) });
    }
    return hits;
  }

  /** A formation's level this run (star charts, Star Gazer, Star Map). */
  formationLevel(id: FormationId): number {
    return (this.cfg.formationLevels?.[id] ?? 1) + (this.charms.has('star_gazer') ? 1 : 0);
  }

  formationValue(id: FormationId): number {
    return formationValue(id, this.formationLevel(id));
  }

  /** Dawn guano from Clusters. */
  clusterGuano(hits: FormationHit[]): number {
    return hits.filter((h) => h.id === 'cluster').length * this.formationValue('cluster');
  }

  /** Slot idx → formation ids it's part of, from a list of hits. */
  private bySlot(hits: FormationHit[]): Map<number, Set<FormationId>> {
    const m = new Map<number, Set<FormationId>>();
    for (const h of hits) for (const i of h.slots) {
      if (!m.has(i)) m.set(i, new Set());
      m.get(i)!.add(h.id);
    }
    return m;
  }

  /** Merge roost `from` into roost `to`: `to` gains a level (and fires its pattern); `from` is freed. Free. */
  merge(fromIdx: number, toIdx: number): boolean {
    if (!this.canMerge(fromIdx, toIdx)) return false;
    this.slots[toIdx].roost!.glass.push(...this.slots[fromIdx].roost!.glass);
    this.slots[fromIdx].roost = null;
    this.effects.push({ kind: 'place', x: this.slots[fromIdx].x, y: this.slots[fromIdx].y, r: 0.4, t: this.clock });
    this.mergeUp(this.slots[toIdx]);
    return true;
  }

  /** Slots holding a roost that `fromIdx` could merge into right now. */
  mergeTargets(fromIdx: number): Slot[] {
    return this.slots.filter((s) => this.canMerge(fromIdx, s.idx));
  }

  canRefresh(): boolean {
    return this.phase === 'day' && this.guano >= this.refreshCost && this.drawPile.length + this.discard.length + this.pool.filter(Boolean).length > 0;
  }

  /** Spells are instants: castable by day or night, but most only do something at night. */
  canCast(i: number): boolean {
    const c = this.spells[i];
    if (!c || this.guano < this.cardCost(c)) return false;
    if (this.phase === 'night') return true;
    return this.phase === 'day' && SPELL_BY_ID[c.id].effect.kind === 'healAll';
  }

  terrainMatches(slotIdx: number, batId: string): boolean {
    const t = this.slots[slotIdx].terrain;
    return !!t && BAT_BY_ID[batId].clans.includes(TERRAIN[t].clan);
  }

  /** Tiles a roost's pattern reaches from `slotIdx` (whether or not they hold a roost). */
  patternTiles(slotIdx: number, batId: string): Slot[] {
    const s = this.slots[slotIdx];
    return this.patternOf(batId)
      .map(([dc, dr]) => this.slots.find((o) => o.col === s.col + dc && o.row === s.row + dr))
      .filter((o): o is Slot => !!o);
  }

  private patterns = new Map<string, [number, number][]>();
  /** This bat's pattern with the player's spread skills. */
  patternOf(batId: string): [number, number][] {
    let p = this.patterns.get(batId);
    if (!p) this.patterns.set(batId, (p = blueprint(batId, this.cfg.roster[batId]).pattern));
    return p;
  }

  isMega(r: Roost): boolean {
    return r.level >= L.megaLevel;
  }

  /**
   * Night forecast, per column with enemies tonight: how much damage the colony can put into that
   * column over FORECAST_SECONDS, against the HP coming down it. A rough guide, not a promise:
   * bats chase the nearest enemy, so neighbouring columns count partly.
   */
  forecast(): { col: number; ratio: number; label: 'safe' | 'risky' | 'danger' }[] {
    const threat = new Map<number, number>();
    for (const g of this.tonight) {
      const e = ENEMY_BY_ID[g.enemy];
      threat.set(g.col, (threat.get(g.col) ?? 0) + g.count * e.stats.hp * this.enemyMult);
    }
    const out: { col: number; ratio: number; label: 'safe' | 'risky' | 'danger' }[] = [];
    for (const [col, hp] of threat) {
      let dps = 0;
      for (const s of this.slots) {
        const r = s.roost;
        if (!r || r.ruined || r.nursery) continue;
        const w = [1, 0.5, 0.2][Math.abs(s.col - col)] ?? 0;
        if (!w) continue;
        dps += w * this.roostDps(s);
      }
      const ratio = (dps * FORECAST_SECONDS) / hp;
      out.push({ col, ratio, label: ratio >= 1 ? 'safe' : ratio >= 0.6 ? 'risky' : 'danger' });
    }
    return out.sort((a, b) => a.col - b.col);
  }

  /** Rough damage per second a roost's full group deals. */
  private roostDps(s: Slot): number {
    const r = s.roost!;
    const bp = r.bp;
    const lvl = 1 + (L.statPct * (r.level - 1)) / 100;
    let atk = bp.stats.atk * lvl * (1 + this.modsFor(s).atkPct / 100);
    let n = this.batsPerRoost(r);
    if (this.isMega(r)) {
      atk *= (bp.roost.count + L.maxExtraBats) * L.megaAtkMult;
      n = 1;
    }
    const multi = bp.traits.find((t) => t.kind === 'multiHit');
    const spread = bp.traits.some((t) => t.kind === 'aoe') ? 1.6 : multi && multi.kind === 'multiHit' ? 1 + (multi.targets - 1) * 0.5 : 1;
    const aura = bp.traits.some((t) => t.kind === 'atkAura' || t.kind === 'hasteAura') ? 1.3 : 1;
    return (n * atk * spread * aura) / bp.stats.rate;
  }

  // ---------------- Day actions ----------------

  place(src: number, slotIdx: number): boolean {
    if (!this.canPlace(src, slotIdx)) return false;
    const slot = this.slots[slotIdx];
    const card = this.pool[src]!;
    this.pool[src] = null;
    this.guano -= this.cardCost(card);
    // Placed cards cycle back through the deck, so the same bat can be drawn again and stacked.
    this.discard.push(card);
    // Echo: a plain copy of the card joins the discard for the rest of the level.
    if (card.mod === 'echo') this.discard.push({ uid: `echo-${card.uid}-${this.clock}`, kind: 'bat', id: card.id });
    if (slot.roost) {
      if (card.mod === 'glass') slot.roost.glass.push(card.uid);
      this.mergeUp(slot);
    } else {
      this.newRoost(slot, this.batBlueprint(card), card.mod === 'foil' ? 1 : 0);
      if (card.mod === 'glass') slot.roost!.glass.push(card.uid);
      // Twins: a new roost next to one of its own kind bumps that neighbour.
      if (this.charms.has('twins')) {
        const twin = this.neighbours(slot).find((n) => n.roost && !n.roost.ruined && n.roost.batId === card.id);
        if (twin) this.levelUp(twin, 1);
      }
    }
    this.track();
    return true;
  }

  /** Draw spells into the hand, up to the hand limit (the spell discard reshuffles when needed). */
  private drawSpells(n: number) {
    for (let k = 0; k < n && this.spells.length < E.spellHandMax; k++) {
      if (!this.spellPile.length) {
        if (!this.spellDiscard.length) return;
        this.spellPile = this.rng.shuffle(this.spellDiscard);
        this.spellDiscard = [];
      }
      this.spells.push(this.spellPile.shift()!);
    }
  }

  /** Spells left to draw this level (pile + discard), for the UI. */
  get spellsLeft(): number {
    return this.spellPile.length + this.spellDiscard.length;
  }

  /** Discard what's showing and draw a fresh pool. */
  refresh(): boolean {
    if (!this.canRefresh()) return false;
    this.guano -= this.refreshCost;
    if (this.freeRerolls > 0) this.freeRerolls--;
    this.tally.rerolls++;
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i]) this.discard.push(this.pool[i]!);
      this.pool[i] = null;
    }
    this.fillPool();
    return true;
  }

  cast(i: number): boolean {
    if (!this.canCast(i)) return false;
    const card = this.spells.splice(i, 1)[0];
    this.guano -= this.cardCost(card);
    this.castSpell(SPELL_BY_ID[card.id].effect, isSharp(card));
    this.spellDiscard.push(card);
    return true;
  }

  endDay() {
    if (this.phase !== 'day') return;
    this.phase = 'night';
    this.time = 0;
    this.kills = 0;
    this.killsBy.clear();
    this.buffs = { atkPct: 0, lifesteal: 0, atkUntil: 0, hastePct: 0, hasteUntil: 0, slowPct: 0, slowUntil: 0 };
    // Nobody is out at dusk: every roost starts its cooldown and releases bats as it fills.
    this.clearTimer = 0;
    this.duskCharms();
    this.nightFormations = this.formations();
    this.nightSlots = this.bySlot(this.nightFormations);
    this.track();
    for (const slot of this.slots) if (slot.roost) slot.roost.respawnTimer = 0;
    let t = BALANCE.night.duskLead;
    this.spawnQueue = [];
    for (const g of this.tonight) {
      for (let k = 0; k < g.count; k++) {
        this.spawnQueue.push({ at: t + k * BALANCE.night.spawnGap, enemy: g.enemy, x: g.col + 0.5 + (this.rng.next() - 0.5) * 0.4 });
      }
      t += BALANCE.night.groupGap;
    }
    this.spawnQueue.sort((a, b) => a.at - b.at);
  }

  // ---------------- Night simulation ----------------

  step(dt: number) {
    this.clock += dt;
    if (this.phase !== 'night') return;
    this.time += dt;

    while (this.spawnQueue.length && this.spawnQueue[0].at <= this.time) {
      const s = this.spawnQueue.shift()!;
      this.spawnEnemy(s.enemy, s.x);
    }

    this.respawnBats(dt);

    const alive = this.units.filter((u) => !u.dead);
    const bats = alive.filter((u) => u.side === 'bat');
    const enemies = alive.filter((u) => u.side === 'enemy');
    const auras = this.computeAuras(bats);
    const slow = this.time < this.buffs.slowUntil ? 1 - this.buffs.slowPct / 100 : 1;

    for (const u of alive) {
      if (u.dead) continue;
      u.sinceAttack += dt;
      if (u.knockTimer > 0) {
        u.knockTimer -= dt;
        u.y = Math.max(-0.5, u.y - (BALANCE.knockback.distance / BALANCE.knockback.duration) * dt);
        continue;
      }
      if (u.stunTimer > 0) {
        u.stunTimer -= dt;
        continue;
      }
      if (u.side === 'bat') this.batTick(u, enemies, alive, auras, dt);
      else this.enemyTick(u, bats, dt * slow);
    }

    this.units = this.units.filter((u) => !u.dead);
    this.floats = this.floats.filter((f) => this.clock - f.t < 1.2);
    this.effects = this.effects.filter((f) => this.clock - f.t < 0.8);
    this.strikes = this.strikes.filter((f) => this.clock - f.t < 0.45);

    if (this.cave.hp <= 0 && this.charms.has('second_wind') && !this.brokenCharms.includes('second_wind')) {
      this.cave.hp = 1;
      this.brokenCharms.push('second_wind');
      this.charms.delete('second_wind');
      this.floats.push({ x: 2.5, y: F.caveY - 0.5, text: 'SECOND WIND!', color: '#9ae8ff', t: this.clock });
    }
    if (this.cave.hp <= 0) {
      this.cave.hp = 0;
      this.phase = 'lost';
      return;
    }
    if ((this.phase as Phase) === 'lost') return; // the nursery fell
    const enemiesLeft = this.spawnQueue.length > 0 || this.units.some((u) => u.side === 'enemy');
    if (!enemiesLeft) {
      // Let the last kill land before the sun comes up.
      this.clearTimer += dt;
      if (this.clearTimer >= BALANCE.night.dawnDelay) this.dawn();
    } else this.clearTimer = 0;
    if (enemiesLeft && this.time >= BALANCE.night.maxSeconds) {
      // Stragglers at sunrise slip into the cave.
      for (const u of this.units) if (u.side === 'enemy' && !u.dead) this.leak(u);
      this.spawnQueue = [];
      if (this.cave.hp <= 0) {
        this.cave.hp = 0;
        this.phase = 'lost';
      } else this.dawn();
    }
  }

  // ---------------- Internals ----------------

  private makeSlots(): Slot[] {
    const slots: Slot[] = [];
    for (let row = 0; row < F.roostRows; row++) {
      for (let col = 0; col < F.cols; col++) {
        slots.push({ idx: slots.length, col, row, x: col + 0.5, y: F.roostTopY + row + 0.5, terrain: null, roost: null });
      }
    }
    // 3–4 terrain tiles, never two of the same type, weighted by the biome.
    const weights: Record<string, number> = { ...(BIOME_BY_ID[this.cfg.biome ?? '']?.terrain ?? BIOMES[0].terrain) };
    const types: TerrainId[] = [];
    for (let k = this.rng.int(3, 4); k > 0 && Object.values(weights).some((w) => w > 0); k--) {
      const t = this.rng.weighted(weights) as TerrainId;
      types.push(t);
      weights[t] = 0;
    }
    const spots = this.rng.shuffle([...slots]);
    types.forEach((t, i) => (spots[i].terrain = t));
    return slots;
  }

  private planNight(n: number): NightGroup[] {
    const enc = this.encounter;
    let budget = (enc.budget.first + enc.budget.perNight * (n - 1)) * (1 + this.mods.wavePct / 100);
    const groups: NightGroup[] = [];
    if (n === this.nights && enc.finale) {
      for (const id of enc.finale) groups.push({ enemy: id, count: 1, col: this.rng.int(1, 3) });
    }
    const pool = enc.pool.filter((p) => (p.minNight ?? 1) <= n);
    for (let tries = 0; tries < 30 && groups.length < 5; tries++) {
      const affordable = pool.filter((p) => ENEMY_BY_ID[p.enemy].threat <= budget);
      if (!affordable.length) break;
      const id = this.rng.weighted(Object.fromEntries(affordable.map((p) => [p.enemy, p.weight])));
      const threat = ENEMY_BY_ID[id].threat;
      const max = Math.min(6, Math.floor(budget / threat));
      const count = this.rng.int(Math.ceil(max / 2), max);
      budget -= count * threat;
      const col = this.rng.int(0, F.cols - 1);
      const same = groups.find((g) => g.enemy === id && g.col === col);
      if (same) same.count += count;
      else groups.push({ enemy: id, count, col });
    }
    return groups;
  }

  private newRoost(slot: Slot, bp: UnitBlueprint, bonusLevels = 0) {
    slot.roost = { batId: bp.batId, bp, level: 1, hp: 0, maxHp: 0, respawnTimer: 0, ruined: false, glass: [] };
    slot.roost.maxHp = this.roostMaxHp(slot);
    slot.roost.hp = slot.roost.maxHp;
    if (this.passive.startLevel + bonusLevels) this.levelUp(slot, this.passive.startLevel + bonusLevels, false);
    this.effects.push({ kind: 'place', x: slot.x, y: slot.y, r: 0.6, t: this.clock });
  }

  private roostMaxHp(slot: Slot): number {
    const r = slot.roost!;
    let hp = r.bp.roost.hp * (1 + (L.hpPct * (r.level - 1)) / 100) * (1 + this.passive.hpPct / 100);
    if (slot.terrain === 'fig' && this.terrainMatches(slot.idx, r.batId)) hp *= 1.5;
    return Math.round(hp);
  }

  /** Raise a roost's level; the extra max HP is added to its current HP. */
  private levelUp(slot: Slot, by: number, fx = true) {
    const r = slot.roost!;
    const before = r.level;
    r.level += by;
    if (r.level === before) return;
    const oldMax = r.maxHp;
    r.maxHp = this.roostMaxHp(slot);
    r.hp = Math.max(1, Math.min(r.maxHp, r.hp + r.maxHp - oldMax));
    if (fx) {
      this.effects.push({ kind: 'level', x: slot.x, y: slot.y, r: 0.5, t: this.clock });
      this.floats.push({ x: slot.x, y: slot.y, text: r.level === L.megaLevel ? 'MEGA!' : r.level === L.armorLevel ? 'ARMOURED!' : `Lv${r.level}`, color: '#ffe14a', t: this.clock });
    }
  }

  /** The result of a merge: +1 level here, then +1 to every roost in this bat's pattern (no chaining). */
  private mergeUp(slot: Slot) {
    this.levelUp(slot, 1);
    if (this.rule.mergeRefund) this.gain(slot, this.rule.mergeRefund);
    const bumped = this.firePattern(slot);
    if (this.charms.has('windfall') && bumped.length >= 2) this.gain(slot, 2);
    // Ripple: each bumped roost fires its own pattern once (no further chaining).
    if (this.charms.has('ripple')) for (const b of bumped) this.firePattern(b, slot);
    this.track();
  }

  /** +1 to every standing roost in this roost's pattern. Returns the roosts bumped. */
  private firePattern(slot: Slot, skip?: Slot): Slot[] {
    const out: Slot[] = [];
    for (const t of this.patternTiles(slot.idx, slot.roost!.batId)) {
      if (!t.roost || t.roost.ruined || t.roost.nursery || t === skip) continue;
      this.levelUp(t, 1);
      out.push(t);
    }
    return out;
  }

  private gain(slot: Slot, n: number) {
    this.guano += n;
    this.floats.push({ x: slot.x, y: slot.y + 0.3, text: `+${n} guano`, color: '#d8c27a', t: this.clock });
  }

  /** Dusk effects from charms and the boss rule. */
  private duskCharms() {
    const standing = this.slots.filter((s) => s.roost && !s.roost.ruined && !s.roost.nursery);
    if (this.charms.has('vanguard')) {
      const front = standing.filter((s) => s.row === 0);
      if (front.length) this.levelUp(this.rng.pick(front), 1);
    }
    const top = () => standing.reduce<Slot | null>((b, s) => (!b || s.roost!.level > b.roost!.level ? s : b), null);
    if (this.charms.has('beacon')) {
      const t = top();
      if (t) this.firePattern(t);
    }
    if (this.cfg.bossRule === 'hawk_eye') {
      const t = top();
      if (t && t.roost!.level > 1) {
        this.levelUp(t, -1, false);
        this.floats.push({ x: t.x, y: t.y, text: 'Hawk! -1', color: '#ff9a7a', t: this.clock });
      }
    }
  }

  /** Star-goal bookkeeping. */
  private track() {
    const rs = this.slots.filter((s) => s.roost && !s.roost.nursery);
    this.tally.maxRoosts = Math.max(this.tally.maxRoosts, rs.length);
    for (const s of rs) this.tally.maxLevel = Math.max(this.tally.maxLevel, s.roost!.level);
  }

  /** Nursery objective: a sturdy roost with no bats on the middle tile of the middle row. */
  private placeNursery() {
    const slot = this.slots.find((s) => s.row === 1 && s.col === 2)!;
    slot.terrain = null;
    const bp = { ...blueprint('fledgling', undefined), name: 'Nursery' };
    slot.roost = { batId: 'fledgling', bp, level: 1, hp: 600, maxHp: 600, respawnTimer: 0, ruined: false, glass: [], nursery: true };
  }

  batsPerRoost(r: Roost): number {
    if (r.nursery) return 0;
    if (this.isMega(r)) return 1;
    return r.bp.roost.count + Math.min(L.maxExtraBats, (r.level - 1) * L.batsPerLevel) + (this.charms.has('big_family') && r.level >= 3 ? 1 : 0);
  }

  /** Each roost tops its bats back up, one at a time, on its own cooldown (mega bats: only after death). */
  private respawnBats(dt: number) {
    for (const slot of this.slots) {
      const r = slot.roost;
      if (!r || r.ruined) continue;
      const out = this.units.filter((u) => u.side === 'bat' && !u.dead && u.home === slot.idx).length;
      if (out >= this.batsPerRoost(r)) {
        r.respawnTimer = 0;
        continue;
      }
      r.respawnTimer += dt;
      if (r.respawnTimer >= this.respawnTime(r)) {
        r.respawnTimer = 0;
        const n = Math.min(this.isMega(r) ? 1 : r.bp.roost.batch, this.batsPerRoost(r) - out);
        for (let k = 0; k < n; k++) this.spawnBat(slot, slot.x + (k - (n - 1) / 2) * 0.2, slot.y - 0.3);
      }
    }
  }

  respawnTime(r: Roost): number {
    return r.bp.roost.respawn * (this.isMega(r) ? L.megaRespawnMult : 1);
  }

  private fillPool() {
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i]) continue;
      if (!this.drawPile.length) {
        if (!this.discard.length) return;
        this.drawPile = this.rng.shuffle(this.discard);
        this.discard = [];
      }
      this.pool[i] = this.drawPile.shift()!;
    }
  }

  /**
   * Bats housed in roosts (their full group size), which is what produces guano.
   * `standingOnly`: roosts wrecked tonight produce nothing.
   */
  housedBats(standingOnly = false): number {
    let n = 0;
    for (const s of this.slots) if (s.roost && !(standingOnly && s.roost.ruined)) n += this.batsPerRoost(s.roost);
    return n;
  }

  /** What tomorrow's dawn would pay if no roost were wrecked tonight (Scavenger kills not included). */
  projectedIncome(): number {
    return Math.max(0, E.perDawn + this.mods.guanoPerDawn) + Math.floor(this.housedBats() / E.batsPerGuano) + this.passive.guanoPerDawn
      + this.clusterGuano(this.formations());
  }

  private dawn() {
    // Income is counted before wrecked roosts are rebuilt.
    const wreckedIncome = this.cfg.bossRule === 'drought' ? 0 : Math.floor(this.housedBats(true) / E.batsPerGuano);
    for (const u of this.units) if (u.side === 'bat') u.dead = true;
    this.units = [];
    this.spawnQueue = [];
    // Roosts wrecked in the night are rebuilt by morning, at the same level.
    for (const slot of this.slots) {
      const r = slot.roost;
      if (!r?.ruined) continue;
      r.ruined = false;
      if (this.charms.has('phoenix')) {
        if (r.level > 1) this.levelUp(slot, -1, false);
        r.hp = r.maxHp;
      } else r.hp = Math.round((r.maxHp * BALANCE.rebuildHpPct) / 100);
      this.effects.push({ kind: 'place', x: slot.x, y: slot.y, r: 0.6, t: this.clock });
    }
    for (const slot of this.slots) {
      const r = slot.roost;
      if (!r || !BAT_BY_ID[r.batId].clans.includes('SAN')) continue;
      // Vampire bats regurgitate blood for hungry roost-mates: neighbours heal at dawn.
      for (const n of this.neighbours(slot)) {
        if (!n.roost || n.roost.ruined || n.roost.hp >= n.roost.maxHp) continue;
        const before = n.roost.hp;
        n.roost.hp = Math.min(n.roost.maxHp, n.roost.hp + (n.roost.maxHp * BALANCE.adjacency.vampireDawnHealPct) / 100);
        this.floats.push({ x: n.x, y: n.y, text: `🩸+${Math.round(n.roost.hp - before)}`, color: '#ff8aa0', t: this.clock });
        this.effects.push({ kind: 'heal', x: n.x, y: n.y, r: 0.4, t: this.clock });
      }
    }
    // Feeding Roost: the night's best hunters level up.
    if (this.rule.feedingRoost && this.killsBy.size) {
      const [idx] = [...this.killsBy].reduce((a, b) => (b[1] > a[1] ? b : a));
      const slot = this.slots[idx];
      if (slot.roost && !slot.roost.nursery) {
        this.levelUp(slot, 1);
        this.floats.push({ x: slot.x, y: slot.y - 0.3, text: 'Feeding Roost!', color: '#ff8aa0', t: this.clock });
      }
    }
    if (this.day >= this.nights) {
      this.phase = 'won';
      return;
    }
    this.lastIncomeParts = {
      base: Math.max(0, E.perDawn + this.mods.guanoPerDawn),
      roosts: wreckedIncome,
      kills: this.charms.has('scavenger') ? Math.floor(this.kills / 3) : 0,
      charms: this.passive.guanoPerDawn,
      clans: this.clusterGuano(this.nightFormations),
      interest: this.interestNow(),
    };
    const p = this.lastIncomeParts;
    this.lastInterest = p.interest;
    this.lastIncome = p.base + p.roosts + p.kills + p.charms + p.clans + p.interest;
    this.freeRerolls = this.charms.has('thrift') ? 1 : 0;
    this.guano += this.lastIncome;
    this.day++;
    this.fillPool();
    this.drawSpells(BALANCE.spells.perDawn);
    this.phase = 'day';
  }

  /** A roost at 0 HP is wrecked for the rest of the night; dawn rebuilds it. */
  private ruinRoost(slot: Slot) {
    const r = slot.roost!;
    if (r.nursery) {
      r.ruined = true;
      r.hp = 0;
      this.floats.push({ x: slot.x, y: slot.y, text: 'NURSERY LOST', color: '#ff5050', t: this.clock });
      this.phase = 'lost';
      return;
    }
    // Glass cards in the roost shatter: gone from the deck for good.
    if (r.glass.length) {
      this.shattered.push(...r.glass);
      const gone = new Set(r.glass);
      this.drawPile = this.drawPile.filter((c) => !gone.has(c.uid));
      this.discard = this.discard.filter((c) => !gone.has(c.uid));
      this.pool = this.pool.map((c) => (c && gone.has(c.uid) ? null : c));
      this.floats.push({ x: slot.x, y: slot.y - 0.2, text: 'GLASS SHATTERS', color: '#c8a8ff', t: this.clock });
      r.glass = [];
    }
    r.ruined = true;
    r.hp = 0;
    r.respawnTimer = 0;
  }

  private batBlueprint(card: Card): UnitBlueprint {
    return blueprint(card.id, this.cfg.roster[card.id], isSharp(card));
  }

  private neighbours(s: Slot): Slot[] {
    return this.slots.filter((o) => Math.abs(o.col - s.col) + Math.abs(o.row - s.row) === 1);
  }

  private modsFor(slot: Slot): Mods {
    const r = slot.roost!;
    const m: Mods = { atkPct: this.passive.atkPct, hastePct: 0, lifesteal: 0, auraMult: 1 };
    if (r.glass.length) m.atkPct += this.charms.has('glazier') ? 120 : 60;
    const f = this.nightSlots.get(slot.idx);
    if (f?.has('pair')) m.atkPct += this.formationValue('pair');
    if (f?.has('line')) m.hastePct += this.formationValue('line');
    if (this.terrainMatches(slot.idx, r.batId)) {
      if (slot.terrain === 'pond') m.atkPct += 40;
      if (slot.terrain === 'lamp') m.hastePct += 35;
      if (slot.terrain === 'pen') m.lifesteal += 25;
      if (slot.terrain === 'cactus') m.auraMult = 1.5;
    }
    return m;
  }

  private toTiles(s: Stats, side: Unit['side']): Stats {
    const speed = side === 'bat' ? s.speed * U.batSpeed * (1 + this.passive.speedPct / 100) : s.speed * U.enemySpeed;
    return { ...s, range: Math.max(U.minMelee, s.range / U.rangePerTile), speed };
  }

  private addUnit(p: Pick<Unit, 'side' | 'defId' | 'x' | 'y' | 'stats' | 'traits' | 'mods' | 'home' | 'mega' | 'armored'>): Unit {
    const k = p.stats.knockbacks;
    const u: Unit = {
      id: this.nextId++,
      hp: p.stats.hp,
      maxHp: p.stats.hp,
      atkTimer: 0.3,
      stunTimer: 0,
      knockTimer: 0,
      kbThresholds: p.side === 'enemy' ? Array.from({ length: Math.max(0, k - 1) }, (_, i) => (p.stats.hp * (k - 1 - i)) / k) : [],
      healTimer: 0,
      sinceAttack: 99,
      dead: false,
      aimX: p.x,
      aimY: p.y,
      ...p,
    };
    this.units.push(u);
    return u;
  }

  /** A bat leaves a roost, with stats from the roost's level (or a level-10 mega bat). */
  private spawnBat(slot: Slot, x: number, y: number) {
    const r = slot.roost!;
    const bp = r.bp;
    const lvl = 1 + (L.statPct * (r.level - 1)) / 100;
    let hp = bp.stats.hp * lvl * (1 + this.passive.hpPct / 100);
    let atk = bp.stats.atk * lvl;
    const mega = this.isMega(r);
    const armored = r.level >= L.armorLevel;
    if (mega) {
      const group = bp.roost.count + L.maxExtraBats;
      hp *= group * L.megaHpMult;
      atk *= group * L.megaAtkMult;
    }
    if (slot.terrain === 'fig' && this.terrainMatches(slot.idx, bp.batId)) hp *= 1.3;
    if (this.nightSlots.get(slot.idx)?.has('column')) hp *= 1 + this.formationValue('column') / 100;
    this.addUnit({
      side: 'bat', defId: bp.batId, x, y, home: slot.idx, mods: this.modsFor(slot), mega, armored,
      stats: this.toTiles({ ...bp.stats, hp: Math.round(hp), atk: Math.round(atk) }, 'bat'),
      traits: bp.traits,
    });
  }

  /** Summoned by spells: no home roost, level 1. */
  private spawnLooseBat(bp: UnitBlueprint, x: number, y: number) {
    this.addUnit({
      side: 'bat', defId: bp.batId, x, y, home: null, mods: { ...NO_MODS, atkPct: this.passive.atkPct }, mega: false, armored: false,
      stats: this.toTiles({ ...bp.stats, hp: Math.round(bp.stats.hp * (1 + this.passive.hpPct / 100)) }, 'bat'),
      traits: bp.traits,
    });
  }

  private spawnEnemy(id: string, x: number) {
    const def = ENEMY_BY_ID[id];
    const m = this.enemyMult;
    const s = { ...def.stats, hp: Math.round(def.stats.hp * m), atk: Math.round(def.stats.atk * m) };
    this.addUnit({ side: 'enemy', defId: id, x, y: -0.3, stats: this.toTiles(s, 'enemy'), traits: def.traits, mods: NO_MODS, home: null, mega: false, armored: false });
  }

  private computeAuras(bats: Unit[]) {
    const atk = new Map<number, number>();
    const haste = new Map<number, number>();
    for (const src of bats) {
      for (const t of src.traits) {
        if (t.kind !== 'atkAura' && t.kind !== 'hasteAura') continue;
        const map = t.kind === 'atkAura' ? atk : haste;
        const r = t.radius / U.rangePerTile;
        const pct = t.pct * src.mods.auraMult;
        for (const b of bats) {
          if (b !== src && dist(b, src) <= r) map.set(b.id, Math.max(map.get(b.id) ?? 0, pct));
        }
      }
    }
    return { atk, haste };
  }

  private batTick(u: Unit, enemies: Unit[], alive: Unit[], auras: { atk: Map<number, number>; haste: Map<number, number> }, dt: number) {
    const heal = u.traits.find((t) => t.kind === 'healAura');
    if (heal && heal.kind === 'healAura') {
      u.healTimer += dt;
      if (u.healTimer >= heal.every) {
        u.healTimer = 0;
        const r = heal.radius / U.rangePerTile;
        for (const a of alive) if (a.side === 'bat' && !a.dead && dist(a, u) <= r && a.hp < a.maxHp) this.heal(a, heal.amount * u.mods.auraMult);
      }
    }

    let range = u.stats.range;
    for (const e of enemies) {
      const j = e.traits.find((t) => t.kind === 'jammer');
      if (j && j.kind === 'jammer' && !e.dead && dist(e, u) <= j.radius / U.rangePerTile) range = Math.max(U.minMelee, range * (1 - j.pct / 100));
    }

    let target: Unit | null = null;
    let best = Infinity;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = dist(e, u);
      if (d < best) { best = d; target = e; }
    }
    const haste = 1 + ((auras.haste.get(u.id) ?? 0) + u.mods.hastePct) / 100 + (this.time < this.buffs.hasteUntil ? this.buffs.hastePct / 100 : 0);
    u.atkTimer = Math.max(0, u.atkTimer - dt * haste);

    if (!target) {
      const home = u.home !== null ? this.slots[u.home] : { x: 2.5, y: F.caveY - 0.6 };
      this.moveToward(u, home.x, home.y - 0.3, u.stats.speed * 0.6 * dt, 0.05);
      return;
    }
    if (best > range) {
      this.moveToward(u, target.x, target.y, u.stats.speed * dt, range * 0.9);
      return;
    }
    if (u.atkTimer > 0) return;

    let hits: Unit[];
    const multi = u.traits.find((t) => t.kind === 'multiHit');
    if (u.traits.some((t) => t.kind === 'aoe')) hits = enemies.filter((e) => !e.dead && dist(e, target!) <= 0.6);
    else if (multi && multi.kind === 'multiHit') hits = enemies.filter((e) => !e.dead && dist(e, u) <= range).sort((a, b) => dist(a, u) - dist(b, u)).slice(0, multi.targets);
    else hits = [target];

    let atkPct = (auras.atk.get(u.id) ?? 0) + u.mods.atkPct;
    let lifesteal = u.mods.lifesteal;
    const ls = u.traits.find((t) => t.kind === 'lifesteal');
    if (ls && ls.kind === 'lifesteal') lifesteal += ls.pct;
    if (this.time < this.buffs.atkUntil) {
      atkPct += this.buffs.atkPct;
      lifesteal += this.buffs.lifesteal;
    }
    const dmg = u.stats.atk * (1 + atkPct / 100);
    const kc = u.traits.find((t) => t.kind === 'knockChance');
    let dealt = 0;
    for (const h of hits) {
      const alive = !h.dead;
      dealt += this.damage(h, dmg);
      if (alive && h.dead && u.home !== null) this.killsBy.set(u.home, (this.killsBy.get(u.home) ?? 0) + 1);
      if (kc && kc.kind === 'knockChance' && !h.dead && this.rng.next() < kc.chance) this.knock(h);
    }
    const style = attackStyle(u.traits, u.stats.range * U.rangePerTile);
    const color = CLAN_COLOR[BAT_BY_ID[u.defId]?.clans[0] ?? ''] ?? '#d8d0e8';
    for (const hit of style === 'splash' ? [target] : hits) this.strikes.push({ fx: u.x, fy: u.y, tx: hit.x, ty: hit.y, style, color, t: this.clock });
    if (lifesteal > 0 && dealt > 0) {
      this.heal(u, (dealt * lifesteal) / 100, false);
      this.strikes.push({ fx: target.x, fy: target.y, tx: u.x, ty: u.y, style: 'drain', color: '#ff4060', t: this.clock });
    }
    u.atkTimer = u.stats.rate;
    u.sinceAttack = 0;
    u.aimX = target.x;
    u.aimY = target.y;
  }

  private enemyTick(u: Unit, bats: Unit[], dt: number) {
    u.atkTimer = Math.max(0, u.atkTimer - dt);
    const range = u.stats.range;

    // 1. Bats in reach.
    let bat: Unit | null = null;
    let best = Infinity;
    for (const b of bats) {
      if (b.dead) continue;
      const d = dist(b, u);
      if (d <= range + 0.1 && d < best) { best = d; bat = b; }
    }
    // 2. A roost blocking this enemy's column.
    let roostSlot: Slot | null = null;
    if (!bat) {
      for (const s of this.slots) {
        if (!s.roost || s.roost.ruined || Math.abs(s.x - u.x) > 0.5 || s.y < u.y) continue;
        if (s.y - 0.35 - u.y <= range && (!roostSlot || s.y < roostSlot.y)) roostSlot = s;
      }
    }
    // 3. The cave.
    const atCave = !bat && !roostSlot && F.caveY - u.y <= range;

    if (!bat && !roostSlot && !atCave) {
      u.y += u.stats.speed * dt;
      return;
    }
    if (u.atkTimer > 0) return;
    const dmg = u.stats.atk;
    if (bat) {
      const hits = u.traits.some((t) => t.kind === 'aoe') ? bats.filter((b) => !b.dead && dist(b, bat!) <= 0.6) : [bat];
      for (const h of hits) this.damage(h, dmg);
      this.strikes.push({ fx: u.x, fy: u.y, tx: bat.x, ty: bat.y, style: range > 0.8 ? 'enemyShot' : 'enemy', color: '#ff6a5a', t: this.clock });
      u.aimX = bat.x;
      u.aimY = bat.y;
    } else if (roostSlot) {
      const r = roostSlot.roost!;
      const shield = this.nightSlots.get(roostSlot.idx)?.has('full_row') ? this.formationValue('full_row') / 100 : 0;
      r.hp -= dmg * (1 - shield);
      this.floats.push({ x: roostSlot.x, y: roostSlot.y, text: `${Math.round(dmg)}`, color: '#ffb070', t: this.clock });
      if (r.hp <= 0) {
        this.effects.push({ kind: 'death', x: roostSlot.x, y: roostSlot.y, r: 0.6, t: this.clock });
        this.ruinRoost(roostSlot);
      }
      u.aimX = roostSlot.x;
      u.aimY = roostSlot.y;
    } else {
      this.leak(u);
      return;
    }
    u.atkTimer = u.stats.rate;
    u.sinceAttack = 0;
  }

  /** The enemy gets into the cave: one heavy hit, then it's gone. */
  private leak(u: Unit) {
    const dmg = u.stats.atk * BALANCE.night.leakMult;
    this.tally.leaks++;
    this.cave.hp -= dmg;
    this.floats.push({ x: u.x, y: F.caveY, text: `-${Math.round(dmg)}`, color: '#ff5050', t: this.clock });
    this.effects.push({ kind: 'blast', x: u.x, y: F.caveY, r: 0.4, t: this.clock });
    u.dead = true;
  }

  private moveToward(u: Unit, x: number, y: number, step: number, stopAt: number) {
    const dx = x - u.x;
    const dy = y - u.y;
    const d = Math.hypot(dx, dy);
    if (d <= stopAt || d === 0) return;
    const m = Math.min(step, d - stopAt);
    u.x = clamp(u.x + (dx / d) * m, 0.1, F.cols - 0.1);
    u.y = clamp(u.y + (dy / d) * m, -0.5, F.caveY);
  }

  private damage(t: Unit, amount: number): number {
    if (t.dead) return 0;
    if (t.armored) amount *= 1 - L.armorPct / 100;
    const dealt = Math.min(t.hp, amount);
    t.hp -= amount;
    this.floats.push({ x: t.x, y: t.y, text: `${Math.round(amount)}`, color: t.side === 'bat' ? '#ff7a7a' : '#ffffff', t: this.clock });
    if (t.hp <= 0) {
      this.kill(t);
      return dealt;
    }
    let knocked = false;
    while (t.kbThresholds.length && t.hp <= t.kbThresholds[0]) {
      t.kbThresholds.shift();
      knocked = true;
    }
    if (knocked) this.knock(t);
    return dealt;
  }

  private knock(t: Unit) {
    if (t.side !== 'enemy') return;
    t.knockTimer = BALANCE.knockback.duration;
    t.atkTimer = Math.max(t.atkTimer, 0.3);
  }

  private kill(t: Unit) {
    t.dead = true;
    if (t.side === 'enemy') this.kills++;
    t.hp = 0;
    this.effects.push({ kind: 'death', x: t.x, y: t.y, r: 0.3, t: this.clock });
    const dh = t.traits.find((x) => x.kind === 'deathHeal');
    if (dh && dh.kind === 'deathHeal') {
      const r = dh.radius / U.rangePerTile;
      this.effects.push({ kind: 'heal', x: t.x, y: t.y, r, t: this.clock });
      for (const a of this.units) if (a.side === t.side && !a.dead && dist(a, t) <= r) this.heal(a, dh.amount);
    }
  }

  private heal(u: Unit, amount: number, show = true) {
    const before = u.hp;
    u.hp = Math.min(u.maxHp, u.hp + amount);
    const got = u.hp - before;
    if (show && got >= 1) this.floats.push({ x: u.x, y: u.y, text: `+${Math.round(got)}`, color: '#7dff9a', t: this.clock });
  }

  /** The enemy closest to the cave. */
  private frontEnemy(): Unit | null {
    let best: Unit | null = null;
    for (const u of this.units) if (u.side === 'enemy' && !u.dead && (!best || u.y > best.y)) best = u;
    return best;
  }

  private castSpell(eff: SpellEffect, up: boolean) {
    const amt = up ? 1.4 : 1;
    const dur = up ? 1.3 : 1;
    const enemies = () => this.units.filter((u) => u.side === 'enemy' && !u.dead);
    const c = this.clock;
    switch (eff.kind) {
      case 'damageFront': {
        const f = this.frontEnemy();
        if (!f) break;
        this.effects.push({ kind: 'blast', x: f.x, y: f.y, r: eff.radius, t: c });
        for (const e of enemies()) if (dist(e, f) <= eff.radius) this.damage(e, eff.amount * amt);
        break;
      }
      case 'damageStrongest': {
        const es = enemies();
        if (!es.length) break;
        const t = es.reduce((a, b) => (b.hp > a.hp ? b : a));
        this.effects.push({ kind: 'blast', x: t.x, y: t.y, r: 0.4, t: c });
        this.damage(t, eff.amount * amt);
        break;
      }
      case 'stunFront': {
        const f = this.frontEnemy();
        if (!f) break;
        this.effects.push({ kind: 'stun', x: f.x, y: f.y, r: eff.radius, t: c });
        for (const e of enemies()) if (dist(e, f) <= eff.radius) e.stunTimer = Math.max(e.stunTimer, eff.seconds * dur);
        break;
      }
      case 'slowAll':
        this.buffs.slowPct = eff.pct;
        this.buffs.slowUntil = this.time + eff.seconds * dur;
        this.effects.push({ kind: 'slow', x: 2.5, y: 4, r: 5, t: c });
        break;
      case 'healAll':
        for (const u of this.units) if (u.side === 'bat' && !u.dead) this.heal(u, (u.maxHp * eff.pct * amt) / 100);
        for (const s of this.slots) if (s.roost && !s.roost.ruined) s.roost.hp = Math.min(s.roost.maxHp, s.roost.hp + (s.roost.maxHp * eff.pct * amt) / 100);
        this.cave.hp = Math.min(this.cave.max, this.cave.hp + eff.caveHeal * amt);
        this.effects.push({ kind: 'heal', x: 2.5, y: 7.5, r: 2.5, t: c });
        break;
      case 'buffAll':
        this.buffs.atkPct = eff.atkPct * amt;
        this.buffs.lifesteal = eff.lifesteal;
        this.buffs.atkUntil = this.time + eff.seconds * dur;
        this.effects.push({ kind: 'buff', x: 2.5, y: 6, r: 3, t: c });
        break;
      case 'hasteAll':
        this.buffs.hastePct = eff.pct * amt;
        this.buffs.hasteUntil = this.time + eff.seconds * dur;
        this.guano += eff.energy;
        this.effects.push({ kind: 'buff', x: 2.5, y: 6, r: 3, t: c });
        break;
      case 'summon': {
        const bp = blueprint(eff.batId, this.cfg.roster[eff.batId]);
        const n = Math.round(eff.count * amt);
        for (let k = 0; k < n; k++) this.spawnLooseBat(bp, 1 + (k / Math.max(1, n - 1)) * 3, F.caveY - 0.4);
        break;
      }
    }
  }
}

const CLAN_COLOR: Record<string, string> = Object.fromEntries(CLAN_ORDER.map((c) => [c, CLANS[c].color]));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
