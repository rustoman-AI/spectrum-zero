# Spectrum Zero - Technical Design

Reference: `spectrum-zero-gdd.md`, `requirements.md`

---

## 1. Project Structure

```
Спектр 0/
├── index.html              ← final assembled output (build artifact)
├── build.js                ← Node script: concatenates src/ into index.html
├── vendor/
│   └── three.module.js     ← Three.js library (ES module, relative import)
├── src/
│   ├── config.js           ← all balance numbers, phase timings, costs
│   ├── main.js             ← entry point: init scene, start game loop
│   ├── renderer.js         ← Three.js setup, ortho camera, resize handler
│   ├── input.js            ← pointer event handling, drag/rotate state machine
│   ├── beam.js             ← beam solver (raycast, reflection, prism split)
│   ├── beam-render.js      ← quad mesh generation, additive glow material
│   ├── mirror.js           ← mirror objects, socket system, damage state
│   ├── prism.js            ← prism placement, split angle logic
│   ├── enemy.js            ← enemy pool, instanced planes, lane movement
│   ├── enemy-spawner.js    ← spawn schedule, escalation curve, phase table
│   ├── damage.js           ← DPS formula, armour, kill handling
│   ├── foundry.js          ← three foundries, resource accumulation logic
│   ├── crafting.js         ← craft tray UI, purchase logic, item effects
│   ├── session.js          ← 15-min timer, phase transitions, win/lose/reset
│   ├── drift.js            ← source drift logic for phase 3+
│   ├── feedback.js         ← colour return, burn meters, vignette, particles
│   └── audio.js            ← WebAudio synthesis, pitch/tempo scaling
├── BUILD_LOG.md
├── spectrum-zero-gdd.md
├── requirements.md
├── design.md
├── tasks.md
└── .kiro/
    └── steering/
        └── spectrum-zero-constraints.md
```

## 2. Architecture Overview

### 2.1 Module Graph (dependency flow)

```
main.js
 ├── config.js          (imported by nearly everything)
 ├── renderer.js        (creates scene, camera, renders each frame)
 ├── input.js           (emits events consumed by mirror.js, crafting.js)
 ├── beam.js            (consumes mirror/prism state, produces segment list)
 ├── beam-render.js     (consumes segment list, manages quad meshes)
 ├── mirror.js          (consumes input events, exposes mirror state)
 ├── prism.js           (consumes input/crafting events, exposes prism state)
 ├── enemy.js           (pool, instanced mesh, exposes active enemy list)
 ├── enemy-spawner.js   (consumes session time, drives enemy.js)
 ├── damage.js          (consumes beam segments + enemy list, applies DPS)
 ├── foundry.js         (consumes beam segments, accumulates resources)
 ├── crafting.js        (consumes resources, produces items)
 ├── session.js         (master clock, phase state, win/lose evaluation)
 ├── drift.js           (consumes session time, mutates source position)
 ├── feedback.js        (consumes game state, drives visual effects)
 └── audio.js           (consumes session phase + game events, drives sound)
```

### 2.2 Game Loop

```
main.js loop (requestAnimationFrame):
  1. dt = clock.getDelta(), clamped to 1/30 max (prevent spiral of death)
  2. session.update(dt)          → advance timer, check phase transitions
  3. drift.update(dt)            → move aperture if phase >= 3
  4. input.update()              → process queued pointer events
  5. IF beam is dirty:
       beam.solve()             → iterative raycast, produce segment list
       beamRender.rebuild()     → update quad meshes
       beam.dirty = false
  6. enemySpawner.update(dt)    → spawn new enemies per schedule
  7. enemy.update(dt)           → advance all active enemies in lanes
  8. damage.update(dt)          → apply beam DPS to enemies in beam paths
  9. foundry.update(dt)         → accumulate resources for lit foundries
  10. feedback.update(dt)       → animate colour return, burn meters, particles
  11. audio.update(dt)          → adjust pitch/tempo
  12. session.checkEndConditions() → evaluate win/lose
  13. renderer.render()         → one draw call
```

### 2.3 Dirty Flag System

The beam is expensive to solve. It recomputes ONLY when `beam.dirty` is set true by:
- `mirror.js`: mirror dragged to new socket or rotated
- `prism.js`: prism placed or removed
- `drift.js`: source position changed (each frame during drift phase)
- `crafting.js`: Focus purchased (beam width changes)

