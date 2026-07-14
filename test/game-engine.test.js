import test from "node:test";
import assert from "node:assert/strict";

import { ARCHETYPE_TRIAL_DEFS, CHALLENGE_AFFIX_DEFS, CHALLENGE_REWARD_DEFS, CHALLENGE_RULES, SemesterGame, STARTING_DECK, cardDefinition, startingDeckFor } from "../game-engine.js";
import { ARCHETYPE_CARD_IDS, CARD_DEFS, ENCHANTMENT_DEFS, ENEMY_DEFS, NORMAL_ENEMY_IDS, PET_TALENT_DEFS, PUBLIC_REWARD_CARD_IDS } from "../game-data.js";
import { analyzeBuild, challengeRewardGuidance, choiceGuidance, evaluateCardFit } from "../build-analysis.js";
import {
  achievementProgress,
  createCareerProfile,
  normalizeCareerProfile,
  recordCareerCombat,
  recordEnemyEncounter
} from "../career.js";

function putCardInHand(game, id) {
  const combat = game.combat;
  const card = game.deck.find((candidate) => candidate.id === id) || game.createCard(id);
  combat.hand = [{ ...card }];
  combat.drawPile = [];
  combat.discardPile = [];
  return combat.hand[0];
}

test("学生初始卡组为 10 张，结构是 4 攻 4 防 2 特性牌", () => {
  const game = new SemesterGame(1);
  assert.equal(game.deck.length, 10);
  assert.deepEqual(game.deck.map((card) => card.id), STARTING_DECK);
  assert.equal(game.deck.filter((card) => card.id === "textbookStrike").length, 4);
  assert.equal(game.deck.filter((card) => card.id === "backpackGuard").length, 4);
});

test("攻击牌消耗能量、造成明确伤害，并且每回合最多为宠物充能一次", () => {
  const game = new SemesterGame(2);
  game.startCombat("sleepyBug");
  const first = putCardInHand(game, "textbookStrike");
  game.combat.energy = 3;

  assert.equal(game.playCard(first.uid).ok, true);
  assert.equal(game.combat.enemy.hp, 15);
  assert.equal(game.combat.energy, 2);
  assert.equal(game.pet.charge, 1);

  const second = { ...game.deck.filter((card) => card.id === "textbookStrike")[1] };
  game.combat.hand.push(second);
  game.playCard(second.uid);
  assert.equal(game.pet.charge, 1);
});

test("护甲抵挡敌人攻击，并在下一个玩家回合清空", () => {
  const game = new SemesterGame(3);
  game.startCombat("sleepyBug");
  const guard = putCardInHand(game, "backpackGuard");
  game.combat.energy = 3;
  game.playCard(guard.uid);
  assert.equal(game.combat.playerBlock, 9);

  game.endTurn();
  assert.equal(game.hp, 50);
  assert.equal(game.combat.playerBlock, 0);
  assert.equal(game.combat.turn, 2);
});

test("作业团会把待办状态牌加入战斗牌堆", () => {
  const game = new SemesterGame(4);
  game.startCombat("homeworkBlob");
  game.endTurn();
  const allZones = [game.combat.hand, game.combat.drawPile, game.combat.discardPile, game.combat.exhaustPile].flat();
  assert.equal(allZones.some((card) => card.id === "todo"), true);
});

test("暴躁鹅满充能后花费 1 能量，每场只能使用一次", () => {
  const game = new SemesterGame(5);
  game.startCombat("alarmClock");
  game.pet.charge = 2;
  game.combat.energy = 3;
  const hp = game.combat.enemy.hp;

  assert.equal(game.usePetSkill().ok, true);
  assert.equal(game.combat.enemy.hp, hp - 7);
  assert.equal(game.combat.energy, 2);
  assert.equal(game.usePetSkill().ok, false);
});

test("卡牌升级后使用升级数值", () => {
  const game = new SemesterGame(6);
  const strike = game.deck.find((card) => card.id === "textbookStrike");
  assert.equal(game.upgradeCard(strike.uid), true);
  assert.equal(cardDefinition(strike).effect.damage, 7);
  assert.match(cardDefinition(strike).displayName, /\+$/);
});

