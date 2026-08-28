// ============================================================
// src/config.js — All balance numbers and world dimensions
// Burning Glass: Reversed layout (sun top, ships descend, mirrors bottom)
// ============================================================

// --- World ---
export const WORLD_HEIGHT = 100;

// --- Layout (sun at top, wall at bottom) ---
// Ships spawn at top, descend toward wall at bottom.
// Beam comes from sun (top), hits prism, splits, goes down to mirrors at bottom.
// Mirrors reflect beams UPWARD into descending ships.
export const SUN_Y = 48;              // sun/crystal beam source (top)
export const SHIP_SPAWN_Y = 40;       // ships appear near top
// Top bound: no ship may sit over the crystal. A ship's TOP edge must stay
// below this line (crystal at 48, leave ~4u clear). Enforced in spawnEnemy.
export const SHIP_TOP_BOUND = 44;
export const PRISM_Y = 30;            // prism splits light here
export const MIRROR_FIELD_TOP = -12;  // top of mirror zone (raised off the bottom HUD)
export const MIRROR_FIELD_BOT = -30;  // bottom of mirror zone
export const WALL_Y = -40;            // fortress/battlement backdrop line
export const ENEMY_LANE_COUNT = 5;

// --- Ram line (ship crash boundary) ---
// The topmost mirror sits at socket row y = -12; its sprite is (MIRROR_LENGTH+2)
// = 12 units tall (MIRROR_LENGTH is 10, defined below), so the disc's top edge
// is at -12 + 6 = -6. Ships must stop with a clear gap ABOVE that edge and
// NEVER share pixels with the discs. ~25px on a portrait phone (100 world units
// over ~780px) is ~3.2u; use 4u for safety.
export const MIRROR_DISC_TOP = -6;   // top edge of the topmost mirror sprite
export const RAM_CLEARANCE = 4;      // world units of clear space above the disc top
// A ship crashes when its LEADING (bottom) edge reaches RAM_STOP_EDGE. Using the
// ship's own half-height means every ship size stops with the same clearance and
// zero overlap. RAM_LINE_Y is the nominal line kept for effects/legacy refs.
export const RAM_STOP_EDGE = MIRROR_DISC_TOP + RAM_CLEARANCE; // = -2
export const RAM_LINE_Y = RAM_STOP_EDGE;

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
  skiff:       { hp: 30,   armour: 0, speed: 5,   reward: { brass: 10 }, propulsion: 'sailed' },
  trireme:     { hp: 100,  armour: 0, speed: 3.5, reward: { brass: 20, bronze: 5 }, propulsion: 'oared' },
  quadrireme:  { hp: 200,  armour: 2, speed: 2.5, reward: { bronze: 15, silver: 3 }, propulsion: 'oared' },
  shieldbearer:{ hp: 200,  armour: 1, speed: 2.0, reward: { bronze: 20, silver: 8 }, shieldAngle: 25, propulsion: 'oared' },
  flagship:    { hp: 1500, armour: 4, speed: 1.0, reward: { gold: 20 }, propulsion: 'sailed' },
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
  mirror:    { brass: 50, scaling: 25 },   // 50 + 25 per additional mirror
  prism4:    { bronze: 80 },
  prism5:    { silver: 120 },
  prism6:    { silver: 200 },
};

// --- God abilities (constant cost so they can be cycled during a run) ---
// The shop uses costs[min(castCount, costs.length-1)], so [first, repeat]
// means the first cast has one price and every cast after is a flat repeat.
export const GOD_ABILITIES = {
  zeus: {
    name: 'Thunderstorm',
    duration: 5,
    costs: [
      { brass: 25 },                  // #1: cheap opener
      { faith: 15, gold: 5 },         // #2+: constant (does not escalate)
    ]
  },
  poseidon: {
    name: 'Maelstrom',
    duration: 6,
    costs: [
      { brass: 40 },                  // #1: cheap opener
      { faith: 20, gold: 8 },         // #2+: constant
    ]
  },
  // Helios: active Solar Overcharge. Generates Faith (the fuel for Zeus/Poseidon
  // repeat casts), stuns the fleet, and burns through shield plates for 5s.
  helios: {
    name: 'Solar Overcharge',
    duration: 5,           // flare lasts 5s
    faithGain: 15,         // +15 Faith over the 5s flare (+3/sec)
    stunDuration: 4,       // ships frozen (speed 0) for 4s
    costs: [
      { silver: 15, bronze: 20 },     // flat cost, never scales
    ]
  },
};

// --- Phase timings (seconds) ---
export const PHASE_1_END = 60;    // 1:00 - skiffs only
export const PHASE_2_END = 180;   // 3:00 - armoured galleys
export const PHASE_3_END = 540;   // 9:00 - main battle
// Phase 4: 9:00-10:00 - flagship

// --- Heat decay ---
export const HEAT_DECAY_RATE = 0.10;      // heat drains at 10%/s once decaying
export const HEAT_DECAY_GRACE = 0.5;      // grace before decay starts (holding a beam feels rewarding)

// --- Wall ---
export const WALL_MAX_HP = 100;
export const BREACH_DAMAGE = { skiff: 5, trireme: 15, quadrireme: 25, shieldbearer: 0, flagship: 100 };
// Breach is now a per-second CONTACT DRIP (not an instant chunk): each ship
// pressed against the wall drains this % of max wall HP per second while it
// sits there. Bigger ships drip faster. Shield-bearers still do 0.
export const BREACH_DRIP_PCT = { skiff: 0.05, trireme: 0.06, quadrireme: 0.065, shieldbearer: 0, flagship: 0.07 };

// --- Mirror ---
export const MIRROR_MAX_HITS = 3;
export const MIRROR_COUNT_START = 3;
export const MIRROR_LENGTH = 10;
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
  [-15, -12], [0, -12], [15, -12],
  [-15, -19], [0, -19], [15, -19],
  [-15, -26], [0, -26], [15, -26],
];
export const DEFAULT_PRISM_SOCKET = 1; // (0, -18) — but prism placed at PRISM_Y separately
export const DEFAULT_MIRROR_SOCKETS = [3, 4, 5]; // 3 starting mirrors

// --- Foundry positions (not used in new economy, kept for compatibility) ---
export const FOUNDRY_POSITIONS = [];
export const FOUNDRY_HW = 5;
export const FOUNDRY_HH = 3;
export const FOUNDRY_Y = 10; // above mirrors, not used
