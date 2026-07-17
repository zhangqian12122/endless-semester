import test from "node:test";
import assert from "node:assert/strict";

import { CARD_DEFS, PUBLIC_REWARD_CARD_IDS } from "../game-data.js";
import { SemesterGame } from "../game-engine.js";
import { combatNextEnergyState } from "../app-flow.js";
import { cardStyleContribution } from "../build-analysis.js";

const DELAYED_ENERGY_CARD_IDS = Object.freeze([
  "tomorrowForSure",
  "fiveMoreMinutes",
  "bellAmbush",
  "teacherOvertime",
  "dontRush",
  "powerSavingMode",
  "borrowFromTomorrow",
  "weekendStudy",
  "refuseOverthinking",
  "withdrawHomework",
  "saveAllForTomorrow",
  "ddlPowerSpike",
  "screenshotProof",
  "dontAtMe",
  "oneMoreQuestion",
  "boldIdea",
  "highEndRound",
  "muteGroupChat",
  "brainOffline",
  "cramAtDeadline"
]);

function activeCombat(seed = 12001) {
  const game = new SemesterGame(seed, "cancer");
  game.startCombat("sleepyBug");
  game.combat.enemy.maxHp = 999;
  game.combat.enemy.hp = 999;
  game.combat.enemy.block = 0;
  game.combat.energy = 20;
  game.combat.maxEnergy = 20;
  game.combat.playerBlock = 0;
  game.combat.hand = [];
  game.combat.drawPile = [];
  game.combat.discardPile = [];
  return game;
}

function addHandCard(game, id, upgraded = false) {
  const card = game.createCard(id, upgraded);
  game.combat.hand.push(card);
  return card;
}

function play(game, card) {
  const result = game.playCard(card.uid);
  assert.equal(result?.ok, true, `${CARD_DEFS[card.id]?.name || card.id} 应能成功打出`);
  return result;
}

test("二十张梗牌全部进入普池，并具备独立基础与升级效果", () => {
  assert.equal(new Set(DELAYED_ENERGY_CARD_IDS).size, 20);
  for (const id of DELAYED_ENERGY_CARD_IDS) {
    const definition = CARD_DEFS[id];
    assert.ok(definition, `${id} 必须存在`);
    assert.ok(PUBLIC_REWARD_CARD_IDS.includes(id), `${definition.name} 必须进入公共奖励池`);
    assert.equal(definition.id, id);
    assert.match(definition.name, /\S/);
    assert.match(definition.text, /。/);
    assert.match(definition.upgradedText, /。/);
    assert.ok(definition.effect && definition.upgradedEffect);
  }
  const allNames = Object.values(CARD_DEFS).map((card) => card.name);
  assert.equal(new Set(allNames).size, allNames.length, "卡牌名称必须唯一，避免奖励和牌堆中无法区分");
});

test("构筑参谋会扣除明日能量债务与抽牌代价，不把透支当成白赚", () => {
  assert.equal(cardStyleContribution("powerSavingMode").scores.cycle, 1.5);
  assert.equal(cardStyleContribution("borrowFromTomorrow").scores.cycle, 1.5);
  assert.equal(cardStyleContribution("brainOffline").scores.cycle, 3);
  const pro = cardStyleContribution("cramAtDeadline");
  assert.equal(pro.scores.offense, 4);
  assert.equal(pro.scores.cycle, 0);
});

