import test from "node:test";
import assert from "node:assert/strict";

import { enemyMechanicProgress, enemyResolutionSnapshot } from "../app-flow.js";
import { ENEMY_DEFS, NORMAL_ENEMY_IDS } from "../game-data.js";
import { CHALLENGE_RULES, SemesterGame } from "../game-engine.js";

test("未配置常驻进度的普通敌人继续返回空", () => {
  for (const enemyId of NORMAL_ENEMY_IDS) {
    if (["alarmClock", "clubMegaphone"].includes(enemyId)) continue;
    assert.equal(enemyMechanicProgress(enemyId, 7), null, `${enemyId} 不应生成常驻进度`);
  }
  assert.equal(enemyMechanicProgress("", 0), null);
  assert.equal(enemyMechanicProgress(undefined, 0), null);
});

test("招新喇叭精用三格公开广播、轰炸与展板掩护", () => {
  assert.deepEqual(enemyMechanicProgress("clubMegaphone", 0, null, { attack: 4, hits: 3 }), {
    kind: "cycle",
    title: "社团音浪",
    label: "第1轮 · 1/3 · 广播",
    detail: "当前：循环广播（攻击 4×3，合计 12）；下一步：报名轰炸",
    segments: ["current", "upcoming", "upcoming"]
  });
  assert.deepEqual(enemyMechanicProgress("clubMegaphone", 1, null, {
    attack: 6,
    addStatus: { id: "nervous", count: 1, zone: "discard" }
  }), {
    kind: "cycle",
    title: "社团音浪",
    label: "第1轮 · 2/3 · 轰炸",
    detail: "当前：报名轰炸（攻击 6，向弃牌堆加入 1 张紧张）；下一步：展板掩护",
    segments: ["done", "current", "upcoming"]
  });
  assert.deepEqual(enemyMechanicProgress("clubMegaphone", 2, null, { block: 7, debuff: "distracted" }), {
    kind: "cycle",
    title: "社团音浪",
    label: "第1轮 · 3/3 · 掩护",
    detail: "当前：展板掩护（获得 7 点护甲并施加走神，不攻击）；下一步：循环广播（第2轮）",
    segments: ["done", "done", "current"]
  });
  assert.equal(enemyMechanicProgress("clubMegaphone", 3).label, "第2轮 · 1/3 · 广播");
});

test("闹钟怪用三格公开倒计时预告行动语义，不把基础伤害伪装成真实数值", () => {
  assert.deepEqual(ENEMY_DEFS.alarmClock.intents, [
    { name: "蓄响", block: 5 },
    { name: "铃声", attack: 7 },
    { name: "夺命连环响", attack: 14 }
  ]);
  assert.equal(ENEMY_DEFS.alarmClock.pattern, "蓄响防御 → 铃声攻击 → 连环响爆发");
  assert.doesNotMatch(
    `${ENEMY_DEFS.alarmClock.mechanicText} ${ENEMY_DEFS.alarmClock.pattern}`,
    /\d/,
    "倍率局的行动周期提示不能继续展示基础数值"
  );
  assert.deepEqual(enemyMechanicProgress("alarmClock", 0), {
    kind: "countdown",
    title: "公开倒计时",
    label: "1/3 · 蓄响",
    detail: "当前：蓄响（防御）；下一步：铃声（攻击）",
    segments: ["current", "upcoming", "upcoming"]
  });
  assert.deepEqual(enemyMechanicProgress("alarmClock", 1), {
    kind: "countdown",
    title: "公开倒计时",
    label: "2/3 · 铃声",
    detail: "当前：铃声（攻击）；下一步：夺命连环响（重击）",
    segments: ["done", "current", "upcoming"]
  });
  assert.deepEqual(enemyMechanicProgress("alarmClock", 2), {
    kind: "countdown",
    title: "公开倒计时",
    label: "3/3 · 爆发",
    detail: "当前：夺命连环响（重击）；下一步：蓄响（防御）",
    segments: ["done", "done", "current"]
  });
  assert.deepEqual(enemyMechanicProgress("alarmClock", 3), enemyMechanicProgress("alarmClock", 0));
});

test("闹钟怪机制牌读取第 2 学期挑战与塔罗共同结算后的真实攻击", () => {
  const game = new SemesterGame(610, "cancer");
  game.semester = 2;
  game.chooseTarot("strength");
  game.startCombat("alarmClock", {
    challenge: true,
    hpMultiplier: CHALLENGE_RULES.hpMultiplier,
    damageMultiplier: CHALLENGE_RULES.damageMultiplier,
    affix: "deadline"
  });
  const openingIntent = game.getIntent();
  assert.equal(openingIntent.block, 5);
  assert.equal(
    enemyMechanicProgress("alarmClock", 0, openingIntent.mechanicState, openingIntent).label,
    "1/3 · 蓄响 +5",
    "防御步骤也必须读取当前已解析意图"
  );
  game.combat.enemy.intentTurn = 2;
  game.combat.turn = 4;

  const intent = game.getIntent();
  assert.equal(intent.attack, 25, "14 基础伤害应依次结算学期成长、挑战倍率、截止日期与力量塔罗");
  const progress = enemyMechanicProgress("alarmClock", game.combat.enemy.intentTurn, intent.mechanicState, intent);
  assert.equal(progress.label, "3/3 · 爆发 25");
  assert.equal(progress.detail, "当前：夺命连环响（攻击 25）；下一步：蓄响（防御）");
  assert.doesNotMatch(`${progress.label} ${progress.detail}`, /爆发 14|攻击 14|护甲 5/);

  const resolvedSnapshot = enemyResolutionSnapshot({
    turn: 3,
    name: intent.name,
    intent: { attack: intent.attack, block: intent.block, hits: intent.hits }
  });
  assert.equal(
    enemyMechanicProgress("alarmClock", 2, null, resolvedSnapshot.intent).label,
    "3/3 · 爆发 25",
    "敌方结算演出也应冻结刚刚执行的真实数值"
  );
});

