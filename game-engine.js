import {
  ARCHETYPE_DEFS,
  CARD_DEFS,
  ENCHANTMENT_DEFS,
  ENEMY_DEFS,
  EVENT_DEFS,
  FIRST_SEMESTER_NORMAL_ENEMY_POOLS,
  ITEM_DEFS,
  CHALLENGE_SIGNATURE_ITEM_DROPS,
  NORMAL_ENEMY_IDS,
  DEFAULT_PET_ID,
  PET_DEFS,
  PET_EGG_DEFS,
  PET_TALENT_DEFS,
  REGULAR_ITEM_IDS,
  PUBLIC_REWARD_CARD_IDS,
  ARCHETYPE_CARD_IDS
} from "./game-data.js";

const LEGACY_PET_ID_ALIASES = Object.freeze({ goose: DEFAULT_PET_ID });

function canonicalPetId(id) {
  const normalizedId = LEGACY_PET_ID_ALIASES[id] || id;
  return PET_DEFS[normalizedId] ? normalizedId : null;
}

function petDefinition(id = DEFAULT_PET_ID) {
  return PET_DEFS[canonicalPetId(id)] || PET_DEFS[DEFAULT_PET_ID];
}

function createPetState(id = DEFAULT_PET_ID) {
  const definition = petDefinition(id);
  return {
    id: definition.id,
    name: definition.name,
    bond: 0,
    charge: 0,
    maxCharge: definition.maxCharge,
    talent: null,
    talentLevel: 0,
    pendingMilestone: null
  };
}

function eggDefinitionForEnemy(enemyId) {
  return Object.values(PET_EGG_DEFS).find((egg) => egg.sourceEnemyIds.includes(enemyId)) || null;
}

function sanitizePetState(raw, id) {
  const definition = petDefinition(id);
  const saved = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const bond = nonNegativeInteger(saved.bond);
  const charge = Math.min(definition.maxCharge, nonNegativeInteger(saved.charge));
  const talent = definition.talentIds.includes(saved.talent) && PET_TALENT_DEFS[saved.talent]
    ? saved.talent
    : null;
  const talentLevel = talent ? Math.min(3, Math.max(1, nonNegativeInteger(saved.talentLevel, 1))) : 0;
  let pendingMilestone = [null, "choose", "upgrade", "master"].includes(saved.pendingMilestone)
    ? saved.pendingMilestone
    : null;
  if (!talent && pendingMilestone !== "choose") pendingMilestone = null;
  if (talent && pendingMilestone === "choose") pendingMilestone = null;
  return {
    id: definition.id,
    name: definition.name,
    bond,
    charge,
    maxCharge: definition.maxCharge,
    talent,
    talentLevel,
    pendingMilestone
  };
}

const DEFAULT_PET = petDefinition();

const STARTING_DECK_CORE = [
  "textbookStrike", "textbookStrike", "textbookStrike", "textbookStrike",
  "backpackGuard", "backpackGuard", "backpackGuard", "backpackGuard",
  "cramming"
];

const FIXED_ROUTE_WEEKS = new Set([1, 2, 8, 16]);
const COMBAT_CHOICE_WEEKS = new Set([4, 6, 11, 14, 15]);

const EVENT_CARD_REWARD_SOURCES = Object.freeze({
  "quiz-card": "uncommon",
  "club-attack": "attack",
  "club-skill": "skill"
});
const EVENT_DECK_REWARD_SOURCES = Object.freeze({
  "quiz-upgrade": "upgrade",
  "locker-remove": "remove"
});
const EVENT_ITEM_REWARD_SOURCES = new Set(["box-open", "locker-open"]);

export const CHALLENGE_RULES = Object.freeze({
  hpMultiplier: 1.35,
  damageMultiplier: 1.25
});

export const ITEM_REWARD_FALLBACK_GOLD = Object.freeze({ elite: 50, event: 70, boss: 100 });

export const NORMAL_COMBAT_REWARD_GOLD = 15;
export const HIGH_THREAT_ROUTE_BONUS_GOLD = 10;

export const CHALLENGE_REWARD_DEFS = Object.freeze({
  cards: {
    id: "cards",
    icon: "牌",
    name: "命盘补课",
    gold: 20,
    text: "获得 20 校园币，从 3 张本星座专属牌中选 1 张。"
  },
  pet: {
    id: "pet",
    icon: DEFAULT_PET.icon,
    name: "伙伴特训",
    gold: 25,
    bond: 2,
    masteryFallbackGold: 45,
    text: "获得 25 校园币；符合条件时获得对应怪物蛋，否则当前宠物羁绊 +2；宠物已精通时改为共 45 校园币。"
  },
  item: {
    id: "item",
    icon: "物",
    name: "失物招领",
    gold: 10,
    itemChoices: 2,
    fallbackGold: 45,
    text: "获得 10 校园币，从 2 件未拥有的随身物品中选 1 件。"
  }
});

export const ARCHETYPE_TRIAL_DEFS = Object.freeze({
  aries: {
    id: "bellRush",
    icon: "速",
    name: "赶在铃响前",
    text: "在第 3 回合内获胜。",
    bonusGold: 10
  },
  gemini: {
    id: "fourTasks",
    icon: "连",
    name: "一心四用",
    text: "任意一回合打出 4 张牌。",
    bonusGold: 10
  },
  cancer: {
    id: "steadyCatch",
    icon: "稳",
    name: "稳稳接住",
    text: "胜利时本场生命损失不超过 5。",
    bonusGold: 10
  }
});

export const TAROT_DEFS = Object.freeze({
  chariot: {
    id: "chariot",
    number: "VII",
    icon: "车",
    name: "战车",
    tagline: "抢在点名前",
    boon: "每场战斗第 1 回合 +1 能量。",
    cost: "敌人生命 +15%。",
    firstTurnEnergy: 1,
    enemyHpMultiplier: 1.15,
    rest: {
      action: "remove",
      name: "强行超车",
      text: "失去 6 生命，移除 1 张牌。",
      hpCost: 6
    }
  },
  strength: {
    id: "strength",
    number: "XI",
    icon: "力",
    name: "力量",
    tagline: "让伙伴先上",
    boon: "宠物开战时获得 1 点充能。",
    cost: "敌人每段攻击伤害 +2。",
    petCharge: 1,
    enemyAttackBonus: 2,
    rest: {
      action: "bond",
      name: "伙伴夜训",
      text: "支付 30 币，羁绊 +4 并恢复 6 生命。",
      goldCost: 30,
      bond: 4,
      heal: 6
    }
  },
  hermit: {
    id: "hermit",
    number: "IX",
    icon: "灯",
    name: "隐者",
    tagline: "先把题看完",
    boon: "每场战斗第 1 回合多抽 2 张牌。",
    cost: "敌人开战时获得 8 点护甲。",
    firstTurnDraw: 2,
    enemyBlock: 8,
    rest: {
      action: "upgrade",
      name: "闭门精读",
      text: "支付 35 币，升级 1 张牌并恢复 8 生命。",
      goldCost: 35,
      heal: 8
    }
  }
});

const TAROT_IDS = Object.keys(TAROT_DEFS);

function nonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function samePrimitiveRecord(left = {}, right = {}) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => Object.hasOwn(right, key) && left[key] === right[key]);
}

function mergeDrawResults(results = []) {
  return results.reduce((merged, result) => ({
    requested: merged.requested + nonNegativeInteger(result?.requested),
    drawn: merged.drawn + nonNegativeInteger(result?.drawn),
    reshuffles: [
      ...merged.reshuffles,
      ...(Array.isArray(result?.reshuffles)
        ? result.reshuffles
          .map((entry) => ({ moved: nonNegativeInteger(entry?.moved) }))
          .filter((entry) => entry.moved > 0)
        : [])
    ]
  }), { requested: 0, drawn: 0, reshuffles: [] });
}

function withVisibleDrawResult(result, drawResult) {
  return drawResult?.reshuffles?.length ? { ...result, drawResult } : result;
}

export const CHALLENGE_AFFIX_DEFS = Object.freeze({
  deadline: {
    id: "deadline",
    name: "限时下课",
    icon: "时",
    text: "第 4 回合起，敌人每次攻击额外 +4。"
  },
  backlog: {
    id: "backlog",
    name: "桌面爆满",
    icon: "叠",
    text: "开战时将 2 张待办洗入抽牌堆。"
  },
  earlyClass: {
    id: "earlyClass",
    name: "第一节早课",
    icon: "早",
    text: "第 1 回合少 1 点能量。"
  }
});

const CHALLENGE_AFFIX_IDS = Object.keys(CHALLENGE_AFFIX_DEFS);

export function normalRouteEnemyPool(semester, week) {
  if (Number(semester) !== 1) return NORMAL_ENEMY_IDS;
  const currentWeek = Math.min(16, Math.max(1, Math.floor(Number(week) || 1)));
  return FIRST_SEMESTER_NORMAL_ENEMY_POOLS.find((stage) => (
    currentWeek >= stage.startWeek && currentWeek <= stage.endWeek
  ))?.enemyIds || NORMAL_ENEMY_IDS;
}

function makeRouteNode(type, week, options = {}) {
  if (type === "combat") {
    const enemy = options.enemy;
    const challenge = options.challenge === true;
    const affix = challenge && CHALLENGE_AFFIX_DEFS[options.affix] ? options.affix : null;
    const fixedLabels = {
      1: "教学战：瞌睡虫",
      2: "宠物教学：作业团",
      8: "期中精英：卷王幻影",
      16: "期末Boss：期末考试"
    };
    return {
      type,
      enemy,
      label: fixedLabels[week] || `${challenge ? "挑战战" : "普通战斗"}：${ENEMY_DEFS[enemy].name}`,
      ...(challenge ? { challenge: true, ...(affix ? { affix } : {}) } : {})
    };
  }
  if (type === "event") {
    const pool = options.pool === "safe" ? "safe" : "all";
    return { type, pool, label: pool === "safe" ? "？ 低风险校园事件" : "？ 未知事件" };
  }
  if (type === "rest") return { type, label: "休息节点" };
  return { type: "shop", label: "校园商店" };
}

function applyCoreCombatRouteRewards(plan) {
  for (const week of COMBAT_CHOICE_WEEKS) {
    const nodes = plan[week];
    if (!Array.isArray(nodes) || nodes.length !== 2
      || nodes.some((node) => node.type !== "combat" || node.challenge || ENEMY_DEFS[node.enemy]?.kind !== "normal")) continue;
    for (const node of nodes) {
      const routeThreat = ENEMY_DEFS[node.enemy]?.routeThreat;
      node.routeThreat = Number.isInteger(routeThreat) && routeThreat > 0 ? routeThreat : 0;
      node.bonusGold = 0;
    }
    const [left, right] = nodes;
    if (left.routeThreat === right.routeThreat) continue;
    const riskier = left.routeThreat > right.routeThreat ? left : right;
    riskier.bonusGold = HIGH_THREAT_ROUTE_BONUS_GOLD;
  }
  return plan;
}

function ensureChallengeNodes(plan) {
  const phases = [
    { weeks: [3, 4, 5, 6, 7], priority: [5, 7, 4, 6, 3] },
    { weeks: [9, 10, 11, 12, 13, 14, 15], priority: [10, 12, 13, 11, 14, 15, 9] }
  ];
  const usedAffixes = new Set();
  for (const phase of phases) {
    const existing = phase.weeks.flatMap((week) => plan[week].map((node, index) => ({ week, index, node })))
      .filter((entry) => entry.node.challenge);
    if (existing.length > 1) return null;
    let entry = existing[0];
    if (!entry) {
      const week = phase.priority.find((candidate) => (
        plan[candidate].some((node) => node.type === "combat")
        && plan[candidate].some((node) => node.type !== "combat")
      ));
      if (!week) return null;
      const index = plan[week].findIndex((node) => node.type === "combat");
      entry = { week, index, node: plan[week][index] };
    }
    const savedAffix = CHALLENGE_AFFIX_DEFS[entry.node.affix] && !usedAffixes.has(entry.node.affix)
      ? entry.node.affix
      : null;
    const affix = savedAffix || CHALLENGE_AFFIX_IDS.find((id) => !usedAffixes.has(id));
    if (!affix) return null;
    plan[entry.week][entry.index] = makeRouteNode("combat", entry.week, {
      enemy: entry.node.enemy,
      challenge: true,
      affix
    });
    usedAffixes.add(affix);
  }
  return plan;
}

function normalizeSemesterPlan(data) {
  if (!Array.isArray(data) || data.length !== 17) return null;
  const plan = Array.from({ length: 17 }, () => []);
  let restOptions = 0;
  let shopOptions = 0;
  for (let week = 1; week <= 16; week += 1) {
    const rawNodes = data[week];
    const expectedCount = FIXED_ROUTE_WEEKS.has(week) ? 1 : 2;
    if (!Array.isArray(rawNodes) || rawNodes.length !== expectedCount) return null;
    const types = new Set();
    for (const raw of rawNodes) {
      const repeatsAllowedCombat = raw?.type === "combat" && COMBAT_CHOICE_WEEKS.has(week);
      if (!raw || !["combat", "event", "rest", "shop"].includes(raw.type)
        || (types.has(raw.type) && !repeatsAllowedCombat)) return null;
      types.add(raw.type);
      if (raw.type === "combat") {
        if (!ENEMY_DEFS[raw.enemy]) return null;
        if (!FIXED_ROUTE_WEEKS.has(week) && ENEMY_DEFS[raw.enemy].kind !== "normal") return null;
        if (raw.challenge === true && FIXED_ROUTE_WEEKS.has(week)) return null;
        if (COMBAT_CHOICE_WEEKS.has(week) && raw.challenge === true) return null;
        if (plan[week].some((node) => node.type === "combat" && node.enemy === raw.enemy)) return null;
        plan[week].push(makeRouteNode("combat", week, {
          enemy: raw.enemy,
          challenge: raw.challenge === true,
          affix: raw.affix
        }));
      } else if (raw.type === "event") {
        plan[week].push(makeRouteNode("event", week, { pool: raw.pool }));
      } else {
        plan[week].push(makeRouteNode(raw.type, week));
        if (raw.type === "rest") restOptions += 1;
        if (raw.type === "shop") shopOptions += 1;
      }
    }
  }
  if (plan[1][0]?.enemy !== "sleepyBug" || plan[2][0]?.enemy !== "homeworkBlob"
    || plan[8][0]?.enemy !== "rivalShadow" || plan[16][0]?.enemy !== "finalExam") return null;
  if (restOptions < 2 || shopOptions < 2) return null;
  const normalized = ensureChallengeNodes(plan);
  return normalized ? applyCoreCombatRouteRewards(normalized) : null;
}

function startingDeckFor(archetypeId) {
  const archetype = ARCHETYPE_DEFS[archetypeId] || ARCHETYPE_DEFS.cancer;
  return [...STARTING_DECK_CORE, archetype.specialCard];
}

const STARTING_DECK = startingDeckFor("cancer");

export class SeededRandom {
  constructor(seed = Date.now()) {
    this.state = Number(seed) >>> 0 || 0x6d2b79f5;
  }

  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  int(max) {
    return Math.floor(this.next() * max);
  }

  pick(list) {
    return list[this.int(list.length)];
  }

  shuffle(list) {
    const result = [...list];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const other = this.int(index + 1);
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  }
}

export function makeCard(id, uid, upgraded = false, enchantment = null) {
  if (!CARD_DEFS[id]) throw new Error(`未知卡牌：${id}`);
  return { id, uid, upgraded, enchantment };
}

export function cardDefinition(card) {
  const definition = CARD_DEFS[card.id];
  const enchantment = card.enchantment ? ENCHANTMENT_DEFS[card.enchantment] : null;
  const effect = { ...(card.upgraded ? definition.upgradedEffect : definition.effect) };
  let cost = definition.cost;
  if (enchantment?.id === "ariesFlame" && definition.type === "attack" && effect.damage) effect.damage += 2;
  if (enchantment?.id === "geminiQuick" && typeof cost === "number") cost = Math.max(0, cost - 1);
  if (enchantment?.id === "cancerGuard" && effect.block) effect.block += 3;
  const baseText = card.upgraded ? definition.upgradedText : definition.text;
  return {
    ...definition,
    cost,
    displayName: `${definition.name}${card.upgraded ? "+" : ""}`,
    displayText: `${baseText}${enchantment ? `【${enchantment.name}】${enchantment.text}` : ""}`,
    effect,
    enchantment
  };
}

export class SemesterGame {
  constructor(seed = Date.now(), archetypeId = "cancer", startingPetId = DEFAULT_PET_ID, unlockedPetIds = [DEFAULT_PET_ID]) {
    this.rng = new SeededRandom(seed);
    this.cardSerial = 0;
    this.resetCampaign(archetypeId, startingPetId, unlockedPetIds);
  }

  resetCampaign(archetypeId = "cancer", startingPetId = DEFAULT_PET_ID, unlockedPetIds = [DEFAULT_PET_ID]) {
    if (!ARCHETYPE_DEFS[archetypeId]) throw new Error(`未知星座学生：${archetypeId}`);
    this.archetypeId = archetypeId;
    this.tarotId = null;
    this.semester = 1;
    this.week = 1;
    this.awaitingNextSemester = false;
    this.pendingSemesterReward = null;
    this.pendingCombatReward = null;
    this.pendingCombatStart = null;
    this.pendingEventReward = null;
    this.pendingShop = null;
    this.pendingRest = null;
    this.pendingItemReplacement = null;
    this.lastEventId = null;
    this.pendingEventId = null;
    this.maxHp = 50;
    this.hp = 50;
    this.gold = 50;
    this.deck = startingDeckFor(archetypeId).map((id) => this.createCard(id));
    this.items = [];
    this.backpackCapacity = 6;
    const unlocked = [...new Set([
      DEFAULT_PET_ID,
      ...(Array.isArray(unlockedPetIds) ? unlockedPetIds : [])
    ].map((id) => canonicalPetId(id)).filter(Boolean))];
    this.pets = Object.fromEntries(unlocked.map((id) => [id, createPetState(id)]));
    const requestedPetId = canonicalPetId(startingPetId);
    this.activePetId = requestedPetId && this.pets[requestedPetId] ? requestedPetId : DEFAULT_PET_ID;
    this.pet = this.pets[this.activePetId];
    this.incubator = null;
    this.stats = {
      combatsStarted: 0,
      combatsCompleted: 0,
      combatsWon: 0,
      challengeWins: 0,
      trialsAttempted: 0,
      trialsCompleted: 0,
      tarotRestUses: 0,
      tarotChoices: { chariot: 0, strength: 0, hermit: 0 },
      challengeRewardChoices: { cards: 0, pet: 0, item: 0 },
      combatTurns: 0,
      combatHpLost: 0,
      cardsPlayed: 0,
      petUses: 0,
      rewardsSeen: 0,
      cardsTaken: 0,
      exclusiveTaken: 0,
      publicTaken: 0,
      rewardsSkipped: 0,
      itemsTaken: 0,
      enchantments: 0,
      cardPlays: {}
    };
    this.cardCombatUses = {};
    this.flags = {
      nextCombatTension: 0,
      nextEnemyBlock: 0,
      petSnackCombats: 0,
      nextShopHalf: false,
      eraserUsed: false,
      tarotRestUsed: false
    };
    this.completedNodes = new Set();
    this.rewardIndex = 0;
    this.tutorialSeen = false;
    this.loadRepairs = [];
    this.combat = null;
    this.semesterPlan = this.generateSemesterPlan();
  }