test("带伤害的技能不被误算为攻击牌，不触发宠物充能与攻击加成", () => {
  const game = new SemesterGame(8);
  game.addCard("lendAHand");
  game.startCombat("alarmClock");
  const card = putCardInHand(game, "lendAHand");
  game.combat.energy = 3;
  game.combat.attackBonus = 3;
  game.combat.distracted = true;

  game.playCard(card.uid);
  assert.equal(game.combat.enemy.hp, 25);
  assert.equal(game.pet.charge, 0);
});

test("三种星座学生拥有不同特性牌，且初始卡组都保持 10 张", () => {
  assert.equal(startingDeckFor("aries").length, 10);
  assert.equal(startingDeckFor("gemini").length, 10);
  assert.equal(startingDeckFor("cancer").length, 10);
  assert.equal(startingDeckFor("aries").at(-1), "classSprint");
  assert.equal(startingDeckFor("gemini").at(-1), "scratchPaper");
  assert.equal(startingDeckFor("cancer").at(-1), "payAttention");
});

test("白羊座首张攻击牌每段伤害加 2，且每场只触发一次", () => {
  const game = new SemesterGame(9, "aries");
  game.startCombat("alarmClock");
  const first = putCardInHand(game, "textbookStrike");
  game.combat.energy = 3;
  game.playCard(first.uid);
  assert.equal(game.combat.enemy.hp, 21);

  const second = { ...game.deck.filter((card) => card.id === "textbookStrike")[1] };
  game.combat.hand.push(second);
  game.playCard(second.uid);
  assert.equal(game.combat.enemy.hp, 16);
});

test("双子座每场第一次打出零费牌额外抽 1 张", () => {
  const game = new SemesterGame(10, "gemini");
  game.startCombat("alarmClock");
  const zeroCost = putCardInHand(game, "cramming");
  game.combat.drawPile = [{ ...game.deck.find((card) => card.id === "textbookStrike") }];
  game.combat.energy = 3;
  game.playCard(zeroCost.uid);
  assert.equal(game.combat.hand.length, 1);
  assert.equal(game.combat.archetypeZeroUsed, true);
});

test("存档恢复保留星座、构筑、羁绊和随机数状态", () => {
  const game = new SemesterGame(11, "gemini");
  game.week = 7;
  game.gold = 123;
  game.pet.bond = 9;
  game.updatePetMilestone();
  game.resolvePetMilestone("scout");
  const savedCard = game.addCard("catCombo", true);
  game.enchantCard(savedCard.uid);
  game.addItem("autoPencil");
  game.stats.cardsPlayed = 12;
  game.stats.cardPlays.textbookStrike = 8;
  const restored = SemesterGame.fromJSON(game.toJSON());

  assert.equal(restored.archetypeId, "gemini");
  assert.equal(restored.week, 7);
  assert.equal(restored.gold, 123);
  assert.equal(restored.pet.bond, 9);
  assert.equal(restored.pet.talent, "scout");
  assert.equal(restored.pet.talentLevel, 1);
  assert.equal(restored.deck.at(-1).id, "catCombo");
  assert.equal(restored.deck.at(-1).upgraded, true);
  assert.equal(restored.deck.at(-1).enchantment, "geminiQuick");
  assert.deepEqual(restored.items, ["autoPencil"]);
  assert.equal(restored.rng.state, game.rng.state);
  assert.equal(restored.stats.cardsPlayed, 12);
  assert.equal(restored.stats.cardPlays.textbookStrike, 8);
});

test("每个星座首批都有 4 张专属牌，且归属数据完整", () => {
  for (const [archetypeId, ids] of Object.entries(ARCHETYPE_CARD_IDS)) {
    assert.equal(ids.length, 4);
    for (const id of ids) {
      assert.equal(CARD_DEFS[id].archetype, archetypeId);
      assert.ok(CARD_DEFS[id].effect);
      assert.ok(CARD_DEFS[id].upgradedEffect);
    }
  }
});

