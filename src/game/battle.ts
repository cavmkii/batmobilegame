import { BALANCE } from '../data/balance';
import { BAT_BY_ID } from '../data/bats';
import { ENCOUNTERS, ENEMY_BY_ID, type Encounter, type WaveEntry } from '../data/enemies';
import { RELIC_BY_ID } from '../data/relics';
import { SPELL_BY_ID } from '../data/spells';
import type { Card, SpellEffect, Stats, Trait } from '../data/types';
import { blueprint, type OwnedBat, type UnitBlueprint } from './progression';
import { Rng } from './rng';

export type Side = 'player' | 'enemy';

export interface Entity {
  id: number;
  side: Side;
  kind: 'unit' | 'base';
  /** Bat id or enemy id. */
  defId: string;
  name: string;
  x: number;
  /** 0..1 visual depth offset so stacked units are readable. */
  depth: number;
  hp: number;
  maxHp: number;
  stats: Stats;
  traits: Trait[];
  atkTimer: number;
  /** HP thresholds that trigger a knockback, highest first. */
  kbThresholds: number[];
  knockTimer: number;
  stunTimer: number;
  healTimer: number;
  commander: boolean;
  /** Seconds since the last attack landed, for the renderer. */
  sinceAttack: number;
  /** Battle time at spawn, for animation phase. */
  born: number;
  dead: boolean;
}

export interface FloatText {
  x: number;
  depth: number;
  text: string;
  color: string;
  t: number;
}

export interface Effect {
  kind: 'blast' | 'stun' | 'heal' | 'buff' | 'slow' | 'death';
  x: number;
  radius: number;
  t: number;
}

export interface BattleConfig {
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

interface Spawner {
  entry: WaveEntry;
  active: boolean;
  nextAt: number;
  count: number;
}

const MAX_ENEMIES = 32;
const L = BALANCE.lane;

export class Battle {
  readonly encounter: Encounter;
  readonly rng: Rng;
  time = 0;
  entities: Entity[] = [];
  energy: number;
  maxEnergy: number;
  regen: number;
  hand: (Card | null)[];
  drawPile: Card[];
  commander: { bp: UnitBlueprint; deaths: number; alive: boolean; taxStep: number };
  result: 'won' | 'lost' | null = null;
  floats: FloatText[] = [];
  effects: Effect[] = [];
  playerBase: Entity;
  enemyBase: Entity;
  /** Timed global modifiers from spells. */
  buffs = { atkPct: 0, lifesteal: 0, atkUntil: 0, hastePct: 0, hasteUntil: 0, slowPct: 0, slowUntil: 0 };

  private nextId = 1;
  private spawners: Spawner[];
  private relicMods = { hpPct: 0, atkPct: 0, speedPct: 0 };
  private enemyMult: number;

  constructor(private cfg: BattleConfig) {
    const enc = ENCOUNTERS.find((e) => e.id === cfg.encounterId);
    if (!enc) throw new Error(`Unknown encounter ${cfg.encounterId}`);
    this.encounter = enc;
    this.rng = new Rng(cfg.seed);
    this.enemyMult = 1 + BALANCE.enemyRowScaling * cfg.row;

    let maxEnergy = BALANCE.energy.max;
    let regen = BALANCE.energy.regen;
    let start = BALANCE.energy.start;
    let handSize = BALANCE.hand.size;
    let taxStep = BALANCE.commander.tax;
    for (const id of cfg.relics) {
      const e = RELIC_BY_ID[id]?.effect;
      if (!e) continue;
      if (e.kind === 'maxEnergy') maxEnergy += e.amount;
      else if (e.kind === 'regenPct') regen *= 1 + e.pct / 100;
      else if (e.kind === 'startEnergy') start += e.amount;
      else if (e.kind === 'handSize') handSize += e.amount;
      else if (e.kind === 'commanderTax') taxStep += e.delta;
      else if (e.kind === 'hpPct') this.relicMods.hpPct += e.pct;
      else if (e.kind === 'atkPct') this.relicMods.atkPct += e.pct;
      else if (e.kind === 'speedPct') this.relicMods.speedPct += e.pct;
    }
    this.maxEnergy = maxEnergy;
    this.regen = regen;
    this.energy = Math.min(start, maxEnergy);

    this.drawPile = this.rng.shuffle([...cfg.deck]);
    this.hand = [];
    for (let i = 0; i < handSize; i++) this.hand.push(this.drawPile.shift() ?? null);

    this.commander = {
      bp: blueprint(cfg.commanderId, cfg.roster[cfg.commanderId]),
      deaths: 0,
      alive: false,
      taxStep: Math.max(0, taxStep),
    };

    const baseStats: Stats = { hp: 1, atk: 0, range: 0, rate: 1, speed: 0, knockbacks: 1 };
    this.playerBase = this.addEntity({
      side: 'player', kind: 'base', defId: 'cave', name: 'Cave', x: L.playerBaseX,
      stats: { ...baseStats, hp: cfg.caveMax }, traits: [],
    });
    this.playerBase.hp = cfg.caveHp;
    const roostHp = Math.round(enc.roostHp * this.enemyMult);
    this.enemyBase = this.addEntity({
      side: 'enemy', kind: 'base', defId: 'roost', name: 'Roost', x: L.enemyBaseX,
      stats: { ...baseStats, hp: roostHp }, traits: [],
    });

    this.spawners = enc.waves.map((entry) => ({
      entry,
      active: entry.triggerPct === undefined,
      nextAt: entry.at,
      count: 0,
    }));
  }

