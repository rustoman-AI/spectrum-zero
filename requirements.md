# Spectrum Zero - Requirements

Reference: `spectrum-zero-gdd.md` (source of truth for all numbers)

---

## FR-1: Beam System

| ID | Requirement |
|----|-------------|
| FR-1.1 | A single white beam originates from the aperture at the top of the screen and travels downward in a straight line. |
| FR-1.2 | The beam reflects off mirrors by angle of incidence = angle of reflection. |
| FR-1.3 | Maximum 8 bounces per beam path, maximum 12 total segments (including post-prism sub-beams). |
| FR-1.4 | Beam path is recomputed ONLY on event: mirror moved, mirror rotated, prism placed, source drifted. Cached between frames. |
| FR-1.5 | A prism splits a white beam into three colour bands: Amber, Cyan, Gold. Each band continues on a diverging path with its own reflection chain. |
| FR-1.6 | A second prism can split one band into two weaker sub-rays (halved intensity). |
| FR-1.7 | Beam terminates on the first surface it hits (mirror, prism, enemy, foundry, or screen edge). |

## FR-2: Mirrors

| ID | Requirement |
|----|-------------|
| FR-2.1 | 4 mirrors available at game start, placed in fixed sockets on the mirror field. |
| FR-2.2 | Drag a mirror to move it between sockets. |
| FR-2.3 | Circular swipe on a selected mirror to rotate it continuously. |
| FR-2.4 | Mirrors take damage from enemy emitter fire and shatter after 3 hits. |
| FR-2.5 | A cracked mirror can be repaired by tapping it (costs 15 Slag). |
| FR-2.6 | Reinforced mirrors (crafted) cannot shatter, only crack (never fully destroyed). |

## FR-3: Enemies (the Grey)

| ID | Requirement |
|----|-------------|
| FR-3.1 | Enemies rise from the bottom of the screen in lanes toward the lens (top). |
| FR-3.2 | Three breach events = lose state. A breach occurs when an enemy reaches the lens. |
| FR-3.3 | Four enemy types with base stats at t=0: Mote (30 HP, 0 armour), Husk (100 HP, 0 armour), Carapace (200 HP, 2 armour), Devourer/boss (1500 HP, 4 armour). |
| FR-3.4 | HP escalation: `hp_multiplier = 1 + (t / 900) * 3` where t is elapsed seconds. |
| FR-3.5 | Heavier enemy types carry emitters that crack mirrors from range. |
| FR-3.6 | Enemies are pooled instanced planes. No per-enemy allocation during a run. |
| FR-3.7 | Gold band slows enemies inside its cone: advance speed x0.5 while held on them. |

## FR-4: Damage

| ID | Requirement |
|----|-------------|
| FR-4.1 | DPS formula: `DPS = N * D_BASE * (1 + SYNERGY_BONUS * (N - 1))` where N = bands on target, D_BASE = 10, SYNERGY_BONUS = 0.3. |
| FR-4.2 | Armour reduction: `final = max(0, DPS - armor * N)`. |
| FR-4.3 | Damage applied per frame as `final * dt`. |
| FR-4.4 | On kill, enemy awards Slag (amount TBD per type, tunable in config). |

## FR-5: Foundries (Economy)

| ID | Requirement |
|----|-------------|
| FR-5.1 | Three foundries positioned in a band below the mirror field: Forge (Amber), Lens Works (Cyan), Chorus (Gold). |
| FR-5.2 | Forge produces 4 Slag/second while an Amber band is held on it. |
| FR-5.3 | Lens Works produces 3 Insight/second while a Cyan band is held on it. |
| FR-5.4 | Chorus: enemy advance speed x0.5 while Gold band held, plus 1.5% Recombination charge per second. |
| FR-5.5 | Recombination is the win condition meter (0-100%). Only fills from Gold on the Chorus. |
| FR-5.6 | Resource counters (Slag, Insight, Recombination %) are always visible on screen. |

