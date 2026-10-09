# Batmobile — Game Design (v0.6: Saga, charms and formations)

A mobile collect-and-upgrade game crossed with a deckbuilder roguelite. You collect
bats, level them permanently, and take a matriarch-led flock into runs. Each fight is
a **day/night defense**: by day you build roosts from your hand, by night the bats fly
out and fight on their own while you hold spells as instants.

v0.1 was a Battle Cats–style real-time lane battler. v0.2 replaces the battle with
the day/night defense, to get away from being a Battle Cats clone and to make the deck
the source of round-to-round variety. The meta loop (roster, gacha, run map) is unchanged.

Numbers below are starting values. All of them live in `src/data/` and
`src/data/balance.ts` so they can be tuned without touching logic.

## 0000. v0.9: endless runs through the saga, bigger decks, app UI

**Run structure (Balatro antes).** A run is the saga. It starts at a chapter and climbs chapter after
chapter until the cave falls, which it always eventually does: chapter difficulty compounds ×1.6.
- A **chapter** is an 11-row branching map: 10 rows of levels, shops, events, rests and treasure,
  every branch funnelling into one **boss** (the "boss blind"). Encounter types still ramp through
  the 8-step scale inside a chapter; the chapter multiplier stacks on top.
- The **deck, charms, star charts, figs and cave HP carry across chapters**. Each chapter brings its
  own biome, modifiers, objective and boss rule; a clan restriction now limits that chapter's drafts.
- **Boss cleared:** stars for the chapter's goals, +50 figs, 25% heal, a pick of 3 charms and a
  rare-card draft, and the next chapter becomes a **checkpoint**.
- **Checkpoints:** a new run can start at any chapter reached, with a fresh deck plus supplies
  (60 figs per chapter skipped and a free charm). Run sim: starting at chapter 3 with a level-10
  collection hits the same wall (chapter 4) in half the levels, so checkpoints save time without
  replacing the deckbuilding that gets you further.
- **On loss:** XP and Glowbugs earned are banked, +25% per chapter cleared this run. Then level bats,
  skills and the matriarch tree, and go again.
- The free-form custom run (8-row act with picked modifiers) is gone; chapters carry those twists.
- Run sim (bot, drafting, resting, taking charms): roster L1 falls in chapter 1–2 (4–13 levels);
  L5 in chapter 2–3; L10 with a built tree in chapter 4–5 (~25 levels).

**Bigger decks.** Start with 16 (4 species × 3 + 4 Fledglings), cap 40, and the pool shows 3.

**App UI.** Rounded system type, a bottom tab bar (Play, Bats, Summon, Guides), a hub home screen
(matriarch art, current chapter, big Play button, quick tiles), blurred navigation bars,
bottom-sheet dialogs, and a battle screen that always fits one phone screen (the field shrinks so
the cards stay visible).

## 000. v0.8: matriarch trees, armour, the raccoon

- **Matriarch passive tree** (Path of Exile, much smaller). One point per matriarch level above 1
  (plus-levels count), spent on nodes connected to ones you already have, starting from her root.
  Points move freely between runs; a leaf can be refunded if everything else stays connected.
  - Hoard (economy): +2 starting guano → interest cap +1 → +1 guano each dawn → **Miser**
    (keystone: interest cap +4, rerolls cost 1 more).
  - Colony (toughness): roosts +15% HP → bats +10% HP → +10 armour → **Fortress** (+25 armour,
    roosts +30% HP, but bats deal 15% less damage).
  - Hunt (damage): +8% attack → attack 8% faster → +12% attack → **Bloodlust** (+30% attack, but
    roosts −25% HP).
  - Her own branch: two small nodes and a notable that strengthens her rule. Flying Fox: merges
    refund 1 more guano. Ghost Bat: Feeding Roost also levels the second-best hunter. Spectral Bat:
    merge into roosts up to 2 levels above. Greater Noctule: one more pool card.
  - Cross links (Hoard↔Colony, Colony↔Trinket Pouch↔her branch↔Hunt) let paths weave.
    Trinket Pouch gives +1 charm slot.
  - 15 nodes: a level-10 matriarch has 9 points, so you pick a direction; it takes level 16+
    (evolution) to fill the tree. This replaces "+1 starting guano per 3 levels".
