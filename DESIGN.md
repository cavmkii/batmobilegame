# Batmobile — Game Design (v0.2: Roost Defense)

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
Above the cave is a 5×3 grid of roost tiles.

- **Nights.** Each level has 3–5 nights, more for elites and the boss. Survive the
  last night to win. Cave HP carries over through the run.
- **Each night's wave is announced during the day:** which enemies, how many, and
  which columns they come down. The waves come from a threat budget that grows each
  night. The boss and elite levels add a fixed finale enemy.

**Day (planning, no clock).**
- **Energy** starts at 3 on day 1 and goes up by 1 each day, to a cap of 8. It resets
  each level, Hearthstone-style, so there are no land cards.
- **Hand** stays between days, MTG-style. You draw 5 at the start of a level and 2 each
  day, with a hand limit of 7. When the deck runs out, the discard pile is shuffled in.
- **Bat cards place roosts.** A roost has HP, lasts a set number of nights (stamina),
  and releases a fixed number of bats each night. Bats that die come back the next
  night as long as the roost stands.
- **Bats can only be placed during the day** (like MTG's sorcery speed).

**Night (automatic, about 20–40 s).**
- Bats fly out, chase the nearest enemy, fight, and return home.
- Enemies walk straight down their column. They attack bats within reach, then any
  roost blocking their column, then the cave.
- **Spells are instants.** Unspent day energy carries into the night, so you choose
  between spending it on roosts and keeping it for a night-time answer. Only the
  heal spell does anything during the day.
- **Leaks.** An enemy that reaches the cave hits once for 4× its attack and then is
  gone. (An earlier version had enemies keep attacking the cave; one weak first
  night could then lose the whole run.)

**Dawn.**
- Surviving bats go home and every roost loses one night of stamina.
- An expired or destroyed roost sends its card to the discard pile.

**Commander.**
- The commander is a roost card in the command zone: playable any day, and it
  never expires.
- If it's destroyed, it goes back to the command zone and costs +2 more each time
  (commander tax).

**Positioning.**
- **Terrain tiles.** Each level has 3–4 terrain tiles. A roost on its own clan's
  terrain gets a bonus, based on where those bats really feed:

  | Terrain | Clan | Bonus | Real basis |
  |---|---|---|---|
  | Pond | Piscivore | +40% attack | Fishing bats hunt over water |
  | Fig tree | Frugivore | +50% roost HP, +30% bat HP | Staple food and roost |
  | Flowering cactus | Nectarivore | Auras ×1.5 | Columnar cacti are bat-pollinated |
  | Street lamp | Insectivore | +35% attack speed | Lights concentrate insects |
  | Cattle pen | Sanguivore | +25% lifesteal | Common vampire bats feed mostly on livestock |

- **Colony adjacency.** A roost gets +10% attack for each orthogonal neighbour that
  shares a clan, up to +30%. Vampire roosts heal neighbouring roosts 20% at dawn.
- **Column blocking.** Enemies only attack a roost in their own column. Roosts placed
  in the columns tonight's enemies use act as walls.

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

1. **Decisions per day.** Ramping energy, a kept hand, and multi-night roosts may
   add up to too few real choices on some days ("place whatever I drew") or too
   many. Only human play will show this.
2. **Hand clogging.** The hand limit is 7 and draws stop at the limit. If spells pile
   up, you stop drawing roosts. MTG would make you discard down to the limit; that
   rule isn't in yet.
3. **Commander strength.** Ghost Bat (fast, area damage, lifesteal) clearly
   outperforms Flying Fox (a slow tank) in bot runs. The bot can't judge aura or
   positioning value, so a person needs to check this.
4. **Gacha-only acquisition.** With commander rules, off-identity pulls are worth less.
   Dupe→XP and pity soften this.
5. **XP and Glowbugs** don't compete with each other. That may be too frictionless.

## 10. Balance status (bot playtests, v0.2)

`tests/defense.test.ts` includes a bot that places its commander first, then roosts in
the columns tonight's enemies will use, preferring terrain and same-clan neighbours.
It holds energy for a night spell and casts damage spells when enemies get close.
Each cell is 8 seeds.

- **Starter decks at roster level 1** win row 0–2 levels with little cave damage. The
  elite Owl Loft is a coin flip. The boss is 0/8.
- **Drafted deck (starter + 6 drafts)** at level 5 wins almost everything, and the boss
  6/8. So the first clear comes after a few runs of levelling.
- **Findings that changed the numbers:**
  - Continuous cave damage ended runs on night 1, so leaks became a single hit.
  - Fledglings at 2 bats for 1 energy were the best value per energy in the game,
    so drafting made decks worse. Now they release 1 bat.
  - 2-energy spells lost to 2-energy roosts that last 3–4 nights, so holding energy
    for spells was a losing play. Most spells now cost 1, with stronger effects.

## 11. Tech

- TypeScript + Vite. DOM for menus, Canvas 2D for the defense field. No engine.
- Pixel art is generated from hand-authored character grids in
  `src/data/sprites.ts` (bats are authored as a left half and mirrored).
  Each sprite is standalone data, so real art can replace it later.
- Saves go to `localStorage`, with a version field for migrations.
- Pure logic (defense sim in `src/game/defense.ts`, gacha, deck rules, map gen, progression) is
  framework-free and unit-tested with Vitest.