  get archetype() {
    return ARCHETYPE_DEFS[this.archetypeId];
  }

  get tarot() {
    return TAROT_DEFS[this.tarotId] || null;
  }

  getPetDefinition() {
    return petDefinition(this.pet?.id);
  }

  hasPet(id) {
    return Boolean(PET_DEFS[id] && this.pets?.[id]);
  }

  ownedPetIds() {
    return Object.keys(this.pets || {}).filter((id) => PET_DEFS[id]);
  }

  activePetIsMastered() {
    const definition = this.getPetDefinition();
    return Boolean(
      this.pet?.talent
      && definition.talentIds.includes(this.pet.talent)
      && Number(this.pet.talentLevel) >= 3
    );
  }

  challengePetRewardState(enemyId = this.combat?.enemy?.id) {
    const canonicalEnemyId = ENEMY_DEFS[enemyId] ? enemyId : null;
    const egg = canonicalEnemyId ? eggDefinitionForEnemy(canonicalEnemyId) : null;
    const canClaimEgg = Boolean(egg && !this.incubator && !this.hasPet(egg.petId));
    return {
      enemyId: canonicalEnemyId,
      eggId: egg?.id || null,
      rewardVariant: canClaimEgg ? "egg" : this.activePetIsMastered() ? "mastery" : "bond"
    };
  }

  challengeSignatureItemRewardState(enemyId = this.combat?.enemy?.id) {
    const canonicalEnemyId = ENEMY_DEFS[enemyId] ? enemyId : null;
    const signatureItemId = canonicalEnemyId
      ? CHALLENGE_SIGNATURE_ITEM_DROPS[canonicalEnemyId] || null
      : null;
    const canClaimSignature = Boolean(signatureItemId && !this.hasItem(signatureItemId));
    return {
      enemyId: canonicalEnemyId,
      signatureItemId: canClaimSignature ? signatureItemId : null,
      rewardVariant: canClaimSignature ? "signature" : "choice"
    };
  }

  claimEgg(eggId) {
    const egg = PET_EGG_DEFS[eggId];
    if (!egg || this.incubator || this.hasPet(egg.petId)) return null;
    this.incubator = { eggId: egg.id, battles: 0 };
    return { eggId: egg.id, petId: egg.petId, battles: 0, requiredCombats: egg.requiredCombats };
  }

  advanceIncubatorAfterVictory(combat = this.combat) {
    if (!combat || combat.status !== "won" || combat.petIncubationEvent || !this.incubator) return null;
    const egg = PET_EGG_DEFS[this.incubator.eggId];
    if (!egg || this.hasPet(egg.petId)) {
      this.incubator = null;
      return null;
    }
    const battles = Math.min(egg.requiredCombats, this.incubator.battles + 1);
    let event;
    if (battles >= egg.requiredCombats) {
      this.pets[egg.petId] = createPetState(egg.petId);
      this.incubator = null;
      event = {
        type: "hatched",
        eggId: egg.id,
        petId: egg.petId,
        battles,
        requiredCombats: egg.requiredCombats
      };
    } else {
      this.incubator = { eggId: egg.id, battles };
      event = {
        type: "progress",
        eggId: egg.id,
        petId: egg.petId,
        battles,
        requiredCombats: egg.requiredCombats
      };
    }
    combat.petIncubationEvent = event;
    return event;
  }

  chooseTarot(id) {
    if (this.tarotId || !TAROT_DEFS[id]) return false;
    this.tarotId = id;
    this.stats.tarotChoices[id] += 1;
    return true;
  }

  eventChoiceStatus(choice) {
    let reason = "";
    let actualHeal = null;
    const hasCommonItem = this.availableItemIds({ rarity: "common" }).length > 0;

    if (choice === "box-open" && !hasCommonItem) {
      reason = "普通物品已经收齐";
    } else if (choice === "quiz-upgrade") {
      if (!this.deck.some((card) => !card.upgraded)) reason = "没有可升级的牌";
      else if (this.hp <= 5) reason = "至少需要 6 点生命";
    } else if (choice === "club-pet" && this.gold < 30) {
      reason = "需要 30 校园币";
    } else if (choice === "meal-sale" && this.flags.nextShopHalf) {
      reason = "商店优惠已经生效";
    } else if (choice === "rumor-heal") {
      actualHeal = Math.min(4, Math.max(0, this.maxHp - this.hp));
      if (actualHeal === 0) reason = "生命已经全满";
    } else if (choice === "locker-open") {
      if (!hasCommonItem) reason = "普通物品已经收齐";
      else if (this.hp <= 6) reason = "至少需要 7 点生命";
    } else if (choice === "locker-remove") {
      if (this.deck.length <= 5) reason = "卡组已达到最小规模";
      else if (this.gold < 50) reason = "需要 50 校园币";
    }

    return { choice, available: !reason, reason, actualHeal };
  }

  eventChoicePreview(choice) {
    const status = this.eventChoiceStatus(choice);
    const before = {
      hp: this.hp,
      gold: this.gold,
      bond: this.pet.bond,
      deckSize: this.deck.length,
      upgradedCards: this.deck.filter((card) => card.upgraded).length
    };
    const after = { ...before };
    if (choice === "quiz-upgrade") {
      after.hp -= 5;
      after.upgradedCards += 1;
    } else if (choice === "club-pet") {
      after.gold -= 30;
      after.bond += 2;
    } else if (choice === "locker-open") {
      after.hp -= 6;
    } else if (choice === "locker-remove") {
      after.gold -= 50;
      after.deckSize -= 1;
    }
    return { ...status, before, after };
  }

  copyPendingRest(started = false) {
    if (!this.pendingRest) return null;
    return {
      ...this.pendingRest,
      cardUids: [...(this.pendingRest.cardUids || [])],
      started
    };
  }

  prepareRest() {
    if (this.pendingRest) return this.copyPendingRest(false);
    const hasRestNode = this.semesterPlan[this.week]?.some((node) => node.type === "rest");
    if (!this.tarotId || !hasRestNode || FIXED_ROUTE_WEEKS.has(this.week) || this.awaitingNextSemester
      || this.pendingSemesterReward || this.pendingCombatReward || this.pendingCombatStart
      || this.pendingEventReward || this.pendingEventId || this.pendingShop || this.pet.pendingMilestone) return null;
    this.pendingRest = { stage: "choice", cardUids: [] };
    return this.copyPendingRest(true);
  }

  prepareRestUpgrade() {
    if (this.pendingRest?.stage !== "choice") return null;
    const cardUids = this.deck.filter((card) => !card.upgraded).map((card) => card.uid);
    if (!cardUids.length) return null;
    this.pendingRest = { stage: "upgrade", cardUids };
    return this.copyPendingRest(true);
  }

  resolveRestHeal() {
    if (this.pendingRest?.stage !== "choice" || this.hp >= this.maxHp) return null;
    const healed = this.heal(15);
    this.pendingRest = null;
    return { healed };
  }

  resolveRestPet() {
    if (this.pendingRest?.stage !== "choice") return null;
    this.pet.bond += 2;
    this.updatePetMilestone();
    this.pendingRest = { stage: "pet", cardUids: [], bond: 2, healed: 0 };
    return { bond: 2, pendingMilestone: this.pet.pendingMilestone };
  }

  resolvePendingRestCard(uid) {
    const pending = this.pendingRest;
    if (!pending?.cardUids?.includes(uid)) return null;
    let resolved = false;
    if (pending.stage === "tarotRemove") resolved = this.removeCard(uid);
    else if (["upgrade", "tarotUpgrade"].includes(pending.stage)) resolved = this.upgradeCard(uid);
    if (!resolved) return null;
    const stage = pending.stage;
    this.pendingRest = null;
    return { stage, uid };
  }

  completePendingRest() {
    if (!this.pendingRest) return false;
    this.pendingRest = null;
    return true;
  }

  tarotRestStatus() {
    const tarot = this.tarot;
    if (!tarot) return null;
    const rest = tarot.rest;
    let reason = "";
    if (this.flags.tarotRestUsed) reason = "本学期已经共鸣过";
    else if (rest.hpCost && this.hp <= rest.hpCost) reason = `至少需要 ${rest.hpCost + 1} 点生命`;
    else if (rest.goldCost && this.gold < rest.goldCost) reason = `需要 ${rest.goldCost} 校园币`;
    else if (rest.action === "remove" && this.deck.length <= 5) reason = "卡组已达到最小规模";
    else if (rest.action === "upgrade" && !this.deck.some((card) => !card.upgraded)) reason = "没有可升级的牌";
    return { ...rest, tarotId: tarot.id, available: !reason, reason };
  }

  tarotRestPreview() {
    const status = this.tarotRestStatus();
    if (!status) return null;
    const before = {
      hp: this.hp,
      gold: this.gold,
      bond: this.pet.bond,
      deckSize: this.deck.length,
      upgradedCards: this.deck.filter((card) => card.upgraded).length
    };
    const after = { ...before };
    if (status.hpCost) after.hp = Math.max(0, after.hp - status.hpCost);
    if (status.goldCost) after.gold = Math.max(0, after.gold - status.goldCost);
    if (status.heal) after.hp = Math.min(this.maxHp, after.hp + status.heal);
    if (status.bond) after.bond += status.bond;
    if (status.action === "remove") after.deckSize = Math.max(5, after.deckSize - 1);
    if (status.action === "upgrade") after.upgradedCards += 1;
    return { ...status, before, after };
  }

  resolveTarotRest() {
    if (this.pendingRest && this.pendingRest.stage !== "choice") {
      return { ok: false, reason: "当前休息选择正在结算" };
    }
    const status = this.tarotRestStatus();
    if (!status?.available) return { ok: false, reason: status?.reason || "当前没有塔罗契约" };
    this.flags.tarotRestUsed = true;
    this.stats.tarotRestUses += 1;
    if (status.hpCost) this.hp -= status.hpCost;
    if (status.goldCost) this.gold -= status.goldCost;
    if (status.bond) {
      this.pet.bond += status.bond;
      this.updatePetMilestone();
    }
    const healed = status.heal ? this.heal(status.heal) : 0;
    if (this.pendingRest) {
      if (status.action === "remove") {
        this.pendingRest = { stage: "tarotRemove", cardUids: this.deck.map((card) => card.uid) };
      } else if (status.action === "upgrade") {
        this.pendingRest = {
          stage: "tarotUpgrade",
          cardUids: this.deck.filter((card) => !card.upgraded).map((card) => card.uid)
        };
      } else {
        this.pendingRest = {
          stage: "tarotBond",
          cardUids: [],
          bond: status.bond || 0,
          healed
        };
      }
    }
    return { ok: true, action: status.action, healed, bond: status.bond || 0 };
  }

  createCard(id, upgraded = false) {
    this.cardSerial += 1;
    return makeCard(id, `c${this.cardSerial}`, upgraded);
  }

  hasItem(id) {
    return this.items.includes(id);
  }

  addItem(id) {
    if (!ITEM_DEFS[id] || this.hasItem(id) || this.items.length >= this.backpackCapacity) return false;
    this.items.push(id);
    return true;
  }

  addCard(id, upgraded = false) {
    const card = this.createCard(id, upgraded);
    this.deck.push(card);
    return card;
  }

  removeCard(uid) {
    const index = this.deck.findIndex((card) => card.uid === uid);
    if (index < 0 || this.deck.length <= 5) return false;
    this.deck.splice(index, 1);
    delete this.cardCombatUses[uid];
    return true;
  }

  upgradeCard(uid) {
    const card = this.deck.find((candidate) => candidate.uid === uid);
    if (!card || card.upgraded || card.id === "nervous" || card.id === "todo") return false;
    card.upgraded = true;
    return true;
  }

  canEnchant(card) {
    if (!card || card.enchantment) return false;
    const definition = CARD_DEFS[card.id];
    if (!definition || definition.type === "status") return false;
    const effect = card.upgraded ? definition.upgradedEffect : definition.effect;
    if (this.archetypeId === "aries") return definition.type === "attack" && Boolean(effect.damage);
    if (this.archetypeId === "gemini") return typeof definition.cost === "number" && definition.cost > 0;
    if (this.archetypeId === "cancer") return Boolean(effect.block);
    return false;
  }

  enchantableCards(uids = null) {
    const allowed = uids ? new Set(uids) : null;
    return this.deck.filter((card) => (!allowed || allowed.has(card.uid)) && this.canEnchant(card));
  }

  enchantCard(uid) {
    const card = this.deck.find((candidate) => candidate.uid === uid);
    if (!this.canEnchant(card)) return false;
    card.enchantment = {
      aries: "ariesFlame",
      gemini: "geminiQuick",
      cancer: "cancerGuard"
    }[this.archetypeId];
    return true;
  }

  heal(amount) {
    const previous = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - previous;
  }

  randomEnemy({ source = "special", semester = this.semester, week = this.week, exclude = [] } = {}) {
    const sourcePool = source === "route"
      ? normalRouteEnemyPool(semester, week)
      : NORMAL_ENEMY_IDS;
    const excludedIds = new Set(Array.isArray(exclude) ? exclude : [exclude]);
    const availablePool = sourcePool.filter((id) => !excludedIds.has(id));
    const pool = availablePool.length ? availablePool : sourcePool;
    return this.rng.pick(pool);
  }

  previewRandomEnemy(options = {}) {
    const rngState = this.rng.state;
    try {
      return this.randomEnemy(options);
    } finally {
      this.rng.state = rngState;
    }
  }

  campusRumorPreview() {
    if (this.pendingEventId !== "campusRumor") return null;
    const rareItems = this.availableItemIds({ rarity: "rare" });
    const remainingItems = this.availableItemIds();
    const reward = rareItems.length
      ? { type: "rareItem", choices: Math.min(2, rareItems.length), gold: 0 }
      : remainingItems.length
        ? { type: "item", choices: 1, gold: 0 }
        : { type: "gold", choices: 0, gold: ITEM_REWARD_FALLBACK_GOLD.event };
    return {
      enemyId: this.previewRandomEnemy(),
      hpMultiplier: 1.3,
      reward
    };
  }

  generateSemesterPlan() {
    const plan = Array.from({ length: 17 }, () => []);
    plan[1] = [makeRouteNode("combat", 1, { enemy: "sleepyBug" })];
    plan[2] = [makeRouteNode("combat", 2, { enemy: "homeworkBlob" })];
    plan[8] = [makeRouteNode("combat", 8, { enemy: "rivalShadow" })];
    plan[16] = [makeRouteNode("combat", 16, { enemy: "finalExam" })];

    const anchors = {
      3: { type: "event", pool: "safe" },
      4: { type: "combat" },
      5: { type: "rest" },
      6: { type: "combat" },
      7: { type: "shop" },
      9: { type: "rest" },
      10: { type: "event", pool: "all" },
      11: { type: "combat" },
      12: { type: "shop" },
      13: { type: "event", pool: "all" },
      14: { type: "combat" },
      15: { type: "combat" }
    };
    let restOptions = 2;
    let shopOptions = 2;
    let lastRouteCombatEnemy = plan[2][0].enemy;
    const pickRouteEnemy = (source, week) => {
      const enemy = this.randomEnemy({ source, week, exclude: lastRouteCombatEnemy });
      lastRouteCombatEnemy = enemy;
      return enemy;
    };
    const pairedRouteEnemy = (week, enemyId) => {
      const pool = normalRouteEnemyPool(this.semester, week);
      const currentIndex = pool.indexOf(enemyId);
      return pool[(currentIndex + 1 + pool.length) % pool.length] || enemyId;
    };
    const challengeWeeks = [this.rng.pick([5, 7]), this.rng.pick([10, 12, 13])];
    const challengeAffixes = this.rng.shuffle(CHALLENGE_AFFIX_IDS).slice(0, challengeWeeks.length);
    const challengeAffixByWeek = new Map(challengeWeeks.map((week, index) => [week, challengeAffixes[index]]));
    for (const week of Object.keys(anchors).map(Number)) {
      const anchor = anchors[week];
      const previousRouteCombatEnemy = lastRouteCombatEnemy;
      const anchorNode = makeRouteNode(anchor.type, week, {
        enemy: anchor.type === "combat" ? pickRouteEnemy("route", week) : undefined,
        pool: anchor.pool
      });
      let candidates = ["combat", "combat", "event", "event", "rest", "shop"]
        .filter((type) => type !== anchor.type)
        .filter((type) => type !== "rest" || restOptions < 4)
        .filter((type) => type !== "shop" || shopOptions < 3);
      if (!candidates.length) candidates = ["combat", "event"].filter((type) => type !== anchor.type);
      // Keep the candidate roll and supply caps comparable when a core combat week replaces this sampled node.
      const sampledAlternateType = challengeAffixByWeek.has(week)
        ? "combat"
        : this.rng.pick(candidates);
      if (sampledAlternateType === "rest") restOptions += 1;
      if (sampledAlternateType === "shop") shopOptions += 1;
      const alternateType = COMBAT_CHOICE_WEEKS.has(week) ? "combat" : sampledAlternateType;
      const alternateNode = makeRouteNode(alternateType, week, {
        enemy: alternateType === "combat"
          ? COMBAT_CHOICE_WEEKS.has(week)
            ? pairedRouteEnemy(week, anchorNode.enemy)
            : pickRouteEnemy(challengeAffixByWeek.has(week) ? "challenge" : "route", week)
          : undefined,
        pool: week <= 3 ? "safe" : "all",
        challenge: challengeAffixByWeek.has(week),
        affix: challengeAffixByWeek.get(week)
      });
      plan[week] = this.rng.shuffle([anchorNode, alternateNode]);
      if (COMBAT_CHOICE_WEEKS.has(week) && plan[week][0].enemy === previousRouteCombatEnemy) {
        plan[week].reverse();
      }
      const lastVisibleCombat = plan[week].slice().reverse().find((node) => node.type === "combat");
      if (lastVisibleCombat) lastRouteCombatEnemy = lastVisibleCombat.enemy;
    }
    return applyCoreCombatRouteRewards(plan);
  }

