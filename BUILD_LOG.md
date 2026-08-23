# Solar Siege — Build Log

AI-assisted development log. Each session records what was requested, what was built, what broke, and what was corrected.

---

## Session 1 — Spec Phase

**Asked:** Read the game design document and produce requirements.md, design.md, tasks.md, a steering file, and BUILD_LOG.md. Do not implement.

**Generated:** Full spec across three documents. requirements.md with 10 functional requirement groups and NFRs. design.md with 15-file architecture, game loop order, dirty-flag beam caching, coordinate system. tasks.md with 48 tasks in 6 vertical slices. Steering file with hard constraints.

**Decisions locked:** Orthographic camera, world height 100 units, iterative raycast capped at 8 bounces and 12 segments, quad mesh pool for beams, enemy pool of 64, Node concat build script, all balance in config.js.

---

## Session 2 — M1: Beam + Mirrors

**Asked:** Implement beam solve, 4 mirrors, 1 prism, grey-box visuals, build script.

**Generated:** 8 source files (config, renderer, beam, beam-render, mirror, prism, input, main), build.js, vendor/three.min.js.

**Broke:** ES module import in `<script type="module">` fails on file:// due to CORS. Game showed a black screen.

**Fixed:** Switched to UMD Three.js build loaded via plain `<script src>` tag. All game code in a regular `<script>` block. Works from file://.

**Broke:** Input completely dead. Pointer events were binding correctly but coordinate conversion and hit detection were untested in browser.

**Fixed:** Verified binding path, increased hit radius, added touch-action:none on canvas, added D-key debug overlay showing pointer state and world coordinates.

---

## Session 3 — M1 Fixes

**Asked:** Fix band count (6 rays instead of 3), beam termination at edges, divergence angle too wide, mirror defaults, z-order.

**Broke:** Prism re-entry — sub-beams after split re-intersected the same prism, causing a second split. Root cause: rayCircleIntersect hit the far side of the prism circle.

**Fixed:** Added excludePrism parameter to traceBeam so sub-beams skip the prism they just exited.

**Fixed:** PRISM_SPREAD_DEG from 30 to 20 (10 degrees per outer band). Mirrors defaulted to 45 degrees. Prism rendered as visible triangle. Z-order stack established.

---

## Session 4 — M2: Enemies + Damage

**Asked:** Enemy spawner, damage math, escalation curve, lose state.

**Generated:** enemy.js (pool), enemy-spawner.js (phase schedule), damage.js (DPS formula with armour), session.js (timer, breach counter, game over).

**Verified:** 13 headless assertions including GDD math (Mote dies in 3.0s with 1 band, synergy gives 26/48 DPS at N=2/3, escalation 1.2 at t=60 and 3.8 at t=840).

**Misstep:** Wrote inline node -e tests in PowerShell that died on quote escaping. Twice. Rule established: always write test scripts to .js files.

**Misstep:** Reported M2 as built on the strength of "init OK" without verifying damage, spawning, or breaches. Gap acknowledged. Integration tests added afterward.

---

## Session 5 — M3: Foundries + Crafting + Win State

**Generated:** foundry.js (3 altars, resource accumulation), crafting.js (6-button tray, purchase logic), win condition (Recombination or Devourer kill).

**Broke:** Zone order was inverted vs GDD. Foundries sat below the breach line inside enemy territory.

**Fixed:** Restructured zones top-to-bottom: mirrors → foundries → breach → enemies. Enemy speed derived from MOTE_TRAVEL_TIME_S = 8 for tuning.

**Broke:** Craft tray overlaid the socket grid, blocking mirrors.

**Fixed:** Moved tray to DOM element below canvas, then later to an in-scene canvas texture at screen bottom.

---

## Session 6 — Absorption + Layout

**Asked:** Foundries must absorb beams (band terminates, does not pass through to enemies). Critical for the defence-vs-economy tradeoff.

**Iterated through three foundry position failures:** Gold band kept hitting Lens Works due to ray-AABB geometry at shallow angles. Each time, ran a debug script to trace exact segment endpoints before adjusting positions.

**Final positions:** Forge -15, Lens +14, Chorus +22. Verified by assertion: zero foundries fed on load.

**Broke (later reverted):** Absorption was removed at user request. Foundries became pass-through. Beams now feed altars AND hit enemies on the same path. Tradeoff becomes positioning: route through an altar on the way to the sea.

---

## Session 7 — Lore Reskin

**Changed:** Spectrum Zero → Solar Siege. All player-facing text moved to src/strings.js. Archimedes defending Syracuse theme. No mechanical changes.

**Verified:** config.js hash identical before and after. Zero binary assets added. All tests pass.

---

## Session 8 — DEV Flags + End Screens

