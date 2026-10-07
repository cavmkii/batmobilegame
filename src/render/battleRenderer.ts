import { BALANCE } from '../data/balance';
import type { Battle, Entity } from '../game/battle';
import { Rng } from '../game/rng';
import { batSprite, enemySprite } from './pixel';

export const VIEW_W = 480;
// Height adapts to the screen (taller sky on portrait phones); set per battle in the constructor.
let VIEW_H = 240;
let GROUND = 206;
const LANE_L = 26;
const LANE_R = VIEW_W - 26;

export const laneToScreen = (x: number) => LANE_L + (x / BALANCE.lane.length) * (LANE_R - LANE_L);

export class BattleRenderer {
  private g: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, private battle: Battle, height = 240) {
    VIEW_H = Math.round(Math.min(620, Math.max(240, height)));
    GROUND = VIEW_H - 34;
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    this.g = canvas.getContext('2d')!;
    this.g.imageSmoothingEnabled = false;
    this.bg = makeBackground();
  }

  draw() {
    const g = this.g;
    const b = this.battle;
    g.drawImage(this.bg, 0, 0);
    if (b.time < b.buffs.slowUntil) {
      g.fillStyle = 'rgba(120,160,255,0.12)';
      g.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    drawRoost(g, laneToScreen(b.enemyBase.x), b.enemyBase.hp / b.enemyBase.maxHp);
    drawCave(g, laneToScreen(b.playerBase.x));

    const units = b.entities.filter((e) => e.kind === 'unit').sort((a, c) => c.depth - a.depth);
    for (const e of units) this.drawUnit(e);

    for (const fx of b.effects) {
      const age = (b.time - fx.t) / 0.8;
      const sx = laneToScreen(fx.x);
      const r = (fx.radius / BALANCE.lane.length) * (LANE_R - LANE_L);
      g.globalAlpha = Math.max(0, 1 - age);
      g.strokeStyle = { blast: '#ffa040', stun: '#ffe060', heal: '#70ff90', buff: '#ff70d0', slow: '#80a0ff', death: '#d0c0e0' }[fx.kind];
      g.lineWidth = 2;
      g.beginPath();
      if (fx.kind === 'death') g.arc(sx, GROUND - 14, 4 + age * 10, 0, Math.PI * 2);
      else g.ellipse(sx, GROUND - 10, Math.max(4, r * (0.4 + age * 0.6)), 10 + age * 8, 0, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }

    g.font = 'bold 9px monospace';
    g.textAlign = 'center';
    for (const f of b.floats) {
      const age = b.time - f.t;
      g.globalAlpha = Math.max(0, 1 - age / 1.2);
      g.fillStyle = '#000';
      const fx = laneToScreen(f.x);
      const fy = GROUND - 34 - f.depth * 26 - age * 22;
      g.fillText(f.text, fx + 1, fy + 1);
      g.fillStyle = f.color;
      g.fillText(f.text, fx, fy);
    }
    g.globalAlpha = 1;

    this.drawBaseBars();
  }

  private drawUnit(e: Entity) {
    const g = this.g;
    const b = this.battle;
    const knocked = e.knockTimer > 0;
    const lunge = e.sinceAttack < 0.12 ? (e.side === 'player' ? -4 : 4) : 0;
    const sx = laneToScreen(e.x) + lunge;
    let sy = GROUND - e.depth * 26;
    let img: HTMLCanvasElement;
    if (e.side === 'player') {
      const t = b.time - e.born + e.id * 0.37;
      const frame = (Math.floor(t * 6) % 2) as 0 | 1;
      sy -= 10 + Math.sin(t * 6) * 2;
      img = batSprite(e.defId, frame);
    } else {
      img = enemySprite(e.defId, e.sinceAttack < 0.06);
      if (e.stats.speed > 0 && !knocked && e.sinceAttack > 1) sy -= Math.abs(Math.sin((b.time + e.id) * 8)) * 1.5;
    }
    g.save();
    if (knocked) {
      g.translate(sx, sy - img.height / 2);
      g.rotate((e.side === 'player' ? 1 : -1) * 0.35);
      g.translate(-sx, -(sy - img.height / 2));
    }
    if (e.stunTimer > 0) g.globalAlpha = 0.7;
    // Shadow
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(sx - img.width / 3, GROUND - e.depth * 26 + 1, (img.width * 2) / 3, 2);
    g.drawImage(img, Math.round(sx - img.width / 2), Math.round(sy - img.height));
    g.restore();
    if (e.stunTimer > 0) {
      g.fillStyle = '#ffe060';
      g.fillText('✦', sx, sy - img.height - 2);
    }
    if (e.hp < e.maxHp) {
      const w = Math.max(14, img.width * 0.7);
      const y = sy - img.height - 4;
      g.fillStyle = '#000';
      g.fillRect(sx - w / 2 - 1, y - 1, w + 2, 4);
      g.fillStyle = e.side === 'player' ? '#62e27a' : '#e25a5a';
      g.fillRect(sx - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 2);
    }
  }

  private drawBaseBars() {
    const g = this.g;
    const b = this.battle;
    const bar = (x: number, align: 'left' | 'right', label: string, hp: number, max: number, color: string) => {
      const w = 150;
      const x0 = align === 'left' ? x : x - w;
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillRect(x0 - 2, 6, w + 4, 18);
      g.fillStyle = '#2a2030';
      g.fillRect(x0, 16, w, 6);
      g.fillStyle = color;
      g.fillRect(align === 'left' ? x0 : x0 + w * (1 - hp / max), 16, w * (hp / max), 6);
      g.fillStyle = '#fff';
      g.font = 'bold 8px monospace';
      g.textAlign = align;
      g.fillText(`${label} ${Math.ceil(hp)}/${max}`, align === 'left' ? x0 : x0 + w, 14);
    };
    bar(8, 'left', 'ROOST', b.enemyBase.hp, b.enemyBase.maxHp, '#e25a5a');
    bar(VIEW_W - 8, 'right', 'CAVE', b.playerBase.hp, b.playerBase.maxHp, '#62e27a');
    g.textAlign = 'center';
    g.fillStyle = '#c8bce0';
    g.font = '8px monospace';
    const t = Math.floor(b.time);
    g.fillText(`${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, VIEW_W / 2, 14);
  }
}

function makeBackground(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = VIEW_W;
  c.height = VIEW_H;
  const g = c.getContext('2d')!;
  const sky = g.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, '#0d0a1e');
  sky.addColorStop(1, '#2b1f48');
  g.fillStyle = sky;
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  const rng = new Rng(99);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = rng.next() < 0.2 ? '#fff6c8' : '#9a90c0';
    g.fillRect(Math.floor(rng.next() * VIEW_W), Math.floor(rng.next() * (GROUND - 66)), 1, 1);
  }
  // Moon
  g.fillStyle = '#f4ecc8';
  g.beginPath();
  const my = Math.max(52, GROUND - 154);
  g.arc(VIEW_W * 0.62, my, 16, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#d8cfa8';
  g.fillRect(VIEW_W * 0.62 - 5, my - 6, 3, 3);
  g.fillRect(VIEW_W * 0.62 + 4, my + 4, 4, 3);
  // Hills, stepped for a pixel look
  const hills = (base: number, amp: number, freq: number, color: string, phase: number) => {
    g.fillStyle = color;
    for (let x = 0; x < VIEW_W; x += 4) {
      const hgt = base + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.7 + phase) * amp * 0.4;
      g.fillRect(x, Math.round(hgt / 2) * 2, 4, GROUND - hgt + 2);
    }
  };
  hills(GROUND - 56, 14, 0.018, '#1e1636', 1);
  hills(GROUND - 31, 10, 0.03, '#171028', 3);
  // Ground
  g.fillStyle = '#1a2a1c';
  g.fillRect(0, GROUND, VIEW_W, VIEW_H - GROUND);
  g.fillStyle = '#2a4028';
  g.fillRect(0, GROUND, VIEW_W, 2);
  for (let x = 0; x < VIEW_W; x += 6) {
    g.fillStyle = rng.next() < 0.5 ? '#223620' : '#142016';
    g.fillRect(x, GROUND + 4 + Math.floor(rng.next() * 24), 2, 1);
  }
  return c;
}

function drawCave(g: CanvasRenderingContext2D, x: number) {
  g.fillStyle = '#4a4058';
  g.beginPath();
  g.moveTo(x - 24, GROUND + 2);
  g.lineTo(x - 18, GROUND - 40);
  g.lineTo(x - 4, GROUND - 58);
  g.lineTo(x + 14, GROUND - 52);
  g.lineTo(x + 30, GROUND - 30);
  g.lineTo(x + 32, GROUND + 2);
  g.closePath();
  g.fill();
  g.fillStyle = '#6a5e7a';
  g.fillRect(x - 10, GROUND - 54, 10, 4);
  g.fillRect(x + 6, GROUND - 48, 8, 3);
  g.fillStyle = '#0a0610';
  g.beginPath();
  g.ellipse(x - 2, GROUND, 13, 26, 0, Math.PI, 0);
  g.fill();
  g.fillStyle = '#ffe14a';
  g.fillRect(x - 6, GROUND - 14, 1, 1);
  g.fillRect(x + 1, GROUND - 18, 1, 1);
}

function drawRoost(g: CanvasRenderingContext2D, x: number, hpPct: number) {
  g.fillStyle = '#3a2a1e';
  g.fillRect(x - 6, GROUND - 70, 10, 72);
  g.fillRect(x - 18, GROUND - 60, 14, 4);
  g.fillRect(x + 2, GROUND - 48, 18, 4);
  g.fillRect(x - 14, GROUND - 76, 4, 18);
  g.fillRect(x + 14, GROUND - 58, 4, 12);
  // Nest
  g.fillStyle = '#6a4a2a';
  g.fillRect(x - 12, GROUND - 78, 22, 6);
  g.fillStyle = '#8a6a3a';
  g.fillRect(x - 10, GROUND - 80, 18, 2);
  // Owl eyes in the hollow, dimming as the roost falls
  g.fillStyle = '#0a0606';
  g.fillRect(x - 4, GROUND - 40, 8, 10);
  if (hpPct > 0) {
    g.fillStyle = hpPct > 0.5 ? '#ffb000' : '#a06000';
    g.fillRect(x - 3, GROUND - 37, 2, 2);
    g.fillRect(x + 1, GROUND - 37, 2, 2);
  }
}
