import { BALANCE } from '../data/balance';
import { BAT_BY_ID } from '../data/bats';
import { CLANS, RARITY_COLOR } from '../data/clans';
import { MODIFIER_BY_ID } from '../data/setup';
import { BOSS_RULE_BY_ID } from '../data/bossRules';
import { CHARM_BY_ID, CHARM_SLOTS } from '../data/charms';
import { ENHANCE_BY_ID, isSharp } from '../data/enhance';
import { FORMATIONS, type FormationId } from '../data/formations';
import { MATRIARCH_BY_ID } from '../data/matriarchs';
import { HUNT_PCT, OBJECTIVES } from '../data/saga';
import { ENEMY_BY_ID } from '../data/enemies';
import { SPELL_BY_ID } from '../data/spells';
import { TERRAIN } from '../data/terrain';
import type { Card } from '../data/types';
import { Defense } from '../game/defense';
import { ATTACK_LABEL, attackLabel, attackStyle, blueprint, describeTrait } from '../game/progression';
import { applyLevelResult, resolveBattle } from '../game/run';
import { FORMATION_COLOR, FieldRenderer, VIEW_H, VIEW_W, type Highlight } from '../render/fieldRenderer';
import { registerScreen } from './app';
import { batImg, clanPips, patternGrid, rarityOf } from './components';
import { h, modal } from './dom';
import { endRun } from './runScreens';

const LOST_TEXT = {
  cave: 'The cave has fallen.',
  nursery: 'The nursery was wrecked.',
  hunt: `Too many got away: the hunt needed ${HUNT_PCT}% of the enemies killed.`,
} as const;

const hash = (s: string) => [...s].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);

