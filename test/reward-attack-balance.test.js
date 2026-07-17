import test from "node:test";
import assert from "node:assert/strict";

import {
  ARCHETYPE_CARD_IDS,
  CARD_DEFS,
  PERSONA_CARD_IDS,
  PUBLIC_REWARD_CARD_IDS
} from "../game-data.js";
import { SemesterGame } from "../game-engine.js";

const ARCHETYPES = Object.freeze(["aries", "gemini", "cancer"]);

function hasAttack(cardIds) {
  return cardIds.some((id) => CARD_DEFS[id]?.type === "attack");
}

function shopWeek(game) {
  return Object.keys(game.semesterPlan)
    .map(Number)
    .find((week) => game.semesterPlan[week].some((node) => node.type === "shop"));
}

test("扩充后的普通三选一在可用时稳定保留至少一个攻击选项", () => {
  for (const archetype of ARCHETYPES) {
    for (let seed = 1; seed <= 160; seed += 1) {
      const game = new SemesterGame(seed, archetype);
      const choices = game.rewardCards(3);
      assert.equal(choices.length, 3, `${archetype} / ${seed} 应生成完整三选一`);
      assert.equal(new Set(choices).size, 3);
      assert.equal(hasAttack(choices), true, `${archetype} / ${seed} 不应出现全技能奖励`);
      assert.equal(choices.filter((id) => ARCHETYPE_CARD_IDS[archetype].includes(id)).length, 1);
      assert.equal(choices.filter((id) => PUBLIC_REWARD_CARD_IDS.includes(id)).length, 2);
    }
  }
});

test("召唤人格仍保持人格、星座、普池各一张，并在可用时提供攻击牌", () => {
  for (const archetype of ARCHETYPES) {
    for (let seed = 301; seed <= 380; seed += 1) {
      const game = new SemesterGame(seed, archetype, "offlineDuck", ["offlineDuck"], "summoner");
      const choices = game.rewardCards(3);
      assert.equal(choices.filter((id) => PERSONA_CARD_IDS.summoner.includes(id)).length, 1);
      assert.equal(choices.filter((id) => ARCHETYPE_CARD_IDS[archetype].includes(id)).length, 1);
      assert.equal(choices.filter((id) => PUBLIC_REWARD_CARD_IDS.includes(id)).length, 1);
      assert.equal(hasAttack(choices), true, `${archetype} / ${seed} 召唤奖励不应全是技能`);
    }
  }
});

test("指定稀有度优先级高于攻击保底，不会偷偷混入错误稀有度", () => {
  for (const archetype of ARCHETYPES) {
    const game = new SemesterGame(9001, archetype);
    const choices = game.rewardCards(3, "rare");
    assert.equal(choices.length, 3);
    assert.equal(choices.every((id) => CARD_DEFS[id].rarity === "rare"), true);
  }
});

test("校园商店新货架在可用时至少展示一张攻击牌", () => {
  for (const archetype of ARCHETYPES) {
    for (let seed = 1001; seed <= 1080; seed += 1) {
      const game = new SemesterGame(seed, archetype);
      game.chooseTarot("chariot");
      game.week = shopWeek(game);
      const shop = game.prepareShop();
      const cardIds = shop.cards.map((stock) => stock.id);
      assert.equal(cardIds.length, 3);
      assert.equal(hasAttack(cardIds), true, `${archetype} / ${seed} 商店不应出现全技能货架`);
    }
  }
});

test("同一种子仍生成同一奖励和同一商店库存", () => {
  const leftReward = new SemesterGame(12001, "gemini");
  const rightReward = new SemesterGame(12001, "gemini");
  assert.deepEqual(leftReward.rewardCards(3), rightReward.rewardCards(3));

  const prepareShop = () => {
    const game = new SemesterGame(12002, "cancer");
    game.chooseTarot("hermit");
    game.week = shopWeek(game);
    return game.prepareShop();
  };
  assert.deepEqual(prepareShop(), prepareShop());
});
