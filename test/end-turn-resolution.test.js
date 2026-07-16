import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SemesterGame } from "../game-engine.js";
import { battleFeedbackFromDelta, enemyResolutionSnapshot } from "../app-flow.js";

function total(steps, key) {
  return steps.reduce((sum, step) => sum + step[key], 0);
}

test("回合末内耗与多段攻击分别结算且共同守恒", () => {
  const game = new SemesterGame(9001, "gemini");
  game.startCombat("groupChat");
  game.combat.playerBlock = 4;
  game.combat.endTurnHpLoss = 3;
  const hpBefore = game.hp;
  const hpLostBefore = game.stats.combatHpLost;

  const result = game.endTurn();

  assert.deepEqual(result.endTurnResult, { hpLossApplied: 3, lethal: false });
  assert.ok(result.enemyResult);
  assert.deepEqual(result.enemyResult.attack, {
    perHit: 3,
    hits: 2,
    hitsResolved: 2,
    blocked: 4,
    healthDamage: 2,
    segments: [
      { index: 1, blocked: 3, hpLoss: 0, blockAfter: 1 },
      { index: 2, blocked: 1, hpLoss: 2, blockAfter: 0 }
    ]
  });
  assert.equal(hpBefore - game.hp, 5);
  assert.equal(game.stats.combatHpLost - hpLostBefore, 5);
  assert.equal(total(result.enemyResult.attack.segments, "hpLoss"), result.enemyResult.attack.healthDamage);
  assert.equal(total(result.enemyResult.attack.segments, "blocked"), result.enemyResult.attack.blocked);
});

test("非攻击意图附带内耗时不会伪装成敌方攻击", () => {
  const game = new SemesterGame(9002, "cancer");
  game.startCombat("groupChat");
  game.combat.enemy.intentTurn = 1;
  game.combat.endTurnHpLoss = 3;
  const hpBefore = game.hp;

  const result = game.endTurn();

  assert.deepEqual(result.endTurnResult, { hpLossApplied: 3, lethal: false });
  assert.equal(result.enemyResult.attack, null);
  assert.equal(hpBefore - game.hp, 3);
  const feedback = battleFeedbackFromDelta(
    { playerHp: hpBefore },
    { playerHp: game.hp },
    { kind: "enemy", endTurnHpLoss: 3, enemyAttackHpLoss: 0 }
  );
  assert.equal(feedback.playerDamage, 0);
  assert.equal(feedback.motionType, "enemy-skill");
  assert.deepEqual(feedback.summaryParts, ["情绪内耗 -3"]);
});

test("内耗先致死时明确跳过敌方行动并保留护甲和意图", () => {
  const game = new SemesterGame(9003, "aries");
  game.hp = 4;
  game.startCombat("sleepyBug");
  game.combat.playerBlock = 99;
  game.combat.endTurnHpLoss = 4;
  const intentTurn = game.combat.enemy.intentTurn;

  assert.deepEqual(game.incomingDamagePreview(), {
    perHit: 5,
    hits: 1,
    attackTotal: 5,
    currentBlock: 99,
    blocked: 0,
    attackHpLoss: 0,
    endTurnHpLoss: 4,
    totalHpLoss: 4,
    hpAfter: 0,
    lethal: true
  });
  const result = game.endTurn();

  assert.deepEqual(result, {
    ok: true,
    endTurnResult: { hpLossApplied: 4, lethal: true },
    enemyResult: null
  });
  assert.equal(game.hp, 0);
  assert.equal(game.combat.status, "lost");
  assert.equal(game.combat.playerBlock, 99);
  assert.equal(game.combat.enemy.intentTurn, intentTurn);
  assert.equal(game.stats.combatHpLost, 4);
});