  // ---------------- Queries ----------------

  cardCost(card: Card): number {
    return card.kind === 'bat' ? this.batBlueprint(card).cost : SPELL_BY_ID[card.id].cost;
  }

  commanderCost(): number {
    return this.commander.bp.cost + this.commander.deaths * this.commander.taxStep;
  }

  canPlay(i: number): boolean {
    const c = this.hand[i];
    return !!c && !this.result && this.energy >= this.cardCost(c);
  }

  canDeployCommander(): boolean {
    return !this.result && !this.commander.alive && this.energy >= this.commanderCost();
  }

  // ---------------- Player actions ----------------

  playCard(i: number): boolean {
    if (!this.canPlay(i)) return false;
    const card = this.hand[i]!;
    this.energy -= this.cardCost(card);
    if (card.kind === 'bat') {
      const bp = this.batBlueprint(card);
      const swarm = bp.traits.find((t) => t.kind === 'swarm');
      const n = swarm && swarm.kind === 'swarm' ? swarm.count : 1;
      for (let k = 0; k < n; k++) this.spawnBat(bp, false, k * 12);
    } else {
      this.castSpell(SPELL_BY_ID[card.id].effect, card.upgraded);
    }
    // Rotation: played card goes to the bottom, next card fills the slot.
    this.drawPile.push(card);
    this.hand[i] = this.drawPile.shift() ?? null;
    return true;
  }

  deployCommander(): boolean {
    if (!this.canDeployCommander()) return false;
    this.energy -= this.commanderCost();
    this.spawnBat(this.commander.bp, true, 0);
    this.commander.alive = true;
    return true;
  }

  // ---------------- Simulation ----------------

  step(dt: number) {
    if (this.result) return;
    this.time += dt;
    this.energy = Math.min(this.maxEnergy, this.energy + this.regen * dt);
    this.runSpawners();

    const alive = this.entities.filter((e) => !e.dead);
    const auras = this.computeAuras(alive);
    const slow = this.time < this.buffs.slowUntil ? 1 - this.buffs.slowPct / 100 : 1;

    for (const e of alive) {
      if (e.dead || e.kind === 'base') continue;
      e.sinceAttack += dt;
      const timeScale = e.side === 'enemy' ? slow : 1;

      if (e.knockTimer > 0) {
        e.knockTimer -= dt;
        const back = (BALANCE.knockback.distance / BALANCE.knockback.duration) * dt;
        e.x = this.clampX(e.x + (e.side === 'player' ? back : -back));
        continue;
      }
      if (e.stunTimer > 0) {
        e.stunTimer -= dt;
        continue;
      }

      this.tickHealAura(e, alive, dt);

      const targets = this.targetsInRange(e, alive);
      const haste = e.side === 'player' ? 1 + (auras.haste.get(e.id) ?? 0) / 100 + this.globalHaste() : 1;
      e.atkTimer = Math.max(0, e.atkTimer - dt * haste * timeScale);
      if (targets.length) {
        if (e.atkTimer <= 0) this.attack(e, targets, auras.atk.get(e.id) ?? 0);
      } else {
        const speed = e.stats.speed * timeScale * (e.side === 'player' ? 1 + this.relicMods.speedPct / 100 : 1);
        e.x = this.clampX(e.x + (e.side === 'player' ? -speed : speed) * dt);
      }
    }

    this.entities = this.entities.filter((e) => !e.dead);
    this.floats = this.floats.filter((f) => this.time - f.t < 1.2);
    this.effects = this.effects.filter((f) => this.time - f.t < 0.8);

    if (this.enemyBase.hp <= 0) this.result = 'won';
    else if (this.playerBase.hp <= 0) this.result = 'lost';
  }

