# BUILD LOG — Burning Glass

(Formerly "Solar Siege", renamed 2026-08-25.)

An honest record of development including wrong turns, corrections, and the reasoning behind each decision. Written for the Meta Horizon Creator Competition judges to demonstrate that an AI assistant performed the implementation work, including the mistakes.

---

## 2026-08-20 — Initial Prototype (c9eb9c3)

**Asked:** Build a single-file HTML5 tower defence game based on the Archimedes legend (focusing sunlight to burn ships). Three.js vendored, no network requests, runs from file://.

**Generated:** Full game loop in one session: iterative beam ray-tracer, mirror reflection, prism splitting into coloured bands, enemy pool with movement and HP, damage system with multi-beam synergy, foundry resource generation, crafting shop with upgradeable items, win/lose state machine, 10-minute session timer.

**Decisions locked:** Single-file build via concatenation. ES modules in src/ stripped of import/export and wrapped in one IIFE. THREE as global from vendor script.

**Broke:** Nothing critical on day one, but the workspace had a requirements spec describing a completely different game (a roguelite dungeon crawler). The spec mismatch was caught later when reviewing design documents — the AI had built what was asked verbally, not what was in the written spec. No code was affected but the DESIGN_INTENT document needed rewriting from scratch.

---

## 2026-08-22 — Polish & Free Placement (7df7175, 66dc76d)

**Asked:** Burn feedback, free mirror placement (no socket snapping), reskin to "Solar Siege" name.

**Generated:** White flash on beam contact, pass-through foundries (beams no longer terminate at resource zones), pointer rotation UX fix, unlimited-lives DEV toggle, free placement mode, hearts/wall-integrity system.

**Misstep — heat decay as HP healing:** The heat system was implemented as HP regeneration at 15%/s when the beam left an enemy. This made enemies unkillable: any momentary break in beam contact healed them faster than damage accumulated. The user caught this immediately in play.

**Correction:** Heat was separated into its own accumulator independent of HP. Heat decays at 15%/s, HP never heals. Once an enemy takes damage it stays damaged. This was the correct design — heat represents thermal momentum, not vitality.

---

## 2026-08-23 — Layout Reversal & Economy (0e70e8d → f606e54)

**Asked:** Reverse the layout: sun at top, ships spawn high and descend toward a wall, mirrors at the bottom reflect upward.

**Misstep — coverage calculation:** Before the reversal, a coverage analysis was run to determine whether the new layout needed different mirror heights. The calculation used a fixed 30-degree sweep angle instead of full rotation. This produced a misleading result suggesting taller mirrors were needed. The corrected calculation showed mirror height has zero effect on angular coverage — only position and rotation range matter. No code change was needed, but it wasted a design discussion cycle.

**Misstep — shipped syntax error (8e36195):** The layout refactor commit had a syntax error (malformed template literal in the concatenated output). The build script did not validate syntax, so `index.html` was generated but could not execute. The game was broken for one commit.

**Correction (526fa67):** Added `new Function(gameCode)` syntax validation to build.js. If the concatenated output fails to parse, build.js now deletes index.html and exits with an error. This has prevented syntax regressions since.

**Generated:** Complete layout flip, four-currency economy (brass/bronze/silver/gold), altar zones below the wall with 20% passive / 80% beam-fed income split, overheat system (6s continuous → halved efficiency, 10s recovery), wall integrity replacing lives, paired-edge spawning.

**Decisions locked:**
- Altars at y=-44 (below wall at y=-40). Beams to altars go DOWN, beams to ships go UP — no single path serves both.
- Overheat is a separate accumulator (not HP-based), decays instantly when beam removed, triggers after 6s continuous.
- Session: 600 seconds, escalating HP multiplier.

---

## 2026-08-23 — Prism Tiers & Synergy (87454b9)

**Asked:** Scale the prism to 6 tiers. Higher tiers split into more bands but must not make focused single-target DPS higher than lower tiers.

**Generated:** Tier system with synergy formula B(N) = 0.6/(N-1), producing constant focused DPS = 48 regardless of band count. Sub-rays from secondary prism hits excluded from synergy (flat damage only). MAX_SEGMENTS raised to 24.

**Decision locked:** Synergy scales inversely with tier. More bands = better area coverage but same single-target kill speed. This prevents higher tiers being strictly dominant.

---

## 2026-08-23 — Audio Synthesis (bec50f0)

**Generated:** Full WebAudio sound set synthesized at runtime (no audio files): beam hum drone scaled by segment count, burn hiss scaled by enemies under fire, prism chime on purchase, wood-crack destruction, dull wall-hit impact, altar tone with pitch drop on overheat. Voice cap (6 simultaneous), hum ducking under explosions, mute toggle button.

---

## 2026-08-24 — Mobile Video Playback (1f6f596 → d027c60)

Six commits over several hours to make a 10-second intro video play reliably on mobile. This was the most frustrating sequence of the project.

**Root causes discovered (in order):**
1. Video was Main profile Level 4.2 with moov atom at end — mobile Safari refuses this entirely.
2. After re-encoding to Baseline 3.1 fast-start, video still failed: `preload="auto"` doesn't work on iOS (won't buffer without user gesture).
3. `canplaythrough` event never fires on iOS before a tap, so the readiness gate's 4s timeout always fired first, skipping the intro silently.
4. Chrome mobile rejects `play()` with audio even from a user gesture on sites with low Media Engagement Index.
5. Putting `void video.offsetHeight` inside the tap handler burned Safari's gesture token — any synchronous work between event dispatch and `play()` invalidates the user activation.

**What broke at each step:**
- Adding `muted` fixed playback but killed the voiceover narration.
- Removing `muted` broke playback again on Chrome.
- The `canplaythrough` gate caused the game to silently skip the intro on every mobile device.
- The `void video.offsetHeight` reflow in the tap handler caused both debug and plain paths to fail.

**Final solution (d027c60):** Start muted (always succeeds from gesture), then unmute in the `.then()` microtask callback (still within user activation on Chrome). 5-second failsafe guarantees game starts regardless. The debug flag only prints text, never changes behaviour.

**Misstep — debug flag changing behaviour:** The debug overlay's `document.body.appendChild()` was forcing a layout reflow at page load that gave the video element computed dimensions. Without the debug flag, the video stayed zero-size and iOS refused `play()`. The user correctly identified: "a debug flag must only display numbers, never change behaviour." This was fixed by making the reflow unconditional.

---

## 2026-08-24 — Defeat Cinematic (8f08a43)

**Generated:** Second video (archimed_fail.mp4, 1.55MB re-encoded same spec) plays once on first loss per browsing session. Skippable from first frame. Preloaded 5s into gameplay. Falls back to defeat screen on any failure. SessionStorage flag prevents replay on retries.

---

## 2026-08-24 — Raw Beam Damage Fix (81e8a24, 58db9b9)

**Asked:** "The raw sun beam must not damage ships. Only light that has passed through the prism should be a weapon."

**What was broken:** The beam from sun→prism was intersecting enemies and dealing damage with zero player input. The centre lane defended itself permanently.

**Generated:** `preSplit` flag on every segment. Initial beam from sun = `preSplit: true`, excluded from damage and altar income checks. Post-prism bands = `preSplit: false`. Mirror reflection preserves the flag (a reflected pre-prism beam is still pre-prism).

**Also fixed:** `getActiveTier()` was accessed via `typeof` fallback to hardcoded 3 instead of being properly imported. Band count now derives from actual prism tier.

**Misstep — default mirrors auto-aimed:** With horizontal default mirrors positioned directly below the prism's split paths, all 3 bands reflected straight into ship lanes, making zero-input play viable. A headless geometry trace confirmed: with angle=0 (horizontal), 2/3 bands reached the ship lane.

**Correction (58db9b9):** Default mirrors set to vertical (π/2). Headless trace confirmed: 0/3 bands reach ships. Player must actively rotate mirrors to deal any damage.

**Decision locked:** Post-prism bands that hit a target without mirror reflection DO damage (prism is a player purchase). Only the raw pre-prism column is inert.

---

## 2026-08-24 — Prism Pinned (5b1f8cd)

**Asked:** "The prism has drifted down next to the mirror row. Make it stationary and find why the split point and the prism sprite are in different places."

**Root cause:** `movePrismToSocket()` set `prism.position.y` to the socket's Y coordinate instead of PRISM_Y. Once dragged, the solver hit-tested at the wrong position while the mesh stayed at the original visual position (or vice versa).

**Fix:** Removed prism from socket system, drag system, and selection entirely. Pinned permanently at `(0, PRISM_Y)`. One position object, shared by mesh and solver. `movePrismToSocket` deleted.

---

## 2026-08-24 — Shield-Bearer (e0aa2a8, c604266)

**Asked:** An enemy that forces angled shots. Beams within 25° of vertical hit a shield plate and are blocked.

**Generated:** Shield-bearer type (HP=400, armour=1, speed=2.0). Angle check computes `atan2(|dx|, |dy|)` of each segment, blocks if ≤25°. Bronze deflection sparks on block. First appearance at 30s alone in centre. Escort formation: 2-3 trailing ships in tight column.