test("第二批八张梗牌的筛牌、防守、露怯、爆发和明日代价都真实结算", () => {
  const screenshot = activeCombat(12010);
  screenshot.combat.drawPile = [screenshot.createCard("textbookStrike")];
  addHandCard(screenshot, "backpackGuard");
  play(screenshot, addHandCard(screenshot, "screenshotProof"));
  assert.equal(screenshot.combat.hand.length, 2);
  assert.equal(screenshot.combat.pendingDiscard, 1);
  assert.equal(screenshot.combat.exhaustPile.some((card) => card.id === "screenshotProof"), true);

  const quiet = activeCombat(12011);
  addHandCard(quiet, "todo");
  addHandCard(quiet, "nervous");
  play(quiet, addHandCard(quiet, "muteGroupChat"));
  assert.equal(quiet.combat.playerBlock, 10);
  assert.equal(quiet.combat.hand.length, 0);

  const defense = activeCombat(12012);
  play(defense, addHandCard(defense, "dontAtMe"));
  assert.equal(defense.combat.playerBlock, 6);
  assert.equal(defense.combat.enemyAttackDown, 1);

  const setup = activeCombat(12013);
  play(setup, addHandCard(setup, "boldIdea"));
  play(setup, addHandCard(setup, "highEndRound"));
  assert.equal(setup.combat.enemy.hp, 983, "露怯应把高端局的 13 点提高到 16 点");
  assert.equal(setup.combat.nextEnergy, 3);

  const deadline = activeCombat(12014);
  play(deadline, addHandCard(deadline, "brainOffline"));
  play(deadline, addHandCard(deadline, "cramAtDeadline"));
  play(deadline, addHandCard(deadline, "oneMoreQuestion"));
  assert.equal(deadline.combat.enemy.hp, 991, "最后一个问题应被佛脚开光 Pro 触发两次");
  assert.equal(deadline.combat.doubleNextAttack, false);
  assert.equal(deadline.combat.nextEnergy, 3);
  assert.equal(deadline.combat.nextEnergyPenalty, 1);
  assert.equal(deadline.combat.nextDrawPenalty, 2);
});

test("延迟能量可以叠加，只在下一回合结算一次", () => {
  const game = activeCombat(12002);
  const tomorrow = addHandCard(game, "tomorrowForSure");
  const nap = addHandCard(game, "fiveMoreMinutes");
  const bell = addHandCard(game, "bellAmbush");

  play(game, tomorrow);
  play(game, nap);
  play(game, bell);
  assert.equal(game.combat.nextEnergy, 4);
  assert.equal(game.combat.energy, 17);

  game.startPlayerTurn();
  assert.equal(game.combat.energy, 7);
  assert.equal(game.combat.maxEnergy, 7);
  assert.equal(game.combat.nextEnergy, 0);
  assert.equal(game.combat.log.some((entry) => /跨回合能量结算：\+4/.test(entry)), true);

  game.startPlayerTurn();
  assert.equal(game.combat.energy, 3, "延迟能量不能在后续回合重复发放");
});

test("向明天借一点立即给能量，并在下一回合偿还一次", () => {
  const base = activeCombat(12003);
  base.combat.energy = 0;
  base.combat.maxEnergy = 0;
  play(base, addHandCard(base, "borrowFromTomorrow"));
  assert.equal(base.combat.energy, 1);
  assert.equal(base.combat.nextEnergyPenalty, 1);
  base.startPlayerTurn();
  assert.equal(base.combat.energy, 2);
  assert.equal(base.combat.nextEnergyPenalty, 0);

  const upgraded = activeCombat(12004);
  upgraded.combat.energy = 0;
  upgraded.combat.maxEnergy = 0;
  play(upgraded, addHandCard(upgraded, "borrowFromTomorrow", true));
  assert.equal(upgraded.combat.energy, 2);
  assert.equal(upgraded.combat.maxEnergy, 2);
  upgraded.startPlayerTurn();
  assert.equal(upgraded.combat.energy, 2, "升级只提高当前爆发，不应逃掉明日债务");
});

test("全部留到明天会真实清空当前能量并完整存入下一回合", () => {
  const base = activeCombat(12005);
  base.combat.energy = 3;
  base.combat.maxEnergy = 3;
  play(base, addHandCard(base, "saveAllForTomorrow"));
  assert.equal(base.combat.energy, 0);
  assert.equal(base.combat.nextEnergy, 3);
  base.startPlayerTurn();
  assert.equal(base.combat.energy, 6);

  const upgraded = activeCombat(12006);
  upgraded.combat.energy = 2;
  upgraded.combat.maxEnergy = 2;
  play(upgraded, addHandCard(upgraded, "saveAllForTomorrow", true));
  assert.equal(upgraded.combat.energy, 0);
  assert.equal(upgraded.combat.nextEnergy, 3, "升级版应在存下剩余能量后额外追加 1 点");
});

