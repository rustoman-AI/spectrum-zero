# Spectrum Zero - Tasks

Structured as vertical slices. Each milestone is playable and testable in a browser before moving to the next.

Reference: `design.md`, `requirements.md`, `spectrum-zero-gdd.md`

---

## M1: Beam Solve & Mirror Field (Grey-box)

**Exit criteria:** White beam visible on screen, reflects off 4 draggable/rotatable mirrors, splits through 1 prism into 3 coloured bands. All grey-box visuals. Runs in browser from index.html.

| # | Task | Reqs | Files |
|---|------|------|-------|
| 1.1 | Create `src/config.js` with initial constants: `D_BASE`, `SYNERGY_BONUS`, beam width, max bounces (8), max segments (12), prism split angles, world dimensions (height=100), socket positions | FR-1.3, NFR-8 | src/config.js |
| 1.2 | Create `src/renderer.js`: init Three.js scene, orthographic camera (portrait, world height 100), WebGL renderer, canvas full-screen, resize handler, background black | FR-8.3, NFR-1 | src/renderer.js |
| 1.3 | Create `src/main.js`: import all modules, requestAnimationFrame loop with delta clamping (max 1/30), call update/render in correct order per design.md game loop | — | src/main.js |
| 1.4 | Create `src/beam.js`: iterative raycast solver. Cast from source position downward, test intersections against mirrors and prisms, reflect on mirror hit, split on prism hit. Return segment list. Comment the reflection math. | FR-1.1–1.7 | src/beam.js |
| 1.5 | Create `src/beam-render.js`: quad mesh pool for beam segments. Each segment = 2-triangle quad with `AdditiveBlending` material. Colour per band (white, amber, cyan, gold). Rebuild from segment list. Hide unused. | FR-1.1 | src/beam-render.js |
| 1.6 | Create `src/mirror.js`: 4 mirror objects with socket positions, angle, hit state. Grey-box visual (rectangle planes). Expose state for beam solver. | FR-2.1 | src/mirror.js |
| 1.7 | Create `src/input.js`: pointer event listener (pointerdown/move/up). State machine: IDLE → DRAG (move mirror between sockets) → ROTATE (circular swipe changes angle). Set `beam.dirty` on any mirror change. | FR-2.2, FR-2.3, FR-8.1–8.2 | src/input.js |
| 1.8 | Create `src/prism.js`: 1 prism pre-placed (hardcoded socket for M1). Split logic: incoming beam forks into 3 bands at configured divergence angles. Integrate with beam solver. | FR-1.5–1.6 | src/prism.js |
| 1.9 | Create `build.js`: Node script that reads HTML template + `src/*.js` in dependency order, injects into `<script type="module">` block, writes `index.html`. Template includes Three.js import from `vendor/three.module.js`. | NFR-4, NFR-5, NFR-6 | build.js |
| 1.10 | Download Three.js ES module into `vendor/three.module.js`. Verify relative import works from index.html. | NFR-5 | vendor/three.module.js |
| 1.11 | Integration test: run `node build.js`, open `index.html` in browser, confirm beam reflects off all 4 mirrors, prism splits into 3 colours, drag and rotate work. | — | — |

---

## M2: Enemies, Damage & Lose State

**Exit criteria:** Enemies spawn from bottom, advance in lanes, take damage from beam, die with correct DPS math. 3 breaches = game over screen. Escalation curve active.

| # | Task | Reqs | Files |
|---|------|------|-------|
| 2.1 | Create `src/enemy.js`: enemy pool (64 max), `InstancedMesh` with plane geometry. Pool activate/deactivate. Per-enemy state: type, hp, maxHp, armour, lane, y, speed, burn, active. Update: advance y toward lens each frame. | FR-3.1, FR-3.6 | src/enemy.js |
| 2.2 | Create `src/enemy-spawner.js`: spawn schedule for Phase 1 (Motes only). Timer-based spawning. Apply escalation multiplier `1 + (t/900)*3` to HP on spawn. | FR-3.3, FR-3.4, FR-7.2 | src/enemy-spawner.js |
| 2.3 | Create `src/damage.js`: each frame, for each active enemy, count beam segments intersecting its hitbox. Apply DPS formula: `N * D_BASE * (1 + SYNERGY_BONUS * (N-1))`, subtract armour. Comment the damage formula. Decrement HP. On kill: deactivate enemy, award Slag. | FR-4.1–4.4 | src/damage.js |
| 2.4 | Add breach detection to `src/enemy.js` or `src/session.js`: if enemy y >= lens threshold, increment breach counter, deactivate enemy. | FR-3.2 | src/enemy.js, src/session.js |
| 2.5 | Create `src/session.js` (partial): elapsed timer, breach counter, lose state (3 breaches). Display game-over overlay with "tap to restart". Reset all modules on tap. | FR-7.7, FR-7.8 | src/session.js |
| 2.6 | Add Gold band slow effect: if a Gold segment intersects an enemy, apply speed x0.5. | FR-3.7 | src/damage.js |
| 2.7 | Integration test: enemies spawn and march up, beam kills them at correct rates (verify Mote dies in 3s with 1 band), 3 breaches triggers game over, restart works. | — | — |