test("普通战后三选一严格为 1 张本星座专属和 2 张普池", () => {
  for (const archetypeId of Object.keys(ARCHETYPE_CARD_IDS)) {
    for (let seed = 1; seed <= 40; seed += 1) {
      const game = new SemesterGame(seed, archetypeId);
      const choices = game.rewardCards(3);
      assert.equal(choices.length, 3);
      assert.equal(choices.filter((id) => ARCHETYPE_CARD_IDS[archetypeId].includes(id)).length, 1);
      assert.equal(choices.filter((id) => PUBLIC_REWARD_CARD_IDS.includes(id)).length, 2);
      assert.equal(choices.some((id) => CARD_DEFS[id].archetype && CARD_DEFS[id].archetype !== archetypeId), false);
    }
  }
});

test("指定稀有度奖励仍保持 1 专属 + 2 普池且全部同稀有度", () => {
  const game = new SemesterGame(99, "gemini");
  const choices = game.rewardCards(3, "uncommon");
  assert.equal(choices.filter((id) => ARCHETYPE_CARD_IDS.gemini.includes(id)).length, 1);
  assert.equal(choices.filter((id) => PUBLIC_REWARD_CARD_IDS.includes(id)).length, 2);
  assert.equal(choices.every((id) => CARD_DEFS[id].rarity === "uncommon"), true);
});

test("白羊赤焰刻印让攻击牌每段伤害加 2，并可与升级叠加", () => {
  const game = new SemesterGame(101, "aries");
  const strike = game.deck.find((card) => card.id === "textbookStrike");
  assert.equal(game.enchantCard(strike.uid), true);
  assert.equal(cardDefinition(strike).effect.damage, 7);
  game.upgradeCard(strike.uid);
  assert.equal(cardDefinition(strike).effect.damage, 9);
  assert.equal(cardDefinition(strike).enchantment, ENCHANTMENT_DEFS.ariesFlame);
  assert.equal(game.enchantCard(strike.uid), false);
});

test("双子瞬思刻印让非零费牌费用减 1，最低为 0", () => {
  const game = new SemesterGame(102, "gemini");
  const guard = game.deck.find((card) => card.id === "backpackGuard");
  assert.equal(game.enchantCard(guard.uid), true);
  assert.equal(cardDefinition(guard).cost, 0);
  game.startCombat("sleepyBug");
  const combatGuard = { ...guard };
  game.combat.hand = [combatGuard];
  game.combat.energy = 0;
  assert.equal(game.playCard(combatGuard.uid).ok, true);
  assert.equal(game.combat.energy, 0);
});

test("巨蟹守护刻印让卡牌基础护甲加 3，不能刻在纯攻击牌上", () => {
  const game = new SemesterGame(103, "cancer");
  const guard = game.deck.find((card) => card.id === "backpackGuard");
  const strike = game.deck.find((card) => card.id === "textbookStrike");
  assert.equal(game.enchantCard(strike.uid), false);
  assert.equal(game.enchantCard(guard.uid), true);
  assert.equal(cardDefinition(guard).effect.block, 8);
  game.upgradeCard(guard.uid);
  assert.equal(cardDefinition(guard).effect.block, 10);
});

test("宠物在羁绊 3、10、25 依次选择、强化和精通路线", () => {
  const game = new SemesterGame(104, "aries");
  game.pet.bond = 3;
  assert.equal(game.updatePetMilestone(), "choose");
  assert.equal(game.resolvePetMilestone("fury"), true);
  assert.equal(game.petSkillPreview().damage, 8);

  game.pet.bond = 10;
  assert.equal(game.updatePetMilestone(), "upgrade");
  assert.equal(game.resolvePetMilestone(), true);
  assert.equal(game.petSkillPreview().damage, 9);

  game.pet.bond = 25;
  assert.equal(game.updatePetMilestone(), "master");
  assert.equal(game.resolvePetMilestone(), true);
  assert.equal(game.petSkillPreview().damage, 10);
  assert.equal(game.pet.talentLevel, 3);
});

