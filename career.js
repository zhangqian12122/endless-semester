import { ACHIEVEMENT_DEFS, ENEMY_DEFS, NORMAL_ENEMY_IDS } from "./game-data.js";

export function createCareerProfile() {
  return {
    version: 1,
    discoveredEnemies: [],
    unlockedAchievements: [],
    combatsCompleted: 0,
    combatsWon: 0,
    cleanWins: 0,
    quickWins: 0,
    challengeWins: 0,
    eliteWins: 0,
    bossWins: 0,
    petUses: 0,
    cardsPlayed: 0
  };
}

function safeCount(value) {
  return Math.max(0, Number(value) || 0);
}

export function normalizeCareerProfile(data) {
  const profile = createCareerProfile();
  if (!data || data.version !== 1) return profile;
  profile.discoveredEnemies = Array.from(new Set(
    (Array.isArray(data.discoveredEnemies) ? data.discoveredEnemies : []).filter((id) => ENEMY_DEFS[id])
  ));
  profile.unlockedAchievements = Array.from(new Set(
    (Array.isArray(data.unlockedAchievements) ? data.unlockedAchievements : []).filter((id) => ACHIEVEMENT_DEFS[id])
  ));
  for (const key of ["combatsCompleted", "combatsWon", "cleanWins", "quickWins", "challengeWins", "eliteWins", "bossWins", "petUses", "cardsPlayed"]) {
    profile[key] = safeCount(data[key]);
  }
  return profile;
}

export function achievementProgress(profile, id) {
  const definition = ACHIEVEMENT_DEFS[id];
  if (!definition) return { current: 0, target: 1, unlocked: false };
  let current = 0;
  if (definition.metric === "normalEnemies") {
    current = profile.discoveredEnemies.filter((enemyId) => NORMAL_ENEMY_IDS.includes(enemyId)).length;
  } else {
    current = safeCount(profile[definition.metric]);
  }
  return {
    current: Math.min(current, definition.target),
    target: definition.target,
    unlocked: profile.unlockedAchievements.includes(id)
  };
}

export function unlockEligibleAchievements(profile) {
  const unlocked = [];
  for (const id of Object.keys(ACHIEVEMENT_DEFS)) {
    const progress = achievementProgress(profile, id);
    if (progress.current >= progress.target && !profile.unlockedAchievements.includes(id)) {
      profile.unlockedAchievements.push(id);
      unlocked.push(id);
    }
  }
  return unlocked;
}

export function recordEnemyEncounter(profile, enemyId) {
  if (!ENEMY_DEFS[enemyId]) return { discovered: false, newAchievements: [] };
  const discovered = !profile.discoveredEnemies.includes(enemyId);
  if (discovered) profile.discoveredEnemies.push(enemyId);
  return { discovered, newAchievements: unlockEligibleAchievements(profile) };
}

export function recordCareerCombat(profile, summary) {
  profile.combatsCompleted += 1;
  profile.cardsPlayed += safeCount(summary.cardsPlayed);
  if (summary.petUsed) profile.petUses += 1;
  if (summary.result === "won") {
    profile.combatsWon += 1;
    if (summary.hpLost === 0) profile.cleanWins += 1;
    if (summary.turns <= 3) profile.quickWins += 1;
    if (summary.challenge) profile.challengeWins += 1;
    if (summary.enemyKind === "elite") profile.eliteWins += 1;
    if (summary.enemyKind === "boss") profile.bossWins += 1;
  }
  return unlockEligibleAchievements(profile);
}
