import { BAT_BY_ID } from '../data/bats';
import { ENCOUNTERS } from '../data/enemies';
import { SPELL_BY_ID } from '../data/spells';
import type { Card } from '../data/types';
import { Battle } from '../game/battle';
import { resolveBattle } from '../game/run';
import { BattleRenderer } from '../render/battleRenderer';
import { registerScreen } from './app';
import { batImg, clanPips, rarityOf } from './components';
import { h } from './dom';
import { RARITY_COLOR } from '../data/clans';
import { endRun } from './runScreens';

const hash = (s: string) => [...s].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);

function handCard(b: Battle, c: Card | null, onPlay: () => void) {
  if (!c) return h('div.hand-card.empty');
  const name = c.kind === 'bat' ? BAT_BY_ID[c.id].name : SPELL_BY_ID[c.id].name;
  const clans = c.kind === 'bat' ? BAT_BY_ID[c.id].clans : SPELL_BY_ID[c.id].clans;
  return h('button.hand-card', {
    style: `--rarity:${RARITY_COLOR[rarityOf(c)]}`,
    onpointerdown: (e: PointerEvent) => { e.preventDefault(); onPlay(); },
  },
  h('span.cost', b.cardCost(c)),
  c.kind === 'bat' ? batImg(c.id, 2) : h('div.spell-icon', SPELL_BY_ID[c.id].icon),
  h('div.hc-name', name.replace(/ Bat$/, '') + (c.upgraded ? '+' : '')),
  clanPips(clans),
  );
}

registerScreen('battle', (app) => {
  const r = app.profile.run!;
  const node = r.map.nodes[r.activeNode!];
  const enc = ENCOUNTERS.find((e) => e.id === node.encounter)!;
  const battle = new Battle({
    encounterId: enc.id,
    row: node.row,
    deck: r.deck,
    commanderId: r.commanderId,
    roster: app.profile.roster,
    relics: r.relics,
    caveHp: r.caveHp,
    caveMax: r.caveMax,
    seed: (r.rngState ^ hash(node.id)) >>> 0,
  });

  const canvas = h('canvas.battle-canvas');
  // Fill the vertical space between the header and the hand on tall screens.
  const cssW = Math.min(window.innerWidth - 24, 496);
  const spare = window.innerHeight - 290;
  const renderer = new BattleRenderer(canvas, battle, (Math.max(cssW / 2, spare) / cssW) * 480);
  const energyFill = h('div.energy-fill');
  const energyText = h('span.energy-text');
  const nextLine = h('div.next-card.small.muted');
  const handRow = h('div.hand');
  const cmdBtn = h('button.hand-card.commander', {
    onpointerdown: (e: PointerEvent) => { e.preventDefault(); battle.deployCommander(); },
  });
  // Exposed in dev builds so automated playtests can drive or fast-forward a battle.
  if (import.meta.env.DEV) (window as unknown as { __battle: Battle }).__battle = battle;
  let speed = 1;
  let paused = false;
  const speedBtn = h('button.ghost.small', { onclick: () => { speed = speed === 1 ? 2 : 1; speedBtn.textContent = `${speed}×`; } }, '1×');
  const pauseBtn = h('button.ghost.small', { onclick: () => { paused = !paused; pauseBtn.textContent = paused ? '▶' : '⏸'; } }, '⏸');

  let handKey = '';
  const rebuildHand = () => {
    handRow.replaceChildren(...battle.hand.map((c, i) => handCard(battle, c, () => battle.playCard(i))));
  };

  const cmdDef = BAT_BY_ID[r.commanderId];
  const updateUi = () => {
    const key = battle.hand.map((c) => c?.uid ?? '-').join(',');
    if (key !== handKey) {
      handKey = key;
      rebuildHand();
    }
    [...handRow.children].forEach((el, i) => el.classList.toggle('disabled', !battle.canPlay(i)));
    const next = battle.drawPile[0];
    nextLine.textContent = next ? `Next: ${next.kind === 'bat' ? BAT_BY_ID[next.id].name : SPELL_BY_ID[next.id].name}${next.upgraded ? '+' : ''} · ${battle.drawPile.length} in draw pile` : '';
    energyFill.style.width = `${(battle.energy / battle.maxEnergy) * 100}%`;
    energyText.textContent = `${Math.floor(battle.energy)} / ${battle.maxEnergy}`;
    const cost = battle.commanderCost();
    cmdBtn.classList.toggle('disabled', !battle.canDeployCommander());
    cmdBtn.classList.toggle('alive', battle.commander.alive);
    cmdBtn.replaceChildren(
      h('span.cost', cost),
      batImg(cmdDef.id, 2),
      h('div.hc-name', battle.commander.alive ? 'In battle' : cmdDef.name.split(' ').slice(-2).join(' ')),
      battle.commander.deaths ? h('div.tax', `tax +${cost - battle.commander.bp.cost}`) : '',
    );
  };

  let last = performance.now();
  let acc = 0;
  let raf = 0;
  let finished = false;
  const DT = 1 / 60;
  const loop = (now: number) => {
    const elapsed = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!paused) {
      acc += elapsed * speed;
      while (acc >= DT) {
        battle.step(DT);
        acc -= DT;
      }
    }
    renderer.draw();
    updateUi();
    if (battle.result && !finished) {
      finished = true;
      setTimeout(showResult, 600);
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  app.onLeave = () => cancelAnimationFrame(raf);

  const overlay = h('div.battle-overlay');
  const showResult = () => {
    const won = battle.result === 'won';
    resolveBattle(r, won, battle.playerBase.hp);
    app.save();
    overlay.classList.add('show');
    overlay.replaceChildren(h('div.result-box',
      h('h1.title', won ? (node.type === 'boss' ? 'BOSS DEFEATED' : 'VICTORY') : 'DEFEAT'),
      h('p', won ? `${enc.name} cleared in ${Math.floor(battle.time)}s.` : 'The cave has fallen.'),
      h('button.big.primary', {
        onclick: () => {
          if (r.status === 'active') app.go({ name: 'reward' });
          else endRun(app);
        },
      }, 'Continue'),
    ));
  };

  return h('div.screen.battle-screen',
    h('div.battle-top', h('span.enc-name', `${node.type === 'battle' ? '' : node.type.toUpperCase() + ' · '}${enc.name}`), h('span', pauseBtn, speedBtn)),
    h('div.canvas-wrap', canvas, overlay),
    nextLine,
    h('div.energy', energyFill, energyText),
    h('div.hand-wrap', cmdBtn, handRow),
    h('p.hint.small.muted', 'Tap a card to play it. Played cards go to the bottom of your deck.'),
  );
});