---

## M3: Foundries, Resources, Crafting & Win State

**Exit criteria:** Three foundries produce Slag/Insight/Recombination when lit. Crafting tray lets player buy Prism, Repair, Reinforced Mirror, Ignition Pool, Focus, Anchor. Win at 100% Recombination or Devourer dead.

| # | Task | Reqs | Files |
|---|------|------|-------|
| 3.1 | Create `src/foundry.js`: 3 foundry objects (Forge, Lens Works, Chorus) positioned in foundry band. Each frame, check if matching-colour beam segment hits them. Accumulate: Slag 4/s, Insight 3/s, Recombination 1.5%/s. Expose resource state. | FR-5.1–5.5 | src/foundry.js |
| 3.2 | Add resource HUD: Slag, Insight, and Recombination % counters rendered as on-screen text (Three.js sprite or canvas overlay). Always visible. | FR-5.6 | src/foundry.js or new src/hud.js |
| 3.3 | Create `src/crafting.js`: single-row tray above foundries. 6 craft buttons with costs from config.js. Grey out if unaffordable. On tap: deduct resources, trigger effect. | FR-6.1–6.8 | src/crafting.js |
| 3.4 | Implement craft effects — Prism: spawn new prism into placement mode (next socket tap places it), set beam.dirty. Repair: restore tapped cracked mirror. Reinforced Mirror: upgrade a mirror. Ignition Pool: place in lane. Focus: increase D_BASE by 15%. Anchor: lock mirror against drift. | FR-6.2–6.7 | src/crafting.js, src/prism.js, src/mirror.js |
| 3.5 | Expand `src/session.js` with win condition: Recombination >= 100% at 15:00 OR Devourer killed. Display win overlay. | FR-7.6 | src/session.js |
| 3.6 | Add session timer display (mm:ss) to HUD, always visible. | FR-7.1 | src/session.js or src/hud.js |
| 3.7 | Integration test: direct beams to foundries, watch resources tick, buy a prism, verify new split appears. Reach 100% Recombination to trigger win. | — | — |

---

## M4: Four-Phase Arc, Drift, Boss & Tuning

**Exit criteria:** Full 15-minute session plays through all 4 phases with correct enemy composition, source drift in phase 3, Devourer in phase 4. Game is winnable and losable within the intended timeline.

| # | Task | Reqs | Files |
|---|------|------|-------|
| 4.1 | Expand `src/enemy-spawner.js` with full phase table: Phase 1 Motes, Phase 2 Husks+Carapaces+emitters, Phase 3 same + faster, Phase 4 Devourer. Configure spawn intervals and lane selection per phase in config.js. | FR-7.2–7.5, FR-3.3 | src/enemy-spawner.js, src/config.js |
| 4.2 | Implement emitter enemies: Carapaces/Husks with emitters fire at a random mirror every N seconds, incrementing mirror hit counter. Mirror shatters at 3 hits. | FR-2.4, FR-3.5 | src/enemy.js, src/mirror.js |
| 4.3 | Create `src/drift.js`: active when t >= 600s. Aperture x oscillates (sine + noise). Each frame sets beam.dirty. Anchored mirrors unaffected (their angle still correct despite source shift). | FR-7.4 | src/drift.js |
| 4.4 | Implement Devourer (boss): spawns at t=840s, 1500 HP * escalation, 4 armour, advances slowly. Source dims to 60% width (narrower beam origin). | FR-7.5 | src/enemy-spawner.js, src/config.js |
| 4.5 | Tuning pass: adjust spawn rates, escalation curve, foundry rates, and craft costs so that a skilled player can win at 14:50–15:00. Verify Mote dies in 3s at t=0, Husk at 10s, Carapace at 25s with 1 band. | FR-3.3, FR-8.2 | src/config.js |
| 4.6 | Add phase transition events: notify other systems of phase change (e.g., spawner switches table, drift activates, Devourer spawns). | FR-7.2–7.5 | src/session.js |
| 4.7 | Integration test: play through full 15 minutes (or use debug fast-forward). Verify all phases transition correctly, drift is active in phase 3, Devourer appears in phase 4, win/lose both achievable. | — | — |

