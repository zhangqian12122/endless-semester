import test from "node:test";
import assert from "node:assert/strict";

import {
  ARCHETYPE_CARD_IDS,
  CARD_DEFS,
  PERSONA_CARD_IDS,
  PUBLIC_REWARD_CARD_IDS
} from "../game-data.js";
import { analyzeBuild, cardStyleContribution } from "../build-analysis.js";
import { SemesterGame } from "../game-engine.js";

function summonerGame(seed = 7701, archetype = "cancer") {
  return new SemesterGame(seed, archetype, "offlineDuck", ["offlineDuck"], "summoner");
}

test("召唤人格的普通奖励固定包含人格牌、星座牌与普池牌", () => {
  const game = summonerGame();
  const choices = game.rewardCards(3);
  assert.equal(choices.length, 3);
  assert.equal(choices.filter((id) => PERSONA_CARD_IDS.summoner.includes(id)).length, 1);
  assert.equal(choices.filter((id) => ARCHETYPE_CARD_IDS.cancer.includes(id)).length, 1);
  assert.equal(choices.filter((id) => PUBLIC_REWARD_CARD_IDS.includes(id)).length, 1);
});

test("召唤人格商店拥有一个人格货位且保存恢复不重抽", () => {
  const game = summonerGame(7702);
  game.chooseTarot("chariot");
  const shopWeek = Object.keys(game.semesterPlan)
    .map(Number)
    .find((week) => game.semesterPlan[week].some((node) => node.type === "shop"));
  assert.ok(shopWeek);
  game.week = shopWeek;
  const shop = game.prepareShop();
  assert.equal(shop.cards.filter((stock) => PERSONA_CARD_IDS.summoner.includes(stock.id)).length, 1);
  assert.equal(shop.cards.filter((stock) => ARCHETYPE_CARD_IDS.cancer.includes(stock.id)).length, 1);
  assert.equal(shop.cards.filter((stock) => PUBLIC_REWARD_CARD_IDS.includes(stock.id)).length, 1);

  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.deepEqual(restored.pendingShop, game.pendingShop);
});

test("零纸灵的动态牌不会偷触发白羊首击、自动铅笔或厚笔记本", () => {
  const attackGame = summonerGame(7703, "aries");
  attackGame.addItem("autoPencil");
  attackGame.startCombat("sleepyBug");
  attackGame.combat.hand = [];
  attackGame.combat.drawPile = [];
  attackGame.combat.discardPile = [];
  attackGame.combat.energy = 3;
  const allPresent = attackGame.createCard("allPresent");
  attackGame.combat.hand.push(allPresent);
  const hpBefore = attackGame.combat.enemy.hp;
  assert.equal(attackGame.playCard(allPresent.uid).ok, true);
  assert.equal(attackGame.combat.enemy.hp, hpBefore);
  assert.equal(attackGame.combat.archetypeAttackUsed, false);
  assert.equal(attackGame.combat.pencilUsed, false);

  const blockGame = summonerGame(7704, "cancer");
  blockGame.addItem("thickNotebook");
  blockGame.startCombat("sleepyBug");
  blockGame.combat.hand = [];
  blockGame.combat.drawPile = [];
  blockGame.combat.discardPile = [];
  blockGame.combat.energy = 3;
  const coverDuty = blockGame.createCard("coverDuty");
  blockGame.combat.hand.push(coverDuty);
  const blockBefore = blockGame.combat.playerBlock;
  assert.equal(blockGame.playCard(coverDuty.uid).ok, true);
  assert.equal(blockGame.combat.playerBlock, blockBefore);
  assert.equal(blockGame.combat.notebookUsed, false);
});

test("召唤牌数值形成蓄势、防守与消耗终结的明确梯度", () => {
  assert.equal(CARD_DEFS.coverDuty.effect.blockPerSummon, 3);
  assert.equal(CARD_DEFS.coverDuty.upgradedEffect.blockPerSummon, 4);
  assert.equal(CARD_DEFS.scatterAfterClass.effect.damagePerSummon, 4);
  assert.equal(CARD_DEFS.scatterAfterClass.upgradedEffect.damagePerSummon, 5);
  assert.equal(CARD_DEFS.scatterAfterClass.effect.consumeSummons, true);
});

test("构筑分析与星座刻印识别动态召唤伤害和护甲", () => {
  assert.ok(cardStyleContribution("allPresent").scores.offense > 0);
  assert.ok(cardStyleContribution("coverDuty").scores.defense > 0);
  assert.ok(cardStyleContribution("summonPaperCrane").scores.pet > 0);

  const game = summonerGame(7705, "aries");
  const dynamicAttack = game.deck.find((card) => card.id === "allPresent");
  assert.equal(game.canEnchant(dynamicAttack), true);
  assert.equal(analyzeBuild(game).scores.pet > 0, true);

  const cancer = summonerGame(7706, "cancer");
  const dynamicGuard = cancer.deck.find((card) => card.id === "coverDuty");
  assert.equal(cancer.canEnchant(dynamicGuard), true);
});

test("整理书包期间旧商店按钮不能继续购买临时用品", () => {
  const game = summonerGame(7707);
  game.pendingShop = {
    cards: [],
    items: [],
    supplies: [{ id: "campusIceTea", sold: false }],
    removePrice: 75,
    removed: false
  };
  game.gold = 100;
  game.pendingItemReplacement = { source: "shop", incoming: "autoPencil", price: 90 };
  assert.equal(game.buyShopSupply("campusIceTea"), null);
  assert.equal(game.gold, 100);
  assert.deepEqual(game.supplies, []);
});
