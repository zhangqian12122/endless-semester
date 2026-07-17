export const SAVE_BACKUP_KIND = "endless-semester-backup";
export const SAVE_BACKUP_SCHEMA = 1;
export const FEEDBACK_REPORT_KIND = "endless-semester-feedback";
export const FEEDBACK_REPORT_SCHEMA = 2;
export const STORAGE_RECORD_STATUS = Object.freeze({
  empty: "empty",
  valid: "valid",
  corrupt: "corrupt"
});

export function inspectStorageRecord(raw, validator = (value) => value && typeof value === "object") {
  if (raw === null || raw === undefined || raw === "") {
    return { status: STORAGE_RECORD_STATUS.empty, value: null, raw: raw ?? null, reason: null };
  }
  if (typeof raw !== "string") {
    return { status: STORAGE_RECORD_STATUS.corrupt, value: null, raw: String(raw), reason: "invalid-storage-value" };
  }
  try {
    const value = JSON.parse(raw);
    if (!validator(value)) {
      return { status: STORAGE_RECORD_STATUS.corrupt, value: null, raw, reason: "invalid-save-shape" };
    }
    return { status: STORAGE_RECORD_STATUS.valid, value, raw, reason: null };
  } catch {
    return { status: STORAGE_RECORD_STATUS.corrupt, value: null, raw, reason: "invalid-json" };
  }
}

function plainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function clippedText(value, limit) {
  return String(value ?? "").trim().slice(0, limit);
}

function safeCount(value, maximum = 1_000_000_000) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(maximum, Math.max(0, Math.floor(number)));
}

function clippedIdList(value, limit = 20) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, limit)
    .map((entry) => clippedText(typeof entry === "string" ? entry : entry?.id, 80))
    .filter(Boolean);
}

function pendingPhase(game) {
  if (game?.combat) return `combat-${clippedText(game.combat.status || "active", 24)}`;
  if (game?.pendingItemReplacement) return "item-replacement";
  if (game?.pendingSemesterReward) return "semester-reward";
  if (game?.pendingCombatReward) return "combat-reward";
  if (game?.pendingEventReward) return "event-reward";
  if (game?.pendingShop) return "shop";
  if (game?.pendingRest) return "rest";
  if (game?.pendingEventId) return "event";
  if (game?.pendingCombatStart) return "combat-start";
  if (game?.awaitingNextSemester) return "semester-complete";
  return "map";
}

function normalizedIntent(intent) {
  if (!plainObject(intent)) return null;
  return {
    name: clippedText(intent.name, 80) || null,
    attack: safeCount(intent.attack, 9999),
    hits: Math.max(1, safeCount(intent.hits, 99) || 1),
    block: safeCount(intent.block, 9999),
    debuff: clippedText(intent.debuff, 80) || null,
    addStatus: plainObject(intent.addStatus) ? {
      id: clippedText(intent.addStatus.id, 80) || null,
      count: safeCount(intent.addStatus.count, 99),
      zone: clippedText(intent.addStatus.zone, 24) || null
    } : null
  };
}

export function normalizeFeedbackEnvironment(value) {
  if (!plainObject(value)) return {};
  return {
    page: clippedText(value.page, 240) || null,
    viewport: clippedText(value.viewport, 40) || null,
    language: clippedText(value.language, 40) || null,
    reducedMotion: value.reducedMotion === true,
    pixelRatio: Math.min(8, Math.max(0, Number(value.pixelRatio) || 0)),
    touchPoints: safeCount(value.touchPoints, 20),
    platform: clippedText(value.platform, 80) || null,
    userAgent: clippedText(value.userAgent, 320) || null
  };
}

export function createPlaytestSnapshot({ game, screen = "unknown", intent = null } = {}) {
  const issueScreen = clippedText(screen || "unknown", 80) || "unknown";
  if (!game || typeof game !== "object" || Array.isArray(game)) {
    return { screen: issueScreen, phase: "no-run", run: null, combat: null };
  }

  const deck = Array.isArray(game.deck) ? game.deck : [];
  const stats = plainObject(game.stats) ? game.stats : {};
  const combat = plainObject(game.combat) ? game.combat : null;
  const enemy = plainObject(combat?.enemy) ? combat.enemy : null;
  const pet = plainObject(game.pet) ? game.pet : null;
  const statKeys = [
    "combatsStarted", "combatsCompleted", "combatsWon", "challengeWins",
    "combatTurns", "combatHpLost", "cardsPlayed", "petUses", "cardsTaken",
    "rewardsSkipped", "itemsTaken", "enchantments"
  ];

  return {
    screen: issueScreen,
    phase: pendingPhase(game),
    run: {
      rngState: safeCount(game.rngState ?? game.rng?.state, 0xffffffff),
      semester: Math.max(1, safeCount(game.semester, 999) || 1),
      week: Math.max(1, safeCount(game.week, 16) || 1),
      archetypeId: clippedText(game.archetypeId, 80) || null,
      personaId: clippedText(game.personaId, 80) || null,
      tarotId: clippedText(game.tarotId, 80) || null,
      activePetId: clippedText(game.activePetId || pet?.id, 80) || null,
      hp: safeCount(game.hp, 9999),
      maxHp: safeCount(game.maxHp, 9999),
      gold: safeCount(game.gold),
      deckSize: deck.length,
      upgradedCards: deck.filter((card) => card?.upgraded === true).length,
      enchantedCards: deck.filter((card) => Boolean(card?.enchantment)).length,
      itemIds: clippedIdList(game.items),
      supplyIds: clippedIdList(game.supplies),
      petBond: safeCount(pet?.bond, 9999),
      petCharge: safeCount(pet?.charge, 999),
      stats: Object.fromEntries(statKeys.map((key) => [key, safeCount(stats[key])]))
    },
    combat: combat ? {
      enemyId: clippedText(enemy?.id, 80) || null,
      status: clippedText(combat.status, 24) || null,
      turn: Math.max(1, safeCount(combat.turn, 999) || 1),
      energy: safeCount(combat.energy, 99),
      playerBlock: safeCount(combat.playerBlock, 9999),
      enemyHp: safeCount(enemy?.hp, 99999),
      enemyMaxHp: safeCount(enemy?.maxHp, 99999),
      enemyBlock: safeCount(enemy?.block, 9999),
      enemyIntentTurn: safeCount(enemy?.intentTurn, 999),
      handSize: Array.isArray(combat.hand) ? combat.hand.length : 0,
      drawPileSize: Array.isArray(combat.drawPile) ? combat.drawPile.length : 0,
      discardPileSize: Array.isArray(combat.discardPile) ? combat.discardPile.length : 0,
      exhaustPileSize: Array.isArray(combat.exhaustPile) ? combat.exhaustPile.length : 0,
      pendingDiscard: Boolean(combat.pendingDiscard),
      distracted: combat.distracted === true,
      intent: normalizedIntent(intent)
    } : null
  };
}

