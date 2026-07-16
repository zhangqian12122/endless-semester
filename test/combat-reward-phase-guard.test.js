import test from "node:test";
import assert from "node:assert/strict";
import {
  CHALLENGE_RULES,
  HIGH_THREAT_ROUTE_BONUS_GOLD,
  NORMAL_COMBAT_REWARD_GOLD,
  SemesterGame
} from "../game-engine.js";

function readyGame(seed, archetypeId = "cancer") {
  const game = new SemesterGame(seed, archetypeId);
  assert.equal(game.chooseTarot("strength"), true);
  return game;
}

function startCheckedCombat(game, enemyId, outcome = "normal", modifiers = {}) {
  const pending = game.prepareCombatStart(enemyId, outcome, modifiers);
  assert.ok(pending, `应能建立 ${outcome} 战斗检查点`);
  const combat = game.startCombat(pending.enemyId, pending.modifiers);
  assert.equal(combat.enemy.id, enemyId);
  return combat;
}

function winCombat(game) {
  game.combat.enemy.hp = 0;
  assert.equal(game.checkCombatEnd(), "won");
  assert.equal(game.combat.result, "won");
}

function loseCombat(game) {
  game.hp = 0;
  assert.equal(game.checkCombatEnd(), "lost");
  assert.equal(game.combat.result, "lost");
}

function rewardState(game) {
  return {
    gold: game.gold,
    rngState: game.rng.state,
    rewardIndex: game.rewardIndex,
    pendingCombatReward: game.pendingCombatReward
  };
}

function assertNormalRewardRejected(game, message) {
  const before = rewardState(game);
  assert.equal(game.prepareNormalCombatReward(), null, message);
  assert.deepEqual(rewardState(game), before, `${message}，且不能改动金币、随机数或奖励状态`);
}

function findChallenge(game) {
  for (let week = 3; week <= 15; week += 1) {
    const node = game.semesterPlan[week]?.find((candidate) => candidate.challenge);
    if (node) return { week, node };
  }
  assert.fail("测试路线缺少挑战战");
}

test("没有战斗事实时不能领取普通战奖励", () => {
  const game = readyGame(1701);
  assertNormalRewardRejected(game, "没有战斗事实时不能发奖");
});

test("只建立再清除普通战检查点不能领取奖励", () => {
  const game = readyGame(1702);
  assert.ok(game.prepareCombatStart("sleepyBug", "normal"));
  assert.equal(game.completePendingCombatStart(), true);
  assertNormalRewardRejected(game, "只建立再清除检查点不等于赢得战斗");
});

test("与普通战检查点敌人不匹配的胜利不能领取奖励", () => {
  const game = readyGame(1703);
  assert.ok(game.prepareCombatStart("sleepyBug", "normal"));
  game.startCombat("homeworkBlob");
  winCombat(game);
  assert.equal(game.completePendingCombatStart(), true);
  assertNormalRewardRejected(game, "敌人与已保存检查点不匹配时不能伪造普通胜利来源");
});

test("胜利战斗事实被清除后不能补领普通战奖励", () => {
  const game = readyGame(1704);
  startCheckedCombat(game, "sleepyBug");
  winCombat(game);
  assert.equal(game.completePendingCombatStart(), true);
  game.combat = null;
  assertNormalRewardRejected(game, "胜利战斗事实已清除后不能补领奖励");
});

test("普通战进行中不能领取奖励，即使开局检查点已经清除", () => {
  const game = readyGame(1710);
  startCheckedCombat(game, "sleepyBug");
  assert.equal(game.completePendingCombatStart(), true);
  assert.equal(game.combat.status, "active");
  assertNormalRewardRejected(game, "战斗尚未胜利时不能发奖");
});

test("普通战战败后不能领取奖励", () => {
  const game = readyGame(1711);
  startCheckedCombat(game, "sleepyBug");
  loseCombat(game);
  assert.equal(game.completePendingCombatStart(), true);
  assertNormalRewardRejected(game, "战败不能发放普通战奖励");
});

