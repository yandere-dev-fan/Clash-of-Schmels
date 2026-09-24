# Clash of Schmels — game design (Phaser edition)

Full-screen bee industry at `/bee`. The authoritative simulation runs in `src/game/bee-game.ts`; the browser predicts at most 15 seconds, and the server validates every action. A fixed two-second clock prevents request-frequency acceleration. One offline catch-up covers up to eight hours. No client resource grants or paid starting packs.

## Preserving the old colony

The original Bitter deployment retains its own source backups and database snapshots. They are private runtime data and are not included in this repository. `src/game/bee-legacy.ts` preserves migration compatibility. Switching the renderer from SVG to Phaser requires no save reset or schema migration. See `bitter-api.md` for connecting to existing accounts.

Migration retains building IDs, levels, paused state, upgrades in progress, bee count, honey/wood/wax, brood, earnings and order counters. It translates the old forest into the centre of the larger map and places each existing structure on the nearest valid plot with a service gap. Old workers receive a mix of the four professions; they can be retrained. Outdated roads are replaced by free home-to-factory flight connections. Retired doctrine research is refunded (150 honey, 30 wax); pending clearing is transferred where possible or refunded. Stored stocks above the new capacity remain available rather than being lost.

## Production and local inventories

Resources are physically stored inside buildings. Only central hive and warehouse inventories pay for construction, research and training. Every other structure needs input delivery and product export. Moving stock to a warehouse does not teleport it to a factory. Factory buffers are 40/resource/level, relay buffers 100, expedition cells 240 honey, warehouses 1000 of each resource per level.

| Chain            | Recipe at level 1                 | Cycle                       | Operator / power                              |
| ---------------- | --------------------------------- | --------------------------- | --------------------------------------------- |
| Wild hive / hive | 2 nectar → 1 honey                | 8 s                         | Forager delivers nectar                       |
| Flower plot      | Regenerates 2 nectar              | 2 s                         | Foragers harvest, buffer 40                   |
| Logging station  | Tree health 12 → 3 wood           | Actual flight + 6 s harvest | Forester                                      |
| Workshop: planks | 2 wood → 1 plank                  | 18 s                        | Engineer                                      |
| Workshop: gears  | 2 planks + 1 wax → 1 gear         | 25 s                        | Engineer                                      |
| Wax press        | 3 honey → 1 wax                   | 20 s                        | Engineer                                      |
| Water intake     | 3 water                           | 12 s                        | Engineer, river bank                          |
| Sawmill          | 2 wood → 2 planks                 | 8 s                         | Engineer, 8 rotation                          |
| Nectar pump      | 1 water → 4 nectar                | 10 s                        | Engineer, 12 rotation, consumes 4 tree health |
| Forest nursery   | 2 water + 1 honey → 6 tree health | 15 s                        | Forester                                      |
| Drill            | 2 ore                             | 12 s                        | Engineer, 10 rotation, nearby rock            |
| Smelter          | 3 ore + 1 wood → 1 copper         | 25 s                        | Engineer                                      |
| Centrifuge       | 4 nectar → 4 honey + 1 wax        | 8 s                         | Engineer, 18 electricity                      |

Higher levels increase processing speed by 40% per level; machines also demand more utility capacity. A full output blocks production, including a blocked coproduct on the centrifuge. Recipe switching keeps inventories and resets recipe progress. Disabling a structure stops new work but lets already reserved deliveries finish. Dismantling requires an empty inventory, no live deliveries and sufficient remaining housing; the player gets half the original construction cost back. Moving takes a builder and 15 seconds and removes attached routes.

## Bees and routes

The first three foragers are free and hatch in 15 seconds. Further specialists are grown one at a time in a brood nursery: forager 12 honey / 60 s; carrier 18 / 90 s; engineer 30 honey + 5 wood / 150 s; forester 18 / 90 s. A nursery or hive adds six housing per level. Retraining one idle bee costs 8 honey and 60 seconds.

