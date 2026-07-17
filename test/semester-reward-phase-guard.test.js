import test from "node:test";
import assert from "node:assert/strict";

import { BOSS_ITEM_IDS } from "../game-data.js";
import { SemesterGame } from "../game-engine.js";

function readyFinalExam(game) {
  assert.equal(game.chooseTarot("chariot"), true);
  game.week = 16;
  const pending = game.prepareCombatStart("finalExam", "boss");
  assert.ok(pending, "第 16 周应能建立期末 Boss 开局检查点");
  game.startCombat(pending.enemyId, pending.modifiers);
}

function winFinalExam(game) {
  readyFinalExam(game);
  game.combat.enemy.hp = 0;
  assert.equal(game.checkCombatEnd(), "won");
  assert.equal(game.completePendingCombatStart(), true);
  assert.deepEqual(game.combat.victoryReceipt, {
    outcome: "boss",
    enemyId: "finalExam",
    week: 16,
    routeThreat: 0,
    bonusGold: 0
  });
}

function enterSummaryUpgrade(game) {
  winFinalExam(game);
  const pending = game.prepareSemesterRewards(BOSS_ITEM_IDS);
  assert.equal(pending?.stage, "bossItem");
  const itemId = pending.itemChoices[0];
  const claimed = game.resolvePendingSemesterItem(itemId);
  assert.ok(claimed, "合法纪念物候选应能结算");
  assert.equal(game.items.includes(itemId), true);
  assert.equal(game.pendingSemesterReward?.stage, "summaryUpgrade");
  return { itemId, pending };
}

test("未打或未赢期末考试时不能准备期末奖励", () => {
  const untouched = new SemesterGame(701, "aries");
  untouched.chooseTarot("chariot");
  untouched.week = 16;
  const untouchedGold = untouched.gold;
  assert.equal(untouched.prepareSemesterRewards(BOSS_ITEM_IDS), null);
  assert.equal(untouched.gold, untouchedGold);
  assert.equal(untouched.pendingSemesterReward, null);

  const active = new SemesterGame(702, "aries");
  readyFinalExam(active);
  assert.equal(active.completePendingCombatStart(), true);
  assert.equal(active.prepareSemesterRewards(BOSS_ITEM_IDS), null);
  assert.equal(active.pendingSemesterReward, null);

  const lost = new SemesterGame(703, "aries");
  readyFinalExam(lost);
  lost.hp = 0;
  assert.equal(lost.checkCombatEnd(), "lost");
  assert.equal(lost.completePendingCombatStart(), true);
  assert.equal(lost.prepareSemesterRewards(BOSS_ITEM_IDS), null);
  assert.equal(lost.pendingSemesterReward, null);
});

test("真实 Boss 胜利只建立一次期末奖励并只发一次基础校园币", () => {
  const game = new SemesterGame(704, "gemini");
  winFinalExam(game);
  const goldBefore = game.gold;

  const first = game.prepareSemesterRewards(BOSS_ITEM_IDS);
  assert.equal(first?.stage, "bossItem");
  assert.equal(first?.started, true);
  assert.equal(game.gold, goldBefore + 50);
  assert.equal(game.combat.rewardPrepared, true);

  const repeated = game.prepareSemesterRewards(BOSS_ITEM_IDS);
  assert.equal(repeated?.started, false);
  assert.deepEqual(repeated?.itemChoices, first.itemChoices);
  assert.equal(game.gold, goldBefore + 50);
});

test("纪念物只接受当前期末候选，结算后旧候选与重复操作都失效", () => {
  const game = new SemesterGame(705, "cancer");
  winFinalExam(game);
  const pending = game.prepareSemesterRewards(BOSS_ITEM_IDS);
  const [chosen, stale] = pending.itemChoices;

  assert.equal(game.resolvePendingSemesterItem("autoPencil"), null, "普通物品不能伪装成期末候选");
  assert.equal(game.resolvePendingSemesterItem("unknown-item"), null);
  assert.equal(game.pendingSemesterReward?.stage, "bossItem");
  assert.equal(game.items.includes("autoPencil"), false);

  assert.ok(game.resolvePendingSemesterItem(chosen));
  assert.equal(game.pendingSemesterReward?.stage, "summaryUpgrade");
  assert.equal(game.items.includes(chosen), true);

  assert.equal(game.resolvePendingSemesterItem(chosen), null, "同一纪念物不能重复结算");
  assert.equal(game.resolvePendingSemesterItem(stale), null, "切换阶段后旧候选不能再领取");
  assert.equal(game.items.includes(stale), false);
  assert.equal(game.items.filter((id) => BOSS_ITEM_IDS.includes(id)).length, 1);
});

