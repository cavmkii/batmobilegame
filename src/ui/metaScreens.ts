import { BALANCE } from '../data/balance';
import { BATS, BAT_BY_ID, STARTER_COMMONS, STARTER_MATRIARCHS } from '../data/bats';
import { CLANS, CLAN_ORDER, RARITY_COLOR, SYNERGY, SYNERGY_TIERS } from '../data/clans';
import { MATRIARCH_BY_ID, MATRIARCH_GUANO_EVERY, matriarchGuano } from '../data/matriarchs';
import { flockOptions, validateSetup } from '../game/deck';
import { canTakePlus, pull, resolveDupe, type PullResult } from '../game/gacha';
import { chooseStarter, exportSave, importSave, resetProfile } from '../game/profile';
import {
  attackLabel, blueprint, canEvolve, canLevelUp, canTalent, chooseSkill, describeTrait, displayName, dupeXp, evolveCost, levelCap, levelUpCost,
  skillsReady, talentCost,
} from '../game/progression';
import { SKILL_LEVELS, SKILL_TREES, describeSkill } from '../data/skills';
import { Rng, newSeed } from '../game/rng';
import { startRun } from '../game/run';
import { COLLECTABLE, MILESTONES, REGION, REGION_ICON, REGION_SETS, REGIONS, STATUS, regionMembers, type Reward } from '../data/fieldguide';
import { claim, claimable, ownedSet } from '../game/collection';
import { ENEMIES } from '../data/enemies';
import { BIOMES, MODIFIERS, rewardBonusPct } from '../data/setup';
import { enemyImageUrl } from '../render/pixel';
import { registerScreen, type App } from './app';
import { batImg, clanPips, currencyBar, fmt, header, patternGrid } from './components';
import { h, modal, toast } from './dom';

const wallet = (app: App) => currencyBar([['✨', app.profile.xp], ['🪲', app.profile.glow]]);

// ---------------- Starter ----------------

registerScreen('starter', (app) => {
  const cards = STARTER_MATRIARCHS.map((id) => {
    const def = BAT_BY_ID[id];
    const m = MATRIARCH_BY_ID[id];
    return h('button.starter', {
      onclick: () => {
        chooseStarter(app.profile, id);
        app.save();
        app.go({ name: 'home' });
      },
    },
    batImg(id, 3),
    h('div.cf-name', def.name),
    h('div.mat-title', `♛ ${m.title}`),
    h('div.small', m.rule),
    );
  });
  return h('div.screen',
    h('div.hero', h('h1.title', 'BATMOBILE'), h('p', 'Choose the matriarch who leads your colony. Each one bends one rule of the game. More can be found in the Summon cave.')),
    h('div.starter-row', ...cards),
    h('p.muted.center', 'You also start with one common bat from every clan and enough Glowbugs for a ten-pull.'),
  );
});

// ---------------- Home ----------------

registerScreen('home', (app) => {
  const p = app.profile;
  const owned = Object.keys(p.roster).length - 1;
  const total = BATS.filter((b) => !b.basic).length;
  return h('div.screen',
    h('div.hero', h('h1.title', 'BATMOBILE'), wallet(app)),
    h('div.menu',
      h('button.big.primary.main-btn', { onclick: () => app.go({ name: p.run ? 'map' : 'prep' }) },
        h('span.mb-icon', '▶'), h('span', p.run ? 'Continue run' : 'Play'), h('span.mb-sub', p.run ? 'A run is in progress' : 'Choose matriarch, flock, map and modifiers')),
      h('button.big.main-btn', { onclick: () => app.go({ name: 'guides' }) },
        h('span.mb-icon', '📖'), h('span', 'Field Guides'), h('span.mb-sub', `Bats ${owned}/${total}`),
        claimable(p).length ? h('span.badge', claimable(p).length) : null),
      h('button.big.main-btn', { onclick: () => app.go({ name: 'summon' }) },
        h('span.mb-icon', '🦇'), h('span', 'Summon'), h('span.mb-sub', `🪲 ${fmt(p.glow)}`),
        p.pendingDupes.length ? h('span.badge', p.pendingDupes.length) : null),
    ),
    h('div.stats.muted', `Runs ${p.stats.runs} · Clears ${p.stats.clears} · Best depth ${p.stats.bestRow}/${BALANCE.run.rows} · Pulls ${p.stats.pulls}`),
    h('div.center',
      p.tutorialDone ? h('button.ghost.small', { onclick: () => { p.tutorialDone = false; app.save(); toast('The tutorial will play in your next level.'); } }, 'Replay tutorial') : null,
      h('button.ghost.small', { onclick: () => backupDialog(app) }, 'Back up / restore save'),
    ),
    h('button.ghost.small', {
      onclick: () => {
        if (confirm('Erase all progress?')) {
          app.profile = resetProfile();
          app.go({ name: 'starter' });
        }
      },
    }, 'Reset save'),
  );
});

