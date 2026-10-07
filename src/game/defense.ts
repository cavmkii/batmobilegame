import { BALANCE } from '../data/balance';
import { BAT_BY_ID } from '../data/bats';
import { ENCOUNTERS, ENEMY_BY_ID, type Encounter } from '../data/enemies';
import { RELIC_BY_ID } from '../data/relics';
import { SPELL_BY_ID } from '../data/spells';
import { TERRAIN, TERRAIN_IDS } from '../data/terrain';
import type { Card, SpellEffect, Stats, TerrainId, Trait } from '../data/types';
import { blueprint, type OwnedBat, type UnitBlueprint } from './progression';
import { Rng } from './rng';

const F = BALANCE.field;
const U = BALANCE.units;
const E = BALANCE.economy;
const L = BALANCE.roostLevel;

export interface DefenseConfig {
  encounterId: string;
  row: number;
  deck: Card[];
  commanderId: string;
  roster: Record<string, OwnedBat>;
  relics: string[];
  caveHp: number;
  caveMax: number;
  seed: number;
}

export interface Roost {
  batId: string;
  isCommander: boolean;
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

/** Per-bat bonuses from terrain and relics, fixed when the bat leaves its roost. */
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
  commander: boolean;
  /** A level-10 roost's single giant bat. */
  mega: boolean;
  dead: boolean;
  /** Last attack target position, for the renderer. */
  aimX: number;
  aimY: number;
}

export interface FloatText { x: number; y: number; text: string; color: string; t: number }
export interface Effect { kind: 'blast' | 'stun' | 'heal' | 'buff' | 'slow' | 'death' | 'place' | 'level'; x: number; y: number; r: number; t: number }

export type Phase = 'day' | 'night' | 'won' | 'lost';

