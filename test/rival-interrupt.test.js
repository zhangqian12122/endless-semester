import test from "node:test";
import assert from "node:assert/strict";

import { SemesterGame } from "../game-engine.js";
import { ENEMY_DEFS } from "../game-data.js";
import {
  combatCardTacticalCue,
  combatRivalInterruptProjection,
  enemyIntentDetailLines,
  enemyMechanicProgress,
  enemyResolutionSnapshot
} from "../app-flow.js";

test("卷王只累计穿甲后的真实生命伤害，满 10 后当前公开攻击固定降低 3", () => {
  const game = new SemesterGame(9101, "cancer");
  game.startCombat("rivalShadow");

  assert.equal(game.getIntent().attack, 6);
  assert.deepEqual(game.getIntent().mechanicState, {
    type: "rivalInterrupt",
    label: "打断内卷",
    value: 0,
    cap: 10,
    sourceCount: 0,
    triggered: false,
    attackReduction: 3,
    reduction: 0,
    attackBefore: 6,
    attackAfter: 6
  });

  game.combat.enemy.block = 4;
  assert.equal(game.damageEnemy(6, 1), 2, "被敌方护甲吸收的 4 点不能进入进度");
  assert.equal(game.getIntent().mechanicState.value, 2);
  assert.equal(game.damageEnemy(4, 2), 8, "多段攻击按每段实际扣血合计");

  const interrupted = game.getIntent();
  assert.equal(interrupted.attack, 3);
  assert.equal(interrupted.mechanicState.triggered, true);
  assert.equal(interrupted.mechanicState.value, 10);
  game.damageEnemy(5, 1);
  assert.equal(game.getIntent().attack, 3, "同一玩家回合不能重复降低攻击");
  assert.equal(game.combat.log.filter((entry) => entry.startsWith("打断内卷：")).length, 1);
  assert.equal(game.incomingDamagePreview().perHit, 3);

  const resolved = game.endTurn().enemyResult;
  assert.equal(resolved.attack.perHit, 3, "实际结算必须复用玩家看到的减伤后意图");
  assert.equal(resolved.mechanicState.triggered, true);
  assert.equal(game.getIntent().attack, 8, "下一次行动仍按 6→8 正常成长");
  assert.equal(game.getIntent().mechanicState.value, 0, "下一玩家回合重新累计打断进度");
});

test("伤害卡与宠物共用打断进度，斩杀来源不会产生无意义触发", () => {
  const game = new SemesterGame(9102, "cancer");
  game.startCombat("rivalShadow");
  game.combat.hand = [game.createCard("catCombo")];
  game.combat.drawPile = [];
  game.combat.discardPile = [];
  game.combat.energy = 3;

  assert.equal(game.playCard(game.combat.hand[0].uid).ok, true);
  assert.equal(game.getIntent().mechanicState.value, 6);
  game.combat.enemy.block = 3;
  game.pet.charge = game.pet.maxCharge;
  assert.equal(game.usePetSkill().ok, true);
  assert.equal(game.getIntent().mechanicState.value, 10, "宠物 7 伤被护甲挡 3 后只补入 4 点");
  assert.equal(game.getIntent().attack, 3);

  const lethal = new SemesterGame(9103, "cancer");
  lethal.startCombat("rivalShadow");
  lethal.combat.enemy.hp = 10;
  assert.equal(lethal.damageEnemy(10, 1), 10);
  assert.equal(lethal.combat.enemy.interruptDamageThisTurn, 0);
  assert.doesNotMatch(lethal.combat.log.join("\n"), /打断内卷：/);
});

test("挑战倍率先结算再固定减 3，预览与实际伤害一致", () => {
  const game = new SemesterGame(9104, "cancer");
  game.startCombat("rivalShadow", {
    challenge: true,
    affix: "backlog",
    hpMultiplier: 1.35,
    damageMultiplier: 1.25
  });

  assert.equal(game.getIntent().attack, 8);
  game.damageEnemy(10, 1);
  assert.equal(game.getIntent().mechanicState.attackBefore, 8);
  assert.equal(game.getIntent().attack, 5, "8 应固定降至 5，而不是再次参与倍率");
  assert.equal(game.incomingDamagePreview().perHit, 5);
  assert.equal(game.endTurn().enemyResult.attack.perHit, 5);
});

