import { loadProfile, saveProfile, type Profile } from '../game/profile';
import { clear } from './dom';

export type Screen =
  | { name: 'starter' }
  | { name: 'home' }
  | { name: 'guides' }
  | { name: 'roster' }
  | { name: 'bestiary' }
  | { name: 'bat'; id: string }
  | { name: 'summon' }
  | { name: 'prep'; chapter?: number }
  | { name: 'saga' }
  | { name: 'map' }
  | { name: 'deck' }
  | { name: 'battle' }
  | { name: 'reward' }
  | { name: 'shop' }
  | { name: 'rest' }
  | { name: 'event'; message?: string }
  | { name: 'runEnd'; xp: number; glow: number; chapter: number; depth: number; startChapter: number; checkpoint: number };

export interface App {
  profile: Profile;
  screen: Screen;
  root: HTMLElement;
  go(s: Screen): void;
  save(): void;
  /** Re-render the current screen. */
  refresh(): void;
  /** Called by a screen to clean up (stop loops) before the next one renders. */
  onLeave?: () => void;
}

type Renderer = (app: App, screen: never) => Node;
const renderers = new Map<Screen['name'], Renderer>();

export function registerScreen<N extends Screen['name']>(name: N, fn: (app: App, s: Extract<Screen, { name: N }>) => Node) {
  renderers.set(name, fn as Renderer);
}

export function createApp(root: HTMLElement): App {
  const profile = loadProfile();
  const app: App = {
    profile,
    screen: initialScreen(profile),
    root,
    go(s) {
      app.onLeave?.();
      app.onLeave = undefined;
      app.screen = s;
      app.refresh();
      window.scrollTo(0, 0);
    },
    save() {
      saveProfile(app.profile);
    },
    refresh() {
      const r = renderers.get(app.screen.name);
      if (!r) throw new Error(`No screen ${app.screen.name}`);
      clear(root);
      root.append(r(app, app.screen as never));
      const tab = TAB_OF[app.screen.name];
      root.classList.toggle('with-tabs', !!tab);
      if (tab) root.append(tabBar(app, tab));
    },
  };
  return app;
}

// ---------------- Bottom tab bar (outside a run) ----------------

type Tab = 'play' | 'bats' | 'summon' | 'guides';
const TAB_OF: Partial<Record<Screen['name'], Tab>> = {
  home: 'play', saga: 'play', prep: 'play', roster: 'bats', bat: 'bats', summon: 'summon', guides: 'guides', bestiary: 'guides',
};
const TABS: { id: Tab; icon: string; label: string; go: Screen }[] = [
  { id: 'play', icon: '🌙', label: 'Play', go: { name: 'home' } },
  { id: 'bats', icon: '🦇', label: 'Bats', go: { name: 'roster' } },
  { id: 'summon', icon: '✨', label: 'Summon', go: { name: 'summon' } },
  { id: 'guides', icon: '📖', label: 'Guides', go: { name: 'guides' } },
];

function tabBar(app: App, active: Tab): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'tabbar';
  for (const t of TABS) {
    const b = document.createElement('button');
    b.className = `tab${t.id === active ? ' on' : ''}`;
    b.innerHTML = `<span class="tab-icon">${t.icon}</span><span class="tab-label">${t.label}</span>`;
    b.onclick = () => app.go(t.go);
    nav.append(b);
  }
  return nav;
}

function initialScreen(p: Profile): Screen {
  if (!p.starterChosen) return { name: 'starter' };
  if (p.run) {
    // A reload mid-node restarts that node; the map is the safe re-entry point otherwise.
    const node = p.run.activeNode ? p.run.map.nodes[p.run.activeNode] : null;
    if (node && (p.run.draft || p.run.charmOffer || p.run.chartOffer)) return { name: 'reward' };
    if (node?.type === 'shop') return { name: 'shop' };
    if (node?.type === 'rest') return { name: 'rest' };
    if (node?.type === 'event') return { name: 'event' };
    if (node && ['battle', 'elite', 'boss'].includes(node.type)) return { name: 'battle' };
    return { name: 'map' };
  }
  return { name: 'home' };
}
