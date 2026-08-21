// ============================================================
// src/config.js — All balance numbers and world dimensions
// Tune ONLY this file. No magic numbers elsewhere.
// ============================================================

// --- World ---
export const WORLD_HEIGHT = 100;
// Width is derived from aspect ratio at runtime; portrait ~56 at 9:16

// --- Layout (Y positions, origin at centre, Y-up) ---
// Zone order top-to-bottom: Aperture -> Mirror Field -> Foundry Band -> Breach Line -> Enemy Zone
export const APERTURE_Y = 45;          // beam source (top)
export const MIRROR_FIELD_TOP = 25;    // top of mirror sockets
export const MIRROR_FIELD_BOT = -5;    // bottom of mirror sockets
export const FOUNDRY_Y = -15;          // foundry band centre (between mirrors and enemies)
export const BREACH_Y = -24;           // enemies breach here = lose a heart
export const ENEMY_SPAWN_Y = -48;      // where enemies appear (bottom)
export const ENEMY_LANE_COUNT = 5;
export const LENS_Y = BREACH_Y;        // alias for breach threshold

// --- Enemy travel time ---
// Mote crosses spawn-to-breach in this many seconds during Phase 1.
// Speeds for other types are ratios of this.
export const MOTE_TRAVEL_TIME_S = 8;
// Distance from spawn to breach
export const ENEMY_TRAVEL_DIST = BREACH_Y - ENEMY_SPAWN_Y; // positive (24 units)

// --- Beam ---
export const MAX_BOUNCES = 8;
export const MAX_SEGMENTS = 12;
export const BEAM_WIDTH = 1.2;        // world units, visual width of quad
export const BEAM_GLOW_WIDTH = 2.4;   // wider glow layer behind
// Total spread between outer bands in degrees. Each outer band deviates by half this.
export const PRISM_SPREAD_DEG = 20;
export const PRISM_SPLIT_ANGLE = (PRISM_SPREAD_DEG / 2) * (Math.PI / 180); // radians per outer band

// --- Damage ---
export const D_BASE = 10;
export const SYNERGY_BONUS = 0.3;
// DPS = N * D_BASE * (1 + SYNERGY_BONUS * (N - 1))
// final = max(0, DPS - armour * N)

// --- Enemy base stats (at t=0) ---
// Speeds derived from MOTE_TRAVEL_TIME_S so travel time is tunable.
// Mote is fastest, others are ratios.
export const ENEMY_TYPES = {
  mote:      { hp: 30,   armour: 0, speed: ENEMY_TRAVEL_DIST / MOTE_TRAVEL_TIME_S,       reward: 5  },
  husk:      { hp: 100,  armour: 0, speed: ENEMY_TRAVEL_DIST / (MOTE_TRAVEL_TIME_S * 1.5), reward: 10 },
  carapace:  { hp: 200,  armour: 2, speed: ENEMY_TRAVEL_DIST / (MOTE_TRAVEL_TIME_S * 2),   reward: 20 },
  devourer:  { hp: 1500, armour: 4, speed: ENEMY_TRAVEL_DIST / (MOTE_TRAVEL_TIME_S * 4),   reward: 0  },
};

// --- Escalation ---
// hp_multiplier = 1 + (t / 900) * 3
export const ESCALATION_HP_FACTOR = 3;
export const SESSION_DURATION = 900;  // seconds (15 minutes)

// --- Foundry rates ---
export const FORGE_SLAG_PER_SEC = 4;
export const LENS_INSIGHT_PER_SEC = 3;
export const CHORUS_RECOMBO_PER_SEC = 1.5; // percent per second
export const CHORUS_SLOW_FACTOR = 0.5;

// --- Foundry positions (Option 2: off default band paths, absorption) ---
// Forge=-15, Lens=+14, Chorus=+22, hw=5
// Gold band at 10deg hits x=7 at y=-15.2. Lens left edge must be > 7 at that y.
// Lens at x=14: left edge x=9. Gold reaches x=9 at y=-26.5 (below foundry). MISS.
// All bands miss all foundries on load. Each reachable with one mirror.
export const FOUNDRY_POSITIONS = [
  { x: -15, type: 'forge',     colour: 0xff8c1a },  // Amber
  { x:  14, type: 'lensworks', colour: 0x00ddff },  // Cyan
  { x:  22, type: 'chorus',    colour: 0xffe9a0 },  // Gold
];
export const FOUNDRY_HW = 5;
export const FOUNDRY_HH = 3;

