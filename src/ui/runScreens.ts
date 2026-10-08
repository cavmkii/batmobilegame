import { BALANCE } from '../data/balance';
import { BIOME_BY_ID, MODIFIER_BY_ID, rewardBonusPct } from '../data/setup';
import { MATRIARCH_BY_ID } from '../data/matriarchs';
import { BAT_BY_ID } from '../data/bats';
import { ENCOUNTERS } from '../data/enemies';
import type { Card } from '../data/types';
import type { NodeType } from '../game/map';
import { copiesIn } from '../game/deck';
import { CHARM_BY_ID, CHARM_SLOTS, charmSellValue } from '../data/charms';
import { ENHANCE_BY_ID } from '../data/enhance';
import { FORMATION_BY_ID, STAR_CHART_PRICE, type FormationId } from '../data/formations';
import { GOALS, sagaNode } from '../data/saga';
import { BOSS_RULE_BY_ID } from '../data/bossRules';
import {
  charmPrice, charmsFull, enhanceCard, sellCharm, studyChart, takeCharm,
  EVENT_BY_ID, addCard, availableNodes, cardName, chooseEventOption, combatRewards, deckFull, enterNode, finishRun, heal,
  leaveNode, removeCard, upgradeCard, type Offer, type RunState,
} from '../game/run';
import { registerScreen, type App } from './app';
import { batImg, cardFace, currencyBar, fmt, header } from './components';
import { h, modal, toast } from './dom';

export const NODE_ICON: Record<NodeType, string> = {
  battle: '⚔', elite: '☠', shop: '🛒', rest: '🔥', event: '?', treasure: '💎', boss: '🦉',
};

const run = (app: App) => app.profile.run!;

function runHud(app: App) {
  const r = run(app);
  const pct = r.caveHp / r.caveMax;
  return h('div.run-hud',
    h('div.cave-hp', h('span', '🏔 Cave'), h('div.hpbar', h('div', { style: `width:${pct * 100}%` })), h('span.small', `${fmt(r.caveHp)}/${fmt(r.caveMax)}`)),
    currencyBar([['🫐', r.figs], ['✨', r.xpEarned], ['🪲', r.glowEarned]]),
    h('div.charm-bar',
      ...Array.from({ length: CHARM_SLOTS }, (_, i) => {
        const id = r.charms[i];
        return id
          ? h('button.charm-slot.full', { onclick: () => charmDialog(app, id) }, CHARM_BY_ID[id].icon)
          : h('span.charm-slot', '·');
      }),
      h('span.small.muted', ' charms'),
    ),
  );
}

/** A charm's text, with the option to sell it (frees the slot). */
function charmDialog(app: App, id: string) {
  const r = run(app);
  const c = CHARM_BY_ID[id];
  let close = () => {};
  close = modal(h('div',
    h('h2', `${c.icon} ${c.name}`),
    h('p', c.desc),
    h('p.small.muted', c.rarity),
    h('div.actions',
      h('button', { onclick: () => { sellCharm(r, id); app.save(); close(); app.refresh(); } }, `Sell for 🫐 ${charmSellValue(id)}`),
      h('button.primary', { onclick: () => close() }, 'Keep'),
    ),
  ));
}

function charmCard(id: string, footer: Node) {
  const c = CHARM_BY_ID[id];
  return h(`div.charm-card.r-${c.rarity}`, h('div.cc-icon', c.icon), h('div', h('b', c.name), h('div.small', c.desc), h('div.small.muted', c.rarity)), footer);
}

function chartCard(id: FormationId, level: number, footer: Node) {
  const f = FORMATION_BY_ID[id];
  return h('div.charm-card.chart', h('div.cc-icon', '✦'),
    h('div', h('b', `Star chart: ${f.name}`), h('div.small', `${f.name} level ${level} → ${level + 1}. ${f.shape}.`),
      h('div.small.muted', `${f.text(f.base + f.step * (level - 1))} → ${f.text(f.base + f.step * level)}`)), footer);
}

