import test from "node:test";
import assert from "node:assert/strict";

import { SemesterGame } from "../game-engine.js";
import { ENEMY_DEFS } from "../game-data.js";

const COMBAT_CHOICE_WEEKS = [4, 6, 11, 14, 15];
const ROUTE_SEEDS = Array.from({ length: 128 }, (_, index) => index + 1);

function minimumSelectableCombats(plan) {
  return plan.slice(1).reduce((total, nodes) => (
    total + (nodes.length > 0 && nodes.every((node) => node.type === "combat") ? 1 : 0)
  ), 0);
}

function legacySingleCombatPlan(seed = 9101) {
  const plan = structuredClone(new SemesterGame(seed, "cancer").semesterPlan);
  for (const week of COMBAT_CHOICE_WEEKS) {
    assert.equal(plan[week].filter((node) => node.type === "combat").length, 2,
      `构造旧路线前，第 ${week} 周应有两个战斗候选`);
    plan[week][1] = {
      type: "event",
      pool: "all",
      label: "？ 未知事件"
    };
  }
  return plan;
}

test("多种子固定战斗周始终提供两个不同的普通敌人", () => {
  for (const seed of ROUTE_SEEDS) {
    const plan = new SemesterGame(seed, "cancer").semesterPlan;
    for (const week of COMBAT_CHOICE_WEEKS) {
      const nodes = plan[week];
      assert.equal(nodes.length, 2, `种子 ${seed} 第 ${week} 周应有两个候选`);
      assert.ok(nodes.every((node) => node.type === "combat"),
        `种子 ${seed} 第 ${week} 周两个候选都必须是战斗`);
      assert.ok(nodes.every((node) => ENEMY_DEFS[node.enemy]?.kind === "normal"),
        `种子 ${seed} 第 ${week} 周只能出现普通敌人`);
      assert.ok(nodes.every((node) => node.challenge !== true),
        `种子 ${seed} 第 ${week} 周不能把必经战斗升级为挑战战`);
      assert.equal(new Set(nodes.map((node) => node.enemy)).size, 2,
        `种子 ${seed} 第 ${week} 周两个战斗必须提供不同敌人`);
    }
  }
});

test("任意选路至少经历九场战斗且两场挑战都能绕开", () => {
  for (const seed of ROUTE_SEEDS) {
    const plan = new SemesterGame(seed, "cancer").semesterPlan;
    assert.equal(minimumSelectableCombats(plan), 9,
      `种子 ${seed} 应由四场固定战和五周战斗二选一构成九场最低战斗密度`);

    const challenges = plan.flat().filter((node) => node.challenge === true);
    assert.equal(challenges.length, 2, `种子 ${seed} 应保留两场可选挑战`);
    for (let week = 1; week <= 16; week += 1) {
      if (!plan[week].some((node) => node.challenge === true)) continue;
      assert.ok(plan[week].some((node) => node.challenge !== true),
        `种子 ${seed} 第 ${week} 周挑战战必须有可绕开的替代节点`);
    }
  }
});

test("旧式单战斗候选路线从存档恢复后不会被新密度规则重写", () => {
  const game = new SemesterGame(9101, "cancer");
  game.week = 11;
  const saved = game.toJSON();
  const legacyPlan = legacySingleCombatPlan();
  saved.semesterPlan = structuredClone(legacyPlan);

  const restored = SemesterGame.fromJSON(saved);

  assert.deepEqual(restored.semesterPlan, legacyPlan,
    "合法旧路线是存档事实，读取时不应补成双战斗候选");
  assert.equal(restored.rng.state, saved.rngState,
    "兼容旧路线时不应额外消耗随机数或重生成路线");
  for (const week of COMBAT_CHOICE_WEEKS) {
    assert.equal(restored.semesterPlan[week].filter((node) => node.type === "combat").length, 1,
      `旧存档第 ${week} 周应继续保留单个战斗候选`);
  }
});