export function createFeedbackReportId({ appVersion, createdAt, screen, save, playtest } = {}) {
  const identity = JSON.stringify({
    appVersion: clippedText(appVersion, 40),
    createdAt: clippedText(createdAt, 60),
    screen: clippedText(screen, 80),
    rngState: safeCount(save?.rngState ?? playtest?.run?.rngState, 0xffffffff),
    semester: safeCount(playtest?.run?.semester ?? save?.semester, 999),
    week: safeCount(playtest?.run?.week ?? save?.week, 16),
    enemyId: clippedText(playtest?.combat?.enemyId, 80),
    turn: safeCount(playtest?.combat?.turn, 999)
  });
  let hash = 0x811c9dc5;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  const versionTag = clippedText(appVersion, 40).replace(/[^0-9]/g, "").slice(0, 6) || "DEV";
  return `ES-${versionTag}-${(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}`;
}

export function normalizeFeedbackErrors(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.slice(-5).map((entry) => ({
    type: clippedText(entry?.type || "error", 40) || "error",
    message: clippedText(entry?.message || "未知错误", 500) || "未知错误",
    stack: clippedText(entry?.stack, 2000) || null,
    occurredAt: clippedText(entry?.occurredAt, 60) || null
  }));
}

export function createFeedbackReport({
  appVersion,
  screen,
  description = "",
  save = null,
  career,
  playtest = null,
  errors = [],
  environment = {},
  createdAt = new Date().toISOString()
} = {}) {
  if (!clippedText(appVersion, 40)) throw new Error("反馈包缺少游戏版本");
  if (!career || !plainObject(career)) throw new Error("反馈包缺少有效的生涯档案");
  if (save !== null && !plainObject(save)) throw new Error("反馈包中的当前对局无效");

  const normalizedPlaytest = playtest && plainObject(playtest) ? playtest : null;
  const reportId = createFeedbackReportId({
    appVersion,
    createdAt,
    screen,
    save,
    playtest: normalizedPlaytest
  });

  return JSON.stringify({
    kind: FEEDBACK_REPORT_KIND,
    schema: FEEDBACK_REPORT_SCHEMA,
    reportId,
    createdAt,
    appVersion: clippedText(appVersion, 40),
    issue: {
      screen: clippedText(screen || "unknown", 80) || "unknown",
      description: clippedText(description, 1200)
    },
    environment: normalizeFeedbackEnvironment(environment),
    recentErrors: normalizeFeedbackErrors(errors),
    playtest: normalizedPlaytest,
    save,
    career
  }, null, 2);
}

export function createSaveBackup({ save = null, career, exportedAt = new Date().toISOString() } = {}) {
  if (!career || typeof career !== "object" || Array.isArray(career) || career.version !== 1) {
    throw new Error("生涯档案无效，无法创建备份");
  }
  if (save !== null && (typeof save !== "object" || Array.isArray(save))) {
    throw new Error("当前对局存档无效，无法创建备份");
  }
  return JSON.stringify({
    kind: SAVE_BACKUP_KIND,
    schema: SAVE_BACKUP_SCHEMA,
    exportedAt,
    save,
    career
  });
}

export function parseSaveBackup(text) {
  if (typeof text !== "string" || !text.trim()) throw new Error("请先粘贴存档码");
  if (text.length > 2_000_000) throw new Error("存档码过大，已拒绝导入");

  let payload;
  try {
    payload = JSON.parse(text.trim());
  } catch {
    throw new Error("存档码不是有效的 JSON");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)
    || payload.kind !== SAVE_BACKUP_KIND || payload.schema !== SAVE_BACKUP_SCHEMA) {
    throw new Error("存档码版本或格式不受支持");
  }
  if (!("save" in payload) || !("career" in payload)
    || (payload.save !== null && (typeof payload.save !== "object" || Array.isArray(payload.save)))
    || !payload.career || typeof payload.career !== "object" || Array.isArray(payload.career)
    || payload.career.version !== 1) {
    throw new Error("存档码缺少有效的对局或生涯数据");
  }

  return {
    save: payload.save,
    career: payload.career,
    exportedAt: typeof payload.exportedAt === "string" ? payload.exportedAt : null
  };
}
