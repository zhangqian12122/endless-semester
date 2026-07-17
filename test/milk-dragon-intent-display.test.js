import test from "node:test";
import assert from "node:assert/strict";

import {
  enemyIntentCounterplayCue,
  enemyIntentDetailLines,
  enemyMechanicProgress
} from "../app-flow.js";

function safeRisk(overrides = {}) {
  return {
    state: "safe",
    attackTotal: 0,
    preventableHpLoss: 0,
    unavoidableHpLoss: 0,
    armorNeeded: 0,
    ...overrides
  };
}

test("魔笑奶龙用四拍进度公开当前效果、下一拍与循环轮次", () => {
  assert.deepEqual(enemyMechanicProgress("madMilkDragon", 0, null, {
    addStatus: { id: "nervous", count: 2, zone: "discard" }
  }), {
    kind: "cycle",
    title: "魔笑四拍",
    label: "第1轮 · 1/4 · 开嗓",
    detail: "当前：魔性开嗓（向弃牌堆加入 2 张紧张，不攻击）；下一步：奶泡头槌",
    segments: ["current", "upcoming", "upcoming", "upcoming"]
  });

  assert.deepEqual(enemyMechanicProgress("madMilkDragon", 1, null, {
    attack: 5,
    hits: 2
  }), {
    kind: "cycle",
    title: "魔笑四拍",
    label: "第1轮 · 2/4 · 头槌",
    detail: "当前：奶泡头槌（攻击 5×2，合计 10）；下一步：憋笑蓄泡",
    segments: ["done", "current", "upcoming", "upcoming"]
  });

  assert.deepEqual(enemyMechanicProgress("madMilkDragon", 2, null, {
    block: 9,
    debuff: "distracted"
  }), {
    kind: "cycle",
    title: "魔笑四拍",
    label: "第1轮 · 3/4 · 蓄泡",
    detail: "当前：憋笑蓄泡（获得 9 点护甲并施加走神，不攻击）；下一步：哈哈哈连震",
    segments: ["done", "done", "current", "upcoming"]
  });

  const laughState = {
    type: "statusHits",
    label: "笑压",
    sourceCount: 2,
    value: 2,
    cap: 3
  };
  assert.deepEqual(enemyMechanicProgress("madMilkDragon", 3, laughState, {
    attack: 3,
    hits: 5
  }), {
    kind: "cycle",
    title: "魔笑四拍",
    label: "第1轮 · 4/4 · 爆笑 · 笑压 2/3",
    detail: "当前：哈哈哈连震（攻击 3×5，合计 15；2 张紧张追加 2 段）；下一步：魔性开嗓（第2轮）",
    segments: ["done", "done", "done", "current"]
  });

  assert.equal(
    enemyMechanicProgress("madMilkDragon", 4).label,
    "第2轮 · 1/4 · 开嗓"
  );
});

test("爆笑意图详情解释紧张如何增加真实连击段数", () => {
  const lines = enemyIntentDetailLines({
    attack: 3,
    hits: 5,
    scaling: { type: "statusHits", statusId: "nervous", maxBonus: 3 },
    mechanicState: {
      type: "statusHits",
      label: "笑压",
      sourceCount: 2,
      value: 2,
      cap: 3
    }
  }, (id) => id === "nervous" ? "紧张" : id);

  assert.match(lines.join("；"), /每段 3 点伤害，共 5 段（合计 15 点）/);
  assert.match(lines.join("；"), /笑压 2\/3/);
  assert.match(lines.join("；"), /2 张「紧张」/);
  assert.match(lines.join("；"), /追加 2 段（共 5 段）/);
});

test("魔笑奶龙的降段建议不沿用群聊怪的未读与轰炸文案", () => {
  const intent = {
    attack: 3,
    hits: 5,
    mechanicState: {
      type: "statusHits",
      label: "笑压",
      sourceCount: 2,
      value: 2,
      cap: 3
    }
  };
  const cue = enemyIntentCounterplayCue("madMilkDragon", intent, {
    intentTurn: 3,
    risk: safeRisk({ state: "hit", attackTotal: 15, preventableHpLoss: 15 })
  });
  assert.equal(cue.label, "本回合 · 止住怪笑");
  assert.match(cue.detail, /笑压 2\/3/);
  assert.match(cue.detail, /共 5 段/);
  assert.match(cue.detail, /清理 1 张紧张可少 1 段/);
  assert.doesNotMatch(cue.detail, /未读|轰炸/);

  const planned = enemyIntentCounterplayCue("madMilkDragon", intent, {
    intentTurn: 3,
    risk: safeRisk({ state: "hit", attackTotal: 15, preventableHpLoss: 15 }),
    plan: {
      finish: null,
      rescue: null,
      counter: {
        kind: "statusHits",
        action: { source: "card", name: "清空待办" },
        projection: { cleared: 1, hitsBefore: 5, hitsAfter: 4 }
      }
    }
  });
  assert.match(planned.detail, /怪笑连震 5→4 段/);
  assert.doesNotMatch(planned.detail, /轰炸/);

  const unavailable = enemyIntentCounterplayCue("madMilkDragon", intent, {
    intentTurn: 3,
    actionsEvaluated: true,
    risk: safeRisk({ state: "hit", attackTotal: 15, preventableHpLoss: 15 })
  });
  assert.match(unavailable.detail, /怪笑连击段数/);
  assert.doesNotMatch(unavailable.detail, /轰炸/);
});

test("开嗓与蓄泡明确标记无攻击窗口并预告下一拍", () => {
  const opening = enemyIntentCounterplayCue("madMilkDragon", {
    addStatus: { id: "nervous", count: 2, zone: "discard" }
  }, { intentTurn: 0, risk: safeRisk() });
  assert.equal(opening.label, "本回合 · 抢输出");
  assert.match(opening.detail, /开嗓不攻击/);
  assert.match(opening.detail, /2 张紧张.*弃牌堆/);
  assert.match(opening.detail, /下一拍是奶泡头槌/);

  const charge = enemyIntentCounterplayCue("madMilkDragon", {
    block: 9,
    debuff: "distracted"
  }, { intentTurn: 2, risk: safeRisk() });
  assert.equal(charge.label, "本回合 · 破甲清牌");
  assert.match(charge.detail, /蓄泡不攻击/);
  assert.match(charge.detail, /9 点护甲.*走神/);
  assert.match(charge.detail, /下一拍爆笑/);
});

test("魔笑四拍对异常回合与异常数值安全降级", () => {
  const opening = enemyMechanicProgress("madMilkDragon", 0);
  assert.deepEqual(enemyMechanicProgress("madMilkDragon", -3), opening);
  assert.deepEqual(enemyMechanicProgress("madMilkDragon", Number.NaN), opening);
  assert.deepEqual(enemyMechanicProgress("madMilkDragon", Number.POSITIVE_INFINITY), opening);
  assert.deepEqual(enemyMechanicProgress("madMilkDragon", Symbol("invalid")), opening);

  const huge = enemyMechanicProgress("madMilkDragon", Number.MAX_VALUE, {
    type: "statusHits",
    sourceCount: Symbol("invalid"),
    value: Symbol("invalid"),
    cap: Symbol("invalid")
  }, {
    attack: Symbol("invalid"),
    hits: Symbol("invalid")
  });
  assert.equal(huge.segments.length, 4);
  assert.doesNotMatch(`${huge.label} ${huge.detail}`, /Infinity|NaN|undefined/);
});
