import test from "node:test";
import assert from "node:assert/strict";

import { BOSS_ITEM_IDS, DEFAULT_PET_ID, ENEMY_DEFS, PET_EGG_DEFS } from "../game-data.js";
import * as Engine from "../game-engine.js";

const { SemesterGame } = Engine;
const MILK_DRAGON_ID = "madMilkDragon";

function semesterBossId(semester) {
  assert.equal(typeof Engine.semesterBossId, "function", "引擎应导出 semesterBossId(semester)");
  return Engine.semesterBossId(semester);
}

function milkDragonEgg() {
  const egg = Object.values(PET_EGG_DEFS).find((candidate) => (
    candidate.sourceEnemyIds?.includes(MILK_DRAGON_ID)
  ));
  assert.ok(egg, "魔笑奶龙应配置一枚来源明确的宠物蛋");
  assert.equal(egg.requiredCombats, 3, "奶龙蛋仍需在休息区主动孵化 3 次");
  return egg;
}

function secondSemesterAtBoss(seed, { incubatingEggId = null } = {}) {
  const game = new SemesterGame(seed, "cancer");
  game.semester = 2;
  game.week = 16;
  game.semesterPlan = game.generateSemesterPlan();
  assert.equal(game.chooseTarot("chariot"), true);
  if (incubatingEggId) assert.ok(game.claimEgg(incubatingEggId));

  const node = game.semesterPlan[16][0];
  assert.equal(node.enemy, MILK_DRAGON_ID);
  const pending = game.prepareCombatStart(node.enemy, "boss");
  assert.ok(pending, "第二学期第 16 周应建立魔笑奶龙 Boss 开局检查点");
  game.startCombat(pending.enemyId, pending.modifiers);
  game.combat.enemy.hp = 0;
  assert.equal(game.checkCombatEnd(), "won");
  assert.equal(game.completePendingCombatStart(), true);
  return game;
}

function findRestWeek(game, after = 0) {
  for (let week = after + 1; week <= 15; week += 1) {
    if (game.semesterPlan[week]?.some((node) => node.type === "rest")) return week;
  }
  for (let week = 1; week <= after; week += 1) {
    if (game.semesterPlan[week]?.some((node) => node.type === "rest")) return week;
  }
  throw new Error("测试学期没有休息节点");
}

function hatchOnceAtRest(game, after = 0) {
  game.week = findRestWeek(game, after);
  assert.equal(game.prepareRest()?.stage, "choice");
  const result = game.resolveRestHatch();
  assert.ok(result);
  assert.equal(game.resolveRestHatch(), null, "同一个休息节点不能重复推进孵化");
  assert.equal(game.completePendingRest(), true);
  return { result, week: game.week };
}

test("第一学期仍是期末考试，第二学期改为魔笑奶龙且动态路线可保存恢复", () => {
  assert.equal(semesterBossId(1), "finalExam");
  assert.equal(semesterBossId(2), MILK_DRAGON_ID);
  assert.equal(ENEMY_DEFS[MILK_DRAGON_ID]?.kind, "boss");

  const first = new SemesterGame(8201, "aries");
  assert.equal(first.semesterPlan[16][0].enemy, "finalExam");

  const second = new SemesterGame(8202, "gemini");
  second.semester = 2;
  second.semesterPlan = second.generateSemesterPlan();
  assert.equal(second.semesterPlan[16][0].enemy, MILK_DRAGON_ID);

  const restored = SemesterGame.fromJSON(second.toJSON());
  assert.equal(restored.semester, 2);
  assert.equal(restored.semesterPlan[16][0].enemy, MILK_DRAGON_ID);
  assert.deepEqual(restored.semesterPlan, second.semesterPlan, "合法的第二学期路线不能在读档时被重建");
});