test("非卷王敌人不会获得打断状态或被玩家伤害改写意图", () => {
  const game = new SemesterGame(9105, "cancer");
  game.startCombat("sleepyBug");
  const before = game.getIntent();
  game.damageEnemy(5, 1);
  const after = game.getIntent();
  assert.equal(after.attack, before.attack);
  assert.equal(after.mechanicState, undefined);
});

test("卷王进度、意图说明、跨阈值卡牌提示与结算快照使用同一机制状态", () => {
  const mechanicState = {
    type: "rivalInterrupt",
    label: "打断内卷",
    value: 7,
    cap: 10,
    sourceCount: 7,
    triggered: false,
    attackReduction: 3,
    reduction: 0,
    attackBefore: 6,
    attackAfter: 6
  };
  const incoming = {
    perHit: 6,
    hits: 1,
    attackTotal: 6,
    currentBlock: 0,
    endTurnHpLoss: 0,
    totalHpLoss: 6,
    lethal: true
  };

  assert.equal(combatRivalInterruptProjection({ healthDamage: 2 }, incoming, mechanicState), null);
  assert.deepEqual(combatRivalInterruptProjection({ healthDamage: 3 }, incoming, mechanicState), {
    valueBefore: 7,
    valueAfter: 10,
    cap: 10,
    healthDamage: 3,
    attackReduction: 3,
    perHitBefore: 6,
    perHitAfter: 3,
    hits: 1,
    attackTotalAfter: 3
  });
  const rescue = combatCardTacticalCue({ healthDamage: 3 }, incoming, {
    enemyHp: 40,
    playerHp: 5,
    mechanicState
  });
  assert.equal(rescue.tone, "rescue");
  assert.match(rescue.label, /打断内卷 · 攻击 6→3 · 脱险/);
  assert.equal(combatCardTacticalCue({ healthDamage: 40 }, incoming, {
    enemyHp: 40,
    playerHp: 5,
    mechanicState
  }).tone, "finish", "斩杀提示优先于打断提示");
  assert.equal(combatCardTacticalCue({ healthDamage: 10, selfDamage: 2 }, incoming, {
    enemyHp: 10,
    playerHp: 2,
    mechanicState: { ...mechanicState, value: 0 }
  }), null, "敌我同时归零时不能预告实际不会触发的打断");

  const intentLines = enemyIntentDetailLines({ attack: 6, mechanicState });
  assert.match(intentLines.join("\n"), /打断进度 7\/10/);
  assert.match(intentLines.join("\n"), /再造成 3 点实际生命伤害/);
  assert.match(intentLines.join("\n"), /达到后当前攻击 -3/);
  assert.match(enemyMechanicProgress("rivalShadow", 0, mechanicState).label, /7\/10 · 还差 3/);

  const frozen = { ...mechanicState, value: 10, sourceCount: 10, triggered: true, reduction: 3, attackAfter: 3 };
  const interruptedLines = enemyIntentDetailLines({ attack: 3, mechanicState: frozen });
  assert.match(interruptedLines.join("\n"), /公开攻击 6→3/);
  assert.match(interruptedLines.join("\n"), /下回合重新累计/);
  const snapshot = enemyResolutionSnapshot({
    turn: 1,
    name: "加速内卷 · 第1次",
    incoming: { perHit: 3, hits: 1, currentBlock: 0 },
    mechanicState: frozen
  });
  assert.deepEqual(snapshot.mechanicState, frozen);
  frozen.value = 0;
  assert.equal(snapshot.mechanicState.value, 10, "敌方结算期间必须冻结刚刚触发的状态");
});

test("卷王数据明确公开阈值、固定减伤和真实伤害口径", () => {
  assert.equal(ENEMY_DEFS.rivalShadow.interruptThreshold, 10);
  assert.equal(ENEMY_DEFS.rivalShadow.interruptAttackReduction, 3);
  assert.match(ENEMY_DEFS.rivalShadow.mechanicText, /10 点实际生命伤害/);
  assert.match(ENEMY_DEFS.rivalShadow.tip, /护甲吸收的伤害不计入打断/);
});