function backupDialog(app: App) {
  const code = exportSave(app.profile);
  const area = h('textarea', { readonly: true }, code) as HTMLTextAreaElement;
  const input = h('textarea', { placeholder: 'Paste a backup code here to restore it' }) as HTMLTextAreaElement;
  let close = () => {};
  close = modal(h('div.backup',
    h('h2', 'Back up your save'),
    h('p.small.muted', 'iPhone can clear data for home-screen apps that go unused for a while. Copy this code somewhere safe (e.g. Notes).'),
    area,
    h('button.primary', {
      onclick: async () => {
        try { await navigator.clipboard.writeText(code); toast('Backup code copied'); } catch { area.select(); toast('Select and copy the code'); }
      },
    }, 'Copy code'),
    h('h2', 'Restore'),
    input,
    h('button', {
      onclick: () => {
        const p = importSave(input.value);
        if (!p) return toast('That code is not a valid save.');
        if (!confirm('Replace your current progress with this backup?')) return;
        app.profile = p;
        app.save();
        close();
        app.go({ name: 'home' });
        toast('Save restored');
      },
    }, 'Restore from code'),
    h('button.ghost', { onclick: () => close() }, 'Close'),
  ));
}

// ---------------- Roster ----------------

let guideView: 'clan' | 'region' = 'clan';