  normalCombatRouteReward(enemyId = this.combat?.enemy?.id) {
    const node = this.semesterPlan[this.week]?.find((candidate) => (
      candidate.type === "combat" && !candidate.challenge && candidate.enemy === enemyId
    ));
    const routeThreat = Number.isInteger(node?.routeThreat) && node.routeThreat > 0
      ? node.routeThreat
      : 0;
    const bonusGold = node?.bonusGold === HIGH_THREAT_ROUTE_BONUS_GOLD
      ? HIGH_THREAT_ROUTE_BONUS_GOLD
      : 0;
    return {
      routeThreat,
      baseGold: NORMAL_COMBAT_REWARD_GOLD,
      bonusGold,
      totalGold: NORMAL_COMBAT_REWARD_GOLD + bonusGold
    };
  }

  availableItemIds({ rarity, allowBoss = false, ids = null } = {}) {
    const pool = (Array.isArray(ids) ? ids : allowBoss ? Object.keys(ITEM_DEFS) : REGULAR_ITEM_IDS)
      .filter((id, index, source) => source.indexOf(id) === index)
      .filter((id) => ITEM_DEFS[id])
      .filter((id) => !this.hasItem(id))
      .filter((id) => !rarity || ITEM_DEFS[id].rarity === rarity);
    return pool;
  }

  availableChallengeItemIds(enemyId = null, signatureItemId = undefined) {
    const liveSignature = this.challengeSignatureItemRewardState(enemyId).signatureItemId;
    const resolvedSignature = signatureItemId === undefined ? liveSignature : signatureItemId;
    const validSignature = resolvedSignature
      && CHALLENGE_SIGNATURE_ITEM_DROPS[enemyId] === resolvedSignature
      && ITEM_DEFS[resolvedSignature]
      && !this.hasItem(resolvedSignature)
      ? resolvedSignature
      : null;
    return validSignature ? [validSignature] : this.availableItemIds();
  }

  claimItemRewardFallback(source) {
    const gold = ITEM_REWARD_FALLBACK_GOLD[source];
    if (!gold) return null;
    this.gold += gold;
    return { source, gold, totalGold: this.gold };
  }

  randomItem({ rarity, allowBoss = false } = {}) {
    const pool = this.availableItemIds({ rarity, allowBoss });
    return pool.length ? this.rng.pick(pool) : null;
  }

  itemRewardSourceFor(id) {
    if (!ITEM_DEFS[id]) return null;
    if (this.pendingEventReward?.type === "item" && (this.pendingEventReward.itemChoices || []).includes(id)) return "event";
    const combat = this.pendingCombatReward;
    if (combat?.stage === "item" && (combat.itemChoices || []).includes(id)
      && ["eliteChain", "challengeChain", "eventItem"].includes(combat.type)) return "combat";
    if (this.pendingSemesterReward?.stage === "bossItem"
      && (this.pendingSemesterReward.itemChoices || []).includes(id)) return "semester";
    if (this.pendingShop?.items?.some((stock) => stock.id === id && !stock.sold)
      && !this.hasItem(id)) return "shop";
    return null;
  }

  copyPendingItemReplacement(started = false) {
    return this.pendingItemReplacement ? { ...this.pendingItemReplacement, started } : null;
  }

  prepareItemReplacement(incoming) {
    if (this.pendingItemReplacement) {
      return this.pendingItemReplacement.incoming === incoming
        ? this.copyPendingItemReplacement(false)
        : null;
    }
    const source = this.itemRewardSourceFor(incoming);
    if (!source || this.items.length < this.backpackCapacity || this.hasItem(incoming)) return null;
    const price = source === "shop" ? this.shopPrice("item", incoming) : null;
    if (source === "shop" && (!Number.isSafeInteger(price) || price <= 0 || this.gold < price)) return null;
    this.pendingItemReplacement = {
      incoming,
      source,
      ...(source === "shop" ? { price } : {})
    };
    return this.copyPendingItemReplacement(true);
  }

  replacePendingItem(outgoing) {
    const pending = this.pendingItemReplacement;
    const oldIndex = this.items.indexOf(outgoing);
    if (!pending || oldIndex < 0 || this.items.length < this.backpackCapacity
      || this.hasItem(pending.incoming) || this.itemRewardSourceFor(pending.incoming) !== pending.source) return null;
    if (pending.source === "shop") {
      const stock = this.pendingShop?.items?.find((entry) => entry.id === pending.incoming);
      const currentPrice = this.shopPrice("item", pending.incoming);
      if (!stock || stock.sold || !Number.isSafeInteger(pending.price) || pending.price <= 0
        || pending.price !== currentPrice || this.gold < pending.price) return null;
      this.items.splice(oldIndex, 1, pending.incoming);
      this.gold -= pending.price;
      stock.sold = true;
      this.flags.nextShopHalf = false;
      this.stats.itemsTaken += 1;
      this.pendingItemReplacement = null;
      return { incoming: pending.incoming, outgoing, source: pending.source, price: pending.price };
    }
    this.items.splice(oldIndex, 1, pending.incoming);
    this.stats.itemsTaken += 1;
    this.pendingItemReplacement = null;
    return { incoming: pending.incoming, outgoing, source: pending.source };
  }

  cancelPendingItemReplacement() {
    if (!this.pendingItemReplacement) return false;
    this.pendingItemReplacement = null;
    return true;
  }

  petSkillPreview() {
    const pet = this.getPetDefinition();
    const talent = this.pet.talent && pet.talentIds.includes(this.pet.talent)
      ? PET_TALENT_DEFS[this.pet.talent]
      : null;
    const level = Math.min(3, Math.max(0, Number(this.pet.talentLevel) || 0));
    const levelEffect = talent && level > 0 ? talent.levels[level - 1] : {};
    return {
      damage: pet.skill.baseDamage + (levelEffect.damageBonus || 0),
      block: (pet.skill.baseBlock || 0) + (levelEffect.block || 0),
      draw: levelEffect.draw || 0,
      nextDrawBonus: levelEffect.nextDrawBonus || 0,
      pet,
      skill: pet.skill,
      talent,
      level,
      text: levelEffect.text || `造成 ${pet.skill.baseDamage} 点伤害。`
    };
  }

  updatePetMilestone() {
    const [chooseAt, upgradeAt, masterAt] = this.getPetDefinition().bondMilestones;
    if (this.pet.pendingMilestone) return this.pet.pendingMilestone;
    if (!this.pet.talent && this.pet.bond >= chooseAt) this.pet.pendingMilestone = "choose";
    else if (this.pet.talent && this.pet.talentLevel < 2 && this.pet.bond >= upgradeAt) this.pet.pendingMilestone = "upgrade";
    else if (this.pet.talent && this.pet.talentLevel < 3 && this.pet.bond >= masterAt) this.pet.pendingMilestone = "master";
    return this.pet.pendingMilestone;
  }

  resolvePetMilestone(talentId = null) {
    const allowedTalents = this.getPetDefinition().talentIds;
    const milestone = this.pet.pendingMilestone;
    if (milestone === "choose") {
      if (!allowedTalents.includes(talentId) || !PET_TALENT_DEFS[talentId]) return false;
      this.pet.talent = talentId;
      this.pet.talentLevel = 1;
    } else if (milestone === "upgrade" || milestone === "master") {
      if (!allowedTalents.includes(this.pet.talent) || !PET_TALENT_DEFS[this.pet.talent]) return false;
      this.pet.talentLevel = Math.min(3, this.pet.talentLevel + 1);
    } else {
      return false;
    }
    this.pet.pendingMilestone = null;
    const pendingChallenge = this.pendingCombatReward;
    if (pendingChallenge?.type === "challengeChain" && pendingChallenge.stage === "route") {
      const petReward = this.challengePetRewardState(pendingChallenge.enemyId);
      pendingChallenge.enemyId = petReward.enemyId;
      pendingChallenge.eggId = petReward.eggId;
      pendingChallenge.rewardVariant = petReward.rewardVariant;
    }
    return true;
  }

  rewardCards(count = 3, forcedRarity = null) {
    this.rewardIndex += 1;
    const eligible = (pool) => pool.filter((id) => {
      if (forcedRarity) return CARD_DEFS[id].rarity === forcedRarity;
      if (this.rewardIndex <= 2) return CARD_DEFS[id].rarity !== "rare";
      return true;
    });
    const pickWeighted = (pool, choices) => {
      const weighted = pool.filter((id) => !choices.includes(id));
      if (!weighted.length) return null;
      const roll = this.rng.next();
      const desired = forcedRarity || (roll < 0.58 ? "common" : roll < 0.91 ? "uncommon" : "rare");
      const matching = weighted.filter((id) => CARD_DEFS[id].rarity === desired);
      return this.rng.pick(matching.length ? matching : weighted);
    };

    const exclusivePool = eligible(ARCHETYPE_CARD_IDS[this.archetypeId]);
    const publicPool = eligible(PUBLIC_REWARD_CARD_IDS);
    const choices = [];
    if (count > 0) {
      const exclusive = pickWeighted(exclusivePool, choices);
      if (exclusive) choices.push(exclusive);
    }
    while (choices.length < count) {
      const publicCard = pickWeighted(publicPool, choices);
      if (!publicCard) break;
      choices.push(publicCard);
    }
    return this.rng.shuffle(choices);
  }

  prepareNormalCombatReward() {
    if (this.pendingCombatReward) {
      if (this.pendingCombatReward.type !== "normalCard") return null;
      return {
        ...this.pendingCombatReward,
        choices: [...(this.pendingCombatReward.choices || [])],
        itemChoices: [...(this.pendingCombatReward.itemChoices || [])],
        usedCardUids: [...(this.pendingCombatReward.usedCardUids || [])],
        started: false
      };
    }
    const combat = this.combat;
    const receipt = combat?.victoryReceipt;
    if (this.pendingCombatStart || this.pendingShop || this.pendingRest || this.awaitingNextSemester
      || this.pendingSemesterReward || this.week >= 16 || combat?.status !== "won"
      || combat.result !== "won" || combat.rewardPrepared === true || receipt?.outcome !== "normal"
      || receipt.week !== this.week || receipt.enemyId !== combat.enemy?.id
      || ENEMY_DEFS[receipt.enemyId]?.kind !== "normal") return null;
    const bonusGold = receipt.bonusGold === HIGH_THREAT_ROUTE_BONUS_GOLD
      ? HIGH_THREAT_ROUTE_BONUS_GOLD
      : 0;
    const gold = NORMAL_COMBAT_REWARD_GOLD + bonusGold;
    this.gold += gold;
    this.pendingCombatReward = {
      type: "normalCard",
      choices: this.rewardCards(3),
      gold,
      bonusGold
    };
    combat.rewardPrepared = true;
    return { ...this.pendingCombatReward, choices: [...this.pendingCombatReward.choices], started: true };
  }

  prepareEliteCombatReward(usedCardUids = []) {
    if (this.pendingCombatReward) {
      return {
        ...this.pendingCombatReward,
        choices: [...(this.pendingCombatReward.choices || [])],
        itemChoices: [...(this.pendingCombatReward.itemChoices || [])],
        usedCardUids: [...(this.pendingCombatReward.usedCardUids || [])],
        started: false
      };
    }
    if (this.pendingCombatStart || this.pendingShop || this.pendingRest || this.awaitingNextSemester || this.pendingSemesterReward || this.week !== 8) return null;
    this.gold += 30;
    this.pendingCombatReward = {
      type: "eliteChain",
      stage: "card",
      choices: this.rewardCards(3),
      itemChoices: [],
      usedCardUids: [...new Set(usedCardUids)]
        .filter((uid) => typeof uid === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(uid))
        .slice(0, 64),
      fallbackGold: 0
    };
    return {
      ...this.pendingCombatReward,
      choices: [...this.pendingCombatReward.choices],
      itemChoices: [],
      usedCardUids: [...this.pendingCombatReward.usedCardUids],
      started: true
    };
  }

  advanceEliteCombatRewardFromCard() {
    const pending = this.pendingCombatReward;
    if (pending?.type !== "eliteChain" || pending.stage !== "card") return false;
    const itemChoices = this.rng.shuffle(this.availableItemIds()).slice(0, 2);
    pending.choices = [];
    if (itemChoices.length) {
      pending.stage = "item";
      pending.itemChoices = itemChoices;
      pending.fallbackGold = 0;
    } else {
      const fallback = this.claimItemRewardFallback("elite");
      pending.stage = "enchant";
      pending.itemChoices = [];
      pending.fallbackGold = fallback?.gold || 0;
    }
    return true;
  }

  advanceEliteCombatRewardFromItem() {
    const pending = this.pendingCombatReward;
    if (pending?.type !== "eliteChain" || pending.stage !== "item" || this.pendingItemReplacement) return false;
    pending.stage = "enchant";
    pending.itemChoices = [];
    pending.fallbackGold = 0;
    return true;
  }

  prepareChallengeCombatReward({ affix, trialCompleted = false, trialBonus = 0, enemyId = null } = {}) {
    if (this.pendingCombatReward) {
      return {
        ...this.pendingCombatReward,
        choices: [...(this.pendingCombatReward.choices || [])],
        itemChoices: [...(this.pendingCombatReward.itemChoices || [])],
        usedCardUids: [...(this.pendingCombatReward.usedCardUids || [])],
        started: false
      };
    }
    if (this.pendingCombatStart || this.pendingShop || this.pendingRest || this.awaitingNextSemester || this.pendingSemesterReward || FIXED_ROUTE_WEEKS.has(this.week)
      || !CHALLENGE_AFFIX_DEFS[affix]) return null;
    const completed = trialCompleted === true;
    const rewardEnemyId = ENEMY_DEFS[enemyId]
      ? enemyId
      : (this.combat?.modifiers?.challenge ? this.combat.enemy.id : null);
    const petReward = this.challengePetRewardState(rewardEnemyId);
    const signatureReward = this.challengeSignatureItemRewardState(rewardEnemyId);
    this.pendingCombatReward = {
      type: "challengeChain",
      stage: "route",
      route: null,
      affix,
      enemyId: petReward.enemyId,
      eggId: petReward.eggId,
      rewardVariant: petReward.rewardVariant,
      signatureItemId: signatureReward.signatureItemId,
      trialCompleted: completed,
      trialBonus: completed
        ? Math.min(ARCHETYPE_TRIAL_DEFS[this.archetypeId].bonusGold, nonNegativeInteger(trialBonus))
        : 0,
      choices: [],
      itemChoices: [],
      usedCardUids: [],
      fallbackGold: 0
    };
    return { ...this.pendingCombatReward, choices: [], itemChoices: [], usedCardUids: [], started: true };
  }

  choosePendingChallengeReward(id) {
    const pending = this.pendingCombatReward;
    if (pending?.type !== "challengeChain" || pending.stage !== "route") return false;
    const reward = this.claimChallengeReward(id);
    if (!reward) return false;
    pending.route = id;
    pending.choices = [];
    pending.itemChoices = [];
    pending.fallbackGold = 0;
    if (id === "cards") {
      pending.stage = "card";
      pending.choices = this.rng.shuffle(ARCHETYPE_CARD_IDS[this.archetypeId]).slice(0, 3);
    } else if (id === "pet") {
      const claimedEgg = pending.rewardVariant === "egg" && pending.eggId
        ? this.claimEgg(pending.eggId)
        : null;
      if (!claimedEgg && this.activePetIsMastered()) {
        pending.rewardVariant = "mastery";
        this.gold += reward.masteryFallbackGold - reward.gold;
        pending.fallbackGold = reward.masteryFallbackGold;
      } else if (!claimedEgg) {
        pending.rewardVariant = "bond";
        this.pet.bond += reward.bond;
        this.updatePetMilestone();
      }
      pending.stage = "complete";
    } else {
      const availableItems = this.availableChallengeItemIds(pending.enemyId, pending.signatureItemId);
      const itemChoices = availableItems[0] === pending.signatureItemId
        ? availableItems.slice(0, 1)
        : this.rng.shuffle(availableItems).slice(0, reward.itemChoices);
      if (itemChoices.length) {
        pending.stage = "item";
        pending.itemChoices = itemChoices;
      } else {
        this.gold += reward.fallbackGold - reward.gold;
        pending.stage = "complete";
        pending.fallbackGold = reward.fallbackGold;
      }
    }
    return true;
  }

  prepareEventCombatReward() {
    if (this.pendingCombatReward) {
      return {
        ...this.pendingCombatReward,
        choices: [...(this.pendingCombatReward.choices || [])],
        itemChoices: [...(this.pendingCombatReward.itemChoices || [])],
        usedCardUids: [...(this.pendingCombatReward.usedCardUids || [])],
        started: false
      };
    }
    if (this.pendingCombatStart || this.pendingShop || this.pendingRest || this.awaitingNextSemester || this.pendingSemesterReward || FIXED_ROUTE_WEEKS.has(this.week)) return null;
    const rares = this.availableItemIds({ rarity: "rare" });
    const itemChoices = rares.length
      ? this.rng.shuffle(rares).slice(0, 2)
      : [this.randomItem()].filter(Boolean);
    this.pendingCombatReward = {
      type: "eventItem",
      stage: itemChoices.length ? "item" : "complete",
      choices: [],
      itemChoices,
      usedCardUids: [],
      fallbackGold: 0
    };
    if (!itemChoices.length) {
      const fallback = this.claimItemRewardFallback("event");
      this.pendingCombatReward.fallbackGold = fallback?.gold || 0;
    }
    return {
      ...this.pendingCombatReward,
      choices: [],
      itemChoices: [...this.pendingCombatReward.itemChoices],
      usedCardUids: [],
      started: true
    };
  }

  replacePendingCombatRewardChoices(choices) {
    const pending = this.pendingCombatReward;
    const canReplace = pending?.type === "normalCard"
      || (pending?.type === "eliteChain" && pending.stage === "card");
    if (!canReplace || !Array.isArray(choices)) return false;
    const valid = [...new Set(choices)].filter((id) => {
      const card = CARD_DEFS[id];
      return card && (!card.archetype || card.archetype === this.archetypeId);
    }).slice(0, 3);
    if (!valid.length) return false;
    pending.choices = valid;
    return true;
  }