// --- Crafting costs ---
export const CRAFT_PRISM      = { slag: 25, insight: 10 };
export const CRAFT_REPAIR     = { slag: 15, insight: 0  };
export const CRAFT_REINFORCED = { slag: 40, insight: 0  };
export const CRAFT_IGNITION   = { slag: 20, insight: 0  };
export const CRAFT_FOCUS      = { slag: 0,  insight: 30 };
export const CRAFT_ANCHOR     = { slag: 0,  insight: 25 };

// --- Focus buff ---
export const FOCUS_DAMAGE_MULT = 0.15; // +15% per Focus purchased

// --- Mirror ---
export const MIRROR_MAX_HITS = 3;      // shatters after 3 hits
export const MIRROR_COUNT_START = 4;
export const MIRROR_TWEEN_MS = 120;    // ease-out snap duration when landing in a socket
export const ROTATION_SENSITIVITY = 1.0; // multiplier on swipe-to-angle conversion

// --- Sockets (generic grid, holds mirror or prism) ---
// 3 columns x 4 rows = 12 sockets in the mirror field (y: 22 to -2).
//
// DEFAULT PATH (zero player input):
//   Beam falls from aperture (0, 45) straight down.
//   Hits PRISM at socket 1 (0, 22) near the top.
//   Splits into 3 bands diverging ~10deg each, all traveling downward
//   through the mirror field, through the foundry band, into enemy zone.
//
//   Canonical segments after init + 1 frame:
//     WHT: (0, 45) -> (0, ~24.5)      source to prism edge
//     AMB: (0, ~24.5) -> (~-13, -50)   diverges left to bottom
//     CYN: (0, ~24.5) -> (0, -50)      straight down through centre
//     GLD: (0, ~24.5) -> (~13, -50)    diverges right to bottom
//
export const SOCKET_POSITIONS = [
  // Row 1 (top of mirror field, y=22)
  [-15, 22], [0, 22], [15, 22],
  // Row 2 (y=12)
  [-15, 12], [0, 12], [15, 12],
  // Row 3 (y=2)
  [-15, 2],  [0, 2],  [15, 2],
  // Row 4 (bottom of mirror field, y=-2, above foundry band)
  [-15, -2], [0, -2], [15, -2],
];

// Default object placement:
// Prism goes in socket 1 (0, 22) — directly below aperture.
// Mirrors go in sockets 3, 5, 9, 11 — sides, out of the beam path.
export const DEFAULT_PRISM_SOCKET = 1;
export const DEFAULT_MIRROR_SOCKETS = [3, 5, 9, 11];

// --- Phase timings (seconds) ---
export const PHASE_1_END = 240;   // 4:00
export const PHASE_2_END = 600;   // 10:00
export const PHASE_3_END = 840;   // 14:00
// Phase 4 runs from 840 to 900

// --- Drift (Phase 3+) ---
export const DRIFT_AMPLITUDE = 12;     // max x offset
export const DRIFT_SPEED = 0.4;        // oscillation speed

// --- Source dim (Phase 4) ---
export const SOURCE_DIM_WIDTH = 0.6;   // 60% beam width in phase 4

// --- Pool sizes ---
export const ENEMY_POOL_SIZE = 64;
export const BEAM_SEGMENT_POOL_SIZE = 16;  // slightly above MAX_SEGMENTS for glow layers
export const PARTICLE_POOL_SIZE = 32;

// --- Colours ---
export const COLOUR_WHITE = 0xffffff;
export const COLOUR_AMBER = 0xff8c1a;  // warm orange, distinct from gold
export const COLOUR_CYAN  = 0x00ddff;
export const COLOUR_GOLD  = 0xffe9a0;  // pale white-gold, thinner + pulses
export const COLOUR_GREY  = 0x333333;
