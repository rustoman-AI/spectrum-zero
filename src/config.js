// ============================================================
// src/config.js — All balance numbers and world dimensions
// Tune ONLY this file. No magic numbers elsewhere.
// ============================================================

// --- World ---
export const WORLD_HEIGHT = 100;
// Width is derived from aspect ratio at runtime; portrait ~56 at 9:16

// --- Layout mode toggle ---
// 'classic' = mirrors high (y=22 to -2), foundries below, current behaviour
// 'low' = mirrors near water (y=-10 to -20), foundries above, thumb-friendly
export const LAYOUT_MODE = 'low';

// --- Layout (derived from LAYOUT_MODE) ---
const LAYOUTS = {
  classic: {
    MIRROR_FIELD_TOP: 25,
    MIRROR_FIELD_BOT: -5,
    FOUNDRY_Y: -15,
    BREACH_Y: -24,
    SOCKETS: [
      [-15, 22], [0, 22], [15, 22],
      [-15, 12], [0, 12], [15, 12],
      [-15, 2],  [0, 2],  [15, 2],
      [-15, -2], [0, -2], [15, -2],
    ],
    DEFAULT_PRISM_SOCKET: 1,
    DEFAULT_MIRROR_SOCKETS: [3, 5, 9, 11],
    FOUNDRY_POSITIONS: [
      { x: -15, type: 'forge', colour: 0xff8c1a },
      { x: 14, type: 'lensworks', colour: 0x00ddff },
      { x: 22, type: 'chorus', colour: 0xffe9a0 },
    ],
  },
  low: {
    MIRROR_FIELD_TOP: -8,
    MIRROR_FIELD_BOT: -20,
    FOUNDRY_Y: 5,
    BREACH_Y: -24,
    SOCKETS: [
      // Prism row (stays high, at y=22, same as classic)
      [-15, 22], [0, 22], [15, 22],
      // Mirror field (low, y=-8 to -20)
      [-15, -8],  [0, -8],  [15, -8],
      [-15, -12], [0, -12], [15, -12],
      [-15, -18], [0, -18], [15, -18],
    ],
    DEFAULT_PRISM_SOCKET: 1,
    DEFAULT_MIRROR_SOCKETS: [3, 5, 7, 8],
    FOUNDRY_POSITIONS: [
      { x: -18, type: 'forge', colour: 0xff8c1a },
      { x: 8, type: 'lensworks', colour: 0x00ddff },
      { x: 22, type: 'chorus', colour: 0xffe9a0 },
    ],
  },
};

const L = LAYOUTS[LAYOUT_MODE];
export const APERTURE_Y = 45;
export const MIRROR_FIELD_TOP = L.MIRROR_FIELD_TOP;
export const MIRROR_FIELD_BOT = L.MIRROR_FIELD_BOT;
export const FOUNDRY_Y = L.FOUNDRY_Y;
export const BREACH_Y = L.BREACH_Y;
export const ENEMY_SPAWN_Y = -48;
export const ENEMY_LANE_COUNT = 5;
export const LENS_Y = BREACH_Y;
export const SOCKET_POSITIONS = L.SOCKETS;
export const DEFAULT_PRISM_SOCKET = L.DEFAULT_PRISM_SOCKET;
export const DEFAULT_MIRROR_SOCKETS = L.DEFAULT_MIRROR_SOCKETS;
export const FOUNDRY_POSITIONS = L.FOUNDRY_POSITIONS;

// --- Enemy travel time ---
// Mote crosses spawn-to-breach in this many seconds during Phase 1.
// Speeds for other types are ratios of this.
export const MOTE_TRAVEL_TIME_S = 8;
// Distance from spawn to breach
export const ENEMY_TRAVEL_DIST = BREACH_Y - ENEMY_SPAWN_Y; // positive (24 units)

// --- Beam ---
export const MAX_BOUNCES = 8;
export const MAX_SEGMENTS = 24; // supports 6-band tier with bounces without silent truncation
export const BEAM_WIDTH = 1.2;        // world units, visual width of quad
export const BEAM_GLOW_WIDTH = 2.4;   // wider glow layer behind
// Total spread between outer bands in degrees. Each outer band deviates by half this.
export const PRISM_SPREAD_DEG = 20;
export const PRISM_SPLIT_ANGLE = (PRISM_SPREAD_DEG / 2) * (Math.PI / 180); // radians per outer band

// --- Damage ---
// Prism tier system: more bands = weaker each, synergy scaled so peak = 48 at all tiers
// D_BASE(N) = 30/N, SYNERGY(N) = 0.6/(N-1)
// Focused DPS = N * (30/N) * (1 + 0.6/(N-1) * (N-1)) = 30 * 1.6 = 48 at every tier
export const PRISM_TIERS = {
  3: { bands: 3, dBase: 10.0, synergy: 0.30, shape: 'triangle', cost: null },
  4: { bands: 4, dBase: 7.5,  synergy: 0.20, shape: 'diamond',  cost: { slag: 40, insight: 15 } },
  5: { bands: 5, dBase: 6.0,  synergy: 0.15, shape: 'pentagon', cost: { slag: 80, insight: 30 } },
  6: { bands: 6, dBase: 5.0,  synergy: 0.12, shape: 'hexagon',  cost: { slag: 150, insight: 50 } },
};
export const DEFAULT_PRISM_TIER = 3;
// Legacy constants (used by code that doesn't yet read from active tier)
export const D_BASE = 10;
export const SYNERGY_BONUS = 0.3;

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

// --- DEV flags (must ALL be false for submission build) ---
// Build script will hard-error if any are true.
export const DEV = {
  INVINCIBLE: false,      // true = wall never breaks, no game-over from breaches
};

// --- Mirror placement ---
export const PLACEMENT_MODE = 'free';  // 'free' = drop anywhere in mirror field, 'socket' = snap to grid
export const MIRROR_MAX_HITS = 3;
export const MIRROR_COUNT_START = 4;
export const MIRROR_TWEEN_MS = 120;
export const ROTATION_SENSITIVITY = 1.0;
export const FREE_PLACEMENT = (PLACEMENT_MODE === 'free');

// --- Resonance ---
export const RESONANCE_MIN_BOUNCES = 3;
export const RESONANCE_MULTIPLIER = 1.5;

// --- Heat decay ---
export const HEAT_DECAY_RATE = 0.15; // fraction of maxHP healed per second when beam leaves

// --- Breach damage scaling ---
// Wall damage is reduced by the fraction of heat accumulated on the enemy.
// damage = baseDamage * max(BREACH_DAMAGE_FLOOR, 1 - heatFraction)
export const BREACH_DAMAGE_FLOOR = 0.2;  // minimum 20% damage even at 99% heat
export const BREACH_BASE_DAMAGE = { mote: 5, husk: 15, carapace: 25, devourer: 100 };

// (Socket positions, prism socket, mirror sockets, and foundry positions
//  are derived from LAYOUT_MODE above and exported there.)

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
export const BEAM_SEGMENT_POOL_SIZE = 28;  // above MAX_SEGMENTS (24) with margin
export const PARTICLE_POOL_SIZE = 32;

// --- Colours ---
export const COLOUR_WHITE = 0xffffff;
export const COLOUR_AMBER = 0xff8c1a;  // warm orange, distinct from gold
export const COLOUR_CYAN  = 0x00ddff;
export const COLOUR_GOLD  = 0xffe9a0;  // pale white-gold, thinner + pulses
export const COLOUR_GREY  = 0x333333;