  completePendingCombatReward() {
    if (!this.pendingCombatReward || this.pendingItemReplacement?.source === "combat") return false;
    this.pendingCombatReward = null;
    return true;
  }

  copyPendingEventReward(started = false) {
    if (!this.pendingEventReward) return null;
    return {
      ...this.pendingEventReward,
      choices: [...(this.pendingEventReward.choices || [])],
      cardUids: [...(this.pendingEventReward.cardUids || [])],
      itemChoices: [...(this.pendingEventReward.itemChoices || [])],
      started
    };
  }

  canPrepareEventReward() {
    return !this.awaitingNextSemester
      && !this.pendingSemesterReward
      && !this.pendingCombatReward
      && !this.pendingCombatStart
      && !this.pendingShop
      && !this.pendingRest
      && !FIXED_ROUTE_WEEKS.has(this.week);
  }

  prepareEventCardReward(source, choices = []) {
    if (this.pendingEventReward) return this.copyPendingEventReward(false);
    const filter = EVENT_CARD_REWARD_SOURCES[source];
    if (!filter || !this.canPrepareEventReward()) return null;
    const valid = [...new Set(choices)].filter((id) => {
      const card = CARD_DEFS[id];
      if (!card || (card.archetype && card.archetype !== this.archetypeId)) return false;
      if (filter === "uncommon") return card.rarity === "uncommon";
      if (filter === "attack") return card.type === "attack";
      return card.type !== "attack" && card.type !== "status";
    }).slice(0, 3);
    if (!valid.length) return null;
    this.pendingEventReward = {
      type: "card",
      source,
      choices: valid,
      cardUids: [],
      itemChoices: []
    };
    return this.copyPendingEventReward(true);
  }

  prepareEventDeckReward(source, cardUids = []) {
    if (this.pendingEventReward) return this.copyPendingEventReward(false);
    const type = EVENT_DECK_REWARD_SOURCES[source];
    if (!type || !this.canPrepareEventReward()) return null;
    const valid = [...new Set(cardUids)].filter((uid) => {
      const card = this.deck.find((candidate) => candidate.uid === uid);
      if (!card) return false;
      if (type === "upgrade") return !card.upgraded && !["nervous", "todo"].includes(card.id);
      return this.deck.length > 5;
    }).slice(0, 64);
    if (!valid.length) return null;
    this.pendingEventReward = {
      type,
      source,
      choices: [],
      cardUids: valid,
      itemChoices: []
    };
    return this.copyPendingEventReward(true);
  }

  prepareEventItemReward(source, itemChoices = []) {
    if (this.pendingEventReward) return this.copyPendingEventReward(false);
    if (!EVENT_ITEM_REWARD_SOURCES.has(source) || !this.canPrepareEventReward()) return null;
    const valid = [...new Set(itemChoices)]
      .filter((id) => ITEM_DEFS[id]?.rarity === "common" && !this.hasItem(id))
      .slice(0, 1);
    if (!valid.length) return null;
    this.pendingEventReward = {
      type: "item",
      source,
      choices: [],
      cardUids: [],
      itemChoices: valid
    };
    return this.copyPendingEventReward(true);
  }

  completePendingEventReward() {
    if (!this.pendingEventReward || this.pendingItemReplacement?.source === "event") return false;
    this.pendingEventReward = null;
    return true;
  }

  preparePendingEvent(eventId) {
    if (this.pendingEventId) return this.pendingEventId === eventId;
    if (!EVENT_DEFS[eventId] || this.awaitingNextSemester || this.pendingSemesterReward
      || this.pendingCombatReward || this.pendingCombatStart || this.pendingEventReward || this.pendingShop || this.pendingRest
      || FIXED_ROUTE_WEEKS.has(this.week)) return false;
    this.lastEventId = eventId;
    this.pendingEventId = eventId;
    return true;
  }

  completePendingEvent() {
    if (!this.pendingEventId) return false;
    this.pendingEventId = null;
    return true;
  }

  copyPendingCombatStart(started = false) {
    if (!this.pendingCombatStart) return null;
    return {
      ...this.pendingCombatStart,
      modifiers: { ...(this.pendingCombatStart.modifiers || {}) },
      started
    };
  }

  prepareCombatStart(enemyId, outcome, modifiers = {}) {
    if (this.pendingCombatStart) return this.copyPendingCombatStart(false);
    if (!ENEMY_DEFS[enemyId] || !["normal", "elite", "boss", "challenge", "event"].includes(outcome)
      || !this.tarotId || this.awaitingNextSemester || this.pendingSemesterReward || this.pendingCombatReward
      || this.pendingEventReward || this.pendingShop || this.pendingRest || this.pet.pendingMilestone) return null;

    let canonicalModifiers = null;
    const modifierKeys = Object.keys(modifiers || {});
    if (outcome === "challenge") {
      if (modifiers.challenge === true
        && modifiers.hpMultiplier === CHALLENGE_RULES.hpMultiplier
        && modifiers.damageMultiplier === CHALLENGE_RULES.damageMultiplier
        && CHALLENGE_AFFIX_DEFS[modifiers.affix]
        && modifierKeys.every((key) => ["challenge", "hpMultiplier", "damageMultiplier", "affix"].includes(key))) {
        canonicalModifiers = {
          challenge: true,
          hpMultiplier: CHALLENGE_RULES.hpMultiplier,
          damageMultiplier: CHALLENGE_RULES.damageMultiplier,
          affix: modifiers.affix
        };
      }
    } else if (outcome === "event") {
      if (modifiers.hpMultiplier === 1.3
        && modifierKeys.every((key) => key === "hpMultiplier")) canonicalModifiers = { hpMultiplier: 1.3 };
    } else if (!modifierKeys.length) {
      canonicalModifiers = {};
    }
    if (!canonicalModifiers) return null;

    if (outcome === "event") {
      if (this.pendingEventId !== "campusRumor" || ENEMY_DEFS[enemyId].kind !== "normal"
        || FIXED_ROUTE_WEEKS.has(this.week)) return null;
    } else {
      if (this.pendingEventId) return null;
      const node = this.semesterPlan[this.week]?.find((candidate) => candidate.type === "combat"
        && candidate.enemy === enemyId
        && (candidate.challenge === true) === (outcome === "challenge"));
      if (!node) return null;
      const expectedOutcome = node.challenge ? "challenge" : ENEMY_DEFS[enemyId].kind;
      if (expectedOutcome !== outcome || (outcome === "challenge" && node.affix !== canonicalModifiers.affix)) return null;
    }

    const routeReward = outcome === "normal"
      ? this.normalCombatRouteReward(enemyId)
      : null;
    this.pendingCombatStart = {
      enemyId,
      outcome,
      modifiers: canonicalModifiers,
      ...(routeReward?.routeThreat ? {
        routeThreat: routeReward.routeThreat,
        bonusGold: routeReward.bonusGold
      } : {})
    };
    return this.copyPendingCombatStart(true);
  }

  completePendingCombatStart() {
    if (!this.pendingCombatStart) return false;
    this.pendingCombatStart = null;
    return true;
  }

  copyPendingShop(started = false) {
    if (!this.pendingShop) return null;
    return {
      ...this.pendingShop,
      cards: this.pendingShop.cards.map((stock) => ({ ...stock })),
      items: this.pendingShop.items.map((stock) => ({ ...stock })),
      started
    };
  }

  prepareShop() {
    if (this.pendingShop) return this.copyPendingShop(false);
    const hasShopNode = this.semesterPlan[this.week]?.some((node) => node.type === "shop");
    if (!this.tarotId || !hasShopNode || FIXED_ROUTE_WEEKS.has(this.week) || this.awaitingNextSemester
      || this.pendingSemesterReward || this.pendingCombatReward || this.pendingCombatStart
      || this.pendingEventReward || this.pendingEventId || this.pendingRest || this.pet.pendingMilestone) return null;
    const exclusive = this.rng.shuffle(ARCHETYPE_CARD_IDS[this.archetypeId]).slice(0, 1);
    const publicCards = this.rng.shuffle(PUBLIC_REWARD_CARD_IDS).slice(0, 2);
    const cardIds = this.rng.shuffle([...exclusive, ...publicCards]);
    const itemIds = this.rng.shuffle(this.availableItemIds()).slice(0, 2);
    this.pendingShop = {
      cards: cardIds.map((id) => ({ id, sold: false })),
      items: itemIds.map((id) => ({ id, sold: false })),
      removePrice: 75 + (this.semester - 1) * 15,
      removed: false
    };
    return this.copyPendingShop(true);
  }

  shopPrice(kind, id) {
    const rarity = kind === "card" ? CARD_DEFS[id]?.rarity : ITEM_DEFS[id]?.rarity;
    const base = kind === "card"
      ? { common: 40, uncommon: 65, rare: 100 }[rarity]
      : { common: 90, uncommon: 120, rare: 160 }[rarity];
    if (!base) return null;
    let price = base;
    if (this.hasItem("studentId")) price *= 0.9;
    if (kind === "item" && this.flags.nextShopHalf) price *= 0.5;
    return Math.ceil(price);
  }

  shopRemovePrice() {
    const base = Number(this.pendingShop?.removePrice);
    if (!Number.isFinite(base) || base <= 0) return null;
    return Math.ceil(base * (this.hasItem("studentId") ? 0.9 : 1));
  }

  buyShopCard(index) {
    if (this.pendingItemReplacement?.source === "shop") return null;
    const stock = this.pendingShop?.cards?.[index];
    const price = stock ? this.shopPrice("card", stock.id) : null;
    if (!stock || stock.sold || price === null || this.gold < price) return null;
    this.gold -= price;
    this.addCard(stock.id);
    this.stats.cardsTaken += 1;
    if (CARD_DEFS[stock.id].archetype === this.archetypeId) this.stats.exclusiveTaken += 1;
    else this.stats.publicTaken += 1;
    stock.sold = true;
    return { id: stock.id, price };
  }

  buyShopItem(id) {
    if (this.pendingItemReplacement?.source === "shop") return null;
    const stock = this.pendingShop?.items?.find((entry) => entry.id === id);
    const price = stock ? this.shopPrice("item", stock.id) : null;
    if (!stock || stock.sold || price === null || this.gold < price
      || this.items.length >= this.backpackCapacity || this.hasItem(id)) return null;
    this.gold -= price;
    this.addItem(id);
    this.stats.itemsTaken += 1;
    stock.sold = true;
    this.flags.nextShopHalf = false;
    return { id, price };
  }

  removeShopCard(uid) {
    if (this.pendingItemReplacement?.source === "shop") return null;
    const shop = this.pendingShop;
    const price = this.shopRemovePrice();
    if (!shop || shop.removed || price === null || this.gold < price || !this.removeCard(uid)) return null;
    this.gold -= price;
    shop.removed = true;
    return { uid, price };
  }

  completePendingShop() {
    if (!this.pendingShop || this.pendingItemReplacement?.source === "shop") return false;
    this.pendingShop = null;
    return true;
  }

  claimChallengeReward(id) {
    const reward = CHALLENGE_REWARD_DEFS[id];
    if (!reward) return null;
    this.gold += reward.gold;
    this.stats.challengeRewardChoices[id] += 1;
    return reward;
  }

  challengeTrialStatus() {
    const combat = this.combat;
    if (!combat?.modifiers.challenge) return null;
    const definition = ARCHETYPE_TRIAL_DEFS[this.archetypeId];
    const hpLost = Math.max(0, combat.startingHp - this.hp);
    let achieved = false;
    let failed = combat.status === "lost";
    let progress;

    if (this.archetypeId === "aries") {
      achieved = combat.status === "won" && combat.turn <= 3;
      failed ||= combat.turn > 3;
      progress = failed ? `已进入第 ${combat.turn} 回合` : `当前第 ${combat.turn} 回合`;
    } else if (this.archetypeId === "gemini") {
      achieved = combat.maxCardsPlayedInTurn >= 4;
      progress = `本回合 ${combat.cardsPlayedThisTurn}/4 · 本场最高 ${combat.maxCardsPlayedInTurn}/4`;
    } else {
      achieved = combat.status === "won" && hpLost <= 5;
      failed ||= hpLost > 5;
      progress = `本场掉血 ${hpLost}/5`;
    }

    if (combat.status === "won" && !achieved) failed = true;
    const completed = combat.status === "won" && achieved;
    const state = completed ? "completed" : achieved ? "achieved" : failed ? "failed" : "active";
    return { ...definition, archetypeId: this.archetypeId, achieved, completed, failed, state, progress };
  }

  eligibleSummaryCards() {
    return this.deck.filter((card) => this.summaryCardProgress(card.uid).upgradeable);
  }

  summaryCardProgress(uid) {
    const target = 3;
    const card = this.deck.find((candidate) => candidate.uid === uid);
    const current = card
      ? Math.min(target, nonNegativeInteger(this.cardCombatUses[uid]))
      : 0;
    const eligible = Boolean(card && current >= target);
    const upgradeable = Boolean(
      eligible
      && !card.upgraded
      && CARD_DEFS[card.id]?.type !== "status"
    );
    return {
      current,
      target,
      remaining: Math.max(0, target - current),
      eligible,
      upgradeable
    };
  }

  startCombat(enemyId, modifiers = {}) {
    if (enemyId === "random") enemyId = this.randomEnemy();
    const definition = ENEMY_DEFS[enemyId];
    if (!definition) throw new Error(`未知敌人：${enemyId}`);
    const combatModifiers = { ...modifiers };
    if (combatModifiers.challenge && !CHALLENGE_AFFIX_DEFS[combatModifiers.affix]) {
      combatModifiers.affix = CHALLENGE_AFFIX_IDS[0];
    } else if (!CHALLENGE_AFFIX_DEFS[combatModifiers.affix]) {
      delete combatModifiers.affix;
    }
    const combatCheckpoint = this.pendingCombatStart;
    const checkpointMatches = Boolean(
      combatCheckpoint
      && combatCheckpoint.enemyId === enemyId
      && samePrimitiveRecord(combatCheckpoint.modifiers, combatModifiers)
    );
    const rewardSource = checkpointMatches ? {
      outcome: combatCheckpoint.outcome,
      enemyId,
      week: this.week,
      routeThreat: combatCheckpoint.outcome === "normal"
        && Number.isInteger(combatCheckpoint.routeThreat)
        && combatCheckpoint.routeThreat > 0
        ? combatCheckpoint.routeThreat
        : 0,
      bonusGold: combatCheckpoint.outcome === "normal"
        && combatCheckpoint.bonusGold === HIGH_THREAT_ROUTE_BONUS_GOLD
        ? HIGH_THREAT_ROUTE_BONUS_GOLD
        : 0
    } : null;
    const shouldGuaranteeTutorialOpening = this.semester === 1
      && this.week === 1
      && enemyId === "sleepyBug"
      && this.stats.combatsStarted === 0
      && !combatModifiers.challenge;
    this.stats.combatsStarted += 1;

    const tarot = this.tarot;
    const semesterHpScale = 1 + (this.semester - 1) * 0.15;
    const enemyMaxHp = Math.round(
      definition.maxHp
      * semesterHpScale
      * (combatModifiers.hpMultiplier || 1)
      * (tarot?.enemyHpMultiplier || 1)
    );
    const initialCharge = Math.min(
      this.pet.maxCharge,
      (this.hasItem("petSnack") ? 1 : 0)
      + (this.flags.petSnackCombats > 0 ? 1 : 0)
      + (tarot?.petCharge || 0)
    );
    this.pet.charge = initialCharge;
    if (this.flags.petSnackCombats > 0) this.flags.petSnackCombats -= 1;

    let drawPile = this.rng.shuffle(this.deck.map((card) => ({ ...card })));
    if (combatModifiers.affix === "backlog") {
      drawPile.push(this.createCard("todo"), this.createCard("todo"));
      drawPile = this.rng.shuffle(drawPile);
    }
    const tension = this.flags.nextCombatTension + (this.hasItem("allNighter") ? 2 : 0);
    for (let index = 0; index < tension; index += 1) {
      drawPile.push(this.createCard("nervous"));
    }
    if (tension) drawPile = this.rng.shuffle(drawPile);
    let tutorialOpening = false;
    if (shouldGuaranteeTutorialOpening) {
      const requiredIds = ["textbookStrike", "backpackGuard", this.archetype.specialCard];
      const openingCards = requiredIds.map((id) => drawPile.find((card) => card.id === id));
      if (openingCards.every(Boolean)) {
        const openingUids = new Set(openingCards.map((card) => card.uid));
        drawPile = drawPile.filter((card) => !openingUids.has(card.uid));
        drawPile.push(...openingCards.reverse());
        tutorialOpening = true;
      }
    }
    this.flags.nextCombatTension = 0;
    if (combatModifiers.challenge) this.stats.trialsAttempted += 1;

    const routeReward = rewardSource?.outcome === "normal"
      ? { routeThreat: rewardSource.routeThreat, bonusGold: rewardSource.bonusGold }
      : { routeThreat: 0, bonusGold: 0 };
    this.combat = {
      status: "active",
      result: null,
      modifiers: combatModifiers,
      rewardSource,
      victoryReceipt: null,
      rewardPrepared: false,
      routeThreat: routeReward.routeThreat,
      routeBonusGold: routeReward.bonusGold,
      turn: 0,
      tutorialOpening,
      startingHp: this.hp,
      cardsPlayed: 0,
      cardsPlayedThisTurn: 0,
      maxCardsPlayedInTurn: 0,
      damageDealt: 0,
      trialBonusGold: 0,
      enemy: {
        id: enemyId,
        name: definition.name,
        subtitle: definition.subtitle,
        maxHp: enemyMaxHp,
        hp: enemyMaxHp,
        block: (this.flags.nextEnemyBlock || 0) + (tarot?.enemyBlock || 0),
        intentTurn: 0,
        interruptDamageThisTurn: 0,
        examBlankState: "closed"
      },
      energy: 0,
      maxEnergy: 0,
      playerBlock: 0,
      drawPile,
      discardPile: [],
      exhaustPile: [],
      hand: [],
      pendingDiscard: 0,
      attackBonus: 0,
      nextDrawBonus: 0,
      nextDrawPenalty: 0,
      distracted: false,
      doubleNextAttack: false,
      endTurnHpLoss: 0,
      petUsed: false,
      petChargedThisTurn: false,
      petIncubationEvent: null,
      pencilUsed: false,
      notebookUsed: false,
      mistakeBookUsed: false,
      earplugsUsed: false,
      archetypeAttackUsed: false,
      archetypeZeroUsed: false,
      usedCardUids: new Set(),
      log: [
        `遭遇 ${definition.name}。它的行动会完全公开。`,
        ...(routeReward.bonusGold ? [`高压加练：胜利额外获得 ${routeReward.bonusGold} 校园币。`] : []),
        ...(tarot ? [`塔罗契约·${tarot.name}：${tarot.boon} 代价：${tarot.cost}`] : []),
        ...(combatModifiers.affix ? [`挑战词缀·${CHALLENGE_AFFIX_DEFS[combatModifiers.affix].name}：${CHALLENGE_AFFIX_DEFS[combatModifiers.affix].text}`] : []),
        ...(tutorialOpening ? ["新生首手保底：前 3 张依次为攻击、防御与主角特性牌。"] : [])
      ]
    };
    this.flags.nextEnemyBlock = 0;
    this.startPlayerTurn();
    return this.combat;
  }