registerScreen('roster', (app) => {
  const p = app.profile;
  const owned = ownedSet(p);
  const found = COLLECTABLE.filter((id) => owned.has(id)).length;
  const pct = Math.round((found / COLLECTABLE.length) * 100);

  const cell = (b: (typeof BATS)[number]) => {
    const o = p.roster[b.id];
    const up = o && (canLevelUp(b, o, p.xp) || canEvolve(b, o, p.xp));
    const where = REGION[b.id];
    return h(`button.roster-cell.r-${b.rarity}${o ? '' : '.locked'}`, {
      style: `--rarity:${RARITY_COLOR[b.rarity]}`,
      onclick: () => (o ? app.go({ name: 'bat', id: b.id }) : toast(`Not yet found · ${b.rarity}${where ? ` · ${REGION_ICON[where]} ${where}` : ''}`)),
    },
    batImg(b.id, 2),
    h('div.rc-name', o ? displayName(b, o) : '???'),
    o ? h('div.rc-lvl', `Lv ${o.level}${o.plus ? `+${o.plus}` : ''}${o.evolved ? ' ★' : ''}`) : h('div.rc-lvl', `${where ? REGION_ICON[where] + ' ' : ''}${b.rarity}`),
    up || skillsReady(b.id, o) ? h('span.dot') : null,
    );
  };

  const rewardRow = (r: Reward) => {
    const [have, need] = r.progress(owned);
    const done = p.claimed.includes(r.id);
    const ready = !done && r.needs(owned);
    return h(`div.reward-row${done ? '.done' : ''}`,
      h('div', h('b', r.label), h('div.small.muted', `🪲${fmt(r.glow)}  ✨${fmt(r.xp)}`)),
      done ? h('span.tag', 'Claimed')
        : ready ? h('button.primary.small', { onclick: () => { claim(p, r.id); app.save(); toast(`+${fmt(r.glow)} Glowbugs, +${fmt(r.xp)} XP`); app.refresh(); } }, 'Claim')
          : h('span.small.muted', `${have}/${need}`),
    );
  };

  const nextMilestone = MILESTONES.find((m) => !p.claimed.includes(m.id) && !m.needs(owned));
  const ready = claimable(p);

  const sections = guideView === 'clan'
    ? [...CLAN_ORDER.map((c) => ({ title: CLANS[c].name, color: CLANS[c].color, ids: BATS.filter((b) => !b.matriarch && !b.basic && b.clans[0] === c).map((b) => b.id), set: null as Reward | null })),
      { title: 'Matriarchs', color: RARITY_COLOR.legendary, ids: BATS.filter((b) => b.matriarch).map((b) => b.id), set: null as Reward | null }]
    : REGIONS.map((r, i) => ({ title: `${REGION_ICON[r]} ${r}`, color: 'var(--text)', ids: regionMembers(r), set: REGION_SETS[i] as Reward | null }));

  return h('div.screen',
    header('Bats of the World', () => app.go({ name: 'guides' }), wallet(app)),
    h('div.guide-summary',
      h('div.guide-count', h('b', `${found}`), ` / ${COLLECTABLE.length} species`, h('span.muted', ` · ${pct}%`)),
      h('div.hpbar', h('div', { style: `width:${pct}%` })),
      nextMilestone ? h('div.small.muted', `Next: ${nextMilestone.label} (🪲${fmt(nextMilestone.glow)})`) : null,
    ),
    ready.length ? h('section', h('h2', 'Rewards ready'), ...ready.map(rewardRow)) : null,
    h('div.seg',
      h(`button${guideView === 'clan' ? '.on' : ''}`, { onclick: () => { guideView = 'clan'; app.refresh(); } }, 'By clan'),
      h(`button${guideView === 'region' ? '.on' : ''}`, { onclick: () => { guideView = 'region'; app.refresh(); } }, 'By region'),
    ),
    ...sections.map((g) => h('section',
      h('h2', { style: `color:${g.color}` }, g.title, h('span.muted.small', `  ${g.ids.filter((id) => owned.has(id)).length}/${g.ids.length}`)),
      g.set ? rewardRow(g.set) : null,
      h('div.roster-grid', ...g.ids.map((id) => cell(BAT_BY_ID[id]))),
    )),
    h('section', h('h2', 'Milestones'), ...MILESTONES.map(rewardRow)),
  );
});

// ---------------- Field guides shelf ----------------

registerScreen('guides', (app) => {
  const p = app.profile;
  const owned = ownedSet(p);
  const bats = COLLECTABLE.filter((id) => owned.has(id)).length;
  const preds = ENEMIES.filter((e) => p.seenEnemies.includes(e.id)).length;
  const book = (title: string, sub: string, color: string, icon: string, go?: () => void, badge = 0) =>
    h(`button.book${go ? '' : '.locked'}`, { style: `--book:${color}`, onclick: go ?? (() => toast('More field guides are coming.')) },
      h('div.book-spine'), h('div.book-icon', icon), h('div.book-title', title), h('div.small.muted', sub),
      badge ? h('span.badge', badge) : null);
  return h('div.screen',
    header('Field Guides', () => app.go({ name: 'home' }), wallet(app)),
    h('p.muted.small.center', 'Entries fill in as you find species. Unfound entries stay blacked out.'),
    h('div.shelf',
      book('Bats of the World', `${bats} / ${COLLECTABLE.length} species`, '#6a3a8a', '🦇', () => app.go({ name: 'roster' }), claimable(p).length),
      book('Predators & Prey', `${preds} / ${ENEMIES.length} entries`, '#8a4a2a', '🦉', () => app.go({ name: 'bestiary' })),
      book('???', 'Coming soon', '#3a3a4a', '🔒'),
    ),
  );
});

