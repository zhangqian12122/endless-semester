import test from "node:test";
import assert from "node:assert/strict";

import { CHALLENGE_AFFIX_DEFS, CHALLENGE_RULES, SemesterGame } from "../game-engine.js";
import { ALL_EVENT_IDS, ENEMY_DEFS, EVENT_DEFS, SAFE_EVENT_IDS } from "../game-data.js";

const ROUTE_TYPES = new Set(["combat", "event", "rest", "shop"]);
const FIXED_WEEKS = new Map([
  [1, "sleepyBug"],
  [2, "homeworkBlob"],
  [8, "rivalShadow"],
  [16, "finalExam"]
]);
const OPEN_WEEKS = [3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
const COMBAT_CHOICE_WEEKS = new Set([4, 6, 11, 14, 15]);
const SMOKE_SEEDS = Array.from({ length: 32 }, (_, index) => index + 1);

function readyGame(seed, week) {
  const game = new SemesterGame(seed, "cancer");
  assert.equal(game.chooseTarot("chariot"), true, `种子 ${seed} 无法选择开局塔罗`);
  game.week = week;
  return game;
}

function assertRecognizableNode(node, seed, week) {
  const context = `种子 ${seed} 第 ${week} 周`;
  assert.ok(node && ROUTE_TYPES.has(node.type), `${context} 存在未知节点类型`);
  assert.equal(typeof node.label, "string", `${context} 节点缺少标签`);
  assert.ok(node.label.trim().length > 0, `${context} 节点标签为空`);

  if (node.type === "combat") {
    assert.ok(ENEMY_DEFS[node.enemy], `${context} 战斗引用未知敌人 ${node.enemy}`);
    if (node.challenge) {
      assert.ok(CHALLENGE_AFFIX_DEFS[node.affix], `${context} 挑战战引用未知词缀 ${node.affix}`);
    }
  } else if (node.type === "event") {
    assert.ok(["safe", "all"].includes(node.pool), `${context} 事件池无法识别`);
  }
}

test("多种子第一学期路线完整覆盖 1 至 16 周并保持固定周与节点结构", () => {
  for (const seed of SMOKE_SEEDS) {
    const game = new SemesterGame(seed, "cancer");
    const plan = game.semesterPlan;

    assert.equal(plan.length, 17, `种子 ${seed} 路线必须包含占位下标及 16 周`);
    assert.deepEqual(plan[0], [], `种子 ${seed} 的第 0 周只能作为占位`);

    for (let week = 1; week <= 16; week += 1) {
      const nodes = plan[week];
      const expectedCount = FIXED_WEEKS.has(week) ? 1 : 2;
      assert.equal(nodes.length, expectedCount, `种子 ${seed} 第 ${week} 周节点数量错误`);
      if (COMBAT_CHOICE_WEEKS.has(week)) {
        assert.ok(nodes.every((node) => node.type === "combat" && !node.challenge),
          `种子 ${seed} 第 ${week} 周应提供两个普通战斗选择`);
        assert.equal(new Set(nodes.map((node) => node.enemy)).size, 2,
          `种子 ${seed} 第 ${week} 周的两个敌人不应重复`);
      } else {
        assert.equal(new Set(nodes.map((node) => node.type)).size, nodes.length,
          `种子 ${seed} 第 ${week} 周不应出现重复类型选项`);
      }
      nodes.forEach((node) => assertRecognizableNode(node, seed, week));
    }

    for (const [week, enemyId] of FIXED_WEEKS) {
      assert.deepEqual(
        { type: plan[week][0].type, enemy: plan[week][0].enemy, challenge: Boolean(plan[week][0].challenge) },
        { type: "combat", enemy: enemyId, challenge: false },
        `种子 ${seed} 第 ${week} 周固定关卡被改写`
      );
    }

    const openNodes = OPEN_WEEKS.flatMap((week) => plan[week]);
    assert.ok(openNodes.filter((node) => node.type === "rest").length >= 2,
      `种子 ${seed} 缺少至少两次休息机会`);
    assert.ok(openNodes.filter((node) => node.type === "shop").length >= 2,
      `种子 ${seed} 缺少至少两次商店机会`);
    assert.equal(plan.slice(3, 8).flat().filter((node) => node.challenge).length, 1,
      `种子 ${seed} 的期中前挑战战数量错误`);
    assert.equal(plan.slice(9, 16).flat().filter((node) => node.challenge).length, 1,
      `种子 ${seed} 的期中后挑战战数量错误`);
  }
});

test("每条生成路线的战斗、事件、休息与商店节点都能进入对应准备状态", () => {
  for (const seed of SMOKE_SEEDS) {
    const plan = new SemesterGame(seed, "cancer").semesterPlan;

    for (let week = 1; week <= 16; week += 1) {
      for (const node of plan[week]) {
        const game = readyGame(seed, week);
        const context = `种子 ${seed} 第 ${week} 周 ${node.type}`;

        if (node.type === "combat") {
          const enemy = ENEMY_DEFS[node.enemy];
          const outcome = node.challenge ? "challenge" : enemy.kind;
          const modifiers = node.challenge
            ? {
              challenge: true,
              hpMultiplier: CHALLENGE_RULES.hpMultiplier,
              damageMultiplier: CHALLENGE_RULES.damageMultiplier,
              affix: node.affix
            }
            : {};
          const pending = game.prepareCombatStart(node.enemy, outcome, modifiers);
          assert.ok(pending, `${context} 无法建立战前检查点`);
          assert.equal(pending.started, true, `${context} 未标记为首次准备`);
          assert.equal(pending.enemyId, node.enemy, `${context} 准备了错误敌人`);
          assert.equal(pending.outcome, outcome, `${context} 准备了错误战斗类型`);
        } else if (node.type === "event") {
          const pool = node.pool === "safe" ? SAFE_EVENT_IDS : ALL_EVENT_IDS;
          const eventId = pool.find((id) => EVENT_DEFS[id]);
          assert.ok(eventId, `${context} 没有可用事件`);
          assert.equal(game.preparePendingEvent(eventId), true, `${context} 无法进入事件`);
          assert.equal(game.pendingEventId, eventId, `${context} 未保存事件检查点`);
        } else if (node.type === "rest") {
          const pending = game.prepareRest();
          assert.ok(pending, `${context} 无法进入休息点`);
          assert.equal(pending.started, true, `${context} 未标记为首次准备`);
          assert.equal(pending.stage, "choice", `${context} 未进入休息选择阶段`);
        } else if (node.type === "shop") {
          const pending = game.prepareShop();
          assert.ok(pending, `${context} 无法进入商店`);
          assert.equal(pending.started, true, `${context} 未标记为首次准备`);
          assert.equal(pending.cards.length, 3, `${context} 商店卡牌库存不完整`);
          assert.equal(pending.items.length, 2, `${context} 商店物品库存不完整`);
        }
      }
    }

    for (const week of FIXED_WEEKS.keys()) {
      const game = readyGame(seed, week);
      assert.equal(game.preparePendingEvent(SAFE_EVENT_IDS[0]), false,
        `种子 ${seed} 第 ${week} 周固定战不应允许事件入口`);
      assert.equal(game.prepareRest(), null, `种子 ${seed} 第 ${week} 周固定战不应允许休息入口`);
      assert.equal(game.prepareShop(), null, `种子 ${seed} 第 ${week} 周固定战不应允许商店入口`);
    }
  }
});
