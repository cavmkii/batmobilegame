import { BALANCE } from '../data/balance';
import { BAT_BY_ID } from '../data/bats';
import { CLANS } from '../data/clans';
import { TERRAIN } from '../data/terrain';
import type { Defense } from '../game/defense';
import { Rng } from '../game/rng';
import { batSprite, enemySprite } from './pixel';

const F = BALANCE.field;
export const VIEW_W = 300;
export const VIEW_H = 460;
const TX = VIEW_W / F.cols;
const TY = 42;
const OY = 22;

export const toScreen = (x: number, y: number) => ({ sx: x * TX, sy: OY + y * TY });

export interface Highlight {
  /** slot idx -> 'ok' | 'bonus' (terrain match) */
  slots: Map<number, 'ok' | 'bonus'>;
  batId: string | null;
}

export class FieldRenderer {
  private g: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, private d: Defense) {
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    this.g = canvas.getContext('2d')!;
    this.g.imageSmoothingEnabled = false;
    this.bg = makeBackground();
  }

  /** Canvas pixel → roost slot index, or -1. */
  slotAt(px: number, py: number): number {
    for (const s of this.d.slots) {
      const { sx, sy } = toScreen(s.x, s.y);
      if (Math.abs(px - sx) <= TX / 2 && Math.abs(py - sy) <= TY / 2) return s.idx;
    }
    return -1;
  }

  draw(hl: Highlight) {
    const g = this.g;
    const d = this.d;
    g.drawImage(this.bg, 0, 0);
    if (d.phase === 'night' && d.time < d.buffs.slowUntil) {
      g.fillStyle = 'rgba(120,160,255,0.12)';
      g.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (d.phase === 'day') this.drawDaylight();

    this.drawSlots(hl);
    if (d.phase === 'day') this.drawPreview();
    this.drawCave();

    const units = [...d.units].sort((a, b) => a.y - b.y);
    for (const u of units) this.drawUnit(u);
    this.drawFx();
  }

  private drawDaylight() {
    // Dusk wash: the field reads as "planning" rather than "fighting".
    const g = this.g;
    const grad = g.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, 'rgba(255,170,90,0.10)');
    grad.addColorStop(1, 'rgba(120,60,140,0.05)');
    g.fillStyle = grad;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  private drawSlots(hl: Highlight) {
    const g = this.g;
    const d = this.d;
    for (const s of d.slots) {
      const { sx, sy } = toScreen(s.x, s.y);
      const x0 = sx - TX / 2 + 3;
      const y0 = sy - TY / 2 + 3;
      const w = TX - 6;
      const h = TY - 6;
      g.fillStyle = s.terrain ? TERRAIN[s.terrain].color + 'cc' : 'rgba(40,30,60,0.55)';
      g.fillRect(x0, y0, w, h);
      g.strokeStyle = 'rgba(255,255,255,0.08)';
      g.lineWidth = 1;
      g.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
      if (s.terrain) {
        g.font = '14px sans-serif';
        g.textAlign = 'left';
        g.globalAlpha = s.roost ? 0.6 : 1;
        g.fillText(TERRAIN[s.terrain].icon, x0 + 2, y0 + 15);
        g.globalAlpha = 1;
      }
      const mark = hl.slots.get(s.idx);
      if (mark) {
        g.strokeStyle = mark === 'bonus' ? '#7dff9a' : '#ffc23d';
        g.lineWidth = 2;
        g.setLineDash([4, 3]);
        g.strokeRect(x0 + 1, y0 + 1, w - 2, h - 2);
        g.setLineDash([]);
        if (hl.batId) {
          const n = d.neighbourMatches(s.idx, hl.batId);
          if (n) {
            g.fillStyle = '#7dff9a';
            g.font = 'bold 9px monospace';
            g.textAlign = 'right';
            g.fillText(`+${n}`, x0 + w - 3, y0 + h - 4);
          }
        }
      }
      if (s.roost) this.drawRoost(s.roost, sx, sy, x0, y0, w, h);
    }
  }

  private drawRoost(r: NonNullable<Defense['slots'][number]['roost']>, sx: number, sy: number, x0: number, y0: number, w: number, h: number) {
    const g = this.g;
    const def = BAT_BY_ID[r.batId];
    // Perch: a branch across the top of the tile.
    g.fillStyle = '#4a3424';
    g.fillRect(x0 + 4, y0 + 6, w - 8, 3);
    g.fillStyle = '#6a4a30';
    g.fillRect(x0 + 4, y0 + 6, w - 8, 1);
    // Roosting bats hang upside down by day; at night the tile shows an empty perch with a marker.
    const img = batSprite(r.batId, 0, 0.8);
    if (this.d.phase !== 'night') {
      g.save();
      g.translate(sx, y0 + 9);
      g.scale(1, -1);
      g.drawImage(img, -img.width / 2, -img.height);
      g.restore();
    } else {
      g.globalAlpha = 0.35;
      g.drawImage(img, sx - img.width / 2, sy - img.height / 2);
      g.globalAlpha = 1;
    }
    // Clan stripe
    def.clans.forEach((c, i) => {
      g.fillStyle = CLANS[c].color;
      g.fillRect(x0 + 2 + i * 5, y0 + h - 6, 4, 4);
    });
    // HP bar
    const pct = Math.max(0, r.hp / r.maxHp);
    g.fillStyle = '#000';
    g.fillRect(x0 + 4, y0 + h - 2, w - 8, 3);
    g.fillStyle = pct > 0.5 ? '#62e27a' : pct > 0.25 ? '#e2c25a' : '#e25a5a';
    g.fillRect(x0 + 4, y0 + h - 2, (w - 8) * pct, 3);
    // Nights left (∞ for the commander)
    g.font = 'bold 9px monospace';
    g.textAlign = 'right';
    g.fillStyle = r.card ? '#ffe8a0' : '#ffc23d';
    g.fillText(r.card ? `${r.nightsLeft}🌙` : '♛', x0 + w - 2, y0 + 18);
  }

  private drawPreview() {
    const g = this.g;
    const byCol = new Map<number, { enemy: string; count: number }[]>();
    for (const grp of this.d.tonight) {
      const list = byCol.get(grp.col) ?? [];
      list.push(grp);
      byCol.set(grp.col, list);
    }
    for (const [col, list] of byCol) {
      const cx = (col + 0.5) * TX;
      // Column wash and arrow
      g.fillStyle = 'rgba(255,90,90,0.08)';
      g.fillRect(col * TX + 2, OY, TX - 4, F.roostTopY * TY - 4);
      list.forEach((grp, i) => {
        const img = enemySprite(grp.enemy, false, 0.8);
        const y = OY + 4 + i * 28;
        g.drawImage(img, cx - img.width / 2 - 8, y);
        g.font = 'bold 11px monospace';
        g.textAlign = 'left';
        g.fillStyle = '#000';
        g.fillText(`×${grp.count}`, cx + 7, y + 17);
        g.fillStyle = '#ffd0d0';
        g.fillText(`×${grp.count}`, cx + 6, y + 16);
      });
      g.fillStyle = 'rgba(255,120,120,0.55)';
      for (let y = OY + 26 + list.length * 28; y < OY + F.roostTopY * TY - 14; y += 16) {
        g.beginPath();
        g.moveTo(cx - 6, y);
        g.lineTo(cx + 6, y);
        g.lineTo(cx, y + 8);
        g.closePath();
        g.fill();
      }
    }
  }

  private drawCave() {
    const g = this.g;
    const top = OY + F.caveY * TY;
    g.fillStyle = '#3a3048';
    g.fillRect(0, top, VIEW_W, VIEW_H - top);
    g.fillStyle = '#4a4058';
    for (let x = 0; x < VIEW_W; x += 12) g.fillRect(x, top - ((x * 7) % 5), 12, 6);
    g.fillStyle = '#0a0610';
    g.beginPath();
    g.ellipse(VIEW_W / 2, VIEW_H, 46, 34, 0, Math.PI, 0);
    g.fill();
    // Eyes in the dark
    g.fillStyle = '#ffe14a';
    g.fillRect(VIEW_W / 2 - 12, VIEW_H - 16, 2, 2);
    g.fillRect(VIEW_W / 2 + 8, VIEW_H - 20, 2, 2);
  }

  private drawUnit(u: Defense['units'][number]) {
    const g = this.g;
    const d = this.d;
    let { sx, sy } = toScreen(u.x, u.y);
    let img: HTMLCanvasElement;
    if (u.side === 'bat') {
      const t = d.clock + u.id * 0.37;
      img = batSprite(u.defId, (Math.floor(t * 7) % 2) as 0 | 1, 0.85);
      sy += Math.sin(t * 6) * 2;
    } else {
      img = enemySprite(u.defId, u.sinceAttack < 0.06, 0.9);
      if (u.knockTimer <= 0 && u.sinceAttack > 1) sy -= Math.abs(Math.sin((d.clock + u.id) * 8)) * 1.5;
    }
    if (u.sinceAttack < 0.12) {
      const dx = u.aimX - u.x;
      const dy = u.aimY - u.y;
      const len = Math.hypot(dx, dy) || 1;
      sx += (dx / len) * 3;
      sy += (dy / len) * 3;
      if (u.side === 'bat' && u.stats.range > 0.8) {
        // Ranged bats: a sonar streak to the target.
        const a = toScreen(u.aimX, u.aimY);
        g.strokeStyle = 'rgba(160,220,255,0.6)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(sx, sy);
        g.lineTo(a.sx, a.sy);
        g.stroke();
      }
    }
    if (u.stunTimer > 0) g.globalAlpha = 0.7;
    g.drawImage(img, Math.round(sx - img.width / 2), Math.round(sy - img.height / 2));
    g.globalAlpha = 1;
    if (u.stunTimer > 0) {
      g.fillStyle = '#ffe060';
      g.font = '10px sans-serif';
      g.textAlign = 'center';
      g.fillText('✦', sx, sy - img.height / 2 - 2);
    }
    if (u.traits.some((t) => t.kind === 'jammer')) {
      g.strokeStyle = 'rgba(255,140,40,0.25)';
      g.beginPath();
      g.arc(sx, sy, 1.6 * TX * 0.9, 0, Math.PI * 2);
      g.stroke();
    }
    if (u.hp < u.maxHp) {
      const w = Math.max(12, img.width * 0.7);
      const y = sy - img.height / 2 - 4;
      g.fillStyle = '#000';
      g.fillRect(sx - w / 2 - 1, y - 1, w + 2, 4);
      g.fillStyle = u.side === 'bat' ? '#62e27a' : '#e25a5a';
      g.fillRect(sx - w / 2, y, w * Math.max(0, u.hp / u.maxHp), 2);
    }
  }

  private drawFx() {
    const g = this.g;
    const d = this.d;
    for (const fx of d.effects) {
      const age = (d.clock - fx.t) / 0.8;
      const { sx, sy } = toScreen(fx.x, fx.y);
      g.globalAlpha = Math.max(0, 1 - age);
      g.strokeStyle = { blast: '#ffa040', stun: '#ffe060', heal: '#70ff90', buff: '#ff70d0', slow: '#80a0ff', death: '#d0c0e0', place: '#ffc23d' }[fx.kind];
      g.lineWidth = 2;
      g.beginPath();
      g.arc(sx, sy, Math.max(3, fx.r * TX * (0.4 + age * 0.6)), 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.font = 'bold 10px monospace';
    g.textAlign = 'center';
    for (const f of d.floats) {
      const age = d.clock - f.t;
      g.globalAlpha = Math.max(0, 1 - age / 1.2);
      const { sx, sy } = toScreen(f.x, f.y);
      const y = sy - 14 - age * 20;
      g.fillStyle = '#000';
      g.fillText(f.text, sx + 1, y + 1);
      g.fillStyle = f.color;
      g.fillText(f.text, sx, y);
    }
    g.globalAlpha = 1;
  }
}

function makeBackground(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = VIEW_W;
  c.height = VIEW_H;
  const g = c.getContext('2d')!;
  const sky = g.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, '#0d0a1e');
  sky.addColorStop(0.55, '#1c1634');
  sky.addColorStop(1, '#14201a');
  g.fillStyle = sky;
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  const rng = new Rng(42);
  for (let i = 0; i < 60; i++) {
    g.fillStyle = rng.next() < 0.2 ? '#fff6c8' : '#6a6090';
    g.fillRect(Math.floor(rng.next() * VIEW_W), Math.floor(rng.next() * 200), 1, 1);
  }
  // Treeline the enemies come out of
  g.fillStyle = '#0a1210';
  for (let x = 0; x < VIEW_W; x += 6) {
    const h = 10 + Math.abs(Math.sin(x * 0.11) * 12) + rng.next() * 6;
    g.fillRect(x, 0, 6, h);
  }
  // Column guides
  g.strokeStyle = 'rgba(255,255,255,0.04)';
  g.setLineDash([3, 6]);
  for (let col = 1; col < F.cols; col++) {
    g.beginPath();
    g.moveTo(col * TX, OY);
    g.lineTo(col * TX, OY + F.roostTopY * TY);
    g.stroke();
  }
  g.setLineDash([]);
  // Grass flecks lower down
  for (let i = 0; i < 120; i++) {
    g.fillStyle = rng.next() < 0.5 ? '#1e3020' : '#142016';
    g.fillRect(Math.floor(rng.next() * VIEW_W), 190 + Math.floor(rng.next() * 230), 2, 1);
  }
  return c;
}