registerScreen('bestiary', (app) => {
  const p = app.profile;
  const seen = new Set(p.seenEnemies);
  const found = ENEMIES.filter((e) => seen.has(e.id)).length;
  return h('div.screen',
    header('Predators & Prey', () => app.go({ name: 'guides' }), wallet(app)),
    h('div.guide-summary',
      h('div.guide-count', h('b', `${found}`), ` / ${ENEMIES.length} entries`),
      h('div.small.muted', 'Entries unlock when the creature first appears in a night.'),
    ),
    ...ENEMIES.map((e) => {
      const known = seen.has(e.id);
      return h(`div.entry${known ? '' : '.unknown'}`,
        h('img.pixel', { src: enemyImageUrl(e.id, 2), alt: known ? e.name : 'Unknown' }),
        known
          ? h('div', h('b', e.name),
            h('div.small.muted', `❤ ${e.stats.hp} · ⚔ ${e.stats.atk} · ${e.stats.range >= 100 ? 'ranged' : 'melee'} · ${e.stats.speed >= 60 ? 'fast' : e.stats.speed <= 25 ? 'slow' : 'steady'}`),
            e.traits.length ? h('div.small', e.traits.map(describeTrait).join(' · ')) : null,
            h('p.fact', e.fact))
          : h('div', h('b', '???'), h('div.small.muted', 'Not yet encountered.')),
      );
    }),
  );
});

// ---------------- Bat detail ----------------