  getIntent() {
    const combat = this.requireCombat();
    const definition = ENEMY_DEFS[combat.enemy.id];
    const raw = definition.intentAt
      ? definition.intentAt(combat.enemy.intentTurn)
      : definition.intents[combat.enemy.intentTurn % definition.intents.length];
    const resolved = this.resolveIntentScaling(raw);
    const { postScaleAttackBonus: rawPostScaleAttackBonus = 0, ...intent } = resolved;
    const postScaleAttackBonus = Math.max(0, nonNegativeInteger(rawPostScaleAttackBonus));
    const damageScale = this.semester - 1;
    const damageMultiplier = combat.modifiers.damageMultiplier || 1;
    const affixDamage = combat.modifiers.affix === "deadline" && combat.turn >= 4 ? 4 : 0;
    const tarotDamage = this.tarot?.enemyAttackBonus || 0;
    const attackBeforeInterrupt = intent.attack
      ? Math.round((intent.attack + damageScale) * damageMultiplier) + affixDamage + tarotDamage + postScaleAttackBonus
      : undefined;
    const rivalInterrupt = this.rivalInterruptState(attackBeforeInterrupt);
    const examBlank = this.finalExamBlankState(attackBeforeInterrupt);
    const counterplay = rivalInterrupt || examBlank;
    return {
      ...intent,
      attack: counterplay?.attackAfter ?? attackBeforeInterrupt,
      mechanicState: counterplay || intent.mechanicState
    };
  }

  rivalInterruptState(attackBefore = 0) {
    const combat = this.requireCombat();
    if (combat.enemy.id !== "rivalShadow") return null;
    const definition = ENEMY_DEFS.rivalShadow;
    const cap = Math.max(1, nonNegativeInteger(definition.interruptThreshold, 10));
    const sourceCount = Math.max(0, nonNegativeInteger(combat.enemy.interruptDamageThisTurn));
    const value = Math.min(cap, sourceCount);
    const triggered = value >= cap;
    const attackReduction = Math.max(0, nonNegativeInteger(definition.interruptAttackReduction, 3));
    const reduction = triggered
      ? attackReduction
      : 0;
    const normalizedAttack = Math.max(0, nonNegativeInteger(attackBefore));
    return {
      type: "rivalInterrupt",
      label: "打断内卷",
      value,
      cap,
      sourceCount,
      triggered,
      attackReduction,
      reduction,
      attackBefore: normalizedAttack,
      attackAfter: Math.max(0, normalizedAttack - reduction)
    };
  }

  finalExamBlankState(attackBefore = 0) {
    const combat = this.requireCombat();
    if (combat.enemy.id !== "finalExam" || combat.enemy.intentTurn % 4 !== 3) return null;
    const definition = ENEMY_DEFS.finalExam;
    const cap = Math.max(1, nonNegativeInteger(definition.blankArmor, 8));
    const state = ["open", "solved"].includes(combat.enemy.examBlankState)
      ? combat.enemy.examBlankState
      : "closed";
    const windowOpen = state !== "closed";
    const triggered = state === "solved";
    const remainingBlock = windowOpen
      ? Math.max(0, nonNegativeInteger(combat.enemy.block))
      : cap;
    const value = triggered
      ? cap
      : windowOpen
      ? Math.max(0, cap - Math.min(cap, remainingBlock))
      : 0;
    const attackReduction = Math.max(0, nonNegativeInteger(definition.blankBreakAttackReduction, 6));
    const normalizedAttack = Math.max(0, nonNegativeInteger(attackBefore));
    const reduction = triggered ? attackReduction : 0;
    return {
      type: "examBlank",
      label: "填空破题",
      state,
      windowOpen,
      value,
      cap,
      remainingBlock,
      triggered,
      attackReduction,
      reduction,
      attackBefore: normalizedAttack,
      attackAfter: Math.max(0, normalizedAttack - reduction)
    };
  }

  resolveIntentScaling(raw) {
    const combat = this.requireCombat();
    const scaling = raw?.scaling;
    if (!scaling) return { ...raw };

    const cap = Math.max(0, nonNegativeInteger(scaling.maxBonus));
    let value = 0;
    let sourceCount = 0;
    if (scaling.type === "statusHits") {
      const activeZones = [combat.hand, combat.drawPile, combat.discardPile];
      sourceCount = activeZones.reduce((total, zone) => (
        total + (Array.isArray(zone) ? zone.filter((card) => card?.id === scaling.statusId).length : 0)
      ), 0);
      value = Math.min(cap, sourceCount);
    } else if (scaling.type === "enemyBlockAttack") {
      sourceCount = Math.max(0, nonNegativeInteger(combat.enemy.block));
      value = Math.min(cap, sourceCount);
    } else {
      return { ...raw };
    }

    const resolved = {
      ...raw,
      name: `${raw.name} · ${scaling.label} ${value}/${cap}`,
      mechanicState: {
        type: scaling.type,
        label: scaling.label,
        value,
        cap,
        sourceCount
      }
    };
    if (scaling.type === "statusHits") resolved.hits = Math.max(1, nonNegativeInteger(raw.hits, 1)) + value;
    if (scaling.type === "enemyBlockAttack") resolved.postScaleAttackBonus = value;
    return resolved;
  }

  incomingDamagePreview() {
    const combat = this.requireCombat();
    const intent = this.getIntent();
    const perHit = Math.max(0, Number(intent.attack) || 0);
    const hits = perHit > 0 ? Math.max(1, nonNegativeInteger(intent.hits, 1)) : 0;
    const attackTotal = perHit * hits;
    const currentBlock = Math.max(0, nonNegativeInteger(combat.playerBlock));
    const currentHp = Math.max(0, nonNegativeInteger(this.hp));
    const queuedEndTurnHpLoss = Math.max(0, nonNegativeInteger(combat.endTurnHpLoss));
    const endTurnHpLoss = Math.min(currentHp, queuedEndTurnHpLoss);
    const enemyCanAct = endTurnHpLoss < currentHp;
    const blocked = enemyCanAct ? Math.min(currentBlock, attackTotal) : 0;
    const attackHpLoss = enemyCanAct
      ? Math.min(currentHp - endTurnHpLoss, Math.max(0, attackTotal - blocked))
      : 0;
    const totalHpLoss = endTurnHpLoss + attackHpLoss;
    return {
      perHit,
      hits,
      attackTotal,
      currentBlock,
      blocked,
      attackHpLoss,
      endTurnHpLoss,
      totalHpLoss,
      hpAfter: Math.max(0, this.hp - totalHpLoss),
      lethal: totalHpLoss >= this.hp
    };
  }

  startPlayerTurn() {
    const combat = this.requireCombat();
    combat.enemy.interruptDamageThisTurn = 0;
    combat.turn += 1;
    combat.cardsPlayedThisTurn = 0;
    combat.playerBlock = 0;
    combat.petChargedThisTurn = false;
    combat.pencilUsed = false;
    combat.notebookUsed = false;
    combat.energy = 3 + (this.hasItem("allNighter") ? 1 : 0) + (combat.turn === 1 ? this.tarot?.firstTurnEnergy || 0 : 0);
    if (combat.turn === 1 && this.hasItem("referenceBooks")) combat.energy -= 1;
    if (combat.turn === 1 && combat.modifiers.affix === "earlyClass") combat.energy -= 1;
    combat.maxEnergy = Math.max(0, combat.energy);

    const drawCount = Math.max(
      0,
      5
      + (this.hasItem("referenceBooks") ? 1 : 0)
      + (combat.turn === 1 && this.hasItem("silentPhone") ? 1 : 0)
      + (combat.turn === 1 ? this.tarot?.firstTurnDraw || 0 : 0)
      + combat.nextDrawBonus
      - combat.nextDrawPenalty
    );
    combat.nextDrawBonus = 0;
    combat.nextDrawPenalty = 0;
    const drawResult = this.drawCards(drawCount);

    if (combat.turn === 1 && this.hasItem("bandage") && this.hp * 2 <= this.maxHp) {
      combat.playerBlock += 6;
      combat.log.push("创可贴生效：获得 6 点护甲。");
    }
    if (combat.turn === 1 && this.hasItem("silentPhone")) {
      combat.log.push("静音手机生效：第一回合多抽 1 张牌。");
    }
    if (combat.turn === 1 && this.archetypeId === "cancer") {
      combat.playerBlock += 4;
      combat.log.push("巨蟹座命盘：获得 4 点护甲。");
    }
    if (combat.turn === 1 && combat.modifiers.affix === "earlyClass") {
      combat.log.push("第一节早课：本回合少 1 点能量。");
    }
    if (combat.turn === 1 && this.tarot) {
      combat.log.push(`塔罗·${this.tarot.name}生效：${this.tarot.boon}`);
    }
    combat.log.push(`第 ${combat.turn} 回合：抽 ${drawCount} 张牌，获得 ${combat.energy} 点能量。`);
    return drawResult;
  }

  drawCards(count) {
    const combat = this.requireCombat();
    const requested = nonNegativeInteger(count);
    const result = { requested, drawn: 0, reshuffles: [] };
    for (let index = 0; index < requested; index += 1) {
      if (!combat.drawPile.length) {
        if (!combat.discardPile.length) break;
        result.reshuffles.push({ moved: combat.discardPile.length });
        combat.drawPile = this.rng.shuffle(combat.discardPile);
        combat.discardPile = [];
        combat.log.push("弃牌堆洗回抽牌堆。");
      }
      combat.hand.push(combat.drawPile.pop());
      result.drawn += 1;
    }
    return result;
  }

  canPlay(card) {
    const combat = this.requireCombat();
    const definition = cardDefinition(card);
    if (combat.status !== "active") return { ok: false, reason: "战斗已经结束" };
    if (combat.pendingDiscard) return { ok: false, reason: "请先选择一张牌弃掉" };
    if (definition.effect.unplayable || definition.cost === null) return { ok: false, reason: "这张牌无法打出" };
    if (definition.cost > combat.energy) return { ok: false, reason: "能量不足" };
    return { ok: true };
  }

  cardEffectPreview(card, options = {}) {
    const combat = this.requireCombat();
    const definition = cardDefinition(card);
    const effect = definition.effect;
    const isAttackCard = definition.type === "attack";
    const distracted = typeof options.distracted === "boolean" ? options.distracted : combat.distracted;
    const damageModifiers = [];
    const blockModifiers = [];
    let baseDamage = effect.damage || 0;

    if (effect.safeDamage && !this.getIntent().attack) {
      baseDamage = effect.safeDamage;
      damageModifiers.push(`敌人未攻击：基础 ${baseDamage}`);
    }
    let damagePerHit = Math.max(
      0,
      baseDamage + (isAttackCard ? combat.attackBonus : 0) - (isAttackCard && distracted ? 2 : 0)
    );
    if (isAttackCard && combat.attackBonus) damageModifiers.push(`攻击加成 +${combat.attackBonus}`);
    if (isAttackCard && distracted) damageModifiers.push("走神 -2");

    const ariesBonus = Boolean(effect.damage && isAttackCard && this.archetypeId === "aries" && !combat.archetypeAttackUsed);
    if (ariesBonus) {
      damagePerHit += 2;
      damageModifiers.push("白羊首击 +2");
    }
    const pencilBonus = Boolean(effect.damage && isAttackCard && this.hasItem("autoPencil") && !combat.pencilUsed);
    if (pencilBonus) {
      damagePerHit += 1;
      damageModifiers.push("自动铅笔 +1");
    }

    let hits = effect.damage ? effect.hits || 1 : 0;
    const doubleAttack = Boolean(effect.damage && isAttackCard && combat.doubleNextAttack);
    if (doubleAttack) {
      hits *= 2;
      damageModifiers.push("双倍攻击");
    }
    const attackTotal = damagePerHit * hits;
    let remainingBlock = combat.enemy.block;
    let remainingHp = combat.enemy.hp;
    let enemyBlockAbsorbed = 0;
    let healthDamage = 0;
    for (let index = 0; index < hits && remainingHp > 0; index += 1) {
      const absorbed = Math.min(remainingBlock, damagePerHit);
      remainingBlock -= absorbed;
      enemyBlockAbsorbed += absorbed;
      const hitDamage = Math.min(damagePerHit - absorbed, remainingHp);
      remainingHp -= hitDamage;
      healthDamage += hitDamage;
    }

    const notebookBonus = Boolean(effect.block && this.hasItem("thickNotebook") && !combat.notebookUsed);
    const baseBlock = (effect.block || 0) + (notebookBonus ? 2 : 0);
    if (notebookBonus) blockModifiers.push("厚笔记本 +2");
    const statusCount = effect.exhaustStatuses
      ? combat.hand.filter((held) => CARD_DEFS[held.id].type === "status").length
      : 0;
    const statusBlock = statusCount * (effect.blockPerStatus || 0);
    if (statusBlock) blockModifiers.push(`清理 ${statusCount} 张状态 +${statusBlock}`);

    return {
      cost: definition.cost,
      hasDamage: Boolean(effect.damage),
      damagePerHit,
      hits,
      attackTotal,
      enemyBlockAbsorbed,
      healthDamage,
      baseBlock,
      statusBlock,
      block: baseBlock + statusBlock,
      selfDamage: effect.selfDamage || 0,
      ariesBonus,
      pencilBonus,
      doubleAttack,
      notebookBonus,
      statusCount,
      modifiers: [...damageModifiers, ...blockModifiers]
    };
  }

  clearDistractedFollowupPreview(card) {
    const combat = this.requireCombat();
    if (!combat.distracted || !combat.hand.includes(card)) return null;

    const clearDefinition = cardDefinition(card);
    if (!clearDefinition.effect.clearDistracted || clearDefinition.type === "attack" || !this.canPlay(card).ok) return null;
    const remainingEnergy = combat.energy - clearDefinition.cost;
    const enemyHp = Math.max(0, combat.enemy.hp);
    const hpAfterClear = this.hp - this.cardEffectPreview(card).selfDamage;
    if (hpAfterClear <= 0) return null;

    const candidates = combat.hand.flatMap((candidate, index) => {
      if (candidate === card) return [];
      const definition = cardDefinition(candidate);
      if (
        definition.type !== "attack"
        || !definition.effect.damage
        || definition.effect.unplayable
        || typeof definition.cost !== "number"
        || definition.cost > remainingEnergy
      ) return [];

      const before = this.cardEffectPreview(candidate, { distracted: true });
      const after = this.cardEffectPreview(candidate, { distracted: false });
      const attackGain = Math.max(0, after.attackTotal - before.attackTotal);
      const lethalBefore = enemyHp > 0 && before.healthDamage >= enemyHp;
      const lethalAfter = enemyHp > 0 && after.healthDamage >= enemyHp;
      if (!attackGain || lethalBefore || hpAfterClear - after.selfDamage <= 0) return [];

      return [{
        index,
        cardUid: candidate.uid,
        cardId: candidate.id,
        cardName: definition.displayName,
        cardCost: definition.cost,
        remainingEnergy,
        damagePerHitBefore: before.damagePerHit,
        damagePerHitAfter: after.damagePerHit,
        hits: after.hits,
        attackTotalBefore: before.attackTotal,
        attackTotalAfter: after.attackTotal,
        enemyBlockAbsorbedBefore: before.enemyBlockAbsorbed,
        enemyBlockAbsorbedAfter: after.enemyBlockAbsorbed,
        healthDamageBefore: before.healthDamage,
        healthDamageAfter: after.healthDamage,
        followupSelfDamage: after.selfDamage,
        attackGain,
        lethalBefore,
        lethalAfter
      }];
    });

    candidates.sort((left, right) => (
      Number(right.lethalAfter) - Number(left.lethalAfter)
      || Number(left.followupSelfDamage > 0) - Number(right.followupSelfDamage > 0)
      || right.attackGain - left.attackGain
      || right.attackTotalAfter - left.attackTotalAfter
      || left.index - right.index
    ));
    if (!candidates.length) return null;
    const [{ index: _index, ...best }] = candidates;
    return { ...best, attackCount: candidates.length };
  }

