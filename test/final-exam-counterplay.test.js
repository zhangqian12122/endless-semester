import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SemesterGame } from "../game-engine.js";
import { ENEMY_DEFS } from "../game-data.js";
import {
  combatCardTacticalCue,
  combatFinalExamBlankProjection,
  enemyIntentDetailLines,
  enemyMechanicProgress,
  enemyResolutionSnapshot
} from "../app-flow.js";

function openBlankWindow(game) {
  game.combat.enemy.intentTurn = 2;
  game.combat.playerBlock = 99;
  const intent = game.getIntent();
  assert.match(intent.name, /^填空题/);
  assert.deepEqual({ attack: intent.attack, block: intent.block }, { attack: 10, block: 8 });
  const resolved = game.endTurn().enemyResult;
  assert.deepEqual(resolved.block, { gained: 8 });
  assert.equal(game.combat.enemy.intentTurn, 3);
  assert.equal(game.combat.enemy.block, 8);
  assert.equal(game.combat.enemy.examBlankState, "open");
}

test("填空题留下 8 甲，全部击破后才把本次大题固定降低 6", () => {
  const game = new SemesterGame(9201, "cancer");
  game.startCombat("finalExam");
  openBlankWindow(game);

  const opening = game.getIntent();
  assert.equal(opening.attack, 16);
  assert.deepEqual(opening.mechanicState, {
    type: "examBlank",
    label: "填空破题",
    state: "open",
    windowOpen: true,
    value: 0,
    cap: 8,
    remainingBlock: 8,
    triggered: false,
    attackReduction: 6,
    reduction: 0,
    attackBefore: 16,
    attackAfter: 16
  });

  assert.equal(game.damageEnemy(7, 1), 0);
  assert.equal(game.combat.enemy.block, 1);
  assert.equal(game.getIntent().attack, 16, "打掉 7/8 甲仍不能获得减伤");
  assert.equal(game.getIntent().mechanicState.value, 7);

  assert.equal(game.damageEnemy(1, 1), 0);
  const solved = game.getIntent();
  assert.equal(solved.attack, 10);
  assert.equal(solved.mechanicState.triggered, true);
  assert.equal(solved.mechanicState.value, 8);
  assert.equal(solved.mechanicState.remainingBlock, 0);
  game.damageEnemy(1, 1);
  assert.equal(game.combat.log.filter((entry) => entry.startsWith("填空破题：")).length, 1);
  assert.equal(game.incomingDamagePreview().perHit, 10);

  const resolved = game.endTurn().enemyResult;
  assert.equal(resolved.attack.perHit, 10, "大题必须复用玩家看到的破题后意图");
  assert.equal(resolved.mechanicState.triggered, true);
  assert.equal(game.combat.enemy.examBlankState, "closed");
  assert.match(game.getIntent().name, /^发卷/);
});

test("多段伤害、伤害技能与宠物共用破题窗口，下一轮不会继承", () => {
  const multiHit = new SemesterGame(9202, "cancer");
  multiHit.startCombat("finalExam");
  openBlankWindow(multiHit);
  assert.equal(multiHit.damageEnemy(3, 3), 1);
  assert.equal(multiHit.getIntent().mechanicState.triggered, true);
  assert.equal(multiHit.combat.log.filter((entry) => entry.startsWith("填空破题：")).length, 1);

  const shared = new SemesterGame(9203, "cancer");
  shared.startCombat("finalExam");
  openBlankWindow(shared);
  const lendAHand = shared.createCard("lendAHand");
  shared.combat.hand = [lendAHand];
  shared.combat.energy = 3;
  assert.deepEqual(shared.playCard(lendAHand.uid), { ok: true });
  assert.equal(shared.combat.enemy.block, 5);
  assert.equal(shared.combat.enemy.examBlankState, "open");
  shared.pet.charge = shared.pet.maxCharge;
  assert.deepEqual(shared.usePetSkill(), { ok: true });
  assert.equal(shared.combat.enemy.examBlankState, "solved");
  assert.equal(shared.getIntent().attack, 10);

  shared.combat.playerBlock = 99;
  shared.endTurn();
  shared.combat.enemy.intentTurn = 6;
  shared.combat.playerBlock = 99;
  shared.endTurn();
  assert.equal(shared.combat.enemy.examBlankState, "open", "下一轮填空题应重新开启独立窗口");
  assert.equal(shared.getIntent().attack, 18);
  assert.equal(shared.getIntent().mechanicState.triggered, false);
});