  // ---------------- Internals ----------------

  private batBlueprint(card: Card): UnitBlueprint {
    return blueprint(card.id, this.cfg.roster[card.id], card.upgraded);
  }

  private addEntity(p: Pick<Entity, 'side' | 'kind' | 'defId' | 'name' | 'x' | 'stats' | 'traits'> & { commander?: boolean }): Entity {
    const k = p.stats.knockbacks;
    const e: Entity = {
      id: this.nextId++,
      depth: this.rng.next(),
      hp: p.stats.hp,
      maxHp: p.stats.hp,
      atkTimer: 0.3,
      kbThresholds: Array.from({ length: Math.max(0, k - 1) }, (_, i) => (p.stats.hp * (k - 1 - i)) / k),
      knockTimer: 0,
      stunTimer: 0,
      healTimer: 0,
      commander: !!p.commander,
      sinceAttack: 99,
      born: this.time,
      dead: false,
      ...p,
    };
    this.entities.push(e);
    return e;
  }

  private spawnBat(bp: UnitBlueprint, commander: boolean, offset: number) {
    const hpMult = 1 + this.relicMods.hpPct / 100;
    this.addEntity({
      side: 'player', kind: 'unit', defId: bp.batId, name: bp.name, commander,
      x: L.playerSpawnX + offset,
      stats: { ...bp.stats, hp: Math.round(bp.stats.hp * hpMult) },
      traits: bp.traits,
    });
  }

  private spawnEnemy(enemyId: string) {
    const def = ENEMY_BY_ID[enemyId];
    const m = this.enemyMult;
    this.addEntity({
      side: 'enemy', kind: 'unit', defId: def.id, name: def.name, x: L.enemySpawnX,
      stats: { ...def.stats, hp: Math.round(def.stats.hp * m), atk: Math.round(def.stats.atk * m) },
      traits: def.traits,
    });
  }

  private runSpawners() {
    const roostPct = this.enemyBase.hp / this.enemyBase.maxHp;
    const enemyCount = this.entities.filter((e) => e.side === 'enemy' && e.kind === 'unit').length;
    for (const s of this.spawners) {
      if (!s.active && s.entry.triggerPct !== undefined && roostPct <= s.entry.triggerPct) {
        s.active = true;
        s.nextAt = this.time;
      }
      if (!s.active) continue;
      const max = s.entry.max ?? 1;
      if (s.count >= max || this.time < s.nextAt) continue;
      if (enemyCount >= MAX_ENEMIES) continue;
      this.spawnEnemy(s.entry.enemy);
      s.count++;
      s.nextAt += s.entry.every ?? Infinity;
    }
  }

  private clampX(x: number) {
    return Math.min(L.playerBaseX, Math.max(L.enemyBaseX, x));
  }

  /** Distance in front of `e` to `o` (negative = behind). */
  private forward(e: Entity, o: Entity) {
    return e.side === 'player' ? e.x - o.x : o.x - e.x;
  }

  private targetsInRange(e: Entity, alive: Entity[]): Entity[] {
    const out: { o: Entity; d: number }[] = [];
    for (const o of alive) {
      if (o.side === e.side || o.dead) continue;
      const d = this.forward(e, o);
      if (d >= -15 && d <= e.stats.range) out.push({ o, d });
    }
    out.sort((a, b) => a.d - b.d);
    return out.map((x) => x.o);
  }

