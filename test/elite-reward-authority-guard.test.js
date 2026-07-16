import test from "node:test";
import assert from "node:assert/strict";

import { REGULAR_ITEM_IDS } from "../game-data.js";
import { SemesterGame } from "../game-engine.js";

function startElite(game) {
  assert.equal(game.chooseTarot("chariot"), true);
  game.week = 8;
  const pending = game.prepareCombatStart("rivalShadow", "elite");
  assert.ok(pending, "第 8 周应能建立真实精英战检查点");
  const combat = game.startCombat(pending.enemyId, pending.modifiers);
  assert.equal(game.completePendingCombatStart(), true);
  return combat;
}

function winElite(game, usedCardUids = []) {
  const combat = startElite(game);
  for (const uid of usedCardUids) combat.usedCardUids.add(uid);
  combat.enemy.hp = 0;
  assert.equal(game.checkCombatEnd(), "won");
  assert.deepEqual(combat.victoryReceipt, {
    outcome: "elite",
    enemyId: "rivalShadow",
    week: 8,
    routeThreat: 0,
    bonusGold: 0
  });
  return combat;
}

function prepareWonElite(game, usedCardUids = []) {
  winElite(game, usedCardUids);
  const pending = game.prepareEliteCombatReward();
  assert.equal(pending?.type, "eliteChain");
  assert.equal(pending?.stage, "card");
  return pending;
}

function enterEliteItemStage(game, usedCardUids = []) {
  const pending = prepareWonElite(game, usedCardUids);
  const cardResult = game.resolvePendingCardReward({ source: "elite", choice: null });
  assert.equal(cardResult?.source, "elite");
  assert.equal(cardResult?.skipped, true);
  assert.equal(cardResult?.nextStage, "item");
  assert.equal(game.pendingCombatReward?.stage, "item");
  assert.ok(game.pendingCombatReward.itemChoices.length > 0);
  return { prepared: pending, pending: game.pendingCombatReward };
}

function skipEliteItem(game) {
  if (typeof game.skipPendingEliteItem === "function") return game.skipPendingEliteItem();
  assert.equal(typeof game.resolvePendingEliteItem, "function");
  return game.resolvePendingEliteItem(null);
}

test("未打、进行中、战败及错误胜利类型都不能准备精英奖励", () => {
  const untouched = new SemesterGame(2301, "aries");
  assert.equal(untouched.chooseTarot("chariot"), true);
  untouched.week = 8;
  const untouchedGold = untouched.gold;
  assert.equal(untouched.prepareEliteCombatReward(), null);
  assert.equal(untouched.gold, untouchedGold);
  assert.equal(untouched.pendingCombatReward, null);

  const active = new SemesterGame(2302, "aries");
  startElite(active);
  const activeGold = active.gold;
  assert.equal(active.prepareEliteCombatReward(), null);
  assert.equal(active.gold, activeGold);
  assert.equal(active.pendingCombatReward, null);

  const lost = new SemesterGame(2303, "aries");
  startElite(lost);
  lost.hp = 0;
  assert.equal(lost.checkCombatEnd(), "lost");
  const lostGold = lost.gold;
  assert.equal(lost.prepareEliteCombatReward(), null);
  assert.equal(lost.gold, lostGold);
  assert.equal(lost.pendingCombatReward, null);

  const wrongOutcome = new SemesterGame(2304, "aries");
  const wrongCombat = winElite(wrongOutcome);
  wrongCombat.victoryReceipt = { ...wrongCombat.victoryReceipt, outcome: "normal" };
  const wrongGold = wrongOutcome.gold;
  assert.equal(wrongOutcome.prepareEliteCombatReward(), null);
  assert.equal(wrongOutcome.gold, wrongGold);
  assert.equal(wrongOutcome.pendingCombatReward, null);
});

test("真实精英胜利只发一次 30 校园币，并从本场记录冻结有效牌组 UID", () => {
  const game = new SemesterGame(2305, "aries");
  const [firstUsed, secondUsed, forgedChoice] = game.deck;
  const combat = winElite(game, [firstUsed.uid, secondUsed.uid, "not-in-deck"]);
  const goldBefore = game.gold;

  const first = game.prepareEliteCombatReward([forgedChoice.uid]);
  assert.equal(first?.type, "eliteChain");
  assert.equal(first?.stage, "card");
  assert.equal(first?.started, true);
  assert.deepEqual(first?.usedCardUids, [firstUsed.uid, secondUsed.uid]);
  assert.deepEqual(game.pendingCombatReward?.usedCardUids, [firstUsed.uid, secondUsed.uid]);
  assert.equal(game.gold, goldBefore + 30);
  assert.equal(combat.rewardPrepared, true);

  const repeated = game.prepareEliteCombatReward([forgedChoice.uid]);
  assert.equal(repeated?.started, false);
  assert.deepEqual(repeated?.usedCardUids, first.usedCardUids);
  assert.deepEqual(repeated?.choices, first.choices);
  assert.equal(game.gold, goldBefore + 30);

  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.deepEqual(restored.pendingCombatReward?.usedCardUids, first.usedCardUids);
  const resumed = restored.prepareEliteCombatReward();
  assert.equal(resumed?.started, false);
  assert.deepEqual(resumed?.usedCardUids, first.usedCardUids);
  assert.equal(restored.gold, game.gold, "刷新恢复不能再次发放精英基础校园币");
});

