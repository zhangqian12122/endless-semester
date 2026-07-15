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
  playCard: "play-card"
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
    label: "1/3 · 蓄响",
    detail: "当前：蓄响（护甲 5）；下一步：铃声（攻击 7）"
  }),
  Object.freeze({
    label: "2/3 · 下次 14",
    detail: "当前：铃声（攻击 7）；下一步：夺命连环响（攻击 14）"
  }),
  Object.freeze({
    label: "3/3 · 爆发 14",
    detail: "当前：夺命连环响（攻击 14）；下一步：蓄响（护甲 5）"
  })
]);
const SPECIAL_ENEMY_METER_STEPS = Object.freeze(["发卷", "选择题", "填空题", "大题"]);
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

export function enemyMechanicProgress(enemyId, intentTurn = 0) {
  const turn = normalizedIntentTurn(intentTurn);

  if (enemyId === "alarmClock") {
    const stepIndex = turn % ALARM_CLOCK_METER_STEPS.length;
    const step = ALARM_CLOCK_METER_STEPS[stepIndex];
    return {
      kind: "countdown",
      title: "公开倒计时",
      label: step.label,
      detail: step.detail,
      segments: ALARM_CLOCK_METER_STEPS.map((_, index) => (
        index < stepIndex ? "done" : index === stepIndex ? "current" : "upcoming"
      ))
    };
  }

  if (enemyId === "rivalShadow") {
    const action = turn + 1;
    const baseDamage = 6 + turn * 2;
    return {
      kind: "escalation",
      title: "无休加速",
      label: `第${action}次 · 基础伤害 ${baseDamage}`,
      detail: "每次行动都攻击，基础伤害每次 +2，没有休息回合。",
      segments: Array.from({ length: 4 }, (_, index) => {
        if (action >= 4 && index === 3) return "continuing";
        if (index + 1 < action) return "done";
        if (index + 1 === action) return "current";
        return "upcoming";
      })
    };
  }

  if (enemyId === "finalExam") {
    const stepIndex = turn % SPECIAL_ENEMY_METER_STEPS.length;
    const round = Math.floor(turn / SPECIAL_ENEMY_METER_STEPS.length) + 1;
    const currentStep = SPECIAL_ENEMY_METER_STEPS[stepIndex];
    const nextStepIndex = (stepIndex + 1) % SPECIAL_ENEMY_METER_STEPS.length;
    const nextRound = stepIndex === SPECIAL_ENEMY_METER_STEPS.length - 1 ? round + 1 : round;
    const nextStep = SPECIAL_ENEMY_METER_STEPS[nextStepIndex];
    return {
      kind: "cycle",
      title: "四步递增",
      label: `第${round}轮 · ${stepIndex + 1}/4`,
      detail: `当前：${currentStep}；下一步：${nextStep}${nextRound === round ? "" : `（第${nextRound}轮）`}`,
      segments: SPECIAL_ENEMY_METER_STEPS.map((_, index) => (
        index < stepIndex ? "done" : index === stepIndex ? "current" : "upcoming"
      ))
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
  return {
    turn: Math.max(1, Math.floor(Number(resolution.turn) || 1)),
    name: String(resolution.name || "敌方行动"),
    detail: String(resolution.detail || "行动已执行"),
    result: mechanicalParts.join(" · ") || (effects.length ? "非伤害效果已结算" : "效果已生效"),
    tone: Number(feedback.playerDamage) > 0 ? "danger" : "safe",
    hitBreakdown: enemyHitBreakdown(resolution.incoming),
    effects
  };
}

export const CARD_LIBRARY_FILTERS = Object.freeze([
  "all",
  "public",
  "aries",
  "gemini",
  "cancer",
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
      if (normalized === "public") return !card.archetype && card.type !== "status";
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

export function combatCardTacticalCue(cardPreview = {}, incomingPreview = {}, options = {}) {
  if (options.playable === false) return null;
  const enemyHp = Math.max(0, safeBattleValue(options.enemyHp));
  const playerHp = Math.max(0, safeBattleValue(options.playerHp));
  const healthDamage = Math.max(0, safeBattleValue(cardPreview.healthDamage));

  if (enemyHp > 0 && healthDamage >= enemyHp) {
    return {
      tone: "finish",
      label: "可结束战斗",
      detail: `预计造成 ${healthDamage} 点生命伤害`
    };
  }

  const block = Math.max(0, safeBattleValue(cardPreview.block));
  if (!block || playerHp <= 0) return null;
  const currentTotalLoss = Math.max(0, safeBattleValue(incomingPreview.totalHpLoss));
  if (!currentTotalLoss) return null;

  const hpAfterCard = Math.max(0, playerHp - Math.max(0, safeBattleValue(cardPreview.selfDamage)));
  const unavoidableLoss = Math.max(0, safeBattleValue(incomingPreview.endTurnHpLoss));
  const attackTotal = Math.max(0, safeBattleValue(incomingPreview.attackTotal));
  const currentBlock = Math.max(0, safeBattleValue(incomingPreview.currentBlock));
  const attackLossAfterCard = unavoidableLoss >= hpAfterCard
    ? 0
    : Math.max(0, attackTotal - currentBlock - block);
  const totalLossAfterCard = unavoidableLoss + attackLossAfterCard;
  const lethalBefore = Boolean(incomingPreview.lethal || currentTotalLoss >= playerHp);
  const lethalAfter = hpAfterCard <= 0 || totalLossAfterCard >= hpAfterCard;

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
  return null;
}

export function shouldShowCombatCardPreview(preview) {
  if (!preview) return false;
  const modified = Array.isArray(preview.modifiers) && preview.modifiers.length > 0;
  const armorChangedResult = preview.hasDamage === true
    && Number(preview.healthDamage) !== Number(preview.attackTotal);
  return modified || armorChangedResult;
}

function safeBattleValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function combatEnergyState(combat = {}) {
  const current = Math.max(0, Math.floor(safeBattleValue(combat.energy)));
  const recordedMaximum = Math.max(0, Math.floor(safeBattleValue(combat.maxEnergy)));
  return { current, maximum: Math.max(current, recordedMaximum) };
}

function battleMotionType(kind, options, outcome) {
  if (kind === "pet") return "pet";
  if (kind === "enemy") {
    return outcome.playerDamage > 0 || outcome.playerBlockAbsorbed > 0 ? "enemy-attack" : "enemy-skill";
  }
  if (options.cleanseApplied === true) return "cleanse";
  if (options.cardType === "status") return "status";
  if (options.cardType === "attack") return "attack";
  if (outcome.playerBlockGain > 0 && outcome.enemyDamage === 0 && outcome.enemyBlockLoss === 0) return "guard";
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
  const kind = ["card", "pet", "enemy"].includes(options.kind) ? options.kind : "card";
  const enemyDamage = Math.max(0, safeBattleValue(before.enemyHp) - safeBattleValue(after.enemyHp));
  const enemyBlockLoss = kind === "enemy"
    ? 0
    : Math.max(0, safeBattleValue(before.enemyBlock) - safeBattleValue(after.enemyBlock));
  const playerDamage = Math.max(0, safeBattleValue(before.playerHp) - safeBattleValue(after.playerHp));
  const playerBlockGain = Math.max(0, safeBattleValue(after.playerBlock) - safeBattleValue(before.playerBlock));
  const playerBlockAbsorbed = kind === "enemy" ? Math.max(0, safeBattleValue(options.playerBlockAbsorbed)) : 0;
  const enemyBlockGain = kind === "enemy" ? Math.max(0, safeBattleValue(options.enemyBlockGain)) : 0;
  const cardsDrawn = kind === "enemy"
    ? 0
    : Math.max(
      0,
      safeBattleValue(after.handSize) - safeBattleValue(before.handSize) + (options.cardPlayed ? 1 : 0)
    );
  const petChargeGain = Math.max(0, safeBattleValue(after.petCharge) - safeBattleValue(before.petCharge));
  const causalEffects = kind === "enemy" ? normalizedCausalEffects(options.causalEffects) : [];
  const effectParts = kind === "enemy" && Array.isArray(options.effectParts)
    ? options.effectParts.map((part) => String(part).trim()).filter(Boolean)
    : [];
  const summaryParts = [];

  if (enemyDamage) summaryParts.push(`敌方生命 -${enemyDamage}`);
  if (enemyBlockLoss) summaryParts.push(`击破护甲 ${enemyBlockLoss}`);
  if (playerDamage) summaryParts.push(`生命 -${playerDamage}`);
  if (playerBlockAbsorbed) summaryParts.push(`护甲挡下 ${playerBlockAbsorbed}`);
  if (playerBlockGain) summaryParts.push(`护甲 +${playerBlockGain}`);
  if (enemyBlockGain) summaryParts.push(`敌方护甲 +${enemyBlockGain}`);
  if (cardsDrawn) summaryParts.push(`抽牌 +${cardsDrawn}`);
  if (petChargeGain) summaryParts.push(`宠物充能 +${petChargeGain}`);
  summaryParts.push(...effectParts);
  if (!summaryParts.length) summaryParts.push("效果已生效");

  const tone = playerDamage > 0
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
    playerBlockGain,
    playerBlockAbsorbed,
    enemyBlockGain,
    cardsDrawn,
    petChargeGain,
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
