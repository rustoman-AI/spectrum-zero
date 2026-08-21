# SPECTRUM ZERO («Спектр 0»)

**Game Design Document, prototype scope**
Target: Meta Horizon Creator Competition, deadline Sep 8 2026
Platform: Three.js / HTML5 web build, portrait, single-player, fully offline
Session: 15 minutes, hard win/lose

---

## 1. High concept

The world has fallen to zero light. One unbroken white beam still falls through the last aperture. You are the Keeper below it, and you have fifteen minutes: split that beam into its colour bands with mirrors and prisms, feed the three foundries that keep you alive, and burn the Grey climbing up from the dark before it reaches the lens.

One finger. One beam. Three colours. Everything you spend on the economy is a second you did not spend on defence.

## 2. Genre declaration

The competition requires one genre. **Spectrum Zero is submitted as Survival & Resource Management.**

| Genre criterion | How the game satisfies it |
|---|---|
| Player gathers resources | Holding a colour band on a foundry converts light into Slag and Insight |
| Converts them into tools or defenses | Mid-run crafting of prisms, reinforced mirrors, ignition pools, repairs |
| Stays alive as pressure ramps | The Grey escalates on a fixed 15-minute curve, mirrors get broken, the source drifts |

The build also contains placement-based defence and an investment loop, so it reads as adjacent to the other two categories. That is a strength for the Most Innovative side prize but the submission should commit to Survival and use its vocabulary consistently in the Design Intent Document.

## 3. Player and fantasy

Mobile player, one hand, five to fifteen minute window, no account, no network. The fantasy is competence under pressure: you are a technician holding a collapsing system together by geometry alone. Nothing in the game is aimed and shot. Everything is angled and routed.

Reference feel: the Archimedes burning-mirrors legend, run at Plants vs. Zombies tempo.

## 4. Neurochemical design targets

The session is deliberately built to move the player through three states rather than sit in one. This is the design spine, and every tuning decision below should be checked against it.

| Minute | Target state | Cocktail | Delivered by |
|---|---|---|---|
| 0:00 to 4:00 | Flow | dopamine, acetylcholine, low cortisol | Instant visual response to every mirror rotation, forgiving mistakes, resource numbers climbing |
| 4:00 to 10:00 | Strategic risk | pulsing dopamine, anticipation | The foundry gamble: pull the beam off defence to bank an upgrade |
| 10:00 to 14:00 | Survival panic | noradrenaline, cortisol spikes | Source drift, mirrors shattering, red timer, accelerating audio |
| 14:00 to 15:00 | Clutch win | cortisol crash, dopamine burst | Manufactured near-loss, then a win that lands with seconds on the clock |

The 14th minute must feel unwinnable and be winnable. That contrast is the retention mechanism, not the art.

## 5. Core loop

1. Read where the beam currently lands
2. Drag or rotate a mirror to redirect it
3. Choose the target: an enemy (defence) or a foundry (economy)
4. Watch the response (colour returns to the target, HP drains, resources tick)
5. Spend banked resources on a craft that widens your options
6. Absorb the next escalation and repeat

Loop length is roughly 6 to 10 seconds. The player should never be more than one gesture away from a meaningful decision.

## 6. Screen layout (portrait)

```
┌─────────────────────────┐
│  APERTURE (source)      │  top 15%: white beam origin, drifts after 10:00
├─────────────────────────┤
│                         │
│   MIRROR FIELD          │  middle 55%: sockets, mirrors, prisms
│   (drag / rotate here)  │
│                         │
├─────────────────────────┤
│ AMBER  CYAN  GOLD       │  foundry band 15%: three receivers
├─────────────────────────┤
│  THE GREY rises here    │  bottom 15%: enemy lanes, lens integrity bar
└─────────────────────────┘
```

Thumb reach: all draggable objects live in the middle and lower two thirds. Nothing interactive sits in the top 15%.

## 7. Mechanics

### 7.1 The beam

A single white beam falls from the aperture. It travels in straight lines, reflects off mirrors by angle of incidence, and terminates on whatever it hits. Maximum 8 bounces per beam path.

### 7.2 Mirrors

Placed in fixed sockets. **Drag** to move between sockets, **circular swipe** on a selected mirror to rotate it, **tap** a cracked mirror to repair it (costs Slag). Mirrors take damage from enemy fire and shatter after three hits.

### 7.3 Prisms (the title mechanic)

A prism splits white light into three coloured bands that continue on diverging paths. Each band has its own downstream reflection chain.

- **Amber** feeds the Forge and burns organic enemies faster
- **Cyan** feeds the Lens Works and pierces armour
- **Gold** feeds the Chorus and slows enemies inside its cone

