// ============================================================
// src/strings.js — All player-facing text (single source of truth)
//
// Game: Burning Glass (Archimedes defending Syracuse)
// ============================================================

// --- Game title ---
export const TITLE = 'Burning Glass';

// --- Source / beam ---
export const SOURCE_NAME = 'Helios';
export const BEAM_WHITE_NAME = 'Sunlight';
export const PRISM_NAME = 'Archimedes Lens';

// --- Foundries (Altars) ---
export const FOUNDRY_LABELS = {
  forge: 'HEPHAESTUS',
  lensworks: 'ATHENA',
  chorus: 'APOLLO',
};

// --- Resources ---
export const RES_SLAG = 'Bronze';
export const RES_SLAG_SHORT = 'B';
export const RES_INSIGHT = 'Tactics';
export const RES_INSIGHT_SHORT = 'T';
export const RES_RECOMBO = 'Convergence';
export const RES_RECOMBO_SHORT = 'C';

// --- Enemies (Roman fleet) ---
// Player-facing display names, keyed by the ENEMY_TYPES ids (historical classes).
export const ENEMY_NAMES = {
  liburna: 'Liburna',
  trireme: 'Trireme',
  quadrireme: 'Quadrireme',
  cataphract: 'Cataphract',
  quinquereme: 'Quinquereme',
};

// --- Crafting ---
export const CRAFT_LABELS = {
  prism: 'Lens',
  repair: 'Greek Fire',
  reinforced: 'Bronze Shield',
  ignition: 'Oil Slick',
  focus: 'Focus',
  anchor: 'Ballast',
};

// --- UI messages ---
export const MSG_LOSE = 'SYRACUSE HAS FALLEN\n\nTap to retry';
export const MSG_WIN = 'THE FLEET BURNS\n\nTap to play again';
export const MSG_BREACH_LINE = 'The Sea Wall';

// --- HUD ---
export const HUD_COST_SLAG = 'B';
export const HUD_COST_INSIGHT = 'T';
