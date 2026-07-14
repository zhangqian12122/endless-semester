import {
  ARCHETYPE_DEFS,
  CARD_DEFS,
  ENCHANTMENT_DEFS,
  ENEMY_DEFS,
  ITEM_DEFS,
  NORMAL_ENEMY_IDS,
  PET_TALENT_DEFS,
  REGULAR_ITEM_IDS,
  PUBLIC_REWARD_CARD_IDS,
  ARCHETYPE_CARD_IDS
} from "./game-data.js";

const STARTING_DECK_CORE = [
  "textbookStrike", "textbookStrike", "textbookStrike", "textbookStrike",
  "backpackGuard", "backpackGuard", "backpackGuard", "backpackGuard",
  "cramming"
];

const FIXED_ROUTE_WEEKS = new Set([1, 2, 8, 16]);

function makeRouteNode(type, week, options = {}) {
  if (type === "combat") {
    const enemy = options.enemy;
    const fixedLabels = {
      1: "教学战：瞌睡虫",
      2: "宠物教学：作业团",
      8: "期中精英：卷王幻影",
      16: "期末Boss：期末考试"
    };
    return { type, enemy, label: fixedLabels[week] || `普通战斗：${ENEMY_DEFS[enemy].name}` };
  }
  if (type === "event") {
    const pool = options.pool === "safe" ? "safe" : "all";
    return { type, pool, label: pool === "safe" ? "？ 低风险校园事件" : "？ 未知事件" };
  }
  if (type === "rest") return { type, label: "休息节点" };
  return { type: "shop", label: "校园商店" };
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
      if (!raw || !["combat", "event", "rest", "shop"].includes(raw.type) || types.has(raw.type)) return null;
      types.add(raw.type);
      if (raw.type === "combat") {
        if (!ENEMY_DEFS[raw.enemy]) return null;
        if (!FIXED_ROUTE_WEEKS.has(week) && ENEMY_DEFS[raw.enemy].kind !== "normal") return null;
        plan[week].push(makeRouteNode("combat", week, { enemy: raw.enemy }));
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
  return plan;
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
  constructor(seed = Date.now(), archetypeId = "cancer") {
    this.rng = new SeededRandom(seed);
    this.cardSerial = 0;
    this.resetCampaign(archetypeId);
  }

  resetCampaign(archetypeId = "cancer") {
    if (!ARCHETYPE_DEFS[archetypeId]) throw new Error(`未知星座学生：${archetypeId}`);
    this.archetypeId = archetypeId;
    this.semester = 1;
    this.week = 1;
    this.maxHp = 50;
    this.hp = 50;
    this.gold = 50;
    this.deck = startingDeckFor(archetypeId).map((id) => this.createCard(id));
    this.items = [];
    this.backpackCapacity = 6;
    this.pet = {
      name: "暴躁鹅",
      bond: 0,
      charge: 0,
      maxCharge: 2,
      talent: null,
      talentLevel: 0,
      pendingMilestone: null
    };
    this.stats = {
      combatsStarted: 0,
      combatsCompleted: 0,
      combatsWon: 0,
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
      eraserUsed: false
    };
    this.completedNodes = new Set();
    this.rewardIndex = 0;
    this.tutorialSeen = false;
    this.combat = null;
    this.semesterPlan = this.generateSemesterPlan();
  }

  get archetype() {
    return ARCHETYPE_DEFS[this.archetypeId];
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

  randomEnemy() {
    return this.rng.pick(NORMAL_ENEMY_IDS);
  }

  generateSemesterPlan() {
    const plan = Array.from({ length: 17 }, () => []);
    plan[1] = [makeRouteNode("combat", 1, { enemy: "sleepyBug" })];
    plan[2] = [makeRouteNode("combat", 2, { enemy: "homeworkBlob" })];
    plan[8] = [makeRouteNode("combat", 8, { enemy: "rivalShadow" })];
    plan[16] = [makeRouteNode("combat", 16, { enemy: "finalExam" })];

    const anchors = {
      3: { type: "event", pool: "safe" },
      4: { type: "combat", enemy: "phoneSpirit" },
      5: { type: "rest" },
      6: { type: "combat", enemy: "alarmClock" },
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
    for (const week of Object.keys(anchors).map(Number)) {
      const anchor = anchors[week];
      const anchorNode = makeRouteNode(anchor.type, week, {
        enemy: anchor.type === "combat" ? (anchor.enemy || this.randomEnemy()) : undefined,
        pool: anchor.pool
      });
      let candidates = ["combat", "combat", "event", "event", "rest", "shop"]
        .filter((type) => type !== anchor.type)
        .filter((type) => type !== "rest" || restOptions < 4)
        .filter((type) => type !== "shop" || shopOptions < 3);
      if (!candidates.length) candidates = ["combat", "event"].filter((type) => type !== anchor.type);
      const alternateType = this.rng.pick(candidates);
      if (alternateType === "rest") restOptions += 1;
      if (alternateType === "shop") shopOptions += 1;
      const alternateNode = makeRouteNode(alternateType, week, {
        enemy: alternateType === "combat" ? this.randomEnemy() : undefined,
        pool: week <= 3 ? "safe" : "all"
      });
      plan[week] = this.rng.shuffle([anchorNode, alternateNode]);
    }
    return plan;
  }

  randomItem({ rarity, allowBoss = false } = {}) {
    const pool = (allowBoss ? Object.keys(ITEM_DEFS) : REGULAR_ITEM_IDS)
      .filter((id) => !this.hasItem(id))
      .filter((id) => !rarity || ITEM_DEFS[id].rarity === rarity);
    return pool.length ? this.rng.pick(pool) : null;
  }

  petSkillPreview() {
    const talent = this.pet.talent ? PET_TALENT_DEFS[this.pet.talent] : null;
    const level = Math.min(3, Math.max(0, Number(this.pet.talentLevel) || 0));
    const levelEffect = talent && level > 0 ? talent.levels[level - 1] : {};
    return {
      damage: 7 + (levelEffect.damageBonus || 0),
      block: levelEffect.block || 0,
      draw: levelEffect.draw || 0,
      nextDrawBonus: levelEffect.nextDrawBonus || 0,
      talent,
      level,
      text: levelEffect.text || "造成 7 点伤害。"
    };
  }

  updatePetMilestone() {
    if (this.pet.pendingMilestone) return this.pet.pendingMilestone;
    if (!this.pet.talent && this.pet.bond >= 3) this.pet.pendingMilestone = "choose";
    else if (this.pet.talent && this.pet.talentLevel < 2 && this.pet.bond >= 10) this.pet.pendingMilestone = "upgrade";
    else if (this.pet.talent && this.pet.talentLevel < 3 && this.pet.bond >= 25) this.pet.pendingMilestone = "master";
    return this.pet.pendingMilestone;
  }

  resolvePetMilestone(talentId = null) {
    const milestone = this.pet.pendingMilestone;
    if (milestone === "choose") {
      if (!PET_TALENT_DEFS[talentId]) return false;
      this.pet.talent = talentId;
      this.pet.talentLevel = 1;
    } else if (milestone === "upgrade" || milestone === "master") {
      if (!PET_TALENT_DEFS[this.pet.talent]) return false;
      this.pet.talentLevel = Math.min(3, this.pet.talentLevel + 1);
    } else {
      return false;
    }
    this.pet.pendingMilestone = null;
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

  eligibleSummaryCards() {
    return this.deck.filter((card) => !card.upgraded && (this.cardCombatUses[card.uid] || 0) >= 3);
  }

  startCombat(enemyId, modifiers = {}) {
    if (enemyId === "random") enemyId = this.randomEnemy();
    const definition = ENEMY_DEFS[enemyId];
    if (!definition) throw new Error(`未知敌人：${enemyId}`);
    this.stats.combatsStarted += 1;

    const semesterHpScale = 1 + (this.semester - 1) * 0.15;
    const enemyMaxHp = Math.round(definition.maxHp * semesterHpScale * (modifiers.hpMultiplier || 1));
    const initialCharge = Math.min(
      this.pet.maxCharge,
      (this.hasItem("petSnack") ? 1 : 0) + (this.flags.petSnackCombats > 0 ? 1 : 0)
    );
    this.pet.charge = initialCharge;
    if (this.flags.petSnackCombats > 0) this.flags.petSnackCombats -= 1;

    let drawPile = this.rng.shuffle(this.deck.map((card) => ({ ...card })));
    const tension = this.flags.nextCombatTension + (this.hasItem("allNighter") ? 2 : 0);
    for (let index = 0; index < tension; index += 1) {
      drawPile.push(this.createCard("nervous"));
    }
    if (tension) drawPile = this.rng.shuffle(drawPile);
    this.flags.nextCombatTension = 0;

    this.combat = {
      status: "active",
      result: null,
      modifiers,
      turn: 0,
      startingHp: this.hp,
      cardsPlayed: 0,
      damageDealt: 0,
      enemy: {
        id: enemyId,
        name: definition.name,
        subtitle: definition.subtitle,
        maxHp: enemyMaxHp,
        hp: enemyMaxHp,
        block: this.flags.nextEnemyBlock || 0,
        intentTurn: 0
      },
      energy: 0,
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
      pencilUsed: false,
      notebookUsed: false,
      mistakeBookUsed: false,
      earplugsUsed: false,
      archetypeAttackUsed: false,
      archetypeZeroUsed: false,
      usedCardUids: new Set(),
      log: [`遭遇 ${definition.name}。它的行动会完全公开。`]
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
    const damageScale = this.semester - 1;
    return {
      ...raw,
      attack: raw.attack ? raw.attack + damageScale : undefined
    };
  }

  startPlayerTurn() {
    const combat = this.requireCombat();
    combat.turn += 1;
    combat.playerBlock = 0;
    combat.petChargedThisTurn = false;
    combat.pencilUsed = false;
    combat.notebookUsed = false;
    combat.energy = 3 + (this.hasItem("allNighter") ? 1 : 0);
    if (combat.turn === 1 && this.hasItem("referenceBooks")) combat.energy -= 1;

    const drawCount = Math.max(
      0,
      5 + (this.hasItem("referenceBooks") ? 1 : 0) + combat.nextDrawBonus - combat.nextDrawPenalty
    );
    combat.nextDrawBonus = 0;
    combat.nextDrawPenalty = 0;
    this.drawCards(drawCount);

    if (combat.turn === 1 && this.hasItem("bandage") && this.hp * 2 < this.maxHp) {
      combat.playerBlock += 6;
      combat.log.push("创可贴生效：获得 6 点护甲。");
    }
    if (combat.turn === 1 && this.archetypeId === "cancer") {
      combat.playerBlock += 4;
      combat.log.push("巨蟹座命盘：获得 4 点护甲。");
    }
    combat.log.push(`第 ${combat.turn} 回合：抽 ${drawCount} 张牌，获得 ${combat.energy} 点能量。`);
  }

  drawCards(count) {
    const combat = this.requireCombat();
    for (let index = 0; index < count; index += 1) {
      if (!combat.drawPile.length) {
        if (!combat.discardPile.length) break;
        combat.drawPile = this.rng.shuffle(combat.discardPile);
        combat.discardPile = [];
        combat.log.push("弃牌堆洗回抽牌堆。");
      }
      combat.hand.push(combat.drawPile.pop());
    }
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

  playCard(uid) {
    const combat = this.requireCombat();
    const index = combat.hand.findIndex((card) => card.uid === uid);
    if (index < 0) return { ok: false, reason: "手牌中没有这张牌" };
    const card = combat.hand[index];
    const definition = cardDefinition(card);
    const allowed = this.canPlay(card);
    if (!allowed.ok) return allowed;

    combat.hand.splice(index, 1);
    combat.energy -= definition.cost;
    combat.usedCardUids.add(card.uid);
    combat.cardsPlayed += 1;
    this.stats.cardsPlayed += 1;
    this.stats.cardPlays[card.id] = (this.stats.cardPlays[card.id] || 0) + 1;
    const effect = definition.effect;
    const notes = [];

    if (definition.cost === 0 && this.archetypeId === "gemini" && !combat.archetypeZeroUsed) {
      combat.archetypeZeroUsed = true;
      this.drawCards(1);
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
      let baseDamage = effect.damage;
      const intent = this.getIntent();
      if (effect.safeDamage && !intent.attack) baseDamage = effect.safeDamage;
      let damagePerHit = Math.max(
        0,
        baseDamage + (isAttackCard ? combat.attackBonus : 0) - (isAttackCard && combat.distracted ? 2 : 0)
      );
      if (isAttackCard && this.archetypeId === "aries" && !combat.archetypeAttackUsed) {
        combat.archetypeAttackUsed = true;
        damagePerHit += 2;
        notes.push("白羊座命盘 +2");
      }
      if (isAttackCard && this.hasItem("autoPencil") && !combat.pencilUsed) {
        combat.pencilUsed = true;
        damagePerHit += 1;
        notes.push("自动铅笔 +1");
      }
      let hits = effect.hits || 1;
      if (isAttackCard && combat.doubleNextAttack) {
        hits *= 2;
        combat.doubleNextAttack = false;
      }
      const total = this.damageEnemy(damagePerHit, hits);
      notes.push(`造成 ${total} 伤害`);

      if (isAttackCard && !combat.petChargedThisTurn && this.pet.charge < this.pet.maxCharge) {
        combat.petChargedThisTurn = true;
        this.pet.charge += 1;
        notes.push("暴躁鹅充能 +1");
      }
    }

    if (effect.block) {
      let amount = effect.block;
      if (this.hasItem("thickNotebook") && !combat.notebookUsed) {
        amount += 2;
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
    if (effect.draw) this.drawCards(effect.draw);
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
      const statuses = combat.hand.filter((held) => CARD_DEFS[held.id].type === "status");
      combat.hand = combat.hand.filter((held) => CARD_DEFS[held.id].type !== "status");
      combat.exhaustPile.push(...statuses);
      const extra = statuses.length * effect.blockPerStatus;
      combat.playerBlock += extra;
      notes.push(`清理 ${statuses.length} 张状态牌，护甲 +${extra}`);
    }
    if (effect.discard) combat.pendingDiscard += effect.discard;

    if (effect.exhaust) combat.exhaustPile.push(card);
    else combat.discardPile.push(card);
    combat.log.push(`${definition.displayName}：${notes.length ? notes.join("，") : "效果生效"}。`);
    this.checkCombatEnd();
    return { ok: true };
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
    if (combat.status !== "active") return { ok: false, reason: "战斗已经结束" };
    if (combat.petUsed) return { ok: false, reason: "本场已经用过宠物技能" };
    if (this.pet.charge < this.pet.maxCharge) return { ok: false, reason: "宠物充能未满" };
    if (combat.energy < 1) return { ok: false, reason: "需要 1 点能量" };

    combat.energy -= 1;
    combat.petUsed = true;
    this.stats.petUses += 1;
    this.pet.charge = 0;
    const preview = this.petSkillPreview();
    const dealt = this.damageEnemy(preview.damage, 1);
    const notes = [`造成 ${dealt} 伤害`];
    if (preview.block) {
      combat.playerBlock += preview.block;
      notes.push(`获得 ${preview.block} 护甲`);
    }
    if (preview.draw) {
      this.drawCards(preview.draw);
      notes.push(`抽 ${preview.draw} 张牌`);
    }
    if (preview.nextDrawBonus) {
      combat.nextDrawBonus += preview.nextDrawBonus;
      notes.push(`下回合多抽 ${preview.nextDrawBonus} 张`);
    }
    combat.log.push(`暴躁鹅·追着啄：${notes.join("，")}。`);
    this.checkCombatEnd();
    return { ok: true };
  }

  damageEnemy(perHit, hits) {
    const combat = this.requireCombat();
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
    return dealt;
  }

  endTurn() {
    const combat = this.requireCombat();
    if (combat.status !== "active") return { ok: false, reason: "战斗已经结束" };
    if (combat.pendingDiscard) return { ok: false, reason: "请先完成弃牌" };

    for (const card of combat.hand) {
      const effect = cardDefinition(card).effect;
      if (effect.exhaustAtEnd) combat.exhaustPile.push(card);
      else combat.discardPile.push(card);
    }
    combat.hand = [];
    if (combat.endTurnHpLoss) {
      this.hp -= combat.endTurnHpLoss;
      this.stats.combatHpLost += combat.endTurnHpLoss;
      combat.log.push(`情绪内耗：失去 ${combat.endTurnHpLoss} 点生命。`);
      combat.endTurnHpLoss = 0;
    }
    if (this.hp <= 0) {
      this.checkCombatEnd();
      return { ok: true };
    }
    combat.distracted = false;
    this.executeEnemyTurn();
    if (combat.status === "active") this.startPlayerTurn();
    return { ok: true };
  }

  executeEnemyTurn() {
    const combat = this.requireCombat();
    const intent = this.getIntent();
    const notes = [];
    combat.enemy.block = 0;

    if (intent.attack) {
      const hits = intent.hits || 1;
      let totalHealthDamage = 0;
      for (let index = 0; index < hits; index += 1) {
        const absorbed = Math.min(combat.playerBlock, intent.attack);
        combat.playerBlock -= absorbed;
        const healthDamage = intent.attack - absorbed;
        this.hp -= healthDamage;
        totalHealthDamage += healthDamage;
      }
      notes.push(`攻击造成 ${totalHealthDamage} 点生命伤害`);
      this.stats.combatHpLost += totalHealthDamage;
      if (totalHealthDamage > 0 && this.hasItem("mistakeBook") && !combat.mistakeBookUsed) {
        combat.mistakeBookUsed = true;
        combat.nextDrawBonus += 1;
        notes.push("错题本：下回合多抽 1 张");
      }
    }
    if (intent.block) {
      combat.enemy.block += intent.block;
      notes.push(`获得 ${intent.block} 护甲`);
    }
    if (intent.debuff) {
      if (this.hasItem("earplugs") && !combat.earplugsUsed) {
        combat.earplugsUsed = true;
        notes.push("耳塞抵挡了走神");
      } else if (intent.debuff === "distracted") {
        combat.distracted = true;
        notes.push("施加走神：下回合攻击每段 -2");
      }
    }
    if (intent.addStatus) {
      const destination = intent.addStatus.zone === "draw" ? combat.drawPile : combat.discardPile;
      for (let index = 0; index < intent.addStatus.count; index += 1) {
        destination.push(this.createCard(intent.addStatus.id));
      }
      if (intent.addStatus.zone === "draw") combat.drawPile = this.rng.shuffle(combat.drawPile);
      notes.push(`加入 ${intent.addStatus.count} 张${CARD_DEFS[intent.addStatus.id].name}`);
    }
    combat.log.push(`${combat.enemy.name}·${intent.name}：${notes.join("，") || "观察了你一会儿"}。`);
    combat.enemy.intentTurn += 1;
    this.checkCombatEnd();
  }

  checkCombatEnd() {
    const combat = this.requireCombat();
    if (combat.enemy.hp <= 0 && combat.status === "active") {
      combat.status = "won";
      combat.result = "won";
      this.stats.combatsCompleted += 1;
      this.stats.combatsWon += 1;
      this.stats.combatTurns += combat.turn;
      this.pet.bond += 1;
      this.updatePetMilestone();
      for (const uid of combat.usedCardUids) {
        if (this.deck.some((card) => card.uid === uid)) {
          this.cardCombatUses[uid] = (this.cardCombatUses[uid] || 0) + 1;
        }
      }
      combat.log.push(`胜利！暴躁鹅羁绊 +1（当前 ${this.pet.bond}）。`);
    } else if (this.hp <= 0 && combat.status === "active") {
      this.hp = 0;
      combat.status = "lost";
      combat.result = "lost";
      this.stats.combatsCompleted += 1;
      this.stats.combatTurns += combat.turn;
      combat.log.push("体力耗尽，本次挑战结束。");
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
      result: combat.result,
      turns: combat.turn,
      cardsPlayed: combat.cardsPlayed,
      damageDealt: combat.damageDealt,
      hpLost: Math.max(0, combat.startingHp - this.hp),
      petUsed: combat.petUsed
    };
  }

  startNextSemester() {
    this.semester += 1;
    this.week = 1;
    this.completedNodes.clear();
    this.flags.eraserUsed = false;
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
      semester: this.semester,
      week: this.week,
      maxHp: this.maxHp,
      hp: this.hp,
      gold: this.gold,
      deck: this.deck.map((card) => ({ ...card })),
      items: [...this.items],
      backpackCapacity: this.backpackCapacity,
      pet: { ...this.pet },
      cardCombatUses: { ...this.cardCombatUses },
      flags: { ...this.flags },
      rewardIndex: this.rewardIndex,
      tutorialSeen: this.tutorialSeen,
      semesterPlan: this.semesterPlan.map((nodes) => nodes.map((node) => ({ ...node }))),
      stats: {
        ...this.stats,
        cardPlays: { ...this.stats.cardPlays }
      }
    };
  }

  static fromJSON(data) {
    if (!data || data.version !== 2 || !ARCHETYPE_DEFS[data.archetypeId]) {
      throw new Error("存档版本不兼容");
    }
    const game = new SemesterGame(1, data.archetypeId);
    game.rng.state = Number(data.rngState) >>> 0;
    game.cardSerial = Number(data.cardSerial) || 0;
    game.semester = Math.max(1, Number(data.semester) || 1);
    game.week = Math.min(16, Math.max(1, Number(data.week) || 1));
    game.maxHp = Math.max(1, Number(data.maxHp) || 50);
    game.hp = Math.min(game.maxHp, Math.max(1, Number(data.hp) || 1));
    game.gold = Math.max(0, Number(data.gold) || 0);
    game.deck = Array.isArray(data.deck)
      ? data.deck.filter((card) => CARD_DEFS[card.id]).map((card) => ({
        id: card.id,
        uid: String(card.uid),
        upgraded: Boolean(card.upgraded),
        enchantment: ENCHANTMENT_DEFS[card.enchantment]?.archetype === data.archetypeId ? card.enchantment : null
      }))
      : startingDeckFor(data.archetypeId).map((id) => game.createCard(id));
    game.items = Array.isArray(data.items) ? data.items.filter((id) => ITEM_DEFS[id]) : [];
    game.backpackCapacity = Math.min(12, Math.max(6, Number(data.backpackCapacity) || 6));
    game.pet = { ...game.pet, ...(data.pet || {}) };
    if (!PET_TALENT_DEFS[game.pet.talent]) {
      game.pet.talent = null;
      game.pet.talentLevel = 0;
      if (game.pet.pendingMilestone !== "choose") game.pet.pendingMilestone = null;
    } else {
      game.pet.talentLevel = Math.min(3, Math.max(1, Number(game.pet.talentLevel) || 1));
      if (game.pet.pendingMilestone === "choose") game.pet.pendingMilestone = null;
    }
    if (![null, "choose", "upgrade", "master"].includes(game.pet.pendingMilestone)) game.pet.pendingMilestone = null;
    game.cardCombatUses = data.cardCombatUses && typeof data.cardCombatUses === "object" ? { ...data.cardCombatUses } : {};
    game.flags = { ...game.flags, ...(data.flags || {}) };
    game.rewardIndex = Math.max(0, Number(data.rewardIndex) || 0);
    game.tutorialSeen = Boolean(data.tutorialSeen);
    const savedRngState = game.rng.state;
    game.semesterPlan = normalizeSemesterPlan(data.semesterPlan) || game.generateSemesterPlan();
    game.rng.state = savedRngState;
    if (data.stats && typeof data.stats === "object") {
      const defaults = game.stats;
      game.stats = {
        ...defaults,
        ...data.stats,
        cardPlays: data.stats.cardPlays && typeof data.stats.cardPlays === "object" ? { ...data.stats.cardPlays } : {}
      };
    }
    game.completedNodes = new Set();
    game.combat = null;
    return game;
  }

  requireCombat() {
    if (!this.combat) throw new Error("当前没有战斗");
    return this.combat;
  }
}

export { STARTING_DECK, startingDeckFor };
