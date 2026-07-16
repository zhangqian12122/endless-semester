import test from "node:test";
import assert from "node:assert/strict";

import {
  combatDirectActionPreview,
  combatImmediateCounterplayPlan,
  combatStatusHitsProjection,
  enemyIntentCounterplayCue
} from "../app-flow.js";

function incoming(overrides = {}) {
  return {
    perHit: 0,
    hits: 0,
    attackTotal: 0,
    currentBlock: 0,
    endTurnHpLoss: 0,
    totalHpLoss: 0,
    lethal: false,
    ...overrides
  };
}

function preview(overrides = {}) {
  return {
    cost: 1,
    hasDamage: false,
    damagePerHit: 0,
    hits: 0,
    attackTotal: 0,
    enemyBlockAbsorbed: 0,
    healthDamage: 0,
    baseBlock: 0,
    statusBlock: 0,
    block: 0,
    selfDamage: 0,
    statusCount: 0,
    modifiers: [],
    ...overrides
  };
}

function action(key, overrides = {}) {
  const cardPreview = overrides.preview || preview();
  return {
    key,
    source: "card",
    name: key,
    playable: true,
    cost: cardPreview.cost,
    preview: cardPreview,
    mechanicStatusCleared: 0,
    mechanicStatusName: "紧张",
    distractedFollowup: null,
    unaffectedByDistracted: false,
    ...overrides
  };
}

function plan(actions, intent = {}, incomingPreview = incoming(), options = {}) {
  return combatImmediateCounterplayPlan(actions, intent, incomingPreview, {
    enemyHp: 40,
    playerHp: 30,
    distracted: false,
    disabled: false,
    ...options
  });
}

test("宠物技能会归一为卡牌预览，并按敌方护甲逐段计算实际生命伤害", () => {
  const rawPreview = { damage: 7, block: 3, selfDamage: 1 };
  const settings = { cost: 1, enemyBlock: 5, enemyHp: 10 };
  const rawBefore = structuredClone(rawPreview);
  const settingsBefore = structuredClone(settings);

  const normalized = combatDirectActionPreview(rawPreview, settings);

  assert.deepEqual({
    cost: normalized.cost,
    hasDamage: normalized.hasDamage,
    damagePerHit: normalized.damagePerHit,
    hits: normalized.hits,
    attackTotal: normalized.attackTotal,
    enemyBlockAbsorbed: normalized.enemyBlockAbsorbed,
    healthDamage: normalized.healthDamage,
    block: normalized.block,
    selfDamage: normalized.selfDamage,
    statusCount: normalized.statusCount,
    modifiers: normalized.modifiers
  }, {
    cost: 1,
    hasDamage: true,
    damagePerHit: 7,
    hits: 1,
    attackTotal: 7,
    enemyBlockAbsorbed: 5,
    healthDamage: 2,
    block: 3,
    selfDamage: 1,
    statusCount: 0,
    modifiers: []
  });
  assert.deepEqual(rawPreview, rawBefore);
  assert.deepEqual(settings, settingsBefore);

  const result = plan([
    action("duck", {
      source: "pet",
      name: "离线鸭冲撞",
      cost: normalized.cost,
      preview: normalized
    })
  ], {}, incoming(), { enemyHp: 2, playerHp: 10 });
  assert.equal(result.finish?.action.key, "duck");
  assert.equal(result.finish?.action.source, "pet");
  assert.equal(result.finish?.preview.healthDamage, 2);
  assert.equal(result.finish?.tacticalCue.tone, "finish");
});

test("状态轰炸投影只在越过饱和上限并真实减少段数时成立", () => {
  const attack = incoming({ perHit: 4, hits: 3, attackTotal: 12, totalHpLoss: 12 });
  const saturated = {
    type: "statusHits",
    sourceCount: 5,
    value: 3,
    cap: 3
  };

  assert.equal(combatStatusHitsProjection(1, attack, saturated), null, "只清一张仍处于三段上限");
  assert.deepEqual(combatStatusHitsProjection(3, attack, saturated), {
    cleared: 3,
    sourceBefore: 5,
    sourceAfter: 2,
    valueBefore: 3,
    valueAfter: 2,
    reducedHits: 1,
    perHit: 4,
    hitsBefore: 3,
    hitsAfter: 2,
    attackTotalAfter: 8
  });
  assert.equal(combatStatusHitsProjection(3, attack, { ...saturated, type: "rivalInterrupt" }), null);
  assert.equal(combatStatusHitsProjection(0, attack, saturated), null);
});