export function depthOf(r: RunState) {
  return Math.max(0, ...r.cleared.map((id) => r.map.nodes[id].row + 1));
}

/** End the run, bank rewards, and show the summary. */
export function endRun(app: App) {
  const r = run(app);
  const depth = depthOf(r);
  const res = finishRun(app.profile, r);
  app.save();
  app.go({ name: 'runEnd', ...res, depth });
}

export function goToNode(app: App, nodeId: string) {
  const node = enterNode(run(app), nodeId);
  app.save();
  if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') app.go({ name: 'battle' });
  else if (node.type === 'shop') app.go({ name: 'shop' });
  else if (node.type === 'rest') app.go({ name: 'rest' });
  else if (node.type === 'event') app.go({ name: 'event' });
  else app.go({ name: 'reward' });
}

// ---------------- Map ----------------

registerScreen('map', (app) => {
  const r = run(app);
  const avail = new Set(availableNodes(r).map((n) => n.id));
  const rowH = 74;
  const H = r.map.rows.length * rowH + 20;
  const y = (row: number) => H - 40 - row * rowH;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 100 ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.classList.add('map-lines');
  for (const n of Object.values(r.map.nodes)) {
    for (const nx of n.next) {
      const m = r.map.nodes[nx];
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(n.x * 100));
      line.setAttribute('y1', String(y(n.row)));
      line.setAttribute('x2', String(m.x * 100));
      line.setAttribute('y2', String(y(m.row)));
      const walked = r.cleared.includes(n.id) && (r.cleared.includes(nx) || avail.has(nx));
      line.setAttribute('class', walked ? 'walked' : '');
      svg.append(line);
    }
  }
  const nodes = Object.values(r.map.nodes).map((n) => {
    const state = r.cleared.includes(n.id) ? 'cleared' : avail.has(n.id) ? 'available' : 'locked';
    const enc = n.encounter ? ENCOUNTERS.find((e) => e.id === n.encounter) : null;
    return h(`button.map-node.t-${n.type}.${state}`, {
      style: `left:${n.x * 100}%;top:${y(n.row)}px`,
      title: enc?.name ?? n.type,
      onclick: () => (state === 'available' ? goToNode(app, n.id)
        : toast(enc ? `${enc.name} (${n.type})${n.bossRule ? ` · ${BOSS_RULE_BY_ID[n.bossRule].name}: ${BOSS_RULE_BY_ID[n.bossRule].desc}` : ''}` : n.type)),
    }, NODE_ICON[n.type]);
  });
  const mat = MATRIARCH_BY_ID[r.matriarchId];
  return h('div.screen',
    header(`${BIOME_BY_ID[r.biome ?? '']?.icon ?? ''} ${BIOME_BY_ID[r.biome ?? '']?.name ?? 'Night Flight'}`, () => app.go({ name: 'home' }), h('button.ghost', { onclick: () => app.go({ name: 'deck' }) }, `Deck ${r.deck.length}`)),
    runHud(app),
    !app.profile.tutorialDone ? h('div.coach', h('div.coach-step', 'The run map'), h('div', 'A run is a path up this map to the boss at the top. Each ⚔ is a level of several nights. Tap a glowing node to start.')) : null,
    r.modifiers?.length ? h('div.mod-chips', ...r.modifiers.map((id) => h('span.tag', { title: MODIFIER_BY_ID[id]?.desc }, `${MODIFIER_BY_ID[id]?.icon} ${MODIFIER_BY_ID[id]?.name}`)), h('span.small.muted', ` rewards +${rewardBonusPct(r.modifiers)}%`)) : null,
    r.saga ? h('div.center.small', h('b', `Node ${r.saga}: ${sagaNode(r.saga).name}`), ' · ', sagaNode(r.saga).goals.map((g) => `★ ${GOALS[g].name}`).join(' · ')) : null,
    h('button.map-cmd', { onclick: () => toast(`${BAT_BY_ID[r.matriarchId].name}, ${mat.title}: ${mat.rule}`) }, batImg(r.matriarchId, 1), h('span.small', `♛ ${mat.title}`), h('span.small.muted', mat.rule)),
    h('div.map', { style: `height:${H}px` }, svg, ...nodes),
    h('div.legend.small.muted', ...Object.entries(NODE_ICON).map(([k, v]) => h('span', `${v} ${k}`))),
    h('button.ghost.small', {
      onclick: () => {
        if (confirm('Abandon this run? You keep XP and Glowbugs earned so far.')) {
          r.status = 'lost';
          endRun(app);
        }
      },
    }, 'Abandon run'),
  );
});

