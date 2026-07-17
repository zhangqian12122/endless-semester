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
  for (const card of game.enchantableCards()) card.enchantment = "ariesFlame";
  enterEliteEnchantmentStage(game, [usedSkill.uid]);

  assert.deepEqual(game.pendingCombatReward.enchantCardUids, []);
  assert.deepEqual(game.eligiblePendingEliteEnchantCards(), []);
  const beforeInvalidChoice = game.toJSON();
  assert.equal(game.resolvePendingEnchantment(usedSkill.uid), null, "用过但不符合星座条件的牌不能刻印");
  assert.equal(game.resolvePendingEnchantment(unusedAttack.uid), null, "已经刻印的牌不能再次刻印");
  assert.deepEqual(game.toJSON(), beforeInvalidChoice, "非法选择不能消耗阶段或修改统计");

  const enchantmentsBefore = game.stats.enchantments;
  assert.deepEqual(game.resolvePendingEnchantment(null), { status: "skipped" });
  assert.equal(game.pendingCombatReward, null);
  assert.equal(game.stats.enchantments, enchantmentsBefore);
  assert.equal(game.resolvePendingEnchantment(null), null, "跳过后的旧按钮不能再次结算");
});

test("非法及不合格 UID 不改变精英刻印阶段，未使用的合格牌仍属于候选", () => {
  const game = new SemesterGame(2102, "aries");
  const usedAttack = cardById(game, "textbookStrike", 0);
  const unusedAttack = cardById(game, "textbookStrike", 1);
  const usedSkill = cardById(game, "backpackGuard", 0);
  enterEliteEnchantmentStage(game, [usedAttack.uid, usedSkill.uid]);

  assert.equal(game.eligiblePendingEliteEnchantCards().some((card) => card.uid === unusedAttack.uid), true);
  const before = game.toJSON();
  for (const invalidUid of ["", "missing-card", usedSkill.uid]) {
    assert.equal(game.resolvePendingEnchantment(invalidUid), null);
    assert.deepEqual(game.toJSON(), before, `非法 UID ${String(invalidUid)} 不应产生副作用`);
  }
  assert.equal(usedAttack.enchantment, null);
});

test("玩家可明确选择任一当前合格牌，并且只在同一引擎事务中结算一次", () => {
  const game = new SemesterGame(2103, "aries");
  const usedSkill = cardById(game, "backpackGuard", 0);
  const target = cardById(game, "textbookStrike", 2);
  enterEliteEnchantmentStage(game, [usedSkill.uid]);
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

test("完整精英奖励链冻结进入刻印阶段时的全部合格牌，后加卡不会漂入候选", () => {
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
  const frozenEnchantUids = game.enchantableCards().map((card) => card.uid);
  assert.deepEqual(
    pending.enchantCardUids,
    frozenEnchantUids,
    "候选应覆盖进入刻印阶段时当前卡组的全部白羊合格牌"
  );
  assert.equal(pending.enchantCardUids.includes(unusedAttack.uid), true, "没在本场使用的合格牌也可由玩家选择");

  const addedAfterFreeze = game.createCard("textbookStrike");
  game.deck.push(addedAfterFreeze);
  assert.equal(game.eligiblePendingEliteEnchantCards().some((card) => card.uid === addedAfterFreeze.uid), false);

  const saved = game.toJSON();
  const restored = SemesterGame.fromJSON(saved);
  assert.equal(restored.pendingCombatReward?.stage, "enchant");
  assert.deepEqual(restored.pendingCombatReward?.usedCardUids, frozenUsedUids);
  assert.deepEqual(
    restored.pendingCombatReward.enchantCardUids,
    frozenEnchantUids,
    "刷新后候选集合与顺序都不能漂移"
  );
  assert.equal(restored.eligiblePendingEliteEnchantCards().some((card) => card.uid === addedAfterFreeze.uid), false);

  assert.equal(restored.resolvePendingEnchantment(unusedAttack.uid)?.status, "enchanted");
  assert.equal(restored.deck.find((card) => card.uid === unusedAttack.uid)?.enchantment, "ariesFlame");
  assert.equal(restored.pendingCombatReward, null);
});

test("旧版刻印阶段存档会迁移为当前卡组全部合格牌", () => {
  const game = new SemesterGame(2106, "gemini");
  enterEliteEnchantmentStage(game, [game.deck[0].uid]);
  const expected = game.enchantableCards().map((card) => card.uid);
  const legacy = game.toJSON();
  delete legacy.pendingCombatReward.enchantCardUids;

  const restored = SemesterGame.fromJSON(legacy);
  assert.deepEqual(restored.pendingCombatReward?.enchantCardUids, expected);
  assert.deepEqual(restored.eligiblePendingEliteEnchantCards().map((card) => card.uid), expected);

  const chosen = expected.at(-1);
  assert.equal(restored.resolvePendingEnchantment(chosen)?.status, "enchanted");
  assert.equal(restored.pendingCombatReward, null);
});
