import { BAT_BY_ID } from '../data/bats';
import { ENEMY_BY_ID } from '../data/enemies';
import { BAT_CROWN, BAT_HEADS, BAT_WINGS, ENEMY_SPRITES } from '../data/sprites';

/** Base pixel size for a size-1 sprite, in canvas pixels. */
export const PX = 2;

const cache = new Map<string, HTMLCanvasElement>();

export function gridToCanvas(grid: string[], palette: Record<string, string | undefined>, px: number): HTMLCanvasElement {
  const w = Math.max(...grid.map((r) => r.length));
  const c = document.createElement('canvas');
  c.width = w * px;
  c.height = grid.length * px;
  const g = c.getContext('2d')!;
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = palette[row[x]];
      if (row[x] === '.' || !col) continue;
      g.fillStyle = col;
      g.fillRect(x * px, y * px, px, px);
    }
  });
  return c;
}

/** Compose the 16-wide bat grid: wings frame, head overlay, optional crown, mirrored. */
export function batGrid(batId: string, frame: 0 | 1): string[] {
  const def = BAT_BY_ID[batId];
  const head = BAT_HEADS[def.sprite.template];
  const half = BAT_WINGS[frame].map((row, y) => {
    let out = '';
    for (let x = 0; x < 8; x++) out += head[y][x] !== '.' ? head[y][x] : row[x];
    return out;
  });
  if (def.sprite.crown) {
    BAT_CROWN.forEach((row, y) => {
      half[y] = [...half[y]].map((ch, x) => (row[x] !== '.' ? row[x] : ch)).join('');
    });
  }
  return half.map((row) => {
    // Mirror; asymmetric details (single fang) stay on the left only.
    const right = [...row].reverse().join('').replace(/f/g, '.');
    return row + right;
  });
}

export function batSprite(batId: string, frame: 0 | 1, scale = 1): HTMLCanvasElement {
  const def = BAT_BY_ID[batId];
  const px = Math.max(1, Math.round(PX * def.sprite.size * scale));
  const key = `bat:${batId}:${frame}:${px}`;
  let c = cache.get(key);
  if (!c) {
    c = gridToCanvas(batGrid(batId, frame), def.sprite.palette, px);
    cache.set(key, c);
  }
  return c;
}

export function enemySprite(enemyId: string, flash = false, scale = 1): HTMLCanvasElement {
  const def = ENEMY_BY_ID[enemyId];
  const px = Math.max(1, Math.round(PX * def.size * scale));
  const key = `enemy:${enemyId}:${flash}:${px}`;
  let c = cache.get(key);
  if (!c) {
    const s = ENEMY_SPRITES[def.sprite];
    const pal = flash ? Object.fromEntries(Object.keys(s.palette).map((k) => [k, '#ffffff'])) : s.palette;
    c = gridToCanvas(s.grid, pal, px);
    cache.set(key, c);
  }
  return c;
}

/** A crisp data URL for use in DOM <img> (cards, roster). */
const urlCache = new Map<string, string>();
export function batImageUrl(batId: string, scale = 2): string {
  const key = `${batId}:${scale}`;
  let u = urlCache.get(key);
  if (!u) {
    const def = BAT_BY_ID[batId];
    // Normalise size for UI so small bats aren't tiny; keep commanders a bit bigger.
    const s = (scale * (def.commander ? 1.15 : 1)) / def.sprite.size;
    u = batSprite(batId, 0, s).toDataURL();
    urlCache.set(key, u);
  }
  return u;
}

export function enemyImageUrl(enemyId: string, scale = 2): string {
  const key = `e:${enemyId}:${scale}`;
  let u = urlCache.get(key);
  if (!u) {
    u = enemySprite(enemyId, false, scale / ENEMY_BY_ID[enemyId].size).toDataURL();
    urlCache.set(key, u);
  }
  return u;
}
