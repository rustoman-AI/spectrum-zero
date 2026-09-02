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
// Ships spawn HIGH — well above the prism line (y30) — so they stage in open
// water and the opening kill happens cleanly in open space, not amid the
// prism/beam clutter. Raised 40 -> 44 in the RC polish pass.
export const SHIP_SPAWN_Y = 44;       // ships appear near the top, in open water
// Top bound: no ship may sit over the crystal. A ship's TOP edge must stay
// below this line (crystal at 48, leave ~2u clear). Enforced in spawnEnemy.
export const SHIP_TOP_BOUND = 46;
export const PRISM_Y = 30;            // prism splits light here
export const MIRROR_FIELD_TOP = -12;  // top of mirror zone (raised off the bottom HUD)
export const MIRROR_FIELD_BOT = -30;  // bottom of mirror zone
export const WALL_Y = -40;            // fortress/battlement backdrop line
export const ENEMY_LANE_COUNT = 5;

// --- Ram line (ship crash boundary) ---
// Ships descend all the way to the STONE BATTLEMENT at the shoreline (WALL_Y)
// and only breach when their hull touches the battlement's top edge. This keeps
// all wall damage at the wall — never in open water mid-screen. The wall stone
// mesh sits at WALL_Y (1.2u tall), so its top edge is ~WALL_Y + 0.6; ships stop
// with their leading (bottom) edge resting just on top of it.
export const MIRROR_DISC_TOP = -6;         // top edge of the topmost mirror sprite (kept for refs)
export const BATTLEMENT_TOP_Y = WALL_Y + 1; // top of the stone the hull rams into (~ -39)
// Ships ram the battlement and breach AT THE WALL, where the fortress, flash and
// altars are — never mid-screen. (An earlier SHIP_STOP_Y at -6 moved breach up
// into open water, which read as the city taking damage from a ship that never
// arrived; reverted.) The mirror-overlap problem is solved by render order
// (hulls draw behind mirror sprites) plus a raised mirror MIN height, not by
// stopping ships early.
export const RAM_STOP_EDGE = BATTLEMENT_TOP_Y;
export const RAM_LINE_Y = RAM_STOP_EDGE;
// Hard floor for mirror dragging: a mirror's CENTRE may never go below this.
// Raised from ~-34 to -26 so that a ship STOPPED at the battlement (leading
// edge at BATTLEMENT_TOP_Y -39, tallest common hull ~4.5u -> top ~-34.5) sits
// entirely BELOW the lowest possible mirror bottom (centre -26 minus radius 5
// = -31): ~3.5u clearance for the common fleet, so no hull can sit under a
// mirror at the wall. (The rare quinquereme boss, 8u tall -> top -31, meets the
// mirror bottom at the boundary and is hidden by render order.) This is the
// value that closes the overlap now that ships breach at the wall again.
export const MIRROR_MIN_Y = -26;

// --- DEV flags ---
export const DEV = {
  INVINCIBLE: false,
};

// --- Beam ---
export const MAX_BOUNCES = 8;
export const MAX_SEGMENTS = 24;
// Fixed, sharp beam profile (world units). ~0.7u core ≈ 5px, ~1.5u glow ≈ 12px
// on a portrait phone. Beam width is CONSTANT — it never scales on target
// contact (hit feedback is shown at the contact point instead).
export const BEAM_WIDTH = 0.7;
export const BEAM_GLOW_WIDTH = 1.5;
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
// Historical ship classes. `liburna` = light fast scout; `cataphract` = armoured
// oared warship with a protected deck; `quinquereme` = heavy Roman flagship of
// the Punic Wars (the class that besieged Syracuse). Stats unchanged — the keys
// are lookup indices used across spawner/damage/sprite/breach tables, so they
// must stay consistent everywhere.
export const ENEMY_TYPES = {
  liburna:     { hp: 30,   armour: 0, speed: 5,   reward: { bronze: 10 }, propulsion: 'sailed' },
  trireme:     { hp: 100,  armour: 0, speed: 3.5, reward: { bronze: 25 }, propulsion: 'oared' },
  quadrireme:  { hp: 200,  armour: 2, speed: 2.5, reward: { bronze: 15, silver: 3 }, propulsion: 'oared' },
  cataphract:  { hp: 200,  armour: 1, speed: 2.0, reward: { bronze: 20, silver: 8 }, shieldAngle: 25, propulsion: 'oared' },
  quinquereme: { hp: 1500, armour: 4, speed: 1.0, reward: { gold: 20 }, propulsion: 'sailed' },
};

// --- Escalation ---
export const ESCALATION_HP_FACTOR = 3;
export const SESSION_DURATION = 600;  // 10 minutes

