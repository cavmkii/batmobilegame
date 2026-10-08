import './style.css';
import './ui/metaScreens';
import './ui/runScreens';
import './ui/defenseScreen';
import { createApp } from './ui/app';

const app = createApp(document.getElementById('app')!);
app.refresh();

// Debug handle for playtesting from the console, e.g. batmobile.profile.xp += 10000
(window as unknown as { batmobile: typeof app }).batmobile = app;

// Offline support for the installed app (production builds only; dev uses Vite's live reload).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // No offline mode; the game still works online.
    });
  });
}
