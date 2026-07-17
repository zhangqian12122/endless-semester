export const NEW_GAME_START = Object.freeze({
  confirm: "confirm",
  start: "start"
});

export const END_TURN_ACTION = Object.freeze({
  confirm: "confirm",
  end: "end"
});

export function finalizeCombatPersistence(result, callbacks = {}) {
  if (!["won", "lost"].includes(result)) return false;
  callbacks.completeCheckpoint?.();
  if (result === "lost") callbacks.clearRunSave?.();
  return true;
}

export const COMBAT_SHORTCUT_ACTION = Object.freeze({
  cancelLethalEndTurn: "cancel-lethal-end-turn",
  closeIntentDetails: "close-intent-details",
  closePile: "close-pile",
  discardCard: "discard-card",
  endTurn: "end-turn",
  petSkill: "pet-skill",
  playCard: "play-card",
  toggleIntentDetails: "toggle-intent-details"
});

export function enemyIntentDetailLines(intent = {}, cardNameFor = (id) => id) {
  const lines = [];
  const attack = Math.max(0, Math.floor(Number(intent.attack) || 0));
  const hits = attack > 0 ? Math.max(1, Math.floor(Number(intent.hits) || 1)) : 0;
  const block = Math.max(0, Math.floor(Number(intent.block) || 0));

  if (attack > 0) {
    lines.push(hits > 1
      ? `每段 ${attack} 点伤害，共 ${hits} 段（合计 ${attack * hits} 点）`
      : `造成 ${attack} 点伤害`);
  }
  if (block > 0) lines.push(`获得 ${block} 点护甲`);
  if (intent.mechanicState?.type === "enemyBlockAttack") {
    const armor = Math.max(0, Math.floor(Number(intent.mechanicState.sourceCount) || 0));
    const bonus = Math.max(0, Math.floor(Number(intent.mechanicState.value) || 0));
    const cap = Math.max(0, Math.floor(Number(intent.mechanicState.cap) || 0));
    const excessArmor = Math.max(0, armor - cap);

    if (bonus === 0) {
      lines.push("蓄压额外伤害已解除");
    } else if (excessArmor > 0) {
      lines.push(`当前 ${armor} 点护甲使重击 +${bonus}；再击破 ${excessArmor + 1} 点，伤害才会下降 1`);
    } else {
      lines.push(`当前 ${armor} 点护甲使重击 +${bonus}；每击破 1 点，伤害降低 1`);
    }
  }
  if (intent.mechanicState?.type === "rivalInterrupt") {
    const value = Math.max(0, Math.floor(Number(intent.mechanicState.value) || 0));
    const cap = Math.max(1, Math.floor(Number(intent.mechanicState.cap) || 10));
    const reduction = Math.max(0, Math.floor(Number(intent.mechanicState.attackReduction) || 3));
    const attackBefore = Math.max(0, Math.floor(Number(intent.mechanicState.attackBefore) || attack));
    const attackAfter = Math.max(0, Math.floor(Number(intent.mechanicState.attackAfter) || attack));
    if (intent.mechanicState.triggered) {
      lines.push(`本回合已打断内卷：公开攻击 ${attackBefore}→${attackAfter}；下回合重新累计`);
    } else {
      lines.push(`打断进度 ${value}/${cap}：再造成 ${Math.max(0, cap - value)} 点实际生命伤害，达到后当前攻击 -${reduction}`);
    }
  }
  if (intent.mechanicState?.type === "examBlank") {
    const value = Math.max(0, Math.floor(Number(intent.mechanicState.value) || 0));
    const cap = Math.max(1, Math.floor(Number(intent.mechanicState.cap) || 8));
    const remainingBlock = Math.max(0, Math.floor(Number(intent.mechanicState.remainingBlock) || 0));
    const reduction = Math.max(0, Math.floor(Number(intent.mechanicState.attackReduction) || 6));
    const attackBefore = Math.max(0, Math.floor(Number(intent.mechanicState.attackBefore) || attack));
    const attackAfter = Math.max(0, Math.floor(Number(intent.mechanicState.attackAfter) || attack));
    if (intent.mechanicState.triggered) {
      lines.push(`已破题：击破填空题护甲，大题 ${attackBefore}→${attackAfter}；下一轮重新开启`);
    } else if (intent.mechanicState.windowOpen) {
      lines.push(`破题进度 ${value}/${cap}：再击破 ${remainingBlock} 点护甲，本次大题伤害 -${reduction}`);
    } else {
      lines.push("破题窗口尚未开启：需先结算上一道填空题");
    }
  }
  if (intent.mechanicState?.type === "statusHits") {
    const cap = Math.max(1, resolvedIntentValue(intent.mechanicState, "cap") ?? 1);
    const sourceCount = resolvedIntentValue(intent.mechanicState, "sourceCount") ?? 0;
    const value = Math.min(cap, resolvedIntentValue(intent.mechanicState, "value") ?? 0);
    const label = String(intent.mechanicState.label || "状态加段");
    const statusId = typeof intent.scaling?.statusId === "string" ? intent.scaling.statusId : "状态牌";
    const resolvedName = typeof cardNameFor === "function" ? cardNameFor(statusId) : statusId;
    const statusName = String(resolvedName || statusId);
    lines.push(value > 0
      ? `${label} ${value}/${cap}：战斗区有 ${sourceCount} 张「${statusName}」，本次追加 ${value} 段（共 ${hits} 段）`
      : `${label} 0/${cap}：战斗区没有「${statusName}」提供额外连击`);
  }
  if (intent.debuff === "distracted") {
    lines.push("施加走神：下回合你的攻击每段 -2");
  } else if (intent.debuff) {
    lines.push(`施加「${String(intent.debuff)}」`);
  }
  if (intent.addStatus) {
    const count = Math.max(1, Math.floor(Number(intent.addStatus.count) || 1));
    const id = String(intent.addStatus.id || "状态牌");
    const resolvedName = typeof cardNameFor === "function" ? cardNameFor(id) : id;
    const cardName = String(resolvedName || id);
    const zone = intent.addStatus.zone === "draw"
      ? "抽牌堆"
      : intent.addStatus.zone === "discard"
      ? "弃牌堆"
      : "牌堆";
    lines.push(`将 ${count} 张「${cardName}」加入${zone}`);
  }

  return lines.length ? lines : ["本回合不会造成伤害，也不会施加其他效果"];
}

const ALARM_CLOCK_METER_STEPS = Object.freeze([
  Object.freeze({
    name: "蓄响",
    effect: "block",
    currentFallback: "防御",
    next: "铃声（攻击）"
  }),
  Object.freeze({
    name: "铃声",
    effect: "attack",
    currentFallback: "攻击",
    next: "夺命连环响（重击）"
  }),
  Object.freeze({
    name: "夺命连环响",
    shortName: "爆发",
    effect: "attack",
    currentFallback: "重击",
    next: "蓄响（防御）"
  })
]);
const CLUB_MEGAPHONE_METER_STEPS = Object.freeze([
  Object.freeze({ name: "循环广播", shortName: "广播" }),
  Object.freeze({ name: "报名轰炸", shortName: "轰炸" }),
  Object.freeze({ name: "展板掩护", shortName: "掩护" })
]);
const SPECIAL_ENEMY_METER_STEPS = Object.freeze(["发卷", "选择题", "填空题", "大题"]);
const MILK_DRAGON_METER_STEPS = Object.freeze([
  Object.freeze({ name: "魔性开嗓", shortName: "开嗓" }),
  Object.freeze({ name: "奶泡头槌", shortName: "头槌" }),
  Object.freeze({ name: "憋笑蓄泡", shortName: "蓄泡" }),
  Object.freeze({ name: "哈哈哈连震", shortName: "爆笑" })
]);
const MAX_SPECIAL_ENEMY_TURN = Math.floor((Number.MAX_SAFE_INTEGER - 6) / 2);

function normalizedIntentTurn(intentTurn) {
  let numericTurn = 0;
  try {
    numericTurn = Number(intentTurn);
  } catch {
    return 0;
  }
  return Number.isFinite(numericTurn)
    ? Math.min(MAX_SPECIAL_ENEMY_TURN, Math.max(0, Math.floor(numericTurn)))
    : 0;
}

function resolvedIntentValue(intent, key) {
  if (!intent || typeof intent !== "object" || !Object.prototype.hasOwnProperty.call(intent, key)) return null;
  try {
    const value = Number(intent[key]);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
  } catch {
    return null;
  }
}