Chaining a second prism splits a band again into two weaker rays. This is the core tension: more coverage or more damage, never both.

### 7.4 Foundries (the economy)

Holding a band on a foundry converts light into resources at a fixed rate:

| Foundry | Band | Output |
|---|---|---|
| Forge | Amber | 4 Slag per second |
| Lens Works | Cyan | 3 Insight per second |
| Chorus | Gold | Enemy advance speed x0.5 while held, plus 1.5% Recombination charge per second |

Recombination is the win condition meter. It only fills from Gold, and Gold is the band you most want pointed at the enemy. That is the intended dilemma.

### 7.5 Enemies (the Grey)

They rise from the bottom in lanes. Reaching the lens costs integrity; three breaches is a loss. Heavier types carry emitters that crack your mirrors from range.

### 7.6 Crafting

Spent mid-run without pausing, from a single-row tray above the foundries.

| Item | Cost | Effect |
|---|---|---|
| Prism | 25 Slag, 10 Insight | Splits a beam into three bands |
| Repair | 15 Slag | Restores a cracked mirror |
| Reinforced mirror | 40 Slag | Cannot be shattered, only cracked |
| Ignition pool | 20 Slag | Dropped in a lane, ignites when any band touches it, creating a temporary burning barrier |
| Focus | 30 Insight | Permanently narrows and strengthens all bands (+15% base damage) |
| Anchor | 25 Insight | Locks one mirror against source drift in the final phase |

## 8. Combat math

### 8.1 Damage per second

```
DPS = N * D_base * (1 + Bonus * (N - 1))
final = max(0, DPS - armor * N)
```

`N` = number of bands focused on the same target, `D_base` = 10, `Bonus` = 0.3.

| Bands on target | DPS | Linear would be |
|---|---|---|
| 1 | 10 | 10 |
| 2 | 26 | 20 |
| 3 | 48 | 30 |
| 4 | 76 | 40 |

Focus is mathematically superior to spreading. The player should discover this by minute three without being told.

### 8.2 Enemy table (base values at t=0)

| Type | HP | Armour | Kill time, 1 band | Kill time, 3 bands |
|---|---|---|---|---|
| Mote | 30 | 0 | 3.0s | 0.6s |
| Husk | 100 | 0 | 10.0s | 2.1s |
| Carapace | 200 | 2 | 25.0s | 4.7s |
| Devourer (boss) | 1500 | 4 | not viable | 34.8s |

### 8.3 Escalation curve

```
hp_multiplier = 1 + (t / 900) * 3        // t in seconds, session is 900s
```

At t=60 the multiplier is 1.2 (a Husk has 120 HP). At t=840 it is 3.8 (a Husk has 380 HP and cannot be killed by a single band). The curve forces the player to graduate from sweeping to focusing.

## 9. Session arc

| Window | Content | Purpose |
|---|---|---|
| 0:00 to 4:00 | Motes only, no emitters, foundries fully safe | Teach reflection, bank first Prism |
| 4:00 to 10:00 | Husks and Carapaces, emitters start cracking mirrors | Force the defence-versus-economy gamble |
| 10:00 to 14:00 | **Drift**: the aperture starts wandering horizontally, whole mirror chains must be re-aimed live | Panic phase, punishes over-investment |
| 14:00 to 15:00 | The Devourer surfaces, source dims to 60% width | Merge all bands on one target, sacrifice lane coverage |

**Win:** Devourer destroyed, or Recombination at 100% when the clock hits 15:00 (the stored light discharges as a white lance and clears the field).
**Lose:** three lens breaches, or 15:00 with the Devourer alive and Recombination incomplete.
**Reset:** single tap, straight back into a fresh run. No menus between attempts.

## 10. Feedback (competition requirement)

Every one of these is cheap to implement and load-bearing for the judging criteria:

- Colour return: any surface a band touches desaturates back to full colour and stays tinted for a second after. The world is grey and the player is repainting it. This is the primary dopamine trigger.
- Burn meter above each enemy, filling visibly under focused light
- Resource counters tick up in real time while a band is on a foundry, with a number popping off the foundry
- Mirror cracks are visible on the mirror, not in a HUD
- Audio pitch rises with total light throughput, tempo rises across the four phases
- Timer turns red at 12:00 and the frame vignette pulses

## 11. Setting

The base fiction is deliberately abstract so that art can be built from primitives and shaders instead of asset packs, which matters for the 35MB cap.

If the team prefers a stronger hook, the same code supports a reskin with no mechanical change. Ranked by immediate legibility:

