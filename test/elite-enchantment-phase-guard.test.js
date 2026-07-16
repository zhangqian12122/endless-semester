import test from "node:test";
import assert from "node:assert/strict";

import { REGULAR_ITEM_IDS } from "../game-data.js";
import { SemesterGame } from "../game-engine.js";

function cardById(game, id, occurrence = 0) {
  const card = game.deck.filter((candidate) => candidate.id === id)[occurrence];
  assert.ok(card, `测试牌组应包含第 ${occurrence + 1} 张 ${id}`);
  return card;
}

function winEliteForRewards(game, usedCardUids) {
  assert.equal(game.chooseTarot("chariot"), true);
  game.week = 8;
  const checkpoint = game.prepareCombatStart("rivalShadow", "elite");
  assert.ok(checkpoint);
  game.startCombat(checkpoint.enemyId, checkpoint.modifiers);
  game.combat.usedCardUids = new Set(usedCardUids);
  game.combat.enemy.hp = 0;
  assert.equal(game.checkCombatEnd(), "won");
  assert.equal(game.completePendingCombatStart(), true);
  return game.prepareEliteCombatReward();
}

function enterEliteEnchantmentStage(game, usedCardUids, { settleCardReward = false } = {}) {
  game.backpackCapacity = REGULAR_ITEM_IDS.length;
  game.items = [...REGULAR_ITEM_IDS];

  const prepared = winEliteForRewards(game, usedCardUids);
  assert.equal(prepared?.type, "eliteChain");
  assert.equal(prepared?.stage, "card");

  if (settleCardReward) {
    const result = game.resolvePendingCardReward({
      source: "elite",
      choice: prepared.choices[0]
    });
    assert.equal(result?.nextStage, "enchant");
  } else {
    assert.equal(game.advanceEliteCombatRewardFromCard(), true);
  }

  assert.equal(game.pendingCombatReward?.type, "eliteChain");
  assert.equal(game.pendingCombatReward?.stage, "enchant");
  return game.pendingCombatReward;
}

test("无合格刻印候选时只能原子跳过，任意卡牌 UID 都不能越权结算", () => {
  const game = new SemesterGame(2101, "aries");
  const usedSkill = cardById(game, "backpackGuard");
  const unusedAttack = cardById(game, "textbookStrike");
  enterEliteEnchantmentStage(game, [usedSkill.uid]);

  assert.deepEqual(game.enchantableCards(game.pendingCombatReward.usedCardUids), []);
  const beforeInvalidChoice = game.toJSON();
  assert.equal(game.resolvePendingEnchantment(usedSkill.uid), null, "用过但不符合星座条件的牌不能刻印");
  assert.equal(game.resolvePendingEnchantment(unusedAttack.uid), null, "未在本场使用的合格牌不能冒充候选");
  assert.deepEqual(game.toJSON(), beforeInvalidChoice, "非法选择不能消耗阶段或修改统计");

  const enchantmentsBefore = game.stats.enchantments;
  assert.deepEqual(game.resolvePendingEnchantment(null), { status: "skipped" });
  assert.equal(game.pendingCombatReward, null);
  assert.equal(game.stats.enchantments, enchantmentsBefore);
  assert.equal(game.resolvePendingEnchantment(null), null, "跳过后的旧按钮不能再次结算");
});

test("非法、未使用及不合格 UID 均不改变精英刻印阶段", () => {
  const game = new SemesterGame(2102, "aries");
  const usedAttack = cardById(game, "textbookStrike", 0);
  const unusedAttack = cardById(game, "textbookStrike", 1);
  const usedSkill = cardById(game, "backpackGuard", 0);
  enterEliteEnchantmentStage(game, [usedAttack.uid, usedSkill.uid]);

  const before = game.toJSON();
  for (const invalidUid of ["", "missing-card", unusedAttack.uid, usedSkill.uid]) {
    assert.equal(game.resolvePendingEnchantment(invalidUid), null);
    assert.deepEqual(game.toJSON(), before, `非法 UID ${String(invalidUid)} 不应产生副作用`);
  }
  assert.equal(usedAttack.enchantment, null);
});