export function enemyMechanicProgress(enemyId, intentTurn = 0, mechanicState = null, resolvedIntent = null) {
  const turn = normalizedIntentTurn(intentTurn);

  if (enemyId === "alarmClock") {
    const stepIndex = turn % ALARM_CLOCK_METER_STEPS.length;
    const step = ALARM_CLOCK_METER_STEPS[stepIndex];
    const value = resolvedIntentValue(resolvedIntent, step.effect);
    const effectName = step.effect === "block" ? "护甲" : "攻击";
    const currentEffect = value === null ? step.currentFallback : `${effectName} ${value}`;
    const labelValue = value === null ? "" : ` ${step.effect === "block" ? "+" : ""}${value}`;
    return {
      kind: "countdown",
      title: "公开倒计时",
      label: `${stepIndex + 1}/3 · ${step.shortName || step.name}${labelValue}`,
      detail: `当前：${step.name}（${currentEffect}）；下一步：${step.next}`,
      segments: ALARM_CLOCK_METER_STEPS.map((_, index) => (
        index < stepIndex ? "done" : index === stepIndex ? "current" : "upcoming"
      ))
    };
  }

  if (enemyId === "clubMegaphone") {
    const stepCount = CLUB_MEGAPHONE_METER_STEPS.length;
    const stepIndex = turn % stepCount;
    const round = Math.floor(turn / stepCount) + 1;
    const step = CLUB_MEGAPHONE_METER_STEPS[stepIndex];
    const nextStep = CLUB_MEGAPHONE_METER_STEPS[(stepIndex + 1) % stepCount];
    const attack = resolvedIntentValue(resolvedIntent, "attack");
    const hits = Math.max(1, resolvedIntentValue(resolvedIntent, "hits") ?? 1);
    const block = resolvedIntentValue(resolvedIntent, "block");
    const statusCount = resolvedIntentValue(resolvedIntent?.addStatus, "count") ?? 1;
    let effect = "";
    if (stepIndex === 0) {
      const perHit = attack ?? 4;
      const actualHits = hits > 1 ? hits : 3;
      effect = `攻击 ${perHit}×${actualHits}，合计 ${perHit * actualHits}`;
    } else if (stepIndex === 1) {
      effect = `攻击 ${attack ?? 6}，向弃牌堆加入 ${statusCount} 张紧张`;
    } else {
      effect = `获得 ${block ?? 7} 点护甲并施加走神，不攻击`;
    }
    return {
      kind: "cycle",
      title: "社团音浪",
      label: `第${round}轮 · ${stepIndex + 1}/3 · ${step.shortName}`,
      detail: `当前：${step.name}（${effect}）；下一步：${nextStep.name}${stepIndex === stepCount - 1 ? `（第${round + 1}轮）` : ""}`,
      segments: CLUB_MEGAPHONE_METER_STEPS.map((_, index) => (
        index < stepIndex ? "done" : index === stepIndex ? "current" : "upcoming"
      ))
    };
  }

  if (enemyId === "rivalShadow") {
    const action = turn + 1;
    const baseDamage = 6 + turn * 2;
    const cap = Math.max(1, Math.floor(Number(mechanicState?.cap) || 10));
    const value = Math.min(cap, Math.max(0, Math.floor(Number(mechanicState?.value) || 0)));
    const triggered = mechanicState?.type === "rivalInterrupt" && mechanicState.triggered === true;
    const attackBefore = Math.max(0, Math.floor(Number(mechanicState?.attackBefore) || baseDamage));
    const attackAfter = Math.max(0, Math.floor(Number(mechanicState?.attackAfter) || attackBefore));
    return {
      kind: "interrupt",
      title: "打断内卷",
      label: triggered
        ? `已打断 · ${attackBefore}→${attackAfter}`
        : value > 0
        ? `${value}/${cap} · 还差 ${cap - value}`
        : `0/${cap} · 当前攻击 ${attackBefore}`,
      detail: `第${action}次加速，基础伤害 ${baseDamage}；本回合累计实际生命伤害，达到 ${cap} 后当前攻击 -3，下回合重置。`,
      segments: Array.from({ length: cap }, (_, index) => index < value ? "done" : "upcoming")
    };
  }

  if (enemyId === "madMilkDragon") {
    const stepCount = MILK_DRAGON_METER_STEPS.length;
    const stepIndex = turn % stepCount;
    const round = Math.floor(turn / stepCount) + 1;
    const currentStep = MILK_DRAGON_METER_STEPS[stepIndex];
    const nextStepIndex = (stepIndex + 1) % stepCount;
    const nextRound = stepIndex === stepCount - 1 ? round + 1 : round;
    const nextStep = MILK_DRAGON_METER_STEPS[nextStepIndex];
    const segments = MILK_DRAGON_METER_STEPS.map((_, index) => (
      index < stepIndex ? "done" : index === stepIndex ? "current" : "upcoming"
    ));
    const addStatus = resolvedIntent?.addStatus && typeof resolvedIntent.addStatus === "object"
      ? resolvedIntent.addStatus
      : null;
    const statusCount = resolvedIntentValue(addStatus, "count") ?? 2;
    const attack = resolvedIntentValue(resolvedIntent, "attack");
    const hits = resolvedIntentValue(resolvedIntent, "hits");
    const block = resolvedIntentValue(resolvedIntent, "block");
    const cap = Math.max(1, resolvedIntentValue(mechanicState, "cap") ?? 3);
    const sourceCount = resolvedIntentValue(mechanicState, "sourceCount") ?? 0;
    const value = Math.min(cap, resolvedIntentValue(mechanicState, "value") ?? 0);
    const perHit = attack ?? (stepIndex === 1 ? 5 : 3);
    const actualHits = Math.max(1, hits ?? (stepIndex === 1 ? 2 : 3 + value));
    const nextSuffix = nextRound === round ? "" : `（第${nextRound}轮）`;
    let detail = "";

    if (stepIndex === 0) {
      detail = `当前：${currentStep.name}（向弃牌堆加入 ${statusCount} 张紧张，不攻击）；下一步：${nextStep.name}`;
    } else if (stepIndex === 1) {
      detail = `当前：${currentStep.name}（攻击 ${perHit}×${actualHits}，合计 ${perHit * actualHits}）；下一步：${nextStep.name}`;
    } else if (stepIndex === 2) {
      const debuff = resolvedIntent?.debuff === "distracted"
        ? "走神"
        : typeof resolvedIntent?.debuff === "string" && resolvedIntent.debuff
        ? resolvedIntent.debuff
        : "走神";
      detail = `当前：${currentStep.name}（获得 ${block ?? 9} 点护甲并施加${debuff}，不攻击）；下一步：${nextStep.name}`;
    } else {
      detail = `当前：${currentStep.name}（攻击 ${perHit}×${actualHits}，合计 ${perHit * actualHits}；${sourceCount} 张紧张追加 ${value} 段）；下一步：${nextStep.name}${nextSuffix}`;
    }

    return {
      kind: "cycle",
      title: "魔笑四拍",
      label: `第${round}轮 · ${stepIndex + 1}/4 · ${currentStep.shortName}${stepIndex === 3 ? ` · 笑压 ${value}/${cap}` : ""}`,
      detail,
      segments
    };
  }

  if (enemyId === "finalExam") {
    const stepIndex = turn % SPECIAL_ENEMY_METER_STEPS.length;
    const round = Math.floor(turn / SPECIAL_ENEMY_METER_STEPS.length) + 1;
    const currentStep = SPECIAL_ENEMY_METER_STEPS[stepIndex];
    const nextStepIndex = (stepIndex + 1) % SPECIAL_ENEMY_METER_STEPS.length;
    const nextRound = stepIndex === SPECIAL_ENEMY_METER_STEPS.length - 1 ? round + 1 : round;
    const nextStep = SPECIAL_ENEMY_METER_STEPS[nextStepIndex];
    const segments = SPECIAL_ENEMY_METER_STEPS.map((_, index) => (
      index < stepIndex ? "done" : index === stepIndex ? "current" : "upcoming"
    ));
    if (mechanicState?.type === "examBlank") {
      const cap = Math.max(1, Math.floor(Number(mechanicState.cap) || 8));
      const value = Math.min(cap, Math.max(0, Math.floor(Number(mechanicState.value) || 0)));
      const remainingBlock = Math.max(0, Math.floor(Number(mechanicState.remainingBlock) || 0));
      const attackBefore = Math.max(0, Math.floor(Number(mechanicState.attackBefore) || 0));
      const attackAfter = Math.max(0, Math.floor(Number(mechanicState.attackAfter) || attackBefore));
      const triggered = mechanicState.triggered === true;
      const windowOpen = mechanicState.windowOpen === true;
      return {
        kind: "cycle",
        title: "破题窗口",
        label: triggered
          ? `成功 · ${attackBefore}→${attackAfter}`
          : windowOpen
          ? `${value}/${cap} · 余${remainingBlock}甲`
          : `第${round}轮 · ${stepIndex + 1}/4`,
        detail: triggered
          ? `当前：大题（已削弱）；下一步：${nextStep}（第${nextRound}轮）`
          : windowOpen
          ? `当前：大题；击破剩余 ${remainingBlock} 点护甲即可让本次大题 -${Math.max(0, Math.floor(Number(mechanicState.attackReduction) || 6))}`
          : `当前：${currentStep}；破题窗口尚未开启`,
        segments
      };
    }
    return {
      kind: "cycle",
      title: "四步破题",
      label: `第${round}轮 · ${stepIndex + 1}/4`,
      detail: `当前：${currentStep}；下一步：${nextStep}${nextRound === round ? "" : `（第${nextRound}轮）`}`,
      segments
    };
  }

  return null;
}

export const ENEMY_RESOLVE_MS = 700;
export const ENEMY_EXTRA_HIT_RESOLVE_MS = 180;

export function enemyResolveDuration(prefersReducedMotion = false, hitCount = 1) {
  if (prefersReducedMotion) return 0;
  const extraHits = Math.min(3, Math.max(0, Math.floor(Number(hitCount) || 1) - 1));
  return ENEMY_RESOLVE_MS + extraHits * ENEMY_EXTRA_HIT_RESOLVE_MS;
}

export function enemyHitBreakdown(preview = {}) {
  const perHit = Math.max(0, Math.floor(Number(preview.perHit) || 0));
  const hits = perHit > 0 ? Math.max(1, Math.floor(Number(preview.hits) || 1)) : 0;
  let remainingBlock = Math.max(0, Math.floor(Number(preview.currentBlock) || 0));
  return Array.from({ length: hits }, (_, index) => {
    const blocked = Math.min(remainingBlock, perHit);
    remainingBlock -= blocked;
    return {
      index: index + 1,
      blocked,
      hpLoss: perHit - blocked,
      blockAfter: remainingBlock
    };
  });
}

function normalizedResolvedHitBreakdown(steps) {
  if (!Array.isArray(steps)) return [];
  return steps.map((step, offset) => ({
    index: Math.max(1, Math.floor(Number(step?.index) || offset + 1)),
    blocked: Math.max(0, Math.floor(Number(step?.blocked) || 0)),
    hpLoss: Math.max(0, Math.floor(Number(step?.hpLoss) || 0)),
    blockAfter: Math.max(0, Math.floor(Number(step?.blockAfter) || 0))
  }));
}

export function enemyHitPulseSequence(steps = []) {
  if (!Array.isArray(steps)) return [];
  return steps.map((step, offset) => {
    const blocked = Math.max(0, Math.floor(Number(step.blocked) || 0));
    const hpLoss = Math.max(0, Math.floor(Number(step.hpLoss) || 0));
    return {
      index: Math.max(1, Math.floor(Number(step.index) || offset + 1)),
      delay: offset * ENEMY_EXTRA_HIT_RESOLVE_MS,
      tone: hpLoss > 0 ? "damage" : "blocked",
      label: hpLoss > 0 ? `-${hpLoss}` : blocked > 0 ? `挡 ${blocked}` : "无伤"
    };
  });
}

export function enemyResolutionSnapshot(resolution, feedback = {}) {
  if (!resolution || typeof resolution !== "object") return null;
  const summaryParts = Array.isArray(feedback.summaryParts)
    ? feedback.summaryParts.map((part) => String(part)).filter(Boolean)
    : [];
  const effects = Array.isArray(resolution.effects)
    ? resolution.effects.map((effect) => ({
      tone: ["danger", "guard", "status", "item"].includes(effect?.tone) ? effect.tone : "status",
      label: String(effect?.label || "").trim()
    })).filter((effect) => effect.label)
    : [];
  const effectLabels = new Set(effects.map((effect) => effect.label));
  const mechanicalParts = summaryParts.filter((part) => part !== "效果已生效" && !effectLabels.has(part));
  const hitBreakdown = Array.isArray(resolution.hitBreakdown)
    ? normalizedResolvedHitBreakdown(resolution.hitBreakdown)
    : enemyHitBreakdown(resolution.incoming);
  return {
    turn: Math.max(1, Math.floor(Number(resolution.turn) || 1)),
    name: String(resolution.name || "敌方行动"),
    detail: String(resolution.detail || "行动已执行"),
    result: mechanicalParts.join(" · ") || (effects.length ? "非伤害效果已结算" : "效果已生效"),
    tone: Number(feedback.playerDamage) > 0 ? "danger" : "safe",
    hitBreakdown,
    effects,
    mechanicState: resolution.mechanicState && typeof resolution.mechanicState === "object"
      ? { ...resolution.mechanicState }
      : null,
    ...(resolution.intent && typeof resolution.intent === "object"
      ? { intent: { ...resolution.intent } }
      : {})
  };
}

export const CARD_LIBRARY_FILTERS = Object.freeze([
  "all",
  "public",
  "aries",
  "gemini",
  "cancer",
  "summoner",
  "status"
]);

export function normalizeCardLibraryFilter(filter) {
  return CARD_LIBRARY_FILTERS.includes(filter) ? filter : "all";
}

export function cardLibraryIds(cardDefs, filter = "all") {
  const normalized = normalizeCardLibraryFilter(filter);
  return Object.values(cardDefs)
    .filter((card) => {
      if (normalized === "all") return true;
      if (normalized === "status") return card.type === "status";
      if (normalized === "public") return !card.archetype && !card.persona && card.type !== "status";
      if (normalized === "summoner") return card.persona === "summoner";
      return card.archetype === normalized;
    })
    .map((card) => card.id);
}

export const ITEM_LIBRARY_FILTERS = Object.freeze([
  "all",
  "common",
  "uncommon",
  "rare",
  "boss"
]);

export function normalizeItemLibraryFilter(filter) {
  return ITEM_LIBRARY_FILTERS.includes(filter) ? filter : "all";
}

export function itemLibraryIds(itemDefs, filter = "all") {
  const normalized = normalizeItemLibraryFilter(filter);
  return Object.values(itemDefs)
    .filter((item) => normalized === "all" || item.rarity === normalized)
    .map((item) => item.id);
}

