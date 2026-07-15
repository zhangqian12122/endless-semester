import test from "node:test";
import assert from "node:assert/strict";

import { battleFeedbackFromDelta, enemyStatusCausalPlacements } from "../app-flow.js";

const status = (id, uid) => ({ id, uid });

test("状态牌可按真实最终手牌、抽牌堆和弃牌堆定位", () => {
  const before = ["old-strike"];

  assert.deepEqual(enemyStatusCausalPlacements(before, {
    hand: [status("nervous", "new-hand")],
    drawPile: [],
    discardPile: []
  }, { id: "nervous", count: 1, zone: "discard" }), [
    { type: "status", id: "nervous", target: "hand", count: 1 }
  ]);

  assert.deepEqual(enemyStatusCausalPlacements(before, {
    hand: [],
    drawPile: [status("todo", "new-draw")],
    discardPile: []
  }, { id: "todo", count: 1, zone: "draw" }), [
    { type: "status", id: "todo", target: "drawPile", count: 1 }
  ]);

  assert.deepEqual(enemyStatusCausalPlacements(before, {
    hand: [],
    drawPile: [],
    discardPile: [status("todo", "new-discard")]
  }, { id: "todo", count: 1, zone: "discard" }), [
    { type: "status", id: "todo", target: "discardPile", count: 1 }
  ]);
});

test("多张新增状态分散到不同牌区时按固定目标顺序分组", () => {
  assert.deepEqual(enemyStatusCausalPlacements([], {
    hand: [status("nervous", "new-hand")],
    drawPile: [status("nervous", "new-draw")],
    discardPile: [status("nervous", "new-discard")]
  }, { id: "nervous", count: 3, zone: "draw" }), [
    { type: "status", id: "nervous", target: "hand", count: 1 },
    { type: "status", id: "nervous", target: "drawPile", count: 1 },
    { type: "status", id: "nervous", target: "discardPile", count: 1 }
  ]);
});

test("既有同名卡、其他卡和重复 UID 不会被误判为本次投放", () => {
  assert.deepEqual(enemyStatusCausalPlacements({
    hand: ["old-hand"],
    drawPile: ["old-draw"],
    discardPile: ["old-discard"],
    exhaustPile: ["old-exhaust"]
  }, {
    hand: [status("todo", "old-hand"), status("todo", "new-todo")],
    drawPile: [status("todo", "old-draw"), status("nervous", "new-other")],
    discardPile: [status("todo", "old-discard"), status("todo", "new-todo")],
    exhaustPile: [status("todo", "old-exhaust")]
  }, { id: "todo", count: 2, zone: "discard" }), [
    { type: "status", id: "todo", target: "hand", count: 1 }
  ]);
});

test("反馈规范化保留投放到手牌的状态因果目标", () => {
  const feedback = battleFeedbackFromDelta({}, {}, {
    kind: "enemy",
    causalEffects: [
      { type: "status", id: "nervous", target: "hand", count: 1 },
      { type: "status", id: "todo", target: "exhaustPile", count: 1 }
    ]
  });

  assert.deepEqual(feedback.causalEffects, [
    { type: "status", id: "nervous", target: "hand", count: 1 }
  ]);
});

test("找不到新增 UID 时安全回退到敌方声明的原始牌区", () => {
  const combat = {
    hand: [status("todo", "old-todo")],
    drawPile: [],
    discardPile: []
  };

  assert.deepEqual(enemyStatusCausalPlacements(["old-todo"], combat, {
    id: "todo", count: 2, zone: "discard"
  }), [{ type: "status", id: "todo", target: "discardPile", count: 2 }]);
  assert.deepEqual(enemyStatusCausalPlacements([], combat, {
    id: "nervous", count: 1, zone: "draw"
  }), [{ type: "status", id: "nervous", target: "drawPile", count: 1 }]);
});

test("污染输入不会抛错或制造无效投放", () => {
  assert.deepEqual(enemyStatusCausalPlacements([], {}, null), []);
  assert.deepEqual(enemyStatusCausalPlacements([], {}, { id: "", count: 1, zone: "draw" }), []);
  assert.deepEqual(enemyStatusCausalPlacements([], {}, { id: "todo", count: 0, zone: "draw" }), []);
  assert.deepEqual(enemyStatusCausalPlacements([], {}, { id: "todo", count: 1, zone: "hand" }), []);
  assert.deepEqual(enemyStatusCausalPlacements([], {}, { id: Symbol("todo"), count: 1, zone: "draw" }), []);
  assert.deepEqual(enemyStatusCausalPlacements({}, {
    hand: [status("todo", "looks-new")]
  }, { id: "todo", count: 1, zone: "discard" }), [
    { type: "status", id: "todo", target: "discardPile", count: 1 }
  ]);
});
