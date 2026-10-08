/**
 * Hand-authored pixel art as character grids. '.' is transparent; other characters
 * index into a palette. Bats are authored as the LEFT HALF (8 columns) and mirrored,
 * so they are always symmetric. Replace any entry here with real art later.
 */

/** Wings + body, two flap frames. 14 rows × 8 cols (left half). */
export const BAT_WINGS: [string[], string[]] = [
  [
    '........',
    '........',
    'o.......',
    'Wo......',
    'wWo.....',
    'wwWo....',
    'wwwWo...',
    'wwwwWobb',
    'wwwwwobb',
    '.wwwwobb',
    '..w.wobB',
    '.....oBB',
    '......o.',
    '........',
  ],
  [
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '......bb',
    '....oobb',
    '..oowWbb',
    '.owwwwbb',
    'owwwwWbB',
    'oWwwW.oB',
    'W..W..o.',
    '........',
  ],
];

/** Head overlays, drawn on top of the body. Same 14×8 frame; '.' leaves what's below. */
export const BAT_HEADS: Record<string, string[]> = {
  // Fox-faced fruit bat: small round ears, big eyes, long muzzle.
  fruit: [
    '........',
    '........',
    '....oo..',
    '....obo.',
    '....obbo',
    '...obbbb',
    '...obebb',
    '....obbB',
    '.....obn',
    '......oo',
    '........',
    '........',
    '........',
    '........',
  ],
  // Microbat: huge ears, tiny eyes, pug nose.
  micro: [
    '...oo...',
    '...obo..',
    '...obbo.',
    '...obnbo',
    '...obnbo',
    '....obbb',
    '....oebb',
    '....obbB',
    '.....obn',
    '........',
    '........',
    '........',
    '........',
    '........',
  ],
  // Vampire: pointed ears, red-rimmed eyes, fangs.
  vampire: [
    '........',
    '....o...',
    '....oo..',
    '....obo.',
    '....obbo',
    '....obbb',
    '....oebb',
    '....obbn',
    '.....obB',
    '......of',
    '........',
    '........',
    '........',
    '........',
  ],
  // Bulldog/fishing bat: round head, heavy drooping lips.
  bulldog: [
    '........',
    '........',
    '.....o..',
    '....obo.',
    '....obbo',
    '...obbbb',
    '...obebb',
    '...obbbb',
    '...onnBB',
    '....onnn',
    '.....ooo',
    '........',
    '........',
    '........',
  ],
  // Nectar bat: small ears, long narrow snout with a tongue tip.
  nectar: [
    '........',
    '........',
    '.....o..',
    '....obo.',
    '....obbo',
    '....obbb',
    '....oebb',
    '.....obB',
    '......ob',
    '......ob',
    '......on',
    '.......n',
    '........',
    '........',
  ],
  // Vesper bat (hoary, red, big brown…): short rounded ears, broad furry face.
  vesper: [
    '........',
    '........',
    '........',
    '....oo..',
    '...obbo.',
    '...obbbo',
    '...obebb',
    '...obbbb',
    '....obBn',
    '.....obB',
    '......oo',
    '........',
    '........',
    '........',
  ],
  // Fledgling: oversized head and eyes.
  fledgling: [
    '........',
    '........',
    '........',
    '....oo..',
    '...obbo.',
    '...obbbb',
    '...oeebb',
    '...oeebb',
    '....obbB',
    '.....obn',
    '........',
    '........',
    '........',
    '........',
  ],
};

/**
 * Wings folded around the body, for bats hanging in a roost (left half, 14 rows).
 * Drawn under the head; the roost renderer flips it so the bat hangs by its feet.
 */
export const BAT_FOLDED: string[] = [
  '........',
  '........',
  '........',
  '........',
  '........',
  '.....ooo',
  '....oWWb',
  '...oWwwb',
  '...oWwwb',
  '...oWwwb',
  '...oWwwB',
  '....oWwB',
  '.....oWo',
  '......o.',
];

/** Armour colours added to every palette for roosts at the armour level. */
export const ARMOR_PALETTE = { a: '#c8d0e0', A: '#7a8296', g: '#e8c040' };

/** Crown overlay for commanders (rows 0–1, half). */
export const BAT_CROWN = ['.....c.c', '.....ccc'];

export interface EnemySprite {
  grid: string[];
  palette: Record<string, string>;
}