// --- Victory condition ---
// The defence is "won" once the player survives to 3:00 (180s) with the wall
// still standing — a full challenge run through Phase 1 (liburnae) into Phase 2
// (armoured galleys, which begin at 60s and run to 180s). Triggers the in-engine
// gold victory card.
//
// VICTORY_KILLS is a secondary "cleared the whole fleet" fallback set well above
// the number of ships that actually spawn in 180s (~120-140), so in normal play
// the win is earned by SURVIVING TO 3:00, not by an early kill-count trip. It
// only fires if the player somehow out-sinks the entire scripted+procedural
// fleet, which keeps the timer meaningful as the primary path.
export const VICTORY_TIME = 180;   // seconds (3:00) — full challenge length
export const VICTORY_KILLS = 150;  // ships sunk (fallback, effectively "clear all")

// --- Multi-currency economy (altar zones require beam contact) ---
// 20% passive, 80% only while a beam is held on the altar zone.
// Altars sit on the city ground BELOW the wall (y < WALL_Y).
// A beam aimed at an altar goes DOWN; beams aimed at ships go UP.
// No single path can reach both.
// 3-metal economy: Bronze (common) / Silver (rare) / Gold (elite) + Faith.
export const ALTAR_RATES = {
  bronze: { passive: 1,   lit: 5 },   // common tier (was Brass)
  silver: { passive: 0.4, lit: 2 },   // rare tier
  gold:   { passive: 0.2, lit: 1 },   // elite tier
};
export const ALTAR_OVERHEAT_TIME = 6;    // seconds of continuous beam before efficiency halves
export const ALTAR_RECOVER_TIME = 10;    // seconds to recover from overheat
// Exactly three altar stations, evenly spaced across the battlement:
// BRONZE (left) -> SILVER (centre) -> GOLD (right). `type` is the currency the
// altar feeds; `label` is the name engraved on its pedestal.
// `colour` tints the altar body/glow; `flame` is the brazier fire colour;
// `short` is the HUD-style currency abbreviation shown in the "+N/s" tick.
// `popup` is the floating "+1 <metal>" combat-text colour (warm amber / bright
// silver-cyan / shimmering gold).
export const ALTAR_POSITIONS = [
  { x: -18, y: -44, type: 'bronze', label: 'BRONZE', colour: 0xcc8833, flame: '#ff8a2a', short: 'Bz', popup: '#ffb14a' },
  { x: 0,   y: -44, type: 'silver', label: 'SILVER', colour: 0xcccccc, flame: '#7ff0e0', short: 'Si', popup: '#d6fbff' },
  { x: 18,  y: -44, type: 'gold',   label: 'GOLD',   colour: 0xffdd00, flame: '#ffe24a', short: 'Gd', popup: '#ffe870' },
];
export const ALTAR_HW = 4;
export const ALTAR_HH = 2.5;

// --- Shop prices ---
export const SHOP = {
  mirror:    { bronze: 50, scaling: 25 },  // 50 Bz + 25 per additional mirror
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
      { bronze: 25 },                 // #1: cheap opener
      { faith: 40, gold: 5 },         // #2+: constant (raised 15->40 so a cast can't self-fund)
    ]
  },
  poseidon: {
    name: 'Maelstrom',
    duration: 6,
    costs: [
      { bronze: 40 },                 // #1: cheap opener
      { faith: 45, gold: 8 },         // #2+: constant (raised 20->45)
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
export const PHASE_1_END = 60;    // 1:00 - liburnae only
export const PHASE_2_END = 180;   // 3:00 - armoured galleys
export const PHASE_3_END = 540;   // 9:00 - main battle
// Phase 4: 9:00-10:00 - quinquereme

// --- Heat decay ---
export const HEAT_DECAY_RATE = 0.10;      // heat drains at 10%/s once decaying
export const HEAT_DECAY_GRACE = 0.5;      // grace before decay starts (holding a beam feels rewarding)

// --- Wall ---
export const WALL_MAX_HP = 100;
export const BREACH_DAMAGE = { liburna: 5, trireme: 15, quadrireme: 25, cataphract: 0, quinquereme: 100 };
// Breach is now a per-second CONTACT DRIP (not an instant chunk): each ship
// pressed against the wall drains this % of max wall HP per second while it
// sits there. Bigger ships drip faster. Cataphracts still do 0.
export const BREACH_DRIP_PCT = { liburna: 0.05, trireme: 0.06, quadrireme: 0.065, cataphract: 0, quinquereme: 0.07 };
// A rammed ship deals its breach damage as a short bleed over this crash-and-
// sink window, then is fully removed (no lingering hulls stacking on the wall).
export const BREACH_SINK_TIME = 0.9;

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
