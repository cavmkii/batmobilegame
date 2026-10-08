import { BALANCE } from '../data/balance';
import { BAT_BY_ID } from '../data/bats';
import { RARITY_COLOR } from '../data/clans';
import { ENEMY_BY_ID } from '../data/enemies';
import { SPELL_BY_ID } from '../data/spells';
import { TERRAIN } from '../data/terrain';
import type { Card } from '../data/types';
import { Defense } from '../game/defense';
import { blueprint, describeTrait } from '../game/progression';
import { resolveBattle } from '../game/run';
import { FieldRenderer, VIEW_H, VIEW_W, type Highlight } from '../render/fieldRenderer';
import { registerScreen } from './app';
import { batImg, clanPips, patternGrid, rarityOf } from './components';
import { h } from './dom';
import { endRun } from './runScreens';

const hash = (s: string) => [...s].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);

type Sel = { kind: 'pool'; i: number } | { kind: 'spell'; i: number } | { kind: 'cmd' } | { kind: 'roost'; idx: number } | null;

function tonightSummary(d: Defense): string {
  const total = new Map<string, number>();
  for (const g of d.tonight) total.set(g.enemy, (total.get(g.enemy) ?? 0) + g.count);
  return [...total].map(([id, n]) => `${n} ${ENEMY_BY_ID[id].name}${n > 1 ? 's' : ''}`).join(', ');
}

const same = (a: Sel, b: Sel) => JSON.stringify(a) === JSON.stringify(b);

