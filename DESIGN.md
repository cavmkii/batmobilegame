# Batmobile — Game Design (v0.3: Roost Defense)

A mobile collect-and-upgrade game crossed with a deckbuilder roguelite. You collect
bats, level them permanently, and take a commander-led deck into runs. Each fight is
a **day/night defense**: by day you build roosts from your hand, by night the bats fly
out and fight on their own while you hold spells as instants.

v0.1 was a Battle Cats–style real-time lane battler. v0.2 replaces the battle with
the day/night defense, to get away from being a Battle Cats clone and to make the deck
the source of round-to-round variety. The meta loop (roster, gacha, run map) is unchanged.

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

## 2. A level: day / night defense

Portrait field: enemies come in from the top, and your cave sits along the bottom.
Above the cave is a 5×3 grid of roost tiles. A level is about **building something
over its length**. Roosts never expire; they grow.

- **Nights.** Normal levels have 7 nights, elites 8, and the boss 10. Survive the last
  night to win. Cave HP carries over through the run.
- **Each night's wave is announced during the day:** which enemies, how many, and which
  column they come down. The waves come from a threat budget that grows each night.
  Elite and boss levels add a fixed finale enemy.

**Guano: the one currency inside a level.** (Bat guano really was mined and sold as
fertilizer.)
- You start each level with 6. Each dawn adds +5, plus 1 for every 4 kills.
- It pays for placing bats (the card's cost), refreshing the pool (2), and casting spells.
- Unspent guano carries over, so every day you choose between building, rerolling and
  saving.

**The pool: what the deck lets you place.**
- Only **2 cards** are offered at a time.
- Using one leaves its slot empty. Nothing replaces it until you pay to **refresh**
  (discard both and draw 2) or until dawn, which refills empty slots for free.
- Placed and discarded cards go to the discard pile, which reshuffles into the deck when
  it runs out. So in a 14-card deck, a given bat comes back about once per cycle.
- **Spells** appear in the pool too. Taking one is free and puts it in a spell hand
  (max 3). Casting costs guano. Spells are instants: you can cast them at night, and
  the heal spell also works during the day.

**Roosts and stacking.**
- A bat card placed on an empty tile builds a level-1 roost. The roost keeps a fixed
  number of bats out and replaces fallen ones on a per-species cooldown (3 s for Little
  Brown Bats, 14–16 s for heavies).
- Placing the same bat on its own roost **stacks** it: +1 level. Each level gives +15%
  bat stats and +12% roost HP.
- **Pattern spread.** Each species has a grid pattern, and stacking it also gives +1
  level to every roost in that pattern, whatever its type. It doesn't chain. The
  patterns follow each bat's identity:

  | Bat | Pattern |
  |---|---|
  | Egyptian Fruit Bat | tile to the right |
  | Straw-colored Fruit Bat (colonial migrant) | left and right |
  | Little Brown Bat | tile ahead |
  | Brown Long-eared Bat | the 4 diagonals |
  | Mexican Free-tailed Bat (long-distance flyer) | 2 ahead, 2 behind |
  | Common Vampire Bat (blood-sharing) | the 4 orthogonal neighbours |
  | Hammer-headed, Tube-lipped, White-winged | all 8 around |
  | Fledgling | none |

- **Level 10: mega bat.** The roost releases one giant bat instead of its group. It has
  3× the group's total HP and 1.5× its total attack, and is only replaced after it dies,
  on a doubled cooldown.
- **Tall vs wide.** Small decks see the same card more often and stack higher. In bot
  runs the 8-card starter reached level 9 or so on its top roost in a 7-night level,
  while a 14-card drafted deck built more roosts at lower levels. Card removal at the
  shop is now a way to build tall.

**Wrecked roosts.** A roost at 0 HP is wrecked for the rest of the night: no bats,
and it stops blocking its column. At dawn it's rebuilt at the same level with 50% HP.
(Rebuilding at full HP would make losing a roost better than nearly losing it.)

**Night (automatic, about 20–40 s).**
- Bats fly out, chase the nearest enemy, fight, and go home at dawn.
- Enemies walk straight down their column. They attack bats within reach, then any roost
  blocking their column, then the cave.
- Once an enemy is inside the roost zone with nothing left blocking its column, it rushes
  the cave at 3× speed.
- **Leaks.** An enemy that reaches the cave hits once for 4× its attack, then is gone.

**Commander.** The commander sits in the command zone and costs guano to place. It can't
be stacked, but other roosts' patterns can raise its level. Like every roost it's
rebuilt at dawn if wrecked, so v0.2's commander tax is gone. On day 1 the commander
card pulses until you place it: in playtests, a player who skips it is the one most
likely to lose the first level.

**Positioning.**
- **Terrain.** Each level has 3–4 terrain tiles. A roost on its own clan's terrain gets a
  bonus, based on where those bats really feed:

  | Terrain | Clan | Bonus | Real basis |
  |---|---|---|---|
  | Pond | Piscivore | +40% attack | Fishing bats hunt over water |
  | Fig tree | Frugivore | +50% roost HP, +30% bat HP | Staple food and roost |
  | Flowering cactus | Nectarivore | Auras ×1.5 | Columnar cacti are bat-pollinated |
  | Street lamp | Insectivore | +35% attack speed | Lights concentrate insects |
  | Cattle pen | Sanguivore | +25% lifesteal | Common vampire bats feed mostly on livestock |

- **Pattern spread** makes where you put a roost relative to the others matter.
- **Column blocking.** Enemies only attack roosts in their own column.
- **Vampire roosts** heal orthogonal neighbours 20% at dawn.

**Enemy note.** Tiger moths jam bat sonar with ultrasonic clicks, which is real
(Arctiinae). In the game they shrink the range of nearby bats.

## 3. Deck construction — Commander rules

- **Commander.** A legendary bat with a 2-clan identity.
- **Color identity → clans.** A card is legal if all its clans are within the
  commander's identity. Colorless cards are always legal.
- **Singleton.** One copy of each card, except **Fledglings**, the colorless
  basic bat. Fledglings play the role of basic lands: unlimited copies, and
  they pad the starting deck.
- **Core.** Before a run, pick up to 8 *owned* bats legal for the commander.
  The starting deck is the core plus Fledglings up to 8 cards. Fledglings are the
  weakest roost per energy on purpose: basics shouldn't beat drafted cards.
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

## 5. Run structure (unchanged from v0.1; battle nodes are now defense levels)

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

1. **Level length.** 7–10 nights per level is a 10–15 minute session, long for mobile.
   That's the price of having time to build. A mid-level save/resume would help.
2. **Fledgling stacking.** Basics stack too, and a thin deck of Fledglings levels up
   fast. Their mega bat is weak (a single bat ×3), but watch whether "stack Fledglings"
   becomes the default line.
3. **Commander strength.** Ghost Bat (fast, area damage, lifesteal) beats Flying Fox (a
   slow tank) in bot runs. The bot can't judge aura or pattern value, so a person needs
   to check this.
4. **Gacha-only acquisition.** With commander rules, off-identity pulls are worth less.
   Dupe→XP and pity soften this.
5. **XP and Glowbugs** don't compete with each other. That may be too frictionless.

## 10. Balance status (bot playtests)

`tests/defense.test.ts` includes a bot that places its commander, stacks any pool bat
onto its existing roost (or roosts it in a threatened column), takes spells, refreshes
when it has spare guano, and casts damage spells when enemies get close. Each cell is 8
seeds.

- **Starter decks at roster level 1** win the row 0–2 levels. Hawk Ridge and the elites
  are a test, and the boss is 0–1/8.
- **Drafted Fox deck at level 1** clearly beats the Fox starter in the harder levels
  (elites 5–7/8 against 0/8). So drafting matters.
- **At roster level 5**, a drafted deck beats the boss 7/8. The first clear comes after
  a few runs of levelling.
- **First-level losses (human report):** Fledglings respawned too slowly (7 s for a
  single bat) to hold a column, and the starter deck is mostly Fledglings. A simple
  player who never placed the commander lost Moth Cloud 6/10 as Flying Fox. Fledglings
  now respawn every 3 s, and the opening levels' waves grow more slowly. That player
  now wins both opening levels 10/10 with every starter.
- **Earlier findings that still apply:** continuous cave damage ended runs on night 1,
  so leaks are a single hit. Spells had to get cheap to be worth holding.

## 11. Tech

- TypeScript + Vite. DOM for menus, Canvas 2D for the defense field. No engine.
- Pixel art is generated from hand-authored character grids in
  `src/data/sprites.ts` (bats are authored as a left half and mirrored).
  Each sprite is standalone data, so real art can replace it later.
- Saves go to `localStorage`, with a version field for migrations.
- Pure logic (defense sim in `src/game/defense.ts`, gacha, deck rules, map gen, progression) is
  framework-free and unit-tested with Vitest.