type Sel = { kind: 'pool'; i: number } | { kind: 'spell'; i: number } | { kind: 'roost'; idx: number } | null;

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
    row: node.depth ?? node.row,
    deck: r.deck,
    matriarchId: r.matriarchId,
    roster: app.profile.roster,
    caveHp: r.caveHp,
    caveMax: r.caveMax,
    seed: (r.rngState ^ hash(node.id)) >>> 0,
    biome: r.biome,
    modifiers: r.modifiers,
    charms: r.charms,
    bossRule: node.bossRule,
    difficulty: r.difficulty,
    formationLevels: r.formations,
    objective: r.objective === 'fragile' || node.type === 'battle' ? r.objective : undefined,
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

  // ---------------- First-play tutorial ----------------
  type Wait = 'next' | 'select' | 'preview' | 'placed' | 'endDay';
  interface Step { text: string; target?: 'canvas' | 'pool' | 'clans' | 'guano' | 'end'; wait: Wait; check?: () => boolean; showWhen?: () => boolean }
  const STEPS: Step[] = [
    { target: 'canvas', wait: 'next',
      text: 'Welcome to the roost. Enemies come down from the top toward your cave at the bottom. During the day, the red columns show tonight\'s wave: what is coming, how many, and where.' },
    { target: 'pool', wait: 'select', check: () => sel?.kind === 'pool',
      text: 'These cards are your pool, drawn from your deck. Tap a bat card.' },
    { target: 'canvas', wait: 'preview',
      text: 'Tap a tile in a column the enemies will come down. That shows a preview first; nothing is spent yet.' },
    { target: 'canvas', wait: 'placed',
      text: 'This is the preview. Dashed tiles show the +1 spread this bat gives when it merges later. Tap the same tile again to build the roost (or another tile to move it).' },
    { target: 'pool', wait: 'placed',
      text: 'A used card leaves its slot empty until dawn or a ↻ reroll. Place the other bat the same way: tap it, tap a tile, then tap again.' },
    { target: 'clans', wait: 'next',
      text: 'Formations. Shapes on the grid give bonuses for the night: two of the same bat side by side is a Pair, three of one clan in a row is a Line, a full column, a 2×2 Cluster, a full row. They show as coloured outlines and chips here. Above each threatened column, the forecast says SAFE, RISKY or DANGER. The ♛ chip is your matriarch\'s rule: tap it to read it.' },
    { target: 'guano', wait: 'next',
      text: 'Guano pays for bats, rerolls and spells. Each dawn your roosts make more: +1 for every 2 bats you house. Building bats grows your income.' },
    { target: 'end', wait: 'endDay', text: 'When you are ready, tap End day.' },
    { target: 'canvas', wait: 'next', showWhen: () => d.phase === 'night',
      text: 'Night. Each roost releases its bats as its timer ring fills, so your army grows through the night. Bats can\'t be placed now, but spells you hold work as instants.' },
    { wait: 'next', showWhen: () => d.phase === 'day' && d.day >= 2,
      text: 'Day 2. Two roosts of the same bat at the same level merge into one a level higher. Tap one roost, then the other (preview, then confirm). A merge also gives +1 to the roosts in that bat\'s pattern. Press and hold any bat card to see its pattern. Good luck!' },
  ];
  let tut = app.profile.tutorialDone ? -1 : 0;
  if (tut === 0) d.guano += 2; // a little extra so both pool bats are affordable
  const finishTutorial = () => {
    tut = -1;
    app.profile.tutorialDone = true;
    app.save();
  };
  const advance = () => {
    tut++;
    if (tut >= STEPS.length) finishTutorial();
  };
  const coach = h('div.coach');

  const canvas = h('canvas.field-canvas');
  const renderer = new FieldRenderer(canvas, d);
  let sel: Sel = null;
  let speed = 1;
  let note = '';
  /** Tile being previewed; a second tap on it confirms. */
  let pending: number | null = null;
  // Filled in by the tutorial further down; a no-op when it isn't running.
  let onTutorial: (event: string) => void = () => {};
  onTutorial = (ev) => {
    if (tut < 0) return;
    const st = STEPS[tut];
    if (st.wait === ev && (!st.check || st.check())) advance();
  };
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
  const endBtn = h('button.primary.end-day', { onclick: () => { sel = null; pending = null; note = ''; meet(); d.endDay(); onTutorial('endDay'); } }, 'End day ☾');
  const effectsBtn = h('button.ghost.small.effects-btn', { title: 'Effects in play', onclick: () => openEffects() }, '📜');
  const speedBtn = h('button.ghost.small', { onclick: () => { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; speedBtn.textContent = `${speed}×`; } }, '1×');
  const cards = h('div.hand-row');
  const clanBar = h('div.clan-bar');
  const mat = MATRIARCH_BY_ID[r.matriarchId];
  /** Matriarch, boss rule, charms, then the formations standing (live by day, locked at night). */
  const renderClans = (isDay: boolean) => {
    const hits = isDay ? d.formations() : d.nightFormations;
    const counts = new Map<FormationId, number>();
    for (const x of hits) counts.set(x.id, (counts.get(x.id) ?? 0) + 1);
    const tell = (text: string) => () => { note = text; key = ''; };
    const boss = d.bossRule ? BOSS_RULE_BY_ID[d.bossRule] : null;
    clanBar.replaceChildren(
      mat ? h('button.clan-chip.mat', { onclick: tell(`♛ ${BAT_BY_ID[mat.batId].name}, ${mat.title}: ${mat.rule}`) }, `♛ ${mat.title}`) : '',
      boss ? h('button.clan-chip.boss', { onclick: tell(`Boss rule, ${boss.name}: ${boss.desc}`) }, `${boss.icon} ${boss.name}`) : '',
      ...[...d.charms].map((id) => h('button.clan-chip.charm', { onclick: tell(`${CHARM_BY_ID[id].name}: ${CHARM_BY_ID[id].desc}`) }, CHARM_BY_ID[id].icon)),
      ...FORMATIONS.filter((f) => counts.has(f.id)).map((f) => h('button.clan-chip.on', {
        style: `--clan:${FORMATION_COLOR[f.id]}`,
        onclick: tell(`${f.name} ×${counts.get(f.id)} (level ${d.formationLevel(f.id)}): ${f.shape}. ${isDay ? 'If it stands at dusk' : 'Tonight'}: ${f.text(d.formationValue(f.id))}.`),
      }, h('span.cc-name', `${f.icon} ${f.name}`), counts.get(f.id)! > 1 ? h('span.cc-n', `×${counts.get(f.id)}`) : '')),
      counts.size ? '' : h('span.small.muted', isDay ? 'Formations: pair, line, column, cluster, full row.' : ''),
    );
  };
  const overlay = h('div.battle-overlay');

  const selectedBat = (): string | null => {
    if (d.phase !== 'day' || !sel) return null;
    if (sel.kind === 'pool') {
      const c = d.pool[sel.i];
      return c && c.kind === 'bat' ? c.id : null;
    }
    return null;
  };
  const selSource = () => (sel?.kind === 'pool' ? sel.i : null);

  /** Text for the preview step: what confirming will do. */
  const previewNote = (slot: number): string => {
    const s = d.slots[slot];
    const batId = previewBat()!;
    const name = BAT_BY_ID[batId].name;
    if (s.roost) {
      const bumps = d.patternTiles(slot, batId).filter((t) => t.roost && !(sel?.kind === 'roost' && t.idx === sel.idx)).length;
      return `Preview: merge into level ${s.roost.level + 1}${bumps ? `, and +1 to ${bumps} roost${bumps > 1 ? 's' : ''} in its pattern` : ''}. Tap the tile again to confirm.`;
    }
    const t = s.terrain && d.terrainMatches(slot, batId) ? ` On its home terrain: ${TERRAIN[s.terrain].desc}` : '';
    return `Preview: build a ${name} roost here.${t} The dashed tiles are what it will +1 when it merges later. Tap the tile again to confirm.`;
  };
  /** The bat a preview would put down (pool card, or a roost being merged). */
  const previewBat = (): string | null => (sel?.kind === 'roost' ? d.slots[sel.idx].roost?.batId ?? null : selectedBat());

  const highlight = (): Highlight => {
    const slots = new Map<number, 'ok' | 'bonus' | 'stack' | 'from'>();
    const pattern = new Set<number>();
    if (pending !== null && previewBat()) {
      const batId = previewBat()!;
      const s = d.slots[pending];
      const peek = new Set<number>();
      const footprint = new Set<number>();
      if (s.roost) {
        peek.add(pending);
        for (const t of d.patternTiles(pending, batId)) if (t.roost && !(sel?.kind === 'roost' && t.idx === sel.idx)) peek.add(t.idx);
      } else for (const t of d.patternTiles(pending, batId)) footprint.add(t.idx);
      if (sel?.kind === 'roost') slots.set(sel.idx, 'from');
      return { slots, pattern, batId, peek, preview: { slot: pending, batId, merge: !!s.roost }, footprint };
    }
    if (sel?.kind === 'roost' && d.phase === 'day' && d.slots[sel.idx].roost) {
      slots.set(sel.idx, 'from');
      const batId = d.slots[sel.idx].roost!.batId;
      for (const t of d.mergeTargets(sel.idx)) {
        slots.set(t.idx, 'stack');
        for (const p of d.patternTiles(t.idx, batId)) if (p.roost && p.idx !== sel.idx) pattern.add(p.idx);
      }
      return { slots, pattern, batId, peek: peekTiles(), preview: null, footprint: new Set() };
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
    return { slots, pattern, batId, peek: peekTiles(), preview: null, footprint: new Set() };
  };

  const bpOf = (c: Card) => blueprint(c.id, app.profile.roster[c.id], isSharp(c));
  const describeBat = (batId: string, upgraded: boolean): string => {
    const bp = blueprint(batId, app.profile.roster[batId], upgraded);
    const traits = [attackLabel(bp.traits, bp.stats.range), ...bp.traits.filter((t) => t.kind !== 'multiHit' && t.kind !== 'aoe').map(describeTrait)].join(', ');
    const stackable = d.slots.some((s) => s.roost && d.canStackOn(s, batId));
    return `${bp.name}: roost ❤${bp.roost.hp}, keeps ${bp.roost.count} bat${bp.roost.count > 1 ? 's' : ''} out (❤${bp.stats.hp} ⚔${bp.stats.atk}), +1 every ${bp.roost.respawn}s${traits ? ' · ' + traits : ''}. `
      + (stackable ? 'Tap a blue roost to merge into it, or an empty tile.' : 'Tap a tile.');
  };

  const onPool = (i: number) => {
    const c = d.pool[i];
    if (!c) return;
    pending = null;
    const s: Sel = { kind: 'pool', i };
    sel = same(sel, s) ? null : s;
    note = '';
    if (sel && c.kind === 'bat') onTutorial('select');
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
    // Placing and merging are two taps on the tile: the first previews, the second confirms.
    const src = selSource();
    const canAct = (sel?.kind === 'roost' && d.canMerge(sel.idx, slot)) || (src !== null && !!selectedBat() && d.canPlace(src, slot));
    if (canAct && pending !== slot) {
      pending = slot;
      note = previewNote(slot);
      onTutorial('preview');
      return;
    }
    if (canAct && pending === slot) {
      pending = null;
      if (sel?.kind === 'roost') {
        d.merge(sel.idx, slot);
        const ro = d.slots[slot].roost!;
        note = `Merged: ${ro.bp.name} level ${ro.level}${d.isMega(ro) ? ', MEGA BAT!' : '.'}`;
      } else {
        const stacking = !!d.slots[slot].roost;
        d.place(src!, slot);
        const ro = d.slots[slot].roost!;
        note = stacking ? `Merged: level ${ro.level}${d.isMega(ro) ? ', MEGA BAT!' : '.'}` : `${ro.bp.name} roost built.`;
      }
      sel = null;
      onTutorial('placed');
      return;
    }
    pending = null;
    const s = d.slots[slot];
    if (s.roost && d.phase === 'day' && !(sel?.kind === 'roost' && sel.idx === slot)) {
      // Pick this roost up to merge it into a matching one.
      const ro = s.roost;
      const targets = d.mergeTargets(slot).length;
      sel = { kind: 'roost', idx: slot };
      note = `${ro.bp.name} roost, level ${ro.level} (${d.batsPerRoost(ro)} bats). `
        + (targets ? `Tap a blue ${ro.bp.name} roost to merge into it.` : `Merging needs another level-${ro.level} ${ro.bp.name} roost${d.rule.mergeReach ? ` (or one up to ${d.rule.mergeReach} level higher)` : ''}.`);
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

  const cardEl = (o: { card: Card | null; sel: Sel; onTap: () => void; playable: boolean; tag?: string }) => {
    if (!o.card) return h('div.hand-card.empty', h('div.empty-label', 'empty'));
    const card = o.card;
    const id = card.id;
    const kind = card.kind;
    const cost = d.cardCost(card);
    const name = kind === 'bat' ? BAT_BY_ID[id].name : SPELL_BY_ID[id].name;
    const clans = kind === 'bat' ? BAT_BY_ID[id].clans : SPELL_BY_ID[id].clans;
    const cls = ['hand-card', same(sel, o.sel) ? 'selected' : '', o.playable ? '' : 'disabled', kind === 'spell' ? 'spell' : ''].filter(Boolean).join('.');
    return h(`button.${cls}`, {
      style: `--rarity:${RARITY_COLOR[rarityOf(card)]}`,
      onpointerdown: (e: PointerEvent) => { e.preventDefault(); o.onTap(); if (kind === 'bat') startHold(id, null); },
    },
    h('span.cost', cost),
    card.mod ? h('span.mod-badge', { title: ENHANCE_BY_ID[card.mod].name }, ENHANCE_BY_ID[card.mod].icon) : '',
    kind === 'bat' ? batImg(id, 2) : h('div.spell-icon', SPELL_BY_ID[id].icon),
    h('div.hc-name', name.replace(/ Bat$/, '')),
    kind === 'bat' ? h('div.hc-atk', clanPips(clans), ' ', ATTACK_LABEL[attackStyle(bpOf(card).traits, bpOf(card).stats.range)].icon) : clanPips(clans),
    kind === 'bat' ? patternGrid(id, 'xs', d.patternOf(id)) : '',
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
    const k = [d.phase, d.day, d.guano, JSON.stringify(peek), pending, tut, JSON.stringify(sel),
      d.pool.map((c) => c?.uid ?? '-').join(','), d.spells.map((c) => c.uid).join(','), note,
      d.slots.map((s) => (s.roost ? `${s.roost.batId}${s.roost.level}` : 0)).join('.')].join('|');
    if (k === key) return;
    key = k;
    guano.replaceChildren(h('span.g-icon', '◆'), h('b', String(d.guano)),
      h('span.small.muted', isDay ? ` guano · +${d.projectedIncome() + d.interestNow()} at dawn` : ' guano'),
      isDay && d.interestNow() ? h('span.small.interest', ` (${d.interestNow()} interest)`) : '');
    guano.title = `Dawn income: +2, plus 1 per 2 bats housed in standing roosts, plus Clusters, plus interest: +1 per ${BALANCE.interest.per} unspent (max ${d.interestCap})`;
    renderClans(isDay);
    piles.textContent = `deck ${d.drawPile.length} · discard ${d.discard.length}`;
    refreshBtn.textContent = `↻ ${d.refreshCost}`;
    refreshBtn.disabled = !d.canRefresh();
    refreshBtn.title = 'Discard the pool and draw new cards';
    refreshBtn.style.display = isDay ? '' : 'none';

    cards.replaceChildren(
      h('div.row-label', 'pool'),
      ...d.pool.map((c, i) => cardEl({
        card: c, sel: { kind: 'pool', i }, onTap: () => onPool(i),
        playable: !!c && isDay && d.guano >= d.cardCost(c),
      })),
      refreshBtn,
      d.spells.length || d.spellsLeft ? h('div.row-label', `spells${d.spellsLeft ? ` +${d.spellsLeft}` : ''}`) : '',
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
      if (sel.kind === 'pool') {
        const c = d.pool[sel.i];
        if (c) text = describeBat(c.id, isSharp(c));
      } else if (sel.kind === 'spell') {
        const c = d.spells[sel.i];
        if (c) text = `${SPELL_BY_ID[c.id].name}: ${SPELL_BY_ID[c.id].desc} ${d.canCast(sel.i) ? 'Tap again to cast.' : d.phase === 'day' ? 'Cast it at night.' : 'Not enough guano.'}`;
      }
    }
    if (!text) {
      text = isDay
        ? d.day === 1
          ? `${d.previewHidden ? 'New Moon: you won\'t see tonight\'s enemies in advance.' : 'Tonight\'s enemies are shown at the top.'} Build roosts in the columns they'll come down. Two roosts of the same bat and level merge into one a level higher: tap one, then the other. ↻ rerolls the pool for ${d.refreshCost ? `${d.refreshCost} guano` : "free (Thrift, once a day)"}.`
          : d.previewHidden ? `Dawn: +${d.lastIncome} guano. New Moon: tonight's enemies are hidden.` : `Dawn: +${d.lastIncome} guano (${d.lastIncomeParts.base} base, ${d.lastIncomeParts.roosts} from roosts${d.lastIncomeParts.kills ? `, ${d.lastIncomeParts.kills} from kills` : ''}${d.lastIncomeParts.clans ? `, ${d.lastIncomeParts.clans} clusters` : ''}${d.lastIncomeParts.interest ? `, ${d.lastIncomeParts.interest} interest` : ''}${d.lastIncomeParts.charms ? `, ${d.lastIncomeParts.charms} charms` : ''}). Tonight: ${tonightSummary(d)}.`
        : 'Bats fly out on their own. Spells are instants: tap one twice to cast.';
    }
    info.textContent = text;

    // Tutorial bubble and highlight.
    const st = tut >= 0 ? STEPS[tut] : null;
    const showing = !!st && (!st.showWhen || st.showWhen());
    coach.style.display = showing ? '' : 'none';
    for (const el of document.querySelectorAll('.coach-target')) el.classList.remove('coach-target');
    if (showing && st) {
      coach.replaceChildren(
        h('div.coach-step', `Tutorial ${tut + 1}/${STEPS.length}`),
        h('div', st.text),
        h('div.coach-actions',
          h('button.ghost.small', { onclick: () => { finishTutorial(); key = ''; } }, 'Skip tutorial'),
          st.wait === 'next' ? h('button.primary.small', { onclick: () => { advance(); key = ''; } }, tut === STEPS.length - 1 ? 'Got it' : 'Next') : null,
        ),
      );
      const targets: Record<string, Element[]> = {
        canvas: [canvas],
        pool: [...cards.querySelectorAll('.hand-card')].slice(0, d.pool.length),
        clans: [clanBar],
        guano: [guano],
        end: [endBtn],
      };
      for (const el of targets[st.target ?? ''] ?? []) el?.classList.add('coach-target');
    }
  };

  // ---------------- Effects in play ----------------
  /** Everything currently changing the rules, in one list. The night pauses while it's open. */
  const openEffects = () => {
    paused = true;
    const sec = (title: string, rows: (Node | string)[]) => rows.length ? h('section.fx-sec', h('h3', title), ...rows) : '';
    const row = (icon: string, name: string, text: string, extra = '') =>
      h('div.fx-row', h('span.fx-icon', icon), h('div', h('b', name), extra ? h('span.small.muted', ` ${extra}`) : '', h('div.small', text)));
    const isDay = d.phase === 'day';
    const hits = isDay ? d.formations() : d.nightFormations;
    const counts = new Map<FormationId, number>();
    for (const x of hits) counts.set(x.id, (counts.get(x.id) ?? 0) + 1);
    const boss = d.bossRule ? BOSS_RULE_BY_ID[d.bossRule] : null;
    const t = d.time;
    const timed: (Node | string)[] = [];
    if (d.phase === 'night') {
      if (t < d.buffs.atkUntil) timed.push(row('🌕', 'Attack buff', `Bats +${Math.round(d.buffs.atkPct)}% attack${d.buffs.lifesteal ? `, +${d.buffs.lifesteal}% lifesteal` : ''}`, `${Math.ceil(d.buffs.atkUntil - t)}s left`));
      if (t < d.buffs.hasteUntil) timed.push(row('🌸', 'Haste', `Bats attack ${Math.round(d.buffs.hastePct)}% faster`, `${Math.ceil(d.buffs.hasteUntil - t)}s left`));
      if (t < d.buffs.slowUntil) timed.push(row('🌫', 'Fog', `Enemies ${d.buffs.slowPct}% slower`, `${Math.ceil(d.buffs.slowUntil - t)}s left`));
    }
    const enhanced = r.deck.filter((c) => c.mod);
    const terrains = [...new Set(d.slots.map((s) => s.terrain).filter((x): x is NonNullable<typeof x> => !!x))];
    const content = h('div.effects-list',
      h('h2', 'Effects in play'),
      d.phase === 'night' ? h('p.small.muted', 'The night is paused while this is open.') : '',
      sec('Leaders and rules', [
        mat ? row('♛', `${BAT_BY_ID[mat.batId].name}: ${mat.title}`, mat.rule) : '',
        boss ? row(boss.icon, `Boss rule: ${boss.name}`, boss.desc) : '',
        r.restrict ? row('🔒', 'Clan restriction', `Only ${CLANS[r.restrict].name} bats can be drafted.`) : '',
        r.objective ? row(OBJECTIVES[r.objective].icon, OBJECTIVES[r.objective].name, OBJECTIVES[r.objective].desc
          + (r.objective === 'hunt' ? ` So far: ${d.hunt.killed} of ${d.hunt.spawned} killed.` : '')) : '',
        ...(r.modifiers ?? []).map((id) => MODIFIER_BY_ID[id] ? row(MODIFIER_BY_ID[id].icon, MODIFIER_BY_ID[id].name, MODIFIER_BY_ID[id].desc) : ''),
        r.difficulty && r.difficulty > 1 ? row('📈', 'Saga depth', `Enemies have +${Math.round((r.difficulty - 1) * 100)}% HP and attack.`) : '',
      ].filter(Boolean)),
      sec(`Charms (${d.charms.size}/${CHARM_SLOTS})`, [...d.charms].map((id) => row(CHARM_BY_ID[id].icon, CHARM_BY_ID[id].name, CHARM_BY_ID[id].desc))),
      sec(isDay ? 'Formations standing (lock in at dusk)' : 'Formations tonight', FORMATIONS.filter((f) => counts.has(f.id)).map((f) =>
        row(f.icon, `${f.name}${counts.get(f.id)! > 1 ? ` ×${counts.get(f.id)}` : ''}`, f.text(d.formationValue(f.id)), `level ${d.formationLevel(f.id)}`))),
      sec('Star charts studied', FORMATIONS.filter((f) => (r.formations[f.id] ?? 1) > 1).map((f) =>
        row('✦', f.name, `Level ${r.formations[f.id]}: ${f.text(d.formationValue(f.id))}`))),
      sec('Active spells', timed),
      sec('How nights work', [
        row('🎯', 'Enemy targets', 'Enemies walk straight down their column. They attack bats in reach first, then the nearest roost in their column, then the cave.'),
        row('🏔', 'Leaks', `An enemy that reaches the cave hits it once for ${BALANCE.night.leakMult}× its attack, then is gone.`),
        row('🔨', 'Wrecked roosts', `A wrecked roost stops blocking and releases no bats until dawn, when it is rebuilt at ${BALANCE.rebuildHpPct}% HP${d.charms.has('phoenix') ? ' (Phoenix Roost: full HP, one level lower)' : ''}.`),
        row('🛡', 'Armour', `Bats from roosts at level ${BALANCE.roostLevel.armorLevel}+ take ${BALANCE.roostLevel.armorPct}% less damage.`),
        d.slots.some((s) => s.roost && !s.roost.nursery && BAT_BY_ID[s.roost.batId].clans.includes('SAN'))
          ? row('🩸', 'Vampire sharing', `At dawn, each vampire roost heals its neighbouring roosts ${BALANCE.adjacency.vampireDawnHealPct}%.`) : '',
      ].filter(Boolean)),
      sec('Economy', [
        row('◆', 'Dawn income', `About +${d.projectedIncome() + d.interestNow()} guano: base, 1 per ${BALANCE.economy.batsPerGuano} bats housed, Clusters${d.charms.has('scavenger') ? ', Scavenger kills' : ''}.`),
        row('🏦', 'Interest', `+1 guano per ${BALANCE.interest.per} unspent at dawn, up to ${d.interestCap}. Now: +${d.interestNow()}.`),
        row('↻', 'Reroll', d.refreshCost ? `${d.refreshCost} guano` : 'Free (once today)'),
      ]),
      sec('Enhanced cards in your deck', enhanced.map((c) => row(ENHANCE_BY_ID[c.mod!].icon, `${BAT_BY_ID[c.id]?.name ?? c.id}: ${ENHANCE_BY_ID[c.mod!].name}`, ENHANCE_BY_ID[c.mod!].desc))),
      sec('Terrain on this field', terrains.map((id) => row(TERRAIN[id].icon, TERRAIN[id].name, TERRAIN[id].desc))),
      h('button.big.primary', { onclick: () => close() }, 'Close'),
    );
    const close = modal(content, () => { paused = false; });
  };

  let paused = false;
  let last = performance.now();
  let acc = 0;
  let raf = 0;
  let finished = false;
  const DT = 1 / 60;
  const loop = (now: number) => {
    const elapsed = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (d.phase === 'night' && paused) {
      acc = 0;
    } else if (d.phase === 'night') {
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
    if (tut >= 0) finishTutorial();
    applyLevelResult(r, { shattered: d.shattered, brokenCharms: d.brokenCharms, tally: d.tally });
    resolveBattle(r, won, d.cave.hp);
    app.save();
    overlay.classList.add('show');
    overlay.replaceChildren(h('div.result-box',
      h('h1.title', won ? (node.type === 'boss' ? 'BOSS DEFEATED' : 'DAWN') : 'DEFEAT'),
      h('p', won ? `${d.encounter.name}: survived ${d.nights} nights.` : LOST_TEXT[d.lostReason]),
      h('button.big.primary', { onclick: () => (r.status === 'active' ? app.go({ name: 'reward' }) : endRun(app)) }, 'Continue'),
    ));
  };

  return h('div.screen.defense-screen',
    h('div.def-top',
      h('div', h('div.enc-name', `${node.type === 'battle' ? '' : node.type.toUpperCase() + ' · '}${d.encounter.name}`), phaseLabel),
      h('div.cave-mini', h('span.small', '🏔'), h('div.hpbar', caveFill), caveText),
      h('div.top-btns', effectsBtn, speedBtn),
    ),
    h('div.canvas-wrap', canvas, coach, overlay),
    info,
    h('div.def-controls', guano, piles, endBtn),
    clanBar,
    cards,
  );
});
