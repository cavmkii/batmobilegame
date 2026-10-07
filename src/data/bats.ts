import type { BatDef, Palette, Talent } from './types';

const pal = (b: string, B: string, w: string, W: string, extra: Partial<Palette> = {}): Palette => ({
  o: '#1a1020',
  b,
  B,
  w,
  W,
  e: '#ffe14a',
  n: '#2a1a24',
  f: '#ffffff',
  c: '#ffc23d',
  ...extra,
});

const hp = (pct: number): Talent => ({ name: 'Thick Fur', desc: `+${pct}% HP`, effect: { kind: 'hpPct', pct } });
const atk = (pct: number): Talent => ({ name: 'Sharp Teeth', desc: `+${pct}% attack`, effect: { kind: 'atkPct', pct } });
const fast = (pct: number): Talent => ({ name: 'Tailwind', desc: `+${pct}% move speed`, effect: { kind: 'speedPct', pct } });
const cheap: Talent = { name: 'Light Sleeper', desc: '-1 energy cost', effect: { kind: 'cost', delta: -1 } };

export const BATS: BatDef[] = [
  // ---------- Basic ----------
  {
    id: 'fledgling', name: 'Fledgling', species: 'Juvenile bat', clans: [], rarity: 'common', basic: true,
    cost: 1, roost: { hp: 80, nights: 2, count: 1 }, stats: { hp: 60, atk: 10, range: 30, rate: 1.0, speed: 40, knockbacks: 2 }, traits: [],
    evolved: { name: 'Fledgling' }, talents: [hp(10), atk(10)],
    sprite: { template: 'fledgling', palette: pal('#8a8296', '#6b6478', '#5a5266', '#3e3848'), size: 0.8 },
    fact: 'Many small bats make their first flights at three to four weeks old.',
  },

  // ---------- Frugivore ----------
  {
    id: 'egyptian_fruit', name: 'Egyptian Fruit Bat', species: 'Rousettus aegyptiacus', clans: ['FRU'], rarity: 'common',
    cost: 2, roost: { hp: 260, nights: 4, count: 2 }, stats: { hp: 220, atk: 12, range: 30, rate: 1.2, speed: 30, knockbacks: 3 }, traits: [],
    evolved: { name: 'Pharaoh Fruit Bat', trait: { kind: 'knockChance', chance: 0.15 } }, talents: [hp(20), cheap],
    sprite: { template: 'fruit', palette: pal('#a8683a', '#7d4a28', '#5e3a26', '#3a2418'), size: 1 },
    fact: 'One of the few fruit bats that echolocates, using tongue clicks rather than its larynx.',
  },
  {
    id: 'straw_fruit', name: 'Straw-colored Fruit Bat', species: 'Eidolon helvum', clans: ['FRU'], rarity: 'rare',
    cost: 3, roost: { hp: 300, nights: 4, count: 2 }, stats: { hp: 300, atk: 15, range: 30, rate: 1.2, speed: 30, knockbacks: 3 },
    traits: [{ kind: 'healAura', amount: 15, every: 2, radius: 120 }],
    evolved: { name: 'Harvest Colony Matriarch' }, talents: [hp(20), atk(20)],
    sprite: { template: 'fruit', palette: pal('#e2c46a', '#b8963e', '#8a6a34', '#5a4420'), size: 1.1 },
    fact: 'Migrates in colonies of up to ten million to Kasanka, Zambia, every year.',
  },
  {
    id: 'hammerhead', name: 'Hammer-headed Bat', species: 'Hypsignathus monstrosus', clans: ['FRU'], rarity: 'epic',
    cost: 4, roost: { hp: 500, nights: 4, count: 1 }, stats: { hp: 700, atk: 45, range: 40, rate: 1.5, speed: 25, knockbacks: 4 },
    traits: [{ kind: 'aoe' }, { kind: 'knockChance', chance: 0.35 }],
    evolved: { name: 'Thunderhead', trait: { kind: 'healAura', amount: 10, every: 2, radius: 80 } }, talents: [hp(25), cheap],
    sprite: { template: 'fruit', palette: pal('#6a4a3a', '#4a3226', '#3e2a22', '#24160f', { n: '#d06040' }), size: 1.4 },
    fact: "Africa's largest bat. Males have a huge larynx that fills most of the chest, for honking calls.",
  },

  // ---------- Insectivore ----------
  {
    id: 'little_brown', name: 'Little Brown Bat', species: 'Myotis lucifugus', clans: ['INS'], rarity: 'common',
    cost: 2, roost: { hp: 100, nights: 3, count: 4 }, stats: { hp: 50, atk: 14, range: 25, rate: 0.6, speed: 70, knockbacks: 1 },
    traits: [],
    evolved: { name: 'Lucifer Myotis', trait: { kind: 'swarm', count: 6 } }, talents: [fast(25), atk(20)],
    sprite: { template: 'micro', palette: pal('#8a6040', '#6a4630', '#4a3a30', '#2a2018'), size: 0.75 },
    fact: 'In lab trials it caught small flies at up to ten a minute; the popular "1,000 mosquitoes an hour" is an extrapolation.',
  },
  {
    id: 'long_eared', name: 'Brown Long-eared Bat', species: 'Plecotus auritus', clans: ['INS'], rarity: 'rare',
    cost: 3, roost: { hp: 120, nights: 3, count: 2 }, stats: { hp: 90, atk: 20, range: 130, rate: 0.8, speed: 45, knockbacks: 2 },
    traits: [{ kind: 'multiHit', targets: 2 }],
    evolved: { name: 'Whisper Ear', trait: { kind: 'multiHit', targets: 3 } }, talents: [atk(20), cheap],
    sprite: { template: 'micro', palette: pal('#9a7a5a', '#7a5a40', '#6a5040', '#3a2a20', { n: '#e0a080' }), size: 0.9 },
    fact: 'Its ears are about three-quarters of its body length; it often finds prey by listening for rustling rather than echolocating.',
  },
  {
    id: 'free_tailed', name: 'Mexican Free-tailed Bat', species: 'Tadarida brasiliensis', clans: ['INS'], rarity: 'epic',
    cost: 4, roost: { hp: 150, nights: 3, count: 3 }, stats: { hp: 160, atk: 35, range: 40, rate: 0.4, speed: 120, knockbacks: 1 }, traits: [],
    evolved: { name: 'Jetstream', trait: { kind: 'knockChance', chance: 0.2 } }, talents: [fast(20), atk(25)],
    sprite: { template: 'micro', palette: pal('#5a4a5a', '#3e3240', '#4a3a50', '#221a28'), size: 1 },
    fact: 'Radio-tracked at up to 160 km/h in level flight. If that holds up (it is debated), it is the fastest flyer recorded.',
  },

  // ---------- Sanguivore ----------
  {
    id: 'common_vampire', name: 'Common Vampire Bat', species: 'Desmodus rotundus', clans: ['SAN'], rarity: 'common',
    cost: 2, roost: { hp: 140, nights: 3, count: 2 }, stats: { hp: 90, atk: 22, range: 30, rate: 1.0, speed: 50, knockbacks: 2 },
    traits: [{ kind: 'lifesteal', pct: 50 }],
    evolved: { name: 'Desmodus Rex', trait: { kind: 'deathHeal', amount: 40, radius: 120 } }, talents: [atk(20), hp(20)],
    sprite: { template: 'vampire', palette: pal('#6a5058', '#4a3640', '#5a3040', '#2a1820'), size: 0.9 },
    fact: 'Runs on the ground at over 1 m/s and launches into flight from a standstill, which almost no other bat can do.',
  },
  {
    id: 'hairy_legged', name: 'Hairy-legged Vampire Bat', species: 'Diphylla ecaudata', clans: ['SAN'], rarity: 'rare',
    cost: 3, roost: { hp: 160, nights: 3, count: 2 }, stats: { hp: 150, atk: 40, range: 35, rate: 1.1, speed: 55, knockbacks: 2 },
    traits: [{ kind: 'lifesteal', pct: 40 }, { kind: 'knockChance', chance: 0.2 }],
    evolved: { name: 'Night Stalker' }, talents: [atk(25), fast(20)],
    sprite: { template: 'vampire', palette: pal('#7a5a48', '#5a4034', '#6a3a3a', '#3a201c', { e: '#ff6040' }), size: 1 },
    fact: 'Feeds mostly on bird blood, roosting chickens included.',
  },
  {
    id: 'white_winged', name: 'White-winged Vampire Bat', species: 'Diaemus youngi', clans: ['SAN'], rarity: 'epic',
    cost: 4, roost: { hp: 200, nights: 3, count: 2 }, stats: { hp: 200, atk: 60, range: 35, rate: 1.0, speed: 50, knockbacks: 2 },
    traits: [{ kind: 'lifesteal', pct: 30 }, { kind: 'deathHeal', amount: 80, radius: 150 }],
    evolved: { name: 'Pale Communion', trait: { kind: 'atkAura', pct: 15, radius: 100 } }, talents: [hp(25), cheap],
    sprite: { template: 'vampire', palette: pal('#5a4048', '#3e2a32', '#e8e0e8', '#a898a8'), size: 1.15 },
    fact: 'Vampire bats share blood meals with roost-mates that went hungry, and remember who shared with them.',
  },

  // ---------- Piscivore ----------
  {
    id: 'lesser_bulldog', name: 'Lesser Bulldog Bat', species: 'Noctilio albiventris', clans: ['PIS'], rarity: 'common',
    cost: 2, roost: { hp: 110, nights: 3, count: 2 }, stats: { hp: 70, atk: 30, range: 160, rate: 1.6, speed: 35, knockbacks: 2 }, traits: [],
    evolved: { name: 'Riverjaw', trait: { kind: 'multiHit', targets: 2 } }, talents: [atk(20), cheap],
    sprite: { template: 'bulldog', palette: pal('#c08a50', '#9a6a3a', '#7a5a40', '#4a3420'), size: 0.9 },
    fact: 'Mostly eats insects caught over water, plus the occasional small fish.',
  },
  {
    id: 'greater_bulldog', name: 'Greater Bulldog Bat', species: 'Noctilio leporinus', clans: ['PIS'], rarity: 'rare',
    cost: 3, roost: { hp: 140, nights: 3, count: 2 }, stats: { hp: 120, atk: 55, range: 200, rate: 2.0, speed: 30, knockbacks: 2 },
    traits: [{ kind: 'multiHit', targets: 3 }],
    evolved: { name: 'Harpoon Lip' }, talents: [atk(25), hp(20)],
    sprite: { template: 'bulldog', palette: pal('#d0702a', '#a8521c', '#8a4a2a', '#5a2a14'), size: 1.1 },
    fact: 'Trawls water with long clawed feet, sensing fish by echolocating the ripples.',
  },
  {
    id: 'fishing_bat', name: 'Mexican Fishing Bat', species: 'Myotis vivesi', clans: ['PIS'], rarity: 'epic',
    cost: 5, roost: { hp: 160, nights: 3, count: 2 }, stats: { hp: 160, atk: 90, range: 300, rate: 2.5, speed: 30, knockbacks: 2 },
    traits: [{ kind: 'aoe' }],
    evolved: { name: 'Tidecaller', trait: { kind: 'knockChance', chance: 0.25 } }, talents: [atk(25), cheap],
    sprite: { template: 'bulldog', palette: pal('#8a8aa0', '#6a6a80', '#4a5a7a', '#2a3450'), size: 1.1 },
    fact: 'Hunts fish and crustaceans over the open sea, and its kidneys can cope with seawater.',
  },

  // ---------- Nectarivore ----------
  {
    id: 'pallas_tongue', name: "Pallas's Long-tongued Bat", species: 'Glossophaga soricina', clans: ['NEC'], rarity: 'common',
    cost: 2, roost: { hp: 120, nights: 3, count: 3 }, stats: { hp: 80, atk: 8, range: 120, rate: 1.2, speed: 40, knockbacks: 2 },
    traits: [{ kind: 'atkAura', pct: 25, radius: 120 }],
    evolved: { name: 'Sugarwing', trait: { kind: 'hasteAura', pct: 10, radius: 120 } }, talents: [hp(25), cheap],
    sprite: { template: 'nectar', palette: pal('#a07a60', '#7a5a44', '#6a5060', '#3a2a34'), size: 0.8 },
    fact: 'Hovers at flowers like a hummingbird, at one of the highest mass-specific metabolic rates measured in a mammal.',
  },
  {
    id: 'long_nosed', name: 'Lesser Long-nosed Bat', species: 'Leptonycteris yerbabuenae', clans: ['NEC'], rarity: 'rare',
    cost: 3, roost: { hp: 140, nights: 3, count: 3 }, stats: { hp: 100, atk: 10, range: 140, rate: 1.0, speed: 45, knockbacks: 2 },
    traits: [{ kind: 'hasteAura', pct: 30, radius: 140 }],
    evolved: { name: 'Agave Runner', trait: { kind: 'atkAura', pct: 15, radius: 140 } }, talents: [fast(20), cheap],
    sprite: { template: 'nectar', palette: pal('#b08a6a', '#8a6a4e', '#7a6070', '#4a3444', { n: '#ffb0d0' }), size: 0.95 },
    fact: 'A major pollinator of wild agaves and columnar cacti.',
  },
  {
    id: 'tube_lipped', name: 'Tube-lipped Nectar Bat', species: 'Anoura fistulata', clans: ['NEC'], rarity: 'epic',
    cost: 4, roost: { hp: 160, nights: 3, count: 3 }, stats: { hp: 150, atk: 15, range: 160, rate: 1.0, speed: 40, knockbacks: 2 },
    traits: [{ kind: 'atkAura', pct: 40, radius: 160 }, { kind: 'hasteAura', pct: 25, radius: 160 }],
    evolved: { name: 'Chalice Tongue' }, talents: [hp(25), cheap],
    sprite: { template: 'nectar', palette: pal('#7a6a8a', '#5a4a6a', '#8a5a9a', '#4a2a5a', { n: '#ff90e0' }), size: 1.05 },
    fact: 'Its tongue is 1.5× its body length, the longest relative to body size of any mammal.',
  },

  // ---------- Commanders (legendary) ----------
  {
    id: 'flying_fox', name: 'Great Flying Fox', species: 'Pteropus vampyrus', clans: ['FRU', 'NEC'], rarity: 'legendary', commander: true,
    cost: 4, roost: { hp: 450, nights: 99, count: 1 }, stats: { hp: 800, atk: 35, range: 50, rate: 1.4, speed: 30, knockbacks: 5 },
    traits: [{ kind: 'healAura', amount: 25, every: 2, radius: 140 }, { kind: 'atkAura', pct: 20, radius: 140 }],
    evolved: { name: 'Canopy Sovereign', trait: { kind: 'hasteAura', pct: 15, radius: 140 } }, talents: [hp(25), cheap],
    sprite: { template: 'fruit', palette: pal('#d08a3a', '#3a2418', '#3a2a24', '#1a100c'), size: 1.6, crown: true },
    fact: 'Wingspan up to 1.5 m. Despite the species name, it eats fruit and nectar.',
  },
  {
    id: 'ghost_bat', name: 'Ghost Bat', species: 'Macroderma gigas', clans: ['SAN', 'INS'], rarity: 'legendary', commander: true,
    cost: 4, roost: { hp: 350, nights: 99, count: 1 }, stats: { hp: 450, atk: 42, range: 40, rate: 1.0, speed: 60, knockbacks: 3 },
    traits: [{ kind: 'lifesteal', pct: 25 }, { kind: 'aoe' }],
    evolved: { name: 'Pale Tyrant', trait: { kind: 'knockChance', chance: 0.25 } }, talents: [atk(25), fast(20)],
    sprite: { template: 'micro', palette: pal('#e8e4ec', '#b8b0c4', '#d8d0e0', '#8a80a0', { e: '#ff4060' }), size: 1.4, crown: true },
    fact: "Australia's only carnivorous bat: it hunts frogs, birds and other bats, then eats them at a feeding roost.",
  },
  {
    id: 'spectral_bat', name: 'Spectral Bat', species: 'Vampyrum spectrum', clans: ['PIS', 'SAN'], rarity: 'legendary', commander: true,
    cost: 5, roost: { hp: 350, nights: 99, count: 1 }, stats: { hp: 450, atk: 75, range: 220, rate: 1.8, speed: 30, knockbacks: 3 },
    traits: [{ kind: 'multiHit', targets: 3 }, { kind: 'lifesteal', pct: 20 }],
    evolved: { name: 'False Vampire King', trait: { kind: 'aoe' } }, talents: [atk(25), hp(25)],
    sprite: { template: 'bulldog', palette: pal('#5a3a4a', '#3a2230', '#4a2a50', '#22102a', { e: '#80ffd0' }), size: 1.5, crown: true },
    fact: 'The largest bat in the Americas. Pairs roost together and share food with their young.',
  },
];

export const BAT_BY_ID: Record<string, BatDef> = Object.fromEntries(BATS.map((b) => [b.id, b]));
export const STARTER_COMMANDERS = ['flying_fox', 'ghost_bat', 'spectral_bat'];
export const STARTER_COMMONS = BATS.filter((b) => b.rarity === 'common' && !b.basic).map((b) => b.id);