- **Armour** is a stat on bats and enemies: damage taken × K / (K + armour), K = 100 (as in
  LoL/Dota/Diablo): 50 armour takes a third off, 100 halves it, and it never reaches 100%.
  Bats gain 8 armour per roost level above 1 (+40 for a mega bat); some species have base armour
  (Hammer-headed 20, Pallid 15, Big Brown 10, …). Armoured enemies: beetles 25, snakes 10, cats 15,
  owls 20–30, bosses 10–40. The armour art still shows from roost level 5.
- **Raccoon Den**, a fifth boss, with new pixel art (masked face, ringed tail). Armoured (35), area
  attack, knockback. Raccoons are recorded catching bats at roost exits and taking fallen pups.
- Balance: with enemy and bat armour both in, bot results at roster level 1 are within noise of v0.7
  (bosses 1–5/8; the raccoon 1–4/8).

## 00. v0.7: trim and fix

From the mechanics audit. What changed:
- **Relics folded into charms.** The flat relics (Echo Chamber, Moonlit Roost, Guano Pile, Silk Wings,
  Winter Fur, Whetted Fangs, Fig Tree, Old Growth) are now charms. Elites and treasure offer a charm
  (1 of 2); the shop no longer sells relics. Saved runs keep their relics as charms while slots last.
- **Card upgrades became Sharp**, a fifth enhancement (bat +30% HP/attack; spell +40% power). The
  only enhancement allowed on spells. Rest sites and events apply it.
- **Echo** now puts a plain copy of the card itself into the discard (was a Fledgling, which only
  diluted the deck).
- **Talents became the evolved skill fork** (fork 4, free to pick). Saves keep the first talent bought as
  the pick and refund the XP of a second.
- **Armour** is real: bats from level-5+ roosts take 20% less damage.
- **Vampire sharing is visible**: dawn heal floats, card text, and the effects panel.
- **Effects panel** gained "How nights work": enemy targeting order, leaks, rebuilds, armour.
- **Kill income removed.** Dawn guano: base, housed bats, Clusters, interest, charms. Feeding Roost
  (Ghost Bat) now levels the roost that made the most kills that night. Scavenger still pays for kills.
- **Spells have their own hand.** The pool is bats only. Spells in the deck form a spell pile: draw 2 at
  the start of a level and 1 each dawn (hand max 3). Swarm Call costs 1.
- **Shorter levels.** Battles 4 nights, elites 5, bosses 6 (was 7/8/10); waves grow faster per night.
  Bot balance at roster level 1 is back where it was (rows 0–2 win, Hawk Ridge 6–8/8, bosses 1–5/8).