  playCard(uid) {
    const combat = this.requireCombat();
    const index = combat.hand.findIndex((card) => card.uid === uid);
    if (index < 0) return { ok: false, reason: "手牌中没有这张牌" };
    const card = combat.hand[index];
    const definition = cardDefinition(card);
    const allowed = this.canPlay(card);
    if (!allowed.ok) return allowed;
    const resolved = this.cardEffectPreview(card);
    const effect = definition.effect;
    const statusesToExhaust = new Set(effect.exhaustStatuses
      ? combat.hand
        .filter((held) => CARD_DEFS[held.id]?.type === "status")
      : []);

    combat.hand.splice(index, 1);
    combat.energy -= definition.cost;
    combat.usedCardUids.add(card.uid);
    combat.cardsPlayed += 1;
    combat.cardsPlayedThisTurn += 1;
    combat.maxCardsPlayedInTurn = Math.max(combat.maxCardsPlayedInTurn, combat.cardsPlayedThisTurn);
    this.stats.cardsPlayed += 1;
    this.stats.cardPlays[card.id] = (this.stats.cardPlays[card.id] || 0) + 1;
    const notes = [];
    const drawResults = [];

    if (definition.cost === 0 && this.archetypeId === "gemini" && !combat.archetypeZeroUsed) {
      combat.archetypeZeroUsed = true;
      drawResults.push(this.drawCards(1));
      notes.push("双子座命盘：抽 1 张牌");
    }

    if (effect.attackBonus) {
      combat.attackBonus += effect.attackBonus;
      notes.push(`攻击每段 +${effect.attackBonus}`);
    }
    if (effect.doubleNextAttack) {
      combat.doubleNextAttack = true;
      notes.push("下一张攻击牌触发两次");
    }
    if (effect.endTurnHpLoss) combat.endTurnHpLoss += effect.endTurnHpLoss;

    if (effect.damage) {
      const isAttackCard = definition.type === "attack";
      const damagePerHit = resolved.damagePerHit;
      if (resolved.ariesBonus) {
        combat.archetypeAttackUsed = true;
        notes.push("白羊座命盘 +2");
      }
      if (resolved.pencilBonus) {
        combat.pencilUsed = true;
        notes.push("自动铅笔 +1");
      }
      const hits = resolved.hits;
      if (resolved.doubleAttack) {
        combat.doubleNextAttack = false;
      }
      const total = this.damageEnemy(damagePerHit, hits);
      notes.push(`造成 ${total} 伤害`);

      const pet = this.getPetDefinition();
      const petChargeGain = Math.min(pet.chargePerFirstAttack, this.pet.maxCharge - this.pet.charge);
      if (isAttackCard && !combat.petChargedThisTurn && petChargeGain > 0) {
        combat.petChargedThisTurn = true;
        this.pet.charge += petChargeGain;
        notes.push(`${pet.shortName}充能 +${petChargeGain}`);
      }
    }

    if (effect.block) {
      const amount = resolved.baseBlock;
      if (resolved.notebookBonus) {
        combat.notebookUsed = true;
        notes.push("厚笔记本 +2");
      }
      combat.playerBlock += amount;
      notes.push(`获得 ${amount} 护甲`);
    }
    if (effect.selfDamage) {
      this.hp -= effect.selfDamage;
      this.stats.combatHpLost += effect.selfDamage;
      notes.push(`自己失去 ${effect.selfDamage} 生命`);
    }
    if (effect.draw) drawResults.push(this.drawCards(effect.draw));
    if (effect.nextDrawBonus) combat.nextDrawBonus += effect.nextDrawBonus;
    if (effect.nextDrawPenalty) combat.nextDrawPenalty += effect.nextDrawPenalty;
    if (effect.clearDistracted && combat.distracted) {
      combat.distracted = false;
      notes.push("移除走神");
    }
    if (effect.petCharge) {
      const previous = this.pet.charge;
      this.pet.charge = Math.min(this.pet.maxCharge, this.pet.charge + effect.petCharge);
      notes.push(`宠物充能 +${this.pet.charge - previous}`);
    }
    if (effect.exhaustStatuses) {
      const statuses = combat.hand.filter((held) => statusesToExhaust.has(held));
      combat.hand = combat.hand.filter((held) => !statusesToExhaust.has(held));
      combat.exhaustPile.push(...statuses);
      const extra = resolved.statusBlock;
      combat.playerBlock += extra;
      notes.push(`清理 ${statuses.length} 张状态牌，护甲 +${extra}`);
    }
    if (effect.discard) {
      // A draw-then-discard card may be the only card left in hand while both
      // piles are empty.  Only queue choices the player can actually make, or
      // pendingDiscard would permanently block every combat action.
      combat.pendingDiscard += Math.min(effect.discard, combat.hand.length);
    }

    if (effect.exhaust) combat.exhaustPile.push(card);
    else combat.discardPile.push(card);
    combat.log.push(`${definition.displayName}：${notes.length ? notes.join("，") : "效果生效"}。`);
    this.checkCombatEnd();
    return withVisibleDrawResult({ ok: true }, mergeDrawResults(drawResults));
  }

  discardCard(uid) {
    const combat = this.requireCombat();
    if (!combat.pendingDiscard) return { ok: false, reason: "现在不需要弃牌" };
    const index = combat.hand.findIndex((card) => card.uid === uid);
    if (index < 0) return { ok: false, reason: "手牌中没有这张牌" };
    const [card] = combat.hand.splice(index, 1);
    combat.discardPile.push(card);
    combat.pendingDiscard -= 1;
    combat.log.push(`弃掉 ${cardDefinition(card).displayName}。`);
    return { ok: true };
  }

  usePetSkill() {
    const combat = this.requireCombat();
    const pet = this.getPetDefinition();
    const { skill } = pet;
    if (combat.status !== "active") return { ok: false, reason: "战斗已经结束" };
    if (combat.pendingDiscard) return { ok: false, reason: "请先选择一张牌弃掉" };
    if (combat.petUsed) return { ok: false, reason: "本场已经用过宠物技能" };
    if (this.pet.charge < this.pet.maxCharge) return { ok: false, reason: "宠物充能未满" };
    if (combat.energy < skill.energyCost) return { ok: false, reason: `需要 ${skill.energyCost} 点能量` };

    combat.energy -= skill.energyCost;
    combat.petUsed = true;
    this.stats.petUses += 1;
    this.pet.charge = 0;
    const preview = this.petSkillPreview();
    const dealt = this.damageEnemy(preview.damage, 1);
    const notes = [`造成 ${dealt} 伤害`];
    let drawResult = null;
    if (preview.block) {
      combat.playerBlock += preview.block;
      notes.push(`获得 ${preview.block} 护甲`);
    }
    if (preview.draw) {
      drawResult = this.drawCards(preview.draw);
      notes.push(`抽 ${preview.draw} 张牌`);
    }
    if (preview.nextDrawBonus) {
      combat.nextDrawBonus += preview.nextDrawBonus;
      notes.push(`下回合多抽 ${preview.nextDrawBonus} 张`);
    }
    combat.log.push(`${pet.name}·${skill.name}：${notes.join("，")}。`);
    this.checkCombatEnd();
    return withVisibleDrawResult({ ok: true }, drawResult);
  }

  damageEnemy(perHit, hits) {
    const combat = this.requireCombat();
    const enemyBlockBefore = combat.enemy.block;
    let dealt = 0;
    for (let index = 0; index < hits; index += 1) {
      const absorbed = Math.min(combat.enemy.block, perHit);
      combat.enemy.block -= absorbed;
      const healthDamage = Math.min(perHit - absorbed, combat.enemy.hp);
      combat.enemy.hp -= healthDamage;
      dealt += healthDamage;
      if (combat.enemy.hp <= 0) break;
    }
    combat.enemy.hp = Math.max(0, combat.enemy.hp);
    combat.damageDealt += dealt;
    if (combat.enemy.id === "rivalShadow" && dealt > 0 && combat.enemy.hp > 0) {
      const definition = ENEMY_DEFS.rivalShadow;
      const cap = Math.max(1, nonNegativeInteger(definition.interruptThreshold, 10));
      const before = Math.min(cap, Math.max(0, nonNegativeInteger(combat.enemy.interruptDamageThisTurn)));
      combat.enemy.interruptDamageThisTurn = Math.min(cap, before + dealt);
      if (before < cap && combat.enemy.interruptDamageThisTurn >= cap) {
        combat.log.push(`打断内卷：本次公开攻击降低 ${definition.interruptAttackReduction} 点。`);
      }
    }
    if (
      combat.enemy.id === "finalExam"
      && combat.enemy.examBlankState === "open"
      && enemyBlockBefore > 0
      && combat.enemy.block === 0
      && combat.enemy.hp > 0
    ) {
      combat.enemy.examBlankState = "solved";
      combat.log.push(`填空破题：本次大题伤害降低 ${ENEMY_DEFS.finalExam.blankBreakAttackReduction} 点。`);
    }
    return dealt;
  }

  endTurn() {
    const combat = this.requireCombat();
    if (combat.status !== "active") return { ok: false, reason: "战斗已经结束" };
    if (combat.pendingDiscard) return { ok: false, reason: "请先完成弃牌" };
    const resolvedIntent = this.getIntent();
    const endTurnResult = { hpLossApplied: 0, lethal: false };

    for (const card of combat.hand) {
      const effect = cardDefinition(card).effect;
      if (effect.exhaustAtEnd) combat.exhaustPile.push(card);
      else combat.discardPile.push(card);
    }
    combat.hand = [];
    if (combat.endTurnHpLoss) {
      const hpLossApplied = Math.min(
        Math.max(0, nonNegativeInteger(this.hp)),
        Math.max(0, nonNegativeInteger(combat.endTurnHpLoss))
      );
      this.hp -= hpLossApplied;
      this.stats.combatHpLost += hpLossApplied;
      endTurnResult.hpLossApplied = hpLossApplied;
      combat.log.push(`情绪内耗：失去 ${hpLossApplied} 点生命。`);
      combat.endTurnHpLoss = 0;
    }
    if (this.hp <= 0) {
      this.checkCombatEnd();
      endTurnResult.lethal = true;
      return { ok: true, endTurnResult, enemyResult: null };
    }
    combat.distracted = false;
    const enemyResult = this.executeEnemyTurn(resolvedIntent);
    const drawResult = combat.status === "active" ? this.startPlayerTurn() : null;
    return withVisibleDrawResult({ ok: true, endTurnResult, enemyResult }, drawResult);
  }

  executeEnemyTurn(resolvedIntent = null) {
    const combat = this.requireCombat();
    const currentIntent = resolvedIntent || this.getIntent();
    const intent = Object.freeze({
      ...currentIntent,
      addStatus: currentIntent.addStatus ? Object.freeze({ ...currentIntent.addStatus }) : undefined,
      mechanicState: currentIntent.mechanicState
        ? Object.freeze({ ...currentIntent.mechanicState })
        : undefined
    });
    const notes = [];
    const result = {
      intentName: intent.name,
      mechanicState: intent.mechanicState ? { ...intent.mechanicState } : null,
      attack: null,
      block: null,
      debuff: null,
      statusAdded: null,
      triggers: []
    };
    combat.enemy.block = 0;

    if (intent.attack) {
      const hits = intent.hits || 1;
      let totalHealthDamage = 0;
      let totalBlocked = 0;
      const segments = [];
      for (let index = 0; index < hits; index += 1) {
        if (this.hp <= 0) break;
        const absorbed = Math.min(combat.playerBlock, intent.attack);
        combat.playerBlock -= absorbed;
        totalBlocked += absorbed;
        const healthDamage = Math.min(
          Math.max(0, nonNegativeInteger(this.hp)),
          intent.attack - absorbed
        );
        this.hp -= healthDamage;
        totalHealthDamage += healthDamage;
        segments.push({
          index: index + 1,
          blocked: absorbed,
          hpLoss: healthDamage,
          blockAfter: combat.playerBlock
        });
      }
      result.attack = {
        perHit: intent.attack,
        hits,
        hitsResolved: segments.length,
        blocked: totalBlocked,
        healthDamage: totalHealthDamage,
        segments
      };
      notes.push(`攻击造成 ${totalHealthDamage} 点生命伤害`);
      this.stats.combatHpLost += totalHealthDamage;
      if (totalHealthDamage > 0 && this.hasItem("mistakeBook") && !combat.mistakeBookUsed) {
        combat.mistakeBookUsed = true;
        combat.nextDrawBonus += 1;
        result.triggers.push({ id: "mistakeBook", effect: "nextDraw", amount: 1 });
        notes.push("错题本：下回合多抽 1 张");
      }
    }
    if (intent.block) {
      combat.enemy.block += intent.block;
      result.block = { gained: intent.block };
      notes.push(`获得 ${intent.block} 护甲`);
    }
    if (combat.enemy.id === "finalExam" && combat.enemy.intentTurn % 4 === 2) {
      combat.enemy.examBlankState = "open";
    }
    if (intent.debuff) {
      if (this.hasItem("earplugs") && !combat.earplugsUsed) {
        combat.earplugsUsed = true;
        result.debuff = { id: intent.debuff, applied: false, blockedBy: "earplugs" };
        notes.push("耳塞抵挡了走神");
      } else if (intent.debuff === "distracted") {
        combat.distracted = true;
        result.debuff = { id: intent.debuff, applied: true, blockedBy: null };
        notes.push("施加走神：下回合攻击每段 -2");
      }
    }
    if (intent.addStatus) {
      const destination = intent.addStatus.zone === "draw" ? combat.drawPile : combat.discardPile;
      for (let index = 0; index < intent.addStatus.count; index += 1) {
        destination.push(this.createCard(intent.addStatus.id));
      }
      if (intent.addStatus.zone === "draw") combat.drawPile = this.rng.shuffle(combat.drawPile);
      result.statusAdded = { id: intent.addStatus.id, count: intent.addStatus.count, zone: intent.addStatus.zone };
      notes.push(`加入 ${intent.addStatus.count} 张${CARD_DEFS[intent.addStatus.id].name}`);
    }
    if (combat.enemy.id === "finalExam" && combat.enemy.intentTurn % 4 === 3) {
      combat.enemy.examBlankState = "closed";
    }
    combat.log.push(`${combat.enemy.name}·${intent.name}：${notes.join("，") || "观察了你一会儿"}。`);
    combat.enemy.intentTurn += 1;
    this.checkCombatEnd();
    return result;
  }

  checkCombatEnd() {
    const combat = this.requireCombat();
    if (this.hp <= 0 && combat.status === "active") {
      this.hp = 0;
      combat.status = "lost";
      combat.result = "lost";
      this.stats.combatsCompleted += 1;
      this.stats.combatTurns += combat.turn;
      combat.log.push("体力耗尽，本次挑战结束。");
    } else if (combat.enemy.hp <= 0 && combat.status === "active") {
      combat.status = "won";
      combat.result = "won";
      combat.victoryReceipt = combat.rewardSource ? { ...combat.rewardSource } : null;
      this.stats.combatsCompleted += 1;
      this.stats.combatsWon += 1;
      if (combat.modifiers.challenge) this.stats.challengeWins += 1;
      const trial = this.challengeTrialStatus();
      if (trial?.completed && !combat.trialBonusGold) {
        combat.trialBonusGold = trial.bonusGold;
        this.gold += trial.bonusGold;
        this.stats.trialsCompleted += 1;
        combat.log.push(`星座试炼·${trial.name}完成：校园币 +${trial.bonusGold}。`);
      }
      this.stats.combatTurns += combat.turn;
      const pet = this.getPetDefinition();
      this.pet.bond += pet.victoryBond;
      this.updatePetMilestone();
      this.advanceIncubatorAfterVictory(combat);
      for (const uid of combat.usedCardUids) {
        if (this.deck.some((card) => card.uid === uid)) {
          this.cardCombatUses[uid] = (this.cardCombatUses[uid] || 0) + 1;
        }
      }
      combat.log.push(`胜利！${pet.name}羁绊 +${pet.victoryBond}（当前 ${this.pet.bond}）。`);
    }
    return combat.status;
  }

  combatSummary() {
    const combat = this.requireCombat();
    const enemy = ENEMY_DEFS[combat.enemy.id];
    return {
      enemyId: combat.enemy.id,
      enemyName: combat.enemy.name,
      enemyKind: enemy.kind,
      challenge: Boolean(combat.modifiers.challenge),
      challengeAffix: combat.modifiers.affix || null,
      challengeTrial: this.challengeTrialStatus(),
      challengeTrialBonus: combat.trialBonusGold,
      routeThreat: combat.routeThreat || 0,
      routeBonusGold: combat.routeBonusGold || 0,
      result: combat.result,
      turns: combat.turn,
      cardsPlayed: combat.cardsPlayed,
      damageDealt: combat.damageDealt,
      hpLost: Math.max(0, combat.startingHp - this.hp),
      petUsed: combat.petUsed,
      petIncubationEvent: combat.petIncubationEvent ? { ...combat.petIncubationEvent } : null,
      hatchedPetId: combat.petIncubationEvent?.type === "hatched"
        ? combat.petIncubationEvent.petId
        : null
    };
  }

  prepareSemesterRewards(itemIds = []) {
    if (this.week !== 16 || this.awaitingNextSemester) return null;
    if (this.pendingSemesterReward) {
      return { ...this.pendingSemesterReward, itemChoices: [...(this.pendingSemesterReward.itemChoices || [])], started: false };
    }
    if (this.pendingCombatStart || this.pendingShop || this.pendingRest) return null;
    this.gold += 50;
    const itemChoices = [...new Set(itemIds)]
      .filter((id) => ITEM_DEFS[id]?.rarity === "boss" && !this.hasItem(id));
    let fallbackGold = 0;
    if (itemChoices.length) {
      this.pendingSemesterReward = { stage: "bossItem", itemChoices };
    } else {
      fallbackGold = this.claimItemRewardFallback("boss")?.gold || 0;
      this.pendingSemesterReward = { stage: "summaryUpgrade", itemChoices: [], fallbackGold };
    }
    return { ...this.pendingSemesterReward, itemChoices: [...this.pendingSemesterReward.itemChoices], started: true };
  }

  advanceSemesterRewards() {
    if (this.pendingSemesterReward?.stage !== "bossItem" || this.pendingItemReplacement) return false;
    this.pendingSemesterReward = { stage: "summaryUpgrade", itemChoices: [], fallbackGold: 0 };
    return true;
  }

  completeCurrentSemester() {
    if (this.week !== 16) return false;
    this.pendingSemesterReward = null;
    this.pendingCombatReward = null;
    this.pendingCombatStart = null;
    this.pendingEventReward = null;
    this.pendingShop = null;
    this.pendingRest = null;
    this.pendingItemReplacement = null;
    this.pendingEventId = null;
    this.awaitingNextSemester = true;
    return true;
  }

  startNextSemester() {
    this.semester += 1;
    this.tarotId = null;
    this.week = 1;
    this.awaitingNextSemester = false;
    this.pendingSemesterReward = null;
    this.pendingCombatReward = null;
    this.pendingCombatStart = null;
    this.pendingEventReward = null;
    this.pendingShop = null;
    this.pendingRest = null;
    this.pendingItemReplacement = null;
    this.lastEventId = null;
    this.pendingEventId = null;
    this.completedNodes.clear();
    this.cardCombatUses = {};
    this.flags.eraserUsed = false;
    this.flags.tarotRestUsed = false;
    this.backpackCapacity = Math.min(12, this.backpackCapacity + 1);
    this.maxHp += 2;
    this.hp = this.maxHp;
    this.combat = null;
    this.semesterPlan = this.generateSemesterPlan();
  }

