import test from "node:test";
import assert from "node:assert/strict";

import { ENEMY_DEFS } from "../game-data.js";
import { enemyIntentCounterplayCue } from "../app-flow.js";

function risk(overrides = {}) {
  return {
    state: "safe",
    attackTotal: 0,
    preventableHpLoss: 0,
    unavoidableHpLoss: 0,
    armorNeeded: 0,
    ...overrides
  };
}

test("八名敌人的每个行动步骤都有简短的当前回合建议", () => {
  const cycleLengths = {
    sleepyBug: 3,
    homeworkBlob: 3,
    alarmClock: 3,
    phoneSpirit: 3,
    groupChat: 3,
    printerJam: 3,
    rollCallWarden: 3,
    clubMegaphone: 3,
    rivalShadow: 4,
    finalExam: 4
  };

  for (const [enemyId, length] of Object.entries(cycleLengths)) {
    const definition = ENEMY_DEFS[enemyId];
    for (let turn = 0; turn < length; turn += 1) {
      const intent = definition.intentAt
        ? definition.intentAt(turn)
        : definition.intents[turn % definition.intents.length];
      const attackTotal = (intent.attack || 0) * (intent.hits || 1);
      const cue = enemyIntentCounterplayCue(enemyId, intent, {
        intentTurn: turn,
        risk: risk({
          state: attackTotal > 0 ? "hit" : "safe",
          attackTotal,
          preventableHpLoss: attackTotal
        }),
        fallback: definition.tip
      });

      assert.ok(cue, `${enemyId} 第 ${turn + 1} 步应有提示`);
      assert.match(cue.label, /^本回合 · /);
      assert.ok(cue.detail.length >= 8 && cue.detail.length <= 48, `${enemyId} 第 ${turn + 1} 步应保持一句短提示`);
      assert.doesNotMatch(cue.detail, /undefined|NaN/);
    }
  }
});

test("群聊怪按封顶后的真实紧张数量给出降一段所需清理数", () => {
  const cueAtCap = enemyIntentCounterplayCue("groupChat", {
    attack: 3,
    hits: 4,
    mechanicState: { type: "statusHits", sourceCount: 4, value: 2, cap: 2 }
  });
  assert.equal(cueAtCap.tone, "counter");
  assert.match(cueAtCap.detail, /清理 3 张紧张可少 1 段/);

  const cueBelowCap = enemyIntentCounterplayCue("groupChat", {
    attack: 3,
    hits: 4,
    mechanicState: { type: "statusHits", sourceCount: 2, value: 2, cap: 2 }
  });
  assert.match(cueBelowCap.detail, /清理 1 张紧张可少 1 段/);

  const cueClear = enemyIntentCounterplayCue("groupChat", {
    attack: 3,
    hits: 2,
    mechanicState: { type: "statusHits", sourceCount: 0, value: 0, cap: 2 }
  }, { risk: risk({ state: "hit", attackTotal: 6, preventableHpLoss: 2 }) });
  assert.match(cueClear.label, /无未读加段/);
  assert.match(cueClear.detail, /再补 2 点护甲/);
});

test("打印机按护甲封顶区间给出真实破甲阈值", () => {
  const capped = enemyIntentCounterplayCue("printerJam", {
    attack: 12,
    mechanicState: { type: "enemyBlockAttack", sourceCount: 8, value: 6, cap: 6 }
  });
  assert.match(capped.detail, /击破 3 点护甲.*降低 1 点/);

  const uncapped = enemyIntentCounterplayCue("printerJam", {
    attack: 11,
    mechanicState: { type: "enemyBlockAttack", sourceCount: 5, value: 5, cap: 6 }
  });
  assert.match(uncapped.detail, /每击破 1 点护甲.*降低 1 点/);

  const cleared = enemyIntentCounterplayCue("printerJam", {
    attack: 6,
    mechanicState: { type: "enemyBlockAttack", sourceCount: 0, value: 0, cap: 6 }
  }, { risk: risk({ state: "hit", attackTotal: 6, preventableHpLoss: 4 }) });
  assert.match(cleared.label, /蓄压已清/);
  assert.match(cleared.detail, /基础伤害/);
});

test("卷王提示只计算实际生命伤害，并显示当前敌方护甲门槛", () => {
  const active = enemyIntentCounterplayCue("rivalShadow", {
    attack: 12,
    mechanicState: {
      type: "rivalInterrupt",
      value: 7,
      cap: 10,
      triggered: false,
      attackReduction: 3
    }
  }, { enemy: { block: 4 } });
  assert.equal(active.tone, "counter");
  assert.match(active.detail, /先击破 4 点护甲，再造成 3 点生命伤害/);
  assert.match(active.detail, /攻击 -3/);

  const triggered = enemyIntentCounterplayCue("rivalShadow", {
    attack: 9,
    mechanicState: {
      type: "rivalInterrupt",
      value: 10,
      cap: 10,
      triggered: true,
      attackReduction: 3
    }
  }, { risk: risk({ state: "safe", attackTotal: 9 }) });
  assert.match(triggered.label, /已打断/);
  assert.match(triggered.detail, /打断已经生效/);
});