test("护崽路线让宠物技能获得护甲，但不增加出手次数", () => {
  const game = new SemesterGame(105, "aries");
  game.pet.talent = "guardian";
  game.pet.talentLevel = 2;
  game.startCombat("alarmClock");
  game.pet.charge = 2;
  game.combat.energy = 3;
  assert.equal(game.usePetSkill().ok, true);
  assert.equal(game.combat.playerBlock, 5);
  assert.equal(game.usePetSkill().ok, false);
});

test("叼笔记路线立即抽牌并为下回合提供抽牌奖励", () => {
  const game = new SemesterGame(106, "gemini");
  game.pet.talent = "scout";
  game.pet.talentLevel = 2;
  game.startCombat("alarmClock");
  game.pet.charge = 2;
  game.combat.energy = 3;
  const handSize = game.combat.hand.length;
  game.usePetSkill();
  assert.equal(game.combat.hand.length, handSize + 1);
  assert.equal(game.combat.nextDrawBonus, 1);
  assert.equal(game.petSkillPreview().talent, PET_TALENT_DEFS.scout);
});

test("战斗胜利跨过羁绊 3 时生成路线选择，不直接偷偷加数值", () => {
  const game = new SemesterGame(107, "cancer");
  game.pet.bond = 2;
  game.startCombat("sleepyBug");
  game.combat.enemy.hp = 1;
  const strike = putCardInHand(game, "textbookStrike");
  game.combat.energy = 3;
  game.playCard(strike.uid);
  assert.equal(game.pet.bond, 3);
  assert.equal(game.pet.pendingMilestone, "choose");
  assert.equal(game.petSkillPreview().damage, 7);
});

test("试玩统计记录战斗、回合、出牌与常用卡", () => {
  const game = new SemesterGame(108, "aries");
  game.startCombat("sleepyBug");
  game.combat.enemy.hp = 5;
  const strike = putCardInHand(game, "textbookStrike");
  game.combat.energy = 3;
  game.playCard(strike.uid);

  assert.equal(game.stats.combatsStarted, 1);
  assert.equal(game.stats.combatsCompleted, 1);
  assert.equal(game.stats.combatsWon, 1);
  assert.equal(game.stats.combatTurns, 1);
  assert.equal(game.stats.cardsPlayed, 1);
  assert.equal(game.stats.cardPlays.textbookStrike, 1);
});

test("试玩统计只累计真正穿过护甲的战斗生命损失", () => {
  const game = new SemesterGame(109, "aries");
  game.startCombat("sleepyBug");
  game.combat.playerBlock = 3;
  game.endTurn();
  assert.equal(game.hp, 48);
  assert.equal(game.stats.combatHpLost, 2);
});

test("战斗复盘记录回合、出牌、实际伤害和掉血", () => {
  const game = new SemesterGame(110, "aries");
  game.startCombat("sleepyBug");
  game.combat.enemy.hp = 5;
  const strike = putCardInHand(game, "textbookStrike");
  game.combat.energy = 3;
  game.playCard(strike.uid);
  const summary = game.combatSummary();

  assert.equal(summary.result, "won");
  assert.equal(summary.enemyId, "sleepyBug");
  assert.equal(summary.turns, 1);
  assert.equal(summary.cardsPlayed, 1);
  assert.equal(summary.damageDealt, 5);
  assert.equal(summary.hpLost, 0);
});

test("生涯档案跨对局记录发现与成就进度", () => {
  const profile = createCareerProfile();
  for (const enemyId of ["sleepyBug", "homeworkBlob", "alarmClock", "phoneSpirit"]) {
    recordEnemyEncounter(profile, enemyId);
  }
  const unlocked = recordCareerCombat(profile, {
    result: "won", enemyKind: "normal", turns: 3, cardsPlayed: 6, hpLost: 0, petUsed: true
  });

  assert.equal(profile.discoveredEnemies.length, 4);
  assert.ok(profile.unlockedAchievements.includes("campusArchive"));
  assert.ok(unlocked.includes("firstWin"));
  assert.ok(unlocked.includes("cleanWin"));
  assert.ok(unlocked.includes("quickWin"));
  assert.deepEqual(achievementProgress(profile, "gooseCall"), { current: 1, target: 5, unlocked: false });

  const restored = normalizeCareerProfile(JSON.parse(JSON.stringify(profile)));
  assert.equal(restored.cardsPlayed, 6);
  assert.deepEqual(restored.unlockedAchievements, profile.unlockedAchievements);
});