registerScreen('bat', (app, s) => {
  const p = app.profile;
  const def = BAT_BY_ID[s.id];
  const o = p.roster[s.id];
  const bp = blueprint(s.id, o);
  const act = (fn: () => void) => () => {
    fn();
    app.save();
    app.refresh();
  };
  const lvlCost = levelUpCost(def, o);
  const atCap = o.level >= levelCap(o);
  return h('div.screen',
    header(displayName(def, o), () => app.go({ name: 'roster' }), wallet(app)),
    h('div.detail',
      h('div.detail-art', { style: `--rarity:${RARITY_COLOR[def.rarity]}` }, batImg(s.id, 4)),
      h('div',
        h('div.muted', h('i', def.species), ' · ', h('span', { style: `color:${RARITY_COLOR[def.rarity]}` }, def.rarity)),
        REGION[s.id] ? h('div.small', `${REGION_ICON[REGION[s.id]]} ${REGION[s.id]}`) : null,
        STATUS[s.id] ? h('div.small.status', `⚠ ${STATUS[s.id]}`) : null,
        h('div', clanPips(def.clans), ' ', def.clans.map((c) => CLANS[c].name).join(' / ') || 'Colorless'),
        def.matriarch ? h('div.tag', `♛ Matriarch: ${MATRIARCH_BY_ID[s.id].title}`) : null,
        h('div.big-level', `Lv ${o.level}`, o.plus ? h('span.plus', `+${o.plus}`) : null, h('span.muted', ` / ${levelCap(o)}`)),
      ),
    ),
    def.matriarch ? null : h('table.stats-table',
      h('tr', h('td', 'Cost'), h('td', bp.cost), h('td', 'HP'), h('td', fmt(bp.stats.hp))),
      h('tr', h('td', 'Attack'), h('td', fmt(bp.stats.atk)), h('td', 'Range'), h('td', bp.stats.range)),
      h('tr', h('td', 'Rate'), h('td', `${bp.stats.rate}s`), h('td', 'Speed'), h('td', Math.round(bp.stats.speed))),
      h('tr', h('td', 'Roost HP'), h('td', fmt(bp.roost.hp)), h('td', 'Max bats'), h('td', bp.roost.count)),
      h('tr', h('td', 'Refill'), h('td', `${bp.roost.respawn}s`), h('td', 'Spread'), h('td', patternGrid(s.id, 'xs', bp.pattern))),
    ),
    def.matriarch ? null : h('p.small', attackLabel(bp.traits, bp.stats.range)),
    def.matriarch ? h('p', h('b', MATRIARCH_BY_ID[s.id].rule), ' ', h('span.muted', MATRIARCH_BY_ID[s.id].why)) : null,
    def.matriarch ? h('p.small', `Matriarchs don't fight. Every ${MATRIARCH_GUANO_EVERY} levels she adds +1 starting guano to each level of a run she leads (now +${matriarchGuano(o.level, o.plus)}).`) : null,
    bp.traits.length && !def.matriarch ? h('ul.traits', ...bp.traits.map((t) => h('li', describeTrait(t)))) : null,
    h('p.fact', '🦇 ', def.fact),
    h('div.actions',
      h('button.primary', { disabled: atCap || !canLevelUp(def, o, p.xp), onclick: act(() => { p.xp -= lvlCost; o.level++; }) },
        atCap ? (o.evolved ? 'Max level' : `Level cap ${levelCap(o)}`) : `Level up  ✨${fmt(lvlCost)}`),
      !o.evolved && !def.basic
        ? h('button', { disabled: !canEvolve(def, o, p.xp), onclick: act(() => { p.xp -= evolveCost(def); o.evolved = true; }) },
          `Evolve → ${def.evolved.name}  ✨${fmt(evolveCost(def))}`, o.level < BALANCE.levelCap ? h('div.small', `Needs Lv ${BALANCE.levelCap}`) : null)
        : null,
    ),
    SKILL_TREES[s.id] ? h('section',
      h('h2', 'Skill tree'),
      h('p.muted.small', `A choice unlocks at Lv ${SKILL_LEVELS.join(', ')}. Pick one skill from each pair; you can switch any time between levels.`),
      ...SKILL_TREES[s.id].map((pair, fork) => {
        const need = SKILL_LEVELS[fork];
        const open = o.level >= need;
        const picked = o.skills?.[fork];
        return h(`div.skill-fork${open ? '' : '.locked'}`,
          h('div.sf-lvl', open ? `Lv ${need}` : `🔒${need}`),
          ...pair.map((node, i) => h(`button.skill${picked === i ? '.chosen' : ''}`, {
            disabled: !open,
            onclick: act(() => chooseSkill(o, fork, i as 0 | 1)),
          }, h('b', node.name), h('div.small', describeSkill(node.effect, describeTrait)))),
        );
      }),
      skillsReady(s.id, o) ? h('p.small.accent', 'A skill is ready: pick one above.') : null,
    ) : null,
    !def.basic ? h('section',
      h('h2', 'Talents'),
      !o.evolved ? h('p.muted', 'Unlocked after evolution.') : null,
      ...def.talents.map((t, i) => h('div.talent',
        h('div', h('b', t.name), h('div.muted', t.desc)),
        o.talents[i]
          ? h('span.tag', 'Learned')
          : h('button', { disabled: !canTalent(def, o, i as 0 | 1, p.xp), onclick: act(() => { p.xp -= talentCost(def); o.talents[i] = true; }) }, `✨${fmt(talentCost(def))}`),
      )),
    ) : null,
    def.evolved.trait ? h('p.muted.small', `Evolved form gains: ${describeTrait(def.evolved.trait)}. Stats ×${BALANCE.evolvedMult}.`) : null,
  );
});

// ---------------- Summon ----------------

let lastPull: PullResult[] = [];

