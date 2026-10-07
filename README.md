# Batmobile

A mobile-first collect-and-upgrade bat game. You build a commander-rules deck and defend your
cave over day/night rounds: by day, play bat cards to build roosts; by night, the bats fight on their
own and you cast spells as instants. It sits inside a Slay the Spire–style roguelite run.
Design: [DESIGN.md](DESIGN.md).

## Run it

```sh
npm install
npm run dev        # http://localhost:5173 (also on your LAN, so you can open it on a phone)
npm test           # logic + defense tests, plus a bot-driven balance report
npm run build      # typecheck + production bundle in dist/
```

Dev helpers:
- `/dev/sprites.html`: contact sheet of every sprite (for checking or replacing art).
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