// ---------------- Deck ----------------

function deckGrid(app: App, onPick?: (c: Card) => void, filter?: (c: Card) => boolean) {
  const r = run(app);
  // Copies sit together, so it's easy to see what can merge.
  const cards = [...r.deck].filter((c) => !filter || filter(c))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  return h('div.card-grid', ...cards.map((c) => cardFace(c, app.profile.roster[c.id], {
    onclick: onPick ? () => onPick(c) : undefined,
  })));
}

registerScreen('deck', (app) => {
  const r = run(app);
  return h('div.screen', header(`Deck ${r.deck.length}/${BALANCE.run.deckCap}`, () => app.go({ name: 'map' })), deckGrid(app));
});

function pickFromDeck(app: App, title: string, filter: ((c: Card) => boolean) | undefined, onPick: (c: Card) => void) {
  let close = () => {};
  close = modal(h('div', h('h2', title), deckGrid(app, (c) => { close(); onPick(c); }, filter), h('button.ghost', { onclick: () => close() }, 'Cancel')));
}

/** "You have 2" for a card already in the deck. */
function copiesTag(deck: Card[], o: Pick<Card, 'kind' | 'id'>) {
  const n = copiesIn(deck, o);
  return n ? h('div.tag.copies', `In deck: ${n}`) : h('div.tag.new-species', 'New');
}

/** Take an offered card; at the deck cap, ask which card to drop. Returns via callback. */
function takeOffer(app: App, o: Offer, done: () => void) {
  const r = run(app);
  if (!deckFull(r)) {
    addCard(r, o);
    done();
    return;
  }
  pickFromDeck(app, `Deck full (${BALANCE.run.deckCap}). Remove a card to make room:`, undefined, (c) => {
    if (addCard(r, o, c.uid)) done();
    else toast('Could not swap that card.');
  });
}

// ---------------- Reward ----------------

registerScreen('reward', (app) => {
  const r = run(app);
  const node = r.map.nodes[r.activeNode!];
  const rw = node.type === 'battle' || node.type === 'elite' ? combatRewards(node.type, node.row) : null;
  const finish = () => {
    leaveNode(r);
    app.save();
    app.go({ name: 'map' });
  };
  return h('div.screen',
    header(node.type === 'treasure' ? 'Treasure' : 'Victory!'),
    runHud(app),
    rw ? h('p.center', `+${rw.figs} 🫐   +${rw.xp} ✨   +${rw.glow} 🪲`) : null,
    r.charmOffer?.length ? h('section',
      h('h2', 'Choose a charm'),
      charmsFull(r) ? h('p.small.muted', `Your ${CHARM_SLOTS} charm slots are full: sell one from the bar above to make room.`) : null,
      ...r.charmOffer.map((id) => charmCard(id, h('button.primary', {
        disabled: charmsFull(r),
        onclick: () => { takeCharm(r, id); r.charmOffer = null; app.save(); app.refresh(); },
      }, 'Take'))),
      h('button.ghost', { onclick: () => { r.charmOffer = null; app.save(); app.refresh(); } }, 'Skip charm'),
    ) : null,
    r.draft?.length ? h('section',
      h('h2', 'Choose a card'),
      h('p.muted.small', 'Copies of bats you already run make merges more likely; a new species adds a pattern and a clan.'),
      h('div.card-grid', ...r.draft.map((o) => cardFace({ ...o }, app.profile.roster[o.id], {
        onclick: () => takeOffer(app, o, () => { r.draft = null; app.save(); app.refresh(); }),
        footer: copiesTag(r.deck, o),
      }))),
      r.chartOffer ? h('div', h('p.small.muted', 'Or, instead of a card:'), chartCard(r.chartOffer, r.formations[r.chartOffer] ?? 1, h('button', {
        onclick: () => { studyChart(r, r.chartOffer!); r.chartOffer = null; r.draft = null; app.save(); app.refresh(); },
      }, 'Study'))) : null,
      h('button.ghost', { onclick: () => { r.draft = null; r.chartOffer = null; app.save(); app.refresh(); } }, 'Skip'),
    ) : null,
    !r.draft?.length && !r.charmOffer?.length ? h('button.big.primary', { onclick: finish }, 'Continue') : null,
    !r.draft?.length && r.charmOffer?.length ? h('button.ghost', { onclick: finish }, 'Leave the charm') : null,
  );
});

