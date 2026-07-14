import { ACHIEVEMENT_DEFS, ENEMY_DEFS, NORMAL_ENEMY_IDS } from "./game-data.js";

export const CAREER_TRIAL_IDS = Object.freeze(["aries", "gemini", "cancer"]);

function createTrialCompletions() {
  return Object.fromEntries(CAREER_TRIAL_IDS.map((id) => [id, 0]));
}

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
    cardsPlayed: 0,
    trialCompletions: createTrialCompletions()
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
  for (const id of CAREER_TRIAL_IDS) {
    profile.trialCompletions[id] = safeCount(data.trialCompletions?.[id]);
  }
  return profile;
}

export function trialCollectionProgress(profile) {
  const completions = CAREER_TRIAL_IDS.map((id) => safeCount(profile.trialCompletions?.[id]));
  return {
    completedSigns: completions.filter((count) => count > 0).length,
    totalSigns: CAREER_TRIAL_IDS.length,
    totalCompletions: completions.reduce((total, count) => total + count, 0)
  };
}

export function achievementProgress(profile, id) {
  const definition = ACHIEVEMENT_DEFS[id];
  if (!definition) return { current: 0, target: 1, unlocked: false };
  let current = 0;
  if (definition.metric === "normalEnemies") {
    current = profile.discoveredEnemies.filter((enemyId) => NORMAL_ENEMY_IDS.includes(enemyId)).length;
  } else if (definition.metric === "trialCompletions") {
    current = trialCollectionProgress(profile).totalCompletions;
  } else if (definition.metric === "trialSigns") {
    current = trialCollectionProgress(profile).completedSigns;
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
    const trialId = summary.challengeTrial?.archetypeId;
    if (summary.challengeTrial?.completed && CAREER_TRIAL_IDS.includes(trialId)) {
      profile.trialCompletions ??= createTrialCompletions();
      profile.trialCompletions[trialId] = safeCount(profile.trialCompletions[trialId]) + 1;
    }
  }
  return unlockEligibleAchievements(profile);
}