1. **Archimedes at Syracuse.** Bronze mirrors, Roman fleet, everyone already knows the legend, zero lore explanation needed
2. **Tesla at Tunguska, 1908.** Lightning traps instead of mirrors, three condensers instead of foundries
3. **The Animator's Curse.** 1930s ink studio, ink channels instead of light

Recommendation: keep Spectrum Zero for the submission (it is the more original entry in a field that will be full of medieval and sci-fi skins), and hold Syracuse as the fallback if playtesters cannot read the goal in ten seconds.

## 12. Technical plan

- **Renderer:** Three.js, orthographic camera, everything on a single plane. This is a 2D game rendered in 3D so that beams and glow can use additive blending and shaders.
- **Beam solve:** iterative raycast, recomputed only when a mirror moves, a prism is placed, or the source drifts. Cache the segment list between frames. Cap at 8 bounces and 12 total segments.
- **Rendering beams:** one quad mesh per segment with an additive glow material, not `THREE.Line` (line width is unreliable on mobile).
- **Enemies:** instanced planes, pooled, no per-enemy allocation during a run.
- **Audio:** WebAudio synthesis only, no audio files. Keeps the zip small and guarantees no network fetch.
- **Input:** pointer events, single touch, no multitouch gestures at all.
- **Frame budget:** 60fps on a mid-tier Android. Beam recomputation is event-driven, so idle frames are nearly free.

### Packaging (validation-critical)

- Single `.zip`, under 35MB, `index.html` at top level, **not** inside a folder
- All game code inside `index.html`, readable and unminified. Develop in separate files, assemble at build time with a small concatenation script
- Three.js goes in `vendor/`, referenced by relative path, **not** embedded in `index.html`
- Zero external requests. No CDN, no Google Fonts, no analytics. Test with the network disabled before submitting
- All assets, fonts and data inside the zip with relative paths

### Damage component (JS port of the combat math)

```js
function applyBeamDamage(enemy, beams, dt) {
  const n = beams.length;
  if (n === 0) return;
  const raw = n * D_BASE * (1 + SYNERGY_BONUS * (n - 1));
  const dmg = Math.max(0, raw - enemy.armor * n);
  enemy.hp -= dmg * dt;
  enemy.burn = 1 - enemy.hp / enemy.maxHp;   // drives the visible burn meter
  if (enemy.hp <= 0) destroyEnemy(enemy);    // awards Slag
}
```

## 13. Prototype scope

**Must have (this is the submission):** beam reflection, 4 mirrors, 1 prism, 3 foundries, 3 enemy types plus boss, 4 crafts, the 15-minute arc, win/lose/reset, colour-return feedback.

**Nice to have:** ignition pools, source drift, reinforced mirrors, synthesised audio layers.

**Cut without hesitation:** multiple levels, meta-progression, tutorial screens, story text, settings menus, anything with a second scene.

One level, played well, beats three levels played roughly. The judging criteria reward a playable core loop, not breadth.

## 14. Schedule to Sep 8

| Days | Work |
|---|---|
| 1 to 3 | Beam solve, mirror drag and rotate, one prism, grey box everything |
| 4 to 6 | Enemy spawner, damage math, escalation curve, lose state |
| 7 to 9 | Foundries, resources, crafting tray, win state |
| 10 to 12 | Phase arc, drift, boss, difficulty tuning against the neurochemical table |
| 13 to 15 | Feedback pass: colour return, particles, audio, timer pressure |
| 16 to 17 | Single-file assembly, vendor folder, offline validation, device testing |
| 18 | Design Intent Document, build log cleanup |
| 19 | Buffer and submit early |

## 15. Submission checklist

- [ ] `.zip` under 35MB, `index.html` at top level
- [ ] All game code in `index.html`, unminified
- [ ] Three.js in `vendor/`, relative paths
- [ ] Verified zero network requests at runtime
- [ ] Portrait, single-player, playable core loop with win/lose/reset
- [ ] Design Intent Document: `.docx`, 500 words max, English, **no names or identifying information**
- [ ] Build Log `.md`, kept from day one, showing AI did the heavy lifting
- [ ] MHCP membership confirmed (registered on or before Aug 10 2026)

## 16. Open questions

1. Is the Recombination win condition legible enough, or does the run need a simpler "kill the boss" goal only?
2. Do three colour bands overload a portrait screen at 5-inch scale? Test two bands before committing to three.
3. Does the drift phase read as difficulty or as unfairness? It is the highest-risk mechanic in the document.
4. Which one of the three genres does the final build most obviously demonstrate to a judge who plays for 90 seconds?