test("三种学生的初始卡组会识别为各自核心流派", () => {
  assert.equal(analyzeBuild(new SemesterGame(201, "aries")).primary.id, "offense");
  assert.equal(analyzeBuild(new SemesterGame(202, "gemini")).primary.id, "cycle");
  assert.equal(analyzeBuild(new SemesterGame(203, "cancer")).primary.id, "defense");
});

test("宠物牌与羁绊路线足够集中时识别为鹅鹅协同", () => {
  const game = new SemesterGame(204, "gemini");
  game.deck = Array.from({ length: 8 }, () => game.createCard("feedPet"));
  game.pet.talent = "scout";
  game.pet.talentLevel = 2;
  const analysis = analyzeBuild(game);
  assert.equal(analysis.primary.id, "pet");
  assert.equal(analysis.risk, "防御密度偏低");
});

test("候选牌会区分核心契合、转型组件和补足短板", () => {
  const offense = new SemesterGame(207, "aries");
  assert.equal(evaluateCardFit(offense, "stubborn").id, "core");
  assert.equal(evaluateCardFit(offense, "borrowNotes").id, "pivot");
  assert.match(choiceGuidance(offense, ["stubborn", "borrowNotes"]), /1 张核心契合牌/);

  const fragile = new SemesterGame(208, "aries");
  fragile.deck = Array.from({ length: 8 }, () => fragile.createCard("textbookStrike"));
  assert.equal(evaluateCardFit(fragile, "holdOn").id, "repair");
  assert.match(choiceGuidance(fragile, ["holdOn", "borrowNotes"]), /防御密度偏低/);
});

test("选牌契合评估不会修改卡组或随机数状态", () => {
  const game = new SemesterGame(209, "gemini");
  const before = JSON.stringify(game.toJSON());
  evaluateCardFit(game, "feedPet");
  choiceGuidance(game, ["feedPet", "catCombo", "holdOn"]);
  assert.equal(JSON.stringify(game.toJSON()), before);
});

test("挑战奖励参谋会根据卡组、宠物里程碑和书包状态给出唯一建议", () => {
  const openBackpack = new SemesterGame(210, "cancer");
  const itemAdvice = challengeRewardGuidance(openBackpack, 8);
  assert.equal(itemAdvice.recommendedId, "item");
  assert.match(itemAdvice.options.item.reason, /6 个空位/);
  assert.equal(Object.values(itemAdvice.options).filter((option) => option.recommended).length, 1);

  const nearMilestone = new SemesterGame(211, "cancer");
  nearMilestone.pet.talent = "guardian";
  nearMilestone.pet.talentLevel = 1;
  nearMilestone.pet.bond = 8;
  const petAdvice = challengeRewardGuidance(nearMilestone, 0);
  assert.equal(petAdvice.recommendedId, "pet");
  assert.match(petAdvice.options.pet.reason, /8 → 10/);

  const finishedCollection = new SemesterGame(212, "aries");
  finishedCollection.pet.talent = "fury";
  finishedCollection.pet.talentLevel = 3;
  finishedCollection.pet.bond = 25;
  const cardAdvice = challengeRewardGuidance(finishedCollection, 0);
  assert.equal(cardAdvice.recommendedId, "cards");
  assert.match(cardAdvice.options.item.reason, /45 校园币/);
});

test("挑战奖励参谋只读取本局状态，不修改卡组、统计或随机数", () => {
  const game = new SemesterGame(213, "gemini");
  game.pet.bond = 8;
  const before = JSON.stringify(game.toJSON());
  challengeRewardGuidance(game, 5);
  assert.equal(JSON.stringify(game.toJSON()), before);
});

