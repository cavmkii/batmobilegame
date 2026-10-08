import { BAT_BY_ID } from '../data/bats';
import { CLANS, RARITY_COLOR } from '../data/clans';
import { ENHANCE_BY_ID, isSharp } from '../data/enhance';
import { SPELL_BY_ID } from '../data/spells';
import type { Card, ClanId, Rarity } from '../data/types';
import { attackLabel, blueprint, describeTrait, displayName, type OwnedBat } from '../game/progression';
import { batImageUrl } from '../render/pixel';
import { h } from './dom';

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export function clanPips(clans: ClanId[]) {
  if (!clans.length) return h('span.pips', h('span.pip.colorless', { title: 'Colorless' }));
  return h('span.pips', ...clans.map((c) => h('span.pip', { style: `background:${CLANS[c].color}`, title: CLANS[c].name })));
}

export function batImg(batId: string, scale = 2) {
  return h('img.pixel', { src: batImageUrl(batId, scale), alt: BAT_BY_ID[batId].name, draggable: false });
}

export function rarityOf(card: Pick<Card, 'kind' | 'id'>): Rarity {
  return card.kind === 'bat' ? BAT_BY_ID[card.id].rarity : SPELL_BY_ID[card.id].rarity;
}

/**
 * A full card face for deck lists, drafts and the shop.
 * `owned` is the roster entry used for stats (undefined = unowned → level 1).
 */
export function cardFace(card: Pick<Card, 'kind' | 'id' | 'mod'> & { upgraded?: boolean }, owned?: OwnedBat, opts: { onclick?: () => void; footer?: Node | string; selected?: boolean; compact?: boolean } = {}) {
  const rarity = rarityOf(card);
  const cls = `card-face r-${rarity}${opts.selected ? ' selected' : ''}${opts.compact ? ' compact' : ''}${isSharp(card) ? ' upgraded' : ''}`;
  let art: Node, name: string, cost: number, clans: ClanId[], lines: string[], sub: string;
  if (card.kind === 'bat') {
    const def = BAT_BY_ID[card.id];
    const bp = blueprint(card.id, owned, isSharp(card));
    art = batImg(card.id, 2);
    name = displayName(def, owned);
    cost = bp.cost;
    clans = def.clans;
    const lvl = owned ? `Lv ${owned.level}${owned.plus ? `+${owned.plus}` : ''}` : 'Lv 1 (unowned)';
    sub = def.basic ? 'Basic' : lvl;
    lines = [
      `Roost ❤${fmt(bp.roost.hp)} · up to ${bp.roost.count} bat${bp.roost.count > 1 ? 's' : ''}, +${bp.roost.batch} every ${bp.roost.respawn}s`,
      attackLabel(bp.traits, bp.stats.range),
      `Each bat ❤${fmt(bp.stats.hp)} ⚔${fmt(bp.stats.atk)} every ${bp.stats.rate}s`,
      ...bp.traits.map(describeTrait),
    ];
  } else {
    const s = SPELL_BY_ID[card.id];
    art = h('div.spell-icon', s.icon);
    name = s.name;
    cost = s.cost;
    clans = s.clans;
    sub = 'Spell';
    lines = [s.desc + (isSharp(card) ? ' (Sharp: +40% power)' : '')];
  }
  return h(`div.${cls.split(' ').join('.')}`, { onclick: opts.onclick, style: `--rarity:${RARITY_COLOR[rarity]}` },
    h('div.cf-top', h('span.cost', cost), clanPips(clans)),
    h('div.cf-art', art),
    h('div.cf-name', name),
    card.mod ? h('div.cf-mod', `${ENHANCE_BY_ID[card.mod].icon} ${ENHANCE_BY_ID[card.mod].name}`) : null,
    h('div.cf-sub', sub),
    !opts.compact && h('div.cf-lines', ...lines.map((l) => h('div', l))),
    card.kind === 'bat' && !opts.compact ? patternGrid(card.id, 'sm', blueprint(card.id, owned).pattern) : null,
    opts.footer && h('div.cf-footer', opts.footer),
  );
}

/**
 * The tiles a bat's roost also levels when you stack it, as a small grid.
 * The centre is the roost; up is toward the enemies.
 */
export function patternGrid(batId: string, size: 'sm' | 'xs' = 'sm', pattern?: [number, number][]) {
  const pat = pattern ?? BAT_BY_ID[batId].pattern;
  if (!pat.length) return h(`div.pattern.${size}.none`, 'no spread');
  const reach = Math.max(1, ...pat.map(([c, r]) => Math.max(Math.abs(c), Math.abs(r))));
  const cells: Node[] = [];
  for (let r = -reach; r <= reach; r++) {
    for (let c = -reach; c <= reach; c++) {
      const on = pat.some(([pc, pr]) => pc === c && pr === r);
      cells.push(h(`span${c === 0 && r === 0 ? '.me' : on ? '.on' : ''}`));
    }
  }
  return h(`div.pattern.${size}`, { style: `grid-template-columns: repeat(${reach * 2 + 1}, 1fr)`, title: 'Merging this roost also gives +1 to these tiles (hold a card to see them on the field)' }, ...cells);
}


export function currencyBar(items: [string, string | number][]) {
  return h('div.currency', ...items.map(([icon, v]) => h('span', icon, ' ', typeof v === 'number' ? fmt(v) : v)));
}

export function header(title: string, onBack?: () => void, right?: Node) {
  return h('header.bar', onBack ? h('button.ghost', { onclick: onBack }, '‹ Back') : h('span'), h('h1', title), right ?? h('span'));
}
