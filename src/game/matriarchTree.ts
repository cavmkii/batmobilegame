import { TREE_LINKS, treeNodes, type TreeEffect } from '../data/matriarchTree';
import type { OwnedBat } from './progression';

/** One point per matriarch level above 1 (plus-levels count). */
export const treePoints = (o: OwnedBat): number => Math.max(0, o.level + o.plus - 1);

const neighbours = (id: string) => TREE_LINKS.filter(([a, b]) => a === id || b === id).map(([a, b]) => (a === id ? b : a));

/** Allocated nodes, always including the root, ignoring ids this matriarch's tree doesn't have. */
export function allocated(matriarchId: string, o: OwnedBat): Set<string> {
  const ids = new Set(treeNodes(matriarchId).map((n) => n.id));
  return new Set(['root', ...(o.tree ?? []).filter((id) => ids.has(id))]);
}

export const pointsLeft = (matriarchId: string, o: OwnedBat) => treePoints(o) - (allocated(matriarchId, o).size - 1);

export function canAllocate(matriarchId: string, o: OwnedBat, id: string): boolean {
  const have = allocated(matriarchId, o);
  if (have.has(id) || !treeNodes(matriarchId).some((n) => n.id === id)) return false;
  return pointsLeft(matriarchId, o) > 0 && neighbours(id).some((n) => have.has(n));
}

/** A node can be refunded if everything else stays connected to the root. */
export function canRefund(matriarchId: string, o: OwnedBat, id: string): boolean {
  const have = allocated(matriarchId, o);
  if (id === 'root' || !have.has(id)) return false;
  have.delete(id);
  const seen = new Set(['root']);
  const queue = ['root'];
  while (queue.length) {
    for (const n of neighbours(queue.shift()!)) if (have.has(n) && !seen.has(n)) { seen.add(n); queue.push(n); }
  }
  return seen.size === have.size;
}

export function allocate(matriarchId: string, o: OwnedBat, id: string): boolean {
  if (!canAllocate(matriarchId, o, id)) return false;
  o.tree = [...(o.tree ?? []), id];
  return true;
}

export function refund(matriarchId: string, o: OwnedBat, id: string): boolean {
  if (!canRefund(matriarchId, o, id)) return false;
  o.tree = (o.tree ?? []).filter((x) => x !== id);
  return true;
}

/** Every effect from allocated nodes, for a run. Points over budget (e.g. after a save edit) are ignored from the end. */
export function treeEffects(matriarchId: string, o: OwnedBat | undefined): TreeEffect[] {
  if (!o) return [];
  const have = [...allocated(matriarchId, o)].slice(0, treePoints(o) + 1);
  const nodes = treeNodes(matriarchId);
  return have.flatMap((id) => nodes.find((n) => n.id === id)?.effects ?? []);
}

/** Sum of a numeric effect kind. */
export function treeSum(effects: TreeEffect[], kind: TreeEffect['kind']): number {
  return effects.reduce((a, e) => a + (e.kind === kind ? ('n' in e ? e.n : 'pct' in e ? e.pct : 0) : 0), 0);
}