test("不可用斩杀不会进入计划，可用斩杀始终占据 finish 槽", () => {
  const impossibleKill = action("locked-kill", {
    playable: false,
    cost: 3,
    preview: preview({ cost: 3, hasDamage: true, damagePerHit: 40, hits: 1, attackTotal: 40, healthDamage: 40 })
  });
  const safeKill = action("safe-kill", {
    name: "最后一击",
    preview: preview({ hasDamage: true, damagePerHit: 12, hits: 1, attackTotal: 12, healthDamage: 12 })
  });
  const block = action("block", { preview: preview({ block: 20, baseBlock: 20 }) });

  const onlyLocked = plan([impossibleKill], {}, incoming(), { enemyHp: 12 });
  assert.equal(onlyLocked.finish, null);

  const result = plan([block, impossibleKill, safeKill], {}, incoming({
    perHit: 20,
    hits: 1,
    attackTotal: 20,
    totalHpLoss: 20,
    lethal: true
  }), { enemyHp: 12, playerHp: 10 });
  assert.equal(result.finish?.action.key, "safe-kill");
  assert.equal(result.finish?.tacticalCue.tone, "finish");
});

test("当前攻击致命时只推荐真正解除致命的动作，并关闭 counter 槽", () => {
  const result = plan([
    action("too-small", { preview: preview({ block: 2, baseBlock: 2 }) }),
    action("survive", { preview: preview({ block: 5, baseBlock: 5 }) })
  ], {}, incoming({
    perHit: 12,
    hits: 1,
    attackTotal: 12,
    totalHpLoss: 12,
    lethal: true
  }), { playerHp: 10 });

  assert.equal(result.finish, null);
  assert.equal(result.rescue?.action.key, "survive");
  assert.equal(result.rescue?.tacticalCue.tone, "rescue");
  assert.equal(result.rescue?.currentLoss, 12);
  assert.equal(result.rescue?.projectedLoss, 7);
  assert.equal(result.counter, null);
});

test("四类敌人机制只选择真实越过断点的可执行动作", async (t) => {
  const cases = [
    {
      name: "群聊轰炸越过状态饱和上限",
      expectedKind: "statusHits",
      intent: {
        mechanicState: { type: "statusHits", sourceCount: 5, value: 3, cap: 3 }
      },
      incomingPreview: incoming({ perHit: 4, hits: 3, attackTotal: 12, totalHpLoss: 12 }),
      weak: action("clear-one", { mechanicStatusCleared: 1 }),
      strong: action("clear-three", { mechanicStatusCleared: 3 }),
      projection: { reducedHits: 1, hitsAfter: 2, attackTotalAfter: 8 }
    },
    {
      name: "打印机护甲降到蓄压上限以下",
      expectedKind: "enemyBlockAttack",
      intent: {
        mechanicState: { type: "enemyBlockAttack", sourceCount: 5, value: 3, cap: 3 }
      },
      incomingPreview: incoming({ perHit: 10, hits: 1, attackTotal: 10, totalHpLoss: 10 }),
      weak: action("break-two", { preview: preview({ hasDamage: true, damagePerHit: 2, hits: 1, attackTotal: 2, enemyBlockAbsorbed: 2 }) }),
      strong: action("break-three", { preview: preview({ hasDamage: true, damagePerHit: 3, hits: 1, attackTotal: 3, enemyBlockAbsorbed: 3 }) }),
      projection: { blockBroken: 3, bonusReduced: 1, perHitAfter: 9 }
    },
    {
      name: "卷王只用穿甲后的生命伤害跨过十点",
      expectedKind: "rivalInterrupt",
      intent: {
        mechanicState: { type: "rivalInterrupt", value: 7, cap: 10, triggered: false, attackReduction: 3 }
      },
      incomingPreview: incoming({ perHit: 8, hits: 1, attackTotal: 8, totalHpLoss: 8 }),
      weak: action("real-two", { preview: preview({ hasDamage: true, damagePerHit: 7, hits: 1, attackTotal: 7, enemyBlockAbsorbed: 5, healthDamage: 2 }) }),
      strong: action("real-three", { preview: preview({ hasDamage: true, damagePerHit: 8, hits: 1, attackTotal: 8, enemyBlockAbsorbed: 5, healthDamage: 3 }) }),
      projection: { healthDamage: 3, valueAfter: 10, perHitAfter: 5 }
    },
    {
      name: "期末填空必须打穿全部剩余护甲",
      expectedKind: "examBlank",
      intent: {
        mechanicState: {
          type: "examBlank",
          windowOpen: true,
          value: 5,
          cap: 8,
          remainingBlock: 3,
          triggered: false,
          attackReduction: 6
        }
      },
      incomingPreview: incoming({ perHit: 16, hits: 1, attackTotal: 16, totalHpLoss: 16 }),
      weak: action("break-two", { preview: preview({ hasDamage: true, damagePerHit: 2, hits: 1, attackTotal: 2, enemyBlockAbsorbed: 2 }) }),
      strong: action("break-three", { preview: preview({ hasDamage: true, damagePerHit: 3, hits: 1, attackTotal: 3, enemyBlockAbsorbed: 3 }) }),
      projection: { remainingBlock: 3, blockBroken: 3, perHitAfter: 10 }
    }
  ];

  for (const fixture of cases) {
    await t.test(fixture.name, () => {
      const weakOnly = plan([fixture.weak], fixture.intent, fixture.incomingPreview);
      assert.equal(weakOnly.counter, null, "未越过机制断点时不能给反制建议");

      const result = plan([fixture.weak, fixture.strong], fixture.intent, fixture.incomingPreview);
      assert.equal(result.counter?.kind, fixture.expectedKind);
      assert.equal(result.counter?.action.key, fixture.strong.key);
      assert.notEqual(result.counter?.tacticalCue.tone, "danger");
      for (const [key, value] of Object.entries(fixture.projection)) {
        assert.equal(result.counter?.projection[key], value, `投影字段 ${key}`);
      }
    });
  }
});

