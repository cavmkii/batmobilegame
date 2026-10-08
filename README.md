# Batmobile

A mobile-first collect-and-upgrade bat game. You lead a flock of bats under a matriarch and defend your
cave over day/night rounds: by day, play bat cards to build roosts; by night, the bats fight on their
own and you cast spells as instants. It sits inside a Slay the Spire–style roguelite run.
Design: [DESIGN.md](DESIGN.md).

## Play it on your phone

Every push to `main` publishes the game to **https://cavmkii.github.io/batmobilegame/**
(GitHub Pages, via `.github/workflows/deploy.yml`; tests must pass first).

**iPhone:** open that link in **Safari**, tap the **Share** button, choose **Add to Home Screen**.
It then opens full-screen like an app, and works offline after the first load.
The home-screen app has its own save, separate from Safari. Use *Back up / restore save*
on the home screen to keep a copy, since iOS can clear data for web apps left unused for weeks.

One-time setup (repo owner): Settings → Pages → Build and deployment → Source: **GitHub Actions**.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173 (also on your LAN, so you can open it on a phone)
npm test           # logic + defense tests, plus a bot-driven balance report
npm run build      # typecheck + production bundle in dist/
```

Dev helpers:
- `/dev/sprites.html`: contact sheet of every sprite (for checking or replacing art).
- `/dev/icon.html`: draws the app icon from the pixel art (used to generate `public/icons/`).
- `window.batmobile` in the console is the app. For example, `batmobile.profile.xp += 10000; batmobile.save(); batmobile.refresh()`.
- In dev builds `window.__defense` is the live level simulation.

To read the balance report:
`npx vitest run tests/defense.test.ts -t balance --reporter=verbose`

## Layout

```
src/data/     all content and tuning numbers (bats, spells, enemies, levels, terrain, relics, sprites, balance)
src/game/     pure logic, no DOM: day/night defense sim, deck rules, gacha, progression, map gen, run state
src/render/   pixel sprite rendering and the defense field canvas
src/ui/       DOM screens
tests/        Vitest
```
