import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_PET_ID, PET_EGG_DEFS } from "../game-data.js";
import { SemesterGame } from "../game-engine.js";

function findRestWeek(game, after = 0) {
  for (let week = after + 1; week <= 15; week += 1) {
    if (game.semesterPlan[week]?.some((node) => node.type === "rest")) return week;
  }
  for (let week = 1; week <= after; week += 1) {
    if (game.semesterPlan[week]?.some((node) => node.type === "rest")) return week;
  }
  throw new Error("测试学期没有休息节点");
}

function prepareRest(game, after = 0) {
  if (!game.tarotId) assert.equal(game.chooseTarot("chariot"), true);
  game.week = findRestWeek(game, after);
  const pending = game.prepareRest();
  assert.equal(pending?.stage, "choice");
  return game.week;
}

function winCombat(game, enemyId = "alarmClock") {
  game.startCombat(enemyId);
  game.combat.enemy.hp = 0;
  game.checkCombatEnd();
  return game.combat;
}

test("战斗胜利和旧推进入口都不会推进宠物蛋", () => {
  const game = new SemesterGame(8101, "aries");
  game.claimEgg("sleepyBugEgg");

  const combat = winCombat(game);
  assert.deepEqual(game.incubator, { eggId: "sleepyBugEgg", battles: 0 });
  assert.equal(combat.petIncubationEvent, null);
  assert.equal(game.combatSummary().petIncubationEvent, null);

  assert.equal(game.advanceIncubatorAfterVictory(combat), null);
  assert.deepEqual(game.incubator, { eggId: "sleepyBugEgg", battles: 0 });
});

test("只有休息节点的主动孵化会推进一次，并冻结结算防止重复点击", () => {
  const game = new SemesterGame(8102, "cancer");
  game.claimEgg("sleepyBugEgg");

  assert.equal(game.resolveRestHatch(), null);
  prepareRest(game);
  const first = game.resolveRestHatch();
  assert.deepEqual(first, {
    type: "progress",
    eggId: "sleepyBugEgg",
    petId: "sleepyBugCub",
    battles: 1,
    requiredCombats: 3
  });
  assert.deepEqual(game.incubator, { eggId: "sleepyBugEgg", battles: 1 });
  assert.deepEqual(game.pendingRest, { stage: "hatch", cardUids: [], ...first });

  assert.equal(game.resolveRestHatch(), null);
  assert.deepEqual(game.incubator, { eggId: "sleepyBugEgg", battles: 1 });
});

test("孵化结算可跨刷新恢复，恢复后不会重复推进", () => {
  const game = new SemesterGame(8103, "gemini");
  game.claimEgg("sleepyBugEgg");
  prepareRest(game);
  const settled = game.resolveRestHatch();

  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.deepEqual(restored.pendingRest, { stage: "hatch", cardUids: [], ...settled });
  assert.deepEqual(restored.incubator, { eggId: "sleepyBugEgg", battles: 1 });
  assert.equal(restored.resolveRestHatch(), null);
  assert.deepEqual(restored.incubator, { eggId: "sleepyBugEgg", battles: 1 });
  assert.equal(restored.completePendingRest(), true);
  assert.equal(restored.pendingRest, null);
});

test("主动孵化三次才解锁幼崽，且不会自动替换当前宠物", () => {
  const game = new SemesterGame(8104, "aries");
  const egg = PET_EGG_DEFS.sleepyBugEgg;
  game.claimEgg(egg.id);
  const startingPet = game.pet;
  let previousWeek = 0;

  for (let attempt = 1; attempt <= egg.requiredCombats; attempt += 1) {
    previousWeek = prepareRest(game, previousWeek);
    const result = game.resolveRestHatch();
    assert.equal(result.battles, attempt);
    assert.equal(result.type, attempt === egg.requiredCombats ? "hatched" : "progress");
    assert.equal(game.resolveRestHatch(), null);
    assert.equal(game.completePendingRest(), true);
  }

  assert.equal(game.incubator, null);
  assert.equal(game.hasPet(egg.petId), true);
  assert.equal(game.activePetId, DEFAULT_PET_ID);
  assert.equal(game.pet, startingPet);
  assert.notEqual(game.pet, game.pets[egg.petId]);
});

test("旧存档的 battles 进度会迁移，并可在下一次休息完成孵化", () => {
  const source = new SemesterGame(8105, "cancer");
  source.claimEgg("sleepyBugEgg");
  source.incubator.battles = 2;
  prepareRest(source);

  const restored = SemesterGame.fromJSON(source.toJSON());
  assert.deepEqual(restored.incubator, { eggId: "sleepyBugEgg", battles: 2 });
  const hatched = restored.resolveRestHatch();
  assert.equal(hatched.type, "hatched");
  assert.equal(hatched.battles, 3);
  assert.equal(restored.hasPet("sleepyBugCub"), true);
  assert.equal(restored.activePetId, DEFAULT_PET_ID);

  const settledReload = SemesterGame.fromJSON(restored.toJSON());
  assert.deepEqual(settledReload.pendingRest, { stage: "hatch", cardUids: [], ...hatched });
  assert.equal(settledReload.resolveRestHatch(), null);
  assert.equal(settledReload.activePetId, DEFAULT_PET_ID);
});
