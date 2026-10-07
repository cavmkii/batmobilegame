import './style.css';
import './ui/metaScreens';
import './ui/runScreens';
import './ui/defenseScreen';
import { createApp } from './ui/app';

const app = createApp(document.getElementById('app')!);
app.refresh();

// Debug handle for playtesting from the console, e.g. batmobile.profile.xp += 10000
(window as unknown as { batmobile: typeof app }).batmobile = app;