export function combatItemCue(itemId, state = {}) {
  const combat = state.combat || {};
  const flags = state.flags || {};
  const cue = (label, tone) => ({ label, tone });
  switch (itemId) {
    case "autoPencil":
      return combat.pencilUsed ? cue("本回合已触发", "spent") : cue("首张攻击待触发", "ready");
    case "thickNotebook":
      return combat.notebookUsed ? cue("本回合已触发", "spent") : cue("首次护甲待触发", "ready");
    case "mistakeBook":
      return combat.mistakeBookUsed ? cue("本场已触发", "spent") : cue("破防后待触发", "ready");
    case "earplugs":
      return combat.earplugsUsed ? cue("本场已触发", "spent") : cue("首次走神待抵挡", "ready");
    case "bandage": {
      const startingHp = Number(combat.startingHp);
      const maxHp = Number(state.maxHp);
      const triggered = Number.isFinite(startingHp) && maxHp > 0 && startingHp * 2 <= maxHp;
      return triggered ? cue("入场已触发", "active") : cue("未达半血", "passive");
    }
    case "petSnack":
      return cue("入场已充能", "active");
    case "silentPhone":
      return cue("首回合已多抽 1 张", "active");
    case "allNighter":
      return cue("持续：能量 +1", "active");
    case "referenceBooks":
      return cue("持续：抽牌 +1", "active");
    case "studentId":
      return cue("商店生效", "passive");
    case "eraser":
      return flags.eraserUsed ? cue("本学期已使用", "spent") : cue("战后奖励待命", "passive");
    default:
      return cue("自动生效", "passive");
  }
}

export const SEMESTER_WEEK_COUNT = 16;

export function feedbackEntryDecision(currentScreen, currentContext = {}) {
  const screen = typeof currentScreen === "string" && currentScreen ? currentScreen : "unknown";
  const context = currentContext && typeof currentContext === "object" && !Array.isArray(currentContext)
    ? currentContext
    : {};
  const parentScreen = typeof context.returnState?.screen === "string" && context.returnState.screen
    ? context.returnState.screen
    : null;
  const issueScreen = ["rules", "archive"].includes(screen) ? parentScreen || screen : screen;
  const returnScreen = ["rules", "archive"].includes(screen) ? screen : "archive";
  return {
    issueScreen,
    returnState: { screen: returnScreen, context }
  };
}

export function semesterCalendarWeeks(semesterPlan, currentWeek, weekCount = SEMESTER_WEEK_COUNT) {
  const total = Math.max(1, Math.floor(Number(weekCount) || SEMESTER_WEEK_COUNT));
  const activeWeek = Math.min(total, Math.max(1, Math.floor(Number(currentWeek) || 1)));
  return Array.from({ length: total }, (_, index) => {
    const week = index + 1;
    const nodes = Array.isArray(semesterPlan?.[week]) ? semesterPlan[week] : [];
    return {
      week,
      status: week < activeWeek ? "done" : week === activeWeek ? "current" : "upcoming",
      nodes: nodes.map((node) => ({
        type: node?.challenge
          ? "challenge"
          : node?.type === "combat" && week === 8
          ? "elite"
          : node?.type === "combat" && week === total
          ? "boss"
          : node?.type || "unknown",
        label: String(node?.label || "未知安排")
      }))
    };
  });
}

export function newGameStartDecision(saved, explicitlyConfirmed = false) {
  return saved && !explicitlyConfirmed ? NEW_GAME_START.confirm : NEW_GAME_START.start;
}

export function endTurnDecision(preview, explicitlyConfirmed = false) {
  return preview?.lethal && !explicitlyConfirmed ? END_TURN_ACTION.confirm : END_TURN_ACTION.end;
}

export function endTurnRiskGuidance(preview = {}, currentHp = 0) {
  const hp = Math.max(0, Number(currentHp) || 0);
  const attackTotal = Math.max(0, Number(preview.attackTotal) || 0);
  const currentBlock = Math.max(0, Number(preview.currentBlock) || 0);
  const blocked = Math.max(0, Number(preview.blocked) || 0);
  const attackHpLoss = Math.max(0, Number(preview.attackHpLoss) || 0);
  const unavoidableHpLoss = Math.max(0, Number(preview.endTurnHpLoss) || 0);
  const totalHpLoss = Math.max(0, Number(preview.totalHpLoss) || 0);
  const lethal = Boolean(preview.lethal || (hp > 0 && totalHpLoss >= hp));
  const base = {
    attackTotal,
    currentBlock,
    blocked,
    preventableHpLoss: attackHpLoss,
    unavoidableHpLoss,
    totalHpLoss,
    armorNeeded: attackHpLoss
  };

  if (lethal) {
    if (hp > 0 && unavoidableHpLoss >= hp) {
      return {
        ...base,
        state: "lethal",
        armorNeeded: 0,
        headline: "情绪内耗将直接击倒你",
        detail: `${unavoidableHpLoss} 点伤害无视护甲；优先结束战斗，或寻找恢复手段。`,
        buttonDetail: "致命"
      };
    }
    const armorNeeded = Math.min(
      attackHpLoss,
      Math.max(1, totalHpLoss - Math.max(0, hp - 1))
    );
    return {
      ...base,
      state: "lethal",
      armorNeeded,
      headline: `还差 ${armorNeeded} 护甲才能活下来`,
      detail: unavoidableHpLoss
        ? `补足护甲后仍会承受 ${unavoidableHpLoss} 点情绪内耗，先继续出牌。`
        : "先继续出牌获得护甲、击败敌人或使用宠物技能。",
      buttonDetail: "致命"
    };
  }

  if (totalHpLoss > 0) {
    if (attackHpLoss > 0) {
      return {
        ...base,
        state: "hit",
        headline: unavoidableHpLoss
          ? `还差 ${attackHpLoss} 护甲可挡住攻击`
          : `还差 ${attackHpLoss} 护甲可无伤`,
        detail: unavoidableHpLoss
          ? `即使补足护甲，仍会承受 ${unavoidableHpLoss} 点情绪内耗。`
          : "补足后结束回合可保持无伤。",
        buttonDetail: `-${totalHpLoss} 生命`
      };
    }
    return {
      ...base,
      state: "hit",
      armorNeeded: 0,
      headline: `${unavoidableHpLoss} 点情绪内耗无法被护甲抵挡`,
      detail: "优先结束战斗，或确认当前生命可以承担这次损失。",
      buttonDetail: `-${totalHpLoss} 生命`
    };
  }

  if (attackTotal > 0) {
    return {
      ...base,
      state: "safe",
      armorNeeded: 0,
      headline: "防守到位，可以无伤结束回合",
      detail: `当前 ${currentBlock} 护甲已挡住 ${blocked} 点攻击。`,
      buttonDetail: "无伤"
    };
  }

  return {
    ...base,
    state: "safe",
    armorNeeded: 0,
    headline: "本回合是安全窗口",
    detail: "敌人不会造成生命伤害，可以优先输出或准备下回合。",
    buttonDetail: "安全"
  };
}

function counterplayInteger(value, fallback = 0) {
  let number = fallback;
  try {
    number = Number(value);
  } catch {
    return Math.max(0, Math.floor(fallback));
  }
  return Number.isFinite(number)
    ? Math.max(0, Math.floor(number))
    : Math.max(0, Math.floor(fallback));
}

function makeEnemyCounterplayCue(tone, label, detail) {
  return {
    tone: String(tone || "safe"),
    label: String(label || "本回合 · 应对"),
    detail: String(detail || "按公开意图安排本回合。")
  };
}

function appendEnemyCounterplayDetail(cue, suffix, overrides = {}) {
  const first = String(cue?.detail || "").replace(/[。；\s]+$/u, "");
  const second = String(suffix || "").replace(/[。；\s]+$/u, "");
  return makeEnemyCounterplayCue(
    overrides.tone || cue?.tone,
    overrides.label || cue?.label,
    [first, second].filter(Boolean).join("；") + "。"
  );
}

function enemyDefenseCounterplayCue(intent = {}, risk = {}) {
  const attack = counterplayInteger(intent?.attack);
  const hits = attack > 0 ? Math.max(1, counterplayInteger(intent?.hits, 1)) : 0;
  const attackTotal = Object.prototype.hasOwnProperty.call(risk || {}, "attackTotal")
    ? counterplayInteger(risk.attackTotal)
    : attack * hits;
  const state = String(risk?.state || "");
  const armorNeeded = counterplayInteger(risk?.armorNeeded);
  const preventableHpLoss = counterplayInteger(risk?.preventableHpLoss);
  const unavoidableHpLoss = counterplayInteger(risk?.unavoidableHpLoss);

  if (state === "lethal") {
    return armorNeeded > 0
      ? makeEnemyCounterplayCue("danger", "本回合 · 保命", `至少再补 ${armorNeeded} 点护甲保命，或本回合击败敌人。`)
      : makeEnemyCounterplayCue("danger", "本回合 · 必须结束", "护甲挡不住本次致命损失，必须本回合击败敌人。");
  }
  if (state === "hit") {
    if (preventableHpLoss > 0) {
      return makeEnemyCounterplayCue("guard", "本回合 · 补护甲", `再补 ${preventableHpLoss} 点护甲可挡住本次攻击。`);
    }
    if (unavoidableHpLoss > 0) {
      return makeEnemyCounterplayCue("danger", "本回合 · 抢先结束", "护甲挡不住本次情绪内耗，优先结束战斗。");
    }
  }
  if (attackTotal > 0) {
    return state === "safe"
      ? makeEnemyCounterplayCue("safe", "本回合 · 放心输出", "现有护甲足够，剩余能量可以输出。")
      : makeEnemyCounterplayCue("guard", "本回合 · 先防守", "按头顶伤害补足护甲，剩余能量再输出。");
  }
  return makeEnemyCounterplayCue("window", "本回合 · 抢输出", "敌人本回合不攻击，优先输出。");
}

function enemyPlannedActionPhrase(plan) {
  const action = plan?.action && typeof plan.action === "object" ? plan.action : {};
  const name = typeof action.name === "string" && action.name ? action.name : action.source === "pet" ? "宠物技能" : "这张牌";
  return `${action.source === "pet" ? "发动" : "打出"}「${name}」`;
}

