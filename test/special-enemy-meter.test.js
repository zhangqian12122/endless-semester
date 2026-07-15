import test from "node:test";
import assert from "node:assert/strict";

import { enemyMechanicProgress } from "../app-flow.js";

test("普通敌人不生成特殊机制进度", () => {
  assert.equal(enemyMechanicProgress("sleepyBug", 0), null);
  assert.equal(enemyMechanicProgress("groupChat", 7), null);
  assert.equal(enemyMechanicProgress("", 0), null);
  assert.equal(enemyMechanicProgress(undefined, 0), null);
});

test("卷王幻影显示第几次无休加速、基础增伤与四格状态", () => {
  assert.deepEqual(enemyMechanicProgress("rivalShadow", 0), {
    kind: "escalation",
    title: "无休加速",
    label: "第1次 · 基础伤害 6",
    detail: "每次行动都攻击，基础伤害每次 +2，没有休息回合。",
    segments: ["current", "upcoming", "upcoming", "upcoming"]
  });
  assert.deepEqual(enemyMechanicProgress("rivalShadow", 2), {
    kind: "escalation",
    title: "无休加速",
    label: "第3次 · 基础伤害 10",
    detail: "每次行动都攻击，基础伤害每次 +2，没有休息回合。",
    segments: ["done", "done", "current", "upcoming"]
  });
  assert.deepEqual(enemyMechanicProgress("rivalShadow", 3), {
    kind: "escalation",
    title: "无休加速",
    label: "第4次 · 基础伤害 12",
    detail: "每次行动都攻击，基础伤害每次 +2，没有休息回合。",
    segments: ["done", "done", "done", "continuing"]
  });
  assert.deepEqual(enemyMechanicProgress("rivalShadow", 8), {
    kind: "escalation",
    title: "无休加速",
    label: "第9次 · 基础伤害 22",
    detail: "每次行动都攻击，基础伤害每次 +2，没有休息回合。",
    segments: ["done", "done", "done", "continuing"]
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

test("特殊敌人进度会把负数、非数值与小数归一化为安全回合", () => {
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
