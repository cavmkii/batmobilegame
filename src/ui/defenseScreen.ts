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
import { batImg, clanPips, rarityOf } from './components';
import { h } from './dom';
import { endRun } from './runScreens';

const hash = (s: string) => [...s].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);

type Sel = number | 'cmd' | null;

function tonightSummary(d: Defense): string {
  const total = new Map<string, number>();
  for (const g of d.tonight) total.set(g.enemy, (total.get(g.enemy) ?? 0) + g.count);
  return [...total].map(([id, n]) => `${n} ${ENEMY_BY_ID[id].name}${n > 1 ? 's' : ''}`).join(', ');
}

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
  });
  // Exposed in dev builds so automated playtests can drive the level.
  if (import.meta.env.DEV) (window as unknown as { __defense: Defense }).__defense = d;

  const canvas = h('canvas.field-canvas');
  const renderer = new FieldRenderer(canvas, d);
  let sel: Sel = null;
  let speed = 1;
  let note = '';

  const phaseLabel = h('span.phase');
  const caveFill = h('div');
  const caveText = h('span.small');
  const info = h('div.info-line');
  const energy = h('div.energy-pips');
  const piles = h('span.small.muted');
  const endBtn = h('button.primary.end-day', { onclick: () => { sel = null; note = ''; d.endDay(); } }, 'End day ☾');
  const speedBtn = h('button.ghost.small', { onclick: () => { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; speedBtn.textContent = `${speed}×`; } }, '1×');
  const hand = h('div.hand-row');
  const overlay = h('div.battle-overlay');

  const selectedBat = (): string | null => {
    if (d.phase !== 'day') return null;
    if (sel === 'cmd') return d.commander.inPlay ? null : d.commander.bp.batId;
    if (typeof sel === 'number') {
      const c = d.hand[sel];
      return c && c.kind === 'bat' ? c.id : null;
    }
    return null;
  };

  const highlight = (): Highlight => {
    const slots = new Map<number, 'ok' | 'bonus'>();
    const batId = selectedBat();
    if (batId && sel !== null) {
      for (const s of d.slots) if (d.canPlace(sel, s.idx)) slots.set(s.idx, d.terrainMatches(s.idx, batId) ? 'bonus' : 'ok');
    }
    return { slots, batId };
  };

  const describeCard = (c: Card | 'cmd'): string => {
    if (c === 'cmd' || c.kind === 'bat') {
      const bp = c === 'cmd' ? d.commander.bp : blueprint(c.id, app.profile.roster[c.id], c.upgraded);
      const nights = c === 'cmd' ? 'stays until destroyed' : `${bp.roost.nights} nights`;
      const traits = bp.traits.map(describeTrait).join(', ');
      return `${bp.name}: roost ❤${bp.roost.hp}, ${nights}. Keeps ${bp.roost.count} bat${bp.roost.count > 1 ? 's' : ''} out (❤${bp.stats.hp} ⚔${bp.stats.atk}), replacing one every ${bp.roost.respawn}s${traits ? ' · ' + traits : ''}. Tap a tile.`;
    }
    const s = SPELL_BY_ID[c.id];
    return `${s.name}: ${s.desc}${c.upgraded ? ' (+40%)' : ''} ${d.canCast(sel as number) ? 'Tap again to cast.' : d.phase === 'day' ? 'Hold it for the night.' : 'Not enough energy.'}`;
  };

  const select = (s: Sel) => {
    sel = sel === s ? null : s;
    note = '';
  };

  const onCard = (i: number) => {
    const c = d.hand[i];
    if (!c) return;
    if (c.kind === 'spell' && sel === i && d.canCast(i)) {
      d.cast(i);
      sel = null;
      note = `Cast ${SPELL_BY_ID[c.id].name}.`;
      return;
    }
    select(i);
  };

  canvas.addEventListener('pointerdown', (e) => {
    // The canvas uses object-fit: contain, so the drawn field can be letterboxed inside the element.
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / VIEW_W, rect.height / VIEW_H);
    const offX = (rect.width - VIEW_W * scale) / 2;
    const offY = (rect.height - VIEW_H * scale) / 2;
    const px = (e.clientX - rect.left - offX) / scale;
    const py = (e.clientY - rect.top - offY) / scale;
    const slot = renderer.slotAt(px, py);
    if (slot < 0) return;
    if (sel !== null && selectedBat() && d.canPlace(sel, slot)) {
      d.place(sel, slot);
      sel = null;
      note = '';
      return;
    }
    const s = d.slots[slot];
    if (s.roost) {
      const bp = s.roost.bp;
      note = `${bp.name}: roost ❤${Math.round(s.roost.hp)}/${s.roost.maxHp}, ${s.roost.card ? `${s.roost.nightsLeft} night${s.roost.nightsLeft > 1 ? 's' : ''} left` : 'commander'}, keeps ${bp.roost.count} bat${bp.roost.count > 1 ? 's' : ''} out, +1 every ${bp.roost.respawn}s.`;
    } else if (s.terrain) {
      const t = TERRAIN[s.terrain];
      note = `${t.icon} ${t.name}: ${t.desc} ${t.basis}`;
    } else note = 'Empty roost tile.';
    sel = null;
  });

  const handCard = (c: Card | 'cmd', i: number | 'cmd') => {
    const isCmd = c === 'cmd';
    const id = isCmd ? d.commander.bp.batId : c.id;
    const kind = isCmd ? 'bat' : c.kind;
    const cost = isCmd ? d.commanderCost() : d.cardCost(c);
    const playable = isCmd
      ? d.phase === 'day' && !d.commander.inPlay && d.energy >= cost
      : kind === 'bat' ? d.phase === 'day' && d.energy >= cost : d.canCast(i as number);
    const name = kind === 'bat' ? BAT_BY_ID[id].name : SPELL_BY_ID[id].name;
    const clans = kind === 'bat' ? BAT_BY_ID[id].clans : SPELL_BY_ID[id].clans;
    const cls = ['hand-card', isCmd ? 'commander' : '', sel === i ? 'selected' : '', playable ? '' : 'disabled', kind === 'spell' ? 'spell' : ''].filter(Boolean).join('.');
    return h(`button.${cls}`, {
      style: `--rarity:${isCmd ? 'var(--accent)' : RARITY_COLOR[rarityOf(c as Card)]}`,
      onpointerdown: (e: PointerEvent) => { e.preventDefault(); if (isCmd) select('cmd'); else onCard(i as number); },
    },
    h('span.cost', cost),
    kind === 'bat' ? batImg(id, 2) : h('div.spell-icon', SPELL_BY_ID[id].icon),
    h('div.hc-name', name.replace(/ Bat$/, '') + (!isCmd && c.upgraded ? '+' : '')),
    clanPips(clans),
    isCmd ? h('div.tax', d.commander.inPlay ? 'in play' : d.commander.deaths ? `tax +${d.commander.deaths * d.commander.taxStep}` : 'command zone') : '',
    kind === 'spell' ? h('div.instant', 'instant') : '',
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
    const k = [d.phase, d.day, Math.floor(d.energy), d.energyCap, sel, d.commander.inPlay, d.commander.deaths, d.hand.map((c) => c.uid).join(','), note].join('|');
    if (k === key) return;
    key = k;
    energy.replaceChildren(
      h('span.small.muted', '⚡'),
      ...Array.from({ length: Math.max(d.energyCap, Math.floor(d.energy)) }, (_, i) => h(`span.pip-e${i < Math.floor(d.energy) ? '.on' : ''}`)),
      h('span.small', ` ${Math.floor(d.energy)}`),
    );
    piles.textContent = `deck ${d.drawPile.length} · discard ${d.discard.length}`;
    hand.replaceChildren(handCard('cmd', 'cmd'), ...d.hand.map((c, i) => handCard(c, i)));
    let text = note;
    if (!text && sel !== null) text = describeCard(sel === 'cmd' ? 'cmd' : d.hand[sel]);
    if (!text) {
      text = isDay
        ? d.day === 1
          ? 'Tonight\'s enemies are shown at the top. Tap a bat, then a tile, to build a roost. Unspent energy carries into the night for spells.'
          : `Dawn. Tonight: ${tonightSummary(d)}.`
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
    if (sel !== null && typeof sel === 'number' && !d.hand[sel]) sel = null;
    renderer.draw(highlight());
    updateUi();
    if ((d.phase === 'won' || d.phase === 'lost') && !finished) {
      finished = true;
      setTimeout(showResult, 500);
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  app.onLeave = () => cancelAnimationFrame(raf);

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
    h('div.def-controls', energy, piles, endBtn),
    hand,
  );
});