function enemyPlannedCounterplayCue(plan, mode = "counter", enemyId = "") {
  if (!plan || typeof plan !== "object") return null;
  const actionPhrase = enemyPlannedActionPhrase(plan);
  const projection = plan.projection && typeof plan.projection === "object" ? plan.projection : {};
  const preview = plan.preview && typeof plan.preview === "object" ? plan.preview : {};
  const followup = plan.followup && typeof plan.followup === "object" ? plan.followup : null;

  if (mode === "finish") {
    if (plan.kind === "cleanse" && followup) {
      return makeEnemyCounterplayCue(
        "counter",
        "本回合 · 可直接斩杀",
        `${actionPhrase}，再接「${followup.cardName || "攻击牌"}」，伤害 ${counterplayInteger(followup.attackTotalBefore)}→${counterplayInteger(followup.attackTotalAfter)}，可结束战斗。`
      );
    }
    return makeEnemyCounterplayCue(
      "counter",
      "本回合 · 可直接斩杀",
      `${actionPhrase}可造成 ${counterplayInteger(preview.healthDamage)} 点生命伤害，直接结束战斗。`
    );
  }

  if (mode === "rescue") {
    return makeEnemyCounterplayCue(
      "guard",
      "本回合 · 可直接脱险",
      `${actionPhrase}：${String(plan.tacticalCue?.detail || "可解除当前致命风险").replace(/[。；\s]+$/u, "")}。`
    );
  }

  if (plan.kind === "statusHits") {
    const attackName = enemyId === "madMilkDragon" ? "怪笑连震" : "轰炸";
    return makeEnemyCounterplayCue(
      "counter",
      "本回合 · 可直接降段",
      `${actionPhrase}可清理 ${counterplayInteger(projection.cleared)} 张状态，${attackName} ${counterplayInteger(projection.hitsBefore)}→${counterplayInteger(projection.hitsAfter)} 段。`
    );
  }
  if (plan.kind === "enemyBlockAttack") {
    return makeEnemyCounterplayCue(
      "counter",
      "本回合 · 可直接降压",
      `${actionPhrase}可击破 ${counterplayInteger(projection.blockBroken)} 点护甲，重击 ${counterplayInteger(projection.perHitBefore)}→${counterplayInteger(projection.perHitAfter)}。`
    );
  }
  if (plan.kind === "rivalInterrupt") {
    return makeEnemyCounterplayCue(
      "counter",
      "本回合 · 可直接打断",
      `${actionPhrase}可将内卷进度补到 ${counterplayInteger(projection.cap)}，攻击 ${counterplayInteger(projection.perHitBefore)}→${counterplayInteger(projection.perHitAfter)}。`
    );
  }
  if (plan.kind === "examBlank") {
    return makeEnemyCounterplayCue(
      "counter",
      "本回合 · 可直接破题",
      `${actionPhrase}可击破剩余 ${counterplayInteger(projection.remainingBlock)} 点护甲，大题 ${counterplayInteger(projection.perHitBefore)}→${counterplayInteger(projection.perHitAfter)}。`
    );
  }
  if (plan.kind === "guard") {
    return makeEnemyCounterplayCue(
      "guard",
      "本回合 · 可直接无伤",
      `${actionPhrase}：${String(plan.tacticalCue?.detail || "可挡住本次伤害").replace(/[。；\s]+$/u, "")}。`
    );
  }
  if (plan.kind === "cleanse" && followup) {
    return makeEnemyCounterplayCue(
      "counter",
      "本回合 · 可恢复攻击",
      `${actionPhrase}，再接「${followup.cardName || "攻击牌"}」；伤害 ${counterplayInteger(followup.attackTotalBefore)}→${counterplayInteger(followup.attackTotalAfter)}。`
    );
  }
  if (plan.kind === "mitigate") {
    return makeEnemyCounterplayCue(
      "guard",
      "本回合 · 先减损",
      `${actionPhrase}可将预计损失 ${counterplayInteger(plan.currentLoss)}→${counterplayInteger(plan.projectedLoss)}。`
    );
  }
  if (plan.kind === "unaffected") {
    const healthDamage = counterplayInteger(preview.healthDamage);
    const blockBroken = counterplayInteger(preview.enemyBlockAbsorbed);
    const result = healthDamage > 0
      ? `造成 ${healthDamage} 点生命伤害`
      : `击破 ${blockBroken} 点护甲`;
    return makeEnemyCounterplayCue(
      "counter",
      "本回合 · 走神替代路线",
      `${actionPhrase}不受走神影响，可${result}。`
    );
  }
  return null;
}

function unresolvedImmediateCounterplayDetail(mechanicState, distracted, enemyId = "") {
  if (mechanicState?.type === "statusHits" && counterplayInteger(mechanicState.value) > 0) {
    return enemyId === "madMilkDragon"
      ? "当前没有单张牌或宠物能直接压低怪笑连击段数"
      : "当前没有单张牌或宠物能直接压低轰炸段数";
  }
  if (mechanicState?.type === "enemyBlockAttack" && counterplayInteger(mechanicState.sourceCount) > 0) {
    return "当前没有单张牌或宠物能直接降低蓄压重击";
  }
  if (mechanicState?.type === "rivalInterrupt" && mechanicState.triggered !== true) {
    const cap = Math.max(1, counterplayInteger(mechanicState.cap, 10));
    if (counterplayInteger(mechanicState.value) < cap) return "当前没有单张牌或宠物能直接完成打断";
  }
  if (mechanicState?.type === "examBlank" && mechanicState.windowOpen === true && mechanicState.triggered !== true) {
    if (counterplayInteger(mechanicState.remainingBlock) > 0) return "当前没有单张牌或宠物能直接完成破题";
  }
  if (distracted === true) return "当前没有可衔接攻击的清除牌或可用的不受走神动作";
  return "";
}

function enemyUnavailableImmediateCue(defenseCue, risk = {}, detail = "") {
  const totalHpLoss = counterplayInteger(risk.totalHpLoss);
  const state = String(risk.state || "");
  let consequence = "先按当前手牌重新组合路线";
  if (state === "safe") {
    consequence = counterplayInteger(risk.attackTotal) > 0
      ? "当前护甲已经挡住本次攻击"
      : "敌人本回合不会造成生命伤害";
  } else if (totalHpLoss > 0) {
    consequence = `结束回合预计损失 ${totalHpLoss} 生命，需要组合多张牌或承担结果`;
  }
  return makeEnemyCounterplayCue(
    defenseCue?.tone === "danger" ? "danger" : state === "safe" ? "safe" : "guard",
    "本回合 · 暂无直接路线",
    `${detail || "当前没有单张牌或宠物能直接降低本回合损失"}；${consequence}。`
  );
}

/**
 * 根据已经结算倍率的当前意图生成一句可执行建议。
 * 静态敌人 tip 仅作未知敌人的后备文案，正式敌人始终按当前行动与机制进度提示。
 */
export function enemyIntentCounterplayCue(enemyId, intent = {}, options = {}) {
  const resolvedIntent = intent && typeof intent === "object" ? intent : {};
  const settings = options && typeof options === "object" ? options : {};
  const mechanicState = resolvedIntent.mechanicState && typeof resolvedIntent.mechanicState === "object"
    ? resolvedIntent.mechanicState
    : null;
  const risk = settings.risk && typeof settings.risk === "object" ? settings.risk : {};
  const defenseCue = enemyDefenseCounterplayCue(resolvedIntent, risk);
  const attack = counterplayInteger(resolvedIntent.attack);
  const hits = attack > 0 ? Math.max(1, counterplayInteger(resolvedIntent.hits, 1)) : 0;
  const attackTotal = Object.prototype.hasOwnProperty.call(risk, "attackTotal")
    ? counterplayInteger(risk.attackTotal)
    : attack * hits;
  const turn = normalizedIntentTurn(settings.intentTurn);
  const id = String(enemyId || "");
  const immediatePlan = settings.plan && typeof settings.plan === "object"
    ? settings.plan
    : { finish: null, rescue: null, counter: null };
  const noAttackWindow = (label, detail) => (
    attackTotal === 0 && defenseCue.tone === "danger"
      ? appendEnemyCounterplayDetail(defenseCue, "敌人本回合不会攻击")
      : makeEnemyCounterplayCue("window", label, detail)
  );

  if (settings.pendingDiscard === true) {
    return makeEnemyCounterplayCue(
      String(risk.state || "") === "lethal" ? "danger" : "guard",
      "本回合 · 先完成弃牌",
      "先选择一张手牌弃掉，再根据更新后的手牌安排应对。"
    );
  }

  const finishCue = enemyPlannedCounterplayCue(immediatePlan.finish, "finish", id);
  if (finishCue) return finishCue;

  // 可安全斩杀和真实脱险优先于理论机制；仍无解时绝不能盖住致命信息。
  if (String(risk.state || "") === "lethal") {
    return enemyPlannedCounterplayCue(immediatePlan.rescue, "rescue", id) || defenseCue;
  }

  const plannedCounterCue = enemyPlannedCounterplayCue(immediatePlan.counter, "counter", id);
  if (plannedCounterCue) return plannedCounterCue;

  if (settings.actionsEvaluated === true) {
    const unavailableDetail = unresolvedImmediateCounterplayDetail(mechanicState, settings.distracted, id);
    if (unavailableDetail || String(risk.state || "") === "hit" || defenseCue.tone === "danger") {
      return enemyUnavailableImmediateCue(defenseCue, risk, unavailableDetail);
    }
  }

  if (mechanicState?.type === "statusHits") {
    const sourceCount = counterplayInteger(mechanicState.sourceCount);
    const cap = Math.max(1, counterplayInteger(mechanicState.cap, id === "madMilkDragon" ? 3 : 1));
    const value = counterplayInteger(mechanicState.value);
    if (id === "madMilkDragon") {
      if (value > 0) {
        const clearNeeded = Math.max(1, sourceCount - cap + 1);
        return makeEnemyCounterplayCue(
          "counter",
          "本回合 · 止住怪笑",
          `当前笑压 ${Math.min(cap, value)}/${cap}，共 ${hits} 段；主动清理 ${clearNeeded} 张紧张可少 1 段。`
        );
      }
      return appendEnemyCounterplayDetail(defenseCue, "当前没有紧张为怪笑加段", {
        label: "本回合 · 无笑压加段"
      });
    }
    if (value > 0) {
      const clearNeeded = Math.max(1, sourceCount - cap + 1);
      if (id === "rollCallWarden") {
        return makeEnemyCounterplayCue(
          "counter",
          "本回合 · 清理缺席",
          `主动清理 ${clearNeeded} 张待办可少 1 段；三个牌区都会计入。`
        );
      }
      return makeEnemyCounterplayCue(
        "counter",
        "本回合 · 压低未读",
        `主动清理 ${clearNeeded} 张紧张可少 1 段；自然消耗来不及。`
      );
    }
    return appendEnemyCounterplayDetail(defenseCue, id === "rollCallWarden" ? "当前没有待办加段" : "当前没有紧张加段", {
      label: id === "rollCallWarden" ? "本回合 · 无缺席加段" : "本回合 · 无未读加段"
    });
  }

  if (mechanicState?.type === "enemyBlockAttack") {
    const sourceCount = counterplayInteger(mechanicState.sourceCount);
    const cap = counterplayInteger(mechanicState.cap);
    if (sourceCount === 0) {
      return appendEnemyCounterplayDetail(defenseCue, "蓄压已经清空，重击只有基础伤害", {
        label: "本回合 · 蓄压已清"
      });
    }
    if (sourceCount > cap) {
      return makeEnemyCounterplayCue(
        "counter",
        "本回合 · 先破甲",
        `先击破 ${sourceCount - cap + 1} 点护甲，重击才会降低 1 点。`
      );
    }
    return makeEnemyCounterplayCue(
      "counter",
      "本回合 · 逐点降伤",
      "每击破 1 点护甲，重击就降低 1 点。"
    );
  }

  if (mechanicState?.type === "rivalInterrupt") {
    const cap = Math.max(1, counterplayInteger(mechanicState.cap, 10));
    const value = Math.min(cap, counterplayInteger(mechanicState.value));
    const remaining = Math.max(0, cap - value);
    const reduction = counterplayInteger(mechanicState.attackReduction, 3);
    const enemyBlock = counterplayInteger(settings.enemy?.block ?? settings.enemyBlock);
    if (mechanicState.triggered === true || remaining === 0) {
      return appendEnemyCounterplayDetail(defenseCue, "打断已经生效", {
        label: "本回合 · 已打断"
      });
    }
    return makeEnemyCounterplayCue(
      "counter",
      "本回合 · 打断内卷",
      enemyBlock > 0
        ? `先击破 ${enemyBlock} 点护甲，再造成 ${remaining} 点生命伤害，可让本次攻击 -${reduction}。`
        : `再造成 ${remaining} 点生命伤害，可让本次攻击 -${reduction}。`
    );
  }

  if (mechanicState?.type === "examBlank") {
    const before = counterplayInteger(mechanicState.attackBefore, attack);
    const reduction = counterplayInteger(mechanicState.attackReduction, 6);
    const after = counterplayInteger(mechanicState.attackAfter, Math.max(0, before - reduction));
    const remainingBlock = counterplayInteger(mechanicState.remainingBlock);
    if (mechanicState.triggered === true) {
      return appendEnemyCounterplayDetail(defenseCue, `破题已生效，大题 ${before}→${after}`, {
        label: "本回合 · 破题成功"
      });
    }
    if (mechanicState.windowOpen === true) {
      return makeEnemyCounterplayCue(
        "counter",
        "本回合 · 填空破题",
        remainingBlock > 0
          ? `再击破 ${remainingBlock} 点护甲，可把大题 ${before}→${Math.max(0, before - reduction)}。`
          : `破题条件已经满足，可把大题 ${before}→${Math.max(0, before - reduction)}。`
      );
    }
    return appendEnemyCounterplayDetail(defenseCue, "破题窗口尚未开启", {
      label: "本回合 · 先防大题"
    });
  }

  if (id === "phoneSpirit" && settings.distracted === true) {
    return makeEnemyCounterplayCue(
      "counter",
      "本回合 · 先解走神",
      "先清走神再出攻击；伤害技能与宠物不受影响。"
    );
  }

  const step = turn % (["finalExam", "madMilkDragon"].includes(id) ? 4 : 3);
  if (id === "sleepyBug") {
    if (step === 1) return noAttackWindow("本回合 · 抢输出", "敌人本回合不攻击；别叠下回合会清零的护甲，直接输出。");
    return appendEnemyCounterplayDetail(defenseCue, step === 0 ? "撑过后是安全输出窗口" : "这是本轮最高伤害");
  }
  if (id === "homeworkBlob") {
    if (step === 0) return appendEnemyCounterplayDetail(defenseCue, "待办会进入弃牌堆，抽到手后再清");
    if (step === 2) return noAttackWindow("本回合 · 提前输出", `敌人本回合不攻击；结算后会获得 ${counterplayInteger(resolvedIntent.block)} 点护甲。`);
    return defenseCue;
  }
  if (id === "alarmClock") {
    if (step === 0) return noAttackWindow("本回合 · 直接输出", "敌人本回合不攻击；别叠下回合会清零的护甲。");
    return appendEnemyCounterplayDetail(defenseCue, step === 1 ? "下一步是本轮最高伤害爆发" : "撑过后进入安全窗口");
  }
  if (id === "phoneSpirit") {
    if (step === 0) return noAttackWindow("本回合 · 抢输出", "敌人本回合不攻击；走神会在下回合生效。");
    if (step === 2) return appendEnemyCounterplayDetail(defenseCue, "走神会在下回合生效");
    return defenseCue;
  }
  if (id === "groupChat") {
    if (step === 1) return noAttackWindow("本回合 · 抢输出", "敌人本回合不攻击；紧张会进入弃牌堆。");
    if (step === 2) return appendEnemyCounterplayDetail(defenseCue, "新紧张会强化下次消息轰炸");
    return defenseCue;
  }
  if (id === "printerJam") {
    if (step === 0) return noAttackWindow("本回合 · 提前输出", `敌人本回合不攻击；结算后会留下 ${counterplayInteger(resolvedIntent.block)} 点蓄压护甲。`);
    return defenseCue;
  }
  if (id === "rollCallWarden") {
    if (step === 0) return noAttackWindow("本回合 · 抢先清理", "突然点名不攻击；1张待办会洗入抽牌堆。");
    if (step === 2) return noAttackWindow("本回合 · 集中输出", `整理名册不攻击；结算后获得 ${counterplayInteger(resolvedIntent.block)} 点护甲。`);
    return defenseCue;
  }
  if (id === "clubMegaphone") {
    if (step === 1) return appendEnemyCounterplayDetail(defenseCue, "新紧张会进入弃牌堆");
    if (step === 2) return noAttackWindow("本回合 · 破展板", `展板掩护不攻击；会获得 ${counterplayInteger(resolvedIntent.block)} 点护甲并施加走神。`);
    return defenseCue;
  }
  if (id === "finalExam") {
    if (step === 0) return noAttackWindow("本回合 · 抢输出", "发卷不会攻击；2 张紧张会洗入抽牌堆。");
    if (step === 1) return appendEnemyCounterplayDetail(defenseCue, "撑过后会进入填空题");
    if (step === 2) return appendEnemyCounterplayDetail(defenseCue, `结算后会留下 ${counterplayInteger(resolvedIntent.block)} 点护甲，下回合先破甲`);
    return defenseCue;
  }
  if (id === "madMilkDragon") {
    if (step === 0) {
      const addStatus = resolvedIntent.addStatus && typeof resolvedIntent.addStatus === "object"
        ? resolvedIntent.addStatus
        : null;
      const statusCount = Math.max(1, counterplayInteger(addStatus?.count, 2));
      return noAttackWindow(
        "本回合 · 抢输出",
        `魔性开嗓不攻击；${statusCount} 张紧张会进入弃牌堆，下一拍是奶泡头槌。`
      );
    }
    if (step === 1) return appendEnemyCounterplayDetail(defenseCue, "撑过头槌后是无攻击的蓄泡窗口");
    if (step === 2) {
      return noAttackWindow(
        "本回合 · 破甲清牌",
        `憋笑蓄泡不攻击；会获得 ${counterplayInteger(resolvedIntent.block, 9)} 点护甲并施加走神，下一拍爆笑前优先清紧张。`
      );
    }
    return appendEnemyCounterplayDetail(defenseCue, "紧张会让怪笑连震追加段数；能清则先清");
  }

  const fallback = String(settings.fallback || "").trim();
  return fallback
    ? makeEnemyCounterplayCue(defenseCue.tone, defenseCue.label, fallback)
    : defenseCue;
}