All other frames skip steps 5 entirely and render the cached quad meshes.

## 3. Component Design

### 3.1 Beam Solver (`beam.js`)

**Algorithm:** Iterative raycast from source position downward.

```
segments = []
origin = source.position
direction = source.direction (initially straight down)
for i in 0..MAX_BOUNCES:
    hit = castRay(origin, direction, mirrors, prisms, foundries, enemies, bounds)
    segments.push({ start: origin, end: hit.point, colour: currentColour })
    if hit.type == 'mirror':
        direction = reflect(direction, hit.normal)
        origin = hit.point
    elif hit.type == 'prism':
        // fork into 3 sub-beams at fixed divergence angles
        for each band in [amber, cyan, gold]:
            solveSubBeam(hit.point, prismExitAngle(band, direction), band, remainingBounces)
        break
    else:
        break  // beam terminates (enemy, foundry, edge)
```

- Cap: 8 bounces total, 12 segments total across all sub-beams.
- The castRay function tests against all collidable objects (mirrors, prisms, foundries, enemy hitboxes, screen bounds) and returns the nearest hit.
- Reflection: `r = d - 2*(d·n)*n` (standard specular reflection).

### 3.2 Beam Renderer (`beam-render.js`)

Each segment becomes a quad (two triangles) with:
- Width: configurable in config.js (base ~8px equivalent in world units)
- Material: `MeshBasicMaterial` with `blending: THREE.AdditiveBlending`, colour tinted per band
- Glow: second slightly wider quad behind at lower opacity for soft glow effect

Segments are stored in a fixed-size pool of pre-allocated meshes. On rebuild, reuse existing meshes and hide unused ones (`mesh.visible = false`).

### 3.3 Mirrors (`mirror.js`)

**Data model:**
```js
{
  id: number,
  socketIndex: number,      // which socket it occupies
  angle: number,            // rotation in radians
  hits: number,             // 0, 1, 2, 3 = shattered
  reinforced: boolean,
  anchored: boolean         // immune to drift re-aim pressure
}
```

**Sockets:** Fixed positions on the mirror field (grid or hand-placed). A socket is generic and holds 0 or 1 object (mirror or prism). Dragging onto an occupied socket swaps the two objects.

**Input interaction:**
- Drag start on mirror → enter DRAG mode, mirror follows pointer, snaps to nearest empty socket on release
- Circular gesture on selected mirror → ROTATE mode, angle follows pointer angle relative to mirror centre
- Any state change → set `beam.dirty = true`

### 3.4 Prism (`prism.js`)

Prisms share the same generic socket grid as mirrors. A socket holds exactly one object of any type (mirror or prism). Dragging a prism onto an occupied socket swaps the two objects. This means placing a prism costs a mirror position — the split-versus-reach tradeoff is physical and visible.

Split angles: fixed divergence (e.g., -30deg, 0deg, +30deg from incoming direction, tunable in config).

### 3.5 Enemy Pool (`enemy.js`)

**Instanced rendering:** One `THREE.InstancedMesh` with a plane geometry, max instance count set to pool size (e.g., 64).

**Pool structure:**
```js
pool = Array(POOL_SIZE).fill(null).map(() => ({
  active: false,
  type: 'mote',
  hp: 0, maxHp: 0, armour: 0,
  lane: 0,
  y: 0,           // position in lane (0 = bottom, 1 = lens)
  speed: 0,
  burn: 0         // visual burn meter 0..1
}))
```

Activate by finding first `active === false`, set stats from type table * escalation multiplier.

### 3.6 Damage (`damage.js`)

Per frame, for each active enemy, count how many beam segments intersect its hitbox (circle or rect test against segment line). Apply formula:

```js
// N = number of bands hitting this enemy
// D_BASE = 10, SYNERGY_BONUS = 0.3 (from config.js)
const raw = N * D_BASE * (1 + SYNERGY_BONUS * (N - 1));
const dmg = Math.max(0, raw - enemy.armour * N);
enemy.hp -= dmg * dt;
```

### 3.7 Foundries (`foundry.js`)

Three static objects positioned in the foundry band. Each frame, check if any beam segment terminates on the foundry (or passes through its hitbox). If yes, accumulate resources:

- Forge: `slag += 4 * dt` (Amber band)
- Lens Works: `insight += 3 * dt` (Cyan band)
- Chorus: slow active, `recombination += 1.5 * dt` (Gold band, in percent)

### 3.8 Crafting (`crafting.js`)

Single-row tray rendered as buttons/icons. Each item has a cost check against current Slag/Insight. On tap:
1. Deduct resources
2. Apply effect immediately (spawn prism, repair mirror, etc.)
3. Set `beam.dirty` if the craft affects beam path

### 3.9 Session Controller (`session.js`)

Master clock (seconds elapsed). Drives:
- Phase transitions at 240s, 600s, 840s
- Spawn table selection per phase
- Win/lose evaluation each frame
- Reset: re-initialise all modules to fresh state

### 3.10 Source Drift (`drift.js`)

Active during phase 3+ (t >= 600s). Aperture x-position oscillates using a slow sine + random perturbation. Each frame drift is active, `beam.dirty = true` (unavoidable, but drift is smooth so framerate cost is acceptable since beam solve is cheap at 8 bounces).

### 3.11 Audio (`audio.js`)

WebAudio API, no files. Oscillator-based:
- Beam hum: continuous tone, gain proportional to active beam count
- Phase tempo: BPM increases per phase (e.g., 80 → 100 → 120 → 140)
- Events: short enveloped oscillator bursts for kill, craft, crack, breach

### 3.12 Feedback (`feedback.js`)

- Colour return: track which objects are "lit" this frame. Set their material colour toward the beam colour. Fade back to grey over 1 second when unlit.
- Burn meter: thin bar above enemy, scaled by `enemy.burn` (0..1).
- Vignette: full-screen quad with radial gradient, opacity pulses after t=720s.
- Particles: small instanced quads emitted on kill/craft events, pooled.

## 4. Coordinate System

- Orthographic camera, world units mapped to screen height.
- World height = 100 units (fixed). Width varies by aspect ratio (portrait ≈ 56 units at 9:16).
- Origin at screen centre. Y-up.
- Aperture at y = +50 (top), enemies spawn at y = -50 (bottom).
- Foundry band at y ≈ -25.

## 5. Build System (`build.js`)

A Node.js script (no dependencies) that:
1. Reads an HTML template with a `<!-- INJECT -->` marker
2. Reads all `src/*.js` files in dependency order (hardcoded ordered list)
3. Wraps each in a comment header (`// === src/config.js ===`)
4. Injects them into a `<script type="module">` block inside the HTML template
5. Writes `index.html` to the project root

The template includes:
- `<meta viewport>` for portrait
- A `<script>` tag that imports Three.js: `import * as THREE from './vendor/three.module.js'`
- The injected game code block
- Inline CSS (minimal: full-screen canvas, no scroll, background black)

## 6. Zip Packaging

A second script or extension of `build.js`:
1. Run the assembly step above
2. Create a .zip containing: `index.html`, `vendor/three.module.js`
3. Verify index.html is at zip root (no parent folder)
4. Report zip size (must be < 35 MB)

## 7. Performance Budget

| Concern | Budget |
|---------|--------|
| Beam solve | < 1ms (8 bounces, ~20 collidables) |
| Enemy update | < 0.5ms (64 pooled, simple Y advance) |
| Damage check | < 0.5ms (12 segments × 64 enemies = 768 tests, simple AABB) |
| Draw calls | < 10 (instanced enemies, beam quad pool, foundries, mirrors, UI) |
| Total frame | < 16ms at 60fps |

## 8. Data Flow for Key Scenarios

### Scenario: Player rotates a mirror

```
input.js detects circular gesture → mirror.js updates angle → sets beam.dirty = true
→ next frame: beam.js re-solves → beam-render.js rebuilds quads
→ damage.js picks up new intersections → enemy takes damage or foundry starts producing
```

### Scenario: Enemy reaches lens

```
enemy.js advances y toward +50 → y exceeds lens threshold
→ session.js increments breach counter → if breaches >= 3: lose state
→ enemy returned to pool
```

### Scenario: Player crafts a prism

```
crafting.js verifies 25 Slag + 10 Insight available → deducts → prism.js spawns prism
→ enters placement mode (next tap on socket places it) → beam.dirty = true
→ beam now splits, three new segments appear
```