- **Content.** Three new bosses that reuse art with new palettes (Cuban Boa, Bat Falcon, Colony
  Cat), all within the same bot win range as the Great Horned Owl. Six new events (Guano Miners,
  Sick Colony, Moth Bloom, Thunderstorm, Mist Nets, Abandoned Roost). Two new saga objectives:
  **Hunt** (kill 85% of a level's enemies) and **Fragile cave** (no cave healing). The **Unbroken**
  star goal (no roost wrecked) replaces Frugal.

## 0. v0.6: the Balatro layer and the saga map

**Why.** Deckbuilding needed more decisions per run, and the meta needed somewhere to go. Balatro
works through hand types levelled by planets, jokers that bend rules and multiply, and an economy
with interest. Each now has an analogue here. A Candy Crush–style map was the ask for
"keep going"; an endless sequence of levels with one ever-growing build would remove the
deckbuilding pressure, so the saga map sits *above* runs instead.

**Saga map (home → Saga).** An endless path of nodes. Each node is a short run: a 6-row map
(battle, mixed, battle/elite, mixed, rest, boss), so 3 levels and a boss. Collection carries
over (bats, levels, skills, matriarchs); deck, charms and star charts reset per node.
- Nodes 1–12 are hand-made: biome, modifiers, clan-only restrictions, the nursery objective,
  a fixed boss rule, and two star goals. After that nodes are generated from the node number:
  stable, mixing the same ingredients, with twists stacking slowly.
- Stars: 1 for clearing, +1 per goal (Sealed: no leaks; Healthy: ≥75% cave; Unbroken: no roost
  rerolls; Small colony: ≤7 roosts; Tower: a level-6 roost). Best stars are kept; replays allowed.
  First clear pays 100 + 10×node Glowbugs.
- Difficulty: enemies ×(1 + 0.05 per node past 3), and early bosses sit shallower on the 8-row
  scale (node 1's boss at depth 3, full depth from node 5). The 8-row act is still there as
  **Custom run** with free choice of map and modifiers.
- Nursery objective: a 600-HP roost with no bats mid-field in each regular battle. If it's
  wrecked, the level is lost.

**Charms (jokers).** 5 slots; 16 charms, sold in the Fig Market (40/60/90 figs) and offered 1-of-2
after elites; sell for half. Most break a rule: Ripple (pattern bumps chain once), Foster Mother
(Fledglings merge into anything), Twins, Beacon, Vanguard, Phoenix Roost, Second Wind (cave
holds at 1 HP once, then the charm breaks), plus economy ones (Thrift, Hoarder, Windfall, Scavenger).

**Formations (hand types; replace clan bonuses).** Shapes on the 5×3 grid that stand at dusk:

| Formation | Shape | Bonus (level 1, +per level) |
|---|---|---|
| Pair | two of the same species side by side or stacked | those bats +20% attack (+10) |
| Line | 3+ of one clan in a row | those bats attack 20% faster (+10) |
| Column | a full column, any species | those bats +30% HP (+15) |
| Cluster | 2×2 sharing a clan | +2 guano at dawn (+1) |
| Full Row | all five tiles of a row | those roosts take 25% less damage (+10, max 75) |

Star charts (planets) level a formation for the run: in the shop (35 figs) and offered
instead of a card after some battles. Star Gazer (charm)
add a level to all. Formations show as coloured outlines on the field and chips under the board.
Clans now matter through Lines, Clusters, terrain and saga restrictions.

**Card enhancements (tarot).** Bought in the shop ("Moonlight") and applied to a bat card:
Foil (roost starts at level 2), Wild (merges onto any level-1 roost of its clan), Echo (placing it
adds a Fledgling to the discard for the level), Glass (+60% damage, but the card shatters out of
the deck if its roost is wrecked).

**Interest.** At dawn, +1 guano per 5 unspent, up to 3 (Hoarder: 6). Banking versus building.

**Boss rules (boss blinds).** Owl's Watch (left column closed), Drought (roosts make no guano),
Hawk's Eye (each dusk, the highest roost loses a level), Storm (pool shows one fewer card).

**Night forecast.** Each threatened column shows SAFE / RISKY / DANGER by day: the colony's
damage reaching that column (neighbours count half, two away a fifth) against the HP coming
down it. Calibrated against the bot over every encounter: SAFE columns leaked on about 1% of
nights, RISKY about 13%, DANGER 35–45%. Words, not numbers, because the estimate is rough.

**Bot limits.** The balance bot doesn't build formations on purpose, buy charms, or use
enhancements, so it measures the floor, not those systems. A saga simulation without drafts or
shops: a new collection clears node 1 about 4/6; level-5 bats get through about node 8;
level-9 bats stall in the low 20s. That's the intended shape (progression gates depth), but
the charm and formation values themselves are first guesses that need human play.

## 1. The two loops

| Permanent (meta)                    | Per run (resets)                         |
|-------------------------------------|------------------------------------------|
| Bat roster (from gacha)             | Drafted cards                            |
| Levels, plus-levels, evolution      | Card upgrades (`+`)                      |
| Skill trees                         | Charms                                   |
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
  standing roosts** (plus Clusters, interest and charms). A roost wrecked that night produces nothing.
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
- Enemies walk at one speed the whole way down, including through a column whose roosts
  are wrecked.
- **Leaks.** An enemy that reaches the cave hits once for 4× its attack, then is gone.

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

## 3. Deck construction: matriarch + flock

v0.3 used MTG commander rules (a placed commander with tax, 2-clan identity, singleton).
They worked against the merge system: merging needs two of the same bat, but singleton
allowed only one of each, so every drafted card made merges rarer and the best deck was
mostly Fledglings. The commander was one extra roost. v0.4 replaces all of it.

- **Matriarch.** A legendary bat who leads the run but is never placed. She sets one rule:

  | Matriarch | Rule | Basis |
  |---|---|---|
  | Great Flying Fox, *Seed Spreader* | every merge pays back 1 guano | seed dispersal regrows the forest |
  | Ghost Bat, *Feeding Roost* | at dawn, the roost whose bats killed most tonight gains +1 level | carries prey back to a feeding roost |
  | Spectral Bat, *Pair Bond* | a roost can merge into one a level above it | pairs roost together and share food |
  | Greater Noctule, *Long Range* | the pool shows 3 cards | hunts high and far |

  Levelling a matriarch adds +1 starting guano per 3 levels, so her roster level still matters.
- **Starting flock.** Pick 3 owned species; the deck starts with 2 of each plus 2 Fledglings
  (8 cards). Copies mean merges are possible from the first day.
- **No singleton, no identity.** Any card can be drafted, in any number. The cap is 20.
- **Draft offers.** About 45% of offers are another copy of a bat already in the deck, 25%
  spells, the rest new species by rarity. The card shows "In deck: N" or "New". The choice is
  between depth (more merges) and breadth (new patterns and clans). Card removal in the shop
  matters now: thinning the deck raises merge odds.
- Formations (§0) reward committing to a clan through Lines and Clusters.

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

**Clan bonuses** (v0.4–0.5) were replaced by formations in v0.6 (see §0).

Starter matriarchs: **Great Flying Fox**, **Ghost Bat**, **Spectral Bat**. Greater Noctule is
a legendary summon.

## 4b. The field guide (collection)

36 species: 35 collectable plus the basic Fledgling. Each has a real scientific name, a
region, a fact, and a conservation note where the status is notable and well established
(Indiana bat, northern long-eared, greater long-nosed, tricolored, little brown, ghost bat).

| Region | Species |
|---|---|
| 🌲 North America | little brown, big brown, eastern red, hoary, tricolored, northern long-eared, Indiana, Townsend's big-eared, pallid, Mexican free-tailed, lesser and greater long-nosed, Mexican long-tongued |
| 🌴 Latin America | the three vampire bats, lesser and greater bulldog, Mexican fishing bat, Pallas's long-tongued, tube-lipped nectar, Jamaican fruit, Seba's short-tailed, Geoffroy's tailless, spectral (matriarch) |
| 🌍 Africa | Egyptian fruit, straw-colored fruit, hammer-headed, Wahlberg's epauletted |
| 🏔 Eurasia | brown long-eared, Daubenton's, Rickett's big-footed, greater noctule (matriarch) |
| 🌏 Asia-Pacific | great flying fox, ghost bat (both matriarchs) |

- **Sanguivores stay at three.** Only three blood-feeding bat species exist, and the game
  has all of them. I'm not inventing more.
- **Greater Noctule** is a fourth matriarch, available only from legendary summons.
- **Rewards:** milestones at 10, 15, 20, 25 and 30 species and the complete guide, plus a
  set reward for completing each region. They pay Glowbugs (more summons) and XP, so
  collecting feeds back into collecting and levelling.
- **The guide** can be sorted by clan or by region. Unfound species show as silhouettes
  with their region and rarity.
- The starter gift is fixed at one common per clan, so adding commons doesn't change it.

## 4c. Main menu and Play screen

- **Main menu:** Play, Field Guides, Summon. More will come later.
- **Play:** choose the matriarch and starting flock, then the map and any modifiers.
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
- **Tutorial:** a 10-step guided first level covering the wave preview, picking a pool
  card, preview and confirm, the pool, clan bonuses and the matriarch chip, guano, ending
  the day, night, and merging. It's skippable, and can be replayed from the home screen.
  The tutorial level starts with +2 guano so both pool bats are affordable.
- **Save version 2** discards all older saves, so everyone starts fresh with the tutorial.
  Commander-era v2 saves are migrated in place (commander → matriarch); progress is kept.

## 4c. Skill trees, names and attack readability (v0.5)

- **Skill trees.** Every bat that fights (not matriarchs) has three forks, at roster Lv 3, 6
  and 9. Each fork is a pick between two skills; picks can be switched freely from the bat's
  page. Skills lean toward changing how the bat plays rather than flat stats:
  wider pattern (merges spread further), +bats per roost, +1 per release, a new attack trait
  (multi-hit, area, knockback, lifesteal, auras), faster refill. Skill traits never weaken a
  trait the bat already has (an evolved multi-hit 3 stays 3). The roster shows a dot when a
  fork is unlocked but unpicked. Evolution unlocks a fourth fork (the bat's two former talents).
- **Names on the field.** Each bat has a short common name (≤ 11 characters) drawn on its
  roost tile. The field canvas renders at 3× its view size so the text is sharp on phones.
- **Attack styles**, from traits and range, each with its own effect coloured by clan:

  | Style | Rule | Effect |
  |---|---|---|
  | Melee bite | range < 1 tile | claw marks on the target |
  | Ranged sonar | range ≥ 1 tile | sound waves travelling to the target |
  | Hits several | multi-hit trait | a jagged line to every target hit |
  | Area | aoe trait | a burst ring at the target |
  | Lifesteal | any lifesteal | blood drops flowing back to the bat |

  Enemies show smaller red claw marks (melee) or a red shot (ranged). Roost tiles carry a
  glyph for the style, and cards say it in words ("Hits 2 at once · support").
- **Balance:** the meta curve already saturates: by roster level 5 the bot clears every
  level in the current single act, with or without skills. Skills add choice, not
  challenge, until acts 2–3 (or ascension-style modifiers) give late levels something to
  push against.

## 5. Run structure (unchanged from v0.1; battle nodes are now defense levels)

- One act (designed for three later): 8 rows of nodes, branching paths.
  - Row 0: battles. Rows 1–5: mixed. Row 6: rest. Row 7: boss.
  - Node types: Battle, Elite, Shop, Rest, Event, Treasure, Boss.
- Battle reward: Figs plus a pick of 1 of 3 cards (or skip). Elites and treasure offer a charm (1 of 2).
- Rest: heal 30% cave HP, or make a card Sharp.
- Shop: cards, charms, enhancements, a star chart, card removal, healing.

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
  stats, level cap raised to 20, the fourth skill fork unlocked.
- **Evolved fork.** The two old talents became the fourth skill fork, free to pick after evolution.

## 8. Gacha

- One soft currency, **Glowbugs**, earned only through play. No premium layer.
- Single pull 150, ten-pull 1500 (guaranteed rare or better).
- Rates: Common 65%, Rare 26%, Epic 8%, Legendary 1%. Rates are shown in game.
- Pity: an epic or better is guaranteed within 10 pulls, a legendary within 60.
- New players pick one of the three starter matriarchs for free and get all five
  common bats. Greater Noctule is a legendary pull.

## 9. Known tensions / to watch in playtest

1. **Level length.** Now 4–6 nights per level (v0.7), about 5–7 minutes.
   That's the price of having time to build. A mid-level save/resume would help.
2. **Fledgling merging.** Basics merge too, and a thin deck of Fledglings levels up
   fast. Their roosts stay weak per bat, but watch whether "merge Fledglings"
   becomes the default line.
3. **Matriarch strength.** The bot doesn't exploit the rules (it never plans Pair Bond
   merges or saves Seed Spreader refunds), so their relative strength needs a human check.
4. **Matriarch levels** only add starting guano. That's thin for a legendary; watch whether
   players feel levelling her is pointless.
5. **XP and Glowbugs** don't compete with each other. That may be too frictionless.

## 10. Balance status (bot playtests)

- **v0.4 (matriarch + flock):** without the commander roost, starter flocks still got
  *stronger*: two copies of each species merge from day 1. At roster level 1, starters beat
  the boss 6–7/8 (was 0–4/8). Enemy scaling per map row went 0.15 → 0.20, which leaves the
  opening rows unchanged and puts the level-1 boss at 4–5/8 with a full cave (real runs
  arrive damaged). A starter padded with six off-plan cards does worse (3/8): dilution now
  costs you, which is the deckbuilding pressure we wanted. Level 5 still clears everything.
- **Enemies don't rush.** v0.3 had enemies sprint at 3× through a column with no roosts
  left. It read as wrong in play and was removed; leaks still hit for 4× attack.

`tests/defense.test.ts` includes a bot that drops pool bats onto a
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
