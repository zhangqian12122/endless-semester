import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SUPPLY_DEFS } from "../game-data.js";
import { SemesterGame } from "../game-engine.js";
import { battleFeedbackFromDelta } from "../app-flow.js";

const SUPPLY_IDS = Object.freeze({
  iceTea: "campusIceTea",
  crispyCone: "crispyCone"
});

function card(game, id = "textbookStrike") {
  return game.createCard(id);
}

function activeCombatWithSupply(id, seed) {
  const game = new SemesterGame(seed, "cancer");
  game.startCombat("sleepyBug");
  game.supplies = [];
  assert.equal(game.addSupply(id), true);
  game.combat.hand = [];
  game.combat.drawPile = [];
  game.combat.discardPile = [];
  return game;
}

function feedbackSnapshot(game) {
  return {
    playerHp: game.hp,
    playerBlock: game.combat.playerBlock,
    enemyHp: game.combat.enemy.hp,
    enemyBlock: game.combat.enemy.block,
    handSize: game.combat.hand.length,
    petCharge: game.pet.charge
  };
}

function useSupplyWithFeedback(game, id) {
  const supply = SUPPLY_DEFS[id];
  const before = feedbackSnapshot(game);
  const result = game.useSupply(id);
  assert.equal(result.ok, true);
  const effectParts = supply.effect.energy ? [`能量 +${supply.effect.energy}`] : [];
  return {
    result,
    feedback: battleFeedbackFromDelta(before, feedbackSnapshot(game), {
      kind: "status",
      label: supply.name,
      effectParts,
      drawResult: result.drawResult
    })
  };
}

function countSummary(feedback, label) {
  return feedback.summaryParts.filter((part) => part === label).length;
}

test("巧脆筒的护甲与宠物充能按真实差值各反馈一次", () => {
  const game = activeCombatWithSupply(SUPPLY_IDS.crispyCone, 9301);
  game.combat.playerBlock = 3;
  game.pet.charge = 0;

  const { feedback } = useSupplyWithFeedback(game, SUPPLY_IDS.crispyCone);

  assert.equal(game.combat.playerBlock, 11);
  assert.equal(game.pet.charge, 1);
  assert.equal(countSummary(feedback, "护甲 +8"), 1);
  assert.equal(countSummary(feedback, "宠物充能 +1"), 1);
  assert.deepEqual(feedback.summaryParts, ["护甲 +8", "宠物充能 +1"]);
});

test("巧脆筒在宠物满充能时不会虚报充能收益", () => {
  const game = activeCombatWithSupply(SUPPLY_IDS.crispyCone, 9302);
  game.pet.charge = game.pet.maxCharge;

  const { feedback } = useSupplyWithFeedback(game, SUPPLY_IDS.crispyCone);

  assert.equal(game.pet.charge, game.pet.maxCharge);
  assert.equal(feedback.petChargeGain, 0);
  assert.equal(feedback.summaryParts.some((part) => part.startsWith("宠物充能 +")), false);
  assert.deepEqual(feedback.summaryParts, ["护甲 +8"]);
});

test("校园冰茶只反馈一次真实抽牌与唯一能量收益", () => {
  const game = activeCombatWithSupply(SUPPLY_IDS.iceTea, 9303);
  game.combat.energy = 1;
  game.combat.drawPile = [card(game)];

  const { feedback } = useSupplyWithFeedback(game, SUPPLY_IDS.iceTea);

  assert.equal(game.combat.energy, 2);
  assert.equal(game.combat.hand.length, 1);
  assert.equal(countSummary(feedback, "能量 +1"), 1);
  assert.equal(countSummary(feedback, "抽牌 +1"), 1);
  assert.deepEqual(feedback.summaryParts, ["抽牌 +1", "能量 +1"]);
});

test("校园冰茶在无牌可抽时不会虚报抽牌", () => {
  const game = activeCombatWithSupply(SUPPLY_IDS.iceTea, 9304);
  game.combat.energy = 2;

  const { result, feedback } = useSupplyWithFeedback(game, SUPPLY_IDS.iceTea);

  assert.equal(result.drawResult, undefined, "没有抽到牌时引擎不应伪造可见抽牌结果");
  assert.equal(game.combat.energy, 3);
  assert.equal(feedback.cardsDrawn, 0);
  assert.equal(feedback.summaryParts.some((part) => part.startsWith("抽牌 +")), false);
  assert.deepEqual(feedback.summaryParts, ["能量 +1"]);
});

test("校园冰茶触发弃牌洗回时保留洗牌与真实抽牌反馈", () => {
  const game = activeCombatWithSupply(SUPPLY_IDS.iceTea, 9305);
  game.combat.discardPile = [
    card(game, "textbookStrike"),
    card(game, "backpackGuard"),
    card(game, "payAttention")
  ];

  const { result, feedback } = useSupplyWithFeedback(game, SUPPLY_IDS.iceTea);

  assert.deepEqual(result.drawResult, {
    requested: 1,
    drawn: 1,
    reshuffles: [{ moved: 3 }]
  });
  assert.equal(feedback.pileReshuffles, 1);
  assert.equal(feedback.reshuffledCards, 3);
  assert.equal(countSummary(feedback, "弃牌洗回抽牌堆 3 张"), 1);
  assert.equal(countSummary(feedback, "抽牌 +1"), 1);
  assert.equal(countSummary(feedback, "能量 +1"), 1);
});

test("战斗用品处理器只手工补充无上限能量，其他反馈交给真实差值", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const start = appSource.indexOf('} else if (action === "use-supply")');
  const end = appSource.indexOf('} else if (action === "discard-card")', start);
  assert.notEqual(start, -1, "缺少 use-supply 处理器");
  assert.notEqual(end, -1, "无法确定 use-supply 处理器边界");
  const handler = appSource.slice(start, end);

  assert.match(handler, /supply\.effect\.energy\s*\?\s*`能量 \+\$\{supply\.effect\.energy\}`/);
  assert.doesNotMatch(handler, /supply\.effect\.(?:block|petCharge|draw)/);
  assert.match(handler, /drawResult:\s*result\.drawResult/);
});