## FR-6: Crafting

| ID | Requirement |
|----|-------------|
| FR-6.1 | Crafting tray is a single row above the foundries, accessible mid-run without pausing. |
| FR-6.2 | Prism: 25 Slag + 10 Insight. Splits a beam into three bands. |
| FR-6.3 | Repair: 15 Slag. Restores a cracked mirror to full. |
| FR-6.4 | Reinforced Mirror: 40 Slag. Cannot be shattered, only cracked. |
| FR-6.5 | Ignition Pool: 20 Slag. Dropped in a lane, ignites when any band touches it, creates a temporary burning barrier. |
| FR-6.6 | Focus: 30 Insight. Permanently narrows and strengthens all bands (+15% base damage). |
| FR-6.7 | Anchor: 25 Insight. Locks one mirror against source drift in the final phase. |
| FR-6.8 | Crafting is instant. Tap to purchase if resources are sufficient, greyed out otherwise. |

## FR-7: Session Arc (15 minutes)

| ID | Requirement |
|----|-------------|
| FR-7.1 | Session timer counts from 0:00 to 15:00, always visible. |
| FR-7.2 | Phase 1 (0:00-4:00): Motes only, no emitters, foundries safe. Teach reflection. |
| FR-7.3 | Phase 2 (4:00-10:00): Husks and Carapaces, emitters start cracking mirrors. |
| FR-7.4 | Phase 3 (10:00-14:00): Source drift begins - aperture wanders horizontally, all beam chains must be re-aimed live. |
| FR-7.5 | Phase 4 (14:00-15:00): The Devourer surfaces, source dims to 60% width. |
| FR-7.6 | Win: Devourer destroyed OR Recombination at 100% when clock hits 15:00. |
| FR-7.7 | Lose: 3 lens breaches OR 15:00 reached with Devourer alive and Recombination incomplete. |
| FR-7.8 | Reset: single tap after win/lose, immediate fresh run. No menus between attempts. |

## FR-8: Input

| ID | Requirement |
|----|-------------|
| FR-8.1 | Pointer events only (pointerdown, pointermove, pointerup). |
| FR-8.2 | Single touch. No multitouch gestures. |
| FR-8.3 | Portrait orientation only. |
| FR-8.4 | All draggable objects live in the middle and lower two-thirds of the screen. Nothing interactive in the top 15%. |

## FR-9: Feedback

| ID | Requirement |
|----|-------------|
| FR-9.1 | Colour return: any surface a beam touches desaturates back to full colour, stays tinted for 1 second after beam leaves. |
| FR-9.2 | Burn meter above each enemy, fills visibly under focused light. |
| FR-9.3 | Resource counters tick up in real time while a band is on a foundry, with a number popping off. |
| FR-9.4 | Mirror cracks are visible on the mirror mesh, not in a HUD. |
| FR-9.5 | Audio pitch rises with total light throughput, tempo rises across the four phases. |
| FR-9.6 | Timer turns red at 12:00, frame vignette pulses. |

## FR-10: Audio

| ID | Requirement |
|----|-------------|
| FR-10.1 | WebAudio synthesis only. Zero audio files. |
| FR-10.2 | Beam hum proportional to throughput. |
| FR-10.3 | Escalating tempo across phases. |
| FR-10.4 | Hit/kill/craft sound cues via oscillators. |

## NFR: Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-1 | 60 fps on a mid-tier Android phone. |
| NFR-2 | Zero network requests. Fully offline from file:// URL. |
| NFR-3 | Single .zip under 35 MB, index.html at top level. |
| NFR-4 | All code in index.html, unminified, readable. |
| NFR-5 | Three.js in vendor/three.module.js, relative path reference. |
| NFR-6 | No npm runtime dependencies. Build script is Node only (dev dependency). |
| NFR-7 | All source files under 300 lines. |
| NFR-8 | Balance numbers centralised in src/config.js. |