- Foragers fly to a real flower plot (up to eight tiles from the hive), otherwise to natural flowers, gather, then return with nectar. A colony without adequate collection and transport can have empty machines despite having many buildings.
- Carriers reserve a directed route's cargo, fly from their previous position to the sender, collect up to four items and deliver to the recipient. Each bee has at most one active job. A round-robin dispatcher prevents the first route permanently monopolising workers.
- Engineers are allocated to buildings by player priority. An idle or blocked machine can still reserve its assigned engineer; pause it to release that worker. Foresters make actual timber trips or staff forest restoration.
- Flight routes are free, directional, filtered and limited to twelve tiles. Relay cells extend reach and buffer cargo. No roads are required for flying workers.
- Belts reserve up to two items every two seconds and deliver along the actual routed path. They need rotation **at the sender**, and add one load per six path cells (rounded up). Losing power stops new belt dispatch; already dispatched cargo completes its journey.
- Pipes, unlocked in the steam era, move water, nectar or honey in batches of three by gravity. Shafts carry rotation and wires carry electricity; neither carries items.

Physical connections use orthogonal routing through cleared, explored land; up to twelve player waypoints allow intentional detours. Buildings and existing routes of the same type obstruct the path. Different types can cross. Relays allow branching and joining via multiple directed connections. A route preview shows its path, price and invalid placements before confirmation.

## Power and epochs

| Era         | Earliest research start | Research duration | Research cost                                    | New capability                                                 |
| ----------- | ----------------------- | ----------------- | ------------------------------------------------ | -------------------------------------------------------------- |
| Swarm       | Start                   | —                 | —                                                | Manual workshop, hives, carriers, logging and local production |
| Mechanics   | Colony age 6 h          | 30 min            | 250 honey, 150 wood, 40 wax, 40 planks, 12 gears | Waterwheel, shafts, belts, sawmill, pump, restoration          |
| Steam       | Colony age 30 h         | 2 h               | 1500 honey, 250 planks, 80 gears, 150 wax        | Boiler, drill, smelter, pipes, second builder                  |
| Electricity | Colony age 72 h         | 6 h               | 6000 honey, 400 copper, 300 gears, 500 wax       | Dynamo, power plant, centrifuge                                |

Research needs a completed workshop and the full stock in central storage. Existing upgraded colonies start at the appropriate era rather than losing their old unlocks. Research gates are wall time, including offline time; earning and arranging resources remains necessary.

A river waterwheel supplies 24 rotation per level. A boiler supplies 48 while it has fuel (1 wood + 2 water per ten seconds). A dynamo takes 16 rotation and supplies 40 electricity. A power plant supplies 80 electricity, consuming 2 wood + 3 water per ten seconds. Connected networks stop under overload instead of silently running every machine at full speed. The power overlay and building details show demand/capacity. Fuel generators consume fuel continuously while enabled.

`pnpm simulate` runs an unassisted resource simulation without granting stock: first brood at 15 seconds; nursery around minute 8; first specialist at 11; wax at 33; workshop at 43; first gear batch and mechanics resources around minute 85. The first hive can instead be prioritised within the first few minutes. The scripted path enters mechanics at 6.5 hours; steam cannot finish before 32 hours; electricity before 78 hours. These are design targets, not measured retention results. Short visits can focus on new cells, workers, inventory limits and laying out the next chain while research gates mature.

## Land, ecology and choices

The 42×42 world consists of 6×6 sectors. Nine central sectors start open; each era allows four additional adjacent sectors (cumulative cap 9 + 4×era). An expansion starts at 80 honey / 40 wood and increases by 60 / 15 for each previously purchased sector. River access creates a mechanical hub; ore draws late industry outward. Hidden sectors remain forested under fog; extraction and restoration never operate through unexplored fog.

Construction uses 2×2 footprints (1×1 relays) with a mandatory one-cell separation. This is our service corridor rule, not a claim about Clash of Clans rules. The gap is available for conveyors and utilities. Building art uses a common ground anchor, contact shadows and lower silhouettes; ground diamonds and depth sorting make dense colonies easier to read. Manual clearing reserves a builder slot and sends an idle forester, or the builder when no forester is available, on an actual flight. Ten seconds of chopping follow arrival; the tree falls at pickup and up to 25 wood arrives only after the return flight; wood beyond available central storage is discarded, so a full warehouse should be expanded before clearing for income. Trees around the colony remain a finite input: industrial pumps and logging eventually need expansion or restoration. Flower plots provide a renewable alternative to extracting nectar from the forest.