/** Where a pool card comes from: a pool slot index or the command zone. */
export type Source = number | 'cmd';

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
  /** Spells taken from the pool, castable as instants. */
  spells: Card[] = [];
  drawPile: Card[];
  discard: Card[] = [];
  slots: Slot[] = [];
  plans: NightGroup[][];
  units: Unit[] = [];
  floats: FloatText[] = [];
  effects: Effect[] = [];
  cave: { hp: number; max: number };
  commander: { bp: UnitBlueprint; inPlay: boolean; discount: number };
  /** Enemies killed this night (feeds the dawn guano bonus). */
  kills = 0;
  /** Guano earned at the last dawn, for the UI. */
  lastIncome = 0;
  /** Seconds into the current night (or total, for animation). */
  time = 0;
  clock = 0;
  buffs = { atkPct: 0, lifesteal: 0, atkUntil: 0, hastePct: 0, hasteUntil: 0, slowPct: 0, slowUntil: 0 };

  private nextId = 1;
  private spawnQueue: { at: number; enemy: string; x: number }[] = [];
  private enemyMult: number;
  private relic = { guanoPerDawn: 0, refreshDiscount: 0, startGuano: 0, speedPct: 0, hpPct: 0, atkPct: 0, startLevel: 0 };

  constructor(private cfg: DefenseConfig) {
    const enc = ENCOUNTERS.find((e) => e.id === cfg.encounterId);
    if (!enc) throw new Error(`Unknown encounter ${cfg.encounterId}`);
    this.encounter = enc;
    this.nights = enc.nights;
    this.rng = new Rng(cfg.seed);
    this.enemyMult = 1 + BALANCE.enemyRowScaling * cfg.row;
    this.cave = { hp: cfg.caveHp, max: cfg.caveMax };

    let discount = 0;
    for (const id of cfg.relics) {
      const e = RELIC_BY_ID[id]?.effect;
      if (!e) continue;
      if (e.kind === 'commanderDiscount') discount += e.amount;
      else if (e.kind === 'speedPct' || e.kind === 'hpPct' || e.kind === 'atkPct') this.relic[e.kind] += e.pct;
      else if (e.kind !== 'healAfterBattle') this.relic[e.kind] += e.amount;
    }
    this.commander = {
      bp: blueprint(cfg.commanderId, cfg.roster[cfg.commanderId]),
      inPlay: false,
      discount,
    };

    this.slots = this.makeSlots();
    this.plans = Array.from({ length: this.nights }, (_, i) => this.planNight(i + 1));
    this.drawPile = this.rng.shuffle([...cfg.deck]);
    this.pool = Array.from({ length: E.poolSize }, () => null);
    this.fillPool();
    this.guano = E.startGuano + this.relic.startGuano;
  }

  // ---------------- Queries ----------------

  get tonight(): NightGroup[] {
    return this.plans[this.day - 1] ?? [];
  }

  get refreshCost(): number {
    return Math.max(0, E.refreshCost - this.relic.refreshDiscount);
  }

  cardCost(card: Card): number {
    return card.kind === 'bat' ? this.batBlueprint(card).cost : SPELL_BY_ID[card.id].cost;
  }

  commanderCost(): number {
    return Math.max(1, this.commander.bp.cost - this.commander.discount);
  }

  /** Can the card at `src` go on this tile: an empty tile, or a same-type roost below max level. */
  canPlace(src: Source, slotIdx: number): boolean {
    if (this.phase !== 'day') return false;
    const slot = this.slots[slotIdx];
    if (!slot) return false;
    if (src === 'cmd') return !slot.roost && !this.commander.inPlay && this.guano >= this.commanderCost();
    const c = this.pool[src];
    if (!c || c.kind !== 'bat' || this.guano < this.cardCost(c)) return false;
    return !slot.roost || this.canStackOn(slot, c.id);
  }

  canStackOn(slot: Slot, batId: string): boolean {
    const r = slot.roost;
    return !!r && !r.isCommander && r.batId === batId && r.level < L.max;
  }

  canTakeSpell(i: number): boolean {
    const c = this.pool[i];
    return this.phase === 'day' && !!c && c.kind === 'spell' && this.spells.length < E.spellHandMax;
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
    return BAT_BY_ID[batId].pattern
      .map(([dc, dr]) => this.slots.find((o) => o.col === s.col + dc && o.row === s.row + dr))
      .filter((o): o is Slot => !!o);
  }

  isMega(r: Roost): boolean {
    return r.level >= L.max;
  }

  // ---------------- Day actions ----------------

  place(src: Source, slotIdx: number): boolean {
    if (!this.canPlace(src, slotIdx)) return false;
    const slot = this.slots[slotIdx];
    if (src === 'cmd') {
      this.guano -= this.commanderCost();
      this.commander.inPlay = true;
      this.newRoost(slot, this.commander.bp, true);
      return true;
    }
    const card = this.pool[src]!;
    this.pool[src] = null;
    this.guano -= this.cardCost(card);
    // Placed cards cycle back through the deck, so the same bat can be drawn again and stacked.
    this.discard.push(card);
    if (slot.roost) {
      this.levelUp(slot, 1);
      for (const t of this.patternTiles(slot.idx, card.id)) if (t.roost) this.levelUp(t, 1);
    } else {
      this.newRoost(slot, this.batBlueprint(card), false);
    }
    return true;
  }

  takeSpell(i: number): boolean {
    if (!this.canTakeSpell(i)) return false;
    this.spells.push(this.pool[i]!);
    this.pool[i] = null;
    return true;
  }

  /** Discard what's showing and draw a fresh pool. */
  refresh(): boolean {
    if (!this.canRefresh()) return false;
    this.guano -= this.refreshCost;
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
    this.castSpell(SPELL_BY_ID[card.id].effect, card.upgraded);
    this.discard.push(card);
    return true;
  }

  endDay() {
    if (this.phase !== 'day') return;
    this.phase = 'night';
    this.time = 0;
    this.kills = 0;
    this.buffs = { atkPct: 0, lifesteal: 0, atkUntil: 0, hastePct: 0, hasteUntil: 0, slowPct: 0, slowUntil: 0 };
    for (const slot of this.slots) {
      const r = slot.roost;
      if (!r) continue;
      r.respawnTimer = 0;
      if (r.ruined) continue;
      const n = this.batsPerRoost(r);
      for (let k = 0; k < n; k++) this.spawnBat(slot, slot.x + (k - (n - 1) / 2) * 0.18, slot.y - 0.3);
    }
    let t = 0.5;
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

    if (this.cave.hp <= 0) {
      this.cave.hp = 0;
      this.phase = 'lost';
      return;
    }
    const enemiesLeft = this.spawnQueue.length > 0 || this.units.some((u) => u.side === 'enemy');
    if (!enemiesLeft) this.dawn();
    else if (this.time >= BALANCE.night.maxSeconds) {
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
    // 3–4 terrain tiles, never two of the same type.
    const types = this.rng.shuffle([...TERRAIN_IDS]).slice(0, this.rng.int(3, 4));
    const spots = this.rng.shuffle([...slots]);
    types.forEach((t, i) => (spots[i].terrain = t));
    return slots;
  }

  private planNight(n: number): NightGroup[] {
    const enc = this.encounter;
    let budget = enc.budget.first + enc.budget.perNight * (n - 1);
    const groups: NightGroup[] = [];
    if (n === enc.nights && enc.finale) {
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

  private newRoost(slot: Slot, bp: UnitBlueprint, isCommander: boolean) {
    slot.roost = { batId: bp.batId, isCommander, bp, level: 1, hp: 0, maxHp: 0, respawnTimer: 0, ruined: false };
    slot.roost.maxHp = this.roostMaxHp(slot);
    slot.roost.hp = slot.roost.maxHp;
    if (this.relic.startLevel) this.levelUp(slot, this.relic.startLevel, false);
    this.effects.push({ kind: 'place', x: slot.x, y: slot.y, r: 0.6, t: this.clock });
  }

  private roostMaxHp(slot: Slot): number {
    const r = slot.roost!;
    let hp = r.bp.roost.hp * (1 + (L.hpPct * (r.level - 1)) / 100) * (1 + this.relic.hpPct / 100);
    if (slot.terrain === 'fig' && this.terrainMatches(slot.idx, r.batId)) hp *= 1.5;
    return Math.round(hp);
  }

  /** Raise a roost's level; the extra max HP is added to its current HP. */
  private levelUp(slot: Slot, by: number, fx = true) {
    const r = slot.roost!;
    const before = r.level;
    r.level = Math.min(L.max, r.level + by);
    if (r.level === before) return;
    const oldMax = r.maxHp;
    r.maxHp = this.roostMaxHp(slot);
    r.hp += r.maxHp - oldMax;
    if (fx) {
      this.effects.push({ kind: 'level', x: slot.x, y: slot.y, r: 0.5, t: this.clock });
      this.floats.push({ x: slot.x, y: slot.y, text: r.level >= L.max ? 'MEGA!' : `Lv${r.level}`, color: '#ffe14a', t: this.clock });
    }
  }

  private batsPerRoost(r: Roost): number {
    return this.isMega(r) ? 1 : r.bp.roost.count;
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
        this.spawnBat(slot, slot.x, slot.y - 0.3);
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

  private dawn() {
    for (const u of this.units) if (u.side === 'bat') u.dead = true;
    this.units = [];
    this.spawnQueue = [];
    // Roosts wrecked in the night are rebuilt by morning, at the same level.
    for (const slot of this.slots) {
      const r = slot.roost;
      if (!r?.ruined) continue;
      r.ruined = false;
      r.hp = Math.round((r.maxHp * BALANCE.rebuildHpPct) / 100);
      this.effects.push({ kind: 'place', x: slot.x, y: slot.y, r: 0.6, t: this.clock });
    }
    for (const slot of this.slots) {
      const r = slot.roost;
      if (!r || !BAT_BY_ID[r.batId].clans.includes('SAN')) continue;
      // Vampire bats regurgitate blood for hungry roost-mates.
      for (const n of this.neighbours(slot)) {
        if (n.roost && !n.roost.ruined) n.roost.hp = Math.min(n.roost.maxHp, n.roost.hp + (n.roost.maxHp * BALANCE.adjacency.vampireDawnHealPct) / 100);
      }
    }
    if (this.day >= this.nights) {
      this.phase = 'won';
      return;
    }
    this.lastIncome = E.perDawn + Math.floor(this.kills / E.killsPerGuano) + this.relic.guanoPerDawn;
    this.guano += this.lastIncome;
    this.day++;
    this.fillPool();
    this.phase = 'day';
  }

  /** A roost at 0 HP is wrecked for the rest of the night; dawn rebuilds it. */
  private ruinRoost(slot: Slot) {
    const r = slot.roost!;
    r.ruined = true;
    r.hp = 0;
    r.respawnTimer = 0;
  }

  private batBlueprint(card: Card): UnitBlueprint {
    return blueprint(card.id, this.cfg.roster[card.id], card.upgraded);
  }

  private neighbours(s: Slot): Slot[] {
    return this.slots.filter((o) => Math.abs(o.col - s.col) + Math.abs(o.row - s.row) === 1);
  }

  private modsFor(slot: Slot): Mods {
    const r = slot.roost!;
    const m: Mods = { atkPct: this.relic.atkPct, hastePct: 0, lifesteal: 0, auraMult: 1 };
    if (this.terrainMatches(slot.idx, r.batId)) {
      if (slot.terrain === 'pond') m.atkPct += 40;
      if (slot.terrain === 'lamp') m.hastePct += 35;
      if (slot.terrain === 'pen') m.lifesteal += 25;
      if (slot.terrain === 'cactus') m.auraMult = 1.5;
    }
    return m;
  }

  private toTiles(s: Stats, side: Unit['side']): Stats {
    const speed = side === 'bat' ? s.speed * U.batSpeed * (1 + this.relic.speedPct / 100) : s.speed * U.enemySpeed;
    return { ...s, range: Math.max(U.minMelee, s.range / U.rangePerTile), speed };
  }

  private addUnit(p: Pick<Unit, 'side' | 'defId' | 'x' | 'y' | 'stats' | 'traits' | 'mods' | 'home' | 'commander' | 'mega'>): Unit {
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
    let hp = bp.stats.hp * lvl * (1 + this.relic.hpPct / 100);
    let atk = bp.stats.atk * lvl;
    const mega = this.isMega(r);
    if (mega) {
      hp *= bp.roost.count * L.megaHpMult;
      atk *= bp.roost.count * L.megaAtkMult;
    }
    if (slot.terrain === 'fig' && this.terrainMatches(slot.idx, bp.batId)) hp *= 1.3;
    this.addUnit({
      side: 'bat', defId: bp.batId, x, y, home: slot.idx, mods: this.modsFor(slot), mega,
      commander: r.isCommander,
      stats: this.toTiles({ ...bp.stats, hp: Math.round(hp), atk: Math.round(atk) }, 'bat'),
      traits: bp.traits,
    });
  }

  /** Summoned by spells: no home roost, level 1. */
  private spawnLooseBat(bp: UnitBlueprint, x: number, y: number) {
    this.addUnit({
      side: 'bat', defId: bp.batId, x, y, home: null, mods: { ...NO_MODS, atkPct: this.relic.atkPct }, mega: false, commander: false,
      stats: this.toTiles({ ...bp.stats, hp: Math.round(bp.stats.hp * (1 + this.relic.hpPct / 100)) }, 'bat'),
      traits: bp.traits,
    });
  }

  private spawnEnemy(id: string, x: number) {
    const def = ENEMY_BY_ID[id];
    const m = this.enemyMult;
    const s = { ...def.stats, hp: Math.round(def.stats.hp * m), atk: Math.round(def.stats.atk * m) };
    this.addUnit({ side: 'enemy', defId: id, x, y: -0.3, stats: this.toTiles(s, 'enemy'), traits: def.traits, mods: NO_MODS, home: null, commander: false, mega: false });
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
      dealt += this.damage(h, dmg);
      if (kc && kc.kind === 'knockChance' && !h.dead && this.rng.next() < kc.chance) this.knock(h);
    }
    if (lifesteal > 0 && dealt > 0) this.heal(u, (dealt * lifesteal) / 100, false);
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
      const blocked = this.slots.some((s) => s.roost && !s.roost.ruined && Math.abs(s.x - u.x) <= 0.5 && s.y > u.y);
      const rushing = !blocked && u.y >= F.roostTopY - 0.5;
      u.y += u.stats.speed * (rushing ? BALANCE.night.rushMult : 1) * dt;
      return;
    }
    if (u.atkTimer > 0) return;
    const dmg = u.stats.atk;
    if (bat) {
      const hits = u.traits.some((t) => t.kind === 'aoe') ? bats.filter((b) => !b.dead && dist(b, bat!) <= 0.6) : [bat];
      for (const h of hits) this.damage(h, dmg);
      u.aimX = bat.x;
      u.aimY = bat.y;
    } else if (roostSlot) {
      const r = roostSlot.roost!;
      r.hp -= dmg;
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

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