test("内耗超过剩余生命时只记录实际损失", () => {
  const game = new SemesterGame(9004, "aries");
  game.hp = 3;
  game.startCombat("sleepyBug");
  game.combat.endTurnHpLoss = 9;

  assert.equal(game.incomingDamagePreview().endTurnHpLoss, 3);
  const result = game.endTurn();

  assert.deepEqual(result.endTurnResult, { hpLossApplied: 3, lethal: true });
  assert.equal(result.enemyResult, null);
  assert.equal(game.stats.combatHpLost, 3);
});

test("多段攻击中途致死后停止虚假命中并封顶统计", () => {
  const game = new SemesterGame(9005, "gemini");
  game.hp = 2;
  game.startCombat("groupChat");
  game.combat.hand = [game.createCard("nervous"), game.createCard("nervous")];
  game.combat.drawPile = [];
  game.combat.discardPile = [];
  assert.equal(game.getIntent().hits, 4);

  const result = game.endTurn();

  assert.equal(result.enemyResult.attack.hits, 4);
  assert.equal(result.enemyResult.attack.hitsResolved, 1);
  assert.equal(result.enemyResult.attack.healthDamage, 2);
  assert.deepEqual(result.enemyResult.attack.segments, [
    { index: 1, blocked: 0, hpLoss: 2, blockAfter: 0 }
  ]);
  assert.equal(game.stats.combatHpLost, 2);
});

test("正式分段结果驱动反馈与结算快照，不再使用预览冒充事实", () => {
  const feedback = battleFeedbackFromDelta(
    { playerHp: 50, playerBlock: 4 },
    { playerHp: 45, playerBlock: 0 },
    {
      kind: "enemy",
      endTurnHpLoss: 3,
      enemyAttackHpLoss: 2,
      playerBlockAbsorbed: 4,
      hidePlayerDamageNumber: true
    }
  );
  assert.equal(feedback.playerDamage, 2);
  assert.equal(feedback.endTurnHpLoss, 3);
  assert.equal(feedback.totalPlayerHpLoss, 5);
  assert.equal(feedback.observedPlayerHpLoss, 5);
  assert.equal(feedback.hidePlayerDamageNumber, true);
  assert.equal(feedback.motionType, "enemy-attack");
  assert.deepEqual(feedback.summaryParts, ["情绪内耗 -3", "生命 -2", "护甲挡下 4"]);

  const resolvedSteps = [
    { index: 1, blocked: 3, hpLoss: 0, blockAfter: 1 },
    { index: 2, blocked: 1, hpLoss: 2, blockAfter: 0 }
  ];
  const snapshot = enemyResolutionSnapshot({
    name: "消息轰炸",
    hitBreakdown: resolvedSteps,
    incoming: { perHit: 99, hits: 4, currentBlock: 0 }
  }, feedback);
  assert.deepEqual(snapshot.hitBreakdown, resolvedSteps);

  const selfLoss = battleFeedbackFromDelta(
    { playerHp: 4 },
    { playerHp: 0 },
    { kind: "status", endTurnHpLoss: 4, enemyAttackHpLoss: 0 }
  );
  assert.equal(selfLoss.playerDamage, 0);
  assert.equal(selfLoss.motionType, "status");
  assert.equal(selfLoss.tone, "danger");
  assert.deepEqual(selfLoss.summaryParts, ["情绪内耗 -4"]);
});

test("结束回合界面只在敌人真实行动时创建敌方结算", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const start = appSource.indexOf("function finishPlayerTurn(");
  const end = appSource.indexOf("\nfunction ", start + 1);
  const source = appSource.slice(start, end);

  assert.match(source, /if \(!result\.enemyResult\)[\s\S]*?queueBattleFeedback\("status", "情绪内耗"/);
  assert.match(source, /enemyAttackHpLoss: enemyAttack\?\.healthDamage \|\| 0/);
  assert.match(source, /playerBlockAbsorbed: enemyAttack\?\.blocked \|\| 0/);
  assert.match(source, /enemyBlockGain: result\.enemyResult\.block\?\.gained \|\| 0/);
  assert.match(source, /hitBreakdown,/);
  assert.doesNotMatch(source, /incomingDamagePreview\(\)/);
});