test("书包满时先冻结纪念物，替换成功才原子进入总结阶段", () => {
  const game = new SemesterGame(711, "aries");
  game.backpackCapacity = 2;
  game.items = ["autoPencil", "thickNotebook"];
  winFinalExam(game);
  const pending = game.prepareSemesterRewards(BOSS_ITEM_IDS);
  const [chosen, stale] = pending.itemChoices;
  const outgoing = game.items[0];

  const choice = game.resolvePendingSemesterItem(chosen);
  assert.equal(choice?.status, "replacement");
  assert.deepEqual(game.pendingItemReplacement, { incoming: chosen, source: "semester" });
  assert.equal(game.pendingSemesterReward?.stage, "bossItem");
  assert.equal(game.items.includes(chosen), false);

  const result = game.replacePendingItem(outgoing);
  assert.deepEqual(result, { incoming: chosen, outgoing, source: "semester" });
  assert.equal(game.pendingItemReplacement, null);
  assert.equal(game.pendingSemesterReward?.stage, "summaryUpgrade");
  assert.equal(game.items.includes(chosen), true);
  assert.equal(game.items.includes(outgoing), false);
  assert.equal(game.resolvePendingSemesterItem(stale), null);
  assert.equal(game.items.includes(stale), false);
});

test("期末升级必须来自总结阶段且有候选时不能空结算", () => {
  const noStage = new SemesterGame(706, "aries");
  noStage.week = 16;
  assert.equal(noStage.completeCurrentSemester(), false);
  assert.equal(noStage.awaitingNextSemester, false);

  const game = new SemesterGame(707, "aries");
  const target = game.deck.find((card) => !card.upgraded);
  const other = game.deck.find((card) => card.uid !== target.uid && !card.upgraded);
  assert.equal(game.upgradeCard(other.uid), true);
  enterSummaryUpgrade(game);

  assert.equal(game.completeCurrentSemester(), false, "存在可升级牌时不能跳过升级奖励");
  assert.equal(game.completeCurrentSemester("missing-uid"), false);
  assert.equal(game.completeCurrentSemester(other.uid), false, "已经升级的牌不能再次领取升级");
  assert.equal(game.awaitingNextSemester, false);
  assert.equal(game.pendingSemesterReward?.stage, "summaryUpgrade");
  assert.equal(target.upgraded, false);
  assert.equal(other.upgraded, true);
});

test("合法候选 UID 只升级一次并原子完成本学期", () => {
  const game = new SemesterGame(708, "gemini");
  const eligible = game.deck.filter((card) => !card.upgraded).slice(0, 2);
  enterSummaryUpgrade(game);

  assert.equal(game.completeCurrentSemester(eligible[0].uid), true);
  assert.equal(eligible[0].upgraded, true);
  assert.equal(eligible[1].upgraded, false);
  assert.equal(game.pendingSemesterReward, null);
  assert.equal(game.awaitingNextSemester, true);

  assert.equal(game.completeCurrentSemester(eligible[1].uid), false, "已结算阶段不能再升级第二张牌");
  assert.equal(eligible[1].upgraded, false);
});

test("所有牌均升级时可自动完成奖励，下一学期只能从等待状态进入一次", () => {
  const fresh = new SemesterGame(709, "cancer");
  const freshSnapshot = {
    semester: fresh.semester,
    week: fresh.week,
    maxHp: fresh.maxHp,
    backpackCapacity: fresh.backpackCapacity
  };
  assert.equal(fresh.startNextSemester(), false);
  assert.deepEqual({
    semester: fresh.semester,
    week: fresh.week,
    maxHp: fresh.maxHp,
    backpackCapacity: fresh.backpackCapacity
  }, freshSnapshot);

  const game = new SemesterGame(710, "cancer");
  for (const card of game.deck) {
    if (!card.upgraded) assert.equal(game.upgradeCard(card.uid), true);
  }
  enterSummaryUpgrade(game);
  assert.deepEqual(game.semesterUpgradeCandidates(), []);
  assert.equal(game.completeCurrentSemester(), true);
  assert.equal(game.awaitingNextSemester, true);

  const beforeNext = {
    semester: game.semester,
    maxHp: game.maxHp,
    backpackCapacity: game.backpackCapacity
  };
  assert.equal(game.startNextSemester(), true);
  assert.equal(game.semester, beforeNext.semester + 1);
  assert.equal(game.week, 1);
  assert.equal(game.maxHp, beforeNext.maxHp + 2);
  assert.equal(game.backpackCapacity, beforeNext.backpackCapacity + 1);
  assert.equal(game.awaitingNextSemester, false);

  const afterNext = {
    semester: game.semester,
    week: game.week,
    maxHp: game.maxHp,
    backpackCapacity: game.backpackCapacity
  };
  assert.equal(game.startNextSemester(), false);
  assert.deepEqual({
    semester: game.semester,
    week: game.week,
    maxHp: game.maxHp,
    backpackCapacity: game.backpackCapacity
  }, afterNext);
});
