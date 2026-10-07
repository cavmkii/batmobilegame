# Batmobile — Game Design (prototype v0.1)

A mobile collect-and-upgrade game in the Battle Cats mould, crossed with a
deckbuilder roguelite. You collect bats, level them permanently, and take a
commander-led deck into runs across a branching map of real-time lane battles.

Numbers below are starting values. All of them live in `src/data/` and
`src/data/balance.ts` so they can be tuned without touching logic.

## 1. The two loops

| Permanent (meta)                    | Per run (resets)                         |
|-------------------------------------|------------------------------------------|
| Bat roster (from gacha)             | Drafted cards                            |
| Levels, plus-levels, evolution      | Card upgrades (`+`)                      |
| Talents                             | Relics                                   |
| XP, Glowbugs                        | Figs (run gold), cave HP                 |

The roster decides *what you can field and how strong it is*. The run decides
*what this particular deck turns into*.

## 2. Battle

- One horizontal lane. Your cave is on the right, the enemy roost on the left.
  Destroy the roost to win; lose your cave and the run ends.
- **Energy** regenerates continuously (base 0.8/s, cap 10).
- **Hand of 4.** Playing a card sends it to the bottom of your draw pile and
  draws the next. No cooldowns: the rotation *is* the cooldown.
- **Commander slot** sits beside the hand and is always available. Only one
  commander can be on the field. Each time it dies, its cost rises by +2
  (commander tax).
- Units walk forward, stop at the first enemy in range, and attack on a timer.
  Each unit has N **knockbacks**: crossing each 1/N HP threshold pushes it back
  and interrupts it, as in Battle Cats.
- Cave HP carries between battles within a run (Slay the Spire–style HP).
- Some enemy waves are triggered by the roost's HP dropping below a threshold,
  so pushing too fast wakes the heavies.

## 3. Deck construction — Commander rules

- **Commander.** A legendary bat with a 2-clan identity.
- **Color identity → clans.** A card is legal if all its clans are within the
  commander's identity. Colorless cards are always legal.
- **Singleton.** One copy of each card, except **Fledglings**, the colorless
  basic bat. Fledglings play the role of basic lands: unlimited copies, and
  they pad the starting deck.
- **Core.** Before a run, pick up to 8 *owned* bats legal for the commander.
  The starting deck is the core plus Fledglings up to 8 cards.
- **Cap.** 20 cards. Taking a card at the cap means removing one.
- **Draft offers** follow the commander's identity. Offers can include bats you
  don't own; those fight at level 1. Owned bats use their roster level. So the
  roster still matters, and early runs aren't stuck with a tiny pool.

## 4. Clans (real bat diets)

| Clan         | Real basis                        | Play pattern                    |
|--------------|-----------------------------------|---------------------------------|
| Frugivore    | Fruit bats, flying foxes          | Tanky, healing, seed-spreaders  |
| Insectivore  | Echolocating microbats            | Cheap, fast, swarms, multi-hit  |
| Sanguivore   | Vampire bats (blood-sharing)      | Lifesteal, heal-on-death        |
| Piscivore    | Fishing / bulldog bats            | Long range, pierce, slow        |
| Nectarivore  | Long-tongued nectar bats          | Auras: attack and haste buffs   |

Vampire bats really do regurgitate blood meals to roost-mates who failed to
feed; that's where the Sanguivore heal-on-death mechanic comes from.

Starter commanders: **Great Flying Fox** (Frugivore/Nectarivore), **Ghost Bat**
(Sanguivore/Insectivore), **Spectral Bat** (Piscivore/Sanguivore).

## 5. Run structure

- One act (designed for three later): 8 rows of nodes, branching paths.
  - Row 0: battles. Rows 1–5: mixed. Row 6: rest. Row 7: boss.
  - Node types: Battle, Elite, Shop, Rest, Event, Treasure, Boss.
- Battle reward: Figs plus a pick of 1 of 3 cards (or skip). Elites add a relic.
- Rest: heal 30% cave HP, or upgrade a card.
- Shop: cards, a relic, card removal, healing.

## 6. Failure and rewards

XP and Glowbugs accrue per node cleared, weighted by depth. On failure you keep
everything accrued. Beating the boss grants a large completion bonus.

## 7. Meta progression (Battle Cats–style)

- **Levels.** Spend XP. Stats scale +20% of base per level. Cap 10, raised to
  20 by evolution.
- **Plus-levels.** Up to +10, from duplicates. Each counts as a level for stats.
- **Duplicates.** When you pull a bat you own, you choose: +1 plus-level, or
  convert to XP (spendable on any bat). Once the bat is at +10, only XP is
  offered.
- **Evolution (true form).** At level 10, spend XP to evolve: new name, ×1.25
  stats, level cap raised to 20, talents unlocked.
- **Talents.** Two per bat, bought with XP after evolution.

## 8. Gacha

- One soft currency, **Glowbugs**, earned only through play. No premium layer.
- Single pull 150, ten-pull 1500 (guaranteed rare or better).
- Rates: Common 65%, Rare 26%, Epic 8%, Legendary 1%. Rates are shown in game.
- Pity: an epic or better is guaranteed within 10 pulls, a legendary within 60.
- New players pick one of the three commanders for free and get all five
  common bats. The other commanders are legendary pulls.

## 9. Known tensions / to watch in playtest

1. **Singleton + real-time.** With a 4-card hand, a 20-card deck takes
   about 16 plays to cycle. Battle length and energy rate need tuning so a
   deck cycles at least once per fight.
2. **Gacha-only acquisition.** With commander rules, off-identity pulls are
   worth less. Dupe→XP and pity keep this from feeling bad. Watch whether
   players feel locked into one commander.
3. **Two currencies are spent on the roster.** Levelling (XP) and pulling
   (Glowbugs) don't compete with each other. If that turns out too frictionless,
   evolution could also cost Glowbugs.

## 10. Balance status (bot playtests, v0.1)

`tests/battle.test.ts` includes a bot that saves energy for the commander, then plays the
priciest affordable card. It's a crude player, so treat these as relative numbers only.

- **Starter decks (level 1, no drafts)** win row 0–1 battles reliably (~45–80 s), are
  inconsistent against elites, and never beat the boss.
- **Mid-run deck (starter + 6 drafts), boss fight:** 0/6 at roster level 1, 6/6 at level 5.
  The intended pacing is that the first clear comes after a few runs of levelling, the
  Battle Cats grind wall.
- An early pass had the commander soloing fights in 30–60 s, so the deck barely cycled.
  Commander stats were cut and roost HP raised to fix that. Keep an eye on this: if the
  commander carries, the deckbuilding stops mattering.
- Untested so far: whether a skilled human cycles a 20-card deck at least once per fight.

## 11. Tech

- TypeScript + Vite. DOM for menus, Canvas 2D for battle. No engine.
- Pixel art is generated from hand-authored character grids in
  `src/data/sprites.ts` (bats are authored as a left half and mirrored).
  Each sprite is standalone data, so real art can replace it later.
- Saves go to `localStorage`, with a version field for migrations.
- Pure logic (battle sim, gacha, deck rules, map gen, progression) is
  framework-free and unit-tested with Vitest.