test("直接跳到大题不会误判破题，成长与倍率先结算再固定减 6", () => {
  const closed = new SemesterGame(9204, "cancer");
  closed.startCombat("finalExam");
  closed.combat.enemy.intentTurn = 3;
  closed.combat.enemy.block = 0;
  const stateBefore = {
    examBlankState: closed.combat.enemy.examBlankState,
    block: closed.combat.enemy.block,
    logLength: closed.combat.log.length,
    rngState: closed.rng.state
  };
  assert.equal(closed.getIntent().attack, 16);
  assert.equal(closed.getIntent().mechanicState.windowOpen, false);
  closed.incomingDamagePreview();
  assert.deepEqual({
    examBlankState: closed.combat.enemy.examBlankState,
    block: closed.combat.enemy.block,
    logLength: closed.combat.log.length,
    rngState: closed.rng.state
  }, stateBefore, "意图与伤害预览必须保持纯读取");

  const scaled = new SemesterGame(9205, "cancer");
  scaled.chooseTarot("strength");
  scaled.semester = 2;
  scaled.startCombat("finalExam", {
    challenge: true,
    affix: "backlog",
    hpMultiplier: 1.35,
    damageMultiplier: 1.25
  });
  scaled.combat.enemy.intentTurn = 3;
  scaled.combat.enemy.examBlankState = "solved";
  scaled.combat.enemy.block = 0;
  const intent = scaled.getIntent();
  assert.equal(intent.mechanicState.attackBefore, 23);
  assert.equal(intent.attack, 17, "学期、挑战和塔罗先得到 23，再固定减 6");
  assert.equal(scaled.incomingDamagePreview().perHit, 17);
  assert.equal(scaled.endTurn().enemyResult.attack.perHit, 17);
});

test("破题进度、意图说明、卡牌提示与结算快照使用同一状态", () => {
  const mechanicState = {
    type: "examBlank",
    label: "填空破题",
    state: "open",
    windowOpen: true,
    value: 5,
    cap: 8,
    remainingBlock: 3,
    triggered: false,
    attackReduction: 6,
    reduction: 0,
    attackBefore: 16,
    attackAfter: 16
  };
  const incoming = {
    perHit: 16,
    hits: 1,
    attackTotal: 16,
    currentBlock: 0,
    endTurnHpLoss: 0,
    totalHpLoss: 16,
    lethal: true
  };

  assert.equal(combatFinalExamBlankProjection({ enemyBlockAbsorbed: 2 }, incoming, mechanicState), null);
  assert.deepEqual(combatFinalExamBlankProjection({ enemyBlockAbsorbed: 3 }, incoming, mechanicState), {
    valueBefore: 5,
    valueAfter: 8,
    cap: 8,
    remainingBlock: 3,
    blockBroken: 3,
    attackReduction: 6,
    perHitBefore: 16,
    perHitAfter: 10,
    hits: 1,
    attackTotalAfter: 10
  });
  const cue = combatCardTacticalCue({ enemyBlockAbsorbed: 3 }, incoming, {
    enemyHp: 40,
    playerHp: 12,
    mechanicState
  });
  assert.equal(cue.tone, "rescue");
  assert.match(cue.label, /破题成功 · 大题 16→10 · 脱险/);

  const openLines = enemyIntentDetailLines({ attack: 16, mechanicState });
  assert.match(openLines.join("\n"), /破题进度 5\/8/);
  assert.match(openLines.join("\n"), /再击破 3 点护甲/);
  const solved = {
    ...mechanicState,
    state: "solved",
    value: 8,
    remainingBlock: 0,
    triggered: true,
    reduction: 6,
    attackAfter: 10
  };
  assert.equal(enemyMechanicProgress("finalExam", 3, mechanicState).label, "5/8 · 余3甲");
  assert.equal(enemyMechanicProgress("finalExam", 3, solved).label, "成功 · 16→10");
  assert.match(enemyIntentDetailLines({ attack: 10, mechanicState: solved }).join("\n"), /大题 16→10/);

  const snapshot = enemyResolutionSnapshot({
    turn: 4,
    name: "大题 · 第1轮",
    incoming: { perHit: 10, hits: 1, currentBlock: 0 },
    mechanicState: solved
  });
  assert.deepEqual(snapshot.mechanicState, solved);
  solved.value = 0;
  assert.equal(snapshot.mechanicState.value, 8, "敌方结算期间必须冻结刚刚完成的破题状态");
});

test("期末数据与战斗反馈公开破题目标，不新增独立常驻面板", () => {
  const exam = ENEMY_DEFS.finalExam;
  assert.equal(exam.blankArmor, 8);
  assert.equal(exam.blankBreakAttackReduction, 6);
  assert.match(exam.mechanicText, /击破全部护甲/);
  assert.match(exam.tip, /先击破 8 点护甲/);

  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /before\?\.type === "examBlank"/);
  assert.match(appSource, /破题成功 · 大题 \$\{after\.attackBefore\}→\$\{after\.attackAfter\}/);
  assert.match(appSource, /counterplayFeedbackParts\(counterplayBefore, counterplayAfter\)/);
});
