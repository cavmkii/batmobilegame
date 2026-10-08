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
fertilizer, and it piles up under roosts.)
- You start each level with 6. Dawn pays **+2 base, +1 per 2 bats housed in your
  standing roosts, and +1 per 4 kills**. A roost wrecked that night produces nothing.
- So the roosts are the economy. The first days are a grind (+3–4 a dawn). Guano spent
  on bats raises future income, while rerolls and spells don't. In bot runs income
  climbs from about 4 to 12–16 per dawn by the last nights.
- It pays for placing bats (the card's cost), refreshing the pool (2), and casting
  spells. Unspent guano carries over. The HUD shows tomorrow's projected income, and
  the dawn message breaks down where it came from.

**The pool: what the deck lets you place.**
- Only **2 cards** are offered at a time.
- Using one leaves its slot empty. Nothing replaces it until you pay to **refresh**
  (discard both and draw 2) or until dawn, which refills empty slots for free.
- Placed and discarded cards go to the discard pile, which reshuffles into the deck when
  it runs out. So in a 14-card deck, a given bat comes back about once per cycle.
- **Spells** appear in the pool too. Taking one is free and puts it in a spell hand
  (max 3). Casting costs guano. Spells are instants: you can cast them at night, and
  the heal spell also works during the day.

**Roosts and merging.**
- A bat card placed on an empty tile builds a level-1 roost. **Nothing is out at dusk.**
  Each roost releases bats as its per-species cooldown fills (3 s for Little Brown Bats
  and Fledglings, 14–16 s for heavies), one at a time, or in pairs for Little Brown
  Bats, up to its maximum. The army builds through the night, and fallen bats are
  replaced the same way.
- Enemies start entering 5 s after dusk, so fast roosts get their first bats up. When
  the last enemy falls there's a 2 s pause before dawn.
- **Merging needs a matching level.** Two roosts of the same bat at the same level
  merge into one roost a level higher. By day, tap one roost and then the other; the
  first tile is freed. Merging is free. A pool card counts as a level-1 roost, so it can
  be dropped onto a level-1 roost but not onto a level-2 one. To take a roost from 3 to
  4, you first have to build another level-3 roost of the same bat. Roosts with a
  partner on the board show a ⇄ marker.
- **Level N costs 2^(N−1) copies.** Level 4 takes 8 copies; level 10 would take 512.
  Through merging alone, levels top out around 3–5 in a level.
- **Each level** adds one bat (up to +4) and +25% bat stats, and +20% roost HP. The extra
  bat is what makes merging worth it: a level-2 roost with one more bat at +25% roughly
  equals the two level-1 roosts it replaced, and it frees a tile.
- **Pattern spread.** Each species has a grid pattern. When a merge (or a card drop)
  levels a roost, every roost in its pattern also gains +1, whatever its type, without
  chaining. Bumps are free levels: they can bring a roost level with its partner so the
  pair can merge, or push one out of step. Bumps are the only realistic route to level 10.

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

- **Level 5: armour.** Bats from a level-5+ roost wear a helmet and breastplate (visual).
- **Level 10: mega bat.** The roost releases one giant bat instead of its group: 3× the
  full group's HP and 1.5× its attack. It's only replaced after it dies, on a doubled
  cooldown.
- **No level cap.** Roosts keep levelling past 10 (shown as M11, M12…) and stats keep
  rising: +25% per level.
- **Press and hold** a bat card or a roost to see which tiles its pattern would give
  +1 (highlighted on the field).
- Roosting bats are drawn hanging with their wings folded.
- **Level distribution in bot runs:** end-of-level roosts are mostly levels 1–3, with
  pattern bumps carrying a few to 5–7. Level 10 hasn't appeared.

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
be merged, but other roosts' patterns can raise its level.
- Unlike other roosts, a destroyed commander is **not** rebuilt at dawn. It goes back to
  the command zone, and you can place it again on any day.
- **Commander tax:** each placement costs +2 more than the one before (base, +2, +4…)
  for the rest of the level, as in MTG. A re-placed commander starts at level 1.
- On day 1 the commander card pulses until you place it. In playtests, a player who
  skips it is the one most likely to lose the first level.

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

## 4b. The field guide (collection)

36 species: 35 collectable plus the basic Fledgling. Each has a real scientific name, a
region, a fact, and a conservation note where the status is notable and well established
(Indiana bat, northern long-eared, greater long-nosed, tricolored, little brown, ghost bat).

| Region | Species |
|---|---|
| 🌲 North America | little brown, big brown, eastern red, hoary, tricolored, northern long-eared, Indiana, Townsend's big-eared, pallid, Mexican free-tailed, lesser and greater long-nosed, Mexican long-tongued |
| 🌴 Latin America | the three vampire bats, lesser and greater bulldog, Mexican fishing bat, Pallas's long-tongued, tube-lipped nectar, Jamaican fruit, Seba's short-tailed, Geoffroy's tailless, spectral (commander) |
| 🌍 Africa | Egyptian fruit, straw-colored fruit, hammer-headed, Wahlberg's epauletted |
| 🏔 Eurasia | brown long-eared, Daubenton's, Rickett's big-footed, greater noctule (commander) |
| 🌏 Asia-Pacific | great flying fox, ghost bat (both commanders) |

- **Sanguivores stay at three.** Only three blood-feeding bat species exist, and the game
  has all of them. I'm not inventing more.
- **Greater Noctule** is a fourth commander (Insectivore/Piscivore), available only from
  legendary summons. It gives the new insect-eaters and water bats a commander that can
  draft both.
- **Rewards:** milestones at 10, 15, 20, 25 and 30 species and the complete guide, plus a
  set reward for completing each region. They pay Glowbugs (more summons) and XP, so
  collecting feeds back into collecting and levelling.
- **The guide** can be sorted by clan or by region. Unfound species show as silhouettes
  with their region and rarity.
- The starter gift is fixed at one common per clan, so adding commons doesn't change it.

## 4c. Main menu and Play screen

- **Main menu:** Play, Field Guides, Summon. More will come later.
- **Play:** choose the commander and deck core, then the map and any modifiers.
  - **Maps (biomes)** change which terrain tiles appear, and so which clans thrive:

    | Map | Favours |
    |---|---|
    | Cave Country | everything |
    | Sonoran Desert | cactus, so nectar bats |
    | Lowland Rainforest | fig and pond, so fruit and fishing bats |
    | Farmland | pen and lamp, so vampires and insect-eaters |

  - **Modifiers** are optional. Each makes the run harder and adds a reward bonus (XP and
    Glowbugs at the end of the run):

    | Modifier | Effect | Bonus |
    |---|---|---|
    | Lean Times | −1 guano each dawn | +25% |
    | Long Nights | +2 nights per level | +20% |
    | New Moon | no enemy preview | +30% |
    | Swarm Season | waves +25% | +30% |
    | Crumbling Cave | −30% cave HP | +20% |

  - The last choices are remembered for next time.
- **Field Guides:** a shelf of books.
  - *Bats of the World* is the collection, with milestones and region sets.
  - *Predators & Prey* unlocks an entry, with a fact, the first time a creature appears in
    a night.
  - Unfound entries are blacked out as ???.

## 4d. First play and placement

- **Placement takes two taps.** Tap a bat card (or a roost to merge), then tap a tile. That
  shows a preview first: a ghost roost, dashed outlines on the tiles its pattern would +1
  when it later merges, or for a merge, "+1" on the target and every roost its pattern
  bumps. Tap the same tile again to confirm, or another tile to move the preview.
- **Tutorial:** a 9-step guided first level covering the wave preview, placing the
  commander, preview and confirm, the pool, guano, ending the day, night, and merging.
  It's skippable, and can be replayed from the home screen. The Play screen and run map
  show first-run hints. The tutorial level starts with +4 guano so both the commander and
  a pool bat are affordable.
- **Save version 2** discards all older saves, so everyone starts fresh with the tutorial.

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
2. **Fledgling merging.** Basics merge too, and a thin deck of Fledglings levels up
   fast. Their roosts stay weak per bat, but watch whether "merge Fledglings"
   becomes the default line.
3. **Commander strength.** Ghost Bat (fast, area damage, lifesteal) beats Flying Fox (a
   slow tank) in bot runs. The bot can't judge aura or pattern value, so a person needs
   to check this.
4. **Gacha-only acquisition.** With commander rules, off-identity pulls are worth less.
   Dupe→XP and pity soften this.
5. **XP and Glowbugs** don't compete with each other. That may be too frictionless.

## 10. Balance status (bot playtests)

`tests/defense.test.ts` includes a bot that places its commander, drops pool bats onto a
matching level-1 roost (or roosts them in a threatened column), merges every same-level
pair it can (keeping the copy in the better spot), takes spells, refreshes when it has
spare guano, and casts damage spells when enemies get close. Each cell is 8 seeds.

- **Same-level merging:** with an extra bat per level, defenses got stronger (a starter
  beat elites 8/8), so waves went up about 25% (10% on the two opening levels). After
  that, starter decks at level 1 win elites 5–8/8, the boss is 0–1/8 at level 1, and
  6–8/8 at level 5.

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
- **Gradual release + roost income:** bats arriving one at a time made defenses much
  weaker; fast hawks reached the roosts before heavy roosts had released anything. Fixed
  with a 5 s dusk lead and about 20% lower waves (not on the two opening levels). Ghost
  Bat's attack was trimmed 42 to 34: its starter deck was beating the boss 5/8 at level
  1, against 0/8 for Flying Fox.
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