  toJSON() {
    return {
      version: 2,
      rngState: this.rng.state,
      cardSerial: this.cardSerial,
      archetypeId: this.archetypeId,
      tarotId: this.tarotId,
      semester: this.semester,
      week: this.week,
      awaitingNextSemester: this.awaitingNextSemester,
      pendingSemesterReward: this.pendingSemesterReward ? {
        ...this.pendingSemesterReward,
        itemChoices: [...(this.pendingSemesterReward.itemChoices || [])]
      } : null,
      pendingCombatReward: this.pendingCombatReward ? {
        ...this.pendingCombatReward,
        choices: [...(this.pendingCombatReward.choices || [])],
        itemChoices: [...(this.pendingCombatReward.itemChoices || [])],
        usedCardUids: [...(this.pendingCombatReward.usedCardUids || [])]
      } : null,
      pendingCombatStart: this.pendingCombatStart ? {
        ...this.pendingCombatStart,
        modifiers: { ...(this.pendingCombatStart.modifiers || {}) }
      } : null,
      pendingEventReward: this.pendingEventReward ? {
        ...this.pendingEventReward,
        choices: [...(this.pendingEventReward.choices || [])],
        cardUids: [...(this.pendingEventReward.cardUids || [])],
        itemChoices: [...(this.pendingEventReward.itemChoices || [])]
      } : null,
      pendingShop: this.pendingShop ? {
        ...this.pendingShop,
        cards: this.pendingShop.cards.map((stock) => ({ ...stock })),
        items: this.pendingShop.items.map((stock) => ({ ...stock }))
      } : null,
      pendingRest: this.pendingRest ? {
        ...this.pendingRest,
        cardUids: [...(this.pendingRest.cardUids || [])]
      } : null,
      pendingItemReplacement: this.pendingItemReplacement ? { ...this.pendingItemReplacement } : null,
      lastEventId: this.lastEventId,
      pendingEventId: this.pendingEventId,
      maxHp: this.maxHp,
      hp: this.hp,
      gold: this.gold,
      deck: this.deck.map((card) => ({ ...card })),
      items: [...this.items],
      backpackCapacity: this.backpackCapacity,
      pet: { ...this.pet },
      pets: Object.fromEntries(
        this.ownedPetIds().map((id) => [id, { ...this.pets[id] }])
      ),
      activePetId: this.activePetId,
      incubator: this.incubator ? { ...this.incubator } : null,
      cardCombatUses: { ...this.cardCombatUses },
      cardCombatUsesSemester: this.semester,
      flags: { ...this.flags },
      rewardIndex: this.rewardIndex,
      tutorialSeen: this.tutorialSeen,
      semesterPlan: this.semesterPlan.map((nodes) => nodes.map((node) => ({ ...node }))),
      stats: {
        ...this.stats,
        cardPlays: { ...this.stats.cardPlays },
        challengeRewardChoices: { ...this.stats.challengeRewardChoices }
      }
    };
  }

