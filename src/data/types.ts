export type ClanId = 'FRU' | 'INS' | 'SAN' | 'PIS' | 'NEC';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Stats {
  hp: number;
  atk: number;
  /** Lane units. Lane is 1000 long. */
  range: number;
  /** Seconds between attacks. */
  rate: number;
  /** Lane units per second. */
  speed: number;
  /** Times the unit is knocked back over its HP bar (Battle Cats style). */
  knockbacks: number;
}

export type Trait =
  | { kind: 'lifesteal'; pct: number }
  | { kind: 'multiHit'; targets: number }
  | { kind: 'aoe' }
  | { kind: 'healAura'; amount: number; every: number; radius: number }
  | { kind: 'atkAura'; pct: number; radius: number }
  | { kind: 'hasteAura'; pct: number; radius: number }
  | { kind: 'knockChance'; chance: number }
  | { kind: 'deathHeal'; amount: number; radius: number }
  /** Overrides how many bats a roost releases each night. */
  | { kind: 'swarm'; count: number }
  /** Enemy only: tiger moths jam sonar, shrinking nearby bats' range. */
  | { kind: 'jammer'; pct: number; radius: number };

export type TalentEffect =
  | { kind: 'hpPct'; pct: number }
  | { kind: 'atkPct'; pct: number }
  | { kind: 'speedPct'; pct: number }
  | { kind: 'cost'; delta: number }
  | { kind: 'trait'; trait: Trait };

export interface Talent {
  name: string;
  desc: string;
  effect: TalentEffect;
}

export interface SpriteSpec {
  template: 'fruit' | 'micro' | 'vampire' | 'bulldog' | 'nectar' | 'fledgling';
  palette: Palette;
  /** Pixel scale multiplier relative to a normal bat. */
  size: number;
  crown?: boolean;
}

export interface Palette {
  o: string; // outline
  b: string; // body
  B: string; // body shade
  w: string; // wing membrane
  W: string; // wing bone
  e: string; // eye
  n: string; // nose / accent
  f?: string; // fangs
  c?: string; // crown
  [k: string]: string | undefined;
}

export interface BatDef {
  id: string;
  name: string;
  species: string;
  clans: ClanId[];
  rarity: Rarity;
  commander?: boolean;
  /** Basic bat: unlimited copies allowed in a deck, never in gacha. */
  basic?: boolean;
  cost: number;
  /** Per-bat combat stats. Range/speed are in old lane units (100 = 1 tile). */
  stats: Stats;
  /**
   * Roost HP, the most bats it keeps out, seconds per release, and bats per release (default 1).
   * Bats aren't all out at dusk: each release waits for the cooldown, so the army builds through the night.
   */
  roost: { hp: number; count: number; respawn: number; batch?: number };
  /**
   * Tiles (dCol, dRow) that also gain +1 level when this roost is upgraded by stacking.
   * dRow -1 is toward the enemies.
   */
  pattern: [number, number][];
  traits: Trait[];
  evolved: { name: string; trait?: Trait };
  talents: [Talent, Talent];
  sprite: SpriteSpec;
  fact: string;
}

export type SpellEffect =
  | { kind: 'damageFront'; amount: number; radius: number }
  | { kind: 'damageStrongest'; amount: number }
  | { kind: 'stunFront'; seconds: number; radius: number }
  | { kind: 'slowAll'; pct: number; seconds: number }
  | { kind: 'healAll'; pct: number; caveHeal: number }
  | { kind: 'buffAll'; atkPct: number; lifesteal: number; seconds: number }
  | { kind: 'hasteAll'; pct: number; seconds: number; energy: number }
  | { kind: 'summon'; batId: string; count: number };

export interface SpellDef {
  id: string;
  name: string;
  clans: ClanId[];
  rarity: Rarity;
  cost: number;
  effect: SpellEffect;
  desc: string;
  icon: string;
}

export interface EnemyDef {
  id: string;
  name: string;
  stats: Stats;
  traits: Trait[];
  sprite: string;
  /** Pixel scale. */
  size: number;
  /** Cost against a night's wave budget. */
  threat: number;
}

export interface RelicDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  effect: RelicEffect;
}

export type RelicEffect =
  | { kind: 'guanoPerDawn'; amount: number }
  | { kind: 'refreshDiscount'; amount: number }
  | { kind: 'startGuano'; amount: number }
  | { kind: 'speedPct'; pct: number }
  | { kind: 'hpPct'; pct: number }
  | { kind: 'atkPct'; pct: number }
  | { kind: 'commanderDiscount'; amount: number }
  | { kind: 'healAfterBattle'; amount: number }
  | { kind: 'startLevel'; amount: number };

export type TerrainId = 'pond' | 'fig' | 'cactus' | 'lamp' | 'pen';

/** A card in a run deck. */
export interface Card {
  uid: string;
  kind: 'bat' | 'spell';
  id: string;
  upgraded: boolean;
}