/** Enemies face right (toward the player's cave). */
export const ENEMY_SPRITES: Record<string, EnemySprite> = {
  moth: {
    palette: { o: '#2a2010', w: '#c8b080', W: '#8a7048', b: '#5a4628', e: '#ff3030' },
    grid: [
      '...o....o...',
      '....o..o....',
      '.www.oo.www.',
      'wwWwwbbwwWww',
      'wWwwwbbwwwWw',
      '.wwwobbowww.',
      '..ww.bb.ww..',
      '.....oo.....',
    ],
  },
  // Tiger moths (Arctiinae) answer bat calls with ultrasonic clicks that can jam sonar.
  tigerMoth: {
    palette: { o: '#1a0c08', w: '#f0a030', W: '#1a1010', b: '#c03020', e: '#ffffff' },
    grid: [
      '...o....o...',
      '....o..o....',
      '.WwW.oo.WwW.',
      'wWwWwbbwWwWw',
      'WwWwwbbwwWwW',
      '.wWwobbowWw.',
      '..wW.bb.Ww..',
      '.....oo.....',
    ],
  },
  beetle: {
    palette: { o: '#100c08', B: '#3a2a50', b: '#5a4478', h: '#8a74b0', l: '#22180c', e: '#c0c040' },
    grid: [
      '..............',
      '....oooooo....',
      '...obhbbbbo...',
      '..obhbbbbbbooo',
      '.obbbbbbbbBoeo',
      '.oBBBBBBBBBooo',
      '..oooooooooo..',
      '..l.l..l.l....',
      '.l...l..l..l..',
    ],
  },
  snake: {
    palette: { o: '#14200c', b: '#6a8a3a', B: '#4a6a24', y: '#d8c060', e: '#ffe040', t: '#e03030' },
    grid: [
      '...........ooo..',
      '..........obbbo.',
      '..ooo....obbebot',
      '.obbbo..obBbbo.t',
      'obByBbooBbyo....',
      'oBbbyBbbbyBo....',
      '.ooBbbbyBoo.....',
      '...ooooooo......',
    ],
  },
  spider: {
    palette: { o: '#0c0a10', b: '#c09030', B: '#7a5a1a', y: '#f0e070', e: '#ff4040', l: '#2a2018' },
    grid: [
      'l...l..l...l',
      '.l..l..l..l.',
      '..l.oooo.l..',
      'lllobyyBolll',
      '..obbBbbbo..',
      'llobyBBybolll',
      '..l.oooo.l..',
      '.l..oeeo..l.',
      'l...l..l...l',
    ],
  },
  cat: {
    palette: { o: '#140c0c', b: '#e09040', B: '#a86020', w: '#f8e8d0', e: '#80ff60', p: '#ff9aa0' },
    grid: [
      '.........o...o',
      '.........oo.oo',
      '........obbbbo',
      '..o.....obebeo',
      '.obo....obwpwo',
      '.obo.ooooobwo.',
      '..obobbbbbbbo.',
      '..obBbBbBbBbo.',
      '...obbbbbbbo..',
      '...ow.o.ow.o..',
      '...oo.o.oo.o..',
    ],
  },
  raccoon: {
    palette: { o: '#100c0c', b: '#9a9aa2', B: '#6a6a72', w: '#f4f0e8', m: '#16161a', e: '#ffe060', n: '#000000', r: '#26262c', l: '#d0d0d8', p: '#c89a7a' },
    grid: [
      '..........oo...oo.',
      '..........obo.obo.',
      '.........obbbbbbbo',
      '.........owwbbbwwo',
      '.........mmmmmmmmo',
      '.........mmemmmemo',
      '.........owwwwwwwn',
      'olo.......owwwwwo.',
      'orlo....oobbbbbbo.',
      '.olro.oobbBbBbBbbo',
      '..orlobbbBbbbbbbbo',
      '...olrbbbbbbbbbbo.',
      '....obbbbbbbbbbo..',
      '....opo.op..opo.op',
      '....oo..oo..oo..oo',
    ],
  },
  hawk: {
    palette: { o: '#140c08', b: '#7a5030', B: '#4a3018', w: '#e8dcc8', y: '#ffc020', e: '#000000', s: '#f0c060' },
    grid: [
      '..............',
      '.oo........oo.',
      'obBo......obbo',
      '.obBo....oBbo.',
      '..obBoooobBo..',
      '...obbbbbwwyo.',
      '....oBbbwesyy.',
      '....obBbwwo...',
      '.....obbbo....',
      '.....oyoyo....',
    ],
  },
  owl: {
    palette: { o: '#1a1008', b: '#d8a860', B: '#a87838', w: '#fff4e0', e: '#100808', k: '#e0a020' },
    grid: [
      '...oooooo...',
      '..owwwwwwo..',
      '.owwwwwwwwo.',
      '.owewwwweow.',
      '.owwwwwwwwo.',
      '..owwkkwwo..',
      '.obbowwobbo.',
      'obBbbbbbbBbo',
      'obbBbbbbBbbo',
      'obBbbBBbbBbo',
      '.obbbbbbbbo.',
      '..obbbbbbo..',
      '...okkokko..',
    ],
  },
  hornedOwl: {
    palette: { o: '#100804', b: '#8a6040', B: '#5a3a20', w: '#c8a070', e: '#ffb000', k: '#302010', t: '#e8e0d0' },
    grid: [
      '.oo......oo.',
      '.obo....obo.',
      '..oboooobo..',
      '.owwwwwwwwo.',
      '.owewkkweow.',
      '.owwwkkwwwo.',
      '..owtttwwo..',
      '.obbottobbo.',
      'obBbBbbBbBbo',
      'obbBbBBbBbbo',
      'obBbbBBbbBbo',
      '.obBbbbbBbo.',
      '..obbbbbbo..',
      '...okkokko..',
    ],
  },
};