test("通用完成接口不能跳过或清除精英奖励链的任何合法阶段", () => {
  const game = new SemesterGame(2306, "gemini");
  prepareWonElite(game, [game.deck[0].uid]);

  for (const stage of ["card", "item", "enchant"]) {
    assert.equal(game.pendingCombatReward?.stage, stage);
    const before = game.toJSON();
    assert.equal(game.completePendingCombatReward(), false, `${stage} 阶段不能被通用完成接口清除`);
    assert.deepEqual(game.toJSON(), before);

    if (stage === "card") {
      const result = game.resolvePendingCardReward({ source: "elite", choice: null });
      assert.equal(result?.nextStage, "item");
    } else if (stage === "item") {
      assert.ok(skipEliteItem(game), "物品阶段应有显式跳过路径");
    }
  }
});

test("精英物品只接受当前冻结候选，合法领取原子进入刻印阶段", () => {
  const game = new SemesterGame(2307, "cancer");
  const { pending } = enterEliteItemStage(game, [game.deck[0].uid]);
  const [chosen, oldSecondChoice] = pending.itemChoices;
  const forged = REGULAR_ITEM_IDS.find((id) => !pending.itemChoices.includes(id));
  assert.ok(forged);
  assert.equal(typeof game.resolvePendingEliteItem, "function");

  const beforeForged = game.toJSON();
  assert.equal(game.resolvePendingEliteItem(forged), null);
  assert.deepEqual(game.toJSON(), beforeForged, "非候选物品不能改变奖励阶段");

  const itemsTakenBefore = game.stats.itemsTaken;
  const result = game.resolvePendingEliteItem(chosen);
  assert.equal(result?.status, "claimed");
  assert.equal(game.items.includes(chosen), true);
  assert.equal(game.stats.itemsTaken, itemsTakenBefore + 1);
  assert.equal(game.pendingCombatReward?.stage, "enchant");
  assert.deepEqual(game.pendingCombatReward?.itemChoices, []);

  const settled = game.toJSON();
  assert.equal(game.resolvePendingEliteItem(chosen), null);
  if (oldSecondChoice) assert.equal(game.resolvePendingEliteItem(oldSecondChoice), null);
  assert.deepEqual(game.toJSON(), settled, "旧候选与重复点击都不能二次领取");
});

test("跳过精英物品只推进一次刻印阶段，不能暗中增加物品", () => {
  const game = new SemesterGame(2308, "aries");
  const { pending } = enterEliteItemStage(game, [game.deck[0].uid]);
  const frozenChoices = [...pending.itemChoices];
  const itemsBefore = [...game.items];
  const itemsTakenBefore = game.stats.itemsTaken;

  assert.ok(skipEliteItem(game));
  assert.equal(game.pendingCombatReward?.stage, "enchant");
  assert.deepEqual(game.pendingCombatReward?.itemChoices, []);
  assert.deepEqual(game.items, itemsBefore);
  assert.equal(game.stats.itemsTaken, itemsTakenBefore);

  const settled = game.toJSON();
  assert.ok(!skipEliteItem(game), "已跳过后旧按钮不能再次推进");
  assert.equal(game.resolvePendingEliteItem(frozenChoices[0]), null);
  assert.deepEqual(game.toJSON(), settled);
});

test("满书包时只冻结替换，刷新后成功替换才原子进入刻印阶段", () => {
  const game = new SemesterGame(2309, "gemini");
  game.items = REGULAR_ITEM_IDS.slice(0, game.backpackCapacity);
  assert.equal(game.items.length, game.backpackCapacity, "测试存档应使用受支持的真实满书包容量");
  const outgoing = game.items[0];
  const { pending } = enterEliteItemStage(game, [game.deck[0].uid]);
  const [incoming, oldSecondChoice] = pending.itemChoices;
  assert.equal(typeof game.resolvePendingEliteItem, "function");

  const claim = game.resolvePendingEliteItem(incoming);
  assert.equal(claim?.status, "replacement");
  assert.deepEqual(game.pendingItemReplacement, { incoming, source: "combat" });
  assert.equal(game.pendingCombatReward?.stage, "item");
  assert.equal(game.items.includes(incoming), false);
  assert.equal(game.completePendingCombatReward(), false);

  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.deepEqual(restored.pendingItemReplacement, { incoming, source: "combat" });
  assert.equal(restored.pendingCombatReward?.stage, "item");
  assert.deepEqual(restored.pendingCombatReward?.itemChoices, pending.itemChoices);

  const invalidSnapshot = restored.toJSON();
  assert.equal(restored.replacePendingItem("not-owned"), null);
  assert.deepEqual(restored.toJSON(), invalidSnapshot);

  const itemsTakenBefore = restored.stats.itemsTaken;
  assert.deepEqual(restored.replacePendingItem(outgoing), {
    incoming,
    outgoing,
    source: "combat"
  });
  assert.equal(restored.pendingItemReplacement, null);
  assert.equal(restored.pendingCombatReward?.stage, "enchant");
  assert.deepEqual(restored.pendingCombatReward?.itemChoices, []);
  assert.equal(restored.items.includes(incoming), true);
  assert.equal(restored.items.includes(outgoing), false);
  assert.equal(restored.stats.itemsTaken, itemsTakenBefore + 1);

  const settled = restored.toJSON();
  assert.equal(restored.replacePendingItem(restored.items[0]), null);
  assert.equal(restored.resolvePendingEliteItem(incoming), null);
  if (oldSecondChoice) assert.equal(restored.resolvePendingEliteItem(oldSecondChoice), null);
  assert.deepEqual(restored.toJSON(), settled, "替换结算后的旧候选和重复操作必须失效");
});