export function combatMechanicStatusCleared(cardPreview = {}, intent = {}, hand = []) {
  if (Math.max(0, Math.floor(safeBattleValue(cardPreview.statusCount))) === 0) return 0;
  if (intent.scaling?.type !== "statusHits" || !Array.isArray(hand)) return 0;
  const statusId = typeof intent.scaling.statusId === "string" ? intent.scaling.statusId : "";
  if (!statusId) return 0;
  return hand.filter((card) => card?.id === statusId).length;
}

export function combatStatusHitsProjection(statusCleared, incomingPreview = {}, mechanicState = {}) {
  if (mechanicState?.type !== "statusHits") return null;
  const sourceBefore = Math.max(0, Math.floor(safeBattleValue(mechanicState.sourceCount)));
  const cap = Math.max(0, Math.floor(safeBattleValue(mechanicState.cap)));
  const valueBefore = Math.min(
    cap,
    sourceBefore,
    Math.max(0, Math.floor(safeBattleValue(mechanicState.value)))
  );
  const cleared = Math.min(
    sourceBefore,
    Math.max(0, Math.floor(safeBattleValue(statusCleared)))
  );
  const sourceAfter = Math.max(0, sourceBefore - cleared);
  const valueAfter = Math.min(cap, sourceAfter);
  const reducedHits = Math.max(0, valueBefore - valueAfter);
  const perHit = Math.max(0, safeBattleValue(incomingPreview.perHit));
  const hitsBefore = Math.max(0, Math.floor(safeBattleValue(incomingPreview.hits)));
  const hitsAfter = Math.max(1, hitsBefore - reducedHits);

  if (!cleared || !reducedHits || !perHit || hitsAfter >= hitsBefore) return null;
  return {
    cleared,
    sourceBefore,
    sourceAfter,
    valueBefore,
    valueAfter,
    reducedHits,
    perHit,
    hitsBefore,
    hitsAfter,
    attackTotalAfter: perHit * hitsAfter
  };
}

export function combatDirectActionPreview(rawPreview = {}, options = {}) {
  const source = rawPreview && typeof rawPreview === "object" ? rawPreview : {};
  const settings = options && typeof options === "object" ? options : {};
  const damage = Math.max(0, safeBattleValue(source.damage));
  const enemyBlock = Math.max(0, safeBattleValue(settings.enemyBlock));
  const enemyHp = Math.max(0, safeBattleValue(settings.enemyHp));
  const enemyBlockAbsorbed = Math.min(enemyBlock, damage);
  const healthDamage = Math.min(enemyHp, Math.max(0, damage - enemyBlockAbsorbed));
  return {
    cost: Math.max(0, Math.floor(safeBattleValue(settings.cost ?? source.cost))),
    hasDamage: damage > 0,
    damagePerHit: damage,
    hits: damage > 0 ? 1 : 0,
    attackTotal: damage,
    enemyBlockAbsorbed,
    healthDamage,
    block: Math.max(0, safeBattleValue(source.block)),
    selfDamage: Math.max(0, safeBattleValue(source.selfDamage)),
    statusCount: 0,
    modifiers: []
  };
}

export function combatEnemyBlockAttackProjection(cardPreview = {}, incomingPreview = {}, mechanicState = {}) {
  if (mechanicState?.type !== "enemyBlockAttack") return null;
  const sourceBefore = Math.max(0, Math.floor(safeBattleValue(mechanicState.sourceCount)));
  const cap = Math.max(0, Math.floor(safeBattleValue(mechanicState.cap)));
  const bonusBefore = Math.min(
    cap,
    sourceBefore,
    Math.max(0, Math.floor(safeBattleValue(mechanicState.value)))
  );
  const blockBroken = Math.min(
    sourceBefore,
    Math.max(0, Math.floor(safeBattleValue(cardPreview.enemyBlockAbsorbed)))
  );
  const sourceAfter = Math.max(0, sourceBefore - blockBroken);
  const bonusAfter = Math.min(cap, sourceAfter);
  const bonusReduced = Math.max(0, bonusBefore - bonusAfter);
  const perHitBefore = Math.max(0, safeBattleValue(incomingPreview.perHit));
  const hits = perHitBefore > 0
    ? Math.max(1, Math.floor(safeBattleValue(incomingPreview.hits) || 1))
    : 0;

  if (!blockBroken || !bonusReduced || !hits) return null;
  const perHitAfter = Math.max(0, perHitBefore - bonusReduced);
  return {
    blockBroken,
    sourceBefore,
    sourceAfter,
    bonusBefore,
    bonusAfter,
    bonusReduced,
    perHitBefore,
    perHitAfter,
    hits,
    attackTotalAfter: perHitAfter * hits
  };
}

export function combatRivalInterruptProjection(cardPreview = {}, incomingPreview = {}, mechanicState = {}) {
  if (mechanicState?.type !== "rivalInterrupt" || mechanicState.triggered) return null;
  const value = Math.max(0, Math.floor(safeBattleValue(mechanicState.value)));
  const cap = Math.max(1, Math.floor(safeBattleValue(mechanicState.cap) || 10));
  const healthDamage = Math.max(0, safeBattleValue(cardPreview.healthDamage));
  if (!healthDamage || value >= cap || value + healthDamage < cap) return null;
  const attackReduction = Math.max(0, Math.floor(safeBattleValue(mechanicState.attackReduction) || 3));
  const perHitBefore = Math.max(0, safeBattleValue(incomingPreview.perHit));
  const hits = perHitBefore > 0
    ? Math.max(1, Math.floor(safeBattleValue(incomingPreview.hits) || 1))
    : 0;
  if (!attackReduction || !hits) return null;
  const perHitAfter = Math.max(0, perHitBefore - attackReduction);
  return {
    valueBefore: value,
    valueAfter: cap,
    cap,
    healthDamage,
    attackReduction,
    perHitBefore,
    perHitAfter,
    hits,
    attackTotalAfter: perHitAfter * hits
  };
}