test("撤回了一条作业清理全部状态牌，但延迟能量严格受上限约束", () => {
  const base = activeCombat(12007);
  const card = addHandCard(base, "withdrawHomework");
  for (let index = 0; index < 5; index += 1) addHandCard(base, index % 2 ? "todo" : "nervous");
  play(base, card);
  assert.equal(base.combat.hand.filter((held) => CARD_DEFS[held.id].type === "status").length, 0);
  assert.equal(base.combat.exhaustPile.filter((held) => CARD_DEFS[held.id].type === "status").length, 5);
  assert.equal(base.combat.nextEnergy, 3);
  assert.equal(base.combat.playerBlock, 3);

  const upgraded = activeCombat(12008);
  const upgradedCard = addHandCard(upgraded, "withdrawHomework", true);
  for (let index = 0; index < 6; index += 1) addHandCard(upgraded, "todo");
  play(upgraded, upgradedCard);
  assert.equal(upgraded.combat.nextEnergy, 4);
  assert.equal(upgraded.combat.playerBlock, 5);
});

test("拖堂与周末计划会同时兑现下一回合的额外手牌和能量", () => {
  const game = activeCombat(12009);
  game.combat.drawPile = Array.from({ length: 12 }, (_, index) => game.createCard(index % 2 ? "textbookStrike" : "backpackGuard"));
  play(game, addHandCard(game, "teacherOvertime"));
  play(game, addHandCard(game, "weekendStudy"));
  assert.equal(game.combat.nextDrawBonus, 2);
  assert.equal(game.combat.nextEnergy, 4);

  game.startPlayerTurn();
  assert.equal(game.combat.hand.length, 7);
  assert.equal(game.combat.energy, 7);
  assert.equal(game.combat.nextDrawBonus, 0);
});

test("跨回合收益与债务抵消时仍公开双方来源，并在结算后一起清空", () => {
  const game = activeCombat(12015);
  play(game, addHandCard(game, "powerSavingMode"));
  play(game, addHandCard(game, "borrowFromTomorrow"));
  assert.equal(game.combat.nextEnergy, 1);
  assert.equal(game.combat.nextEnergyPenalty, 1);
  assert.deepEqual(combatNextEnergyState(game.combat), {
    bonus: 1,
    penalty: 1,
    net: 0,
    label: "下回合 ±0",
    detail: "下回合能量获得 1 点、扣除 1 点，净变化 +0 点",
    tone: "balanced"
  });

  game.startPlayerTurn();
  assert.equal(game.combat.energy, 3);
  assert.equal(game.combat.nextEnergy, 0);
  assert.equal(game.combat.nextEnergyPenalty, 0);
  assert.equal(game.combat.log.some((entry) => /\+1 \/ -1（净 \+0）/.test(entry)), true);
});

test("省电模式与能量债务都使用净值徽标，异常输入安全降级", () => {
  assert.deepEqual(combatNextEnergyState({ nextEnergy: 3, nextEnergyPenalty: 1 }), {
    bonus: 3,
    penalty: 1,
    net: 2,
    label: "下回合 +2",
    detail: "下回合能量获得 3 点、扣除 1 点，净变化 +2 点",
    tone: "bonus"
  });
  assert.deepEqual(combatNextEnergyState({ nextEnergy: 1, nextEnergyPenalty: 3 }), {
    bonus: 1,
    penalty: 3,
    net: -2,
    label: "下回合 -2",
    detail: "下回合能量获得 1 点、扣除 3 点，净变化 -2 点",
    tone: "debt"
  });
  assert.deepEqual(combatNextEnergyState({ nextEnergy: "坏数据", nextEnergyPenalty: -9 }), {
    bonus: 0,
    penalty: 0,
    net: 0,
    label: "",
    detail: "",
    tone: "none"
  });
});
