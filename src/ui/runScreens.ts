import { BALANCE } from '../data/balance';
import { BIOME_BY_ID, MODIFIER_BY_ID, rewardBonusPct } from '../data/setup';
import { BAT_BY_ID } from '../data/bats';
import { ENCOUNTERS } from '../data/enemies';
import type { Card } from '../data/types';
import type { NodeType } from '../game/map';
import {
  EVENT_BY_ID, addCard, availableNodes, cardName, chooseEventOption, combatRewards, deckFull, enterNode, finishRun, heal,
  leaveNode, removeCard, takeRelic, upgradeCard, type Offer, type RunState,
} from '../game/run';
import { registerScreen, type App } from './app';
import { batImg, cardFace, clanPips, currencyBar, fmt, header, relicCard, relicChip } from './components';
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
    h('div.relics', ...r.relics.map(relicChip)),
  );
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
      onclick: () => (state === 'available' ? goToNode(app, n.id) : toast(enc ? `${enc.name} (${n.type})` : n.type)),
    }, NODE_ICON[n.type]);
  });
  const cmd = BAT_BY_ID[r.commanderId];
  return h('div.screen',
    header(`${BIOME_BY_ID[r.biome ?? '']?.icon ?? ''} ${BIOME_BY_ID[r.biome ?? '']?.name ?? 'Night Flight'}`, () => app.go({ name: 'home' }), h('button.ghost', { onclick: () => app.go({ name: 'deck' }) }, `Deck ${r.deck.length}`)),
    runHud(app),
    r.modifiers?.length ? h('div.mod-chips', ...r.modifiers.map((id) => h('span.tag', { title: MODIFIER_BY_ID[id]?.desc }, `${MODIFIER_BY_ID[id]?.icon} ${MODIFIER_BY_ID[id]?.name}`)), h('span.small.muted', ` rewards +${rewardBonusPct(r.modifiers)}%`)) : null,
    h('div.map-cmd', batImg(cmd.id, 1), h('span.small', cmd.name), clanPips(cmd.clans)),
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
  const cards = [{ kind: 'bat', id: r.commanderId, uid: 'cmd', upgraded: false } as Card, ...r.deck]
    .filter((c) => c.uid !== 'cmd' || !onPick)
    .filter((c) => !filter || filter(c));
  return h('div.card-grid', ...cards.map((c) => cardFace(c, app.profile.roster[c.id], {
    onclick: onPick ? () => onPick(c) : undefined,
    footer: c.uid === 'cmd' ? 'Commander' : undefined,
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
  const relicId = r.rewardRelic;
  return h('div.screen',
    header(node.type === 'treasure' ? 'Treasure' : 'Victory!'),
    runHud(app),
    rw ? h('p.center', `+${rw.figs} 🫐   +${rw.xp} ✨   +${rw.glow} 🪲`) : null,
    relicId ? h('section', h('h2', 'Relic'), relicCard(relicId, h('button.primary', {
      onclick: () => { takeRelic(r, relicId); r.rewardRelic = null; app.save(); app.refresh(); },
    }, 'Take'))) : null,
    r.draft?.length ? h('section',
      h('h2', 'Choose a card'),
      h('div.card-grid', ...r.draft.map((o) => cardFace({ ...o, upgraded: false }, app.profile.roster[o.id], {
        onclick: () => takeOffer(app, o, () => { r.draft = null; app.save(); app.refresh(); }),
      }))),
      h('button.ghost', { onclick: () => { r.draft = null; app.save(); app.refresh(); } }, 'Skip card'),
    ) : null,
    !r.draft?.length && !relicId ? h('button.big.primary', { onclick: finish }, 'Continue') : null,
    !r.draft?.length && relicId ? h('button.ghost', { onclick: finish }, 'Leave relic') : null,
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
    h('div.card-grid', ...s.cards.map((o, i) => cardFace({ ...o, upgraded: false }, app.profile.roster[o.id], {
      footer: h('button.primary', {
        disabled: r.figs < o.price!,
        onclick: () => {
          if (r.figs < o.price!) return;
          takeOffer(app, o, () => { r.figs -= o.price!; s.cards.splice(i, 1); app.save(); app.refresh(); });
        },
      }, `🫐 ${o.price}`),
    }))),
    s.relic ? relicCard(s.relic, h('button.primary', {
      disabled: r.figs < P.relic,
      onclick: buy(P.relic, () => { takeRelic(r, s.relic); s.relic = null; }),
    }, `🫐 ${P.relic}`)) : null,
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
      h('button', { disabled: s.healUsed || r.figs < P.heal, onclick: buy(P.heal, () => { heal(r, r.caveMax * 0.2); s.healUsed = true; }) },
        `Heal 20%  🫐 ${P.heal}`),
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
      h('button.big.primary', { onclick: () => { heal(r, amount); done(); } }, `Rest: heal ${fmt(amount)} cave HP`),
      h('button.big', {
        onclick: () => pickFromDeck(app, 'Upgrade which card?', (c) => !c.upgraded, (c) => {
          upgradeCard(r, c.uid);
          toast(`${cardName(c)} upgraded`);
          done();
        }),
      }, 'Train: upgrade a card'),
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
      h('h1.title', s.cleared ? 'Act cleared!' : 'The colony retreats'),
      h('p', s.cleared ? `Clear bonus ×${BALANCE.rewards.clearBonusMult} applied.` : `Reached depth ${s.depth}/${BALANCE.run.rows}. Rewards are kept by depth.`),
      currencyBar([['✨', `+${fmt(s.xp)}`], ['🪲', `+${fmt(s.glow)}`]]),
    ),
    h('div.menu',
      h('button.big.primary', { onclick: () => app.go({ name: 'roster' }) }, 'Upgrade bats'),
      h('button.big', { onclick: () => app.go({ name: 'summon' }) }, 'Summon'),
      h('button.big', { onclick: () => app.go({ name: 'home' }) }, 'Home'),
    ),
  );
});