Three viable directions: compact flowers/hives with many carriers and low infrastructure cost; a river-powered wood/wax factory with belts and fewer carriers; a fuel-heavy extraction network that trades forest and maintenance for throughput. Mixed designs and multiple small utility networks limit overload failures.

## Presentation and references

Original non-pixel vector building sprites are replaceable files in `public/bee/assets/buildings/`: wax stacks, brood cells, timber, copper and exposed machinery. Wheels, pistons, wings, steam and moving cargo follow the relevant simulation state. Warehouse and nursery silhouettes are bee cells rather than human houses. Nine resource icons have distinct shapes/colors. Main screen uses resource bars, role/build/research counters and optional logistics/power layers; recipes, training and details appear only after selection.

Reference principles: [Supercell's Clash of Clans](https://supercell.com/en/games/clashofclans/) for the readable settlement, strong silhouettes and perimeter HUD; [Factorio transport networks](https://wiki.factorio.com/Transport_network) for inventory-dependent production; [Create stress capacity](https://github.com/Creators-of-Create/Create/wiki/Stress-Units%2C-Capacity-and-Impact) for overload. No proprietary game sprites were copied. The earlier asset search and retained CC0 decoration provenance are in `public/bee/assets/CREDITS.md`.

## Rewards and validation

Expedition cells require a real delivery of 120 honey per order. Existing server-side funded rewards remain 25 cents per order, five-minute active-time intervals and the configured daily cap (default $3). Payment requires an enabled funded treasury; production does not mint wallet money. Repeated requests and concurrent payouts use the existing receipt and ledger safeguards. New industrial progression does not promise a fixed income to every player.

Validation: API integration with isolated disposable Postgres (auth, strict action validation, receipts, concurrent payout, funding, pause, balanced ledger); deterministic engine tests cover free start, inventory reservations, real worker shortage, powered belts, overloaded shafts, electrical conversion, buffers, spacing, fog, routing, training, multiday gates, offline cap and v1/v2 migration. Production API/web builds and all package type checks are required before switching the local preview.

## v3.1: replaceable artwork and onboarding

All current image assets live in `public/bee/assets/`: 87 manifest entries and 113 files covering buildings and active variants, five bee roles, resources, HUD icons, terrain, routes and work effects. `README.md` explains replacement, PNG/WebP/SVG support, ground anchors, dimensions and polygon hit areas. `index.html` is the visual catalogue, with an animation toggle. The manifest is fetched on page load; changing public images and manifest does not require recompiling React. Bump its version to refresh cached images.

Every build card has an independent information button, including buildings still locked by an era. Guides explain purpose, ingredients, operators and utilities. Five short tutorial steps cover the free start, bee roles, local inventory logistics, gears and power; progress persists locally and Help can replay it. The next-era HUD bar averages colony age, available research materials and workshop completion; during research it shows the actual timer. The research dialog exposes all three prerequisites. Internal building IDs are no longer visible beneath structures; the selected building displays its level.

New profiles receive a persisted random seed. River orientation and bends, tree density, grass, natural flowers and rocks vary. A continuous river crosses the world, with a reachable starter shoreline for the intake and waterwheel. Existing colonies without a seed retain the original terrain, forest, buildings and progress. Refreshing does not reroll a map. Seed tests cover 64 worlds with continuous water, bank placement, initial wood and nectar production.

Tree selection follows a visible crown/trunk polygon instead of transparent image margins. The selected tree highlights. Flight, axe/chip animation, falling tree, return cargo and progress feedback follow server job timestamps. Logging stations reserve tree health when a trip is assigned, consume it when chopping finishes, then deliver wood on return; simultaneous extraction cannot spend the same reserved health. Buttons and panels have short feedback animations, with reduced-motion support.

The Phaser migration preserves existing Bitter profiles. Destructive gameplay checks use a separate local test colony.