export function combatFinalExamBlankProjection(cardPreview = {}, incomingPreview = {}, mechanicState = {}) {
  if (
    mechanicState?.type !== "examBlank"
    || mechanicState.triggered
    || mechanicState.windowOpen !== true
  ) return null;
  const cap = Math.max(1, Math.floor(safeBattleValue(mechanicState.cap) || 8));
  const value = Math.min(cap, Math.max(0, Math.floor(safeBattleValue(mechanicState.value))));
  const remainingBlock = Math.max(0, Math.floor(safeBattleValue(mechanicState.remainingBlock)));
  const blockBroken = Math.max(0, Math.floor(safeBattleValue(cardPreview.enemyBlockAbsorbed)));
  if (!remainingBlock || blockBroken < remainingBlock) return null;
  const attackReduction = Math.max(0, Math.floor(safeBattleValue(mechanicState.attackReduction) || 6));
  const perHitBefore = Math.max(0, safeBattleValue(incomingPreview.perHit));
  const hits = perHitBefore > 0
    ? Math.max(1, Math.floor(safeBattleValue(incomingPreview.hits) || 1))
    : 0;
  if (!attackReduction || !hits) return null;
  const perHitAfter = Math.max(0, perHitBefore - attackReduction);
  return {
    valueBefore: value,
    valueAfter: cap,
    cap,
    remainingBlock,
    blockBroken,
    attackReduction,
    perHitBefore,
    perHitAfter,
    hits,
    attackTotalAfter: perHitAfter * hits
  };
}

export function combatCardTacticalCue(cardPreview = {}, incomingPreview = {}, options = {}) {
  if (options.playable === false) return null;
  const enemyHp = Math.max(0, safeBattleValue(options.enemyHp));
  const playerHp = Math.max(0, safeBattleValue(options.playerHp));
  const healthDamage = Math.max(0, safeBattleValue(cardPreview.healthDamage));
  const selfDamage = Math.max(0, safeBattleValue(cardPreview.selfDamage));

  if (enemyHp > 0 && healthDamage >= enemyHp && playerHp > selfDamage) {
    return {
      tone: "finish",
      label: "可结束战斗",
      detail: `预计造成 ${healthDamage} 点生命伤害`
    };
  }
  if (enemyHp > 0 && healthDamage >= enemyHp) return null;

  if (playerHp <= 0) return null;
  const block = Math.max(0, safeBattleValue(cardPreview.block));
  const currentTotalLoss = Math.max(0, safeBattleValue(incomingPreview.totalHpLoss));
  const hpAfterCard = Math.max(0, playerHp - selfDamage);
  const unavoidableLoss = Math.max(0, safeBattleValue(incomingPreview.endTurnHpLoss));
  const attackTotal = Math.max(0, safeBattleValue(incomingPreview.attackTotal));
  const currentBlock = Math.max(0, safeBattleValue(incomingPreview.currentBlock));
  const lethalBefore = Boolean(incomingPreview.lethal || currentTotalLoss >= playerHp);

  const mechanicState = options.mechanicState;
  const examBlank = combatFinalExamBlankProjection(cardPreview, incomingPreview, mechanicState);
  if (examBlank) {
    const { attackTotalAfter, remainingBlock, perHitBefore, perHitAfter } = examBlank;
    const attackLossAfterCard = unavoidableLoss >= hpAfterCard
      ? 0
      : Math.max(0, attackTotalAfter - currentBlock - block);
    const totalLossAfterCard = unavoidableLoss + attackLossAfterCard;
    const projectedLoss = selfDamage + totalLossAfterCard;
    const lethalAfter = hpAfterCard <= 0 || totalLossAfterCard >= hpAfterCard;
    const label = `破题成功 · 大题 ${perHitBefore}→${perHitAfter}`;
    const detailPrefix = `此牌会击破剩余 ${remainingBlock} 点护甲，本次大题从 ${perHitBefore} 降至 ${perHitAfter}`;

    if (lethalBefore && !lethalAfter) {
      return {
        tone: "rescue",
        label: `${label} · 脱险`,
        detail: `${detailPrefix}，解除致命，预计剩余 ${hpAfterCard - totalLossAfterCard} 生命`
      };
    }
    if (projectedLoss === 0) {
      return { tone: "guard", label: `${label} · 无伤`, detail: `${detailPrefix}，打出后无伤` };
    }
    return {
      tone: lethalAfter ? "danger" : "counter",
      label: lethalAfter ? `${label} · 仍致命` : `${label} · -${projectedLoss}生命`,
      detail: lethalAfter
        ? `${detailPrefix}，仍会致命，预计损失 ${projectedLoss} 生命`
        : `${detailPrefix}，预计损失 ${projectedLoss} 生命`
    };
  }
  const rivalInterrupt = combatRivalInterruptProjection(cardPreview, incomingPreview, mechanicState);
  if (rivalInterrupt) {
    const { attackTotalAfter, cap, perHitBefore, perHitAfter } = rivalInterrupt;
    const attackLossAfterCard = unavoidableLoss >= hpAfterCard
      ? 0
      : Math.max(0, attackTotalAfter - currentBlock - block);
    const totalLossAfterCard = unavoidableLoss + attackLossAfterCard;
    const projectedLoss = selfDamage + totalLossAfterCard;
    const lethalAfter = hpAfterCard <= 0 || totalLossAfterCard >= hpAfterCard;
    const label = `打断内卷 · 攻击 ${perHitBefore}→${perHitAfter}`;
    const detailPrefix = `此牌会让本回合实际伤害达到 ${cap}，卷王攻击从 ${perHitBefore} 降至 ${perHitAfter}`;

    if (lethalBefore && !lethalAfter) {
      return {
        tone: "rescue",
        label: `${label} · 脱险`,
        detail: `${detailPrefix}，解除致命，预计剩余 ${hpAfterCard - totalLossAfterCard} 生命`
      };
    }
    if (projectedLoss === 0) {
      return { tone: "guard", label: `${label} · 无伤`, detail: `${detailPrefix}，打出后无伤` };
    }
    return {
      tone: lethalAfter ? "danger" : "counter",
      label: lethalAfter ? `${label} · 仍致命` : `${label} · -${projectedLoss}生命`,
      detail: lethalAfter
        ? `${detailPrefix}，仍会致命，预计损失 ${projectedLoss} 生命`
        : `${detailPrefix}，预计损失 ${projectedLoss} 生命`
    };
  }
  const mechanicStatusCleared = Math.max(0, Math.floor(safeBattleValue(options.mechanicStatusCleared)));
  const statusHitsProjection = combatStatusHitsProjection(
    mechanicStatusCleared,
    incomingPreview,
    mechanicState
  );
  if (statusHitsProjection) {
    const { cleared, hitsBefore: currentHits, hitsAfter: nextHits, attackTotalAfter: nextAttackTotal } = statusHitsProjection;
    const attackLossAfterCard = unavoidableLoss >= hpAfterCard
      ? 0
      : Math.max(0, nextAttackTotal - currentBlock - block);
    const totalLossAfterCard = unavoidableLoss + attackLossAfterCard;
    const lethalAfter = hpAfterCard <= 0 || totalLossAfterCard >= hpAfterCard;
    const statusName = typeof options.mechanicStatusName === "string" && options.mechanicStatusName
      ? options.mechanicStatusName
      : "状态";
    const label = `轰炸 ${currentHits}→${nextHits}段`;
    const detailPrefix = `清理 ${cleared} 张${statusName}：轰炸从 ${currentHits} 段降至 ${nextHits} 段`;

    if (lethalBefore && !lethalAfter) {
      return {
        tone: "rescue",
        label: `${label} · 脱险`,
        detail: `${detailPrefix}，解除致命，预计剩余 ${hpAfterCard - totalLossAfterCard} 生命`
      };
    }
    if (totalLossAfterCard === 0) {
      return {
        tone: "guard",
        label: `${label} · 无伤`,
        detail: `${detailPrefix}，打出后无伤`
      };
    }
    return {
      tone: lethalAfter ? "danger" : "counter",
      label: lethalAfter ? `${label} · 仍致命` : `${label} · -${totalLossAfterCard}生命`,
      detail: lethalAfter
        ? `${detailPrefix}，仍会致命，预计损失 ${totalLossAfterCard} 生命`
        : `${detailPrefix}，预计损失 ${totalLossAfterCard} 生命`
    };
  }

  const blockAttackProjection = combatEnemyBlockAttackProjection(
    cardPreview,
    incomingPreview,
    mechanicState
  );
  if (blockAttackProjection) {
    const {
      attackTotalAfter,
      blockBroken,
      bonusBefore,
      bonusAfter,
      sourceBefore,
      sourceAfter,
      perHitBefore,
      perHitAfter
    } = blockAttackProjection;
    const attackLossAfterCard = unavoidableLoss >= hpAfterCard
      ? 0
      : Math.max(0, attackTotalAfter - currentBlock - block);
    const totalLossAfterCard = unavoidableLoss + attackLossAfterCard;
    const selfDamage = Math.max(0, playerHp - hpAfterCard);
    const projectedLoss = selfDamage + totalLossAfterCard;
    const lethalAfter = hpAfterCard <= 0 || totalLossAfterCard >= hpAfterCard;
    const label = `重击 ${perHitBefore}→${perHitAfter}`;
    const detailPrefix = `击破 ${blockBroken} 点护甲：敌方护甲从 ${sourceBefore} 降至 ${sourceAfter}，蓄压 +${bonusBefore}→+${bonusAfter}，重击从 ${perHitBefore} 降至 ${perHitAfter}`;
    const lossDetail = selfDamage > 0
      ? `预计合计损失 ${projectedLoss} 生命（卡牌自伤 ${selfDamage}，敌方行动 ${totalLossAfterCard}）`
      : `敌方行动预计造成 ${totalLossAfterCard} 点生命损失`;

    if (lethalBefore && !lethalAfter) {
      return {
        tone: "rescue",
        label: `${label} · 脱险`,
        detail: `${detailPrefix}，解除致命，预计剩余 ${hpAfterCard - totalLossAfterCard} 生命`
      };
    }
    if (totalLossAfterCard === 0 && selfDamage === 0) {
      return {
        tone: "guard",
        label: `${label} · 无伤`,
        detail: `${detailPrefix}，打出后无伤`
      };
    }
    return {
      tone: lethalAfter ? "danger" : "counter",
      label: lethalAfter ? `${label} · 仍致命` : `${label} · -${projectedLoss}生命`,
      detail: lethalAfter
        ? `${detailPrefix}，仍会致命，${lossDetail}`
        : `${detailPrefix}，${lossDetail}`
    };
  }

  const attackLossAfterCard = unavoidableLoss >= hpAfterCard
    ? 0
    : Math.max(0, attackTotal - currentBlock - block);
  const totalLossAfterCard = unavoidableLoss + attackLossAfterCard;
  const lethalAfter = hpAfterCard <= 0 || totalLossAfterCard >= hpAfterCard;

  if (block && currentTotalLoss) {
    if (lethalBefore && !lethalAfter) {
      return {
        tone: "rescue",
        label: "解除致命",
        detail: `打出后预计剩余 ${hpAfterCard - totalLossAfterCard} 生命`
      };
    }
    if (totalLossAfterCard === 0) {
      return {
        tone: "guard",
        label: "打出后无伤",
        detail: `本回合护甲 +${block}`
      };
    }
  }

  const followup = options.distractedFollowup;
  const attackGain = Math.max(0, safeBattleValue(followup?.attackGain));
  const attackTotalBefore = Math.max(0, safeBattleValue(followup?.attackTotalBefore));
  const attackTotalAfter = Math.max(0, safeBattleValue(followup?.attackTotalAfter));
  const followupSelfDamage = Math.max(0, safeBattleValue(followup?.followupSelfDamage));
  const hpAfterFollowup = hpAfterCard - followupSelfDamage;
  const followupFinishes = followup?.lethalAfter === true && followup?.lethalBefore !== true;
  const lethalAfterFollowup = hpAfterFollowup <= 0 || totalLossAfterCard >= hpAfterFollowup;
  if (!followup || !attackGain || attackTotalAfter <= attackTotalBefore || hpAfterCard <= 0 || hpAfterFollowup <= 0) return null;
  if (lethalAfterFollowup && !followupFinishes) return null;
  const cardName = typeof followup.cardName === "string" && followup.cardName ? followup.cardName : "攻击牌";
  const cardCost = Math.max(0, Math.floor(safeBattleValue(followup.cardCost)));
  const remainingEnergy = Math.max(0, Math.floor(safeBattleValue(followup.remainingEnergy)));
  const hits = Math.max(1, Math.floor(safeBattleValue(followup.hits) || 1));
  const damagePerHitBefore = Math.max(0, safeBattleValue(followup.damagePerHitBefore));
  const damagePerHitAfter = Math.max(0, safeBattleValue(followup.damagePerHitAfter));
  const enemyBlockAbsorbedBefore = Math.max(0, safeBattleValue(followup.enemyBlockAbsorbedBefore));
  const enemyBlockAbsorbedAfter = Math.max(0, safeBattleValue(followup.enemyBlockAbsorbedAfter));
  const healthDamageBefore = Math.max(0, safeBattleValue(followup.healthDamageBefore));
  const healthDamageAfter = Math.max(0, safeBattleValue(followup.healthDamageAfter));
  const damageDetail = hits > 1
    ? `每段 ${damagePerHitBefore}→${damagePerHitAfter}，${hits} 段共 ${attackTotalBefore}→${attackTotalAfter}`
    : `伤害 ${attackTotalBefore}→${attackTotalAfter}`;
  const healthDetail = healthDamageBefore !== attackTotalBefore || healthDamageAfter !== attackTotalAfter
    ? `，敌人掉血 ${healthDamageBefore}→${healthDamageAfter}`
    : "";
  const armorDetail = enemyBlockAbsorbedBefore !== enemyBlockAbsorbedAfter
    ? `，击破护甲 ${enemyBlockAbsorbedBefore}→${enemyBlockAbsorbedAfter}`
    : "";
  const selfDamageDetail = followupSelfDamage > 0 ? `，自身失去 ${followupSelfDamage} 生命` : "";
  const detail = `移除当前走神；打出后剩余 ${remainingEnergy} 能量，可接「${cardName}」（${cardCost}费）：${damageDetail}${armorDetail}${healthDetail}${selfDamageDetail}`;

  return {
    tone: followupFinishes ? "finish" : "counter",
    label: followupFinishes ? "解除走神 · 可接斩杀" : "解除走神 · 可接攻击",
    detail: followupFinishes ? `${detail}，可结束战斗` : detail
  };
}

