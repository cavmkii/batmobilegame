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
const cheap: Talent = { name: 'Light Sleeper', desc: '-1 guano cost', effect: { kind: 'cost', delta: -1 } };

export const BATS: BatDef[] = [
  // ---------- Basic ----------
  {
    id: 'fledgling', name: 'Fledgling', short: 'Fledgling', species: 'Juvenile bat', clans: [], rarity: 'common', basic: true,
    cost: 1, pattern: [], roost: { hp: 80, count: 1, respawn: 3 }, stats: { hp: 60, atk: 10, range: 30, rate: 1.0, speed: 40, knockbacks: 2 }, traits: [],
    evolved: { name: 'Fledgling' }, talents: [hp(10), atk(10)],
    sprite: { template: 'fledgling', palette: pal('#8a8296', '#6b6478', '#5a5266', '#3e3848'), size: 0.8 },
    fact: 'Many small bats make their first flights at three to four weeks old.',
  },

  // ---------- Frugivore ----------
  {
    id: 'egyptian_fruit', name: 'Egyptian Fruit Bat', short: 'Egyptian', species: 'Rousettus aegyptiacus', clans: ['FRU'], rarity: 'common',
    cost: 2, pattern: [[1, 0]], roost: { hp: 260, count: 2, respawn: 8 }, stats: { hp: 220, atk: 12, range: 30, rate: 1.2, speed: 30, knockbacks: 3 }, traits: [],
    evolved: { name: 'Pharaoh Fruit Bat', trait: { kind: 'knockChance', chance: 0.15 } }, talents: [hp(20), cheap],
    sprite: { template: 'fruit', palette: pal('#a8683a', '#7d4a28', '#5e3a26', '#3a2418'), size: 1 },
    fact: 'One of the few fruit bats that echolocates, using tongue clicks rather than its larynx.',
  },
  {
    id: 'straw_fruit', name: 'Straw-colored Fruit Bat', short: 'Straw', species: 'Eidolon helvum', clans: ['FRU'], rarity: 'rare',
    cost: 3, pattern: [[-1, 0], [1, 0]], roost: { hp: 300, count: 2, respawn: 8 }, stats: { hp: 300, atk: 15, range: 30, rate: 1.2, speed: 30, knockbacks: 3 },
    traits: [{ kind: 'healAura', amount: 15, every: 2, radius: 120 }],
    evolved: { name: 'Harvest Colony Matriarch' }, talents: [hp(20), atk(20)],
    sprite: { template: 'fruit', palette: pal('#e2c46a', '#b8963e', '#8a6a34', '#5a4420'), size: 1.1 },
    fact: 'Migrates in colonies of up to ten million to Kasanka, Zambia, every year.',
  },
  {
    id: 'hammerhead', name: 'Hammer-headed Bat', short: 'Hammerhead', species: 'Hypsignathus monstrosus', clans: ['FRU'], rarity: 'epic',
    cost: 4, pattern: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]], roost: { hp: 500, count: 1, respawn: 14 }, stats: { hp: 700, atk: 45, range: 40, rate: 1.5, speed: 25, knockbacks: 4 },
    traits: [{ kind: 'aoe' }, { kind: 'knockChance', chance: 0.35 }],
    evolved: { name: 'Thunderhead', trait: { kind: 'healAura', amount: 10, every: 2, radius: 80 } }, talents: [hp(25), cheap],
    sprite: { template: 'fruit', palette: pal('#6a4a3a', '#4a3226', '#3e2a22', '#24160f', { n: '#d06040' }), size: 1.4 },
    fact: "Africa's largest bat. Males have a huge larynx that fills most of the chest, for honking calls.",
  },

  // ---------- Insectivore ----------
  {
    id: 'little_brown', name: 'Little Brown Bat', short: 'Lil Brown', species: 'Myotis lucifugus', clans: ['INS'], rarity: 'common',
    cost: 2, pattern: [[0, -1]], roost: { hp: 100, count: 4, respawn: 3, batch: 2 }, stats: { hp: 50, atk: 14, range: 25, rate: 0.6, speed: 70, knockbacks: 1 },
    traits: [],
    evolved: { name: 'Lucifer Myotis', trait: { kind: 'swarm', count: 6 } }, talents: [fast(25), atk(20)],
    sprite: { template: 'micro', palette: pal('#8a6040', '#6a4630', '#4a3a30', '#2a2018'), size: 0.75 },
    fact: 'In lab trials it caught small flies at up to ten a minute; the popular "1,000 mosquitoes an hour" is an extrapolation.',
  },
  {
    id: 'long_eared', name: 'Brown Long-eared Bat', short: 'Long-ear', species: 'Plecotus auritus', clans: ['INS'], rarity: 'rare',
    cost: 3, pattern: [[-1, -1], [1, -1], [-1, 1], [1, 1]], roost: { hp: 120, count: 2, respawn: 6 }, stats: { hp: 90, atk: 20, range: 130, rate: 0.8, speed: 45, knockbacks: 2 },
    traits: [{ kind: 'multiHit', targets: 2 }],
    evolved: { name: 'Whisper Ear', trait: { kind: 'multiHit', targets: 3 } }, talents: [atk(20), cheap],
    sprite: { template: 'micro', palette: pal('#9a7a5a', '#7a5a40', '#6a5040', '#3a2a20', { n: '#e0a080' }), size: 0.9 },
    fact: 'Its ears are about three-quarters of its body length; it often finds prey by listening for rustling rather than echolocating.',
  },
  {
    id: 'free_tailed', name: 'Mexican Free-tailed Bat', short: 'Free-tail', species: 'Tadarida brasiliensis', clans: ['INS'], rarity: 'epic',
    cost: 4, pattern: [[0, -1], [0, -2], [0, 1], [0, 2]], roost: { hp: 150, count: 3, respawn: 5 }, stats: { hp: 160, atk: 35, range: 40, rate: 0.4, speed: 120, knockbacks: 1 }, traits: [],
    evolved: { name: 'Jetstream', trait: { kind: 'knockChance', chance: 0.2 } }, talents: [fast(20), atk(25)],
    sprite: { template: 'micro', palette: pal('#5a4a5a', '#3e3240', '#4a3a50', '#221a28'), size: 1 },
    fact: 'Radio-tracked at up to 160 km/h in level flight. If that holds up (it is debated), it is the fastest flyer recorded.',
  },

  // ---------- Sanguivore ----------
  {
    id: 'common_vampire', name: 'Common Vampire Bat', short: 'Vampire', species: 'Desmodus rotundus', clans: ['SAN'], rarity: 'common',
    cost: 2, pattern: [[0, -1], [-1, 0], [1, 0], [0, 1]], roost: { hp: 140, count: 2, respawn: 6 }, stats: { hp: 90, atk: 22, range: 30, rate: 1.0, speed: 50, knockbacks: 2 },
    traits: [{ kind: 'lifesteal', pct: 50 }],
    evolved: { name: 'Desmodus Rex', trait: { kind: 'deathHeal', amount: 40, radius: 120 } }, talents: [atk(20), hp(20)],
    sprite: { template: 'vampire', palette: pal('#6a5058', '#4a3640', '#5a3040', '#2a1820'), size: 0.9 },
    fact: 'Runs on the ground at over 1 m/s and launches into flight from a standstill, which almost no other bat can do.',
  },
  {
    id: 'hairy_legged', name: 'Hairy-legged Vampire Bat', short: 'Hairy-leg', species: 'Diphylla ecaudata', clans: ['SAN'], rarity: 'rare',
    cost: 3, pattern: [[0, -1], [0, 1]], roost: { hp: 160, count: 2, respawn: 7 }, stats: { hp: 150, atk: 40, range: 35, rate: 1.1, speed: 55, knockbacks: 2 },
    traits: [{ kind: 'lifesteal', pct: 40 }, { kind: 'knockChance', chance: 0.2 }],
    evolved: { name: 'Night Stalker' }, talents: [atk(25), fast(20)],
    sprite: { template: 'vampire', palette: pal('#7a5a48', '#5a4034', '#6a3a3a', '#3a201c', { e: '#ff6040' }), size: 1 },
    fact: 'Feeds mostly on bird blood, roosting chickens included.',
  },
  {
    id: 'white_winged', name: 'White-winged Vampire Bat', short: 'White-wing', species: 'Diaemus youngi', clans: ['SAN'], rarity: 'epic',
    cost: 4, pattern: [[0, -1], [-1, 0], [1, 0], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]], roost: { hp: 200, count: 2, respawn: 8 }, stats: { hp: 200, atk: 60, range: 35, rate: 1.0, speed: 50, knockbacks: 2 },
    traits: [{ kind: 'lifesteal', pct: 30 }, { kind: 'deathHeal', amount: 80, radius: 150 }],
    evolved: { name: 'Pale Communion', trait: { kind: 'atkAura', pct: 15, radius: 100 } }, talents: [hp(25), cheap],
    sprite: { template: 'vampire', palette: pal('#5a4048', '#3e2a32', '#e8e0e8', '#a898a8'), size: 1.15 },
    fact: 'Vampire bats share blood meals with roost-mates that went hungry, and remember who shared with them.',
  },

  // ---------- Piscivore ----------
  {
    id: 'lesser_bulldog', name: 'Lesser Bulldog Bat', short: 'Bulldog', species: 'Noctilio albiventris', clans: ['PIS'], rarity: 'common',
    cost: 2, pattern: [[-1, 0], [1, 0]], roost: { hp: 110, count: 2, respawn: 7 }, stats: { hp: 70, atk: 30, range: 160, rate: 1.6, speed: 35, knockbacks: 2 }, traits: [],
    evolved: { name: 'Riverjaw', trait: { kind: 'multiHit', targets: 2 } }, talents: [atk(20), cheap],
    sprite: { template: 'bulldog', palette: pal('#c08a50', '#9a6a3a', '#7a5a40', '#4a3420'), size: 0.9 },
    fact: 'Mostly eats insects caught over water, plus the occasional small fish.',
  },
  {
    id: 'greater_bulldog', name: 'Greater Bulldog Bat', short: 'Gr Bulldog', species: 'Noctilio leporinus', clans: ['PIS'], rarity: 'rare',
    cost: 3, pattern: [[-1, -1], [1, -1]], roost: { hp: 140, count: 2, respawn: 9 }, stats: { hp: 120, atk: 55, range: 200, rate: 2.0, speed: 30, knockbacks: 2 },
    traits: [{ kind: 'multiHit', targets: 3 }],
    evolved: { name: 'Harpoon Lip' }, talents: [atk(25), hp(20)],
    sprite: { template: 'bulldog', palette: pal('#d0702a', '#a8521c', '#8a4a2a', '#5a2a14'), size: 1.1 },
    fact: 'Trawls water with long clawed feet, sensing fish by echolocating the ripples.',
  },
  {
    id: 'fishing_bat', name: 'Mexican Fishing Bat', short: 'Fisher', species: 'Myotis vivesi', clans: ['PIS'], rarity: 'epic',
    cost: 5, pattern: [[0, -1], [0, -2], [-1, 0], [1, 0]], roost: { hp: 160, count: 2, respawn: 12 }, stats: { hp: 160, atk: 90, range: 300, rate: 2.5, speed: 30, knockbacks: 2 },
    traits: [{ kind: 'aoe' }],
    evolved: { name: 'Tidecaller', trait: { kind: 'knockChance', chance: 0.25 } }, talents: [atk(25), cheap],
    sprite: { template: 'bulldog', palette: pal('#8a8aa0', '#6a6a80', '#4a5a7a', '#2a3450'), size: 1.1 },
    fact: 'Hunts fish and crustaceans over the open sea, and its kidneys can cope with seawater.',
  },

  // ---------- Nectarivore ----------
  {
    id: 'pallas_tongue', name: "Pallas's Long-tongued Bat", short: "Pallas's", species: 'Glossophaga soricina', clans: ['NEC'], rarity: 'common',
    cost: 2, pattern: [[-1, 1], [1, 1]], roost: { hp: 120, count: 3, respawn: 6 }, stats: { hp: 80, atk: 8, range: 120, rate: 1.2, speed: 40, knockbacks: 2 },
    traits: [{ kind: 'atkAura', pct: 25, radius: 120 }],
    evolved: { name: 'Sugarwing', trait: { kind: 'hasteAura', pct: 10, radius: 120 } }, talents: [hp(25), cheap],
    sprite: { template: 'nectar', palette: pal('#a07a60', '#7a5a44', '#6a5060', '#3a2a34'), size: 0.8 },
    fact: 'Hovers at flowers like a hummingbird, at one of the highest mass-specific metabolic rates measured in a mammal.',
  },
  {
    id: 'long_nosed', name: 'Lesser Long-nosed Bat', short: 'Long-nose', species: 'Leptonycteris yerbabuenae', clans: ['NEC'], rarity: 'rare',
    cost: 3, pattern: [[-1, 0], [1, 0], [0, 1]], roost: { hp: 140, count: 3, respawn: 7 }, stats: { hp: 100, atk: 10, range: 140, rate: 1.0, speed: 45, knockbacks: 2 },
    traits: [{ kind: 'hasteAura', pct: 30, radius: 140 }],
    evolved: { name: 'Agave Runner', trait: { kind: 'atkAura', pct: 15, radius: 140 } }, talents: [fast(20), cheap],
    sprite: { template: 'nectar', palette: pal('#b08a6a', '#8a6a4e', '#7a6070', '#4a3444', { n: '#ffb0d0' }), size: 0.95 },
    fact: 'A major pollinator of wild agaves and columnar cacti.',
  },
  {
    id: 'tube_lipped', name: 'Tube-lipped Nectar Bat', short: 'Tube-lip', species: 'Anoura fistulata', clans: ['NEC'], rarity: 'epic',
    cost: 4, pattern: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]], roost: { hp: 160, count: 3, respawn: 9 }, stats: { hp: 150, atk: 15, range: 160, rate: 1.0, speed: 40, knockbacks: 2 },
    traits: [{ kind: 'atkAura', pct: 40, radius: 160 }, { kind: 'hasteAura', pct: 25, radius: 160 }],
    evolved: { name: 'Chalice Tongue' }, talents: [hp(25), cheap],
    sprite: { template: 'nectar', palette: pal('#7a6a8a', '#5a4a6a', '#8a5a9a', '#4a2a5a', { n: '#ff90e0' }), size: 1.05 },
    fact: 'Its tongue is 1.5× its body length, the longest relative to body size of any mammal.',
  },

  // ---------- Matriarchs (legendary) ----------
  {
    id: 'flying_fox', name: 'Great Flying Fox', short: 'Flying Fox', species: 'Pteropus vampyrus', clans: ['FRU', 'NEC'], rarity: 'legendary', matriarch: true,
    cost: 4, pattern: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]], roost: { hp: 450, count: 1, respawn: 16 }, stats: { hp: 800, atk: 35, range: 50, rate: 1.4, speed: 30, knockbacks: 5 },
    traits: [{ kind: 'healAura', amount: 25, every: 2, radius: 140 }, { kind: 'atkAura', pct: 20, radius: 140 }],
    evolved: { name: 'Canopy Sovereign', trait: { kind: 'hasteAura', pct: 15, radius: 140 } }, talents: [hp(25), cheap],
    sprite: { template: 'fruit', palette: pal('#d08a3a', '#3a2418', '#3a2a24', '#1a100c'), size: 1.6, crown: true },
    fact: 'Wingspan up to 1.5 m. Despite the species name, it eats fruit and nectar.',
  },
  {
    id: 'ghost_bat', name: 'Ghost Bat', short: 'Ghost', species: 'Macroderma gigas', clans: ['SAN', 'INS'], rarity: 'legendary', matriarch: true,
    cost: 4, pattern: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]], roost: { hp: 350, count: 1, respawn: 14 }, stats: { hp: 450, atk: 34, range: 40, rate: 1.0, speed: 60, knockbacks: 3 },
    traits: [{ kind: 'lifesteal', pct: 25 }, { kind: 'aoe' }],
    evolved: { name: 'Pale Tyrant', trait: { kind: 'knockChance', chance: 0.25 } }, talents: [atk(25), fast(20)],
    sprite: { template: 'micro', palette: pal('#e8e4ec', '#b8b0c4', '#d8d0e0', '#8a80a0', { e: '#ff4060' }), size: 1.4, crown: true },
    fact: "Australia's only carnivorous bat: it hunts frogs, birds and other bats, then eats them at a feeding roost.",
  },
  {
    id: 'spectral_bat', name: 'Spectral Bat', short: 'Spectral', species: 'Vampyrum spectrum', clans: ['PIS', 'SAN'], rarity: 'legendary', matriarch: true,
    cost: 5, pattern: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]], roost: { hp: 350, count: 1, respawn: 16 }, stats: { hp: 450, atk: 75, range: 220, rate: 1.8, speed: 30, knockbacks: 3 },
    traits: [{ kind: 'multiHit', targets: 3 }, { kind: 'lifesteal', pct: 20 }],
    evolved: { name: 'False Vampire King', trait: { kind: 'aoe' } }, talents: [atk(25), hp(25)],
    sprite: { template: 'bulldog', palette: pal('#5a3a4a', '#3a2230', '#4a2a50', '#22102a', { e: '#80ffd0' }), size: 1.5, crown: true },
    fact: 'The largest bat in the Americas. Pairs roost together and share food with their young.',
  },

  // ================= Field guide expansion =================

  // ---------- Insectivore: North America ----------
  {
    id: 'tricolored', name: 'Tricolored Bat', short: 'Tricolor', species: 'Perimyotis subflavus', clans: ['INS'], rarity: 'rare',
    cost: 2, pattern: [[-1, -1], [1, 1]], roost: { hp: 90, count: 3, respawn: 4 },
    stats: { hp: 45, atk: 12, range: 25, rate: 0.6, speed: 65, knockbacks: 1 }, traits: [],
    evolved: { name: 'Banded Pipistrelle', trait: { kind: 'hasteAura', pct: 10, radius: 100 } }, talents: [fast(20), atk(20)],
    sprite: { template: 'vesper', palette: pal('#c8964a', '#9a6e34', '#6a4a3a', '#3a2818'), size: 0.76 },
    fact: 'Each hair is banded dark, light, then dark, which gives it its name; it used to be called the eastern pipistrelle. White-nose syndrome has devastated its populations.',
  },
  {
    id: 'northern_long_eared', name: 'Northern Long-eared Bat', short: 'N Long-ear', species: 'Myotis septentrionalis', clans: ['INS'], rarity: 'rare',
    cost: 3, pattern: [[0, -1], [-1, 0]], roost: { hp: 110, count: 2, respawn: 6 },
    stats: { hp: 70, atk: 18, range: 110, rate: 0.9, speed: 45, knockbacks: 2 }, traits: [{ kind: 'multiHit', targets: 2 }],
    evolved: { name: 'Bark Gleaner', trait: { kind: 'multiHit', targets: 3 } }, talents: [atk(20), cheap],
    sprite: { template: 'micro', palette: pal('#8a6a4a', '#6a4e34', '#5a4a3e', '#30241a'), size: 0.8 },
    fact: 'Gleans insects off leaves and bark as well as catching them in flight. Listed as endangered in the US in 2023, largely because of white-nose syndrome.',
  },
  {
    id: 'indiana', name: 'Indiana Bat', short: 'Indiana', species: 'Myotis sodalis', clans: ['INS'], rarity: 'epic',
    cost: 4, pattern: [[0, -1], [-1, 0], [1, 0], [0, 1]], roost: { hp: 160, count: 3, respawn: 5 },
    stats: { hp: 80, atk: 16, range: 30, rate: 0.7, speed: 55, knockbacks: 2 }, traits: [{ kind: 'hasteAura', pct: 15, radius: 100 }],
    evolved: { name: 'Cluster Keeper', trait: { kind: 'hasteAura', pct: 25, radius: 120 } }, talents: [hp(25), cheap],
    sprite: { template: 'vesper', palette: pal('#7a6a6a', '#5a4c4e', '#4e4448', '#2a2226', { n: '#d0a0a0' }), size: 0.75 },
    fact: 'Hibernates in dense clusters of hundreds of bats per square foot of cave ceiling. On the US endangered species list since 1967.',
  },
  {
    id: 'hoary', name: 'Hoary Bat', short: 'Hoary', species: 'Lasiurus cinereus', clans: ['INS'], rarity: 'rare',
    cost: 3, pattern: [[-2, 0], [2, 0]], roost: { hp: 140, count: 1, respawn: 7 },
    stats: { hp: 160, atk: 38, range: 40, rate: 0.9, speed: 90, knockbacks: 2 }, traits: [{ kind: 'knockChance', chance: 0.2 }],
    evolved: { name: 'Frost Wanderer', trait: { kind: 'knockChance', chance: 0.3 } }, talents: [atk(25), fast(20)],
    sprite: { template: 'vesper', palette: pal('#c8b8a0', '#8a7a64', '#6a5a48', '#3a2e22', { n: '#f0ece0' }), size: 1.15 },
    fact: 'A solitary tree-rooster with frosted, white-tipped fur that migrates long distances. A close relative, the Hawaiian hoary bat, is Hawaii\'s only native land mammal.',
  },
  {
    id: 'big_brown', name: 'Big Brown Bat', short: 'Big Brown', species: 'Eptesicus fuscus', clans: ['INS'], rarity: 'common',
    cost: 2, pattern: [[0, 1]], roost: { hp: 150, count: 2, respawn: 6 },
    stats: { hp: 120, atk: 18, range: 30, rate: 1.0, speed: 45, knockbacks: 2 }, traits: [],
    evolved: { name: 'Beetle Crusher', trait: { kind: 'knockChance', chance: 0.15 } }, talents: [hp(20), atk(20)],
    sprite: { template: 'vesper', palette: pal('#8a5a32', '#64401e', '#4a3426', '#281a10'), size: 0.95 },
    fact: 'Strong jaws let it crunch hard-shelled beetles. It has fared better against white-nose syndrome than most cave-hibernating bats, and often hibernates in buildings.',
  },
  {
    id: 'eastern_red', name: 'Eastern Red Bat', short: 'Red', species: 'Lasiurus borealis', clans: ['INS'], rarity: 'common',
    cost: 2, pattern: [[-1, 0]], roost: { hp: 90, count: 3, respawn: 5 },
    stats: { hp: 60, atk: 14, range: 25, rate: 0.7, speed: 60, knockbacks: 1 }, traits: [],
    evolved: { name: 'Autumn Leaf', trait: { kind: 'swarm', count: 4 } }, talents: [fast(20), cheap],
    sprite: { template: 'vesper', palette: pal('#d0602a', '#a04018', '#7a3a20', '#40180a', { n: '#f0d0b0' }), size: 0.8 },
    fact: 'Roosts alone in foliage, hanging like a dead leaf. Unlike most bats, which raise one pup a year, a female often raises three or four at once.',
  },
  {
    id: 'townsends', name: "Townsend's Big-eared Bat", short: "Townsend's", species: 'Corynorhinus townsendii', clans: ['INS'], rarity: 'rare',
    cost: 3, pattern: [[-1, -1], [1, -1]], roost: { hp: 110, count: 2, respawn: 6 },
    stats: { hp: 70, atk: 20, range: 120, rate: 1.0, speed: 45, knockbacks: 2 }, traits: [{ kind: 'multiHit', targets: 2 }],
    evolved: { name: 'Ram-horned Listener' }, talents: [atk(20), hp(20)],
    sprite: { template: 'micro', palette: pal('#8a7a6a', '#6a5a4c', '#5a4e44', '#2e2620', { n: '#d0a090' }), size: 0.85 },
    fact: 'Its ears are over an inch long. When it hibernates it curls them back against its head like a ram\'s horns.',
  },
  {
    id: 'pallid', name: 'Pallid Bat', short: 'Pallid', species: 'Antrozous pallidus', clans: ['INS'], rarity: 'epic',
    cost: 4, pattern: [[-1, 1], [0, 1], [1, 1]], roost: { hp: 220, count: 2, respawn: 9 },
    stats: { hp: 180, atk: 40, range: 35, rate: 1.2, speed: 40, knockbacks: 3 }, traits: [{ kind: 'aoe' }],
    evolved: { name: 'Scorpion Eater', trait: { kind: 'lifesteal', pct: 20 } }, talents: [hp(25), atk(20)],
    sprite: { template: 'micro', palette: pal('#e8d8b0', '#c0a880', '#b09a80', '#6a5a46', { e: '#2a1a10' }), size: 1.05 },
    fact: 'Hunts on the ground for scorpions and centipedes, finding them by the sound of their footsteps, and appears largely resistant to bark scorpion venom.',
  },

  // ---------- Frugivore ----------
  {
    id: 'jamaican_fruit', name: 'Jamaican Fruit Bat', short: 'Jamaican', species: 'Artibeus jamaicensis', clans: ['FRU'], rarity: 'common',
    cost: 2, pattern: [[1, -1]], roost: { hp: 220, count: 2, respawn: 7 },
    stats: { hp: 180, atk: 14, range: 30, rate: 1.2, speed: 32, knockbacks: 3 }, traits: [],
    evolved: { name: 'Fig Courier', trait: { kind: 'healAura', amount: 8, every: 2, radius: 80 } }, talents: [hp(20), cheap],
    sprite: { template: 'fruit', palette: pal('#7a7068', '#58504a', '#4a4440', '#262220', { n: '#e8e0d0' }), size: 0.95 },
    fact: 'Carries figs off to a feeding roost to eat them, dropping seeds along the way and spreading fig trees through the forest.',
  },
  {
    id: 'sebas', name: "Seba's Short-tailed Bat", short: "Seba's", species: 'Carollia perspicillata', clans: ['FRU'], rarity: 'rare',
    cost: 3, pattern: [[-1, 0], [0, 1]], roost: { hp: 200, count: 3, respawn: 6 },
    stats: { hp: 120, atk: 12, range: 30, rate: 1.1, speed: 40, knockbacks: 2 }, traits: [{ kind: 'healAura', amount: 10, every: 2, radius: 100 }],
    evolved: { name: 'Forest Mender' }, talents: [hp(20), cheap],
    sprite: { template: 'nectar', palette: pal('#6a5040', '#4c382c', '#46382e', '#241a14'), size: 0.85 },
    fact: 'Favours pioneer shrubs such as pepper plants (Piper), so the seeds it drops help cleared Neotropical forest grow back.',
  },
  {
    id: 'epauletted', name: "Wahlberg's Epauletted Fruit Bat", short: 'Epaulet', species: 'Epomophorus wahlbergi', clans: ['FRU'], rarity: 'rare',
    cost: 3, pattern: [[-1, 0], [1, 0], [0, -1]], roost: { hp: 280, count: 2, respawn: 8 },
    stats: { hp: 240, atk: 16, range: 35, rate: 1.2, speed: 32, knockbacks: 3 }, traits: [{ kind: 'knockChance', chance: 0.15 }],
    evolved: { name: 'Courting Drummer' }, talents: [hp(25), atk(20)],
    sprite: { template: 'fruit', palette: pal('#c8a070', '#9a764c', '#7a5e44', '#3e2c1c', { n: '#ffffff' }), size: 1.1 },
    fact: 'Males have tufts of white fur on their shoulders, the "epaulettes", which they flare while calling to attract females.',
  },

  // ---------- Piscivore ----------
  {
    id: 'rickett', name: "Rickett's Big-footed Bat", short: "Rickett's", species: 'Myotis pilosus', clans: ['PIS'], rarity: 'rare',
    cost: 3, pattern: [[0, -1], [0, -2]], roost: { hp: 130, count: 2, respawn: 8 },
    stats: { hp: 90, atk: 40, range: 170, rate: 1.6, speed: 35, knockbacks: 2 }, traits: [],
    evolved: { name: 'River Raker', trait: { kind: 'multiHit', targets: 2 } }, talents: [atk(25), cheap],
    sprite: { template: 'bulldog', palette: pal('#8a7a6a', '#6a5a4c', '#5a5050', '#2a2424'), size: 0.9 },
    fact: 'One of the few bats known to catch fish, raking them from the water with its oversized feet. It is found mainly in China.',
  },
  {
    id: 'daubentons', name: "Daubenton's Bat", short: 'Daubenton', species: 'Myotis daubentonii', clans: ['PIS'], rarity: 'common',
    cost: 2, pattern: [[1, 0], [1, 1]], roost: { hp: 100, count: 2, respawn: 5 },
    stats: { hp: 60, atk: 16, range: 120, rate: 1.0, speed: 45, knockbacks: 2 }, traits: [],
    evolved: { name: 'Canal Skimmer', trait: { kind: 'multiHit', targets: 2 } }, talents: [atk(20), fast(20)],
    sprite: { template: 'vesper', palette: pal('#9a8a7a', '#6e6052', '#5a5048', '#2e2822', { n: '#e0d8cc' }), size: 0.8 },
    fact: 'Skims low over ponds and canals, gaffing insects off the water\'s surface with its feet and tail membrane.',
  },

  // ---------- Nectarivore ----------
  {
    id: 'mexican_long_tongued', name: 'Mexican Long-tongued Bat', short: 'Mex Tongue', species: 'Choeronycteris mexicana', clans: ['NEC'], rarity: 'rare',
    cost: 3, pattern: [[-1, -1], [0, -1], [1, -1]], roost: { hp: 130, count: 3, respawn: 6 },
    stats: { hp: 90, atk: 9, range: 130, rate: 1.1, speed: 42, knockbacks: 2 }, traits: [{ kind: 'atkAura', pct: 20, radius: 130 }],
    evolved: { name: 'Night Bloom', trait: { kind: 'atkAura', pct: 30, radius: 140 } }, talents: [hp(20), cheap],
    sprite: { template: 'nectar', palette: pal('#8a7a7a', '#685a5a', '#5e5058', '#30282c', { n: '#e0a0b0' }), size: 0.85 },
    fact: 'Its tongue can reach about a third of its body length. It feeds at agave and columnar cactus flowers in Mexico and the US Southwest.',
  },
  {
    id: 'greater_long_nosed', name: 'Greater Long-nosed Bat', short: 'Gr Longnose', species: 'Leptonycteris nivalis', clans: ['NEC'], rarity: 'epic',
    cost: 4, pattern: [[0, -1], [0, 1], [-1, -1], [1, 1]], roost: { hp: 170, count: 3, respawn: 8 },
    stats: { hp: 140, atk: 14, range: 150, rate: 1.0, speed: 45, knockbacks: 2 },
    traits: [{ kind: 'hasteAura', pct: 25, radius: 150 }, { kind: 'healAura', amount: 10, every: 2, radius: 120 }],
    evolved: { name: 'Agave Pilgrim' }, talents: [hp(25), cheap],
    sprite: { template: 'nectar', palette: pal('#a08068', '#7a5e4a', '#6a5464', '#3a2a34', { n: '#ffb0d0' }), size: 1.0 },
    fact: 'Follows the bloom of agaves north each summer. It is listed as endangered in the US.',
  },
  {
    id: 'geoffroys_tailless', name: "Geoffroy's Tailless Bat", short: 'Tailless', species: 'Anoura geoffroyi', clans: ['NEC'], rarity: 'common',
    cost: 2, pattern: [[1, 1]], roost: { hp: 110, count: 3, respawn: 6 },
    stats: { hp: 70, atk: 10, range: 110, rate: 1.1, speed: 42, knockbacks: 2 }, traits: [{ kind: 'hasteAura', pct: 15, radius: 110 }],
    evolved: { name: 'Pollen Dancer', trait: { kind: 'hasteAura', pct: 25, radius: 120 } }, talents: [fast(20), cheap],
    sprite: { template: 'nectar', palette: pal('#5a4a4a', '#403434', '#4a3a44', '#241c22'), size: 0.85 },
    fact: 'Has no visible tail and a long snout. Besides nectar it eats pollen and insects.',
  },

  // ---------- Matriarch (legendary) ----------
  {
    id: 'greater_noctule', name: 'Greater Noctule', short: 'Noctule', species: 'Nyctalus lasiopterus', clans: ['INS', 'PIS'], rarity: 'legendary', matriarch: true,
    cost: 5, pattern: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]], roost: { hp: 400, count: 1, respawn: 15 },
    stats: { hp: 420, atk: 60, range: 160, rate: 1.3, speed: 80, knockbacks: 3 },
    traits: [{ kind: 'multiHit', targets: 2 }, { kind: 'knockChance', chance: 0.2 }],
    evolved: { name: 'Sky Raptor', trait: { kind: 'multiHit', targets: 3 } }, talents: [atk(25), fast(20)],
    sprite: { template: 'vesper', palette: pal('#b07040', '#804a24', '#6a4a36', '#341e10'), size: 1.45, crown: true },
    fact: "Europe's largest bat. Part of its diet is songbirds, which it catches in flight during their night-time migrations.",
  },
];

export const BAT_BY_ID: Record<string, BatDef> = Object.fromEntries(BATS.map((b) => [b.id, b]));
export const STARTER_MATRIARCHS = ['flying_fox', 'ghost_bat', 'spectral_bat'];
/** One common from each clan for a new player. Explicit, so adding commons doesn't change the starter gift. */
export const STARTER_COMMONS = ['egyptian_fruit', 'little_brown', 'common_vampire', 'lesser_bulldog', 'pallas_tongue'];