registerScreen('summon', (app) => {
  const p = app.profile;
  const g = BALANCE.gacha;
  const doPull = (n: 1 | 10) => () => {
    const res = pull(p, new Rng(newSeed()), n);
    if (!res.length) return toast('Not enough Glowbugs');
    lastPull = res;
    app.save();
    app.refresh();
  };
  const rates = (Object.entries(g.rates) as [keyof typeof RARITY_COLOR, number][]).map(([r, v]) =>
    h('span', { style: `color:${RARITY_COLOR[r]}` }, `${r} ${(v * 100).toFixed(0)}%`));

  const dupes = [...new Set(p.pendingDupes)].map((id) => {
    const def = BAT_BY_ID[id];
    const n = p.pendingDupes.filter((x) => x === id).length;
    const choose = (c: 'plus' | 'xp') => () => {
      resolveDupe(p, id, c);
      app.save();
      app.refresh();
    };
    return h('div.dupe',
      batImg(id, 2),
      h('div', h('b', def.name), n > 1 ? ` ×${n}` : '', h('div.muted.small', `+${p.roster[id].plus}/${BALANCE.plusCap}`)),
      h('button', { disabled: !canTakePlus(p, id), onclick: choose('plus') }, '+1 Plus level'),
      h('button', { onclick: choose('xp') }, `✨${fmt(dupeXp(def))} XP`),
    );
  });

  return h('div.screen',
    header('Summon', () => { lastPull = []; app.go({ name: 'home' }); }, wallet(app)),
    h('div.summon-cave',
      h('div.cave-mouth', '🦇'),
      h('div.pull-buttons',
        h('button.primary', { disabled: p.glow < g.single, onclick: doPull(1) }, `Summon ×1  🪲${g.single}`),
        h('button.primary', { disabled: p.glow < g.ten, onclick: doPull(10) }, `Summon ×10  🪲${g.ten}`, h('div.small', 'Rare or better guaranteed')),
      ),
      h('div.rates', ...rates),
      h('div.muted.small', `Epic+ guaranteed in ${g.pityEpic - p.pity.sinceEpic} · Legendary guaranteed in ${g.pityLegendary - p.pity.sinceLegendary}`),
    ),
    lastPull.length ? h('section', h('h2', 'Results'),
      h('div.pull-results', ...lastPull.map((r) => h(`div.pull.r-${r.rarity}`, { style: `--rarity:${RARITY_COLOR[r.rarity]}` },
        batImg(r.batId, 2), h('div.small', BAT_BY_ID[r.batId].name), r.isNew ? h('span.new', 'NEW') : h('span.muted.small', 'dupe'))))) : null,
    dupes.length ? h('section', h('h2', 'Duplicates'), h('p.muted.small', 'Each duplicate becomes a plus-level for that bat, or XP you can spend on any bat.'), ...dupes) : null,
  );
});

// ---------------- Run prep: matriarch + starting flock ----------------