// ---------------- Shop ----------------

registerScreen('shop', (app) => {
  const r = run(app);
  const s = r.shop!;
  const P = BALANCE.shop;
  const buy = (price: number, fn: () => void) => () => {
    if (r.figs < price) return toast('Not enough Figs');
    r.figs -= price;
    fn();
    app.save();
    app.refresh();
  };
  return h('div.screen',
    header('Fig Market'),
    runHud(app),
    h('p.muted.small', 'A fruit bat colony trades in figs. Prices are in 🫐.'),
    h('div.card-grid', ...s.cards.map((o, i) => cardFace({ ...o }, app.profile.roster[o.id], {
      footer: h('div', copiesTag(r.deck, o), h('button.primary', {
        disabled: r.figs < o.price!,
        onclick: () => {
          if (r.figs < o.price!) return;
          takeOffer(app, o, () => { r.figs -= o.price!; s.cards.splice(i, 1); app.save(); app.refresh(); });
        },
      }, `🫐 ${o.price}`)),
    }))),
    s.charms.length ? h('h2', 'Charms') : null,
    ...s.charms.map((id, i) => charmCard(id, h('button.primary', {
      disabled: r.figs < charmPrice(id) || charmsFull(r),
      onclick: buy(charmPrice(id), () => { takeCharm(r, id); s.charms.splice(i, 1); }),
    }, charmsFull(r) ? 'Slots full' : `🫐 ${charmPrice(id)}`))),
    s.enhance.length ? h('h2', 'Moonlight') : null,
    s.enhance.length ? h('p.small.muted', 'Enhance a bat card in your deck. A card holds one enhancement; a new one replaces the old.') : null,
    ...s.enhance.map((mod, i) => {
      const e = ENHANCE_BY_ID[mod];
      return h('div.charm-card', h('div.cc-icon', e.icon), h('div', h('b', e.name), h('div.small', e.desc)), h('button.primary', {
        disabled: r.figs < e.price,
        onclick: () => pickFromDeck(app, `Make which card ${e.name}?`, (c) => c.kind === 'bat' || mod === 'sharp', (c) => {
          if (r.figs < e.price || !enhanceCard(r, c.uid, mod)) return;
          r.figs -= e.price;
          s.enhance.splice(i, 1);
          toast(`${cardName(c)} is now ${e.name}`);
          app.save();
          app.refresh();
        }),
      }, `🫐 ${e.price}`));
    }),
    s.chart ? chartCard(s.chart, r.formations[s.chart] ?? 1, h('button.primary', {
      disabled: r.figs < STAR_CHART_PRICE,
      onclick: buy(STAR_CHART_PRICE, () => { studyChart(r, s.chart!); s.chart = null; }),
    }, `🫐 ${STAR_CHART_PRICE}`)) : null,
    h('div.actions',
      h('button', {
        disabled: s.removeUsed || r.figs < P.remove,
        onclick: () => pickFromDeck(app, 'Remove which card?', undefined, (c) => {
          if (r.figs < P.remove || !removeCard(r, c.uid)) return toast('Cannot remove (minimum deck size 4).');
          r.figs -= P.remove;
          s.removeUsed = true;
          app.save();
          app.refresh();
        }),
      }, `Remove a card  🫐 ${P.remove}`),
      h('button', { disabled: s.healUsed || r.figs < P.heal || r.objective === 'fragile', onclick: buy(P.heal, () => { heal(r, r.caveMax * 0.2); s.healUsed = true; }) },
        r.objective === 'fragile' ? 'Fragile cave: no healing' : `Heal 20%  🫐 ${P.heal}`),
    ),
    h('button.big.primary', { onclick: () => { leaveNode(r); app.save(); app.go({ name: 'map' }); } }, 'Leave'),
  );
});

