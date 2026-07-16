import test from "node:test";
import assert from "node:assert/strict";

import { enemyMechanicProgress } from "../app-flow.js";
import { ENEMY_DEFS, NORMAL_ENEMY_IDS } from "../game-data.js";

test("未配置常驻进度的普通敌人继续返回空", () => {
  for (const enemyId of NORMAL_ENEMY_IDS) {
    if (enemyId === "alarmClock") continue;
    assert.equal(enemyMechanicProgress(enemyId, 7), null, `${enemyId} 不应生成常驻进度`);
  }
  assert.equal(enemyMechanicProgress("", 0), null);
  assert.equal(enemyMechanicProgress(undefined, 0), null);
});

test("闹钟怪用三格公开倒计时预告 14 点爆发", () => {
  assert.deepEqual(ENEMY_DEFS.alarmClock.intents, [
    { name: "蓄响", block: 5 },
    { name: "铃声", attack: 7 },
    { name: "夺命连环响", attack: 14 }
  ]);
  assert.deepEqual(enemyMechanicProgress("alarmClock", 0), {
    kind: "countdown",
    title: "公开倒计时",
    label: "1/3 · 蓄响",
    detail: "当前：蓄响（护甲 5）；下一步：铃声（攻击 7）",
    segments: ["current", "upcoming", "upcoming"]
  });
  assert.deepEqual(enemyMechanicProgress("alarmClock", 1), {
    kind: "countdown",
    title: "公开倒计时",
    label: "2/3 · 下次 14",
    detail: "当前：铃声（攻击 7）；下一步：夺命连环响（攻击 14）",
    segments: ["done", "current", "upcoming"]
  });
  assert.deepEqual(enemyMechanicProgress("alarmClock", 2), {
    kind: "countdown",
    title: "公开倒计时",
    label: "3/3 · 爆发 14",
    detail: "当前：夺命连环响（攻击 14）；下一步：蓄响（护甲 5）",
    segments: ["done", "done", "current"]
  });
  assert.deepEqual(enemyMechanicProgress("alarmClock", 3), enemyMechanicProgress("alarmClock", 0));
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
    title: "四步递增",
    label: "第1轮 · 1/4",
    detail: "当前：发卷；下一步：选择题",
    segments: ["current", "upcoming", "upcoming", "upcoming"]
  });
  assert.deepEqual(enemyMechanicProgress("finalExam", 3), {
    kind: "cycle",
    title: "四步递增",
    label: "第1轮 · 4/4",
    detail: "当前：大题；下一步：发卷（第2轮）",
    segments: ["done", "done", "done", "current"]
  });
  assert.deepEqual(enemyMechanicProgress("finalExam", 4), {
    kind: "cycle",
    title: "四步递增",
    label: "第2轮 · 1/4",
    detail: "当前：发卷；下一步：选择题",
    segments: ["current", "upcoming", "upcoming", "upcoming"]
  });
  assert.deepEqual(enemyMechanicProgress("finalExam", 6), {
    kind: "cycle",
    title: "四步递增",
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