test("普通战胜利只结算一次基础奖励，待领奖状态与刷新恢复保持幂等", () => {
  const game = readyGame(1720);
  startCheckedCombat(game, "sleepyBug");
  winCombat(game);
  assert.equal(game.completePendingCombatStart(), true);

  const goldBefore = game.gold;
  const first = game.prepareNormalCombatReward();
  assert.equal(first?.started, true);
  assert.equal(first?.gold, NORMAL_COMBAT_REWARD_GOLD);
  assert.equal(first?.bonusGold, 0);
  assert.equal(game.gold, goldBefore + NORMAL_COMBAT_REWARD_GOLD);
  assert.equal(first.choices.length, 3);

  const afterFirst = rewardState(game);
  const repeated = game.prepareNormalCombatReward();
  assert.equal(repeated?.started, false);
  assert.deepEqual(repeated.choices, first.choices);
  assert.deepEqual(rewardState(game), afterFirst, "重复准备不能再次发币或重抽候选");

  const restored = SemesterGame.fromJSON(game.toJSON());
  const restoredBefore = rewardState(restored);
  const resumed = restored.prepareNormalCombatReward();
  assert.equal(resumed?.started, false);
  assert.deepEqual(resumed.choices, first.choices);
  assert.deepEqual(rewardState(restored), restoredBefore, "刷新恢复待领奖状态不能再次结算");

  assert.equal(game.completePendingCombatReward(), true);
  assertNormalRewardRejected(game, "同一场普通胜利的待领奖状态完成后不能再次生成一份奖励");
});

test("核心周高威胁普通战胜利只结算一次基础奖励与高压加练奖金", () => {
  const game = readyGame(1730);
  game.week = 4;
  const routes = [...game.semesterPlan[game.week]]
    .sort((left, right) => left.routeThreat - right.routeThreat);
  const riskier = routes.at(-1);
  assert.equal(riskier.bonusGold, HIGH_THREAT_ROUTE_BONUS_GOLD);

  startCheckedCombat(game, riskier.enemy);
  winCombat(game);
  assert.equal(game.completePendingCombatStart(), true);
  const goldBefore = game.gold;

  const first = game.prepareNormalCombatReward();
  assert.equal(first?.started, true);
  assert.equal(first?.bonusGold, HIGH_THREAT_ROUTE_BONUS_GOLD);
  assert.equal(first?.gold, NORMAL_COMBAT_REWARD_GOLD + HIGH_THREAT_ROUTE_BONUS_GOLD);
  assert.equal(game.gold, goldBefore + NORMAL_COMBAT_REWARD_GOLD + HIGH_THREAT_ROUTE_BONUS_GOLD);

  const afterFirst = rewardState(game);
  assert.equal(game.prepareNormalCombatReward()?.started, false);
  assert.deepEqual(rewardState(game), afterFirst, "高压加练奖金不能重复到账");
});

test("校园怪谈胜利不能冒充普通战领取基础奖励", () => {
  const game = readyGame(1740);
  game.week = 3;
  assert.equal(game.preparePendingEvent("campusRumor"), true);
  const rumorEnemy = game.campusRumorPreview().enemyId;
  startCheckedCombat(game, rumorEnemy, "event", { hpMultiplier: 1.3 });
  winCombat(game);
  assert.equal(game.completePendingCombatStart(), true);
  assert.equal(game.completePendingEvent(), true);
  assertNormalRewardRejected(game, "怪谈强化普通敌人仍属于事件奖励来源");
});

test("挑战胜利不能冒充普通战领取基础或高压奖励", () => {
  const game = readyGame(1741);
  const { week, node } = findChallenge(game);
  game.week = week;
  startCheckedCombat(game, node.enemy, "challenge", {
    challenge: true,
    hpMultiplier: CHALLENGE_RULES.hpMultiplier,
    damageMultiplier: CHALLENGE_RULES.damageMultiplier,
    affix: node.affix
  });
  winCombat(game);
  assert.equal(game.completePendingCombatStart(), true);
  assertNormalRewardRejected(game, "挑战胜利只能进入挑战奖励链");
});
