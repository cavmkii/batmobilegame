# Batmobile

A mobile-first collect-and-upgrade bat game: Battle Cats–style real-time lane battles, driven by a
commander-rules deck, inside a Slay the Spire–style roguelite run. Design: [DESIGN.md](DESIGN.md).

## Run it

```sh
npm install
npm run dev        # http://localhost:5173 (also on your LAN, so you can open it on a phone)
npm test           # logic + battle tests, plus a bot-driven balance report
npm run build      # typecheck + production bundle in dist/
```

Dev helpers:
- `/dev/sprites.html`: contact sheet of every sprite (for checking or replacing art).
- `window.batmobile` in the console is the app. For example, `batmobile.profile.xp += 10000; batmobile.save(); batmobile.refresh()`.
- In dev builds `window.__battle` is the live battle simulation.

To read the balance report:
`npx vitest run tests/battle.test.ts -t balance --reporter=verbose`

## Layout

```
src/data/     all content and tuning numbers (bats, spells, enemies, encounters, relics, sprites, balance)
src/game/     pure logic, no DOM: battle sim, deck rules, gacha, progression, map gen, run state
src/render/   pixel sprite rendering and the battle canvas
src/ui/       DOM screens
tests/        Vitest
```
