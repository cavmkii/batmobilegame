import { loadProfile, saveProfile, type Profile } from '../game/profile';
import { clear } from './dom';

export type Screen =
  | { name: 'starter' }
  | { name: 'home' }
  | { name: 'roster' }
  | { name: 'bat'; id: string }
  | { name: 'summon' }
  | { name: 'prep' }
  | { name: 'map' }
  | { name: 'deck' }
  | { name: 'battle' }
  | { name: 'reward' }
  | { name: 'shop' }
  | { name: 'rest' }
  | { name: 'event'; message?: string }
  | { name: 'runEnd'; xp: number; glow: number; cleared: boolean; depth: number };

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
    },
  };
  return app;
}

function initialScreen(p: Profile): Screen {
  if (!p.starterChosen) return { name: 'starter' };
  if (p.run) {
    // A reload mid-node restarts that node; the map is the safe re-entry point otherwise.
    const node = p.run.activeNode ? p.run.map.nodes[p.run.activeNode] : null;
    if (node && (p.run.draft || p.run.rewardRelic)) return { name: 'reward' };
    if (node?.type === 'shop') return { name: 'shop' };
    if (node?.type === 'rest') return { name: 'rest' };
    if (node?.type === 'event') return { name: 'event' };
    if (node && ['battle', 'elite', 'boss'].includes(node.type)) return { name: 'battle' };
    return { name: 'map' };
  }
  return { name: 'home' };
}