test("随机池新增群聊99+与卡纸打印机，且机制按公开意图执行", () => {
  assert.ok(NORMAL_ENEMY_IDS.includes("groupChat"));
  assert.ok(NORMAL_ENEMY_IDS.includes("printerJam"));
  for (const id of NORMAL_ENEMY_IDS) {
    assert.ok(ENEMY_DEFS[id].pattern);
    assert.ok(ENEMY_DEFS[id].tip);
  }

  const chatGame = new SemesterGame(205, "cancer");
  chatGame.startCombat("groupChat");
  chatGame.endTurn();
  assert.equal(chatGame.hp, 48);

  const printerGame = new SemesterGame(206, "cancer");
  printerGame.startCombat("printerJam");
  printerGame.endTurn();
  assert.equal(printerGame.combat.enemy.block, 8);
  assert.ok(printerGame.combat.discardPile.some((card) => card.id === "todo"));
});

test("同一种子生成相同路线，且固定周、节点差异与补给保底成立", () => {
  const first = new SemesterGame(301, "gemini");
  const second = new SemesterGame(301, "gemini");
  assert.deepEqual(first.semesterPlan, second.semesterPlan);
  assert.equal(first.semesterPlan.length, 17);
  assert.equal(first.semesterPlan[1][0].enemy, "sleepyBug");
  assert.equal(first.semesterPlan[2][0].enemy, "homeworkBlob");
  assert.equal(first.semesterPlan[8][0].enemy, "rivalShadow");
  assert.equal(first.semesterPlan[16][0].enemy, "finalExam");

  const openWeeks = [3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
  for (const week of openWeeks) {
    const nodes = first.semesterPlan[week];
    assert.equal(nodes.length, 2);
    assert.equal(new Set(nodes.map((node) => node.type)).size, 2);
    for (const node of nodes.filter((candidate) => candidate.type === "combat")) {
      assert.equal(ENEMY_DEFS[node.enemy].kind, "normal");
    }
  }
  const allNodes = first.semesterPlan.flat();
  assert.ok(allNodes.filter((node) => node.type === "rest").length >= 2);
  assert.ok(allNodes.filter((node) => node.type === "shop").length >= 2);
  const challenges = allNodes.filter((node) => node.challenge);
  assert.equal(challenges.length, 2);
  assert.ok(challenges.every((node) => CHALLENGE_AFFIX_DEFS[node.affix]));
  assert.equal(new Set(challenges.map((node) => node.affix)).size, 2);
  assert.equal(first.semesterPlan.slice(3, 8).flat().filter((node) => node.challenge).length, 1);
  assert.equal(first.semesterPlan.slice(9, 16).flat().filter((node) => node.challenge).length, 1);
  for (let week = 3; week <= 15; week += 1) {
    if (first.semesterPlan[week].some((node) => node.challenge)) {
      assert.ok(first.semesterPlan[week].some((node) => node.type !== "combat"));
    }
  }
});

test("路线随存档恢复，旧存档迁移也不会消耗后续随机数", () => {
  const game = new SemesterGame(302, "aries");
  game.week = 7;
  const saved = game.toJSON();
  const restored = SemesterGame.fromJSON(saved);
  assert.deepEqual(restored.semesterPlan, game.semesterPlan);
  assert.equal(restored.rng.state, saved.rngState);

  const versionElevenRoute = game.toJSON();
  for (const nodes of versionElevenRoute.semesterPlan) {
    for (const node of nodes) delete node.affix;
  }
  const migratedAffixes = SemesterGame.fromJSON(versionElevenRoute);
  assert.equal(migratedAffixes.rng.state, versionElevenRoute.rngState);
  assert.deepEqual(
    migratedAffixes.semesterPlan.flat().filter((node) => node.challenge).map((node) => node.enemy),
    versionElevenRoute.semesterPlan.flat().filter((node) => node.challenge).map((node) => node.enemy)
  );
  assert.equal(new Set(migratedAffixes.semesterPlan.flat().filter((node) => node.challenge).map((node) => node.affix)).size, 2);

  const versionOneRoute = game.toJSON();
  for (const nodes of versionOneRoute.semesterPlan) {
    for (const node of nodes) {
      delete node.challenge;
      delete node.affix;
    }
  }
  const migratedRoute = SemesterGame.fromJSON(versionOneRoute);
  assert.equal(migratedRoute.rng.state, versionOneRoute.rngState);
  assert.equal(migratedRoute.semesterPlan.flat().filter((node) => node.challenge).length, 2);
  assert.equal(new Set(migratedRoute.semesterPlan.flat().filter((node) => node.challenge).map((node) => node.affix)).size, 2);
  assert.deepEqual(
    migratedRoute.semesterPlan.flat().map(({ type, enemy }) => ({ type, enemy })),
    versionOneRoute.semesterPlan.flat().map(({ type, enemy }) => ({ type, enemy }))
  );

  const legacy = game.toJSON();
  delete legacy.semesterPlan;
  const migrated = SemesterGame.fromJSON(legacy);
  assert.equal(migrated.week, 7);
  assert.equal(migrated.rng.state, legacy.rngState);
  assert.equal(migrated.semesterPlan.length, 17);
  assert.ok(migrated.semesterPlan[7].length > 0);
});

test("挑战战公开强化数值，并记录挑战胜利与成就", () => {
  const game = new SemesterGame(303, "cancer");
  game.startCombat("alarmClock", {
    challenge: true,
    hpMultiplier: CHALLENGE_RULES.hpMultiplier,
    damageMultiplier: CHALLENGE_RULES.damageMultiplier,
    affix: "deadline"
  });
  assert.equal(game.combat.enemy.maxHp, 38);
  game.combat.enemy.intentTurn = 1;
  assert.equal(game.getIntent().attack, 9);
  game.combat.turn = 4;
  assert.equal(game.getIntent().attack, 13);

  game.combat.enemy.hp = 0;
  game.checkCombatEnd();
  const summary = game.combatSummary();
  assert.equal(summary.challenge, true);
  assert.equal(game.stats.challengeWins, 1);

  const profile = createCareerProfile();
  const unlocked = recordCareerCombat(profile, summary);
  assert.equal(profile.challengeWins, 1);
  assert.ok(unlocked.includes("challengeWon"));
});

test("挑战胜利的三条奖励路线数值公开、互斥选择并写入存档", () => {
  for (const [id, reward] of Object.entries(CHALLENGE_REWARD_DEFS)) {
    const game = new SemesterGame(330 + reward.gold, "aries");
    const beforeGold = game.gold;
    assert.equal(game.claimChallengeReward(id), reward);
    assert.equal(game.gold, beforeGold + reward.gold);
    assert.equal(game.stats.challengeRewardChoices[id], 1);
    assert.equal(
      Object.values(game.stats.challengeRewardChoices).reduce((sum, count) => sum + count, 0),
      1
    );

    const restored = SemesterGame.fromJSON(game.toJSON());
    assert.deepEqual(restored.stats.challengeRewardChoices, game.stats.challengeRewardChoices);
  }

  const invalid = new SemesterGame(399, "cancer");
  const beforeGold = invalid.gold;
  assert.equal(invalid.claimChallengeReward("unknown"), null);
  assert.equal(invalid.gold, beforeGold);
  assert.deepEqual(invalid.stats.challengeRewardChoices, { cards: 0, pet: 0, item: 0 });
});

test("白羊、双子与巨蟹拥有不同且公开的星座试炼", () => {
  assert.deepEqual(Object.keys(ARCHETYPE_TRIAL_DEFS), ["aries", "gemini", "cancer"]);
  assert.equal(new Set(Object.values(ARCHETYPE_TRIAL_DEFS).map((trial) => trial.id)).size, 3);
  assert.ok(Object.values(ARCHETYPE_TRIAL_DEFS).every((trial) => trial.bonusGold === 10));

  const aries = new SemesterGame(401, "aries");
  const ariesGold = aries.gold;
  aries.startCombat("sleepyBug", { challenge: true, affix: "deadline" });
  assert.equal(aries.stats.trialsAttempted, 1);
  aries.combat.enemy.hp = 0;
  aries.checkCombatEnd();
  assert.equal(aries.combatSummary().challengeTrial.completed, true);
  assert.equal(aries.combatSummary().challengeTrialBonus, 10);
  assert.equal(aries.gold, ariesGold + 10);
  assert.equal(aries.stats.trialsCompleted, 1);
  aries.checkCombatEnd();
  assert.equal(aries.gold, ariesGold + 10);

  const lateAries = new SemesterGame(402, "aries");
  lateAries.startCombat("sleepyBug", { challenge: true, affix: "deadline" });
  lateAries.combat.turn = 4;
  lateAries.combat.enemy.hp = 0;
  lateAries.checkCombatEnd();
  assert.equal(lateAries.combatSummary().challengeTrial.state, "failed");
  assert.equal(lateAries.combatSummary().challengeTrialBonus, 0);

  const gemini = new SemesterGame(403, "gemini");
  gemini.startCombat("sleepyBug", { challenge: true, affix: "earlyClass" });
  gemini.combat.hand = Array.from({ length: 4 }, () => gemini.createCard("cramming"));
  gemini.combat.drawPile = [];
  gemini.combat.discardPile = [];
  for (const card of [...gemini.combat.hand]) assert.equal(gemini.playCard(card.uid).ok, true);
  assert.equal(gemini.challengeTrialStatus().state, "achieved");
  gemini.combat.enemy.hp = 0;
  gemini.checkCombatEnd();
  assert.equal(gemini.combatSummary().challengeTrial.completed, true);

  const cancer = new SemesterGame(404, "cancer");
  cancer.startCombat("sleepyBug", { challenge: true, affix: "backlog" });
  cancer.hp -= 5;
  cancer.combat.enemy.hp = 0;
  cancer.checkCombatEnd();
  assert.equal(cancer.combatSummary().challengeTrial.completed, true);

  const hurtCancer = new SemesterGame(405, "cancer");
  hurtCancer.startCombat("sleepyBug", { challenge: true, affix: "backlog" });
  hurtCancer.hp -= 6;
  hurtCancer.combat.enemy.hp = 0;
  hurtCancer.checkCombatEnd();
  assert.equal(hurtCancer.combatSummary().challengeTrial.state, "failed");
});

test("星座试炼统计写入存档，旧存档缺少字段时安全补零", () => {
  const game = new SemesterGame(406, "aries");
  game.startCombat("sleepyBug", { challenge: true, affix: "deadline" });
  game.combat.enemy.hp = 0;
  game.checkCombatEnd();
  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.equal(restored.stats.trialsAttempted, 1);
  assert.equal(restored.stats.trialsCompleted, 1);

  const legacy = game.toJSON();
  delete legacy.stats.trialsAttempted;
  delete legacy.stats.trialsCompleted;
  const migrated = SemesterGame.fromJSON(legacy);
  assert.equal(migrated.stats.trialsAttempted, 0);
  assert.equal(migrated.stats.trialsCompleted, 0);
});

test("桌面爆满与第一节早课词缀分别污染牌堆和压缩首回合能量", () => {
  const backlog = new SemesterGame(304, "gemini");
  backlog.startCombat("sleepyBug", { challenge: true, affix: "backlog" });
  const backlogCards = [...backlog.combat.hand, ...backlog.combat.drawPile, ...backlog.combat.discardPile];
  assert.equal(backlogCards.filter((card) => card.id === "todo").length, 2);
  assert.equal(backlogCards.length, backlog.deck.length + 2);

  const earlyClass = new SemesterGame(305, "cancer");
  earlyClass.startCombat("sleepyBug", { challenge: true, affix: "earlyClass" });
  assert.equal(earlyClass.combat.energy, 2);
  assert.match(earlyClass.combat.log.join("\n"), /第一节早课：本回合少 1 点能量/);
});

test("无尽学期保留构筑并施加明确的成长代价", () => {
  const game = new SemesterGame(7);
  game.addCard("catCombo");
  game.pet.bond = 8;
  game.hp = 1;
  game.startNextSemester();

  assert.equal(game.semester, 2);
  assert.equal(game.week, 1);
  assert.equal(game.deck.length, 11);
  assert.equal(game.pet.bond, 8);
  assert.equal(game.maxHp, 52);
  assert.equal(game.hp, 52);
  assert.equal(game.backpackCapacity, 7);
});