**Problem:** MAX_BREACHES was set to 999 for testing, causing 40+ hearts to render in HUD and making it impossible to verify game-over flow.

**Fixed:** Created DEV flag system. DEV.INVINCIBLE replaces hardcoded 999. Build script hard-errors on --submission if any flag is true. Red "DEV" label visible on screen when active.

**Verified:** Defeat path (3 breaches → game over), victory path (Devourer killed), restart (all state resets cleanly, no leaks). Mirror/prism positions now reset on restart.

---

## Session 9 — Free Placement

**Promoted:** FREE_PLACEMENT from a DEV override to a shipped mechanic (PLACEMENT_MODE = 'free'). Mirrors drop anywhere in the mirror field, clamped to bounds.

**Initially over-engineered:** Added validation rules (min distance, altar overlap, valid/invalid tint). User rejected: "Do not add placement restrictions." Stripped back to simple clamp-to-bounds.

---

## Session 10 — Heat Decay + Paired Spawning

**Problem:** Single-mirror behaviour persisted across three playtests. Diagnosis: one mirror at y=12 covers 93% of spawn range by rotation alone.

**Root cause identified:** No heat decay. Switching targets cost nothing because damage was permanent. A player could sweep one beam back and forth with no penalty.

**First implementation (WRONG):** Heat decay as HP healing at 15%/s. This made enemies unkillable: one beam dealt 10 DPS but the target healed 27 HP/s. Net damage negative.

**Corrected:** Heat is a separate accumulator. Beams add heat; heat decays when contact is lost; enemy dies when heat reaches maxHP. Damage already dealt is never undone. Only PENDING progress cools.

**Verified:** Mote still dies in 3.0s with continuous contact. Husk under Gold slow + 1 beam: killed with 6.0s margin.

**Added:** Paired spawning from phase 2. Heavy on beam side, fast mote on off-side 1.5s later. Creates two-sided pressure.

---

## Session 11 — Wall Integrity + Breach Scaling

**Replaced:** Hearts (3 discrete breaches) with wall integrity (100 HP pool). Ships do variable damage based on type. Damage scaled by heat fraction: a nearly-dead ship that breaches does only 20% of base damage.

---

## Session 12 — Coverage Analysis + Layout Toggle

**Asked:** Would moving mirrors lower fix single-mirror behaviour?

**First analysis (WRONG):** Assumed 30-degree sweep, computed 26% coverage. Concluded moving mirrors lower would help.

**Corrected analysis:** Swept all angles with proper ray-segment intersection. Finding: a single mirror at ANY height reaches 100% of the playfield. The reflected beam goes nearly horizontal at shallow angles and crosses the full width. Height does not reduce coverage.

**Conclusion:** Heat decay and paired spawning ARE the fix. Layout change is ergonomics only.

**Implemented anyway as a toggle:** LAYOUT_MODE = 'classic' or 'low'. Both paths coexist. Comparison: classic = 70% wall after 60s, low = 55% (21% harder due to wider beam divergence before reaching enemies).

---

## Session 13 — Sub-ray Synergy Rule

**Asked:** Second prism creates sub-rays. Do they synergise?

**Analysis showed:** With synergy, 6 sub-rays = 75 DPS. Makes the game easier not deeper.

**Decision:** Sub-rays excluded from synergy. Two sub-rays on one target = 5+5 = 10 DPS flat. Full bands still synergise normally. Armour subtracts per beam, making sub-rays nearly useless against armoured targets. This creates a real choice: spread (sub-rays) for coverage vs focus (full bands) for armour.

---

## Session 14 — Polish + Effects

**Added:** Beam contact glow (pooled additive sprites scaled by DPS), destruction sequence (flash + 8 debris particles + WebAudio crack/thump), game-over overlay cleanup (beams hidden, 82% dim, text only), resonance mechanic (3+ bounces between same mirror pair = 1.5x DPS multiplier), diamond prism shape (faceted, internal glow, colour-tinted lower half).

---

## Session 15 — Documents + Freeze

Mechanics frozen. DESIGN_INTENT.md written from the actual build. This log produced. Submission zip packaged.

---

## Known Issues (not fixed, shipping as-is)

- Insight mutation log never conclusively identified the intermittent Insight-reset bug. Instrumentation is live; the bug was not reproduced in headless tests.
- Phase 1 zero-input survival is tight. Game over at ~2:42 without player action. Deliberate: the game requires engagement from the first seconds.
- Single-mirror behaviour may persist for players who do not notice heat decay visually. The burn meter fading IS the feedback, but it may need strengthening in a future pass.
- Source drift (phase 3) and Devourer boss (phase 4) are defined in config but not spawned. The 15-minute session arc is incomplete; the prototype demonstrates the core loop, not the full session.