test("期末大题按当前剩余护甲和结算后伤害提示破题", () => {
  const open = enemyIntentCounterplayCue("finalExam", {
    attack: 23,
    mechanicState: {
      type: "examBlank",
      windowOpen: true,
      triggered: false,
      remainingBlock: 3,
      attackBefore: 23,
      attackAfter: 23,
      attackReduction: 6
    }
  });
  assert.equal(open.tone, "counter");
  assert.match(open.detail, /击破 3 点护甲/);
  assert.match(open.detail, /23→17/);

  const solved = enemyIntentCounterplayCue("finalExam", {
    attack: 17,
    mechanicState: {
      type: "examBlank",
      windowOpen: true,
      triggered: true,
      remainingBlock: 0,
      attackBefore: 23,
      attackAfter: 17,
      attackReduction: 6
    }
  }, { risk: risk({ state: "hit", attackTotal: 17, preventableHpLoss: 5 }) });
  assert.match(solved.label, /破题成功/);
  assert.match(solved.detail, /23→17/);
  assert.match(solved.detail, /再补 5 点护甲/);
});

test("走神、真实倍率伤害和致命风险会改变当前建议", () => {
  const distracted = enemyIntentCounterplayCue("phoneSpirit", { attack: 11 }, {
    intentTurn: 1,
    distracted: true,
    risk: risk({ state: "hit", attackTotal: 11, preventableHpLoss: 11 })
  });
  assert.match(distracted.label, /先解走神/);
  assert.match(distracted.detail, /技能与宠物不受影响/);

  const scaled = enemyIntentCounterplayCue("sleepyBug", { attack: 11 }, {
    intentTurn: 0,
    risk: risk({ state: "hit", attackTotal: 11, preventableHpLoss: 9 })
  });
  assert.match(scaled.detail, /再补 9 点护甲/);

  const lethal = enemyIntentCounterplayCue("sleepyBug", { attack: 11 }, {
    intentTurn: 0,
    risk: risk({ state: "lethal", attackTotal: 11, preventableHpLoss: 9, armorNeeded: 4 })
  });
  assert.equal(lethal.tone, "danger");
  assert.match(lethal.detail, /至少再补 4 点护甲保命/);
});

test("致命风险优先于机制反制和走神建议", () => {
  const lethalRisk = risk({
    state: "lethal",
    attackTotal: 12,
    preventableHpLoss: 8,
    armorNeeded: 5
  });
  const cases = [
    ["groupChat", {
      attack: 3,
      hits: 4,
      mechanicState: { type: "statusHits", sourceCount: 2, value: 2, cap: 2 }
    }, {}],
    ["printerJam", {
      attack: 12,
      mechanicState: { type: "enemyBlockAttack", sourceCount: 6, value: 6, cap: 6 }
    }, {}],
    ["rivalShadow", {
      attack: 12,
      mechanicState: {
        type: "rivalInterrupt",
        value: 0,
        cap: 10,
        triggered: false,
        attackReduction: 3
      }
    }, {}],
    ["finalExam", {
      attack: 18,
      mechanicState: {
        type: "examBlank",
        windowOpen: true,
        triggered: false,
        remainingBlock: 8,
        attackBefore: 18,
        attackAfter: 18,
        attackReduction: 6
      }
    }, {}],
    ["phoneSpirit", { attack: 8 }, { intentTurn: 1, distracted: true }]
  ];

  for (const [enemyId, intent, options] of cases) {
    const cue = enemyIntentCounterplayCue(enemyId, intent, { ...options, risk: lethalRisk });
    assert.equal(cue.tone, "danger", `${enemyId} 必须保留致命色`);
    assert.match(cue.label, /保命/, `${enemyId} 必须把生存放在首位`);
    assert.match(cue.detail, /至少再补 5 点护甲保命/, `${enemyId} 必须显示真实保命缺口`);
  }
});

test("闹钟下一步爆发不写死第一学期基础伤害", () => {
  const cue = enemyIntentCounterplayCue("alarmClock", { attack: 10 }, {
    intentTurn: 1,
    risk: risk({ state: "hit", attackTotal: 10, preventableHpLoss: 6 })
  });
  assert.match(cue.detail, /下一步是本轮最高伤害爆发/);
  assert.doesNotMatch(cue.detail, /14 点/);
});

test("未知或异常输入安全降级，且不修改调用方数据", () => {
  const intent = { attack: 5, mechanicState: { type: "unknown", value: 2 } };
  const options = { intentTurn: 99, fallback: "先观察这个未知敌人的行动。" };
  const before = JSON.stringify({ intent, options });
  const fallback = enemyIntentCounterplayCue("unknownEnemy", intent, options);
  assert.equal(fallback.detail, options.fallback);
  assert.equal(JSON.stringify({ intent, options }), before);

  assert.doesNotThrow(() => enemyIntentCounterplayCue(Symbol("enemy"), {
    attack: Symbol("damage")
  }, { intentTurn: Symbol("turn") }));
});