// ---------------- Rest ----------------

registerScreen('rest', (app) => {
  const r = run(app);
  const done = () => { leaveNode(r); app.save(); app.go({ name: 'map' }); };
  const amount = Math.round(r.caveMax * BALANCE.run.restHealPct);
  return h('div.screen',
    header('Roost'),
    runHud(app),
    h('p.center', 'The colony huddles together. Clustering saves heat: torpor and roost-mates are how small bats stretch their energy.'),
    h('div.actions.vertical',
      h('button.big.primary', { disabled: r.objective === 'fragile', onclick: () => { heal(r, amount); done(); } },
        r.objective === 'fragile' ? 'Fragile cave: resting can\'t heal it' : `Rest: heal ${fmt(amount)} cave HP`),
      h('button.big', {
        onclick: () => pickFromDeck(app, 'Make which card Sharp? (replaces another enhancement)', (c) => c.mod !== 'sharp', (c) => {
          upgradeCard(r, c.uid);
          toast(`${cardName(c)} is Sharp`);
          done();
        }),
      }, 'Train: make a card Sharp (+30%)'),
    ),
  );
});

// ---------------- Event ----------------

registerScreen('event', (app, s) => {
  const r = run(app);
  const ev = EVENT_BY_ID[r.event!];
  const leave = () => { leaveNode(r); app.save(); app.go({ name: 'map' }); };
  return h('div.screen',
    header(ev.title),
    runHud(app),
    h('p.event-text', ev.text),
    s.message
      ? h('div', h('p.center', h('b', s.message)), h('button.big.primary', { onclick: leave }, 'Continue'))
      : h('div.actions.vertical', ...ev.options.map((o, i) => h('button.big', {
        onclick: () => {
          const message = chooseEventOption(r, i);
          app.save();
          app.go({ name: 'event', message });
        },
      }, o.label, h('div.small.muted', o.detail)))),
  );
});

// ---------------- Run end ----------------

registerScreen('runEnd', (app, s) => {
  return h('div.screen',
    h('div.hero',
      h('h1.title', s.cleared ? (s.saga ? `Node ${s.saga} cleared!` : 'Act cleared!') : 'The colony retreats'),
      s.saga && s.cleared ? h('p.big-stars', '★'.repeat(s.stars ?? 0) + '☆'.repeat(3 - (s.stars ?? 0))) : null,
      h('p', s.cleared ? `Clear bonus ×${BALANCE.rewards.clearBonusMult} applied.` : 'Rewards earned so far are kept.'),
      currencyBar([['✨', `+${fmt(s.xp)}`], ['🪲', `+${fmt(s.glow)}`]]),
    ),
    h('div.menu',
      s.saga ? h('button.big.primary', { onclick: () => app.go({ name: 'saga' }) }, s.cleared ? 'Saga map: next node' : 'Saga map') : null,
      h(`button.big${s.saga ? '' : '.primary'}`, { onclick: () => app.go({ name: 'roster' }) }, 'Upgrade bats'),
      h('button.big', { onclick: () => app.go({ name: 'summon' }) }, 'Summon'),
      h('button.big', { onclick: () => app.go({ name: 'home' }) }, 'Home'),
    ),
  );
});