function combatImmediateCurrentLoss(incomingPreview = {}) {
  if (Object.prototype.hasOwnProperty.call(incomingPreview, "totalHpLoss")) {
    return Math.max(0, safeBattleValue(incomingPreview.totalHpLoss));
  }
  const unavoidableLoss = Math.max(0, safeBattleValue(incomingPreview.endTurnHpLoss));
  const attackTotal = Math.max(0, safeBattleValue(incomingPreview.attackTotal));
  const currentBlock = Math.max(0, safeBattleValue(incomingPreview.currentBlock));
  return unavoidableLoss + Math.max(0, attackTotal - currentBlock);
}

function combatImmediateProjectedLoss(preview = {}, incomingPreview = {}, playerHp = 0) {
  const selfDamage = Math.max(0, safeBattleValue(preview.selfDamage));
  const hpAfterAction = Math.max(0, playerHp - selfDamage);
  const unavoidableLoss = Math.max(0, safeBattleValue(incomingPreview.endTurnHpLoss));
  const attackTotal = Math.max(0, safeBattleValue(incomingPreview.attackTotal));
  const currentBlock = Math.max(0, safeBattleValue(incomingPreview.currentBlock));
  const block = Math.max(0, safeBattleValue(preview.block));
  const attackLoss = unavoidableLoss >= hpAfterAction
    ? 0
    : Math.max(0, attackTotal - currentBlock - block);
  const actionLoss = unavoidableLoss + attackLoss;
  return {
    hpAfterAction,
    actionLoss,
    projectedLoss: selfDamage + actionLoss,
    survives: hpAfterAction > actionLoss
  };
}

function combatImmediateMechanicProjection(action, incomingPreview, mechanicState) {
  if (mechanicState?.type === "statusHits") {
    return combatStatusHitsProjection(action.mechanicStatusCleared, incomingPreview, mechanicState);
  }
  if (mechanicState?.type === "enemyBlockAttack") {
    return combatEnemyBlockAttackProjection(action.preview, incomingPreview, mechanicState);
  }
  if (mechanicState?.type === "rivalInterrupt") {
    return combatRivalInterruptProjection(action.preview, incomingPreview, mechanicState);
  }
  if (mechanicState?.type === "examBlank") {
    return combatFinalExamBlankProjection(action.preview, incomingPreview, mechanicState);
  }
  return null;
}

function combatImmediatePlanEntry(action, tacticalCue, projection, loss, currentLoss, index, kind) {
  const cost = Math.max(0, Math.floor(safeBattleValue(action.cost ?? action.preview?.cost)));
  return {
    kind,
    action: {
      key: typeof action.key === "string" ? action.key : `${action.source === "pet" ? "pet" : "card"}-${index}`,
      source: action.source === "pet" ? "pet" : "card",
      name: typeof action.name === "string" && action.name ? action.name : action.source === "pet" ? "宠物技能" : "这张牌",
      cost
    },
    tacticalCue,
    projection,
    preview: action.preview,
    followup: action.distractedFollowup || null,
    currentLoss,
    projectedLoss: loss.projectedLoss,
    _index: index,
    _totalCost: cost + Math.max(0, Math.floor(safeBattleValue(action.distractedFollowup?.cardCost)))
  };
}

function cleanCombatImmediatePlanEntry(entry) {
  if (!entry) return null;
  const { _index, _totalCost, ...clean } = entry;
  return clean;
}

function combatImmediateCleanseFinish(entry, playerHp) {
  const followup = entry?.followup;
  if (
    entry?.kind !== "cleanse"
    || !followup
    || followup.lethalAfter !== true
    || followup.lethalBefore === true
    || safeBattleValue(followup.attackGain) <= 0
  ) return null;
  const combinedSelfDamage = Math.max(0, safeBattleValue(entry.preview?.selfDamage))
    + Math.max(0, safeBattleValue(followup.followupSelfDamage));
  if (playerHp <= combinedSelfDamage) return null;
  return {
    ...entry,
    tacticalCue: {
      tone: "finish",
      label: "解除走神 · 可接斩杀",
      detail: `移除当前走神后接「${followup.cardName || "攻击牌"}」，可结束战斗`
    }
  };
}

/**
 * 只评估一个当前可执行动作，以及引擎已经精确验证过的“清走神→攻击”衔接。
 * 不叠加多张静态预览，避免重复计算护甲、首击加成与一次性物品。
 */
export function combatImmediateCounterplayPlan(actions = [], intent = {}, incomingPreview = {}, options = {}) {
  const settings = options && typeof options === "object" ? options : {};
  const emptyPlan = { finish: null, rescue: null, counter: null };
  if (settings.disabled === true || !Array.isArray(actions)) return emptyPlan;

  const resolvedIntent = intent && typeof intent === "object" ? intent : {};
  const mechanicState = resolvedIntent.mechanicState && typeof resolvedIntent.mechanicState === "object"
    ? resolvedIntent.mechanicState
    : null;
  const enemyHp = Math.max(0, safeBattleValue(settings.enemyHp));
  const playerHp = Math.max(0, safeBattleValue(settings.playerHp));
  if (playerHp <= 0) return emptyPlan;
  const currentLoss = combatImmediateCurrentLoss(incomingPreview);
  const lethal = Boolean(incomingPreview.lethal || currentLoss >= playerHp);
  const evaluated = actions.flatMap((action, index) => {
    if (!action || typeof action !== "object" || action.playable !== true) return [];
    const preview = action.preview && typeof action.preview === "object" ? action.preview : {};
    const tacticalCue = Object.prototype.hasOwnProperty.call(action, "tacticalCue")
      ? action.tacticalCue
      : combatCardTacticalCue(preview, incomingPreview, {
        enemyHp,
        playerHp,
        playable: true,
        mechanicState,
        mechanicStatusCleared: action.mechanicStatusCleared,
        mechanicStatusName: action.mechanicStatusName,
        distractedFollowup: action.distractedFollowup
      });
    const projection = combatImmediateMechanicProjection(
      { ...action, preview },
      incomingPreview,
      mechanicState
    );
    const loss = combatImmediateProjectedLoss(preview, incomingPreview, playerHp);
    return [{ action: { ...action, preview }, tacticalCue, projection, loss, index }];
  });

  const byCostThenImpact = (left, right) => (
    left._totalCost - right._totalCost
    || left.projectedLoss - right.projectedLoss
    || safeBattleValue(right.preview?.healthDamage) - safeBattleValue(left.preview?.healthDamage)
    || left._index - right._index
  );
  const entries = evaluated.map(({ action, tacticalCue, projection, loss, index }) => {
    let kind = "mitigate";
    if (action.distractedFollowup) kind = "cleanse";
    else if (projection && mechanicState?.type) kind = mechanicState.type;
    else if (tacticalCue?.tone === "guard") kind = "guard";
    else if (action.unaffectedByDistracted === true) kind = "unaffected";
    return combatImmediatePlanEntry(action, tacticalCue, projection, loss, currentLoss, index, kind);
  });

  const finish = entries
    .flatMap((entry) => {
      if (entry.tacticalCue?.tone === "finish") return [entry];
      const cleanseFinish = combatImmediateCleanseFinish(entry, playerHp);
      return cleanseFinish ? [cleanseFinish] : [];
    })
    .sort(byCostThenImpact)[0] || null;
  const rescue = lethal
    ? entries.filter((entry) => entry.tacticalCue?.tone === "rescue").sort(byCostThenImpact)[0] || null
    : null;

  let counter = null;
  if (!lethal) {
    const mechanism = entries
      .filter((entry) => entry.projection && entry.tacticalCue && entry.tacticalCue.tone !== "danger")
      .sort(byCostThenImpact)[0];
    const guard = entries
      .filter((entry) => entry.tacticalCue?.tone === "guard")
      .sort(byCostThenImpact)[0];
    const cleanse = entries
      .filter((entry) => entry.kind === "cleanse" && entry.tacticalCue && entry.tacticalCue.tone !== "danger")
      .sort(byCostThenImpact)[0];
    const mitigate = entries
      .filter((entry) => (
        entry.kind === "mitigate"
        && entry.projectedLoss < currentLoss
        && entry.preview
        && combatImmediateProjectedLoss(entry.preview, incomingPreview, playerHp).survives
      ))
      .sort(byCostThenImpact)[0];
    const unaffected = settings.distracted === true
      ? entries.filter((entry) => (
        entry.kind === "unaffected"
        && (safeBattleValue(entry.preview?.healthDamage) > 0 || safeBattleValue(entry.preview?.enemyBlockAbsorbed) > 0)
      )).sort(byCostThenImpact)[0]
      : null;
    counter = mechanism || guard || cleanse || mitigate || unaffected || null;
  }

  return {
    finish: cleanCombatImmediatePlanEntry(finish),
    rescue: cleanCombatImmediatePlanEntry(rescue),
    counter: cleanCombatImmediatePlanEntry(counter)
  };
}

export function shouldShowCombatCardPreview(preview) {
  if (!preview) return false;
  const modified = Array.isArray(preview.modifiers) && preview.modifiers.length > 0;
  const armorChangedResult = preview.hasDamage === true
    && Number(preview.healthDamage) !== Number(preview.attackTotal);
  return modified || armorChangedResult;
}

function safeBattleValue(value) {
  try {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  } catch {
    return 0;
  }
}

export function combatEnergyState(combat = {}) {
  const current = Math.max(0, Math.floor(safeBattleValue(combat.energy)));
  const recordedMaximum = Math.max(0, Math.floor(safeBattleValue(combat.maxEnergy)));
  return { current, maximum: Math.max(current, recordedMaximum) };
}