test("魔笑奶龙胜利只冻结一次奶龙蛋奖励，领取与重复点击保持原子", () => {
  const egg = milkDragonEgg();
  const game = secondSemesterAtBoss(8203);
  assert.deepEqual(game.queuedEggIds, []);

  const first = game.prepareSemesterRewards(BOSS_ITEM_IDS);
  assert.equal(first?.stage, "bossEgg");
  assert.equal(first?.eggId, egg.id);
  assert.equal(first?.started, true);
  assert.equal(game.incubator, null, "冻结奖励时不能提前把蛋塞进孵化位");

  const repeated = game.prepareSemesterRewards(BOSS_ITEM_IDS);
  assert.equal(repeated?.stage, "bossEgg");
  assert.equal(repeated?.eggId, egg.id);
  assert.equal(repeated?.started, false);
  assert.deepEqual(repeated?.itemChoices, first.itemChoices);
  assert.equal(game.incubator, null);

  assert.ok(game.resolvePendingSemesterEgg());
  assert.deepEqual(game.incubator, { eggId: egg.id, battles: 0 });
  assert.deepEqual(game.queuedEggIds, []);
  assert.equal(game.pendingSemesterReward?.stage, "bossItem");
  assert.equal(game.resolvePendingSemesterEgg(), null, "领取后旧的 Boss 蛋按钮必须失效");
  assert.equal([
    game.incubator?.eggId,
    ...game.queuedEggIds
  ].filter((eggId) => eggId === egg.id).length, 1);
});

test("孵化位占用时奶龙蛋进入队列，当前蛋完成后自动接续且仍需三次休息", () => {
  const sleepyEgg = PET_EGG_DEFS.sleepyBugEgg;
  const milkEgg = milkDragonEgg();
  assert.ok(sleepyEgg);

  const game = secondSemesterAtBoss(8204, { incubatingEggId: sleepyEgg.id });
  assert.deepEqual(game.incubator, { eggId: sleepyEgg.id, battles: 0 });
  assert.deepEqual(game.queuedEggIds, []);

  assert.equal(game.prepareSemesterRewards(BOSS_ITEM_IDS)?.stage, "bossEgg");
  assert.ok(game.resolvePendingSemesterEgg());
  assert.deepEqual(game.incubator, { eggId: sleepyEgg.id, battles: 0 });
  assert.deepEqual(game.queuedEggIds, [milkEgg.id]);

  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.deepEqual(restored.incubator, { eggId: sleepyEgg.id, battles: 0 });
  assert.deepEqual(restored.queuedEggIds, [milkEgg.id], "排队中的 Boss 蛋必须跨刷新保存");

  assert.equal(restored.skipPendingSemesterItem(), true);
  assert.equal(restored.completeCurrentSemester(restored.semesterUpgradeCandidates()[0].uid), true);
  assert.equal(restored.startNextSemester(), true);
  assert.equal(restored.chooseTarot("chariot"), true);

  restored.incubator.battles = sleepyEgg.requiredCombats - 1;
  const currentHatch = hatchOnceAtRest(restored);
  assert.equal(currentHatch.result.type, "hatched");
  assert.equal(currentHatch.result.eggId, sleepyEgg.id);
  assert.equal(restored.hasPet(sleepyEgg.petId), true);
  assert.deepEqual(restored.incubator, { eggId: milkEgg.id, battles: 0 }, "当前蛋孵化后应自动启用队首奶龙蛋");
  assert.deepEqual(restored.queuedEggIds, []);
  assert.equal(restored.activePetId, DEFAULT_PET_ID, "孵化不能自动替换本局参战宠物");

  let previousWeek = currentHatch.week;
  for (let attempt = 1; attempt <= milkEgg.requiredCombats; attempt += 1) {
    const settled = hatchOnceAtRest(restored, previousWeek);
    previousWeek = settled.week;
    assert.equal(settled.result.eggId, milkEgg.id);
    assert.equal(settled.result.battles, attempt);
    assert.equal(
      settled.result.type,
      attempt === milkEgg.requiredCombats ? "hatched" : "progress"
    );
  }

  assert.equal(restored.hasPet(milkEgg.petId), true);
  assert.equal(restored.incubator, null);
  assert.deepEqual(restored.queuedEggIds, []);
  assert.equal(restored.activePetId, DEFAULT_PET_ID);
  assert.notEqual(restored.pet, restored.pets[milkEgg.petId]);
});
