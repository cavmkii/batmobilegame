import { BALANCE } from '../data/balance';
import { BOSS_RULES, type BossRuleId } from '../data/bossRules';
import { ENCOUNTERS } from '../data/enemies';
import type { Rng } from './rng';

export type NodeType = 'battle' | 'elite' | 'shop' | 'rest' | 'event' | 'treasure' | 'boss';

export interface MapNode {
  id: string;
  row: number;
  /** 0..1 horizontal position, for drawing. */
  x: number;
  type: NodeType;
  next: string[];
  encounter?: string;
  /** Difficulty depth on the full 8-row scale (short saga maps stretch onto it). */
  depth?: number;
  bossRule?: BossRuleId;
}

export interface RunMap {
  nodes: Record<string, MapNode>;
  rows: string[][];
}

const MID_WEIGHTS: Record<Exclude<NodeType, 'boss'>, number> = {
  battle: 45,
  elite: 12,
  event: 16,
  shop: 12,
  treasure: 7,
  rest: 6,
};

function pickEncounter(rng: Rng, tier: 'battle' | 'elite' | 'boss', row: number): string {
  let ok = ENCOUNTERS.filter((e) => e.tier === tier && e.minRow <= row);
  // Early saga bosses sit shallower than the boss's usual row: use it anyway, scaled down by depth.
  if (!ok.length) ok = ENCOUNTERS.filter((e) => e.tier === tier);
  // Prefer encounters introduced recently so difficulty climbs with depth.
  const top = Math.max(...ok.map((e) => e.minRow));
  const recent = ok.filter((e) => e.minRow >= top - 1);
  return rng.pick(recent).id;
}

export function generateMap(rng: Rng, rows = BALANCE.run.rows, bossRule?: BossRuleId, maxDepth = BALANCE.run.rows - 1): RunMap {
  const fullRows = BALANCE.run.rows;
  const depthOf = (r: number) => (rows === fullRows ? r : Math.round((r * maxDepth) / (rows - 1)));
  const short = rows < fullRows;
  const nodes: Record<string, MapNode> = {};
  const rowIds: string[][] = [];
  const last = rows - 1;

  for (let r = 0; r < rows; r++) {
    const count = r === 0 ? 3 : r === last ? 1 : r === last - 1 ? 3 : rng.int(2, 4);
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      let type: NodeType;
      if (r === 0) type = 'battle';
      else if (r === last) type = 'boss';
      else if (r === last - 1) type = 'rest';
      else {
        const w = { ...MID_WEIGHTS };
        if (r < 2) w.elite = 0;
        if (r < 3) w.rest = 0;
        if (r === last - 2) w.rest = 0; // a rest row follows anyway
        // Short (saga) maps: the middle row is always a fight, so a run has 3 levels and a boss.
        if (short && r === 2) Object.assign(w, { event: 0, shop: 0, treasure: 0, rest: 0, battle: 70, elite: 30 });
        if (short && r !== 2) Object.assign(w, { elite: 0, battle: 25 });
        type = rng.weighted(w);
      }
      const id = `r${r}n${i}`;
      const jitter = r === last ? 0 : (rng.next() - 0.5) * 0.08;
      nodes[id] = { id, row: r, depth: depthOf(r), x: (i + 1) / (count + 1) + jitter, type, next: [] };
      if (type === 'battle' || type === 'elite' || type === 'boss') nodes[id].encounter = pickEncounter(rng, type, depthOf(r));
      if (type === 'boss') nodes[id].bossRule = bossRule ?? rng.pick(BOSS_RULES).id;
      ids.push(id);
    }
    rowIds.push(ids);
  }

  for (let r = 0; r < last; r++) {
    const from = rowIds[r].map((id) => nodes[id]);
    const to = rowIds[r + 1].map((id) => nodes[id]);
    const nearest = (n: MapNode, pool: MapNode[]) =>
      pool.reduce((best, c) => (Math.abs(c.x - n.x) < Math.abs(best.x - n.x) ? c : best));
    for (const a of from) {
      const b = nearest(a, to);
      a.next.push(b.id);
      // Sometimes branch to an adjacent node as well.
      const idx = to.indexOf(b);
      const side = to[idx + (rng.next() < 0.5 ? -1 : 1)];
      if (side && rng.next() < 0.45) a.next.push(side.id);
    }
    // Every node must be reachable.
    for (const b of to) {
      if (!from.some((a) => a.next.includes(b.id))) nearest(b, from).next.push(b.id);
    }
    for (const a of from) a.next.sort((x, y) => nodes[x].x - nodes[y].x);
  }
  return { nodes, rows: rowIds };
}