export function combatNextEnergyState(combat = {}) {
  const bonus = Math.max(0, Math.floor(safeBattleValue(combat.nextEnergy)));
  const penalty = Math.max(0, Math.floor(safeBattleValue(combat.nextEnergyPenalty)));
  const net = bonus - penalty;
  const queued = bonus > 0 || penalty > 0;
  const label = net > 0
    ? `下回合 +${net}`
    : net < 0
      ? `下回合 ${net}`
      : queued ? "下回合 ±0" : "";
  const detailParts = [];
  if (bonus) detailParts.push(`获得 ${bonus} 点`);
  if (penalty) detailParts.push(`扣除 ${penalty} 点`);
  return {
    bonus,
    penalty,
    net,
    label,
    detail: queued ? `下回合能量${detailParts.join("、")}，净变化 ${net >= 0 ? "+" : ""}${net} 点` : "",
    tone: !queued ? "none" : net > 0 ? "bonus" : net < 0 ? "debt" : "balanced"
  };
}

function battleMotionType(kind, options, outcome) {
  if (kind === "pet") return "pet";
  if (kind === "enemy") {
    return outcome.playerDamage > 0 || outcome.playerBlockAbsorbed > 0 ? "enemy-attack" : "enemy-skill";
  }
  if (kind === "status") return "status";
  if (options.cleanseApplied === true) return "cleanse";
  if (outcome.enemyDamage > 0 || outcome.enemyBlockLoss > 0) return "attack";
  if (outcome.playerBlockGain > 0) return "guard";
  if (options.cardType === "status") return "status";
  if (options.cardType === "attack") return "attack";
  return "skill";
}

function normalizedCausalEffects(effects) {
  if (!Array.isArray(effects)) return [];
  return effects.map((effect) => {
    if (effect?.type === "debuff" && effect.applied === true) {
      return { type: "debuff", id: String(effect.id || "status"), target: "player", count: 1 };
    }
    if (effect?.type === "status" && ["hand", "drawPile", "discardPile"].includes(effect.target)) {
      return {
        type: "status",
        id: String(effect.id || "status"),
        target: effect.target,
        count: Math.max(1, Math.floor(safeBattleValue(effect.count)))
      };
    }
    return null;
  }).filter(Boolean);
}

export function enemyStatusCausalPlacements(beforeCardUids, combat, statusAdded) {
  let id;
  let count;
  try {
    id = typeof statusAdded?.id === "string" ? statusAdded.id.trim() : "";
    const numericCount = Number(statusAdded?.count);
    count = Number.isFinite(numericCount) && numericCount > 0
      ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(numericCount))
      : 0;
  } catch {
    return [];
  }
  if (!id || !count || !["draw", "discard"].includes(statusAdded?.zone)) return [];

  const fallbackTarget = statusAdded.zone === "draw" ? "drawPile" : "discardPile";
  const fallback = () => [{ type: "status", id, target: fallbackTarget, count }];
  let beforeValues = null;
  if (Array.isArray(beforeCardUids)) {
    beforeValues = beforeCardUids;
  } else if (beforeCardUids instanceof Set) {
    beforeValues = [...beforeCardUids];
  } else if (beforeCardUids && typeof beforeCardUids === "object") {
    const snapshotZones = ["hand", "drawPile", "discardPile", "exhaustPile"];
    const hasSnapshotZone = snapshotZones.some((target) => Array.isArray(beforeCardUids[target]));
    if (hasSnapshotZone) {
      beforeValues = snapshotZones.flatMap((target) => (
        Array.isArray(beforeCardUids[target]) ? beforeCardUids[target] : []
      ));
    }
  }
  if (!beforeValues || !combat || typeof combat !== "object") return fallback();

  const before = new Set();
  for (const uid of beforeValues) {
    if (!["string", "number"].includes(typeof uid)) continue;
    before.add(String(uid));
  }

  const placements = [];
  const seen = new Set();
  let remaining = count;
  for (const target of ["hand", "drawPile", "discardPile"]) {
    const zone = combat[target];
    if (!Array.isArray(zone) || remaining <= 0) continue;
    let placed = 0;
    for (const card of zone) {
      if (!card || typeof card !== "object" || String(card.id || "") !== id) continue;
      if (!["string", "number"].includes(typeof card.uid)) continue;
      const uid = String(card.uid);
      if (!uid || before.has(uid) || seen.has(uid)) continue;
      seen.add(uid);
      placed += 1;
      remaining -= 1;
      if (remaining <= 0) break;
    }
    if (placed > 0) placements.push({ type: "status", id, target, count: placed });
  }

  return placements.length ? placements : fallback();
}

export function battleFeedbackFromDelta(before = {}, after = {}, options = {}) {
  const kind = ["card", "pet", "enemy", "status"].includes(options.kind) ? options.kind : "card";
  const enemyDamage = Math.max(0, safeBattleValue(before.enemyHp) - safeBattleValue(after.enemyHp));
  const enemyBlockLoss = kind === "enemy"
    ? 0
    : Math.max(0, safeBattleValue(before.enemyBlock) - safeBattleValue(after.enemyBlock));
  const observedPlayerHpLoss = Math.max(0, safeBattleValue(before.playerHp) - safeBattleValue(after.playerHp));
  const hasEndTurnHpLoss = Object.prototype.hasOwnProperty.call(options, "endTurnHpLoss");
  const hasEnemyAttackHpLoss = Object.prototype.hasOwnProperty.call(options, "enemyAttackHpLoss");
  const endTurnHpLoss = hasEndTurnHpLoss ? Math.max(0, safeBattleValue(options.endTurnHpLoss)) : 0;
  const playerDamage = hasEnemyAttackHpLoss
    ? Math.max(0, safeBattleValue(options.enemyAttackHpLoss))
    : hasEndTurnHpLoss
    ? Math.max(0, observedPlayerHpLoss - endTurnHpLoss)
    : observedPlayerHpLoss;
  const totalPlayerHpLoss = endTurnHpLoss + playerDamage;
  const playerBlockGain = Math.max(0, safeBattleValue(after.playerBlock) - safeBattleValue(before.playerBlock));
  const playerBlockAbsorbed = kind === "enemy" ? Math.max(0, safeBattleValue(options.playerBlockAbsorbed)) : 0;
  const enemyBlockGain = kind === "enemy" ? Math.max(0, safeBattleValue(options.enemyBlockGain)) : 0;
  const reshuffleMoves = Array.isArray(options.drawResult?.reshuffles)
    ? options.drawResult.reshuffles
      .map((entry) => Math.max(0, Math.floor(safeBattleValue(entry?.moved))))
      .filter((moved) => moved > 0)
    : [];
  const pileReshuffles = reshuffleMoves.length;
  const reshuffledCards = reshuffleMoves.reduce((total, moved) => total + moved, 0);
  const cardsDrawn = kind === "enemy"
    ? 0
    : Math.max(
      0,
      safeBattleValue(after.handSize) - safeBattleValue(before.handSize) + (options.cardPlayed ? 1 : 0)
    );
  const petChargeGain = Math.max(0, safeBattleValue(after.petCharge) - safeBattleValue(before.petCharge));
  const causalEffects = kind === "enemy" ? normalizedCausalEffects(options.causalEffects) : [];
  const effectParts = Array.isArray(options.effectParts)
    ? options.effectParts.map((part) => String(part).trim()).filter(Boolean)
    : [];
  const summaryParts = [];

  if (enemyDamage) summaryParts.push(`敌方生命 -${enemyDamage}`);
  if (enemyBlockLoss) summaryParts.push(`击破护甲 ${enemyBlockLoss}`);
  if (endTurnHpLoss) summaryParts.push(`情绪内耗 -${endTurnHpLoss}`);
  if (playerDamage) summaryParts.push(`生命 -${playerDamage}`);
  if (playerBlockAbsorbed) summaryParts.push(`护甲挡下 ${playerBlockAbsorbed}`);
  if (playerBlockGain) summaryParts.push(`护甲 +${playerBlockGain}`);
  if (enemyBlockGain) summaryParts.push(`敌方护甲 +${enemyBlockGain}`);
  if (pileReshuffles) summaryParts.push(`弃牌洗回抽牌堆 ${reshuffledCards} 张`);
  if (cardsDrawn) summaryParts.push(`抽牌 +${cardsDrawn}`);
  if (petChargeGain) summaryParts.push(`宠物充能 +${petChargeGain}`);
  summaryParts.push(...effectParts);
  if (!summaryParts.length) summaryParts.push("效果已生效");

  const tone = totalPlayerHpLoss > 0
    ? "danger"
    : enemyDamage > 0 || enemyBlockLoss > 0
    ? kind === "pet" ? "pet" : "attack"
    : playerBlockGain > 0 || playerBlockAbsorbed > 0
    ? "guard"
    : kind === "pet"
    ? "pet"
    : "skill";
  const motionType = battleMotionType(kind, options, {
    enemyDamage,
    enemyBlockLoss,
    playerDamage,
    endTurnHpLoss,
    totalPlayerHpLoss,
    observedPlayerHpLoss,
    playerBlockGain,
    playerBlockAbsorbed
  });

  return {
    id: Math.max(0, Math.floor(safeBattleValue(options.id))),
    kind,
    tone,
    label: String(options.label || "行动结算"),
    enemyDamage,
    enemyBlockLoss,
    playerDamage,
    endTurnHpLoss,
    totalPlayerHpLoss,
    observedPlayerHpLoss,
    playerBlockGain,
    playerBlockAbsorbed,
    enemyBlockGain,
    cardsDrawn,
    petChargeGain,
    ...(pileReshuffles ? { pileReshuffles, reshuffledCards } : {}),
    hidePlayerDamageNumber: options.hidePlayerDamageNumber === true,
    motionType,
    causalEffects,
    summaryParts
  };
}

export function handCardPose(index, count) {
  const safeCount = Math.max(1, Math.floor(Number(count) || 1));
  const safeIndex = Math.min(safeCount - 1, Math.max(0, Math.floor(Number(index) || 0)));
  const center = (safeCount - 1) / 2;
  const offset = safeIndex - center;
  const radius = Math.max(1, center);
  const angleStep = Math.min(1.4, 6 / radius);

  return {
    angle: Number((offset * angleStep).toFixed(2)),
    drop: Math.round(Math.pow(Math.abs(offset) / radius, 1.55) * 14),
    layer: safeIndex + 1
  };
}

export function combatShortcutCommand(code, state = {}) {
  if (code === "Escape") {
    if (state.lethalConfirmOpen) return { action: COMBAT_SHORTCUT_ACTION.cancelLethalEndTurn };
    if (state.pileOpen) return { action: COMBAT_SHORTCUT_ACTION.closePile };
    if (state.intentDetailsOpen) return { action: COMBAT_SHORTCUT_ACTION.closeIntentDetails };
    return null;
  }
  if (state.resolvingEnemy || state.lethalConfirmOpen || state.pileOpen || state.tutorialOpen) return null;
  if (code === "KeyR") return { action: COMBAT_SHORTCUT_ACTION.toggleIntentDetails };

  const numberMatch = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  if (numberMatch) {
    const cardIndex = Number(numberMatch[1]) - 1;
    if (cardIndex >= Number(state.cardCount || 0)) return null;
    return {
      action: state.pendingDiscard ? COMBAT_SHORTCUT_ACTION.discardCard : COMBAT_SHORTCUT_ACTION.playCard,
      cardIndex
    };
  }
  if (state.pendingDiscard) return null;
  if (code === "KeyG") return { action: COMBAT_SHORTCUT_ACTION.petSkill };
  if (code === "KeyE") return { action: COMBAT_SHORTCUT_ACTION.endTurn };
  return null;
}
