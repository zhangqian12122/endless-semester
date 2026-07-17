import test from "node:test";
import assert from "node:assert/strict";

import {
  canSelectPersona,
  createCareerProfile,
  normalizeCareerProfile,
  recordSemesterCompletion
} from "../career.js";
import { SemesterGame } from "../game-engine.js";

function activeCombat(seed, enemyId) {
  const game = new SemesterGame(seed, "cancer");
  game.startCombat(enemyId);
  game.combat.enemy.maxHp = 999;
  game.combat.enemy.hp = 999;
  return game;
}

test("第二人格不能靠污染解锁列表绕过二周目门槛", () => {
  const forged = {
    ...createCareerProfile(),
    highestSemesterCompleted: 1,
    unlockedPersonaIds: ["student", "summoner", "summoner"]
  };

  assert.equal(canSelectPersona(forged, "summoner"), false);
  const sanitized = normalizeCareerProfile(forged);
  assert.equal(sanitized.highestSemesterCompleted, 1);
  assert.deepEqual(sanitized.unlockedPersonaIds, ["student"]);
  assert.equal(canSelectPersona(sanitized, "summoner"), false);

  recordSemesterCompletion(sanitized, 2);
  assert.deepEqual(sanitized.unlockedPersonaIds, ["student", "summoner"]);
  assert.equal(canSelectPersona(sanitized, "summoner"), true);

  const restoredWithoutCachedList = normalizeCareerProfile({
    ...sanitized,
    unlockedPersonaIds: []
  });
  assert.deepEqual(restoredWithoutCachedList.unlockedPersonaIds, ["student", "summoner"]);
  assert.equal(canSelectPersona(restoredWithoutCachedList, "summoner"), true);
});

test("点名巡察官统计三个活跃牌区的待办并把追查严格封顶四段", () => {
  const game = activeCombat(9401, "rollCallWarden");
  game.combat.enemy.intentTurn = 1;
  game.combat.hand = [game.createCard("todo")];
  game.combat.drawPile = [game.createCard("todo")];
  game.combat.discardPile = [game.createCard("todo"), game.createCard("todo")];
  game.combat.playerBlock = 5;

  const intent = game.getIntent();
  assert.equal(intent.attack, 4);
  assert.equal(intent.hits, 4);
  assert.deepEqual(intent.mechanicState, {
    type: "statusHits",
    label: "缺席",
    statusId: "todo",
    value: 2,
    cap: 2,
    sourceCount: 4
  });

  const hpBefore = game.hp;
  const result = game.executeEnemyTurn(intent);
  assert.equal(result.attack.hitsResolved, 4);
  assert.equal(result.attack.blocked, 5);
  assert.equal(result.attack.healthDamage, 11);
  assert.equal(game.hp, hpBefore - 11);
  assert.equal(game.combat.playerBlock, 0);
});

test("招新喇叭精的三步循环真实执行多段、状态和无伤窗口", () => {
  const game = activeCombat(9402, "clubMegaphone");
  game.combat.playerBlock = 5;

  const hpBefore = game.hp;
  const broadcast = game.executeEnemyTurn();
  assert.equal(broadcast.attack.perHit, 4);
  assert.equal(broadcast.attack.hitsResolved, 3);
  assert.deepEqual(
    broadcast.attack.segments.map(({ blocked, hpLoss }) => ({ blocked, hpLoss })),
    [
      { blocked: 4, hpLoss: 0 },
      { blocked: 1, hpLoss: 3 },
      { blocked: 0, hpLoss: 4 }
    ]
  );
  assert.equal(game.hp, hpBefore - 7);

  const nervousBefore = game.combat.discardPile.filter((card) => card.id === "nervous").length;
  const signup = game.executeEnemyTurn();
  assert.equal(signup.attack.healthDamage, 6);
  assert.deepEqual(signup.statusAdded, { id: "nervous", count: 1, zone: "discard" });
  assert.equal(
    game.combat.discardPile.filter((card) => card.id === "nervous").length,
    nervousBefore + 1
  );

  const cover = game.executeEnemyTurn();
  assert.equal(cover.attack, null);
  assert.deepEqual(cover.block, { gained: 7 });
  assert.deepEqual(cover.debuff, { id: "distracted", applied: true, blockedBy: null });
  assert.equal(game.combat.enemy.block, 7);
  assert.equal(game.combat.distracted, true);
});

test("临时用品在战外或待弃牌阶段失败时保持库存，成功后才一次性消耗", () => {
  const game = new SemesterGame(9403, "cancer");
  assert.equal(game.addSupply("campusIceTea"), true);

  assert.equal(game.useSupply("campusIceTea").ok, false);
  assert.deepEqual(game.supplies, ["campusIceTea"]);

  game.startCombat("sleepyBug");
  game.combat.pendingDiscard = { count: 1, reason: "test" };
  const energyBefore = game.combat.energy;
  assert.equal(game.useSupply("campusIceTea").ok, false);
  assert.deepEqual(game.supplies, ["campusIceTea"]);
  assert.equal(game.combat.energy, energyBefore);

  game.combat.pendingDiscard = null;
  game.combat.hand = [];
  game.combat.drawPile = [game.createCard("textbookStrike")];
  game.combat.discardPile = [];
  assert.equal(game.useSupply("campusIceTea").ok, true);
  assert.deepEqual(game.supplies, []);
  assert.equal(game.combat.energy, energyBefore + 1);
  assert.equal(game.combat.hand.length, 1);
  assert.equal(game.useSupply("campusIceTea").ok, false);
});
