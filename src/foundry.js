// ============================================================
// src/foundry.js — Multi-currency passive altar economy
// 4 metals generated automatically. No beam interaction needed.
// ============================================================

import { ALTAR_RATES } from './config.js';

// Resources
let resources = { brass: 0, bronze: 0, silver: 0, gold: 0 };
let faith = 0;
let priestCount = 0;

export function getResources() { return resources; }
export function getFaith() { return faith; }
export function getPriestCount() { return priestCount; }
export function addPriest() { priestCount++; }

export function canAfford(cost) {
  if (!cost) return false;
  for (const key in cost) {
    if ((resources[key] || 0) < cost[key]) return false;
  }
  return true;
}

export function spend(cost) {
  for (const key in cost) {
    resources[key] -= cost[key];
  }
}

export function addKillReward(reward) {
  if (!reward) return;
  for (const key in reward) {
    resources[key] = (resources[key] || 0) + reward[key];
  }
}

export function resetFoundries() {
  resources = { brass: 0, bronze: 0, silver: 0, gold: 0 };
  faith = 0;
  priestCount = 0;
}

export function updateFoundries(dt) {
  // Passive altar income
  resources.brass += ALTAR_RATES.brass * dt;
  resources.bronze += ALTAR_RATES.bronze * dt;
  resources.silver += ALTAR_RATES.silver * dt;
  resources.gold += ALTAR_RATES.gold * dt;
  // Priests generate faith
  faith += priestCount * dt;
}

export function spendFaith(amount) {
  faith -= amount;
}

// Legacy exports for compatibility
export function getSlag() { return resources.brass; }
export function getInsight() { return resources.bronze; }
export function getRecombination() { return 0; }
export function getInsightLog() { return []; }
export function spendSlag() {}
export function spendInsight() {}
export function addSlagDirect(amount) { resources.brass += amount; }
export function getFoundryColliders() { return []; }
export function initFoundries() { resetFoundries(); }