test("卷王幻影公开十格打断进度并保留当前加速轮次", () => {
  const openingState = {
    type: "rivalInterrupt", value: 0, cap: 10, triggered: false,
    attackBefore: 6, attackAfter: 6
  };
  assert.deepEqual(enemyMechanicProgress("rivalShadow", 0, openingState), {
    kind: "interrupt",
    title: "打断内卷",
    label: "0/10 · 当前攻击 6",
    detail: "第1次加速，基础伤害 6；本回合累计实际生命伤害，达到 10 后当前攻击 -3，下回合重置。",
    segments: Array(10).fill("upcoming")
  });

  const pressuredState = {
    type: "rivalInterrupt", value: 7, cap: 10, triggered: false,
    attackBefore: 10, attackAfter: 10
  };
  assert.deepEqual(enemyMechanicProgress("rivalShadow", 2, pressuredState), {
    kind: "interrupt",
    title: "打断内卷",
    label: "7/10 · 还差 3",
    detail: "第3次加速，基础伤害 10；本回合累计实际生命伤害，达到 10 后当前攻击 -3，下回合重置。",
    segments: [...Array(7).fill("done"), ...Array(3).fill("upcoming")]
  });

  const interruptedState = {
    type: "rivalInterrupt", value: 10, cap: 10, triggered: true,
    attackBefore: 12, attackAfter: 9
  };
  assert.deepEqual(enemyMechanicProgress("rivalShadow", 3, interruptedState), {
    kind: "interrupt",
    title: "打断内卷",
    label: "已打断 · 12→9",
    detail: "第4次加速，基础伤害 12；本回合累计实际生命伤害，达到 10 后当前攻击 -3，下回合重置。",
    segments: Array(10).fill("done")
  });
});

test("期末考试按四步循环显示轮次、当前步骤与下一步", () => {
  assert.deepEqual(enemyMechanicProgress("finalExam", 0), {
    kind: "cycle",
    title: "四步破题",
    label: "第1轮 · 1/4",
    detail: "当前：发卷；下一步：选择题",
    segments: ["current", "upcoming", "upcoming", "upcoming"]
  });
  assert.deepEqual(enemyMechanicProgress("finalExam", 3), {
    kind: "cycle",
    title: "四步破题",
    label: "第1轮 · 4/4",
    detail: "当前：大题；下一步：发卷（第2轮）",
    segments: ["done", "done", "done", "current"]
  });
  assert.deepEqual(enemyMechanicProgress("finalExam", 4), {
    kind: "cycle",
    title: "四步破题",
    label: "第2轮 · 1/4",
    detail: "当前：发卷；下一步：选择题",
    segments: ["current", "upcoming", "upcoming", "upcoming"]
  });
  assert.deepEqual(enemyMechanicProgress("finalExam", 6), {
    kind: "cycle",
    title: "四步破题",
    label: "第2轮 · 3/4",
    detail: "当前：填空题；下一步：大题",
    segments: ["done", "done", "current", "upcoming"]
  });
});

test("敌人进度会把负数、非数值与小数归一化为安全回合", () => {
  const alarmOpening = enemyMechanicProgress("alarmClock", 0);
  assert.deepEqual(enemyMechanicProgress("alarmClock", -2), alarmOpening);
  assert.deepEqual(enemyMechanicProgress("alarmClock", Number.NaN), alarmOpening);
  assert.deepEqual(enemyMechanicProgress("alarmClock", Number.POSITIVE_INFINITY), alarmOpening);
  assert.deepEqual(enemyMechanicProgress("alarmClock", Symbol("invalid")), alarmOpening);
  assert.deepEqual(enemyMechanicProgress("alarmClock", 2.99), enemyMechanicProgress("alarmClock", 2));

  const rivalOpening = enemyMechanicProgress("rivalShadow", 0);
  assert.deepEqual(enemyMechanicProgress("rivalShadow", -5), rivalOpening);
  assert.deepEqual(enemyMechanicProgress("rivalShadow", Number.NaN), rivalOpening);
  assert.deepEqual(enemyMechanicProgress("rivalShadow", Number.POSITIVE_INFINITY), rivalOpening);
  assert.deepEqual(enemyMechanicProgress("rivalShadow", Symbol("invalid")), rivalOpening);
  assert.deepEqual(enemyMechanicProgress("rivalShadow", 2.99), enemyMechanicProgress("rivalShadow", 2));
  assert.doesNotMatch(enemyMechanicProgress("rivalShadow", Number.MAX_VALUE).label, /Infinity|NaN/);

  const examOpening = enemyMechanicProgress("finalExam", 0);
  assert.deepEqual(enemyMechanicProgress("finalExam", -0.5), examOpening);
  assert.deepEqual(enemyMechanicProgress("finalExam", "not-a-number"), examOpening);
  assert.deepEqual(enemyMechanicProgress("finalExam", 5.75), enemyMechanicProgress("finalExam", 5));
});