**HP arithmetic:** One angled band at 70% uptime = 252 damage (63% HP, doesn't kill). Two bands with synergy = 672 damage (kills at 42% travel). Design goal: second band clearly needed.

**Also fixed — centre lane bias:** Audit revealed 60-70% of spawns were forced to lane 2. Rewritten: all types use random lanes, shield-bearers cycle [2,0,4,1,3], flagship random lane, pairs use random opposite lanes.

---

## 2026-08-25 — Distance-Aware Rotation (14429b5)

**Asked:** "One degree of rotation moves the landing point a few units when the target is close and dozens when far. Aiming at distant ships is impossible."

**Generated:** `angleDelta = (tangential * K) / max(L, L_MIN)` where L = reflected beam length from mirror to termination. K=1.8, L_MIN=15. Lerp smoothing at 20%/frame (frame-rate independent via `pow()`). Max angular speed 2.5 rad/s.

**Verified:** Full swipe moves mid-range landing ~46% of field width. Near/mid/far targets move at comparable screen speeds (16%/46%/56% per swipe).

---

## 2026-08-25 — Multi-Pointer Rotation (0afc1d7 → d748f28)

**Misstep — first implementation broke all rotation (0afc1d7):** Rewrote input.js from scratch with a `Map<pointerId, state>` architecture. Removed the entire single-finger state machine. This broke basic rotation because the new code had different gesture-threshold semantics and the craft-tap/game-over paths were missing.

**Reverted (fe23287):** Full revert to working state. Single-finger rotation confirmed working again.

**Added regression test (74b2d5b):** Headless test simulating pointer events: 7 scenarios, 11 assertions covering basic rotation, sensitivity scaling, L_MIN clamp, max speed, radial immunity, release/re-grab, frame-rate independence.

**Reimplemented correctly (d748f28):** Minimal additive approach — kept entire primary state machine untouched. Added `secondPointer` object alongside (not replacing) existing variables. Routes by `e.pointerId`. Primary pointer uses existing code paths. Secondary pointer only enters rotation mode. `setPointerCapture` per pointer. `lostpointercapture` releases only the lost pointer. Tests still pass 11/11.

**Lesson learned:** Never replace a working system wholesale. Layer new behaviour on top with explicit routing.

---

## 2026-08-25 — Art Pass (ecc0771, 409ab68, 4facaff)

**Generated:**
- Environment bands: sky strip, sea with vertical gradient (#0c1e2a → #1A4257) + scrolling wave crests (6 lines, canvas texture redrawn per frame), foam shoreline, warm stone ground. `prefers-reduced-motion` freezes animation.
- Ship sprites: 128×128 procedural canvas per type. Carved prow with ram ornament, mast + trapezoid sail, oar strokes (3-9 per type), painted stripe (colour-coded: brown/red/green/bronze/gold). Distinct silhouettes at a glance.
- Mirror sprites: 64×64 canvas. Bronze polished shield (radial gradient), wooden cart frame with wheels and spokes, centre boss. Rotates with angle.
- Fortress: 512×256 canvas. Stone rampart with block courses, 16 crenellations, 3 towers with pointed caps, peaked rooftops. 4 damage stages tied live to wall integrity (cracks → breach + rubble + smoke → fires). Breach triggers 0.3s shake + dust particles.

**Brightness rule enforced:** All backgrounds ≤6.3% luminance. Dimmest beam (amber) at 40.1%. Contrast ratio 6.4:1. Beams remain the brightest element on screen.

All procedural canvas drawing at load time — zero image files, zip size unchanged.

---

## Build System

- `node build.js` — concatenates src/ modules, strips ES import/export, wraps in HTML, validates syntax via `new Function()`.
- `node build.js --submission` — hard-errors if DEV flags are true.
- `node test_rotation.js` — headless rotation regression test (7 scenarios, 11 assertions).
- Source: 19 modules in `src/`.
- Vendor: `vendor/three.min.js` (r158, 654KB).
- Assets: `assets/archimed_intro.mp4` (1.2MB), `assets/archimed_fail.mp4` (1.55MB), `assets/intro_poster.jpg` (48KB).
- **Total zip: 2.84 MB** (limit: 35 MB).

## Deployment

- GitHub Pages: https://rustoman-ai.github.io/spectrum-zero/
- Branch: master (Pages deploys from root)
- Safe revert: `git tag submission-fallback` at 87454b9

---

## 2026-08-25 — UI & Audio Polish Pass

**Asked (from a recorded-playthrough review):** Four items: (1) shop buttons overlap when new prism/priest tiers unlock, (2) the four altar labels (BRASS/BRONZE/SILVER/GOLD) get fully covered when mirrors line up horizontally, (3) ships struck by Zeus lightning show no on-hull reaction the instant before death, (4) heavy flagship destruction and Zeus casts lack deep low-frequency bass to convey scale.

**Generated:**
- **Shop grid:** The tray already used a fixed grid (`btnW = 512/count`, `x = i*btnW`), so the reported overlap was label text bleeding past button edges, not the buttons themselves. Added a per-button clip rectangle so labels can never draw into a neighbour, and shrank fonts to 8px label / 7px cost.
- **Altar labels:** Moved the four altar name labels out of the world layer and into the overlay scene so they always render on top of mirrors. Added a dark outline + alphaTest for legibility against the sea, on a larger 96×24 canvas.
- **Zeus hull reaction:** During the 0.25s charring stage the hull now flickers electric white-blue and emits blue-white sparks (0x88ccff) around the ship; a bright electric burst (0xaaddff) fires at the moment the deferred heat is applied. `enemy.js` imports `spawnSparks`/`spawnContactGlow` from `effects.js` — these are `export function` declarations, hoisted in the concatenated IIFE, and `effects.js` does not import `enemy.js`, so there is no circular dependency.
- **Deep bass:** `spawnDestruction(x, y, heavy)` now takes a `heavy` flag. For `flagship` and `quadrireme` kills, the flash grows (160 vs 100), the wood-crack burst lengthens/loudens, and a sub-bass sine drops 40Hz→22Hz over ~0.45s. Zeus `playThunderCrack` gains a dedicated sub-bass sine dropping 45Hz→20Hz over ~0.9s on top of the existing filtered rumble tail.

**Note on the shop "overlap":** The first read of the code showed the grid was already correct. Rather than rewrite the layout, the fix targeted the actual visible symptom (label bleed), which is the smaller and safer change.

**Verified:** `node build.js` → 179.3 KB, exit 0 (its strict-mode lint confirms the new cross-module refs resolve). `node test_rotation.js` 11/11, `node test_smoke.js` 29/29. Audio changes are synthesis-only and not covered by the headless tests; they were reasoned about by frequency/gain, not heard in this environment.

---

## 2026-08-25 — Restart State Leak Fix

**Asked:** After tapping "Try Again", lots of state carried over from the previous run — most visibly an extra (purchased) mirror stayed on the field, and the mirror selection ring stayed lit.

**Root cause:** `resetSession()` only reset a subset of subsystems, and several reset functions were incomplete:
- `resetMirrors()` looped over the *current* `mirrors` array (which had grown when the player bought mirrors) and indexed `DEFAULT_MIRROR_SOCKETS` by position. Bought mirrors landed on undefined sockets and their meshes were never removed — they stayed in the scene.
- `resetCrafting()` reset the purchase counters but not `zeusCooldown` / `poseidonCooldown`, so restarting mid-cooldown left the god buttons greyed out.
- `resetSession()` never called effect, audio, Zeus, Poseidon, or input resets at all. Leftover sparks/debris, the hum drone, an active whirlpool (plus its wind flag on enemies), in-flight lightning bolts, and the input selection highlight ring could all survive a restart.

**Generated:**
- Rewrote `resetMirrors()` to fully tear down every mirror mesh (dispose geometry/material/texture, remove from group), clear all socket occupancy, then rebuild exactly `MIRROR_COUNT_START` starting mirrors — the same construction `initMirrors` uses. Nothing purchased can survive.
- `resetCrafting()` now zeroes `zeusCooldown` and `poseidonCooldown`.
- Added `resetZeus()` (clears bolts + disposes their meshes, flash, shake, ready flag), `resetPoseidon()` (stops whirlpool, hides hint, `setWindActive(false)`), and `resetInput()` (deselect, clear drag + both pointer trackers, hide highlight/drop rings).
- Wired `resetEffects`, `resetAudio`, `resetZeus`, `resetPoseidon`, and `resetInput` into `resetSession()`, each in its own try/catch so one failure can't abort the chain or leave the overlay stuck.

**Verified:** `node build.js` → 181.5 KB, exit 0 (strict-mode lint confirms the five new cross-module reset refs resolve). `test_rotation.js` 11/11, `test_smoke.js` 29/29. The restart behaviour itself is not covered by the headless tests — it was fixed by tracing which module-level state each subsystem owns and ensuring every owner has a reset that `resetSession` calls. Worth one manual restart-after-purchase check on-device to confirm the extra mirror and selection ring are both gone.

---

## 2026-08-25 — Shop Tier Locking, Helios Replaces Priest, Contact FX, Audio Cutoff

**Asked:** (1) Owned prism tiers must never be repurchasable — replace the button in place with the next tier, and keep the shop grid from overlapping on dynamic updates. (2) Remove the passive Priest and add an active god, Helios (Solar Overcharge): a 5s full-screen solar flare that generates +15 Faith over its duration, stuns every ship for 4s, and disables Shield-Bearer plates so beams pass through; warm bloom overlay + rising solar hum/chime; cost in Silver/Bronze. (3) Add an intense spark/glow at the exact laser-hull/shield contact point. (4) When the wall falls, immediately cut all battle audio loops, leaving only the defeat sound.

**Generated:**
- **Shop tier locking:** The shop item list is now rebuilt every frame by `buildShopItems()`. A `PRISM_UPGRADES` map keyed by the current prism tier yields only the *next* buyable tier (tier 3 shows 4-Prism, 4 shows 5-Prism, 5 shows 6-Prism), and at tier 6 the prism slot disappears entirely. `attemptPurchase` also hard-guards `getActiveTier() >= item.tier` so an owned tier can never be bought even via a stray tap. The tray is a canvas texture, not DOM, so the "flex/gap/overflow:hidden" intent is met by the existing fixed-width grid (`btnW = 512/count`) plus the per-button clip rect — buttons are drawn in disjoint `i*btnW` cells and clipped, so they cannot overlap regardless of how the count changes.
- **Priest removed:** Dropped from `SHOP`, and `foundry.js` no longer accrues Faith passively (`priestCount`/`addPriest`/`getPriestCount` deleted). Faith now comes only from Helios; `gainFaith(amount)` added to `foundry.js`.
- **Helios (`src/helios.js`, new module):** On cast — sets a 5s flare, stuns all active ships via `e.stunTimer = 4` (reuses the existing Zeus stun path that halts descent), drips exactly `faithGain/duration` Faith per second (verified to sum to 15 over 5s), and flips a shield-disable flag. `damage.js` skips the Shield-Bearer block branch while `isShieldDisabled()` is true, so beams deal full direct damage through the plates. Visual: an additive warm (0xffdd88) full-screen plane in the overlay scene, opacity driven by a rise/hold/fade curve with a subtle shimmer. Audio: a bright two-sine chime plus a sawtooth "solar hum" swept 180→420 Hz through an opening lowpass across the flare. 12s cooldown with the same radial-wipe UI as Zeus/Poseidon.
- **Contact FX:** Added `segmentBoxEntry()` to `damage.js` — the parametric entry point where a beam segment crosses the enemy hitbox. Contact glow/sparks (and shield-deflection sparks) now spawn at that exact point instead of the ship centre, with a white-hot core glow every frame plus throttled coloured sparks.
- **Audio cutoff:** `audio.js` gains `silenceBattleAudio()` (beam hum, burn hiss, altar tone, and all wood-crackle voices → 0/stopped); `resetAudio()` now delegates to it. `session.js` `onEndState()` calls it, so the instant the wall hits 0% every loop goes quiet and only the defeat sound/gong remains. Since the main loop early-returns once `isGameOver()` is true, the per-frame audio updaters never re-raise the gains.

**Missteps (caught by the build lint, not shipped):** `src/helios.js` is concatenated into the same IIFE as the other modules, so its module-level names share one scope. The first build failed with "Identifier 'active' has already been declared" — Poseidon already owns a module-level `let active`. A second latent collision was a non-exported `getACtx()` duplicated in `zeus.js`. Fixed by prefixing all Helios module state (`heliosActive`, `heliosTimer`, `heliosFaithRemaining`, `heliosACtx`, `heliosHumOsc`, `heliosHumGain`) and renaming the audio helper to `getHeliosCtx()`. This is exactly the class of bug the strict-mode VM lint in `build.js` exists to catch, and it did.

**Verified:** `node build.js` → 192.1 KB, exit 0. `test_rotation.js` 11/11, `test_smoke.js` 29/29. An honest note on the smoke test: its "Shop purchases" and "Shield-bearer deflection" cases use a *local* mock `SHOP` (which still lists the old priest) and mock enemies — they exercise the resource-math and angle primitives, not the new shop wiring or Helios. To cover the actual new logic I ran a separate headless check (6/6): tier-locking removes owned prism tiers and shows none at tier 6, and Helios grants exactly 15 Faith over 5s. The visual bloom, the on-hull contact spark position, and the audio (solar hum, defeat-time cutoff) were reasoned about but not seen/heard in this environment — worth a manual on-device pass.

---

## 2026-08-25 — Contact Flash Too Big (regression from previous FX change)

**Asked:** The white contact flash is way too massive — clamp it to at most ~1.2x the target ship size, keep it decaying smoothly within 0.15s, and stop it compounding in scale when multiple beam ticks land.

**Root cause (my own regression):** In the previous "contact-point FX" change I spawned a glow *every frame* at `raw * 1.5` DPS. `spawnContactGlow` scaled the sprite by `0.5 + min(dps/50, 2)` on a 3x3-unit base plane, so any real hit maxed the scale (7.5-unit glow), and `updateEffects` then grew it another 50% as it decayed. Spawning every frame kept one pool slot pinned at peak opacity — a constant swelling blob over the centre beam.

**Fixed:**
- Base glow plane shrunk 3x3 -> 1.5x1.5 units.
- Scale formula changed to `min(2.6, 1 + dps/120)` — a hard cap. Peak rendered size = 1.5 * 2.6 = 3.9u (~1.2x a mid 3.5u ship); the everyday contact spark (dps 40) renders at 2.0u, smaller than every ship type.
- Removed the decay-time scale growth in `updateEffects`; scale is now set once at spawn and held, so repeated ticks can't compound it. Opacity fades linearly to 0 over the fixed 0.15s life (`GLOW_LIFE`).
- `damage.js` no longer spawns a glow every frame — the contact glow/sparks are throttled (~18/s) with a modest fixed DPS, so it reads as a lively spark rather than a persistent flash.

**Verified:** `node build.js` -> 192.7 KB, exit 0. Rotation 11/11, smoke 29/29. Scale math checked numerically: contact spark = 2.0u (0.25x-0.8x ship size across all types), absolute max glow = 3.9u (1.0-1.2x a mid ship) even for destruction/huge DPS. Not yet eyeballed on-device.

---

## 2026-08-25 — God Cost Rebalance + Per-Currency Cost Readability

**Asked:** (1) Kill the escalating repeat-cast costs so abilities can be cycled during a run — Helios flat 15 Si + 20 Bz; Zeus #1 = 25 Brass, #2+ = 15 Faith + 5 Gold (constant); Poseidon #1 = 40 Brass, #2+ = 20 Faith + 8 Gold (constant). (2) When a cooldown ends, the button must immediately show the real cost and affordability; and any currency the player is short on should render in red so it's obvious why the button isn't lighting up.

**Generated:**
- **Costs:** `GOD_ABILITIES` now uses the `[first, repeat]` pattern. The shop already indexes `costs[min(castCount, costs.length-1)]`, so a 2-entry array gives "first cast one price, every later cast a flat repeat", and Helios' single-entry array is always flat. Zeus [25 Brass, then 15Fa+5Au], Poseidon [40 Brass, then 20Fa+8Au], Helios [15Si+20Bz]. No more 40/100/180 escalation.
- **Cooldown → live button state:** `updateCraftingTray` already redraws every frame, so cost/affordability recompute continuously; the button updates on the first frame after a cooldown reaches 0. Added an explicit `onCooldown` check folded into the button's `affordable` visual, so a god power on cooldown no longer renders as "ready" (blue/pulsing) even when the player can afford it — it stays dimmed and visibly lights up the instant the timer ends.
- **Per-currency red text:** Replaced the single `costStr` line with `drawCostTokens`, which draws each currency token separately, centred, and colours each one individually — light grey if the player has enough of that currency, red (`#ff5555`) if short. This is driven by the actual `res`/`faith` balances (independent of cooldown), so during a cooldown a player with enough resources still sees green tokens ("you can afford it, just wait"), while a missing currency always shows red.

**Verified:** `node build.js` -> 194.3 KB, exit 0. Rotation 11/11, smoke 29/29. Cost indexing checked numerically (9/9): every god's repeat cast is constant at the specified price across casts #2 through #8. The red-token rendering and the cooldown-dimming were reasoned about from the draw code but not eyeballed — worth a quick on-device look (cast a god, watch the button grey during cooldown then light up, and check a short currency shows red).

---

## 2026-08-25 — Mirror Spawn Spread, Helios Cooldown 7s, Altar Label Depth

**Asked:** (1) A purchased Mirror must not spawn on the occupied default-left coordinate — assign an unoccupied, cleanly offset slot so mirrors never stack. (2) Helios cooldown 12s -> 7s so a run can fit 2-3 solar stuns. (3) Altar names (BRASS/BRONZE/SILVER/GOLD) must stay visible when all mirrors are deployed — top layer or below the mirror bounds.

**Generated:**
- **Mirror spawn:** `addMirror` now places each new mirror at the *emptiest* spot found by scanning a 13-column x 2-row grid and choosing the candidate whose nearest existing mirror is furthest away. It never reuses an occupied coordinate. New mirrors prefer the lower row (y=-29, whose 12-unit sprite still stays inside the field, spanning -35..-23) and the width extremes. Verified numerically: the first four buys land at x=-7.4/7.4/-22.1/22.1 on the offset row, ~8.7-8.9u from the nearest neighbour, and the default-left (x=-15,y=-25) is never reused. Honest limit: the mirror field is only 20 units tall (-15..-35) and sprites are 12 wide, so at high mirror counts some edge proximity is physically unavoidable — but the placement always maximises separation and never exact-stacks, which was the actual bug.
- **Helios cooldown:** `HELIOS_COOLDOWN_TIME` 12 -> 7.
- **Altar labels:** Labels already lived in the overlay scene (which renders in a second pass on top of the main scene), so they were on the top layer. To make it bulletproof I also pinned them just below the mirror movement zone (`MIRROR_FIELD_BOT - 1.5 = -36.5`) at z=10 (topmost within the overlay scene). Combined with the lower mirror row now bottoming out at exactly -35, the labels sit cleanly below every mirror sprite AND render above them regardless. `MIRROR_FIELD_BOT` imported into foundry.js.

**Verified:** `node build.js` -> 194.6 KB, exit 0. Rotation 11/11, smoke 29/29. Mirror spread checked numerically (above). The altar-label visibility and the on-screen mirror spacing were reasoned from coordinates/render order, not eyeballed — worth a quick device check with several mirrors bought and all four altars lit.

---

## 2026-08-25 — Wall HUD, Damage Feedback, Heat Grace, Shield Sparks, Helios Glare, 90s Wave Script

**Asked:** Six polish/tuning passes: (1) Wall Integrity as a prominent styled health bar with green/amber/pulsing-red states; (2) red screen flash + camera shake on wall damage; (3) heat decay 10%/s after a 0.5s grace so holding a beam is rewarding; (4) replace the floating "BLOCKED" text with metallic spark deflection + high-frequency ricochet ticks; (5) Helios = 0.4s whiteout bloom then a transparent golden glare for the rest of the stun so silhouettes stay visible; (6) a scripted 90s opening wave curve for judges.

**Generated:**
- **Wall HUD bar (`session.js` `drawWallBar`):** Replaced the plain "Wall:X%" text with a centred rounded health bar in the top HUD strip — dark track, coloured fill, border, a "WALL" label, and a centred "%". Colour states: green >50%, amber 25-50%, and a pulsing red (sine on opacity + fill brightness + additive-style shadow glow) under 25%.
- **Damage flash + camera shake:** Added a full-screen additive red plane in the overlay scene at z=15, its opacity driven by the existing `wallHitFlash` (peaks ~0.32, fades over 0.3s) in `decayWallFlash`. Added a camera-shake state (`getWallShake`/`tickWallShake`) triggered in `addBreaches`; `render()` now takes an optional offset that nudges the *main* camera and restores it after the pass (the overlay camera stays steady so the HUD/bar don't jitter). Wired the tick + `render(getWallShake())` into the main loop, and cleared the flash/shake state in `resetSession`.
- **Heat grace:** `HEAT_DECAY_RATE` 0.15 -> 0.10; new `HEAT_DECAY_GRACE = 0.5`. While a beam hits, `enemy.heatGrace` is refreshed to 0.5; once the beam leaves, the grace counts down before heat drains at 10%/s. `heatGrace` initialised on spawn.
- **Shield deflection:** Removed the floating "BLOCKED" label entirely (its texture/mesh/animation code is gone; `updateBlockedLabels` is now a harmless no-op stub so the main-loop call and import stay valid). The shield-block branch now emits a brighter metallic flash (0xfff0c0) + a 5-spark fan (0xffdd88) at the exact plate contact point, plus a new `playRicochet()` — a short high-frequency metallic tick (square 3200->2100 Hz + triangle 4700 Hz through a highpass, rate-limited to 0.08s).
- **Helios glare:** Two-stage bloom. 0..0.4s rises to a bright near-white whiteout (0xfff4d8, opacity ->0.9); after 0.4s it switches to a low-opacity golden glare (0xffcc55, opacity ~0.22 with a shimmer and a ~0.4s tail fade) so ship silhouettes remain readable through the remaining stun.
- **90s wave script (`enemy-spawner.js`):** A deterministic `OPENING_SCRIPT` of 15 timed events drives the first 90s and suppresses the procedural spawner during that window: 0-20s three spaced skiffs, 20-45s paired flank spawns (skiffs then triremes), 45-75s shield-bearer formations + triremes, 75-90s dense fast-assault waves. At 90s it hands off cleanly to the existing phase spawner (marks the shield-bearer intro done and reseeds the interval timer so there's no stale-timer burst). `scriptIndex` resets on restart.

**Verified:** `node build.js` -> 202.1 KB, exit 0. Rotation 11/11, smoke 29/29. The 90s script was simulated at 60fps (15/15 events fire exactly once, in order, at their scheduled times; phase mix confirmed: 17 skiffs, 11 triremes, 3 quadriremes, 4 shield-bearers + escorts). The visuals (wall bar colours/pulse, red flash, camera shake, Helios whiteout->glare) and the ricochet audio were reasoned from the code but not seen/heard here — worth a manual device pass, especially confirming the camera shake reads well and the golden glare leaves silhouettes visible.

---

## 2026-08-25 — Ram-Line Collision, Beam Opacity Tiers, Per-Impact Feedback, Mirror Lift, Passive Faith

**Asked:** (1) A strict ram line above the mirror row where ships stop/crash/explode, so boats never overlap or obscure the mirror discs (taps always select mirrors). (2) Beam opacity hierarchy — active beams (hitting a ship/prism/altar) at 100%, idle reflected beams at 40% with a thinner core. (3) Per-impact battlement feedback — a localized stone flash at the ship's X-lane + a quick notch flash on the wall bar. (4) Lift the mirror row ~40-50px off the bottom HUD to stop thumb mis-taps near the god buttons. (5) Passive Faith trickle of +0.5 F/s per burning ship.

**Root context:** The layout runs sun(48) -> prism(30) -> mirrors -> wall(-40), with ships descending from the top. Ships previously descended all the way to the wall at -40, which meant they passed straight *through* the mirror field (-15..-35) and sat on top of the discs — the source of the tap/overlap problem.

**Generated:**
- **Ram line (item 1):** New `RAM_LINE_Y = -6`, above the mirror zone. Ships now crash, explode (`spawnDestruction`), and damage the wall at the ram line and are deactivated there, so they never enter the mirror field. Verified geometrically: ships still traverse y=40..-6, a 46-unit window entirely above the mirrors, so upward-reflected beams still reach them.
- **Mirror lift (item 4):** Raised the whole mirror zone ~6 world units — `MIRROR_FIELD_TOP -15->-12`, `BOT -35->-30`, socket rows `-18/-25/-32 -> -12/-19/-26`, and the addMirror spread rows to `-14/-26`. The gap between the lowest mirror sprite and the top of the shop tray nearly doubled (6.5u -> 12.5u); 6 world units is ~47px on a portrait phone, in the requested 40-50px range.
- **Beam opacity tiers (item 2):** Each beam segment carries `activeSeed` (set in the solver: the raw sun column and any segment terminating on the prism) and a per-frame `active` flag. `damage.js` resets `active` to `activeSeed` each frame then sets it true on any segment contacting a hull; `foundry.js` sets it true on any segment feeding an altar. `beam-render.js` renders active segments at 100% opacity / full width and idle ones at 40% / 0.6x core width. (Beams rebuild one frame before damage/foundry run, so the flag is one frame stale — imperceptible for opacity.)
- **Per-impact feedback (item 3):** `enemy.js` records `getLastBreaches()` = `[{x, lane}]` for the frame. `fortress.triggerImpactFlash(x)` spawns a localized additive stone-pulse quad at that X on the battlement (0.35s, fades + grows). `session.flashWallBarNotch()` pulses a bright notch across the wall bar (decayed in `decayWallFlash`, reset on restart). The main loop fires both for each breach.
- **Passive Faith (item 5):** `foundry.updateFoundries` now adds `faith += burning * 0.5 * dt`, where `burning` counts active ships with `heat > 0` that aren't shield-blocked. Helios still grants its burst on top. (foundry now imports `getEnemyPool`; enemy already imports `addKillReward` from foundry — a mutual import, but both are hoisted `export function`s in the concatenated IIFE, and the build's strict lint confirmed it resolves.)

**Verified:** `node build.js` -> 206.6 KB, exit 0. Rotation 11/11, smoke 29/29. Layout gaps checked numerically (mirror lift 6u ~47px; ram line clears field top by 6u; tray gap 6.5u -> 12.5u). Not eyeballed on device — worth confirming ships visibly crash above the mirrors, the active/idle beam contrast reads well, and the per-lane battlement flash lines up with the crash column.

---

## 2026-08-25 — RC Polish: Strict Ram-Line, Focused Prism Rays, Beam Clarity, Poseidon Ripple, Gold Label, Reddish Battlement Flash

**Asked:** (1) Ram line exactly ~25px above the mirror disc top edge; ships stop, breach, and explode there with zero pixel overlap with the discs. (2) At 5/6-prism, replace the fanned side bands with focused higher-intensity wider rays instead of overlapping additive noodles. (3) Inactive beams at 30% opacity + thinner stroke; active beams at 100% with an intense core glow. (4) Remove Poseidon's "Tap the water" text and replace it with a finger-following water ripple. (5) Show the GOLD altar label only once that altar is owned/receiving light. (6) Reddish-orange localized battlement flash below the crash lane.

**Generated:**
- **Ram line (item 1):** Made the stop line derive from the mirror geometry. The topmost mirror sprite's top edge is at y=-6; `RAM_CLEARANCE = 4` (~31px on a portrait phone, in the ~25px ballpark) gives `RAM_STOP_EDGE = -2`. A ship crashes when its *leading (bottom) edge* (`e.y - shipHalfHeight(type)`) reaches the stop edge, then snaps to that exact position and explodes. Using per-ship half-height (shared `SHIP_SIZE` table) means every size — skiff through flagship — stops with its hull bottom 4u above the disc top, so nothing ever shares pixels with a disc. Verified numerically for all five types (worst-case gap 4.0u).
- **Prism focus (item 2):** `generateBandAngles` now tightens the angular spread at high tiers (x0.65 at tier 5, x0.5 at tier 6) so the extra bands stay near-parallel and read as a few focused rays rather than a wide spray, and tags them `wide`. The `wide` flag threads through `traceBeam` (and its mirror-reflection recursion) onto the segment; `beam-render` draws wide segments with a 1.6x fatter core. (Band intensity is already capped at 1.0, so "higher intensity" is expressed as the fatter/brighter core + the tighter focus, not an out-of-range intensity value.)
- **Beam clarity (item 3):** Idle beams dropped from 40% -> 30% opacity with a thinner 0.55x core; active beams stay at 100% and now get a 1.5x glow-width boost (idle glow cut to 0.35x) for an intense core.
- **Poseidon ripple (item 4):** Deleted the "Tap the water" text mesh. Added an additive blue ring (`rippleMesh`) that breathes (scale + opacity pulse) and slowly rotates, following the finger: `input.js` calls the new `setPoseidonTarget(x,y)` on pointerdown and pointermove while placement is pending, and the whirlpool drops at the release point.
- **Gold label (item 5):** There is no altar "purchase" in this game, so the closest correct behavior: the GOLD label starts hidden and is revealed the first time the gold altar is lit (`lit || everLit`), then re-hidden on restart. Label mesh stored on the altar object.
- **Battlement flash (item 6):** Retuned the per-lane impact flash from amber (0xffb347) to reddish-orange (0xff5522), slightly larger (8x6) and brighter (0.9), fired at the crash lane's X on the battlement — matching the wall-bar health drop.

**Verified:** `node build.js` -> 209.8 KB, exit 0. Rotation 11/11, smoke 29/29. Ram-line clearance checked numerically (every ship stops 4u above the disc top; zero overlap). The visuals — focused high-tier rays, the 30%/100% beam contrast, the Poseidon ripple tracking the finger, the gold label reveal, and the reddish battlement flash — were reasoned from the code but not viewed on device; worth a manual pass, especially confirming the ripple follows touch smoothly and 6-prism no longer looks like noodle soup.

---

## 2026-08-25 — Breach Guard + Flank-Leak Clamp

**Asked:** (1) When an enemy reaches the ram line it must deal wall damage exactly once and despawn with an explosion — no continuous per-frame damage. (2) Ships on the far edges must never slip past without a visible explosion; an edge/off-screen breach must still flash the correct battlement lane.

**Investigated first:** Traced the existing breach path. `updateEnemies` already skipped inactive enemies (`if (!e.active) continue`), and the crash block called `deactivateEnemy(e)` + `continue`, so a normal breach charged once. I could not reproduce a literal double-charge in the code as written. The most plausible real-world "phantom damage" the report describes is a breach whose explosion/flash rendered *off-screen* — the wall bar drops with no visible cause — which happens when a ship is drifting (sailed sway) or pulled far off its lane by Poseidon. I fixed both the true-safety concern and the visibility concern.

**Generated:**
- **Exactly-once guard (item 1):** Added a per-enemy `breached` flag (reset on spawn). The crash block only fires when `leadingEdge <= RAM_STOP_EDGE && !e.breached`, sets `breached = true`, charges the wall once, explodes, and deactivates. This makes a second charge impossible even if some future path briefly left the enemy active. Verified by simulation: a ship descending (with a mid-descent stun) charges exactly once; and a deliberately-kept-active enemy at the line still charges only once (guard holds).
- **Flank-leak clamp (item 2):** The crash X (`lane centre + driftX + pullX`) is now clamped to the visible battlement (`±(ww/2 - 2)`), so edge-lane ships and Poseidon-pulled ships always explode on-screen and the per-lane `triggerImpactFlash(cx)` reddish stone flash always lands on the fortress. Verified: a ship pulled 40u off-lane still resolves its explosion/flash at x=±26.1 (inside the ±28.1 half-width).

**Verified:** `node build.js` -> 210.4 KB, exit 0. Rotation 11/11, smoke 29/29. Breach-once and edge-clamp checked numerically (charge count = 1 in both the normal and guard-only cases; clamped X stays on-screen for extreme pull). Not eyeballed on device — worth confirming an edge/pulled ship visibly explodes at the wall.

---

## 2026-08-25 — Submission Lock: Strict Bounds, Breach Drip, In-Engine Defeat, Beam Clarity

**Asked:** (1) Enforce ship top/bottom bounds — never over the top crystal; stop exactly one hull-height above the mirror discs; no shared pixels either end. (2) Rework breach from instant chunks to a per-second contact drip (5-8% wall HP/s per ship). (3) Continuously flash the battlement stone under a breaching lane while it deals contact damage. (4) Fully in-engine defeat — remove the defeat video; on 0% wall extinguish beams, dim the board dark red, throw stone debris, and fade in the "SYRACUSE HAS FALLEN" stats with a full-screen tap-to-restart. (5) 5-prism beam clarity: active 100%, idle 25-30%.

**Generated:**
- **Bounds (item 1):** `SHIP_TOP_BOUND = 44` (crystal at 48); spawn Y is clamped so a ship's top edge never crosses 44 (4u gap). The crash stop line is now `MIRROR_DISC_TOP (-6) + one full hull-height`, so each ship's bottom edge halts a full hull-height above the disc top (verified gaps: 2.5u skiff -> 8u flagship, all > 0 = no disc overlap).
- **Breach drip (items 2-3):** Ships no longer despawn on contact — they pin at the wall (`atWall`) and drain `WALL_MAX_HP * BREACH_DRIP_PCT[type] * max(0.2, 1-heatFrac) * dt` each frame (skiff 5%/s ... flagship 8%/s; shield-bearer 0). A single skiff fells a full wall in 20s, three in ~6.7s — reactable pressure, and burning/killing a ship cuts or stops its drip. Each contacting ship emits a per-frame contact event; `triggerImpactFlash` now *refreshes* a nearby existing flash (sustained reddish-orange throb under the lane) instead of spawning a new mesh every frame. In the main loop the drip damage is applied silently while the heavy feedback (camera shake, wall-hit sound, bar notch) is throttled to every 0.5s so the continuous contact doesn't shake the screen every frame.
- **In-engine defeat (item 4):** Removed the defeat video entirely — deleted the `#defeat-layer` DOM and the defeat-video IIFE from the HTML template; `window.playDefeatCinematic` is now a no-op stub (degrades gracefully if ever called). `triggerLose` runs `startDefeatSequence`: the board dim is recoloured dark red (0x330505) and fades in to 0.88 over ~0.8s, a one-time stone-debris burst fires, and the stats overlay (drawn via the new shared `drawOverlayText`) fades in after a 0.5s beat over 0.7s. The main game-over branch keeps effects + fortress ticking so debris animates, and renders with the wall shake. The existing full-screen tap-to-restart still applies. Deleted the now-unused `assets/archimed_fail.mp4` (1.51 MB) from the repo/zip.
- **Beam clarity (item 5):** Already at the target from the prior pass — idle beams render at 0.3 (30%) with a thinner core, active at 1.0 with an intense glow; this applies at tier 5 (and all tiers). No change needed; verified in code.

**Verified:** `node build.js` -> 212.6 KB, exit 0. Rotation 11/11, smoke 29/29. Bounds and drip timing checked numerically (top gap 4u for all types; bottom gap = one hull-height; drip 20s/6.7s). The in-engine defeat fade, the sustained contact flash, and the removal of the defeat video were reasoned from code + verified by build; not viewed on device — worth confirming the defeat screen reads well (dark-red dim -> debris -> stats) and that a persistent ship pressed on the wall shows a steady stone flash matching the bar drop.

**Note:** This supersedes the previous session's "instant breach, despawn once" model — breach is now a sustained drip per the new spec. Ships persist at the wall until killed, which changes the late-game feel (a wall of pinned ships is possible under heavy assault); flagged in case that pressure needs balancing.

---

## 2026-08-25 — RC Locks: Shop Text Fix, Bounds/Drip/Beam Confirmation

**Asked:** (1) Fix the Helios cost rendering as glitched "1551 2082" — format as a clean single line like "15 Si + 20 Bz". (2) Strict ship Y-bounds (no crystal overlap; stop one hull-height above discs). (3) Wall damage as a smooth 5-7%/s bleed with a red danger flash + localized cracked-stone pulse. (4) 5-prism beam clarity: active 100%, idle 25%.

**Root cause of the "1551 2082" glitch:** The shop tray canvas was 512x40 with **no DPR/resolution scaling**, then stretched over a tall tray plane on the phone. At that upscale the 7px cost text blurred so badly that "15 Si  20 Bz" smeared into unreadable digit-like blobs ("1551 2082"). It was a rendering-resolution problem, not a data problem — the numbers were always correct.

**Generated:**
- **Shop text (item 1):** Backing canvas bumped to 1024x80 with `ctx.scale(2,2)` so all existing 512x40 logical draw coords stay the same but render at 2x resolution (crisp text). Reformatted `drawCostTokens` to a clean single line with a neutral " + " separator and a space between amount and label — "15 Si + 20 Bz" — with each currency still individually coloured (grey if affordable, red if short). Verified every god cost string: helios "15 Si + 20 Bz", zeus "25 Br" / "15 Fa + 5 Au", poseidon "40 Br" / "20 Fa + 8 Au".
- **Bounds (item 2):** Confirmed already enforced from the prior pass — `SHIP_TOP_BOUND = 44` clamps spawn so no hull crosses toward the crystal (48), and the crash stop line is disc-top + one full hull-height. No change needed; verified the code is present.
- **Drip (item 3):** Already a continuous per-frame bleed (`WALL_MAX_HP * pct * dt`), not per-frame chunks. Tightened the rates into the requested 5-7% band (quadrireme 7%->6.5%, flagship 8%->7%). The full-screen red danger flash (topped up each drip frame) and the sustained localized battlement stone pulse (refreshed per contact frame) were already in place.
- **Beam clarity (item 4):** Idle opacity tightened 0.30 -> 0.25 (25%) with a slightly thinner core (0.5x); active stays 1.0 with full glow. Applies at tier 5 and all tiers.

**Verified:** `node build.js` -> 213.1 KB, exit 0. Rotation 11/11, smoke 29/29. Cost strings checked by simulation (clean, no run-together). The on-screen crispness of the 2x tray text and the 25% idle beam contrast were reasoned/verified in code but not viewed on device — worth a glance to confirm the Helios cost now reads cleanly.

---

## 2026-08-25 — Ram-Line to Battlement, Shake -70%, Beam-Centre Anchoring, Greek Nautical Audio, Shop Text Fit

**Asked:** (1) Move the ram line down so ships only breach when the hull touches the top of the stone battlement — never mid-water; cut screen shake ~70% (subtle thuds only for wall impact + critical <25%). (2) Anchor incident + reflected beams strictly to the mirror centre at all angles. (3) Audio overhaul to an Ancient Greek nautical soundscape (remove sci-fi drones/booms). (4) Fix shop cost string stacking ("20 Fa 75 8 Au").

**Generated:**
- **Ram line -> battlement (item 1):** Reverses the earlier "stop above the mirrors" model per the new spec. `BATTLEMENT_TOP_Y = WALL_Y + 1 = -39`; ships descend fully and breach only when their hull's leading (bottom) edge touches that line, then pin there and drip. The breach line sits 9u BELOW the mirror field bottom, so wall damage is always at the shoreline, never in open water mid-screen.
- **Screen shake -70% (item 1 cont.):** Camera-shake intensity 1.6 -> 0.48 (exactly 70% cut), rising to 0.9 only when the wall is critical (<25%). Fortress mesh shake scaled x0.3. Shake still fires only on throttled wall impacts, so normal ticks no longer jolt.
- **Beam-centre anchoring (item 2):** `castRay` now returns the mirror's centre (midpoint of p1/p2 = the gold disc centre) alongside the hit point. In `traceBeam`, the visible segment END and the reflected ray ORIGIN both snap to that centre, so incident and reflected rays always meet at the disc middle at any rotation angle, never detaching at the rim. Rotation regression test still 11/11 (reflection direction math unchanged; only the anchor point moved).
- **Audio overhaul (items 3-4):** Removed the sci-fi character. Beam "hum" softened from a 55Hz sawtooth drone to a quiet warm 160Hz triangle. Added a Mediterranean ambient bed: a low-passed noise "sea breeze" loop + a rhythmic band-passed "wave wash" swell fired every 3-5s (`updateSeaAmbience`, wired into the main loop, faded on game-over, restored on restart). Wall impact is now a wooden hull crunch (bandpassed noise burst) + a hollow war-drum/tympanon thud (sine 140->66Hz through a resonant bandpass body). Shield deflection is a bright bronze clang (inharmonic bell partials + strike transient). Helios plays a resonant temple chime + horn swell (`playHeliosHorn`), Zeus a natural thunderclap (sharp filtered-noise crack + rolling low-passed rumble, `playZeusThunder`) — both on the shared audio bus so they respect mute. `helios.js`/`zeus.js` now call these instead of their old inline synths.
- **Shop text fit (item 6):** Rewrote `drawCostTokens` to auto-shrink the font (9 -> 6px) until the whole cost line fits within the button width, and dropped the " + " separator (whose "+" glyph blurred into stray digits like "75") in favour of a plain gap between colour-coded tokens. Combined with the per-frame canvas clear and the 2x backing resolution, costs render as one clean line ("15Si 20Bz") with no overflow or leftover fragments.

**Verified:** `node build.js` -> 220.6 KB, exit 0. Rotation 11/11, smoke 29/29. Ram-line and shake numbers checked (breach line -39, 9u below mirrors; shake cut 70%). The audio (sea bed, wooden/drum wall hit, bronze clang, temple horn, thunderclap), the beam-centre anchoring, and the shop-text crispness were reasoned/verified in code but not heard/seen on device — worth a playtest pass, especially confirming the new audio reads as "Greek nautical" and that beams visibly meet at the disc centres.

**Note:** This reverts the prior "ships stop above the mirror discs" decision. Ships now pass through the mirror field to reach the battlement, so a hull can visually overlap a disc that's placed in an active lane. That's the explicit trade the new spec chose (breach must read at the wall); flagged in case the overlap needs revisiting.

---

## 2026-08-25 — Procedural Greek Acoustic Audio (precise synthesis specs)

**Asked:** Overhaul audio.js to replace synth-y sounds with procedural Mediterranean/Ancient-Greek acoustic instruments, to specific recipes: (1) sea ambience = continuous filtered pink noise with gain modulated by a 0.1Hz LFO; (2) wall breach = tympanon war drum, exponential pitch drop 120->45Hz over 0.2s + lowpass; (3) shield deflection = bronze plate, inharmonic sine cluster at 420/680/1150Hz; (4) ship burn = organic timber crackle via short noise-burst pulses (no square waves); (5) Helios/Priest = resonant temple bell with decaying harmonic overtones; (6) Zeus = deep acoustic thunder via a modulated low-frequency noise sweep.

**Generated (all in `src/audio.js`, refining the prior pass to the exact specs):**
- **Sea (item 1):** Replaced the timer-fired discrete wave-washes with a *continuous* bed of true pink noise (Paul Kellet's economical filter, 4s loop) through a 900Hz lowpass into `breezeGain` (0.05). A 0.1Hz sine LFO (one full swell every 10s) drives `waveLfoGain` (±0.035) summed into `breezeGain.gain`, so the ocean rhythmically washes in and out. `updateSeaAmbience` is now a no-op (fully LFO-driven). Silence zeros the LFO depth first (so it can't push the level back up) then the base; reset restores both.
- **Wall breach / Tympanon (item 2):** `playWallHit` is a sine at 120Hz dropping exponentially to 45Hz over 0.2s through a lowpass (320->120Hz) for a warm hollow membrane, with a short wooden-crunch noise burst layered on top for the hull hit.
- **Shield / bronze plate (item 3):** `playRicochet` is three inharmonic sines at exactly 420 / 680 / 1150 Hz (decays 0.35 / 0.28 / 0.20s) plus a brief metallic strike transient, with a tiny per-strike detune so repeats aren't mechanical.
- **Burn / timber (item 4):** The continuous burn hiss moved from a thin 3kHz highpass to a woody 1.2kHz bandpass (Q 0.6). The organic pops are carried by the existing per-ship crackle pulse system (short band-passed noise bursts) — no square waves anywhere.
- **Helios temple bell (item 5):** `playHeliosHorn` is now a struck bell: a 392Hz fundamental with a harmonic overtone stack (1x-6x), each higher partial quieter and faster-decaying (3.2s down to 0.8s), plus a soft mallet transient — a warm, sacred ring-out.
- **Zeus thunder (item 6):** `playZeusThunder` is a short crack transient seating the strike, then a long low-passed noise bed sweeping 320->55Hz, whose gain is modulated by a tremolo LFO (5.5Hz slowing to 2.5Hz, depth fading) so the rumble "rolls" and recedes like natural thunder.

**Verified:** `node build.js` -> 221.9 KB, exit 0 (the strict-mode lint confirms the new synthesis code is valid and all refs resolve). Rotation 11/11, smoke 29/29. The LFO->AudioParam connections (sea swell, Zeus tremolo) are standard WebAudio (the oscillator sums into the param's value).

**Honest caveat:** Audio cannot be heard in this environment — every sound here was designed by synthesis recipe and frequency, not auditioned. This is the one area I can't self-verify. A device playtest is needed to confirm the sea reads as gentle surf, the tympanon/bronze/bell/thunder land as intended, and levels sit right against the master gain (0.5). If anything is too loud/quiet or off-character, the per-sound gains and decay times are simple to tune.

---

## 2026-08-25 — Visual Polish: Water, Beams, Mirror Glint, Charring, Smoke & Embers

**Asked:** (1) Animated UV-scroll ripple on the water + a foam line where water meets the battlement + trailing wake behind ships. (2) Beams with additive blending and radial edge falloff so they read as luminous sunbeams, not flat lines. (3) Dynamic specular highlights on the brass mirror discs that shift with rotation. (4) Ship hulls darkening toward charred charcoal as Heat fills, with an emissive orange edge glow before ignition. (5) Replace square hit particles with drifting smoke puffs and rising embers.

**Generated:**
- **Water ripple (item 1, `background.js`):** The sea previously redrew its canvas every frame. Now the wave crests are baked into the texture once, the texture is set to `RepeatWrapping`, and the ripple is a cheap UV scroll — `offset.y` advances continuously with a small `offset.x` sway for shimmer. No per-frame canvas work.
- **Foam line + wake (item 2):** Added a soft bright-white gradient foam strip at the waterline (WALL_Y + 0.5) whose opacity breathes and bobs with a wave phase. Ships now leave a trailing wake: a new lightweight `spawnWake` (small, short, pale foam-blue puffs drawn from the shared smoke pool, bumped 20→32 slots) is emitted behind each moving hull, throttled per-ship (~0.22-0.34s).
- **Beam falloff (item 3, `beam-render.js`):** Beam quads (already additive) now carry a cross-beam gradient texture — transparent at the top/bottom edges, bright down the centre line — so they read as luminous concentrated sunbeams with soft edges instead of flat bars. Length axis stays uniform so the beam is continuous end-to-end.
- **Mirror glint (item 4, `mirror.js`):** Each disc gets an additive radial highlight sprite. `updateMirrorGeometry` (and the tween) slide it along the disc's surface normal and set its brightness to `0.2 + 0.65 * max(0, normal.y)`, so the glint travels across the face as you rotate and flares brightest when the polished face tilts up toward a virtual sun. `resetMirrors` disposes it.
- **Charring (item 5, `enemy.js`):** The hull sprite colour now multiplies from white down toward near-black charcoal (0.12) as `burn` rises (a subtle beam-colour lick rides on top for hit feedback). A per-ship additive `emberGlow` sprite behind the hull ramps up past ~55% heat, shifting from ember-orange toward hot white-orange with a flicker as it nears ignition.
- **Smoke & embers (item 6, `effects.js`):** Added shared soft radial-gradient sprite textures. The glow pool and the former "sparks" now use a round glow sprite; sparks became rising embers (upward-biased velocity + buoyancy + air drag + flicker + shrink). Added a smoke-puff pool (soft grey, rises, grows, fades via normal blending). Destruction now emits embers + smoke alongside the flash.

**Verified:** `node build.js` -> 234.5 KB, exit 0. Rotation 11/11, smoke 29/29 (the mirror-geometry additions didn't touch the reflection math the rotation test covers).

**Honest caveat:** These are all visual changes and I can't see the rendered output in this environment — every effect was built from the Three.js APIs and reasoned about, not viewed. A device pass is needed to confirm the water ripple speed reads as gentle surf (not a conveyor), the beam falloff/glint/charring/ember intensities look right, and that the extra sprites (wake puffs, ember glows per ship, mirror highlights) don't cost too much on a phone under a heavy wave. Any of these are simple constant tweaks (scroll speed, opacities, pool sizes, emission throttles) if they need dialing.

---

## 2026-08-25 — Critical Fixes: Ghost Ships, Mirror Floor, Gold-Mirror Reflection, Shop Text Stacking

**Asked:** (1) Destroyed/dead ships must be completely removed — no lingering black hull sprites clumping on the battlement. (2) Hard-clamp mirror drag so `position.y` never drops below `BATTLEMENT_TOP_Y + 40px`. (3) Fix the rightmost (Gold) mirror so the beam connects to the disc centre and reflects, instead of shooting straight down through it. (4) Clear stale shop button sub-labels ("1551 20Bz", stacked cooldown strings).

**Generated:**
- **Ghost ships (item 1):** Root cause was the previous "drip" model — ships that reached the wall were *pinned active forever* and kept rendering, so they stacked into a permanent clump (shield-bearers, which drip 0, never left). Reworked to a crash-and-sink: on breach the ship starts a `BREACH_SINK_TIME` (0.9s) sink, bleeding its full breach damage evenly over that window while its sprite fades to transparent and settles down, then `deactivateEnemy` fully removes it. `deactivateEnemy` now also resets the ember glow, restores sprite opacity/colour to white, and clears heat/burn/breached/sinkTimer so a reused pooled hull can never show charred/faded state. Spawn restores the same. Verified by simulation: every type despawns at 0.9s and the wall damage totals match (skiff 4.5%, trireme 5.4%, flagship 6.3%, shield-bearer 0). Note: this is a fixed mesh pool, so the correct "removal" is `visible=false` + full state reset, not `scene.remove`/dispose (which would break reuse).
- **Mirror floor (item 2):** Added `MIRROR_MIN_Y = BATTLEMENT_TOP_Y + 5` (≈ -34, ~40px). `moveMirrorFree` now clamps `freeY` to `max(MIRROR_MIN_Y, min(MIRROR_FIELD_TOP, y))`, so discs stay in the water and never drop onto the brick wall or shop bar.
- **Gold-mirror reflection (item 3):** Confirmed via a context-gatherer trace that the left/center/right mirrors are geometrically and code-wise symmetric, so this was a regression from the prior "beams meet at disc centre" change: snapping the reflected ray's *origin* to `hit.center` placed it exactly ON the mirror's own segment line. When the right disc is angled toward the Gold altar (below), the reflected ray runs near-parallel to the mirror and emits straight down the disc face — "through the disc." Fix: the reflected ray still starts at the disc centre (keeping the aesthetic) but is nudged `EPS = 0.4` along the reflected direction, so it always leaves the surface and can't graze its own segment (0.4 comfortably clears the `dist > 0.1` self-hit guard). Not adding a per-mirror exclusion on purpose — that would break the intended resonance bounce-between-two-mirrors.
- **Shop text (item 4):** The "1551 20Bz"-style glitch and stacked strings came from the cost line and the cooldown "Ns" being drawn at the same y inside a button. Now `drawCostTokens` is gated on `!onCooldown`, so a god power shows *either* its cost *or* its cooldown timer, never both overlapping. (The per-frame canvas clear + 2x crisp rendering from prior passes remain.)

**Verified:** `node build.js` -> 237.2 KB, exit 0. Rotation 11/11, smoke 29/29 (the reflect-origin nudge doesn't touch the rotation math). Ghost-ship despawn + damage totals and the gold-mirror self-hit avoidance were checked numerically.

**Honest caveat:** The gold-mirror fix and the ship-sink/despawn were verified by simulation and the beam math, but I can't see the rendered result here — worth a device pass to confirm the right mirror now visibly reflects toward the Gold altar, ships clearly sink and vanish (no clump), and no cost/cooldown text overlaps in the shop.

---

## 2026-08-25 — Strict Mirror Drag Bounding Box + Out-of-Bounds Recovery

**Asked:** (1) Clamp mirror dragging to a strict rectangular box — minX/maxX by disc radius, minY = battlementTopY + radius + 10px (never below the stone wall top), maxY = prismY - 150px (never into the spawn area) — enforced in the input drag handler. (2) Sanity check: if a mirror's Y is ever below `battlementTopY + radius`, immediately reset it to its default altar slot.

**Root context:** The previous pass clamped only the *drop commit* (`moveMirrorFree`). The live drag in `input.js onPointerMove` set `mesh.position` straight from the pointer with no clamp, so a disc could visually slide off-stage / below the wall mid-drag, and any stale/out-of-bounds Y could persist.

**Generated:**
- **Shared clamp (item 1):** Added `MIRROR_RADIUS` (= MIRROR_LENGTH/2 = 5) and `clampMirrorPos(x, y)` in `mirror.js`, implementing the exact box: `minX = -hw + R`, `maxX = hw - R`, `minY = BATTLEMENT_TOP_Y + R + 10px`, `maxY = PRISM_Y - 150px` (px→world via 100/780). `input.js onPointerMove` now runs the live drag through `clampMirrorPos` (mirrors only — the prism stays unclamped/pinned), and `moveMirrorFree` uses the same helper on drop, so the disc never leaves the box even for a frame. Verified numerically: X clamps to ±23.1, minY = −32.7 (above the −34 floor), maxY = 10.8; dragging far below the wall, up into spawn, or off-stage all clamp correctly.
- **Recovery (item 2):** Each mirror now stores `defaultX/defaultY` (its socket slot, or its spread slot for a purchased mirror). New `sanitizeMirrors()` runs every frame from the main loop (after tweens): any mirror whose `freeY` is below `getMirrorFloorY()` (= BATTLEMENT_TOP_Y + radius = −34) — or NaN/undefined — is snapped back to its default slot. This is a true last-resort net; since the clamp already keeps discs above −32.7, it only fires if some other path corrupts a position.

**Verified:** `node build.js` -> 239.4 KB, exit 0. Rotation 11/11, smoke 29/29 (the clamp/recovery don't touch the rotation math). Box math and clamp behaviour at the extremes were checked numerically. Note: `MIRROR_MIN_Y` / `MIRROR_FIELD_BOT` are now unused imports in mirror.js (harmless; the strict-mode lint only flags undefined refs).

**Honest caveat:** The clamp is verified by the numbers; the on-screen drag feel (that discs stop cleanly at the water edges and never jump) wasn't observed here — worth a quick device drag-test to confirm it feels right and that a purchased mirror recovers to a sensible slot if it ever goes out of bounds.

---

## 2026-08-25 — Beam Width Locked (no contact bulge), Hit Feedback at Contact Point

**Asked:** (1) Lock primary + reflected beam width to a fixed sharp size (core ~4-6px, glow ~12px max) — the whole beam mesh must NOT thicken when it contacts a ship/prism. (2) Keep the ray slender through the hit; show feedback only at the contact point (small burn glow + rising spark/smoke).

**Root cause of the bulge:** In `beam-render.js`, beam width was multiplied by an active/idle tier (`tierWidth = isActive ? 1.0 : 0.5`) and a high-tier factor (`wideMult = 1.6`). The active flag is set the moment a beam touches a ship/prism/altar — so on contact the beam's width jumped to full (and 2x vs an idle beam), plus an extra 1.2x on the glow. That was the "bulging on contact."

**Generated:**
- **Fixed width (item 1):** Width now depends ONLY on the beam's own intensity (full band = 1, halved sub-ray = 0.5) and the gold-thinning factor — it no longer references the active flag or the high-tier `wide` flag. Both core and glow are hard-clamped to `BEAM_WIDTH` / `BEAM_GLOW_WIDTH`. The active/idle distinction now affects brightness ONLY (opacity + glow boost), never geometry. Tightened the constants to a slender profile: `BEAM_WIDTH 1.2 -> 0.7` (~5.5px) and `BEAM_GLOW_WIDTH 2.4 -> 1.5` (~12px). Verified numerically: active and idle full bands both render at core 0.7u / glow 1.5u — identical — so there is zero contact bulge.
- **Contact feedback (item 2):** Feedback already spawned at the exact beam-hull contact point (`segmentBoxEntry`) — a small clamped burn glow + rising sparks. Added a faint rising smoke wisp there too. All of it lives at the contact coordinate; the beam strip stays uniform mirror-to-target.

**Verified:** `node build.js` -> 239.8 KB, exit 0. Rotation 11/11, smoke 29/29. Width independence from the contact flag confirmed by calculation (core ≈5.5px, glow ≈11.7px on a portrait phone, matching the spec's 4-6px / 12px).

**Honest caveat:** Verified by the width math, not on screen — worth a device look to confirm beams now stay crisp and uniform when they land on a ship, and that the localized burn glow + spark/smoke at the contact point reads clearly at the new slimmer beam width.

---

## 2026-08-25 — Instant Breach Removal, Shop Text/Arc Cleanup, Calmer Damage FX

**Asked:** (1) On wall breach, deal damage once + spawn a burst, then IMMEDIATELY remove the ship — no lingering/frozen hulls at the bottom (the prior 0.9s sink still read as "stuck"). (2) Fix the Helios shop cost text overlap ("15Si 20Bz") + clean margins. (3) Stop the cooldown red arc clipping into the bottom bar. (4) Lower the damage-contact sound + light FX — it was distracting, not just alerting.

**Generated:**
- **Instant breach (item 1):** Replaced the crash-and-sink (which faded the hull over 0.9s and still looked stuck) with a single-frame breach: on reaching the battlement the ship deals its full breach damage once (same total as before — `WALL_MAX_HP * dripPct * BREACH_SINK_TIME`, so skiff 4.5% / trireme 5.4% / flagship 6.3% / shield-bearer 0), fires an explosion + smoke burst and a battlement stone flash, then `deactivateEnemy` removes it from the active array and hides/resets its mesh the *same frame*. Verified: ship is inactive the frame it breaches — nothing lingers. (Pooled meshes are hidden+reset rather than `scene.remove`/disposed, which is the correct removal for a fixed pool.)
- **Shop cost text (item 2):** `drawCostTokens` font cap lowered 9→8px and the fit margin widened (`btnW-8` → `btnW-12`), so a two-currency cost like Helios' "15Si 20Bz" always sits cleanly on one line inside the button clip with margin. (Cost is already suppressed while a button is on cooldown, so cost and timer never coexist.)
- **Cooldown arc (item 3):** The radial cooldown wipe is now clipped strictly to the button rect and its radius trimmed 18→15 (< half the button height), so it can never spill past the button into the bar below the battlement. The seconds text is centred (middle baseline) within the button.
- **Calmer damage FX (item 4):** Contact glow opacity 0.7→0.45 (spawn and fade); contact spawn throttle halved (dt*18→dt*9), glow DPS 40→18 (smaller), sparks per hit 3→1, smoke wisps dt*4→dt*2. Audio: burn hiss cap 0.06→0.03, per-ship crackle hiss `0.03+heat*0.07` → `0.015+heat*0.035`, crackle pop gain `0.08+rand*0.12` → `0.04+rand*0.06`. The hit still reads, just quieter and dimmer.

**Verified:** `node build.js` -> 239.7 KB, exit 0. Rotation 11/11, smoke 29/29. Breach damage totals + same-frame removal confirmed by simulation.

**Honest caveat:** The breach removal and damage math are verified; the shop-text/arc layout and the "calmer" FX levels are judgement calls I can't see or hear here. Worth a device pass to confirm no ship ever freezes at the wall, the Helios cost reads cleanly with no overlap, the cooldown arc stays inside its button, and the damage FX now feel supportive rather than distracting (the audio/glow constants are easy to nudge further either way).

---

## 2026-08-25 — Flatten Shield-Bearer Armour Plates (mantlet style)

**Asked:** Refactor the armoured trireme (shield-bearer) shield mesh: (1) reduce the arc/curvature depth of the layered plates by ~70% so they read as sturdy, slightly-curved Greco-Roman mantlet shields (Scutum/Aspis) mounted cleanly along the vessel; (2) make the flattened layers hug the deck/hull rather than flaring out like stacked umbrellas, keeping the bronze rim highlights for instant "armoured" recognition.

**Generated:** The shield is a canvas sprite (`enemy.js`, in the enemy mesh creation) — three stacked half-ellipse bands. Previously each band was `ellipse(..., 28, 7, 0, Math.PI, 0)` (arc depth 7) spaced 9px apart, so three domes stacked upward = the "umbrella" flare. Reworked:
- **Arc depth 7 → 2** (~71% flatter) — each plate is now a shallow top curve, not a dome.
- **Band spacing 9 → 4.5** and a lower base Y — the three plates sit tightly together, flush along the deck instead of towering up.
- Each plate is now a shallow-arc-topped band with a flat base (a mantlet profile) rather than a bare thin arc.
- Kept the **bronze rim highlight** (`#EEDD88`) stroked along each plate's top edge.
- The plate mesh was retuned to match: `PlaneGeometry(5, 2.5) → (5.4, 2.0)` and lowered `y 2.5 → 1.8` so it mounts flush along the hull.

**Verified:** `node build.js` -> 240.6 KB, exit 0. Rotation 11/11, smoke 29/29 (purely a sprite change — the shield *deflection-angle* logic is untouched, so the shield-bearer deflection test still passes). Arc reduction is 7→2 ≈ 71%, matching the ~70% target.

**Honest caveat:** This is a canvas-art change I can't view here — I reasoned the geometry from the ellipse parameters. Worth a device look to confirm the plates now read as clean flat mantlet shields hugging the deck (not stacked umbrellas) and the bronze rims still clearly signal armour.

---

## 2026-08-25 — Revert Mirror Centre-Anchor (beams were passing through discs)

**Asked (bug report):** Beams were passing straight through mirrors without reflecting. Revert the broken raycast offset logic — the primary beam MUST intersect the mirror at `mirror.position`, terminate there, and the reflected beam must originate there per the mirror's rotation. Keep the collision anchor strictly at the true point; any visual alignment belongs in the texture, never the raycast.

**Root cause:** A prior "beams meet at the disc CENTRE" change had `castRay` return a `center` (midpoint of p1/p2) that `traceBeam` used for BOTH the incident segment's visible end AND the reflected ray's origin. Anchoring the reflected ray's origin to a point that lies exactly ON the mirror segment meant that at certain rotations the reflected ray ran along/through the disc instead of bouncing out — reading as the beam passing straight through. (The user had also just reverted an additional Y-offset experiment on that same anchor.)

**Generated (fix):**
- Incident beam now terminates at the TRUE collision point (`hit.point`), not a centre-snapped coordinate.
- Reflected beam now originates at the TRUE collision point, nudged by a tiny `EPS = 0.2` along the reflected direction (a standard raytracer self-intersection epsilon — clears the `dist > 0.1` guard so the new ray leaves the surface and never re-hits its own segment).
- Removed the `center` field from the `castRay` mirror hit entirely — the collision anchor is strictly the intersection point. No offset logic remains in the raycast.
- Did NOT touch collision math for any "visual" reason; per the instruction, texture alignment (if ever needed) stays in the sprite drawing only.

**Verified:** `node build.js` -> 240.2 KB, exit 0. Rotation 11/11, smoke 29/29. Simulated the default layout (left/right flank bands correctly hit their flank mirrors; the centre band goes straight down past the *vertical* centre mirror by design — parallel, needs player rotation) and swept the right mirror through rotations toward the Gold altar: every incident hit now produces a clean reflection with NO self-re-hit / pass-through.

**Honest caveat:** Verified by the intersection/reflection simulation and the tests; not viewed on device. Worth a quick check that beams visibly stop at each mirror and bounce out at the current rotation, with no beam continuing down to the battlement through a disc.

---

## 2026-08-25 — Visual Polish Overhaul (audit + water gradient + V-wake)

**Asked:** A bundle of aesthetic upgrades: (1) mantlet-style ship shields with bronze rims, (2) V-shaped foam wake trails behind moving ships, (3) hull charring toward black + ember glow with Heat, (4) water vertical depth gradient (dark azure at spawn → bright turquoise at the battlement) + wave shimmer + foam crest, (5) soft additive beam glow, (6) charcoal-smoke + golden-ember hit particles.

**Audited first — already done from prior polish passes (left unchanged):**
- Shields (1): flat mantlet plates (shallow ARC=2, tight spacing) with bronze `#EEDD88` rims lined along the hull.
- Charring (3): hull sprite colour multiplies to ~0.12 charcoal as `burn` rises, with an additive ember glow ramping past ~55% heat toward hot white-orange.
- Beam glow (5): beam quads carry a cross-beam gradient texture (transparent edges → bright centre) with additive blending + a glow layer — soft focused-sunlight edges.
- Hit particles (6): destruction and contact spawn rising embers (soft round glow sprites, buoyant + flicker) and drifting smoke puffs; no boxy particles remain.

**Refined this pass:**
- **Water gradient (4):** `drawSeaBase` reworked to a true depth gradient — deep dark azure (`#0a1a2e`) at the top/spawn fading through teal to a bright turquoise harbour (`#1f8f8a`) at the battlement. Wave-crest shimmer recoloured to a soft turquoise (`rgba(120,200,210,...)`) so it reads against the new gradient. The breathing white foam crest at the waterline (foamLine) already existed.
- **V-shaped wake (2):** `spawnWake` now emits a symmetric PAIR of foam puffs at the stern that spread outward (`side * ±vx`) while trailing behind (upward, since ships descend), tracing the opening V of a bow/stern wave — instead of a single puff. Smoke pool bumped 32 → 48 to cover the doubled wake emission across many ships.

**Verified:** `node build.js` -> 241.1 KB, exit 0. Rotation 11/11, smoke 29/29 (all changes are visual; no gameplay math touched).

**Honest caveat:** These are rendering changes I can't view here — the gradient colours and V-wake motion were reasoned from the canvas/particle params, not seen. Worth a device pass to confirm the azure→turquoise reads well (and stays below the beam-brightness ceiling), the wake looks like a proper spreading V behind ships, and the 48-slot smoke pool holds up under a heavy wave without wakes starving the destruction smoke.

---

## 2026-08-25 — Poseidon Vortex Release: Commit Position (no snap-back)

**Asked:** When a whirlpool ends, ships must NOT snap/interpolate back to their original lanes. Commit their current (X, Y) as the new starting point and resume normal downward sailing from there — no teleport or rubber-banding.

**Root cause:** A ship's world-X is computed everywhere as `laneCentre(lane) + driftX + pullX`, and the whirlpool accumulates its lateral shove into `pullX`. On expiry, `updatePoseidon`'s End block did `e.pullX = 0` for every ship — instantly zeroing the offset, which teleported each ship back to its lane centre (the comment even said "ships snap back to lanes").

**Generated:** Removed the `pullX = 0` reset. On vortex expiry the code now just deactivates the whirlpool and clears the wind slow, leaving each ship's accumulated `pullX` untouched. Because world-X is `laneCentre + driftX + pullX` every frame, keeping `pullX` holds the ship exactly where the vortex left it, and the normal `e.y -= speed * dt` descent in `updateEnemies` continues straight down from that committed position — no snap, no interpolation. Also levels any lingering vortex tilt (`mesh.rotation.z = 0`, purely cosmetic; the propulsion animation overwrites it anyway). The breach-X clamp already keeps a far-shoved ship's eventual impact on-screen.

**Verified:** `node build.js` -> 241.6 KB, exit 0. Rotation 11/11, smoke 29/29. The smoke test's "Poseidon pull" case (sailed pullX 14, oared -6) still passes — the pull *accumulation* is unchanged; only the release behaviour changed (it no longer resets).

**Honest caveat:** Verified by the code path + tests, not viewed on device — worth a quick check that ships dragged by the vortex stay put when it ends and sail straight down from there (no visible jump back toward their lanes).

---

## 2026-08-25 — Remove Brass Currency + Ability Button Icons

**Asked:** (1) Ability buttons should show vector icons (Zeus thunderbolt, Helios sun, Poseidon trident) with the name and cost below. (2) Remove "Brass" entirely — standardise to 3 metals (Bronze common / Silver rare / Gold elite) + Faith; HUD strictly `Bz | Si | Au | F`. (3) Rename the BRASS altar to BRONZE; merlon order BRONZE → SILVER → GOLD → ELECTRUM; Mirror = 50 Bz; all recipes use only Bz/Si/Au/F.

**Investigated first:** grep'd every `brass` reference — config (enemy rewards, ALTAR_RATES, ALTAR_POSITIONS, SHOP.mirror, Zeus/Poseidon opener costs), foundry (resources object, resetFoundries, legacy getSlag/addSlagDirect), session HUD, crafting (mirror getCost + cost labels). The `input.js` "br/m" (breaches/min) and `strings.js` "Br.Shield" are unrelated legacy strings, left alone.

**Generated:**
- **Economy (items 2/3/5):** Brass removed everywhere. Enemy rewards → bronze (skiff 10, trireme 25). `ALTAR_RATES` drops brass; bronze is now the common tier (passive 1 / lit 5). `resources` object is `{bronze, silver, gold}` (+ faith), and `resetFoundries`/`getSlag`/`addSlagDirect` map to bronze. Costs recalibrated to Bz/Si/Au/F only: Mirror `50 Bz` (+25/scaling), prisms bronze/silver, Zeus opener `25 Bz`, Poseidon opener `40 Bz` (repeat casts already Faith+Gold). HUD bottom row now shows exactly `Bz | Si | Au | F`, evenly spaced.
- **Altars (item 4):** Four merlon stations now carry a `type` (the currency they feed) and a `label` (displayed name): BRONZE, SILVER, GOLD, ELECTRUM. ELECTRUM feeds gold (a natural gold alloy) so the merlon reads as four distinct stations without introducing a 4th spendable currency. Altar label draw uses `def.label`; gold-type labels (GOLD + ELECTRUM) stay hidden until first lit, as before.
- **Icons (item 1):** New `drawAbilityIcon(id, cx, cy, s, col)` renders canvas vector icons — Zeus a filled lightning zig-zag, Helios a sun disc with 8 rays, Poseidon a trident (shaft + crossbar + three prongs). God buttons now lay out as icon (top) → name → cost; non-ability buttons keep the classic name → cost. Icons tint with the button's afford/ready state.

**Verified:** `node build.js` -> 244.4 KB, exit 0. Rotation 11/11, smoke 29/29. Ran a currency-key audit over all costs/rewards/altars: only Bz/Si/Au/F present, altar order BRONZE→SILVER→GOLD→ELECTRUM, Mirror = 50 Bz. No live `brass` references remain (only explanatory comments).

**Decision flagged:** The spec listed four altars (BRONZE/SILVER/GOLD/ELECTRUM) but only three spendable metals. I mapped ELECTRUM to feed **gold** rather than add a 4th currency, so the HUD stays exactly `Bz | Si | Au | F` as required. If ELECTRUM should instead be a distinct premium currency, that's a larger change — say the word.

**Honest caveat:** The icons and HUD/altar labels are canvas draws I can't view here — reasoned from the drawing code. Worth a device look to confirm the three icons read clearly at button size, the name+cost sit cleanly beneath them, and the HUD/altar labels show the new metals correctly.

---

## 2026-08-25 — Trident Icon Redraw, 3-Altar Layout, Engraved Pedestal Labels

**Asked:** (1) Redraw the Poseidon button's trident as a classic Greek trident — three tines curving up from a central staff, not a blocky "T" — centred with ~6px top padding so it doesn't clip the button edge. (2) Exactly three altars on the wall (drop the 4th/ELECTRUM), evenly spaced: BRONZE (left) / SILVER (centre) / GOLD (right). (3) Remove the floating labels above the wall; engrave the name onto each altar's stone pedestal.

**Generated:**
- **Trident (item 1, `crafting.js` `drawAbilityIcon`):** Replaced the straight crossbar + parallel prongs with a central staff plus two outer tines that flare outward and curve up to points (`quadraticCurveTo`), a taller centre tine, and small barb points at each tip. Coordinates are measured from the button top so the tine tips sit at y≈7 (~6px below the y≈1 border) and the staff ends at y≈17, above the name row — no clipping, no overlap with the label.
- **Three altars (item 2, `config.js`):** `ALTAR_POSITIONS` trimmed from four stations to three, evenly spaced at x = −18 / 0 / +18 (equal 18-unit gaps, inside the wall half-width): BRONZE, SILVER, GOLD. ELECTRUM removed. Foundry loops over this array, so the wall now renders exactly three altars.
- **Engraved labels (item 3, `foundry.js`):** The metal name is now drawn in a chiselled-stone style (dark recessed glyphs `#1a1206` with a faint 1px bevel highlight) and placed directly ON the altar body (`def.y`, just in front) in the main scene — not a floating tag pinned above the wall. Labels are always visible; the old float-above position and the gold "hide until lit" gating (in both `resetFoundries` and `updateFoundries`) were removed.

**Verified:** `node build.js` -> 244.7 KB, exit 0. Rotation 11/11, smoke 29/29. Altar layout checked numerically: exactly 3, evenly spaced (18u gaps), order BRONZE→SILVER→GOLD, all inside the wall, feeding bronze/silver/gold (no electrum). `MIRROR_FIELD_BOT` / `getOverlayScene` are now unused imports in foundry.js (harmless; left to avoid churn).

**Honest caveat:** The trident shape and the engraved label look are canvas draws I can't view here — reasoned from the drawing code. Worth a device look to confirm the trident reads as a proper Greek trident at button size (tines clearly curved, tips not clipped) and the pedestal labels are legible on the stone without the old floating tags.

---

## 2026-08-25 — Final UX & Polish Pass (ready-glow, direct-aim, audio softener, Faith clarity)

**Asked:** (1) Unmissable pulsing border-glow on ability buttons when affordable (gold/green, `#4EFE82`/`#FFD700`), without distracting from the playfield. (2) Direct-aim mirror drag: while dragging, the mirror points straight at the pointer via `atan2` so the reflected beam aims where the finger is. (3) Audio master softener: route through a `DynamicsCompressorNode` + gentle lowpass (4500Hz) and drop master SFX gain 20%. (4) Faith clarity: a tiny label/glow linking the Fa counter to Zeus/Poseidon.

**Generated:**
- **Ready-state pulse (item 1, `crafting.js` `updateCraftingTray`):** Every affordable-and-actionable button now gets a continuous breathing glow border — an in-canvas equivalent of a CSS keyframe (the tray is a WebGL canvas texture, no DOM). A slow ~1.4 Hz sine (phase-offset per button so the row shimmers instead of strobing) drives a `#4EFE82` green `strokeRect` with `shadowBlur` 4→12 and lineWidth 2→3.5, alpha 0.65→1.0. Zeus keeps its existing dedicated gold pulse. The crisp base border is redrawn on top so edges stay sharp. Covers prism (4-Prism etc.), Helios, Poseidon, Mirror.
- **Direct-aim drag (item 2, `input.js` `onPointerMove` STATE_DRAG):** After clamping the dragged mirror's position, we compute `Math.atan2(world.y - p.y, world.x - p.x)` (pointer relative to the clamped mirror centre) and call `rotateMirror(dragObject, angle)` so the mirror's orientation tracks the finger live. Guarded by a small dead-zone (skip when the pointer is within ~0.5 world units of the disc) to avoid angle jitter. STATE_ROTATE and secondary-pointer rotation are untouched; rotation test stays 11/11.
- **Audio softener (item 3, `audio.js` + `effects.js`):** In `audio.js ensureCtx` the master tail is now `masterGain -> DynamicsCompressor -> lowpass(4500Hz, Q0.707) -> destination` (compressor: threshold -18dB, knee 24, ratio 4:1, attack 3ms, release 250ms). Master gain dropped 0.5 -> 0.4 (-20%) via a new `MASTER_GAIN` const, applied in both `ensureCtx` and `toggleMute`. Every audio.js voice already routes through masterGain, so all its SFX (chimes, deflect/ricochet beeps, thunder, horn, wall hits, crackle) are covered. `effects.js` has its own AudioContext for the destruction burst — gave it a matching compressor+lowpass tail (`fxMaster`) so the noise burst can't spike into harsh top end. `poseidon.js` whirlpool left as-is: its own context is already deeply lowpassed (50-300Hz), no harsh content to tame.
- **Faith clarity (item 4, `session.js` `updateHud`):** The `F:` counter now renders with a soft purple `shadowBlur` glow whenever the player has any faith, and a compact inline hint `-> Zeus/Poseidon` (8px) sits just to its right in matching purple. Positioned after the measured width of the F text and sized so it stays inside the 512px HUD even with a 3-digit Faith value.

**Verified:** `node build.js` -> 249.3 KB, exit 0. Rotation 11/11, smoke 29/29. Diagnostics clean on all five touched files. Math checked: hint x-start = 374 + measured(F-text) + 6; "-> Zeus/Poseidon" at 8px monospace (~72px) ends ~492 < 512 even with 3 Faith digits.

**Honest caveat:** I can't see the render or hear the audio in this environment. The pulse glow, the Faith hint legibility, and the audio compressor/lowpass feel all need a device check. Specifically worth confirming: (a) the green ready-pulse is unmissable but not distracting during combat, (b) the direct-aim rotation feels intuitive rather than twitchy while dragging (the dead-zone threshold may want tuning), and (c) the 4500Hz lowpass + -20% gain doesn't make the mix feel muffled or too quiet — all are one-constant tweaks if so.

---

## 2026-08-25 — In-Engine Victory State (win at 1:30 / 45 kills)

**Asked:** (1) Win condition: `sessionTime >= 90` (1:30) OR `shipsSunk >= 45` while `wallHealth > 0` → enter a victory state. (2) In-engine gold WebGL victory card matching the defeat layout: title "SYRACUSE STANDS VICTORIOUS" in bright gold `#FFD700`, sub-stats Time / Ships Sunk / Gold Earned, prompt "Tap to Play Again" (resets cleanly to 0:00), spawner stopped and incoming damage frozen. (3) A clean resonant victory chime/fanfare synthesized in WebAudio on trigger.

**Generated:**
- **Win trigger (item 1, `config.js` + `session.js`):** New `VICTORY_TIME = 90` and `VICTORY_KILLS = 45` in config. `updateSession` now checks, before the long-form session-end logic, `wallIntegrity > 0 && (elapsed >= VICTORY_TIME || getKillCount() >= VICTORY_KILLS)` → `triggerWin(); return;`. The main loop already returns early once `isGameOver()` is true (before spawner/damage run), so the spawner and incoming damage freeze automatically the instant victory fires.
- **Victory card (item 2, `session.js`):** `triggerWin` now runs fully in-engine — no `playWinCinematic` video path anymore. Added a gold sibling to the defeat sequence: `startVictorySequence` / `updateVictorySequence` fade a warm gold board tint (`dimMesh` recoloured `0x2a1d02`, up to 0.78 opacity — lighter than defeat so the burning fleet still reads celebratory) over ~0.8s, then fade the stats card in after a 0.5s beat over 0.7s. `drawOverlayText` now themes the win branch: title "SYRACUSE STANDS VICTORIOUS" in `#FFD700` with a gold `shadowBlur` glow (15px font so the longer title fits the 256px card), stats in warm `#ffe9a8`, prompt "Tap to Play Again" in gold. Loss branch unchanged (red, "Tap to try again"). Reset clears `victoryActive`/`victoryT` and restores the neutral black dim. Restart is the existing "any tap when game over → resetSession" path, so a win taps cleanly back to 0:00.
- **Fanfare (item 3, `audio.js`):** New `playVictoryFanfare()` — a rising C-E-G-C major arpeggio on paired detuned sawtooth "trumpets" through a per-note lowpass swell (2400→1400Hz), capped by a ringing sine bell chord (with a slightly inharmonic 4.2x partial for shimmer) seated on the final high C for a sacred temple tail. Routes through the shared `masterGain`, so the master compressor + 4500Hz lowpass keep it from getting shrill. Called from `triggerWin` (wrapped in try/catch).
- **Wiring (`main.js`):** Imported and called `updateVictorySequence(dt)` alongside `updateDefeatSequence(dt)` in the game-over branch (no-op unless a victory actually triggered). Removed the now-dead `showOverlay` function and the unused `MSG_WIN` import left over from the old video win path.

**Verified:** `node build.js` -> 254.3 KB, exit 0. Rotation 11/11, smoke 29/29. Diagnostics clean on session/audio/config/main. Logic traced: victory requires wall intact; triggers before session-end + devourer checks; main loop early-return freezes spawner/damage; "Time: 1:30" shows because elapsed≈90 at the time trigger (kill-count wins show the true earlier time, which is correct). Restart reuses the proven resetSession chain.

**Honest caveat:** Can't see the render or hear audio here. Needs a device check that: (a) the gold card is legible and the longer title fits the 256px card without clipping at 15px, (b) the gold tint feels celebratory rather than muddy over the burning fleet, and (c) the fanfare reads as triumphant and clean (not thin or clipping) through the master chain. All are small constant tweaks (tint opacity, font size, note gains) if needed. Also note: with the 90s win, a full 10-minute session no longer occurs in normal play — the old SESSION_DURATION win/lose branch is now effectively unreachable unless both victory conditions are somehow bypassed; left intact as a harmless fallback.

---

## 2026-08-25 — Release-Candidate Lock (victory clarity, strict ram-line, HUD row, Helios cost ghost)

**Asked:** (1) Victory card should read as survival — "SYRACUSE DEFENDED — SURVIVED 1:30" — and clear remaining ships with a concluding flash; the end overlay must darken smoothly over live gameplay instead of blinking the HUD/shop bars off first. (2) Strict collision stop-line: no ship hull may ever drift down onto the Bronze/Silver/Gold discs. (3) Top HUD: drop the debug "-> Zeus/Poseidon" text, format one clean balanced row Bz/Si/Au/Fa (recipes stay on shop buttons only). (4) Fix the ghosted/stacked Helios "15Si 20Bz" cost text by clearing the button area before drawing.

**Generated:**
- **Victory clarity + smooth darken (item 1, `session.js`):** `drawOverlayText` win branch is now a two-line gold survival banner — "SYRACUSE DEFENDED" (bold 17px) + "SURVIVED <time>" (12px) — with the stats block reflowed (Ships Sunk / Gold Earned; the time is already in the banner). Loss branch unchanged. `triggerWin` now runs a concluding fleet wipe: every still-active enemy gets a `spawnDestruction` flash+debris burst and is deactivated, so no hulls linger under the card. Smooth darken: `onEndState` no longer hard-hides `hudMesh`/`trayMesh` (it only extinguishes beams + cuts battle audio). New `fadeEndUi(progress)` fades HUD + tray opacity to 0 in lockstep with the dim tint, called from both `updateVictorySequence` and `updateDefeatSequence` (both refactored to a shared `dimProgress = min(1, t/0.8)`). `resetSession` restores both meshes to `opacity=1` + visible.
- **Strict ram-line (item 2, `enemy.js` `updateEnemies`):** Added a hard per-frame clamp — if a hull's leading (bottom) edge would sink below `BATTLEMENT_TOP_Y` in a step, `e.y` is snapped to `BATTLEMENT_TOP_Y + half` so the leading edge rests exactly on the line before the breach fires. This kills any single-frame overshoot (fast ship or dt hitch) that could momentarily dip a hull down toward the Bronze/Silver/Gold altar discs (which sit at y=-44, top ~-41.5, i.e. ≥2.5u below the guaranteed stop line). Result: zero ship-on-disc overlap, guaranteed. Breach damage/FX unchanged.
- **HUD row (item 3, `session.js` `updateHud`):** Replaced the fixed-x resource labels + the "-> Zeus/Poseidon" hint with one evenly balanced row: Bz / Si / Au / Fa, each centred in its quarter of the 512px bar (bold 14px). Faith keeps its soft purple glow when > 0 (wordless "special resource" cue) but the debug hint text is gone. `F:` relabelled `Fa:` to match the requested format. Cost recipes remain exclusively on the shop buttons. The WALL integrity bar stays at top-centre as the primary health readout.
- **Helios cost ghost (item 4, `crafting.js` `updateCraftingTray`):** Before drawing any cost line we now (a) explicitly zero `shadowBlur`/`shadowColor` so the ready-pulse green halo can't bleed onto the glyphs, and (b) repaint just the cost-text band with the flat button background (clipped to the cell) so a multi-token cost like "15Si 20Bz" can never leave a ghosted/stacked remnant. The label text also benefits from the shadow reset.

**Verified:** `node build.js` -> 257.5 KB, exit 0. Rotation 11/11, smoke 29/29. Diagnostics clean on session/enemy/crafting. Geometry checked: altar top (~-41.5) is ≥2.5u below the clamped ram line (-39), so hulls can't reach the discs; victory banner text widths (~173px / ~94px) fit the 256px card.

**Honest caveat:** Can't see render/hear audio here. Device check worth doing for: (a) the smooth fade actually looks like a crossfade (HUD/tray dissolving as the dim rises) rather than a pop — the fade and dim share the 0.8s ramp so they should track, (b) the concluding fleet-wipe flash reads as celebratory (many `spawnDestruction` bursts at once could be busy if a big wave was on screen), (c) the balanced HUD row is centred/legible at device DPR, and (d) the Helios cost text is now crisp with no ghost. All are small constant tweaks.

---

## 2026-08-25 — Onboarding micro-tutorial (start-of-match hints + rotation indicator)

**Asked:** (1) A brief semi-transparent start-of-match banner (0:00-~0:08) with three control hints — "TAP MIRROR: Aim & Rotate Beam", "DRAG MIRROR: Reposition across Harbor", "DEFEND: Focus sunlight to burn enemy ships!" — elegant and unmissable but not obstructive. (2) A contextual rotation indicator: when a mirror is selected (green ring), show a curved arrow / dotted rotation arc around the disc; auto-fade the tutorial after 6s or once the first ship is destroyed. (3) Keep it non-blocking (pointer-events:none) so it never obstructs input.

**Generated:**
- **New module `src/tutorial.js`:** Draws the banner on a 2x canvas texture (1024x256 -> logical 512x128) mapped onto a plane in the overlay scene at the upper-middle of the playfield (y = WORLD_HEIGHT*0.12), clear of the top HUD (~y45) and the mirror row / shop bar at the bottom. The card is a rounded semi-transparent panel (rgba(10,16,26,0.62) + soft blue border) with a "HOW TO DEFEND SYRACUSE" title and the three emoji+text hint rows (🟢 tap / ✋ drag / ☀️ defend). `updateTutorial(dt, killCount)` fades in over 0.4s, holds, then latches a fade-out (0.6s) on the FIRST of two triggers: `killCount > 0` (first ship sunk) or the 6s hold elapsing — capturing the current opacity so an early kill fades smoothly from wherever the fade-in had reached. Once faded it's hard-dismissed. `resetTutorial` re-arms it so it replays at the start of each new match.
- **Rotation indicator (`input.js`):** New `createRotIndicator` renders a green (#00ff88, matching the selection ring) dashed arc sweeping ~306° with a curved arrowhead at each tip (bidirectional "rotate either way" read) onto a 128px canvas texture, mapped to an ~11u plane. `updateRotIndicator(dt, mirror)` follows the selected mirror's position, slowly spins the plane (0.9 rad/s) so the dashes appear to turn, and gently breathes its opacity. It's shown from `tickDebug` only when a mirror is selected AND not being dragged (`state !== STATE_DRAG`), and hidden on `deselect()` / reset. Sits at z=0.45, just under the crisp selection ring.
- **Wiring:** `main.js` imports + `initTutorial()` in init and `updateTutorial(dt, getKillCount())` in the live-game loop (not the game-over branch). `session.js resetSession` calls `resetTutorial()` (wrapped in try/catch like the other resets) so a restart re-shows the hints.
- **Non-blocking:** Both the banner and the indicator are pure render meshes in the overlay/main scenes. All pointer handling is on the WebGL canvas element; these meshes register no DOM listeners and cannot intercept input — the WebGL equivalent of pointer-events:none.

**Verified:** `node build.js` -> 261.8 KB, exit 0 (strict new-Function lint would catch undefined refs; grepped index.html to confirm initTutorial/updateTutorial/createRotIndicator all bundled). Rotation 11/11, smoke 29/29. Diagnostics clean on tutorial/input/main/session. Fade logic traced: single fade-out latch, opacity captured at fade start, dismiss at opacity<=0.001; re-arm on reset.

**Honest caveat:** Can't see the render here. Worth a device check that: (a) the banner is legible and the emoji render correctly at the plane's on-screen size (emoji glyph coverage varies by device/font — if a glyph shows as a box, we can swap to a drawn icon), (b) the banner position doesn't feel like it sits over the action for those first seconds, (c) the dashed rotation arc + arrowheads read clearly around the ~5u mirror disc and the slow spin looks like a hint rather than noise, and (d) the fade timings feel right. All are constant/asset tweaks.

---

## 2026-08-25 — HOTFIX: black screen after intro (tutorial module never bundled)

**Symptom:** After the intro video the game boots to a black screen — nothing starts.

**Root cause:** The previous commit added `src/tutorial.js` and wired `initTutorial()` / `updateTutorial()` / `resetTutorial()` into `main.js` and `session.js`, but `build.js`'s `SOURCE_FILES` list was never updated to include `src/tutorial.js`. The bundler concatenates only the files in that list, so the tutorial functions were CALLED but never DEFINED in the shipped `index.html`. At runtime `init()` hit `initTutorial()` -> ReferenceError -> the intro layer's `startGame()` try/catch swallowed it into the (hidden unless `?debug=1`) debug element, leaving a black screen. The build's strict lint didn't catch it because the lint defines top-level functions and runs module top-level code but never actually calls `init()`, so the undefined reference inside `init()`'s body was never exercised.

**Fix:**
- Added `src/tutorial.js` to `build.js` `SOURCE_FILES`, positioned before `session.js`/`input.js`/`main.js` (its callers). Bundle size 261.8 -> 267.3 KB confirms the ~5.5 KB module is now actually included; grepped index.html to confirm `function initTutorial` and `tutRoundRect` definitions are present, not just the call sites.
- Renamed tutorial.js's two top-level identifiers that collided with `session.js` once both were in the shared bundle scope: `elapsed` -> `tutElapsed`, `roundRect` -> `tutRoundRect`. (Without this, bundling tutorial.js would now throw a duplicate-declaration SyntaxError.) Verified no other tutorial.js top-level names collide with any bundled module.
- Added a build guard: every `src/*.js` on disk must appear in `SOURCE_FILES`, else the build fails with a clear message. This prevents the whole class of "new module added but not bundled -> black screen" from shipping again.

**Verified:** `node build.js` -> 267.3 KB, exit 0 (new guard passes; all src files listed). Rotation 11/11, smoke 29/29. Diagnostics clean on tutorial.js + build.js.

**Honest caveat:** I can't launch the browser here, so I've fixed and verified the actual defect (missing bundle entry -> undefined `initTutorial`) by build+grep+lint, but the final "boots past intro into gameplay" confirmation needs a device/browser load. If anything still black-screens, load with `?debug=1` to surface the caught init error message in the bottom-left overlay.

---

## 2026-08-25 — RC polish: instant onboarding dismiss, higher spawn line, cost "+" separator, narration cutoff fix, currency audit

**Asked:** (1) Dismiss the tutorial card immediately on the first player input (tap/select/drag), not on the timer, so the crystal + first ship are unobstructed at once. (2) Raise the enemy spawn Y so ships stage in open water well above the prism. (3) Helios cost as "15Si + 20Bz" (explicit "+" separator) and wipe the canvas under all button sub-labels to kill ghosting. (4) Fix the opening narration cutting off at "According to..." — complete the line or drop the clip. (5) Confirm HUD + logic are strictly Bz/Si/Au/Fa with no legacy Brass.

**Generated:**
- **Instant dismiss (item 1, `tutorial.js` + `input.js`):** New `dismissTutorial()` latches the fade-out immediately (idempotent), using a snappier `FADE_OUT_INPUT = 0.22s` (vs the 0.6s timer/first-kill fade) so the playfield clears at once. `onPointerDown` calls it on the first real interaction (after the game-over/restart guard, before any select/drag branching), so any tap, mirror select, or drag start dismisses it. The 6s / first-kill auto-fade remains as the no-input fallback.
- **Higher spawn line (item 2, `config.js`):** `SHIP_SPAWN_Y` raised 40 -> 44 and `SHIP_TOP_BOUND` 44 -> 46 (still ~2u below the crystal at 48). Ships now stage higher in open water, well above the prism line (y30), so the opening kill happens cleanly in open space instead of amid prism/beam clutter. All spawns route through `SHIP_SPAWN_Y` (clamped by `SHIP_TOP_BOUND - half`), so both the scripted first ship and ongoing waves move up together.
- **Cost separator + label wipes (item 3, `crafting.js`):** `drawCostTokens` now joins currencies with an explicit " + " (`COST_SEP`), drawn as its own dim `#999999` segment with exact measured spacing and included in the fit-shrink, so Helios reads "15Si + 20Bz". Added a background wipe of the NAME band (matching the existing cost-band wipe) before drawing each button's label, and the shadow reset already in place — so no sub-label (name or cost) can ghost/stack.
- **Narration cutoff (item 4, `build.js` HTML template):** Root cause was the intro tap handler's failsafe firing `startGame()` unconditionally at 5s, cutting the ~10.5s narration off mid-sentence (~"According to..."). Rewrote it to only hand off early if the video genuinely failed to start — at 4s it checks playback progress (`video.paused || currentTime < 0.3 || readyState < 2`) and only then starts the game. If the video is playing, it's left alone to reach `ended`, so the full opening line plays. (Fix is in the build template so it survives rebuilds; verified present in generated index.html.)
- **Currency audit (item 5, `strings.js`):** Swept all src for brass/Brass/Br. Only genuinely ambiguous player-facing string was `CRAFT_LABELS.reinforced = 'Br.Shield'` -> changed to 'Bronze Shield'. Remaining hits are non-currency: "br/m" (breaches-per-minute debug), "(was Brass)" historical config comment, "brass body" (trumpet timbre in the fanfare), and the `getSlag/getInsight` legacy shims that map to bronze (comment only). Confirmed all costs/rewards/altars/HUD use strictly bronze/silver/gold/faith; HUD shows Bz/Si/Au/Fa.

**Verified:** `node build.js` -> 269.4 KB, exit 0. Rotation 11/11, smoke 29/29. Diagnostics clean on tutorial/input/config/crafting/strings/build. Grepped index.html to confirm the 4s progress-gated failsafe, the " + " separator, and dismissTutorial all bundled. Helios cost `{ silver:15, bronze:20 }` renders exactly "15Si + 20Bz" per the requested format.

**Honest caveat:** Can't see render or hear audio here. Device check worth doing for: (a) tapping instantly clears the card and the crystal/first ship are unobstructed, (b) the raised spawn line gives a satisfying open-water opening kill (if ships now feel too close to the crystal, SHIP_SPAWN_Y is a one-line tweak), (c) the "15Si + 20Bz" fits the Helios button cleanly at the shrink font, and (d) MOST IMPORTANTLY the narration now plays to completion — I fixed the code path that cut it at 5s, but if the mp4 file itself is truncated at "According to...", the clip would still end there and we'd instead want to drop/replace the audio (the alternative the request allowed). Please confirm on a real load.

---

## 2026-08-25 — Победа: время увеличено до 3:00 (полноценный челлендж)

**Запрос:** увеличить время до победы до 2:30–3:00 (полноценный челлендж). Взял верхнюю границу — 3:00 (180с).

**Сделано (`config.js`, `session.js`):**
- `VICTORY_TIME` 90 -> 180 (3:00). Теперь основной путь к победе — выжить со стеной до 3:00, пройдя Phase 1 (скиффы, 0–60с) и Phase 2 (бронированные галеры, 60–180с). Условие проверяется каждый кадр в `updateSession` при `wallIntegrity > 0`.
- `VICTORY_KILLS` 45 -> 150. Это ключевой момент: за 180с спавнится ~120–140 кораблей (скриптовый опенинг ~43 за первые 90с + процедурный Phase 2 при интервале 1.5с и парных/формациях ещё ~80–100). Старый порог 45 срабатывал бы уже к ~40–50с и делал таймер бессмысленным. Подняв порог заметно выше реалистичного числа кораблей в окне, оставил килы как вторичный резерв «зачистил весь флот» — в обычной игре победа зарабатывается именно выживанием до 3:00.
- Обновил устаревший комментарий в `updateSession` (был «survive to 1:30 OR sink 45»).
- Победная карта показывает «SURVIVED <time>» из фактического `elapsed`, поэтому при таймерной победе автоматически покажет «SURVIVED 3:00» — хардкода «1:30» нигде нет.

**Не трогал:** скриптовый опенинг (`SCRIPT_END = 90`) — он покрывает первые 90с, дальше процедурный спавнер (Phase 2 до 180с) сам держит челлендж смешанными типами; продление скрипта не требовалось. Эскалация HP `1 + (elapsed/600)*3` к 180с даёт ~1.9x — естественный рост сложности к концу забега.

**Проверка:** `node build.js` -> 270.1 KB, exit 0. Rotation 11/11, smoke 29/29. Диагностика чистая (config, session). Грепом подтвердил VICTORY_TIME=180 / VICTORY_KILLS=150 в собранном index.html.

**Честная оговорка:** не могу играть здесь, поэтому баланс «дойдёт ли средний игрок до 3:00, не потеряв стену под давлением Phase 2» нужно проверить на устройстве. Обе константы — правка в одну строку: если 3:00 окажется слишком тяжело, ставим 150 (2:30); если килы всё же обгоняют таймер при очень агрессивной игре — поднимаем VICTORY_KILLS ещё.

---

## 2026-08-25 — Altar visual & text legibility overhaul (labels, braziers, resource ticks)

**Asked:** (1) High-contrast altar labels: bold near-black name (#111/#1A1A1A) with a crisp white/metallic outline, positioned above the shop-button boundary so the ability tray never covers them. (2) A small Greek ceremonial brazier / eternal flame on each of the 3 altars — bronze/warm-orange, silver/turquoise, gold/radiant-yellow — to signal they're divine generating shrines. (3) A clear resource tick beside/below each label (`+1 Bz/s` etc.) so players instantly know what each altar generates.

**Generated:**
- **Config (`config.js`):** Each `ALTAR_POSITIONS` entry now carries `flame` (brazier fire colour: bronze `#ff8a2a`, silver `#7ff0e0`, gold `#ffe24a`) and `short` (currency abbrev Bz/Si/Au) alongside the existing `colour`/`label`.
- **High-contrast label + tick (item 1 & 3, `foundry.js` `makeAltarLabelMesh`):** Replaced the old dark "engraved" label (which sat at the altar centre y-44, right on the shop-tray boundary and hard to read) with a 256x96 canvas texture: bold 34px near-black `#111111` name with a 6px white `#f2f2f2` `strokeText` outline for contrast on any background, and a second line `+N <Metal>/s` (using the altar's LIT rate — Bronze +5, Silver +2, Gold +1) in the metal's tint with a dark outline. The label plane is placed at `def.y + 3.0` (~y-41): above the altar + brazier and well clear of the shop tray top (~y-44.5), so the tray can never obstruct it, while staying below the battlement line (y-40) so it doesn't float onto the wall.
- **Brazier + eternal flame (item 2, `foundry.js` `makeBrazierMesh`):** Each altar gets a small ceremonial fire-bowl (canvas-drawn metallic cup on a short stem/foot, tinted from the altar `colour` with a white rim sheen) plus a layered additive flame (coloured outer teardrop + hot `#fff6d8` core) in the metal's `flame` colour. Sits at `def.y + 0.8`, on the altar just above centre. Per-frame flicker in `updateFoundries` (new "4." block): two out-of-phase sines drive organic scale/opacity flicker; the flame grows taller/brighter (1.35x) while the altar is actively lit by a beam ("receiving offering"), calmer (1.05x) when overheated, gentle idle (1.0x) otherwise, with a slight vertical bob so the tip dances above the rim.

**Verified:** `node build.js` -> 275.6 KB, exit 0. Rotation 11/11, smoke 29/29. Diagnostics clean on foundry + config. Grepped index.html to confirm `makeBrazierMesh`/`makeAltarLabelMesh`/`strokeText`/flame-flicker all bundled. Layout math: label at y-41 is +3.5u above the tray top (y-44.5) and 1u below the wall (y-40).

**Honest caveat:** Can't see the render here. Device check worth doing for: (a) labels are sharp and unobstructed by the tray at device DPR (font sizes on the 256x96 canvas are large, should be crisp), (b) the braziers read as fire-bowls at their on-screen size and the three flame colours are distinct, (c) the flame flicker looks alive but not distracting, and (d) the label + brazier stack doesn't overlap awkwardly with the wall stone or neighbouring altars (they're 36u apart at x -18/0/18, label plane 9.5u wide, so no horizontal overlap). All are constant/asset tweaks (label y-offset, brazier/label plane sizes, flame colours) if anything needs nudging.

---

## 2026-08-25 — Floating "+1" resource combat text on altar ticks

**Asked:** (1) High-contrast black + light-outline altar labels raised above the shop tray. (2) Greek braziers with per-metal flames (bronze orange / silver pale-cyan / gold yellow). (3) NEW: Warcraft-style floating "+1 Bz/Si/Au" combat text on each resource tick while a beam feeds an altar — rises ~25px, expands slightly, fades over 0.7s (opacity 1->0), sprites removed on expiry.

**Status of 1 & 2:** Already shipped last commit (`4938651`) and re-verified against this spec:
- Labels: bold `#111111` name + `#f2f2f2` `strokeText` outline, at y-41 (well above the tray top ~y-44.5). Matches "sharp high-contrast black + clean light outline, raised above the shop tray." No change needed.
- Braziers: bronze `#ff8a2a` (warm orange), silver `#7ff0e0` (pale cyan), gold `#ffe24a` (radiant yellow). Matches. No change needed.

**Generated (item 3, `foundry.js` + `config.js`):**
- **Config:** each altar def gains a `popup` colour — bronze `#ffb14a` (warm amber), silver `#d6fbff` (bright silver-cyan), gold `#ffe870` (shimmering gold).
- **Popup system:** pre-renders one shared "+1 Bz/Si/Au" texture per metal (bold 30px, dark outline + metal-tint fill) and a pool of 24 reusable sprite planes in the OVERLAY scene (renders on top). `spawnResourcePopup(altar)` grabs a dead pool sprite, positions it just above the altar's brazier (y+3.0) with small x-jitter so stacked ticks don't perfectly overlap, and sets life=0.7s. `updateResourcePopups(dt)` rises each live popup by `POPUP_RISE` (5 world units) over its life, expands scale ~35%, fades opacity 1->0, and hides+frees it the instant life hits 0 (pooled, so no per-frame allocation/GC churn).
- **Tick hook:** in the accumulation block, when an altar is LIT we track the integer floor of its resource and spawn one popup per whole unit crossed (capped at 2/frame so a dt hitch can't flood the pool). Passive-only trickle (unlit) does NOT pop — so the "+1" stream clearly reads as "the beam is producing". Bronze lit = 6/s, silver 2.4/s, gold 1.2/s (halved under overheat).
- **Reset:** `resetFoundries` zeroes each altar's `intAccum` and retires all in-flight popups so none carry into a new run.

**Verified:** `node build.js` -> 280.8 KB, exit 0. Rotation 11/11, smoke 29/29. Diagnostics clean on foundry + config. Grepped index.html to confirm the popup init/spawn/update + intAccum tick hook are bundled.

**Honest caveat:** Can't see the render here. Device check worth doing for: (a) the "+1" text is legible and clearly rises/fades above each altar without cluttering (bronze pops ~6/s — if that feels too busy, we can pop only every Nth unit or throttle by time), (b) the rise distance (5 world units) matches the intended "~25px" feel at the game's on-screen scale — it's a one-constant tweak (`POPUP_RISE`), and (c) popups sit above the brazier/label and don't collide with the wall. Pool size 24 comfortably covers the combined tick rate; if ever exhausted, extra ticks are simply skipped that frame (no growth).

---

## 2026-08-25 — Currency ticker unification: gold "Au" -> "Gd" everywhere

**Asked:** Replace legacy chemical tickers with unified gaming abbreviations — Bronze "Bz", Silver "Si", Gold "Gd" (was the chemical "Au"), Faith "Fa". Top HUD must read `Bz | Si | Gd | Fa`; altar floating popups must read "+1 Bz / +1 Si / +1 Gd".

**Generated:** Bz/Si/Fa were already correct; the only chemical ticker in use was gold's "Au". Changed gold's abbreviation to "Gd" at every source of truth:
- **`session.js`** HUD resource row: `'Au:'` -> `'Gd:'` (row now Bz: / Si: / Gd: / Fa:).
- **`config.js`** altar def `short: 'Au'` -> `'Gd'`. This single field drives BOTH the altar's `+N Gd/s` engraved tick and the floating `+1 Gd` popup (the popup text is built as `'+1 ' + def.short`), so both sync automatically.
- **`crafting.js`** shop cost maps `COST_LABELS` and `costStr` labels: `gold: 'Au'` -> `'Gd'`, so shop button cost tokens (e.g. Zeus repeat cost) show Gd.
- Updated the two "+1 Bz/Si/Au" comments in foundry.js to "Gd".

Swept all src for `\bAu\b` / `\bAz\b` afterward — only remaining hit is an explanatory comment ("Gd for gold, not the chemical Au"). No functional chemical tickers remain.

**Verified:** `node build.js` -> 280.8 KB, exit 0. Rotation 11/11, smoke 29/29. Diagnostics clean on session/config/crafting/foundry. Grepped index.html to confirm HUD `Gd:`, altar `short:'Gd'`, and both cost maps `gold:'Gd'` are bundled. HUD reads `Bz: Si: Gd: Fa:`; altar popups/label ticks derive "Gd" from config. Underlying resource keys stay bronze/silver/gold/faith (only the display ticker changed), so no logic/balance impact.

**Honest caveat:** Can't see the render here — a quick device look confirms the HUD shows "Gd:" and a lit gold altar pops "+1 Gd", but the change is a pure display-string swap so behaviour is unaffected.

---

## 2026-08-25 — Mirror sprite: round disc -> elongated bronze shield (orientation readability)

**Asked:** Revert mirrors from round discs (a readability regression — a circle looks identical at every angle, reads as a coin/button) back to an elongated shape, but NOT the plain bar. Draw an elongated bronze shield seen at an angle: long oval face, bright specular highlight along its length, darker rim, rivets at both ends, simple wooden frame behind. Clearly wider than tall so tilt is unmistakable; highlight rotates with the mirror so it reads as a real reflecting surface. Keep the hit area exactly as-is (sprite only). Confirm the selection ring still reads.

**Generated (`mirror.js` + `input.js`), sprite-only:**
- **`drawMirrorSprite` rewritten:** now draws the mirror LONG along local X (which is the reflecting line p1->p2), ~2.6:1 wider than tall, so rotating the mesh by `mirror.angle` turns the whole elongated shape + its highlight — orientation is legible at a glance. Layers back-to-front: a wooden backing plank (rounded ends, grain highlight/shadow), a long bronze oval face with a top-lit metallic cross-gradient and a darker rim ring, a bright specular streak baked along the length of the face (clipped inside the oval), and forged rivets at each end. Texture bumped 64 -> 128px for crisp detail. Added a small `roundRectPath` helper (verified unique across the bundle, no name collision).
- **Sun-catch glint reworked:** the separate additive glint that used to float off to the side (offset along the normal) now sits CENTRED on the face, is wide-and-low (4.5x2.2), rotates with the mirror (`highlight.rotation.z = angle`), and is toned down (opacity 0.12 + 0.5*face-up) so it complements the baked streak instead of reading as a detached blob. Updated both `updateMirrorGeometry` and the tween path to centre+rotate it.
- **Selection ring (`input.js`):** bumped `RingGeometry` 4/4.6 -> 4.9/5.5 (both primary + second-pointer rings) so the green halo fully encloses the shield (tips reach ~4.8u from centre) at every rotation without the shape poking through. A circular ring stays rotation-invariant and reads cleanly around the elongated shield.

**Hit area untouched:** collision is a circular `HIT_RADIUS` test around `freeX/freeY` in `findObjectAt`; the reflecting geometry is `p1`/`p2`/`normal`/`mirror.length` (= MIRROR_LENGTH) and `MIRROR_RADIUS`/`clampMirrorPos` — none changed. The sprite plane stayed square, so rotation doesn't distort the shield. The rotation test (which exercises the real p1/p2/normal geometry) stays 11/11, confirming no gameplay/geometry change.

**Verified:** `node build.js` -> 283.5 KB, exit 0 (strict lint + duplicate-id guard pass). Rotation 11/11, smoke 29/29. Grepped index.html to confirm the new sprite, `roundRectPath`, and the resized rings are bundled.

**Honest caveat:** Can't see the render here. Device check worth doing: (a) the shield reads clearly wider-than-tall and its tilt is obvious at all angles, (b) the lengthwise highlight looks like a real specular reflection turning with the surface (streak brightness/position are canvas constants, easy to tune), (c) the wooden frame/rivets read at on-screen size, and (d) the green selection ring sits as a clean halo around the shield without clipping. All are constant/asset tweaks (shield rx/ry ratio, streak alpha, ring radius) if anything needs nudging.

---

## 2026-08-25 — Enemy type rename to historical classes (naming only)

**Asked:** Rename enemy types to historical ship classes, player-facing AND internal ids: skiff -> liburna (light fast scout), shieldbearer -> cataphract (armoured oared warship w/ protected deck), flagship -> quinquereme (heavy Punic-Wars flagship); trireme + quadrireme unchanged. Update every reference (ENEMY_TYPES keys, BREACH_DAMAGE, BREACH_DRIP_PCT, spawn tables, sprite configs, on-screen labels, tests). Stats unchanged. Verify a full session still runs since the keys are lookup indices — a missed rename would silently produce undefined stats.

**Renamed the id in every lookup site:**
- `config.js`: `ENEMY_TYPES` keys, `BREACH_DAMAGE`, `BREACH_DRIP_PCT` (all three now: liburna/trireme/quadrireme/cataphract/quinquereme), plus phase comments.
- `enemy.js`: `SHIP_SIZE` table, `generateShipTextures` types array, the `configs` sprite table + `|| configs.liburna` fallback, pool default `type:'liburna'`, `shipTextures.liburna` fallbacks, the heavy-destruction check (quinquereme/quadrireme), and the shield-plate check (cataphract).
- `enemy-spawner.js`: every `spawnEnemy('liburna'|'cataphract'|'quinquereme', ...)` in the scripted opening + procedural phases + shield formation escorts; internal flag `flagshipSpawned -> quinqueremeSpawned`; header/phase comments. (Left the internal `shieldBearerTimer`/`firstShieldSpawned`/`getNextShieldLane`/`spawnShieldFormation` scheduling-variable names as-is — they are formation bookkeeping, not enemy-type ids, and are self-consistent; renaming them adds churn without changing any lookup.)
- `zeus.js`, `session.js`, `damage.js`: type-string checks (isLight liburna; heavy quinquereme/quadrireme; victory-wipe heavy incl. cataphract).
- `strings.js`: rekeyed the (unused) `ENEMY_NAMES` display map to the real ids with historical display names (was stale mote/husk/carapace/devourer).
- Tests (`test_smoke.js`): `mockEnemy` calls, the isLight check, and all assertion/label strings -> Liburna/Cataphract.
- `DESIGN_INTENT.md`: already clean — it describes ships generically ("Roman ships", "four ship types", "boss ship"), never the internal ids, so nothing to change.
- BUILD_LOG history: left prior entries intact (append-only journal — rewriting past entries would falsify the record). Only "flagship" mentions left in source are two comments where it's the correct English word for the quinquereme's role, not an id.

**Verified (undefined-stats guard):** wrote a throwaway checker that walked the built bundle and confirmed ENEMY_TYPES, BREACH_DAMAGE, BREACH_DRIP_PCT and SHIP_SIZE all carry the identical 5-key set {liburna, trireme, quadrireme, cataphract, quinquereme}, and that every `spawnEnemy('...')` string in the bundle resolves to a valid key — so no spawn can hit an undefined stat. Result PASS; script then deleted. `node build.js` -> 284.1 KB, exit 0. Rotation 11/11, smoke 29/29, with the smoke output now reading "Liburna heat 45/30" and "Cataphract heat 200/400" — confirming the renamed keys resolve to the correct (unchanged) stats.

**Honest caveat:** Stats are provably unchanged (same values, only keys renamed) and the key sets are provably consistent across all lookup tables + spawn calls, so a live session can't produce undefined stats from this change. I can't watch the game render here, but there's no gameplay/balance delta to observe — it's a pure identifier rename.

---

## 2026-08-25 — Sea darkened for real + luminance gate wired into build

**The mechanism (what actually went wrong):** The sea colour has exactly ONE source — `drawSeaBase` in `background.js`. My previous turn never edited it (I was interrupted after only reading the file + writing a throwaway `_lum.js`), so the bright palette shipped unchanged; nothing was "overriding" it, it simply was never changed. And the luminance check I'd described was a standalone script run by hand once — NOT wired into build.js, so it printed nothing on a build and gated nothing. Two rounds looked "brighter" because the mirror-frame commit touched only mirror.js while the water stayed as-is.

**Before (measured, WCAG relative luminance):**
- upper sea `#0a1a2e` 1.0%, mid `#123a52` 3.8%, teal `#186b74` 12.0%, lower sea `#1f8f8a` **21.8%** (near-turquoise, washed out the pale beam), ground `#2E2419` 1.9%. The 1%→22% span across one gradient is the "two bands + hard seam".

**Applied:**
- `drawSeaBase` gradient collapsed into the dark band, stops spread EVENLY (0.0/0.33/0.66/1.0) for a wide seamless transition: `#12303F` → `#143543` → `#163B4C` → `#1A4257`.
- Wave crests re-tinted dim blue-grey (was bright `rgba(120,200,210)`) at lower alpha and increased to 9 crests spread full-height so several always cross the mid transition, breaking up any straight edge.
- Wired a REAL luminance-budget gate into `build.js`: it scans `background.js` for the sea gradient stops + `COL_GROUND/COL_SKY/COL_WALL`, computes relative luminance, prints them every build, and HARD-FAILS if the sea exceeds a tight `#1A4257`+tol cap (~5.3%) or any other surface hits 22%. (A plain 22% ceiling was too loose — the old `#1f8f8a` was 21.8%, under 22% yet visibly turquoise; the tight sea cap would have caught it.)

**After (measured, printed by the build gate):**
- sea upper `#12303F` **2.6%**
- sea mid `#143543` **3.1%**
- sea mid `#163B4C` **3.8%**
- sea lower `#1A4257` **4.8%**
- ground `#2E2419` **1.9%**, sky `#0a1520` 0.7%, wall `#554433` 6.3%
- ref: dimmest/palest beam gold `#ffe9a0` **82.1%** (additive) — brightest on screen. ✓

Build 284.9 KB exit 0 (luminance gate passes), rotation 11/11, smoke 29/29. Grepped index.html: new dark stops present, old `#1f8f8a`/`#186b74` gone (no override survived to the build). Deleted the throwaway `_lum.js`.

**Honest caveat:** These are computed luminance numbers (the same formula now gates the build), not a screen capture — I can't view the render here. But the sea is now provably within the requested band and every surface is provably below both its cap and the palest beam, and the gate will fail any future build that lets the water drift bright again.

---

## 2026-08-25 — Proved the luminance gate by exercising it (and hardened it)

**Asked:** don't claim the gate works by reasoning — trip it for real. Set a sea stop to the old #1f8f8a, run the build, confirm it exits non-zero, names the offender, and deletes/refuses the output; then revert and report the actual output.

**Exercising it surfaced a real flaw:** the first trip printed "Built index.html (284.9 KB)" and left a stale bright index.html on disk (size/mtime changed) — because the luminance gate ran AFTER writeFileSync and only did process.exit(1), unlike the syntax/lint gates which unlink the output. So a broken artifact could ship if the exit code were ignored. Fixed: the gate now `fs.unlinkSync(outPath)` on failure.

**Actual output of the failed build (after the fix), with sea lower stop = #1f8f8a:**
```
Built index.html (284.9 KB)
  Luminance budget (sea cap 5.3%, others 22%):
    sea upper (top stop)   #12303F  2.6%
    sea lower (bottom stop) #1f8f8a  21.8%  ✗ OVER
    sea mid stop 1         #143543  3.1%
    sea mid stop 2         #163B4C  3.8%
    COL_GROUND             0x2E2419  1.9%
    COL_SKY                0x0a1520  0.7%
    COL_WALL               0x554433  6.3%
    (ref) beam gold full   #ffe9a0  82.1%  (additive; brightest on screen)

❌ BUILD FAILED: background surface(s) over luminance cap:
  sea lower (bottom stop) #1f8f8a 21.8% (cap 5.3%)
  Sea must stay within #12303F..#1A4257 so the beams remain brightest.
  (deleted index.html)
```
Post-check: `EXIT=1`, and `Test-Path index.html` returned false — **index.html DELETED, broken build refused**. Confirms: (a) non-zero exit, (b) names the offending stop, (c) deletes the output. Also confirms the tight sea cap catches 21.8% (a plain 22% ceiling would not).

**Reverted** the stop to #1A4257; clean build exits 0, sea lower back to 4.8%, output restored. Source grepped clean of the temp colour. Rotation 11/11, smoke 29/29.

---

## 2026-08-25 — Colour pipeline fix: sRGB double-encode of CanvasTextures (the real cause of "bright water")

**Root cause (confirmed last round):** vendored three.js is **r160** (the `'160'` string literal; `r150` only appears in the deprecation banner). r150+ has colour management ON by default: `outputColorSpace` defaults to `SRGBColorSpace`, `toneMapping` defaults to `NoToneMapping`, and — critically — **`CanvasTexture.colorSpace` defaults to `NoColorSpace`**. So every canvas texture (already holding sRGB pixels) was treated as linear and skipped linearisation, then got the sRGB output encode applied anyway → a double encode that lifted `#12303F` (2.6%) to roughly `#4D7887` light grey-blue on screen, uniformly, and washed out the additive beams. Palette edits never showed because the distortion was in the pipeline, not the values.

**Applied (pipeline only, no palette changes):**
- `renderer.js`: set `renderer.outputColorSpace = THREE.SRGBColorSpace` explicitly (documents intent; guards against a future vendor default change). Left `toneMapping` at its `NoToneMapping` default (tone mapping was not lifting anything).
- Tagged **all 21 CanvasTexture sites** across 12 files with `.colorSpace = THREE.SRGBColorSpace` (sea, foam line, beam, crafting tray, effects glow, fortress, ship sprites, ship shield plate, altar popup/brazier bowl/flame/label, mirror sprite + highlight, rotation indicator, poseidon whirlpool, HUD, overlay, tutorial banner). Verified count: 21 CanvasTexture == 21 colorSpace assignments.
- Flat-colour materials (`MeshBasicMaterial({color})`, `scene.background`) need NO change: in r160 they're already interpreted as sRGB inputs and encoded once. Now textured surfaces do the same single round-trip, so the sea (texture) and its neighbouring sky/ground (flat colour) are lifted identically and the seam at the plane boundary closes. This was the whole point — before, textures got two encodes and flat colours one, so they diverged exactly at plane edges.

**r150-era assumptions checked in renderer setup:** no `outputEncoding`, no `physicallyCorrectLights`, no `useLegacyLights`, no `gammaFactor` in our code (all removed/renamed in r150) — the renderer relied purely on r160 defaults plus the now-added `outputColorSpace`. Nothing else to migrate.

**Verified the full chain:** dumped the sea canvas gradient to PNG (reproducing drawSeaBase's stops exactly) — it renders a DARK deep-blue gradient, 2.6%→4.8%, smooth, no seam. So: source hex 2.6–4.8% → dark canvas PNG → sRGB-tagged texture → single output encode → dark pixels. The dark PNG + (pending) dark screen together confirm the whole path. Build 286.9 KB exit 0, luminance gate green (source hex unchanged), rotation 11/11, smoke 29/29. Diagnostic scripts (_rev.js, _seapng.js) and the PNG deleted after use.

**Expected side effect (as flagged):** EVERY canvas texture was double-encoded, so all of them shift darker at once now — ships, mirrors, altars, fortress, wall, HUD, tray. Some may now read too dark. That is expected; per instruction we retune from the corrected baseline, NOT in this pass. No palette values were touched here.

**Honest caveat:** I can't view the rendered frame here — the PNG confirms the source/texture end of the chain is dark and seamless, and the pipeline maths now applies exactly one sRGB encode, but the on-screen confirmation is the user's to make. If the water now reads dark and the seam is gone, the luminance gate's numbers finally correspond to pixels.

---

## 2026-08-25 — Review fixes: hull/mirror overlap, lane stacking, beam soup, Faith economy (+ tray/currency confirmations)

**1. Hard stop above the mirror row (`config.js`, `enemy.js`, `mirror.js`):** Ships used to sail all the way to the wall (BATTLEMENT_TOP_Y -39), passing over/under the mirrors and piling at the battlement. New `SHIP_STOP_Y = MIRROR_FIELD_TOP + 6` (~-6): the hull's leading edge hard-clamps there (can't cross in one frame step even at speed/dt spikes), forward motion freezes, and the breach + FX (explosion/smoke) fire from that line. Mirror drag ceiling lowered (`clampMirrorPos maxY = MIRROR_FIELD_TOP`, was ~+11) so a mirror centre can't rise above the field top; its sprite top (~-7 at radius 5) stays below the stop line. Geometry: largest hull (quinquereme half-height 4) stops with body at y >= -6; highest mirror sprite top -7 -> 1u clearance, zero overlap for any ship at any mirror position.

**2. Lane stacking (`enemy-spawner.js`).** CURRENT behaviour first: 0-90s scripted opening already spreads lanes; after 90s the procedural `doSpawn` picked a fresh uniform-random lane every 1.2-1.5s with NO memory, so the same lane got re-rolled repeatedly and ships (slow galleys at 2-2.5 u/s) concertina'd into columns; cataphract formations add a same-lane leader+2-3 escort column on top. FIX: added a per-lane last-spawn table + `pickLane()` that only picks lanes idle >= `LANE_MIN_GAP` (2.4s) and prefers the least-recently-used (shuffled ties), falling back to the stalest lane under heavy load; all procedural spawns route through `spawnOnLane()` which stamps the lane. Paired pressure now adds one ship on a *different* open lane instead of a fixed opposite pair. Formations reserve their lane for the whole column length. Verified by simulation (180s @ 1.2s interval): per-lane counts 40/40/40/40/38 (no centre bias) and 0 same-lane spawns within 2.4s.

**3. Beam soup at 4 mirrors (`beam-render.js`) + cap confirmation.** Confirmed the segment cap CANNOT flood: `traceBeam` returns at `segments.length >= MAX_SEGMENTS` (24) and before every band/sub-ray push, and resonance only scales intensity (no extra segments) — so a resonance chain can't multiply rays. For the visual noise, added bounce-depth dimming in the renderer: `depthDim = max(0.18, 0.6^seg.bounces)` multiplies both core+glow opacity, so the primary path (bounce 0, straight from the prism) stays dominant and deep multi-mirror bounces recede to faint hints. Widths unchanged (still crisp).

**6. Faith economy (`foundry.js`, `config.js`).** One Zeus hit ~130 Faith because the drip was +0.5/s PER burning ship and Zeus ignites a whole screen — enough to nearly re-buy the 15-Faith repeat. Cut the drip to +0.15/s and capped the burning count at 4 (`min(burning,4)*0.15*dt`), so a mass ignition can't spike Faith; sustained beam burning is now the reliable path. Also raised repeat costs: Zeus #2+ 15->40 Faith, Poseidon #2+ 20->45 Faith. A cast can no longer fund its own recast.

**4. Tray clip claim — CONFIRMED NOT REPRODUCIBLE (no change).** The tray is a mesh in the OVERLAY scene at trayY = -WORLD_HEIGHT/2 + 3 (~-47), height 5, in world units. The overlay ortho camera frustum is fixed at [+/-worldWidth/2] x [+/-50] regardless of window size; letterboxing only scales the whole canvas in CSS pixels, so the tray is always inside the frustum and its world-coord hit-test matches. There is NO window size where it clips or vanishes. The only way it hides is the deliberate game-over fade (`fadeEndUi`). The reviewer likely captured during a game-over/fade or read the black letterbox bar as empty space. Letterboxing itself is left intact per instruction (portrait submission).

**5. Currency Gd/Au — already consistent (no change).** Swept src: every ticker (HUD row, cost tokens, altar `short`) is `Gd`; the only `Au` left is one explanatory comment. Standardised to Gd last session; confirmed.

**Verified:** `node build.js` -> 290.4 KB, exit 0 (luminance gate green). Rotation 11/11, smoke 29/29. Lane spread + Faith drip changes reasoned/simulated numerically. REJECTED item (canvas fill to window) NOT applied — letterbox preserved.

**Honest caveat:** can't view the running frame here. The hull/mirror clearance and lane spread are proven by the geometry + simulation; the beam-dimming and Faith feel need an eyes-on pass (both are single-constant tweaks: `depthDim` base 0.6/floor 0.18, drip 0.15 / cap 4 / repeat costs). No palette or letterbox changes.

---

## 2026-08-25 — Revert SHIP_STOP_Y; breach at the wall again; solve mirror overlap by render order + raised mirror floor

**Why:** the previous SHIP_STOP_Y=-6 moved the breach line into open water, so the wall took damage from ships that never reached the stone — reads as a bug and undercuts the fortress. Reverted per instruction; the overlap is solved the other way.

**Reverted (`config.js`, `enemy.js`):** removed `SHIP_STOP_Y`; `RAM_STOP_EDGE`/`RAM_LINE_Y` back to `BATTLEMENT_TOP_Y` (-39). Ships descend to the battlement and breach AT THE WALL; the hull hard-clamps its leading edge to -39 (no single-frame overshoot). Breach FX (`spawnDestruction`, `spawnSmoke`, `lastBreaches` flash) fire at the wall again, where the fortress/flash/altars are.

**Mirror overlap solved the described way:**
- Render order (`enemy.js`): ship group z +0.3 -> -0.1, so hulls draw BEHIND mirror sprites (mirrors at z=0) while staying in front of beams (z<=-0.3) and background (z=-10). A ship transiting the field passes under the disc, not over it.
- Raised mirror floor (`config.js`): `MIRROR_MIN_Y` -34 -> -26. Lowest mirror bottom = centre(-26) - radius(5) = -31. A ship stopped at the wall (leading edge -39) can't sit under it.
- `mirror.js`: drag `minY` uses `MIRROR_MIN_Y`; `getMirrorFloorY()` returns `MIRROR_MIN_Y` too so the sanitize/recovery threshold matches. Starting sockets (y=-26) and purchased-mirror rows (-26/-14) are all >= -26, so nothing gets shoved.

**Restored the drag ceiling:** `clampMirrorPos maxY` back to `PRISM_Y - 150*PX` (~+11) — I had lowered it to MIRROR_FIELD_TOP as part of the SHIP_STOP_Y edit; it's not needed for clearance now, so it's restored.

**Confirmation 1 (wall reacts only on contact):** wall damage is accumulated ONLY inside the `if (atWall)` branch of updateEnemies (verified: no other `wallDamage +=`), and `atWall` = leadingEdge <= -39 with the hull clamped to rest exactly on the stone that frame. `getLastBreaches()` (flash/shake/sound triggers) is pushed only there too. So the wall bar / flash / shake cannot move until a hull's bottom edge touches the battlement — a ship mid-screen deals zero damage. A ship visibly reaches the stone before the wall reacts.

**Confirmation 2 (clearance, world units):** stopped hull bottom at -39; lowest mirror bottom at -31; clearance = 8 - shipHeight:
- liburna (2.5) -> 5.5u ; trireme (3.5) -> 4.5u ; cataphract (4.0) -> 4.0u ; quadrireme (4.5) -> 3.5u.
- quinquereme (8.0, rare late boss) -> 0.0u (meets the mirror bottom at the boundary; hidden by render order).
Every common ship clears the lowest possible mirror by 3.5-5.5u; the boss only touches at the boundary and is drawn behind the disc.

**Verified:** build 290.6 KB exit 0, luminance gate green, rotation 11/11, smoke 29/29. Only config/enemy/mirror changed — the prior lane-spread, beam-dimming and Faith fixes are untouched. No palette or letterbox changes.

**Honest caveat:** clearances/breach-gating are proven from the code + geometry; I can't watch the frame, so the eyes-on confirmation that a hull reaches the stone before the bar moves, and that hulls now pass cleanly under mirrors, is yours. Both knobs are one-liners if the boss's 0u boundary touch ever looks off (raise MIRROR_MIN_Y a touch or clamp the quinquereme's stop).

---

## 2026-08-25 — Arethusa engraving on mirrors, SPQR on Roman sails, foreground brightness lift

**1. Arethusa emblem engraved on mirror faces (`mirror.js`).** New `drawArethusa()` strikes the device of Syracuse — nymph's head in profile (facing left) with a laurel wreath and two small dolphins — into the bronze as RECESSED relief: a two-pass stroker draws a faint light bevel (rgba 255,240,205,0.18) offset down-right, then a dark recess (rgba 40,24,8,0.42) on top, so it reads as shallow engraving catching the light, never a bright decal. Scaled to a small central medallion (R = min(rx*0.42, ry*0.86)) and drawn BEFORE the specular streak so the highlight stays dominant and the elongation/angle cue is untouched. Existing shape, rim, rivets and highlight are unchanged.

**2. SPQR on the Roman sails (`enemy.js`).** Sail recoloured from cream to Roman red (vertical #9e2b24 -> #7c1f1a gradient). One shared gold "SPQR" mark (`makeSpqrTexture`, bold serif, dark outline for legibility) — NOT per-ship heraldry. It's a small transparent OVERLAY mesh (`spqrMesh`) per hull, sized/placed per type from `SAIL_METRICS` (sail rect captured in `drawShip`, converted texture-px -> the 6u sprite plane). In `updateEnemyVisual` its opacity fades `1 - burn/0.6` so it is GONE by ~60% burn ("well alight") and never survives on a burning sail; it also dims with the hull char while visible so it reads as part of the sail. Sits at group-local z 0.02 (behind mirrors with the hull, in front of its own sprite).

**3. Foreground-only brightness lift (scene read a touch dark post-pipeline).** Did NOT touch sea/sky/ground — the luminance gate still prints them unchanged (sea 2.6-4.8%, ground 1.9%, sky 0.7%) and passes. Lifted only foreground objects:
- Mirror bronze gradient stops ~+12%: #f0d18a->#ffe49a, #cf9e4c->#e6b158, #9a6a34->#ad793c, #5f3e1f->#6e4824.
- Hulls/sails: `HULL_LIFT = 1.12` applied to the sprite colour multiply (`char = (1 - burn*0.88) * 1.12`). MeshBasicMaterial multiplies, so >1 over-brightens the healthy hull ~12%; it tapers with char so a burning hull still reaches charcoal. This lifts the whole ship sprite (hull + red sail) in one place; the gold SPQR overlay is a separate mesh and stays crisp.

**Verified:** build 298.8 KB exit 0, luminance gate green (sea/sky/ground untouched), rotation 11/11, smoke 29/29. All new symbols (drawArethusa, makeSpqrTexture, SAIL_METRICS, spqrMesh, HULL_LIFT) confirmed in the bundle. No new files. Rejected extras (per-ship heraldry, altar statues, new wakes) NOT added.

**Honest caveat:** can't view the frame here. The engraving subtlety, the SPQR size/legibility on each sail, and whether +12% is the right lift are eyes-on calls — all are single-constant tweaks (engrave alpha 0.42/0.18, SPQR font/SAIL_METRICS w-h factors, HULL_LIFT 1.12, bronze stops). SPQR fade threshold (burn 0.6) is one constant if "well alight" should be earlier/later.

---

## 2026-08-25 — God abilities renamed to mythological Greek names (player-facing)

**Renamed the on-screen ability labels** (internal ids `zeus`/`poseidon`/`helios` UNCHANGED):
- Zeus -> KERAUNOS (the thunderbolt), Poseidon -> ENOSICHTHON (Homer's Earth-Shaker), Helios -> HYPERION (Homeric sun epithet).

**Where the label actually lives:** NOT strings.js. The rendered button label is the inline `label:` in `crafting.js buildShopItems`; the `GOD_ABILITIES.name` in config ('Thunderstorm'/'Maelstrom'/'Solar Overcharge') was DEAD text (never rendered). Updated both: crafting.js labels -> the Greek names; config `name` -> 'Keraunos'/'Enosichthon'/'Hyperion' with the English in comments, so nothing stale remains. strings.js has no ability labels (its `SOURCE_NAME='Helios'` is the beam-source/fiction name, not the ability — left intact).

**Legibility call (reporting as instructed — two readable lines do NOT fit):** the shop button is ~102px wide (512/5 buttons) x 40px tall, and the god buttons already stack an ICON (y8) + a text row (y20) + the COST/cooldown row (y31). Vertically there is room for exactly ONE text row between the icon and the cost; a second ability line at a readable size (>=8px) collides with the cost row. So I did NOT shrink the type and did NOT add a cramped English subtitle. Instead: the Greek name is the single main label (fits — widest is ENOSICHTHON at ~53px in a 102px cell), and the GOD identity is carried by the existing icon (thunderbolt / trident / sun), which the brief explicitly accepts ("a small line or the existing icon is enough"). The English subtitle ("Thunderbolt / Earth-Shaker / Solar Blaze") is the one thing that can't be added as a second legible line.

**Confirmed nothing else shows the old ability label:** swept src — remaining `zeus`/`helios`/`poseidon` occurrences are all internal ids (item.id, cooldown keys, icon selection) or fiction/comments; the altars (BRONZE/SILVER/GOLD) and `SOURCE_NAME` are unrelated and intact.

**Verified:** build 298.9 KB exit 0, luminance gate green, rotation 11/11, smoke 29/29. Greek labels confirmed in the bundle.

**Decision needed from you:** I kept the Greek names (your stated main label) + icon for the god, and left the English off because it can't be a second readable line. If you'd rather guarantee plain-language comprehension over the Greek term, say so and I'll switch the three buttons to English single-line (Thunderbolt / Earth-Shaker / Solar Blaze) in one edit — no type shrink either way.

---

## 2026-08-25 — Playtest: intro video handoff, god names restored, Faith retune, regression sweep

**1. Intro video (diagnosed with ffprobe/ffmpeg, not guesswork).**
- File facts for the SERVED file `assets/fixed_intro.mp4` (1.25 MB): duration **10.625s**; video **H.264, Constrained Baseline, Level 3.1**, 720x1280, yuv420p; audio **AAC-LC 44.1kHz stereo**; atom order **ftyp -> moov -> mdat**, i.e. moov BEFORE mdat = **fast-start / web-optimised**. This matches the mobile-safe baseline spec — the file is NOT the problem. (Note: there's an unrelated 11.9 MB `fixed_intro.mp4` at repo ROOT; the game serves the assets/ one.)
- Narration end via **silencedetect**: at -35, -50 AND -60 dB there is **ZERO** detected silence anywhere; last-1.5s mean -19.2 dB / max -6.6 dB; audio stream runs to 10.588s. So the audio is continuous to the end — there is no mid-file gap to transition on. Correct handoff = the natural **`ended`** event.
- Root cause of the regressions was the HANDOFF, not the file: (a) the `stalled` handler started a blind 3s timer that called startGame() if `!gameStarted` — a brief buffer stall mid-clip cut a still-playing video off (desktop "cuts off partway"); (b) the 4s "stuck" check and no readiness gate could hand off or fail on a phone cold-cache.
- Rewrote the intro IIFE: muted play() from the tap gesture (autoplay-safe) then unmute; transition on `ended`; a **progress-aware watchdog** (polls currentTime every 250ms) that ONLY hands off if playback genuinely isn't advancing (never cuts a playing video) — `neverStarted` (<0.3s after 4s), `frozenMidClip` (>3s no progress), or `pastCap` (15s absolute ceiling); plus a once-only 15s no-playback backstop. Removed the buggy blind `stalled` timer and the old 4s cut. **Readiness gate + failsafe both wired: the game starts regardless (watchdog/backstop/error), and a playing video is never cut before `ended`.** `updateDebugInfo` is a no-op when not in debug, so the **plain (non-debug) URL** runs every failsafe path identically — nothing is gated behind `?debug=1`.

**2. God names restored (`crafting.js`).** Last session the buttons showed only the Greek epithet. Added a SMALLER second line under each ability with the deity (KERAUNOS/Zeus, ENOSICHTHON/Poseidon, HYPERION/Helios) via a new `GOD_NAMES` map. Layout reflowed in the 40px button: icon shrunk (s6) at y7, Greek epithet (bold 8px) y18, god name (6px, dim) y25, cost y34 — the small second line is exactly what the brief asked for ("smaller second line ... so a player who knows nothing about Greek epithets still knows which god"). Cooldown radial still overlays cleanly.

**3. Faith economy — reported + retuned.** CURRENT (before): income = drip `min(burning,4)*0.15/s` = up to **+0.6/s** (realistically +0.3-0.45), plus **+15 per Helios cast**; Zeus repeat **40 Faith** (+5 Gd), Poseidon **45** (+8 Gd). Time to a 2nd Zeus on pure drip ≈ **100s** — that's the "two brakes stacked" (we cut the drip AND raised the cost in one pass). Simulated the real loop (Helios +15 burst is the dominant Faith source, Silver-gated by its 15-Si cost + 7s cd): at repeat=40/45 a committed run lands ~4 faith-funded casts with the first reachable ~40s; dropping to 25 overshot to 7-9. Set Zeus repeat **45**, Poseidon **50** (kept the drip cut, unstacked the brake by relaxing the cost from the effective 55 the player saw toward the number that measures at **~4 casts committed, first ~40s**, casual ~2, aggressive ~7). Openers unchanged (Zeus 25 Bz / Poseidon 40 Bz — cheap, reachable in minute one). Reported the full cost/activation curve in-session so the exact point is easy to shift.

**4. Regression sweep — clean.** Grepped the bundle: luminance gate green (sea 2.6-4.8%, ground 1.9%, sky 0.7% — untouched); hulls behind mirrors (`mesh.position.z = -0.1`); breach at the wall (`spawnDestruction(cx, BATTLEMENT_TOP_Y + half...)`); mirror floor `MIRROR_MIN_Y = -26`; enemy keys liburna/cataphract/quinquereme consistent across ENEMY_TYPES/BREACH_DAMAGE/BREACH_DRIP_PCT/SHIP_SIZE/spawner; Gd currency in HUD + costs; Arethusa engraving + SPQR overlay + HULL_LIFT all present. Build 301.9 KB exit 0, rotation 11/11, smoke 29/29. Deleted throwaway sim scripts.

**Honest caveat:** the intro handoff is fixed in logic and the file is verified mobile-spec, but I can't run a phone here — the real "plays on a phone from the plain URL" confirmation is a device test (load the plain Pages URL on a phone, tap once, confirm it plays through to the game and doesn't cut early on desktop). Faith numbers are from a model of the loop, not live play; if a committed run feels like more/fewer than 3-4, the repeat cost is a one-line change (curve reported).

---

## 2026-08-25 — Faith: fix the SOURCE (Helios +15->+8), repeat costs Zeus 25 / Poseidon 30

Applied exactly as requested: `GOD_ABILITIES.helios.faithGain` 15 -> 8; Zeus repeat 45 -> **25** Faith; Poseidon 50 -> **30**. Openers unchanged (Zeus 25 Bz, Poseidon 40 Bz).

**Re-ran the sim, now counting TOTAL Zeus+Poseidon activations (bronze openers INCLUDED), Helios listed separately as the engine:**
- CASUAL (2 burn, 0.5 Si/s): Zeus+Pos total **5** (4 zeus, 1 pos), of which 3 faith-funded; first Zeus opener @21s, **first faith repeat @56s**. Helios x6.
- COMMITTED (3 burn, 0.8 Si/s): Zeus+Pos total **8**, 6 faith-funded; first Zeus @14s, first repeat @37s. Helios x9.
- AGGRESSIVE (4 burn): Zeus+Pos total **10**, 8 faith-funded. Helios x13.

**Honest result vs the target:** the CASUAL case now lands right where the original complaint was — a repeat IS reachable (~56s), one-plus over the run, at a low/reachable price. But a COMMITTED 3-minute run still lands ~6-8, NOT 4. Cutting Helios helped, but it is NOT the dominant source over a full run: the passive drip alone at 3 ships burning is 0.45 x 180s ≈ **81 Faith ≈ 3 Zeus casts before Helios contributes anything**. So over 180s the drip floor + any Helios inevitably exceeds 4 for a committed player. My earlier "~100s to a 2nd cast" only held for a player who let fires go out; a player who sustains burning accrues Faith steadily from the drip itself.

**So the requested change is applied and improves things (casual complaint fixed, cost lower than 40), but if you want a COMMITTED run capped near 4 total, the remaining lever is the DRIP, not the price or Helios.** Proposal: drop the per-ship drip 0.15 -> 0.08 (halves the passive floor to ~43 Faith/180s ≈ under 2 casts from drip, so Helios+drip together land ~3-4 committed). I did NOT change the drip this pass since you specified Helios+prices; say the word and it's a one-line change.

**Helios flavour check:** +8 Faith over a 5s flare is +1.6/s — still a noticeable trickle, but the flare's STUN (4s) and shield-plate burn are unchanged and remain the reason to cast it. Faith is now clearly a bonus, not the point, which matches your intent. It does not feel pointless — the stun/armour-burn are untouched.

**Verified:** build 302.1 KB exit 0, luminance gate green, rotation 11/11, smoke 29/29. Values confirmed in the bundle (faithGain 8, faith 25/gold 5, faith 30/gold 8). Sim scripts deleted.

---

## 2026-08-25 — Faith: drip 0.15 -> 0.08 (the real engine), Helios 8 + repeats 25/30 kept

Applied the drip cut in `foundry.js` (`min(burning,4) * 0.08 * dt`). Helios faithGain stays 8; Zeus repeat 25 Faith, Poseidon 30; openers unchanged.

**Same table, re-run (total Zeus+Poseidon activations, bronze openers INCLUDED):**
- CASUAL (2 burn): total **4** (3 zeus, 1 pos), faith-repeats 2, first Zeus opener @21s, **first faith repeat @64s** — reachable around the one-minute mark. ✓ (matches Sasha's actual complaint being fixed)
- COMMITTED (3 burn): total **6** (5 zeus, 1 pos), **faith-funded repeats 4**, first repeat @42s. The faith-gated part is exactly 4; total is 6 with the two bronze openers.
- AGGRESSIVE (4 burn): total **8**, faith-repeats 6. Left as-is per instruction (sustaining 4 fires for 3 min earns it).

**Against the targets:** casual reachable ~1min ✓; aggressive "stays under six" — the FAITH-funded repeats are 6, total-with-openers is 8 (you said leave it if high, so left). committed "near four": the FAITH-gated repeats are exactly **4**; counting the two bronze openers makes the raw total 6. Note the model is an UPPER BOUND — it spends Faith the instant it can, never misses a Helios window, keeps 3 ships burning the entire run; a real committed player lands lower. I did not tune further to force the total to read 4, because that would mean re-touching the price/Helios you've settled, and the honest faith-gated number is already on target.

**Verified:** build 302.3 KB exit 0, luminance gate green, rotation 11/11, smoke 29/29. 0.08 drip confirmed in the bundle. Sim script deleted.

---

## 2026-08-25 — God buttons: swap lines — god name is the main label, epithet the small line

Reversed the two lines on the god ability buttons (same type sizes + positions, just which string goes where):
- Main label (bold 8px, y18): the GOD NAME — ZEUS / POSEIDON / HELIOS (all-caps to match tray style).
- Small line (6px, y25): the Greek epithet as flavour — Keraunos / Enosichthon / Hyperion (mixed-case so it reads as a name).
Implemented via `GOD_NAMES` (now the main label) + a new `EPITHETS` map (the small line); `mainLabel` picks the god name for gods, else the item's own label. Layout/positions unchanged.

**Width confirmed at the larger size:** widest god name POSEIDON (8 chars) ≈ 38px at bold 8px monospace, inside the worst-case ~102px button (512/5) with ~30px margin per side; ZEUS/HELIOS shorter. Epithet line (Enosichthon, 11 chars ≈ 40px at 6px) also fits. Text is also clipped to the button cell as a safety net. So POSEIDON fits fine at the promoted size.

**Epithet + lore sentence — no surface exists yet (reported, not built):** swept the code — there is NO ability tooltip, description panel, or cast-time text line anywhere (the only text surfaces are the shop tray buttons, the altar labels, the start-of-match tutorial banner which is full with the 3 control hints, and the win/defeat card). So the epithet lives on the button's small line for now. A cast-time lore line like "KERAUNOS, the thunderbolt the Cyclopes forged for Zeus" would be NET-NEW UI (a fired-power banner) — I did not build it unprompted this pass. Say the word and I'll add a brief lore flash when each power fires (or a tooltip), which is the natural home for the sentence.

**Verified:** build 302.7 KB exit 0, luminance gate green, rotation 11/11, smoke 29/29. Swap confirmed in the bundle.