test("机制动作完成后仍致命时不会包装成可执行反制建议", () => {
  const result = plan([
    action("break-exam", {
      preview: preview({ hasDamage: true, damagePerHit: 3, hits: 1, attackTotal: 3, enemyBlockAbsorbed: 3 })
    })
  ], {
    mechanicState: {
      type: "examBlank",
      windowOpen: true,
      value: 5,
      cap: 8,
      remainingBlock: 3,
      triggered: false,
      attackReduction: 6
    }
  }, incoming({
    perHit: 16,
    hits: 1,
    attackTotal: 16,
    totalHpLoss: 16,
    lethal: true
  }), { playerHp: 10 });

  assert.equal(result.finish, null);
  assert.equal(result.rescue, null, "破题后仍承受 10 点伤害，不属于脱险");
  assert.equal(result.counter, null, "danger 机制提示不能进入推荐槽");
});

test("走神时可推荐解除走神后的两牌路线", () => {
  const followup = {
    cardUid: "strike-1",
    cardName: "课本拍击",
    cardCost: 1,
    remainingEnergy: 1,
    hits: 1,
    damagePerHitBefore: 3,
    damagePerHitAfter: 5,
    attackTotalBefore: 3,
    attackTotalAfter: 5,
    attackGain: 2,
    enemyBlockAbsorbedBefore: 0,
    enemyBlockAbsorbedAfter: 0,
    healthDamageBefore: 3,
    healthDamageAfter: 5,
    followupSelfDamage: 0,
    lethalBefore: false,
    lethalAfter: false
  };
  const result = plan([
    action("airplane-mode", {
      name: "飞行模式",
      preview: preview({ block: 5, baseBlock: 5 }),
      distractedFollowup: followup
    })
  ], {}, incoming(), { distracted: true });

  assert.equal(result.counter?.kind, "cleanse");
  assert.equal(result.counter?.action.key, "airplane-mode");
  assert.equal(result.counter?.followup.cardUid, "strike-1");
  assert.equal(result.counter?.followup.attackGain, 2);
});