---

## M5: Feedback Pass (Juice)

**Exit criteria:** Colour return, burn meters, particles, WebAudio, timer pressure all functional. The game feels responsive and escalates tension per the neurochemical table.

| # | Task | Reqs | Files |
|---|------|------|-------|
| 5.1 | Create `src/feedback.js`: colour return system. Track which objects are currently lit by beam. Tint their material toward beam colour. Fade back to grey over 1 second when beam leaves. | FR-9.1 | src/feedback.js |
| 5.2 | Add burn meter: thin bar above each active enemy, width = `enemy.burn` (0..1). Render as small plane in enemy instance or separate instanced mesh. | FR-9.2 | src/feedback.js, src/enemy.js |
| 5.3 | Add resource pop numbers: when foundry is active, spawn floating "+4" numbers that drift up and fade. Small pooled text sprites. | FR-9.3 | src/feedback.js |
| 5.4 | Add mirror crack visuals: overlay crack texture/pattern on mirror mesh based on hit count (1, 2, 3). Procedural (lines drawn on a canvas texture) to avoid asset files. | FR-9.4 | src/mirror.js |
| 5.5 | Create `src/audio.js`: WebAudio context, oscillator-based beam hum (gain scales with active bands), phase tempo (BPM ramp), event sounds (kill, craft, crack, breach) as short enveloped tones. | FR-10.1–10.4 | src/audio.js |
| 5.6 | Timer pressure: timer text turns red at t=720s (12:00). Add vignette overlay quad that pulses opacity after 12:00. | FR-9.6 | src/feedback.js, src/session.js |
| 5.7 | Kill/craft particles: on enemy kill or craft purchase, emit burst of small coloured quads from the event position. Pooled particle system (instanced planes, ~32 particles). | FR-9.1 | src/feedback.js |
| 5.8 | Integration test: verify colour return is visible on mirrors/foundries/enemies, audio plays without clicks/pops, burn meters track damage, timer pressure kicks in at 12:00. | — | — |

---

## M6: Build, Packaging & Validation

**Exit criteria:** `node build.js` produces index.html. Zip contains index.html + vendor/three.module.js at top level, under 35 MB. Game runs from file:// with network disabled. All code readable and unminified.

| # | Task | Reqs | Files |
|---|------|------|-------|
| 6.1 | Finalise `build.js`: ensure all src/ files are concatenated in correct dependency order, wrapped in module block, injected into HTML template. Output index.html at project root. | NFR-4 | build.js |
| 6.2 | Add zip packaging to `build.js` (or separate `package.js`): create zip with `index.html` and `vendor/three.module.js` at root level. Use Node built-in zlib or a zero-dependency zip writer. Report file size. | NFR-3 | build.js or package.js |
| 6.3 | Offline validation: open index.html from file:// URL with network disabled (airplane mode or DevTools network off). Verify zero failed requests, game loads and plays correctly. | NFR-2 | — |
| 6.4 | Verify no external URLs: grep all source files and final index.html for `http://`, `https://`, `//cdn`, `fetch(`, `XMLHttpRequest`, `@import url`. Must find zero matches. | NFR-2 | — |
| 6.5 | Verify code is unminified: open index.html, confirm all variable names are readable, comments present, no single-line compressed blocks. | NFR-4 | — |
| 6.6 | Verify zip structure: unzip and confirm index.html is at top level (not inside a folder), vendor/three.module.js present. Confirm zip < 35 MB. | NFR-3 | — |
| 6.7 | Device test: load on an Android phone (mid-tier), confirm portrait, 60fps, touch input works, full session playable. | NFR-1, FR-8.3 | — |
| 6.8 | Final BUILD_LOG.md update with completion entry. | — | BUILD_LOG.md |
