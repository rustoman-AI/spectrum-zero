// ============================================================
// src/config.js — All balance numbers and world dimensions
// Solar Siege: Reversed layout (sun top, ships descend, mirrors bottom)
// ============================================================

// --- World ---
export const WORLD_HEIGHT = 100;

// --- Layout (sun at top, wall at bottom) ---
// Ships spawn at top, descend toward wall at bottom.
// Beam comes from sun (top), hits prism, splits, goes down to mirrors at bottom.
// Mirrors reflect beams UPWARD into descending ships.
export const SUN_Y = 48;              // sun/beam source (top)
export const SHIP_SPAWN_Y = 40;       // ships appear near top
export const PRISM_Y = 30;            // prism splits light here
export const MIRROR_FIELD_TOP = -15;  // top of mirror zone (player area, bottom of screen)
export const MIRROR_FIELD_BOT = -35;  // bottom of mirror zone
export const WALL_Y = -40;            // wall/breach line (ships breach here)
export const ENEMY_LANE_COUNT = 5;

// --- DEV flags ---
export const DEV = {
  INVINCIBLE: false,
};

// --- Beam ---
export const MAX_BOUNCES = 8;
export const MAX_SEGMENTS = 24;
export const BEAM_WIDTH = 1.2;
export const BEAM_GLOW_WIDTH = 2.4;
export const PRISM_SPREAD_DEG = 30;   // wider spread for reversed layout
export const PRISM_SPLIT_ANGLE = (PRISM_SPREAD_DEG / 2) * (Math.PI / 180);

// --- Prism tiers ---
// More bands = weaker each. Synergy scaled so focused DPS = 48 at all tiers.
export const PRISM_TIERS = {
  3: { bands: 3, dBase: 10.0, synergy: 0.30, shape: 'triangle', cost: null },
  4: { bands: 4, dBase: 7.5,  synergy: 0.20, shape: 'diamond',  cost: { bronze: 300 } },
  5: { bands: 5, dBase: 6.0,  synergy: 0.15, shape: 'pentagon', cost: { silver: 200 } },
  6: { bands: 6, dBase: 5.0,  synergy: 0.12, shape: 'hexagon',  cost: { silver: 400 } },
};
export const DEFAULT_PRISM_TIER = 3;
export const D_BASE = 10;
export const SYNERGY_BONUS = 0.3;

// --- Enemy types ---
export const ENEMY_TYPES = {
  skiff:       { hp: 30,   armour: 0, speed: 5,   reward: { brass: 10 } },
  trireme:     { hp: 100,  armour: 0, speed: 3.5, reward: { brass: 20, bronze: 5 } },
  quadrireme:  { hp: 200,  armour: 2, speed: 2.5, reward: { bronze: 15, silver: 3 } },
  shieldbearer:{ hp: 400,  armour: 1, speed: 2.0, reward: { bronze: 20, silver: 8 }, shieldAngle: 25 },
  flagship:    { hp: 1500, armour: 4, speed: 1.0, reward: { gold: 20 } },
};

// --- Escalation ---
export const ESCALATION_HP_FACTOR = 3;
export const SESSION_DURATION = 600;  // 10 minutes

// --- Multi-currency economy (altar zones require beam contact) ---
// 20% passive, 80% only while a beam is held on the altar zone.
// Altars sit on the city ground BELOW the wall (y < WALL_Y).
// A beam aimed at an altar goes DOWN; beams aimed at ships go UP.
// No single path can reach both.
export const ALTAR_RATES = {
  brass:  { passive: 1, lit: 5 },
  bronze: { passive: 0.6, lit: 3 },
  silver: { passive: 0.4, lit: 2 },
  gold:   { passive: 0.2, lit: 1 },
};
export const ALTAR_OVERHEAT_TIME = 6;    // seconds of continuous beam before efficiency halves
export const ALTAR_RECOVER_TIME = 10;    // seconds to recover from overheat
export const ALTAR_POSITIONS = [
  { x: -20, y: -44, type: 'brass',  colour: 0xccaa44 },
  { x: -7,  y: -44, type: 'bronze', colour: 0xcc8833 },
  { x: 7,   y: -44, type: 'silver', colour: 0xcccccc },
  { x: 20,  y: -44, type: 'gold',   colour: 0xffdd00 },
];
export const ALTAR_HW = 4;
export const ALTAR_HH = 2.5;

// --- Shop prices ---
export const SHOP = {
  mirror:    { brass: 100, scaling: 50 },  // +50 per additional mirror
  prism3:    { bronze: 150 },
  prism4:    { bronze: 300 },
  prism5:    { silver: 200 },
  prism6:    { silver: 400 },
  priest:    { silver: 100 },  // generates 1 Faith/sec
};

// --- God altars (require Faith + Gold) ---
export const GOD_ABILITIES = {
  zeus:     { faith: 100, gold: 10, name: 'Thunderstorm', duration: 5 },
  poseidon: { faith: 100, gold: 15, name: 'Maelstrom', duration: 8 },
  helios:   { faith: 100, gold: 20, name: 'Scorching Sun', duration: 10 },
};

// --- Phase timings (seconds) ---
export const PHASE_1_END = 60;    // 1:00 - skiffs only
export const PHASE_2_END = 180;   // 3:00 - armoured galleys
export const PHASE_3_END = 540;   // 9:00 - main battle
// Phase 4: 9:00-10:00 - flagship

// --- Heat decay ---
export const HEAT_DECAY_RATE = 0.15;

// --- Wall ---
export const WALL_MAX_HP = 100;
export const BREACH_DAMAGE = { skiff: 5, trireme: 15, quadrireme: 25, shieldbearer: 20, flagship: 100 };

// --- Mirror ---
export const MIRROR_MAX_HITS = 3;
export const MIRROR_COUNT_START = 3;
export const MIRROR_LENGTH = 8;
export const ROTATION_SENSITIVITY = 1.0;
export const FREE_PLACEMENT = true;

// --- Pool sizes ---
export const ENEMY_POOL_SIZE = 64;
export const BEAM_SEGMENT_POOL_SIZE = 28;

// --- Resonance ---
export const RESONANCE_MIN_BOUNCES = 3;
export const RESONANCE_MULTIPLIER = 1.5;

// --- Colours ---
export const COLOUR_WHITE  = 0xffffff;
export const COLOUR_AMBER  = 0xff8c1a;
export const COLOUR_CYAN   = 0x00ddff;
export const COLOUR_GOLD   = 0xffe9a0;
export const COLOUR_GREY   = 0x333333;

// --- Sockets (mirror field at bottom) ---
export const SOCKET_POSITIONS = [
  [-15, -18], [0, -18], [15, -18],
  [-15, -25], [0, -25], [15, -25],
  [-15, -32], [0, -32], [15, -32],
];
export const DEFAULT_PRISM_SOCKET = 1; // (0, -18) — but prism placed at PRISM_Y separately
export const DEFAULT_MIRROR_SOCKETS = [3, 4, 5]; // 3 starting mirrors

// --- Foundry positions (not used in new economy, kept for compatibility) ---
export const FOUNDRY_POSITIONS = [];
export const FOUNDRY_HW = 5;
export const FOUNDRY_HH = 3;
export const FOUNDRY_Y = 10; // above mirrors, not used