test("清走神牌同时给足护甲时，两步斩杀仍高于无伤提示", () => {
  const followup = {
    cardUid: "strike-finish",
    cardName: "课本拍击",
    cardCost: 1,
    remainingEnergy: 1,
    hits: 1,
    damagePerHitBefore: 7,
    damagePerHitAfter: 10,
    attackTotalBefore: 7,
    attackTotalAfter: 10,
    attackGain: 3,
    enemyBlockAbsorbedBefore: 0,
    enemyBlockAbsorbedAfter: 0,
    healthDamageBefore: 7,
    healthDamageAfter: 10,
    followupSelfDamage: 0,
    lethalBefore: false,
    lethalAfter: true
  };
  const result = plan([
    action("safe-cleanse", {
      name: "飞行模式",
      preview: preview({ block: 8, baseBlock: 8 }),
      distractedFollowup: followup
    })
  ], {}, incoming({
    perHit: 8,
    hits: 1,
    attackTotal: 8,
    totalHpLoss: 8
  }), { enemyHp: 10, playerHp: 20, distracted: true });

  assert.equal(result.finish?.action.key, "safe-cleanse");
  assert.equal(result.finish?.kind, "cleanse");
  assert.equal(result.finish?.tacticalCue.tone, "finish");
  assert.match(result.finish?.tacticalCue.detail, /课本拍击/);
});

test("走神时没有有效清理衔接，则优先提示不受走神影响的伤害技能或宠物", () => {
  const result = plan([
    action("empty-cleanse", {
      name: "无后续的飞行模式",
      preview: preview({ block: 1, baseBlock: 1 }),
      distractedFollowup: null
    }),
    action("weakened-attack", {
      preview: preview({ hasDamage: true, damagePerHit: 3, hits: 1, attackTotal: 3, healthDamage: 3 })
    }),
    action("damage-skill", {
      name: "互相搭把手",
      preview: preview({ hasDamage: true, damagePerHit: 3, hits: 1, attackTotal: 3, healthDamage: 3, block: 3, baseBlock: 3 }),
      unaffectedByDistracted: true
    })
  ], {}, incoming(), { distracted: true });

  assert.equal(result.counter?.kind, "unaffected");
  assert.equal(result.counter?.action.key, "damage-skill");
  assert.equal(result.counter?.preview.healthDamage, 3);
});

test("输入锁定或待弃牌阶段不会生成建议，不可用动作也不会绕过锁定", () => {
  const lethal = action("kill", {
    preview: preview({ hasDamage: true, damagePerHit: 20, hits: 1, attackTotal: 20, healthDamage: 20 })
  });
  const disabled = plan([lethal], {}, incoming(), { enemyHp: 10, disabled: true });
  assert.equal(disabled.finish, null);
  assert.equal(disabled.rescue, null);
  assert.equal(disabled.counter, null);

  const pending = plan([{ ...lethal, playable: false }], {}, incoming(), { enemyHp: 10 });
  assert.equal(pending.finish, null);
  assert.equal(pending.rescue, null);
  assert.equal(pending.counter, null);
});

test("生成反制计划是稳定纯读取，不修改动作、意图、伤害预览或选项", () => {
  const actions = [
    action("clear-three", {
      mechanicStatusCleared: 3,
      preview: preview({ block: 2, baseBlock: 2, statusCount: 3, statusBlock: 2 })
    })
  ];
  const intent = {
    name: "消息轰炸",
    mechanicState: { type: "statusHits", sourceCount: 5, value: 3, cap: 3 }
  };
  const incomingPreview = incoming({ perHit: 4, hits: 3, attackTotal: 12, totalHpLoss: 12 });
  const options = { enemyHp: 40, playerHp: 30, distracted: false, disabled: false };
  const before = structuredClone({ actions, intent, incomingPreview, options });

  const first = combatImmediateCounterplayPlan(actions, intent, incomingPreview, options);
  const second = combatImmediateCounterplayPlan(actions, intent, incomingPreview, options);

  assert.deepEqual(second, first);
  assert.deepEqual({ actions, intent, incomingPreview, options }, before);
});

test("异常数值输入安全降级而不会让建议生成抛错", () => {
  assert.doesNotThrow(() => combatDirectActionPreview({ damage: Symbol("damage") }, {
    cost: Symbol("cost"),
    enemyBlock: 0,
    enemyHp: 10
  }));
  assert.doesNotThrow(() => combatStatusHitsProjection(Symbol("clear"), incoming({
    perHit: 4,
    hits: 2,
    attackTotal: 8
  }), {
    type: "statusHits",
    sourceCount: 3,
    value: 2,
    cap: 2
  }));
  assert.deepEqual(plan([action("odd", { cost: Symbol("cost") })], {}, incoming(), {
    playerHp: 0
  }), { finish: null, rescue: null, counter: null });
});