  static fromJSON(data) {
    if (!data || data.version !== 2 || !ARCHETYPE_DEFS[data.archetypeId]) {
      throw new Error("存档版本不兼容");
    }
    const game = new SemesterGame(1, data.archetypeId);
    const loadRepairs = [];
    game.rng.state = Number(data.rngState) >>> 0;
    game.cardSerial = Math.min(1_000_000_000, nonNegativeInteger(data.cardSerial));
    game.tarotId = TAROT_DEFS[data.tarotId] ? data.tarotId : null;
    game.semester = Math.max(1, Number(data.semester) || 1);
    game.week = Math.min(16, Math.max(1, Number(data.week) || 1));
    game.awaitingNextSemester = data.awaitingNextSemester === true && game.week === 16;
    if (data.awaitingNextSemester !== undefined
      && (typeof data.awaitingNextSemester !== "boolean" || (data.awaitingNextSemester && game.week !== 16))) {
      loadRepairs.push("重置异常学期完成状态");
    }
    game.lastEventId = EVENT_DEFS[data.lastEventId] ? data.lastEventId : null;
    game.pendingEventId = null;
    if (data.lastEventId !== undefined && data.lastEventId !== null && !game.lastEventId) {
      loadRepairs.push("重置异常上一事件记录");
    }
    const savedSemesterReward = data.pendingSemesterReward;
    game.pendingSemesterReward = null;
    if (!game.awaitingNextSemester && game.week === 16 && savedSemesterReward && typeof savedSemesterReward === "object") {
      if (savedSemesterReward.stage === "bossItem") {
        const itemChoices = Array.isArray(savedSemesterReward.itemChoices)
          ? [...new Set(savedSemesterReward.itemChoices)]
            .filter((id) => ITEM_DEFS[id]?.rarity === "boss")
          : [];
        if (itemChoices.length) game.pendingSemesterReward = { stage: "bossItem", itemChoices };
      } else if (savedSemesterReward.stage === "summaryUpgrade") {
        game.pendingSemesterReward = {
          stage: "summaryUpgrade",
          itemChoices: [],
          fallbackGold: nonNegativeInteger(savedSemesterReward.fallbackGold)
        };
      }
    }
    if (savedSemesterReward !== undefined && savedSemesterReward !== null && !game.pendingSemesterReward) {
      loadRepairs.push("重置异常期末奖励状态");
    }
    const savedCombatReward = data.pendingCombatReward;
    game.pendingCombatReward = null;
    const savedCombatStart = data.pendingCombatStart;
    game.pendingCombatStart = null;
    const savedEventReward = data.pendingEventReward;
    game.pendingEventReward = null;
    const savedShop = data.pendingShop;
    game.pendingShop = null;
    const savedRest = data.pendingRest;
    game.pendingRest = null;
    const savedItemReplacement = data.pendingItemReplacement;
    game.pendingItemReplacement = null;
    const savedCombatChoices = Array.isArray(savedCombatReward?.choices)
      ? [...new Set(savedCombatReward.choices)].filter((id) => {
        const card = CARD_DEFS[id];
        return card && (!card.archetype || card.archetype === game.archetypeId);
      }).slice(0, 3)
      : [];
    const savedExclusiveChoices = savedCombatChoices
      .filter((id) => ARCHETYPE_CARD_IDS[game.archetypeId].includes(id));
    if (!game.awaitingNextSemester && !game.pendingSemesterReward && game.week < 16) {
      if (savedCombatReward?.type === "normalCard" && savedCombatChoices.length) {
        const savedBonusGold = savedCombatReward.bonusGold === HIGH_THREAT_ROUTE_BONUS_GOLD
          ? HIGH_THREAT_ROUTE_BONUS_GOLD
          : 0;
        const breakdownIsValid = savedCombatReward.gold === NORMAL_COMBAT_REWARD_GOLD + savedBonusGold;
        const bonusGold = breakdownIsValid ? savedBonusGold : 0;
        const gold = NORMAL_COMBAT_REWARD_GOLD + bonusGold;
        game.pendingCombatReward = { type: "normalCard", choices: savedCombatChoices, gold, bonusGold };
      } else if (game.week === 8 && savedCombatReward?.type === "eliteChain"
        && ["card", "item", "enchant"].includes(savedCombatReward.stage)) {
        const itemChoices = Array.isArray(savedCombatReward.itemChoices)
          ? [...new Set(savedCombatReward.itemChoices)]
            .filter((id) => REGULAR_ITEM_IDS.includes(id) && ITEM_DEFS[id])
            .slice(0, 2)
          : [];
        const usedCardUids = Array.isArray(savedCombatReward.usedCardUids)
          ? [...new Set(savedCombatReward.usedCardUids)]
            .filter((uid) => typeof uid === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(uid))
            .slice(0, 64)
          : [];
        const stageIsValid = savedCombatReward.stage === "enchant"
          || (savedCombatReward.stage === "card" && savedCombatChoices.length)
          || (savedCombatReward.stage === "item" && itemChoices.length);
        if (stageIsValid) {
          game.pendingCombatReward = {
            type: "eliteChain",
            stage: savedCombatReward.stage,
            choices: savedCombatReward.stage === "card" ? savedCombatChoices : [],
            itemChoices: savedCombatReward.stage === "item" ? itemChoices : [],
            usedCardUids,
            fallbackGold: savedCombatReward.stage === "enchant"
              ? nonNegativeInteger(savedCombatReward.fallbackGold)
              : 0
          };
        }
      } else if (!FIXED_ROUTE_WEEKS.has(game.week) && savedCombatReward?.type === "challengeChain"
        && ["route", "card", "item", "complete"].includes(savedCombatReward.stage)
        && CHALLENGE_AFFIX_DEFS[savedCombatReward.affix]) {
        const route = CHALLENGE_REWARD_DEFS[savedCombatReward.route]
          ? savedCombatReward.route
          : null;
        const enemyId = ENEMY_DEFS[savedCombatReward.enemyId] ? savedCombatReward.enemyId : null;
        const expectedSignatureItemId = enemyId
          ? CHALLENGE_SIGNATURE_ITEM_DROPS[enemyId] || null
          : null;
        const savedReplacementIncoming = savedItemReplacement?.incoming;
        const preserveLegacyRegularReplacement = savedCombatReward.signatureItemId === undefined
          && savedCombatReward.stage === "item"
          && route === "item"
          && savedItemReplacement?.source === "combat"
          && REGULAR_ITEM_IDS.includes(savedReplacementIncoming)
          && Array.isArray(savedCombatReward.itemChoices)
          && savedCombatReward.itemChoices.includes(savedReplacementIncoming);
        const inferLegacySignature = savedCombatReward.signatureItemId === undefined
          && ["route", "item"].includes(savedCombatReward.stage)
          && !preserveLegacyRegularReplacement;
        const signatureItemId = expectedSignatureItemId
          && (savedCombatReward.signatureItemId === expectedSignatureItemId || inferLegacySignature)
          ? expectedSignatureItemId
          : null;
        const allowedChallengeItems = new Set([
          ...REGULAR_ITEM_IDS,
          ...(signatureItemId ? [signatureItemId] : [])
        ]);
        const itemChoices = Array.isArray(savedCombatReward.itemChoices)
          ? [...new Set(savedCombatReward.itemChoices)]
            .filter((id) => allowedChallengeItems.has(id) && ITEM_DEFS[id])
            .slice(0, CHALLENGE_REWARD_DEFS.item.itemChoices)
          : [];
        const challengeEgg = enemyId ? eggDefinitionForEnemy(enemyId) : null;
        const eggId = challengeEgg?.id === savedCombatReward.eggId ? challengeEgg.id : null;
        const rewardVariant = savedCombatReward.rewardVariant === "egg" && eggId
          ? "egg"
          : savedCombatReward.rewardVariant === "mastery"
            ? "mastery"
            : "bond";
        const savedFallbackGold = nonNegativeInteger(savedCombatReward.fallbackGold);
        const stageIsValid = (savedCombatReward.stage === "route"
          && (savedCombatReward.route === null || savedCombatReward.route === undefined))
          || (savedCombatReward.stage === "card" && route === "cards" && savedExclusiveChoices.length)
          || (savedCombatReward.stage === "item" && route === "item" && itemChoices.length)
          || (savedCombatReward.stage === "complete" && ((route === "pet"
              && (rewardVariant !== "mastery"
                || savedFallbackGold === CHALLENGE_REWARD_DEFS.pet.masteryFallbackGold))
            || (route === "item"
              && savedFallbackGold === CHALLENGE_REWARD_DEFS.item.fallbackGold)));
        if (stageIsValid) {
          const trialCompleted = savedCombatReward.trialCompleted === true;
          game.pendingCombatReward = {
            type: "challengeChain",
            stage: savedCombatReward.stage,
            route,
            affix: savedCombatReward.affix,
            enemyId,
            eggId,
            rewardVariant,
            signatureItemId,
            trialCompleted,
            trialBonus: trialCompleted ? ARCHETYPE_TRIAL_DEFS[game.archetypeId].bonusGold : 0,
            choices: savedCombatReward.stage === "card" ? savedExclusiveChoices : [],
            itemChoices: savedCombatReward.stage === "item" ? itemChoices : [],
            usedCardUids: [],
            fallbackGold: savedCombatReward.stage === "complete"
              ? route === "item"
                ? CHALLENGE_REWARD_DEFS.item.fallbackGold
                : route === "pet" && rewardVariant === "mastery"
                  ? CHALLENGE_REWARD_DEFS.pet.masteryFallbackGold
                  : 0
              : 0
          };
        }
      } else if (!FIXED_ROUTE_WEEKS.has(game.week) && savedCombatReward?.type === "eventItem"
        && ["item", "complete"].includes(savedCombatReward.stage)) {
        const itemChoices = Array.isArray(savedCombatReward.itemChoices)
          ? [...new Set(savedCombatReward.itemChoices)]
            .filter((id) => REGULAR_ITEM_IDS.includes(id) && ITEM_DEFS[id])
            .slice(0, 2)
          : [];
        const stageIsValid = (savedCombatReward.stage === "item" && itemChoices.length)
          || (savedCombatReward.stage === "complete"
            && nonNegativeInteger(savedCombatReward.fallbackGold) === ITEM_REWARD_FALLBACK_GOLD.event);
        if (stageIsValid) {
          game.pendingCombatReward = {
            type: "eventItem",
            stage: savedCombatReward.stage,
            choices: [],
            itemChoices: savedCombatReward.stage === "item" ? itemChoices : [],
            usedCardUids: [],
            fallbackGold: savedCombatReward.stage === "complete"
              ? ITEM_REWARD_FALLBACK_GOLD.event
              : 0
          };
        }
      }
    }
    if (savedCombatReward !== undefined && savedCombatReward !== null && !game.pendingCombatReward) {
      loadRepairs.push("重置异常战斗奖励状态");
    }
    game.maxHp = Math.max(1, Number(data.maxHp) || 50);
    game.hp = Math.min(game.maxHp, Math.max(1, Number(data.hp) || 1));
    game.gold = Math.max(0, Number(data.gold) || 0);
    const usedUids = new Set();
    let removedSavedCards = 0;
    let repairedUids = 0;
    let removedEnchantments = 0;
    let addedStarterCards = 0;
    let rebuiltDeck = false;
    const nextCardUid = () => {
      let uid;
      do {
        game.cardSerial += 1;
        uid = `c${game.cardSerial}`;
      } while (usedUids.has(uid));
      usedUids.add(uid);
      return uid;
    };
    game.deck = [];
    if (Array.isArray(data.deck)) {
      for (const savedCard of data.deck) {
        const definition = savedCard && CARD_DEFS[savedCard.id];
        if (!definition || definition.type === "status") {
          removedSavedCards += 1;
          continue;
        }
        const savedUid = typeof savedCard.uid === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(savedCard.uid)
          ? savedCard.uid
          : null;
        const keepSavedUid = savedUid && !usedUids.has(savedUid);
        let uid = keepSavedUid ? savedUid : nextCardUid();
        if (!keepSavedUid) repairedUids += 1;
        if (savedUid && uid === savedUid) {
          usedUids.add(uid);
          const serialMatch = /^c(\d{1,10})$/.exec(uid);
          if (serialMatch) game.cardSerial = Math.max(game.cardSerial, Number(serialMatch[1]));
        }
        const card = { id: savedCard.id, uid, upgraded: savedCard.upgraded === true, enchantment: null };
        const enchantment = ENCHANTMENT_DEFS[savedCard.enchantment];
        if (enchantment?.archetype === data.archetypeId && game.canEnchant(card)) {
          card.enchantment = savedCard.enchantment;
        } else if (savedCard.enchantment) {
          removedEnchantments += 1;
        }
        game.deck.push(card);
      }
    }
    const starterIds = startingDeckFor(data.archetypeId);
    if (!game.deck.length) {
      game.deck = starterIds.map((id) => game.createCard(id));
      rebuiltDeck = true;
    } else {
      let fillIndex = 0;
      while (game.deck.length < 5) {
        game.deck.push(game.createCard(starterIds[fillIndex % starterIds.length]));
        fillIndex += 1;
        addedStarterCards += 1;
      }
    }
    if (removedSavedCards) loadRepairs.push(`移除 ${removedSavedCards} 张无效或临时牌`);
    if (rebuiltDeck) loadRepairs.push("重建完整初始卡组");
    else if (addedStarterCards) loadRepairs.push(`补入 ${addedStarterCards} 张基础牌`);
    if (repairedUids) loadRepairs.push(`修复 ${repairedUids} 个卡牌编号`);
    if (removedEnchantments) loadRepairs.push(`移除 ${removedEnchantments} 个无效刻印`);
    game.backpackCapacity = Math.min(12, Math.max(6, Number(data.backpackCapacity) || 6));
    game.items = Array.isArray(data.items)
      ? [...new Set(data.items.filter((id) => ITEM_DEFS[id]))].slice(0, game.backpackCapacity)
      : [];
    if (Array.isArray(data.items) && data.items.length !== game.items.length) {
      loadRepairs.push(`清理 ${data.items.length - game.items.length} 个重复或无效物品`);
    } else if (data.items !== undefined && !Array.isArray(data.items)) {
      loadRepairs.push("重置异常物品列表");
    }
    const savedPet = data.pet && typeof data.pet === "object" && !Array.isArray(data.pet) ? data.pet : {};
    const savedPets = data.pets && typeof data.pets === "object" && !Array.isArray(data.pets)
      ? data.pets
      : null;
    const restoredPets = {};
    let petRosterRepaired = data.pets !== undefined && data.pets !== null && !savedPets;
    if (savedPets) {
      for (const [savedId, rawPet] of Object.entries(savedPets)) {
        const keyId = canonicalPetId(savedId);
        const isPetObject = rawPet && typeof rawPet === "object" && !Array.isArray(rawPet);
        const hasRawId = isPetObject && Object.hasOwn(rawPet, "id");
        const rawId = isPetObject ? canonicalPetId(rawPet.id) : null;
        const id = keyId && isPetObject && (!hasRawId || rawId === keyId) ? keyId : null;
        if (!id || restoredPets[id]) {
          petRosterRepaired = true;
          continue;
        }
        restoredPets[id] = sanitizePetState(rawPet, id);
      }
    }

    const legacyPetId = canonicalPetId(savedPet.id) || DEFAULT_PET_ID;
    if (!savedPets) {
      restoredPets[legacyPetId] = sanitizePetState(savedPet, legacyPetId);
    }
    if (!restoredPets[DEFAULT_PET_ID]) {
      restoredPets[DEFAULT_PET_ID] = createPetState(DEFAULT_PET_ID);
      if (savedPets) petRosterRepaired = true;
    }

    let activePetId = canonicalPetId(data.activePetId);
    if (!activePetId || !restoredPets[activePetId]) {
      activePetId = restoredPets[legacyPetId] ? legacyPetId : DEFAULT_PET_ID;
      if (data.activePetId !== undefined && data.activePetId !== activePetId) petRosterRepaired = true;
    }
    const legacySnapshotMatchesActive = !savedPet.id || canonicalPetId(savedPet.id) === activePetId;
    if (savedPets && legacySnapshotMatchesActive) {
      restoredPets[activePetId] = sanitizePetState(savedPet, activePetId);
    } else if (savedPets && Object.keys(savedPet).length && !legacySnapshotMatchesActive) {
      petRosterRepaired = true;
    }
    game.pets = restoredPets;
    game.activePetId = activePetId;
    game.pet = game.pets[game.activePetId];
    if (petRosterRepaired) loadRepairs.push("清理异常宠物名册或当前伙伴");

    game.incubator = null;
    if (data.incubator !== undefined && data.incubator !== null) {
      const egg = PET_EGG_DEFS[data.incubator?.eggId];
      const battles = nonNegativeInteger(data.incubator?.battles);
      const incubatorIsValid = egg && !game.hasPet(egg.petId)
        && Number.isInteger(data.incubator?.battles)
        && battles < egg.requiredCombats;
      if (incubatorIsValid) game.incubator = { eggId: egg.id, battles };
      else loadRepairs.push("清理异常宠物孵化状态");
    }

    const pendingChallenge = game.pendingCombatReward?.type === "challengeChain"
      ? game.pendingCombatReward
      : null;
    if (pendingChallenge?.stage === "route") {
      const expectedPetReward = game.challengePetRewardState(pendingChallenge.enemyId);
      if (pendingChallenge.rewardVariant !== expectedPetReward.rewardVariant
        || pendingChallenge.eggId !== expectedPetReward.eggId) {
        pendingChallenge.rewardVariant = expectedPetReward.rewardVariant;
        pendingChallenge.eggId = expectedPetReward.eggId;
        loadRepairs.push("修正挑战伙伴奖励状态");
      }
    }
    if (pendingChallenge?.signatureItemId && game.hasItem(pendingChallenge.signatureItemId)) {
      pendingChallenge.signatureItemId = null;
      loadRepairs.push("修正已拥有的挑战招牌物品奖励");
    }
    if (pendingChallenge?.stage === "item") {
      const savedItemChoices = [...pendingChallenge.itemChoices];
      if (pendingChallenge.signatureItemId) {
        pendingChallenge.itemChoices = [pendingChallenge.signatureItemId];
      } else {
        pendingChallenge.itemChoices = pendingChallenge.itemChoices
          .filter((id) => REGULAR_ITEM_IDS.includes(id) && !game.hasItem(id));
      }
      if (JSON.stringify(savedItemChoices) !== JSON.stringify(pendingChallenge.itemChoices)) {
        loadRepairs.push("修正挑战物品候选");
      }
      if (!pendingChallenge.itemChoices.length) {
        game.pendingCombatReward = null;
        loadRepairs.push("重置无可领取物品的挑战奖励");
      }
    }
    const deckUids = new Set(game.deck.map((card) => card.uid));
    if (game.pendingCombatReward?.type === "eliteChain") {
      const savedCandidateCount = game.pendingCombatReward.usedCardUids.length;
      game.pendingCombatReward.usedCardUids = game.pendingCombatReward.usedCardUids
        .filter((uid) => deckUids.has(uid));
      if (game.pendingCombatReward.usedCardUids.length !== savedCandidateCount) {
        loadRepairs.push("清理异常精英刻印候选");
      }
    }
    let repairedEventCandidates = false;
    const canRestoreEventReward = !game.awaitingNextSemester
      && !game.pendingSemesterReward
      && !game.pendingCombatReward
      && !FIXED_ROUTE_WEEKS.has(game.week)
      && savedEventReward
      && typeof savedEventReward === "object";
    if (canRestoreEventReward && savedEventReward.type === "card"
      && EVENT_CARD_REWARD_SOURCES[savedEventReward.source]) {
      const rawChoices = Array.isArray(savedEventReward.choices) ? savedEventReward.choices : [];
      const filter = EVENT_CARD_REWARD_SOURCES[savedEventReward.source];
      const choices = [...new Set(rawChoices)].filter((id) => {
        const card = CARD_DEFS[id];
        if (!card || (card.archetype && card.archetype !== game.archetypeId)) return false;
        if (filter === "uncommon") return card.rarity === "uncommon";
        if (filter === "attack") return card.type === "attack";
        return card.type !== "attack" && card.type !== "status";
      }).slice(0, 3);
      if (choices.length) {
        game.pendingEventReward = {
          type: "card",
          source: savedEventReward.source,
          choices,
          cardUids: [],
          itemChoices: []
        };
        repairedEventCandidates = choices.length !== rawChoices.length;
      }
    } else if (canRestoreEventReward
      && ["upgrade", "remove"].includes(savedEventReward.type)
      && EVENT_DECK_REWARD_SOURCES[savedEventReward.source] === savedEventReward.type) {
      const rawCardUids = Array.isArray(savedEventReward.cardUids) ? savedEventReward.cardUids : [];
      const cardUids = [...new Set(rawCardUids)].filter((uid) => {
        if (!deckUids.has(uid)) return false;
        if (savedEventReward.type === "upgrade") {
          const card = game.deck.find((candidate) => candidate.uid === uid);
          return card && !card.upgraded && !["nervous", "todo"].includes(card.id);
        }
        return game.deck.length > 5;
      }).slice(0, 64);
      if (cardUids.length) {
        game.pendingEventReward = {
          type: savedEventReward.type,
          source: savedEventReward.source,
          choices: [],
          cardUids,
          itemChoices: []
        };
        repairedEventCandidates = cardUids.length !== rawCardUids.length;
      }
    } else if (canRestoreEventReward && savedEventReward.type === "item"
      && EVENT_ITEM_REWARD_SOURCES.has(savedEventReward.source)) {
      const rawItemChoices = Array.isArray(savedEventReward.itemChoices) ? savedEventReward.itemChoices : [];
      const itemChoices = [...new Set(rawItemChoices)]
        .filter((id) => ITEM_DEFS[id]?.rarity === "common" && !game.hasItem(id))
        .slice(0, 1);
      if (itemChoices.length) {
        game.pendingEventReward = {
          type: "item",
          source: savedEventReward.source,
          choices: [],
          cardUids: [],
          itemChoices
        };
        repairedEventCandidates = itemChoices.length !== rawItemChoices.length;
      }
    }
    if (savedEventReward !== undefined && savedEventReward !== null && !game.pendingEventReward) {
      loadRepairs.push("重置异常事件奖励状态");
    } else if (repairedEventCandidates) {
      loadRepairs.push("清理异常事件奖励候选");
    }
    const canRestorePendingEvent = !game.awaitingNextSemester
      && !game.pendingSemesterReward
      && !game.pendingCombatReward
      && !game.pendingEventReward
      && !game.pet.pendingMilestone
      && !FIXED_ROUTE_WEEKS.has(game.week)
      && game.tarotId
      && EVENT_DEFS[data.pendingEventId];
    if (canRestorePendingEvent) {
      if (game.lastEventId && game.lastEventId !== data.pendingEventId) {
        loadRepairs.push("同步当前事件与上一事件记录");
      }
      game.pendingEventId = data.pendingEventId;
      game.lastEventId = data.pendingEventId;
    } else if (data.pendingEventId !== undefined && data.pendingEventId !== null) {
      loadRepairs.push("重置异常待处理事件");
    }
    const savedUseEntries = data.cardCombatUses && typeof data.cardCombatUses === "object"
      ? Object.entries(data.cardCombatUses)
      : [];
    const hasUseSemesterMarker = Object.hasOwn(data, "cardCombatUsesSemester");
    const useSemesterMatches = Number.isSafeInteger(data.cardCombatUsesSemester)
      && data.cardCombatUsesSemester === game.semester;
    const canRestoreUseProgress = useSemesterMatches
      || (!hasUseSemesterMarker && game.semester === 1);
    const sanitizedUseProgress = data.cardCombatUses && typeof data.cardCombatUses === "object"
      ? Object.fromEntries(
        savedUseEntries
          .filter(([uid]) => deckUids.has(uid))
          .map(([uid, count]) => [uid, nonNegativeInteger(count)])
      )
      : {};
    game.cardCombatUses = canRestoreUseProgress ? sanitizedUseProgress : {};
    if (!canRestoreUseProgress) {
      loadRepairs.push("重置异常或跨学期主力进度");
    } else if (savedUseEntries.length !== Object.keys(game.cardCombatUses).length
      || savedUseEntries.some(([uid, count]) => deckUids.has(uid) && count !== nonNegativeInteger(count))) {
      loadRepairs.push("清理异常卡牌使用记录");
    }
    const savedFlags = data.flags && typeof data.flags === "object" ? data.flags : {};
    game.flags = {
      nextCombatTension: nonNegativeInteger(savedFlags.nextCombatTension),
      nextEnemyBlock: nonNegativeInteger(savedFlags.nextEnemyBlock),
      petSnackCombats: nonNegativeInteger(savedFlags.petSnackCombats),
      nextShopHalf: savedFlags.nextShopHalf === true,
      eraserUsed: savedFlags.eraserUsed === true,
      tarotRestUsed: savedFlags.tarotRestUsed === true
    };
    const numericFlagKeys = ["nextCombatTension", "nextEnemyBlock", "petSnackCombats"];
    const booleanFlagKeys = ["nextShopHalf", "eraserUsed", "tarotRestUsed"];
    const knownFlagKeys = new Set([...numericFlagKeys, ...booleanFlagKeys]);
    const flagsRepaired = numericFlagKeys.some((key) => Object.hasOwn(savedFlags, key)
      && savedFlags[key] !== game.flags[key])
      || booleanFlagKeys.some((key) => Object.hasOwn(savedFlags, key)
        && (typeof savedFlags[key] !== "boolean" || savedFlags[key] !== game.flags[key]))
      || Object.keys(savedFlags).some((key) => !knownFlagKeys.has(key));
    if (flagsRepaired) loadRepairs.push("清理异常临时状态");
    game.rewardIndex = Math.max(0, Number(data.rewardIndex) || 0);
    game.tutorialSeen = Boolean(data.tutorialSeen);
    const savedRngState = game.rng.state;
    game.semesterPlan = normalizeSemesterPlan(data.semesterPlan) || game.generateSemesterPlan();
    game.rng.state = savedRngState;
    if (data.stats && typeof data.stats === "object") {
      const defaults = game.stats;
      const numericStats = Object.fromEntries(
        Object.entries(defaults)
          .filter(([, value]) => typeof value === "number")
          .map(([key]) => [key, nonNegativeInteger(data.stats[key], defaults[key])])
      );
      game.stats = {
        ...defaults,
        ...numericStats,
        cardPlays: data.stats.cardPlays && typeof data.stats.cardPlays === "object"
          ? Object.fromEntries(
            Object.entries(data.stats.cardPlays)
              .filter(([id]) => CARD_DEFS[id])
              .map(([id, count]) => [id, nonNegativeInteger(count)])
          )
          : {},
        tarotChoices: Object.fromEntries(
          TAROT_IDS.map((id) => [
            id,
            nonNegativeInteger(data.stats.tarotChoices?.[id])
          ])
        ),
        challengeRewardChoices: Object.fromEntries(
          Object.keys(CHALLENGE_REWARD_DEFS).map((id) => [
            id,
            nonNegativeInteger(data.stats.challengeRewardChoices?.[id])
          ])
        )
      };
    }
    if (savedShop !== undefined && savedShop !== null) {
      let restoredShop = null;
      const rawCards = Array.isArray(savedShop?.cards) ? savedShop.cards : [];
      const rawItems = Array.isArray(savedShop?.items) ? savedShop.items : [];
      const cards = rawCards.filter((stock) => stock && typeof stock.sold === "boolean"
        && CARD_DEFS[stock.id] && (!CARD_DEFS[stock.id].archetype || CARD_DEFS[stock.id].archetype === game.archetypeId))
        .map((stock) => ({ id: stock.id, sold: stock.sold }));
      const items = rawItems.filter((stock) => stock && typeof stock.sold === "boolean"
        && REGULAR_ITEM_IDS.includes(stock.id) && ITEM_DEFS[stock.id])
        .map((stock) => ({ id: stock.id, sold: stock.sold }));
      const cardIds = new Set(cards.map((stock) => stock.id));
      const itemIds = new Set(items.map((stock) => stock.id));
      const cardPoolIsValid = cards.length === 3 && cardIds.size === 3
        && cards.filter((stock) => ARCHETYPE_CARD_IDS[game.archetypeId].includes(stock.id)).length === 1
        && cards.filter((stock) => PUBLIC_REWARD_CARD_IDS.includes(stock.id)).length === 2;
      const itemPoolIsValid = items.length <= 2 && itemIds.size === items.length
        && items.every((stock) => stock.sold || !game.hasItem(stock.id));
      const canRestoreShop = !game.awaitingNextSemester && !game.pendingSemesterReward
        && !game.pendingCombatReward && !game.pendingEventReward && !game.pendingEventId
        && !game.pet.pendingMilestone && (savedCombatStart === undefined || savedCombatStart === null)
        && !FIXED_ROUTE_WEEKS.has(game.week) && game.tarotId
        && game.semesterPlan[game.week]?.some((node) => node.type === "shop")
        && savedShop.removePrice === 75 + (game.semester - 1) * 15
        && typeof savedShop.removed === "boolean" && cardPoolIsValid && itemPoolIsValid;
      if (canRestoreShop) {
        restoredShop = {
          cards,
          items,
          removePrice: savedShop.removePrice,
          removed: savedShop.removed
        };
      }
      game.pendingShop = restoredShop;
      if (!restoredShop) loadRepairs.push("重置异常商店状态");
    }
    if (savedItemReplacement !== undefined && savedItemReplacement !== null) {
      let restoredItemReplacement = null;
      const incoming = savedItemReplacement?.incoming;
      const source = savedItemReplacement?.source;
      const frozenPrice = savedItemReplacement?.price;
      const regularRewardSourceIsValid = ["combat", "event", "semester"].includes(source)
        && game.itemRewardSourceFor(incoming) === source
        && (savedShop === undefined || savedShop === null);
      const shopSourceIsValid = source === "shop"
        && game.itemRewardSourceFor(incoming) === "shop"
        && Number.isSafeInteger(frozenPrice) && frozenPrice > 0
        && frozenPrice === game.shopPrice("item", incoming)
        && game.gold >= frozenPrice;
      const canRestoreItemReplacement = (regularRewardSourceIsValid || shopSourceIsValid)
        && ITEM_DEFS[incoming] && !game.hasItem(incoming)
        && game.items.length >= game.backpackCapacity
        && !game.pendingCombatStart && !game.pendingEventId && !game.pet.pendingMilestone
        && (savedCombatStart === undefined || savedCombatStart === null)
        && (savedRest === undefined || savedRest === null);
      if (canRestoreItemReplacement) {
        restoredItemReplacement = {
          incoming,
          source,
          ...(source === "shop" ? { price: frozenPrice } : {})
        };
      }
      game.pendingItemReplacement = restoredItemReplacement;
      if (!restoredItemReplacement) loadRepairs.push("重置异常物品替换状态");
    }
    if (savedRest !== undefined && savedRest !== null) {
      let restoredRest = null;
      const stage = typeof savedRest?.stage === "string" ? savedRest.stage : "";
      const rawCardUids = Array.isArray(savedRest?.cardUids) ? savedRest.cardUids : [];
      const uniqueCardUids = [...new Set(rawCardUids)].filter((uid) => deckUids.has(uid));
      let expectedCardUids = null;
      let stageIsValid = false;
      let restDetails = {};
      if (stage === "choice") {
        expectedCardUids = [];
        stageIsValid = true;
      } else if (stage === "upgrade") {
        expectedCardUids = game.deck.filter((card) => !card.upgraded).map((card) => card.uid);
        stageIsValid = expectedCardUids.length > 0;
      } else if (stage === "pet") {
        expectedCardUids = [];
        stageIsValid = Boolean(game.pet.pendingMilestone) && savedRest.bond === 2 && savedRest.healed === 0;
        restDetails = { bond: 2, healed: 0 };
      } else if (stage === "tarotRemove") {
        expectedCardUids = game.deck.map((card) => card.uid);
        stageIsValid = game.tarot?.rest.action === "remove" && game.flags.tarotRestUsed && game.deck.length > 5;
      } else if (stage === "tarotUpgrade") {
        expectedCardUids = game.deck.filter((card) => !card.upgraded).map((card) => card.uid);
        stageIsValid = game.tarot?.rest.action === "upgrade" && game.flags.tarotRestUsed && expectedCardUids.length > 0;
      } else if (stage === "tarotBond") {
        expectedCardUids = [];
        stageIsValid = game.tarot?.rest.action === "bond" && game.flags.tarotRestUsed
          && Boolean(game.pet.pendingMilestone) && savedRest.bond === game.tarot.rest.bond
          && Number.isInteger(savedRest.healed) && savedRest.healed >= 0
          && savedRest.healed <= game.tarot.rest.heal;
        restDetails = { bond: savedRest.bond, healed: savedRest.healed };
      }
      const candidateSetIsValid = expectedCardUids !== null
        && rawCardUids.length === expectedCardUids.length
        && uniqueCardUids.length === expectedCardUids.length
        && expectedCardUids.every((uid) => uniqueCardUids.includes(uid));
      const milestoneStateIsValid = ["pet", "tarotBond"].includes(stage)
        ? Boolean(game.pet.pendingMilestone)
        : !game.pet.pendingMilestone;
      const canRestoreRest = !game.awaitingNextSemester && !game.pendingSemesterReward
        && !game.pendingCombatReward && !game.pendingCombatStart && !game.pendingEventReward
        && !game.pendingEventId && !game.pendingShop
        && (savedCombatStart === undefined || savedCombatStart === null)
        && !FIXED_ROUTE_WEEKS.has(game.week) && game.tarotId
        && game.semesterPlan[game.week]?.some((node) => node.type === "rest")
        && stageIsValid && candidateSetIsValid && milestoneStateIsValid;
      if (canRestoreRest) restoredRest = { stage, cardUids: [...expectedCardUids], ...restDetails };
      game.pendingRest = restoredRest;
      if (!restoredRest) loadRepairs.push("重置异常休息节点状态");
    }
    if (savedCombatStart !== undefined && savedCombatStart !== null) {
      const restoredCombatStart = savedCombatStart && typeof savedCombatStart === "object"
        ? game.prepareCombatStart(savedCombatStart.enemyId, savedCombatStart.outcome, savedCombatStart.modifiers)
        : null;
      if (!restoredCombatStart) loadRepairs.push("重置异常战斗开局检查点");
    }
    game.completedNodes = new Set();
    game.combat = null;
    game.loadRepairs = loadRepairs;
    return game;
  }

  requireCombat() {
    if (!this.combat) throw new Error("当前没有战斗");
    return this.combat;
  }
}

export { STARTING_DECK, startingDeckFor };
