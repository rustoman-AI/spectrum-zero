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