test("意图建议按斩杀、致命脱险、致命警告的顺序消费行动计划", () => {
  const lethalRisk = {
    state: "lethal",
    attackTotal: 12,
    armorNeeded: 3,
    preventableHpLoss: 3,
    unavoidableHpLoss: 0
  };
  const finish = {
    kind: "mitigate",
    action: { key: "strike", source: "card", name: "课本拍击", cost: 1 },
    preview: { healthDamage: 8 }
  };
  const rescue = {
    kind: "guard",
    action: { key: "guard", source: "card", name: "抱紧书包", cost: 1 },
    tacticalCue: { tone: "rescue", detail: "解除致命，预计剩余 2 生命" },
    preview: { block: 5 }
  };
  const counter = {
    kind: "enemyBlockAttack",
    action: { key: "break", source: "card", name: "猛拍", cost: 1 },
    tacticalCue: { tone: "counter", detail: "重击降低" },
    projection: { blockBroken: 3, perHitBefore: 12, perHitAfter: 11 },
    preview: { enemyBlockAbsorbed: 3 }
  };
  const intent = {
    attack: 12,
    mechanicState: { type: "enemyBlockAttack", sourceCount: 5, value: 3, cap: 3 }
  };

  const finishCue = enemyIntentCounterplayCue("printerJam", intent, {
    risk: lethalRisk,
    plan: { finish, rescue, counter },
    actionsEvaluated: true
  });
  assert.match(finishCue.label, /可直接斩杀/);
  assert.match(finishCue.detail, /课本拍击/);

  const rescueCue = enemyIntentCounterplayCue("printerJam", intent, {
    risk: lethalRisk,
    plan: { finish: null, rescue, counter },
    actionsEvaluated: true
  });
  assert.match(rescueCue.label, /可直接脱险/);
  assert.match(rescueCue.detail, /抱紧书包/);

  const dangerCue = enemyIntentCounterplayCue("printerJam", intent, {
    risk: lethalRisk,
    plan: { finish: null, rescue: null, counter },
    actionsEvaluated: true
  });
  assert.equal(dangerCue.tone, "danger");
  assert.doesNotMatch(dangerCue.label, /破甲|降压/);
});

test("意图建议点名真实可执行动作，待弃牌或无路线时不会给理论指令", () => {
  const intent = {
    attack: 10,
    mechanicState: { type: "enemyBlockAttack", sourceCount: 5, value: 3, cap: 3 }
  };
  const risk = { state: "hit", attackTotal: 10, preventableHpLoss: 5 };
  const counter = {
    kind: "enemyBlockAttack",
    action: { key: "break", source: "pet", name: "鸭鸭·重启猛啄", cost: 1 },
    tacticalCue: { tone: "counter", detail: "重击降低" },
    projection: { blockBroken: 3, perHitBefore: 10, perHitAfter: 9 },
    preview: { enemyBlockAbsorbed: 3 }
  };

  const named = enemyIntentCounterplayCue("printerJam", intent, {
    risk,
    plan: { finish: null, rescue: null, counter },
    actionsEvaluated: true
  });
  assert.match(named.label, /可直接降压/);
  assert.match(named.detail, /鸭鸭·重启猛啄/);

  const unavailable = enemyIntentCounterplayCue("printerJam", intent, {
    risk,
    plan: { finish: null, rescue: null, counter: null },
    actionsEvaluated: true
  });
  assert.match(unavailable.label, /暂无直接路线/);
  assert.match(unavailable.detail, /当前没有单张牌或宠物能直接降低/);
  assert.doesNotMatch(unavailable.detail, /每击破 1 点/);
  assert.doesNotMatch(unavailable.label, /补护甲|抢输出/);

  const pending = enemyIntentCounterplayCue("printerJam", intent, {
    risk,
    pendingDiscard: true,
    plan: { finish: null, rescue: null, counter },
    actionsEvaluated: true
  });
  assert.match(pending.label, /先完成弃牌/);
  assert.doesNotMatch(pending.detail, /鸭鸭/);
});