registerScreen('prep', (app) => {
  const p = app.profile;
  const matriarchs = Object.keys(p.roster).filter((id) => BAT_BY_ID[id]?.matriarch && MATRIARCH_BY_ID[id]);
  let mat = p.lastMatriarch && matriarchs.includes(p.lastMatriarch) ? p.lastMatriarch : matriarchs[0];
  const options = flockOptions(p).sort((a, b) => rank(a) - rank(b));
  const F = BALANCE.run.flock;
  let flock = (p.flock ?? []).filter((id) => options.includes(id)).slice(0, F.species);
  if (!p.flock) flock = options.slice(0, F.species);
  let biome = p.lastSetup?.biome ?? BIOMES[0].id;
  let mods: string[] = [...(p.lastSetup?.modifiers ?? [])];

  const body = h('div');
  const render = () => {
    const err = validateSetup(p, mat, flock);
    const m = MATRIARCH_BY_ID[mat];
    const fledglings = F.species * F.copies + F.fledglings - flock.length * F.copies;
    body.replaceChildren(
      !p.tutorialDone ? h('div.coach', h('div.coach-step', 'First run'), h('div', 'Your matriarch and starting flock are already picked. Choose any map, leave modifiers off for now, and tap Begin run at the bottom.')) : '',
      h('h2', 'Matriarch'),
      h('div.commander-row', ...matriarchs.map((id) => h(`button.cmd-pick${id === mat ? '.selected' : ''}`, {
        onclick: () => { mat = id; render(); },
      }, batImg(id, 2), h('div.small', BAT_BY_ID[id].name), h('div.small.mat-title', MATRIARCH_BY_ID[id].title)))),
      m ? h('p.small', h('b', `♛ ${m.title}: `), m.rule, ' ', h('span.muted', m.why)) : '',
      h('h2', `Starting flock ${flock.length}/${F.species}`),
      h('p.muted.small', `Pick ${F.species} species. You start with ${F.copies} of each, so they can merge from the first day. Drafts after each level offer more copies or new species.`),
      h('div.core-grid', ...options.map((id) => {
        const on = flock.includes(id);
        const o = p.roster[id];
        return h(`button.core-pick${on ? '.selected' : ''}`, {
          onclick: () => {
            if (on) flock = flock.filter((x) => x !== id);
            else if (flock.length < F.species) flock = [...flock, id];
            else return toast(`Pick up to ${F.species} species. Tap one to remove it first.`);
            p.flock = flock;
            render();
          },
        }, batImg(id, 2), h('div.small', displayName(BAT_BY_ID[id], o)), h('div.muted.small', `Lv ${o.level}${o.plus ? `+${o.plus}` : ''}`), clanPips(BAT_BY_ID[id].clans));
      })),
      h('p.muted.small', `Starting deck: ${flock.map((id) => `${F.copies}× ${BAT_BY_ID[id].name}`).join(', ') || 'no species'}, ${fledglings} Fledgling${fledglings === 1 ? '' : 's'}. Up to ${BALANCE.run.deckCap} cards.`),
      h('details.clan-ref',
        h('summary', 'Clan bonuses'),
        h('p.muted.small', `On the field, each clan adds up its roosts' levels. At ${SYNERGY_TIERS.join(', ')} it unlocks a bonus. Mixing clans is allowed; committing pays off.`),
        ...CLAN_ORDER.map((c) => h('div.small', h('b', { style: `color:${CLANS[c].color}` }, CLANS[c].name), ': ',
          SYNERGY[c].values.map((v) => SYNERGY[c].text(v)).join(' → '))),
      ),
      h('h2', 'Map'),
      h('div.choice-list', ...BIOMES.map((b) => h(`button.choice${b.id === biome ? '.selected' : ''}`, {
        onclick: () => { biome = b.id; render(); },
      }, h('span.choice-icon', b.icon), h('div', h('b', b.name), h('div.small.muted', b.desc))))),
      h('h2', 'Modifiers'),
      h('p.muted.small', 'Optional. Each one makes the run harder and adds to its rewards.'),
      h('div.choice-list', ...MODIFIERS.map((m) => {
        const on = mods.includes(m.id);
        return h(`button.choice${on ? '.selected' : ''}`, {
          onclick: () => { mods = on ? mods.filter((x) => x !== m.id) : [...mods, m.id]; render(); },
        }, h('span.choice-icon', m.icon), h('div', h('b', m.name), h('div.small.muted', m.desc)), h('span.tag', `+${m.bonusPct}%`));
      })),
      err ? h('p.error', err) : '',
      h('button.big.primary', {
        disabled: !!err,
        onclick: () => {
          p.run = startRun(p, mat, flock, newSeed(), { biome, modifiers: mods });
          app.save();
          app.go({ name: 'map' });
        },
      }, 'Begin run', rewardBonusPct(mods) ? h('div.small', `Rewards +${rewardBonusPct(mods)}%`) : null),
    );
  };
  render();
  return h('div.screen', header('Play', () => app.go({ name: 'home' })), body);
});

/** Starter commons first (in clan order), then the rest by rarity. */
function rank(id: string): number {
  const i = STARTER_COMMONS.indexOf(id);
  if (i >= 0) return i;
  return 10 + ['common', 'rare', 'epic', 'legendary'].indexOf(BAT_BY_ID[id].rarity);
}