  private computeAuras(alive: Entity[]) {
    const atk = new Map<number, number>();
    const haste = new Map<number, number>();
    const players = alive.filter((e) => e.side === 'player' && e.kind === 'unit');
    for (const src of players) {
      for (const t of src.traits) {
        if (t.kind !== 'atkAura' && t.kind !== 'hasteAura') continue;
        const map = t.kind === 'atkAura' ? atk : haste;
        for (const ally of players) {
          if (ally === src || Math.abs(ally.x - src.x) > t.radius) continue;
          // Auras of the same kind don't stack: the strongest applies.
          map.set(ally.id, Math.max(map.get(ally.id) ?? 0, t.pct));
        }
      }
    }
    return { atk, haste };
  }

  private globalHaste() {
    return this.time < this.buffs.hasteUntil ? this.buffs.hastePct / 100 : 0;
  }

  private tickHealAura(e: Entity, alive: Entity[], dt: number) {
    const aura = e.traits.find((t) => t.kind === 'healAura');
    if (!aura || aura.kind !== 'healAura') return;
    e.healTimer += dt;
    if (e.healTimer < aura.every) return;
    e.healTimer = 0;
    for (const a of alive) {
      if (a.side !== e.side || a.kind !== 'unit' || a.dead) continue;
      if (Math.abs(a.x - e.x) <= aura.radius && a.hp < a.maxHp) this.heal(a, aura.amount);
    }
  }

  private attack(e: Entity, targets: Entity[], auraAtkPct: number) {
    let hits: Entity[];
    const multi = e.traits.find((t) => t.kind === 'multiHit');
    if (e.traits.some((t) => t.kind === 'aoe')) hits = targets;
    else if (multi && multi.kind === 'multiHit') hits = targets.slice(0, multi.targets);
    else hits = targets.slice(0, 1);

    let atkPct = 0;
    let lifesteal = 0;
    const ls = e.traits.find((t) => t.kind === 'lifesteal');
    if (ls && ls.kind === 'lifesteal') lifesteal += ls.pct;
    if (e.side === 'player') {
      atkPct += auraAtkPct + this.relicMods.atkPct;
      if (this.time < this.buffs.atkUntil) {
        atkPct += this.buffs.atkPct;
        lifesteal += this.buffs.lifesteal;
      }
    }
    const dmg = e.stats.atk * (1 + atkPct / 100);
    const kc = e.traits.find((t) => t.kind === 'knockChance');
    let dealt = 0;
    for (const t of hits) {
      dealt += this.damage(t, dmg);
      if (kc && kc.kind === 'knockChance' && t.kind === 'unit' && !t.dead && this.rng.next() < kc.chance) this.knock(t);
    }
    if (lifesteal > 0 && dealt > 0) this.heal(e, (dealt * lifesteal) / 100, false);
    const slow = e.side === 'enemy' && this.time < this.buffs.slowUntil ? 1 / (1 - this.buffs.slowPct / 100) : 1;
    e.atkTimer = e.stats.rate * slow;
    e.sinceAttack = 0;
  }