registerScreen('battle', (app) => {
  const r = app.profile.run!;
  const node = r.map.nodes[r.activeNode!];
  const d = new Defense({
    encounterId: node.encounter!,
    row: node.row,
    deck: r.deck,
    commanderId: r.commanderId,
    roster: app.profile.roster,
    relics: r.relics,
    caveHp: r.caveHp,
    caveMax: r.caveMax,
    seed: (r.rngState ^ hash(node.id)) >>> 0,
    biome: r.biome,
    modifiers: r.modifiers,
  });
  // Field guide: enemies count as met once their night begins.
  const meet = () => {
    const seen = new Set(app.profile.seenEnemies);
    let changed = false;
    for (const g of d.tonight) if (!seen.has(g.enemy)) { app.profile.seenEnemies.push(g.enemy); seen.add(g.enemy); changed = true; }
    if (changed) app.save();
  };
  // Exposed in dev builds so automated playtests can drive the level.
  if (import.meta.env.DEV) (window as unknown as { __defense: Defense }).__defense = d;

  const canvas = h('canvas.field-canvas');
  const renderer = new FieldRenderer(canvas, d);
  let sel: Sel = null;
  let speed = 1;
  let note = '';
  // Press and hold a bat card or a roost to preview which tiles its pattern gives +1.
  let peek: { batId: string; from: number | null } | null = null;
  let holdTimer = 0;
  const HOLD_MS = 350;
  const startHold = (batId: string, from: number | null) => {
    clearTimeout(holdTimer);
    holdTimer = window.setTimeout(() => { peek = { batId, from }; }, HOLD_MS);
  };
  const endHold = () => {
    clearTimeout(holdTimer);
    peek = null;
  };
  window.addEventListener('pointerup', endHold);
  window.addEventListener('pointercancel', endHold);

  /** Tiles that would get +1 from this bat's pattern: around one roost, or around every roost of that bat. */
  const peekTiles = (): Set<number> => {
    const out = new Set<number>();
    if (!peek) return out;
    const from = peek.from !== null ? [peek.from] : d.slots.filter((s) => s.roost?.batId === peek!.batId).map((s) => s.idx);
    for (const f of from) for (const t of d.patternTiles(f, peek.batId)) out.add(t.idx);
    return out;
  };

  const phaseLabel = h('span.phase');
  const caveFill = h('div');
  const caveText = h('span.small');
  const info = h('div.info-line');
  const guano = h('div.guano');
  const piles = h('span.small.muted');
  const refreshBtn = h('button.refresh', { onclick: () => { if (d.refresh()) { sel = null; note = 'New cards in the pool.'; } } });
  const endBtn = h('button.primary.end-day', { onclick: () => { sel = null; note = ''; meet(); d.endDay(); } }, 'End day ☾');
  const speedBtn = h('button.ghost.small', { onclick: () => { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; speedBtn.textContent = `${speed}×`; } }, '1×');
  const cards = h('div.hand-row');
  const overlay = h('div.battle-overlay');

  const selectedBat = (): string | null => {
    if (d.phase !== 'day' || !sel) return null;
    if (sel.kind === 'cmd') return d.commander.inPlay ? null : d.commander.bp.batId;
    if (sel.kind === 'pool') {
      const c = d.pool[sel.i];
      return c && c.kind === 'bat' ? c.id : null;
    }
    return null;
  };
  const selSource = () => (sel?.kind === 'cmd' ? 'cmd' : sel?.kind === 'pool' ? sel.i : null);

  const highlight = (): Highlight => {
    const slots = new Map<number, 'ok' | 'bonus' | 'stack' | 'from'>();
    const pattern = new Set<number>();
    if (sel?.kind === 'roost' && d.phase === 'day' && d.slots[sel.idx].roost) {
      slots.set(sel.idx, 'from');
      const batId = d.slots[sel.idx].roost!.batId;
      for (const t of d.mergeTargets(sel.idx)) {
        slots.set(t.idx, 'stack');
        for (const p of d.patternTiles(t.idx, batId)) if (p.roost && p.idx !== sel.idx) pattern.add(p.idx);
      }
      return { slots, pattern, batId, peek: peekTiles() };
    }
    const batId = selectedBat();
    const src = selSource();
    if (batId && src !== null) {
      for (const s of d.slots) {
        if (!d.canPlace(src, s.idx)) continue;
        if (s.roost) {
          slots.set(s.idx, 'stack');
          for (const t of d.patternTiles(s.idx, batId)) if (t.roost) pattern.add(t.idx);
        } else slots.set(s.idx, d.terrainMatches(s.idx, batId) ? 'bonus' : 'ok');
      }
    }
    return { slots, pattern, batId, peek: peekTiles() };
  };

  const describeBat = (batId: string, upgraded: boolean, isCmd: boolean): string => {
    const bp = isCmd ? d.commander.bp : blueprint(batId, app.profile.roster[batId], upgraded);
    const traits = bp.traits.map(describeTrait).join(', ');
    const stackable = d.slots.some((s) => s.roost && d.canStackOn(s, batId));
    return `${bp.name}: roost ❤${bp.roost.hp}, keeps ${bp.roost.count} bat${bp.roost.count > 1 ? 's' : ''} out (❤${bp.stats.hp} ⚔${bp.stats.atk}), +1 every ${bp.roost.respawn}s${traits ? ' · ' + traits : ''}. `
      + (isCmd ? `Tap an empty tile.${d.commander.casts ? ` Commander tax: +${d.commander.casts * BALANCE.commander.tax} for ${d.commander.casts} earlier placement${d.commander.casts > 1 ? 's' : ''}.` : ' If destroyed it returns here, costing 2 more each time.'}` : stackable ? 'Tap its level-1 roost (blue) to merge into level 2, or an empty tile.' : 'Tap a tile.');
  };

  const onPool = (i: number) => {
    const c = d.pool[i];
    if (!c) return;
    const s: Sel = { kind: 'pool', i };
    if (c.kind === 'spell' && same(sel, s)) {
      if (d.takeSpell(i)) note = `${SPELL_BY_ID[c.id].name} added to your spells.`;
      else note = d.phase !== 'day' ? 'Take spells during the day.' : `You can hold at most ${BALANCE.economy.spellHandMax} spells.`;
      sel = null;
      return;
    }
    sel = same(sel, s) ? null : s;
    note = '';
  };

  const onSpell = (i: number) => {
    const c = d.spells[i];
    const s: Sel = { kind: 'spell', i };
    if (same(sel, s) && d.canCast(i)) {
      d.cast(i);
      note = `Cast ${SPELL_BY_ID[c.id].name}.`;
      sel = null;
      return;
    }
    sel = same(sel, s) ? null : s;
    note = '';
  };

  canvas.addEventListener('pointerdown', (e) => {
    // The canvas uses object-fit: contain, so the drawn field can be letterboxed inside the element.
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / VIEW_W, rect.height / VIEW_H);
    const offX = (rect.width - VIEW_W * scale) / 2;
    const offY = (rect.height - VIEW_H * scale) / 2;
    const slot = renderer.slotAt((e.clientX - rect.left - offX) / scale, (e.clientY - rect.top - offY) / scale);
    if (slot < 0) return;
    const held = d.slots[slot].roost;
    if (held) startHold(held.batId, slot);
    if (sel?.kind === 'roost' && d.canMerge(sel.idx, slot)) {
      d.merge(sel.idx, slot);
      const ro = d.slots[slot].roost!;
      note = `Merged: ${ro.bp.name} level ${ro.level}${d.isMega(ro) ? ', MEGA BAT!' : '.'}`;
      sel = null;
      return;
    }
    const src = selSource();
    if (src !== null && selectedBat() && d.canPlace(src, slot)) {
      const stacking = !!d.slots[slot].roost;
      d.place(src, slot);
      const ro = d.slots[slot].roost!;
      note = stacking ? `Level ${ro.level}${d.isMega(ro) ? ': MEGA BAT!' : '.'}` : '';
      sel = null;
      return;
    }
    const s = d.slots[slot];
    if (s.roost && d.phase === 'day' && !s.roost.isCommander && !(sel?.kind === 'roost' && sel.idx === slot)) {
      // Pick this roost up to merge it into a matching one.
      const ro = s.roost;
      const targets = d.mergeTargets(slot).length;
      sel = { kind: 'roost', idx: slot };
      note = `${ro.bp.name} roost, level ${ro.level} (${d.batsPerRoost(ro)} bats). `
        + (targets ? `Tap a blue level-${ro.level} ${ro.bp.name} roost to merge them into level ${ro.level + 1}.` : `Merging needs another level-${ro.level} ${ro.bp.name} roost.`);
      return;
    }
    if (s.roost) {
      const ro = s.roost;
      note = ro.ruined ? `${ro.bp.name} roost is wrecked. It will be rebuilt at dawn (level ${ro.level}, half HP).` : `${ro.bp.name} roost, level ${ro.level}${d.isMega(ro) ? ' (mega)' : ''}: ❤${Math.round(ro.hp)}/${ro.maxHp}, ${d.isMega(ro) ? 'one giant bat' : `${d.batsPerRoost(ro)} bats`}, +1 every ${d.respawnTime(ro)}s.`;
    } else if (s.terrain) {
      const t = TERRAIN[s.terrain];
      note = `${t.icon} ${t.name}: ${t.desc} ${t.basis}`;
    } else note = 'Empty roost tile.';
    sel = null;
  });

  const cardEl = (o: { card: Card | null; isCmd?: boolean; sel: Sel; onTap: () => void; playable: boolean; tag?: string }) => {
    if (!o.card && !o.isCmd) return h('div.hand-card.empty', h('div.empty-label', 'empty'));
    const isCmd = !!o.isCmd;
    const id = isCmd ? d.commander.bp.batId : o.card!.id;
    const kind = isCmd ? 'bat' : o.card!.kind;
    const cost = isCmd ? d.commanderCost() : d.cardCost(o.card!);
    const name = kind === 'bat' ? BAT_BY_ID[id].name : SPELL_BY_ID[id].name;
    const clans = kind === 'bat' ? BAT_BY_ID[id].clans : SPELL_BY_ID[id].clans;
    const urge = isCmd && d.phase === 'day' && !d.commander.inPlay && d.guano >= d.commanderCost();
    const cls = ['hand-card', isCmd ? 'commander' : '', urge ? 'urge' : '', same(sel, o.sel) ? 'selected' : '', o.playable ? '' : 'disabled', kind === 'spell' ? 'spell' : ''].filter(Boolean).join('.');
    return h(`button.${cls}`, {
      style: `--rarity:${isCmd ? 'var(--accent)' : RARITY_COLOR[rarityOf(o.card!)]}`,
      onpointerdown: (e: PointerEvent) => { e.preventDefault(); o.onTap(); if (kind === 'bat') startHold(id, null); },
    },
    h('span.cost', cost),
    kind === 'bat' ? batImg(id, 2) : h('div.spell-icon', SPELL_BY_ID[id].icon),
    h('div.hc-name', name.replace(/ Bat$/, '') + (!isCmd && o.card!.upgraded ? '+' : '')),
    clanPips(clans),
    kind === 'bat' && !isCmd ? patternGrid(id, 'xs') : '',
    o.tag ? h('div.tax', o.tag) : '',
    );
  };

  let key = '';
  const updateUi = () => {
    const isDay = d.phase === 'day';
    phaseLabel.textContent = d.phase === 'night' ? `🌙 Night ${d.day}/${d.nights}` : `☀ Day ${d.day}/${d.nights}`;
    phaseLabel.className = `phase ${d.phase}`;
    caveFill.style.width = `${(d.cave.hp / d.cave.max) * 100}%`;
    caveText.textContent = `${Math.max(0, Math.round(d.cave.hp))}`;
    endBtn.style.display = isDay ? '' : 'none';
    speedBtn.style.display = isDay ? 'none' : '';
    const k = [d.phase, d.day, d.guano, JSON.stringify(peek), JSON.stringify(sel), d.commander.inPlay, d.commander.casts,
      d.pool.map((c) => c?.uid ?? '-').join(','), d.spells.map((c) => c.uid).join(','), note,
      d.slots.map((s) => (s.roost ? `${s.roost.batId}${s.roost.level}` : 0)).join('.')].join('|');
    if (k === key) return;
    key = k;
    guano.replaceChildren(h('span.g-icon', '◆'), h('b', String(d.guano)),
      h('span.small.muted', isDay ? ` guano · +${d.projectedIncome()} at dawn` : ' guano'));
    guano.title = 'Dawn income: +2, plus 1 per 2 bats housed in standing roosts, plus 1 per 4 kills';
    piles.textContent = `deck ${d.drawPile.length} · discard ${d.discard.length}`;
    refreshBtn.textContent = `↻ ${d.refreshCost}`;
    refreshBtn.disabled = !d.canRefresh();
    refreshBtn.title = 'Discard the pool and draw new cards';
    refreshBtn.style.display = isDay ? '' : 'none';

    const cmdPlayable = isDay && !d.commander.inPlay && d.guano >= d.commanderCost();
    cards.replaceChildren(
      cardEl({
        card: null, isCmd: true, sel: { kind: 'cmd' }, playable: cmdPlayable,
        onTap: () => { sel = same(sel, { kind: 'cmd' }) ? null : { kind: 'cmd' }; note = ''; },
        tag: d.commander.inPlay ? 'in play' : d.commander.casts ? `tax +${d.commander.casts * BALANCE.commander.tax}` : 'place me',
      }),
      h('div.row-label', 'pool'),
      ...d.pool.map((c, i) => cardEl({
        card: c, sel: { kind: 'pool', i }, onTap: () => onPool(i),
        playable: !!c && isDay && (c.kind === 'spell' ? d.canTakeSpell(i) : d.guano >= d.cardCost(c)),
        tag: c?.kind === 'spell' ? 'take' : undefined,
      })),
      refreshBtn,
      d.spells.length ? h('div.row-label', 'spells') : '',
      ...d.spells.map((c, i) => cardEl({ card: c, sel: { kind: 'spell', i }, onTap: () => onSpell(i), playable: d.canCast(i), tag: 'instant' })),
    );

    let text = note;
    if (peek) {
      const name = BAT_BY_ID[peek.batId].name;
      const n = peekTiles().size;
      text = n
        ? `${name}: merging ${peek.from !== null ? 'this roost' : 'its roost'} also gives +1 to the highlighted tiles (any roost standing there).`
        : peek.from === null
          ? `${name}: no ${name} roost on the field yet. Its pattern: ${BAT_BY_ID[peek.batId].pattern.length ? 'see the grid on the card' : 'none'}.`
          : `${name}: this roost's pattern doesn't reach any tile from here.`;
    }
    if (!text && sel) {
      if (sel.kind === 'cmd') text = describeBat(d.commander.bp.batId, false, true);
      else if (sel.kind === 'pool') {
        const c = d.pool[sel.i];
        if (c) text = c.kind === 'bat'
          ? describeBat(c.id, c.upgraded, false)
          : `${SPELL_BY_ID[c.id].name}: ${SPELL_BY_ID[c.id].desc} Tap again to take it (free); casting costs ${d.cardCost(c)} guano.`;
      } else if (sel.kind === 'spell') {
        const c = d.spells[sel.i];
        if (c) text = `${SPELL_BY_ID[c.id].name}: ${SPELL_BY_ID[c.id].desc} ${d.canCast(sel.i) ? 'Tap again to cast.' : d.phase === 'day' ? 'Cast it at night.' : 'Not enough guano.'}`;
      }
    }
    if (!text) {
      text = isDay
        ? d.day === 1
          ? `${d.previewHidden ? 'New Moon: you won\'t see tonight\'s enemies in advance.' : 'Tonight\'s enemies are shown at the top.'} Start with your commander (gold card), placed in a column they'll come down. Two roosts of the same bat and level merge into one a level higher: tap one, then the other. ↻ rerolls the pool for ${d.refreshCost} guano.`
          : d.previewHidden ? `Dawn: +${d.lastIncome} guano. New Moon: tonight's enemies are hidden.` : `Dawn: +${d.lastIncome} guano (${d.lastIncomeParts.base} base, ${d.lastIncomeParts.roosts} from roosts, ${d.lastIncomeParts.kills} from kills${d.lastIncomeParts.relic ? `, ${d.lastIncomeParts.relic} relic` : ''}). Tonight: ${tonightSummary(d)}.`
        : 'Bats fly out on their own. Spells are instants: tap one twice to cast.';
    }
    info.textContent = text;
  };

  let last = performance.now();
  let acc = 0;
  let raf = 0;
  let finished = false;
  const DT = 1 / 60;
  const loop = (now: number) => {
    const elapsed = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (d.phase === 'night') {
      acc += elapsed * speed;
      while (acc >= DT && d.phase === 'night') {
        d.step(DT);
        acc -= DT;
      }
    } else {
      d.clock += elapsed;
      acc = 0;
    }
    if (sel?.kind === 'pool' && !d.pool[sel.i]) sel = null;
    if (sel?.kind === 'spell' && !d.spells[sel.i]) sel = null;
    if (sel?.kind === 'roost' && (d.phase !== 'day' || !d.slots[sel.idx].roost)) sel = null;
    renderer.draw(highlight());
    updateUi();
    if ((d.phase === 'won' || d.phase === 'lost') && !finished) {
      finished = true;
      setTimeout(showResult, 500);
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  app.onLeave = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('pointerup', endHold);
    window.removeEventListener('pointercancel', endHold);
  };

  const showResult = () => {
    const won = d.phase === 'won';
    resolveBattle(r, won, d.cave.hp);
    app.save();
    overlay.classList.add('show');
    overlay.replaceChildren(h('div.result-box',
      h('h1.title', won ? (node.type === 'boss' ? 'BOSS DEFEATED' : 'DAWN') : 'DEFEAT'),
      h('p', won ? `${d.encounter.name}: survived ${d.nights} nights.` : 'The cave has fallen.'),
      h('button.big.primary', { onclick: () => (r.status === 'active' ? app.go({ name: 'reward' }) : endRun(app)) }, 'Continue'),
    ));
  };

  return h('div.screen.defense-screen',
    h('div.def-top',
      h('div', h('div.enc-name', `${node.type === 'battle' ? '' : node.type.toUpperCase() + ' · '}${d.encounter.name}`), phaseLabel),
      h('div.cave-mini', h('span.small', '🏔'), h('div.hpbar', caveFill), caveText),
      speedBtn,
    ),
    h('div.canvas-wrap', canvas, overlay),
    info,
    h('div.def-controls', guano, piles, endBtn),
    cards,
  );
});