test("合法候选只刻印一次，并在同一引擎事务中更新统计和关闭奖励", () => {
  const game = new SemesterGame(2103, "aries");
  const target = cardById(game, "textbookStrike", 0);
  enterEliteEnchantmentStage(game, [target.uid]);
  const enchantmentsBefore = game.stats.enchantments;

  assert.deepEqual(game.resolvePendingEnchantment(target.uid), {
    status: "enchanted",
    uid: target.uid,
    enchantment: "ariesFlame"
  });
  assert.equal(target.enchantment, "ariesFlame");
  assert.equal(game.stats.enchantments, enchantmentsBefore + 1);
  assert.equal(game.pendingCombatReward, null);

  const settled = game.toJSON();
  assert.equal(game.resolvePendingEnchantment(target.uid), null);
  assert.equal(game.resolvePendingEnchantment(null), null);
  assert.deepEqual(game.toJSON(), settled, "重复点击不能重复刻印、加统计或推进流程");
});

test("存在候选时仍允许玩家主动跳过，且不会暗中刻印或增加统计", () => {
  const game = new SemesterGame(2104, "cancer");
  const target = cardById(game, "backpackGuard", 0);
  enterEliteEnchantmentStage(game, [target.uid]);
  const enchantmentsBefore = game.stats.enchantments;

  assert.deepEqual(game.resolvePendingEnchantment(null), { status: "skipped" });
  assert.equal(target.enchantment, null);
  assert.equal(game.stats.enchantments, enchantmentsBefore);
  assert.equal(game.pendingCombatReward, null);
});

test("完整精英奖励链与存档恢复保持本场使用 UID 冻结，新增或未使用卡不会漂入候选", () => {
  const game = new SemesterGame(2105, "aries");
  const firstUsed = cardById(game, "textbookStrike", 0);
  const secondUsed = cardById(game, "textbookStrike", 1);
  const unusedAttack = cardById(game, "textbookStrike", 2);
  const usedSkill = cardById(game, "backpackGuard", 0);
  const frozenUsedUids = [secondUsed.uid, firstUsed.uid, usedSkill.uid];

  const pending = enterEliteEnchantmentStage(
    game,
    [secondUsed.uid, firstUsed.uid, secondUsed.uid, usedSkill.uid, "not-in-deck"],
    { settleCardReward: true }
  );
  assert.deepEqual(pending.usedCardUids, frozenUsedUids, "准备奖励时应去重并剔除非牌组 UID");
  assert.deepEqual(
    game.enchantableCards(pending.usedCardUids).map((card) => card.uid),
    [firstUsed.uid, secondUsed.uid],
    "候选只取本场使用且符合白羊刻印条件的牌"
  );

  const saved = game.toJSON();
  const restored = SemesterGame.fromJSON(saved);
  assert.equal(restored.pendingCombatReward?.stage, "enchant");
  assert.deepEqual(restored.pendingCombatReward?.usedCardUids, frozenUsedUids);
  assert.deepEqual(
    restored.enchantableCards(restored.pendingCombatReward.usedCardUids).map((card) => card.uid),
    [firstUsed.uid, secondUsed.uid],
    "刷新后候选集合与顺序都不能漂移"
  );

  const beforeUnused = restored.toJSON();
  assert.equal(restored.resolvePendingEnchantment(unusedAttack.uid), null);
  assert.deepEqual(restored.toJSON(), beforeUnused, "存档恢复后也不能选择未使用牌");
  assert.equal(restored.resolvePendingEnchantment(secondUsed.uid)?.status, "enchanted");
  assert.equal(restored.deck.find((card) => card.uid === secondUsed.uid)?.enchantment, "ariesFlame");
  assert.equal(restored.pendingCombatReward, null);
});