  /** Returns damage actually dealt. */
  private damage(t: Entity, amount: number): number {
    if (t.dead) return 0;
    const dealt = Math.min(t.hp, amount);
    t.hp -= amount;
    if (amount >= 1) {
      this.floats.push({ x: t.x, depth: t.depth, text: `${Math.round(amount)}`, color: t.side === 'player' ? '#ff7a7a' : '#ffffff', t: this.time });
    }
    if (t.kind === 'base') {
      t.hp = Math.max(0, t.hp);
      return dealt;
    }
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

  private knock(t: Entity) {
    t.knockTimer = BALANCE.knockback.duration;
    t.atkTimer = Math.max(t.atkTimer, 0.3);
  }

  private kill(t: Entity) {
    t.dead = true;
    t.hp = 0;
    this.effects.push({ kind: 'death', x: t.x, radius: 20, t: this.time });
    if (t.commander) {
      this.commander.alive = false;
      this.commander.deaths++;
    }
    const dh = t.traits.find((x) => x.kind === 'deathHeal');
    if (dh && dh.kind === 'deathHeal') {
      this.effects.push({ kind: 'heal', x: t.x, radius: dh.radius, t: this.time });
      for (const a of this.entities) {
        if (a.side === t.side && a.kind === 'unit' && !a.dead && Math.abs(a.x - t.x) <= dh.radius) this.heal(a, dh.amount);
      }
    }
  }

  private heal(e: Entity, amount: number, show = true) {
    const before = e.hp;
    e.hp = Math.min(e.maxHp, e.hp + amount);
    const got = e.hp - before;
    if (show && got >= 1) this.floats.push({ x: e.x, depth: e.depth, text: `+${Math.round(got)}`, color: '#7dff9a', t: this.time });
  }

  private frontEnemy(): Entity | null {
    let best: Entity | null = null;
    for (const e of this.entities) {
      if (e.side !== 'enemy' || e.kind !== 'unit' || e.dead) continue;
      if (!best || e.x > best.x) best = e;
    }
    return best;
  }

  private castSpell(eff: SpellEffect, up: boolean) {
    const amt = up ? 1.4 : 1;
    const dur = up ? 1.3 : 1;
    const enemies = () => this.entities.filter((e) => e.side === 'enemy' && !e.dead);
    switch (eff.kind) {
      case 'damageFront': {
        const f = this.frontEnemy() ?? this.enemyBase;
        this.effects.push({ kind: 'blast', x: f.x, radius: eff.radius, t: this.time });
        for (const e of enemies()) if (Math.abs(e.x - f.x) <= eff.radius) this.damage(e, eff.amount * amt);
        break;
      }
      case 'damageStrongest': {
        const units = enemies().filter((e) => e.kind === 'unit');
        const t = units.length ? units.reduce((a, b) => (b.hp > a.hp ? b : a)) : this.enemyBase;
        this.effects.push({ kind: 'blast', x: t.x, radius: 30, t: this.time });
        this.damage(t, eff.amount * amt);
        break;
      }
      case 'stunFront': {
        const f = this.frontEnemy();
        if (!f) break;
        this.effects.push({ kind: 'stun', x: f.x, radius: eff.radius, t: this.time });
        for (const e of enemies()) {
          if (e.kind === 'unit' && Math.abs(e.x - f.x) <= eff.radius) e.stunTimer = Math.max(e.stunTimer, eff.seconds * dur);
        }
        break;
      }
      case 'slowAll':
        this.buffs.slowPct = eff.pct;
        this.buffs.slowUntil = this.time + eff.seconds * dur;
        this.effects.push({ kind: 'slow', x: 500, radius: 500, t: this.time });
        break;
      case 'healAll':
        for (const e of this.entities) {
          if (e.side === 'player' && e.kind === 'unit' && !e.dead) this.heal(e, (e.maxHp * eff.pct * amt) / 100);
        }
        this.heal(this.playerBase, eff.caveHeal * amt);
        this.effects.push({ kind: 'heal', x: 700, radius: 300, t: this.time });
        break;
      case 'buffAll':
        this.buffs.atkPct = eff.atkPct * amt;
        this.buffs.lifesteal = eff.lifesteal;
        this.buffs.atkUntil = this.time + eff.seconds * dur;
        this.effects.push({ kind: 'buff', x: 700, radius: 300, t: this.time });
        break;
      case 'hasteAll':
        this.buffs.hastePct = eff.pct * amt;
        this.buffs.hasteUntil = this.time + eff.seconds * dur;
        this.energy = Math.min(this.maxEnergy, this.energy + eff.energy);
        this.effects.push({ kind: 'buff', x: 700, radius: 300, t: this.time });
        break;
      case 'summon': {
        const bp = blueprint(eff.batId, this.cfg.roster[eff.batId]);
        const n = Math.round(eff.count * amt);
        for (let k = 0; k < n; k++) this.spawnBat(bp, false, k * 10);
        break;
      }
    }
  }
}

/** True if the card is a bat card whose def exists (guards stale saves). */
export const isPlayable = (c: Card) => (c.kind === 'bat' ? !!BAT_BY_ID[c.id] : !!SPELL_BY_ID[c.id]);
