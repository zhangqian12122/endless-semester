import test from "node:test";
import assert from "node:assert/strict";

import { SemesterGame, STARTING_DECK, cardDefinition, startingDeckFor } from "../game-engine.js";
import { ARCHETYPE_CARD_IDS, CARD_DEFS, ENCHANTMENT_DEFS, PET_TALENT_DEFS, PUBLIC_REWARD_CARD_IDS } from "../game-data.js";

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
