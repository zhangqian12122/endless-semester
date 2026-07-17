import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ARCHETYPE_CARD_IDS, CARD_DEFS, DEFAULT_PET_ID, PERSONA_CARD_IDS } from "../game-data.js";
import {
  CHALLENGE_AFFIX_DEFS,
  CHALLENGE_REWARD_DEFS,
  CHALLENGE_RULES,
  NORMAL_COMBAT_REWARD_GOLD,
  SemesterGame
} from "../game-engine.js";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");

function namedFunctionSource(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `缺少 ${name}`);
  const next = appSource.indexOf("\nfunction ", start + 1);
  return appSource.slice(start, next === -1 ? appSource.length : next);
}

const finishCardRewardSource = namedFunctionSource("finishCardReward");
const renderCardRewardSource = namedFunctionSource("renderCardReward");
const resumeChallengeCombatRewardSource = namedFunctionSource("resumeChallengeCombatReward");

function rewardHarness(game, choices, onDone) {
  const initialContext = { choices: [...choices], onDone };
  const finish = new Function("game", "initialContext", "CARD_DEFS", `
    let context = initialContext;
    let screen = "cardReward";
    const setToast = () => {};
    const render = () => {};
    ${finishCardRewardSource}
    return finishCardReward;
  `)(game, initialContext, CARD_DEFS);
  return { finish, context: initialContext };
}

function rewardStats(game) {
  return {
    rewardsSeen: game.stats.rewardsSeen,
    rewardsSkipped: game.stats.rewardsSkipped,
    cardsTaken: game.stats.cardsTaken,
    exclusiveTaken: game.stats.exclusiveTaken,
    publicTaken: game.stats.publicTaken
  };
}

function allowedChoices(game, count = 3) {
  return game.rewardCards(count);
}

function otherAllowedCard(game, choices) {
  const id = Object.keys(CARD_DEFS).find((candidate) => {
    const card = CARD_DEFS[candidate];
    return !choices.includes(candidate)
      && card.type !== "status"
      && (!card.archetype || card.archetype === game.archetypeId);
  });
  assert.ok(id, "测试牌池需要至少一张不在当前候选中的合法卡");
  return id;
}

function normalPendingGame(seed) {
  const game = new SemesterGame(seed, "cancer");
  const choices = allowedChoices(game);
  game.pendingCombatReward = {
    type: "normalCard",
    choices: [...choices],
    gold: NORMAL_COMBAT_REWARD_GOLD,
    bonusGold: 0
  };
  return { game, choices };
}

function prepareWonChallenge(game, affix, enemyId = "phoneSpirit") {
  if (!game.tarotId) game.chooseTarot("chariot");
  game.semesterPlan[game.week] = [{
    type: "combat",
    enemy: enemyId,
    label: "测试挑战",
    challenge: true,
    affix
  }];
  const pendingStart = game.prepareCombatStart(enemyId, "challenge", {
    challenge: true,
    hpMultiplier: CHALLENGE_RULES.hpMultiplier,
    damageMultiplier: CHALLENGE_RULES.damageMultiplier,
    affix
  });
  assert.ok(pendingStart);
  const combat = game.startCombat(pendingStart.enemyId, pendingStart.modifiers);
  combat.enemy.hp = 0;
  assert.equal(game.checkCombatEnd(), "won");
  assert.equal(game.completePendingCombatStart(), true);
  const pendingReward = game.prepareChallengeCombatReward({ affix, enemyId });
  assert.ok(pendingReward);
  return pendingReward;
}

function challengeCardPendingGame(seed, personaId = "student") {
  const game = new SemesterGame(seed, "cancer", DEFAULT_PET_ID, [DEFAULT_PET_ID], personaId);
  game.week = 3;
  const affix = Object.keys(CHALLENGE_AFFIX_DEFS)[0];
  prepareWonChallenge(game, affix);
  const goldBeforeRoute = game.gold;
  assert.equal(game.choosePendingChallengeReward("cards"), true);
  return {
    game,
    choices: [...game.pendingCombatReward.choices],
    goldBeforeRoute
  };
}

test("普通战奖励拒绝不在当前候选中的卡牌 id，且不消费待领奖状态", () => {
  const { game, choices } = normalPendingGame(1801);
  const invalidId = otherAllowedCard(game, choices);
  const deckBefore = game.deck.length;
  const statsBefore = rewardStats(game);
  let completions = 0;
  const { finish } = rewardHarness(game, choices, () => {
    completions += 1;
    game.completePendingCombatReward();
  });

  finish(invalidId);

  assert.equal(game.deck.length, deckBefore, "伪造非候选 id 不能加入卡组");
  assert.deepEqual(rewardStats(game), statsBefore, "非法选择不能污染奖励统计");
  assert.equal(completions, 0, "非法选择不能触发完成回调");
  assert.deepEqual(game.pendingCombatReward?.choices, choices, "非法选择后仍应保留原候选供玩家选择");
});

test("普通战同一候选的重复点击只结算一次", () => {
  const { game, choices } = normalPendingGame(1802);
  const chosenId = choices[0];
  const copiesBefore = game.deck.filter((card) => card.id === chosenId).length;
  const statsBefore = rewardStats(game);
  let completions = 0;
  const { finish } = rewardHarness(game, choices, () => {
    completions += 1;
    game.completePendingCombatReward();
  });

  finish(chosenId);
  finish(chosenId);

  assert.equal(game.deck.filter((card) => card.id === chosenId).length, copiesBefore + 1);
  assert.equal(game.stats.rewardsSeen, statsBefore.rewardsSeen + 1);
  assert.equal(game.stats.cardsTaken, statsBefore.cardsTaken + 1);
  assert.equal(completions, 1, "完成回调必须被消费，不能重复推进周数");
  assert.equal(game.pendingCombatReward, null);
});

test("旧页面令牌与错误奖励来源不能消费当前普通战候选", () => {
  const { game, choices } = normalPendingGame(1812);
  const deckBefore = game.deck.length;
  const statsBefore = rewardStats(game);
  let completions = 0;
  const harness = rewardHarness(game, choices, () => {
    completions += 1;
  });
  harness.context.rewardSource = "normal";
  harness.context.rewardToken = "1:1:normal:current";

  harness.finish(choices[0], "normal", "1:1:normal:stale");
  harness.finish(choices[0], "elite", "1:1:normal:current");

  assert.equal(game.deck.length, deckBefore);
  assert.deepEqual(rewardStats(game), statsBefore);
  assert.equal(completions, 0);
  assert.deepEqual(game.pendingCombatReward?.choices, choices);
});

test("精英奖励 pending 已清空后，旧卡面回调不能再加卡", () => {
  const game = new SemesterGame(1803, "aries");
  game.week = 8;
  const choices = allowedChoices(game);
  game.pendingCombatReward = {
    type: "eliteChain",
    stage: "card",
    choices: [...choices],
    itemChoices: [],
    usedCardUids: [],
    fallbackGold: 0
  };
  let completions = 0;
  const { finish } = rewardHarness(game, choices, () => {
    completions += 1;
    game.advanceEliteCombatRewardFromCard();
  });
  assert.equal(game.resolvePendingCardReward({ source: "elite", choice: null })?.nextStage, "item");
  assert.equal(game.skipPendingEliteItem(), true);
  assert.deepEqual(game.resolvePendingEnchantment(null), { status: "skipped" });
  const deckBefore = game.deck.length;
  const statsBefore = rewardStats(game);

  finish(choices[0]);

  assert.equal(game.deck.length, deckBefore);
  assert.deepEqual(rewardStats(game), statsBefore);
  assert.equal(completions, 0, "已经失效的精英奖励不能推进后续物品阶段");
});

test("精英卡牌奖励由引擎一次性加入卡组并只推进到物品阶段", () => {
  const game = new SemesterGame(1813, "aries");
  game.week = 8;
  const choices = allowedChoices(game);
  game.pendingCombatReward = {
    type: "eliteChain",
    stage: "card",
    choices: [...choices],
    itemChoices: [],
    usedCardUids: [game.deck[0].uid],
    fallbackGold: 0
  };
  const deckBefore = game.deck.length;
  const statsBefore = rewardStats(game);

  const result = game.resolvePendingCardReward({ source: "elite", choice: choices[0] });

  assert.equal(result?.choice, choices[0]);
  assert.equal(game.deck.length, deckBefore + 1);
  assert.equal(game.stats.rewardsSeen, statsBefore.rewardsSeen + 1);
  assert.equal(game.stats.cardsTaken, statsBefore.cardsTaken + 1);
  assert.equal(game.pendingCombatReward?.type, "eliteChain");
  assert.equal(game.pendingCombatReward?.stage, "item");
  assert.deepEqual(game.pendingCombatReward?.usedCardUids, [game.deck[0].uid]);
  const settled = game.toJSON();
  assert.equal(game.resolvePendingCardReward({ source: "elite", choice: choices[0] }), null);
  assert.deepEqual(game.toJSON(), settled, "第二次调用不能重抽物品、改统计或再加牌");
});

test("原子卡牌奖励拒绝错误来源与缺失 choice，失败前后状态完全一致", () => {
  const { game, choices } = normalPendingGame(1814);
  const before = game.toJSON();

  assert.equal(game.resolvePendingCardReward({ source: "elite", choice: choices[0] }), null);
  assert.equal(game.resolvePendingCardReward({ source: "normal" }), null);

  assert.deepEqual(game.toJSON(), before);
});

test("事件奖励跳过后，旧候选回调不能反悔补领或重复推进", () => {
  const game = new SemesterGame(1804, "gemini");
  game.week = 3;
  const choices = allowedChoices(game);
  game.pendingEventReward = {
    type: "card",
    source: "club-skill",
    choices: [...choices],
    cardUids: [],
    itemChoices: []
  };
  const deckBefore = game.deck.length;
  const statsBefore = rewardStats(game);
  let completions = 0;
  const { finish } = rewardHarness(game, choices, () => {
    completions += 1;
    game.completePendingEventReward();
  });

  finish(null);
  finish(choices[0]);

  assert.equal(game.deck.length, deckBefore, "跳过已经完成选择，旧卡面不能再补领");
  assert.equal(game.stats.rewardsSeen, statsBefore.rewardsSeen + 1);
  assert.equal(game.stats.rewardsSkipped, statsBefore.rewardsSkipped + 1);
  assert.equal(game.stats.cardsTaken, statsBefore.cardsTaken);
  assert.equal(completions, 1);
  assert.equal(game.pendingEventReward, null);
});

test("召唤人格的挑战专属卡候选可领取一次，随后拒绝重复领取", () => {
  const { game, choices, goldBeforeRoute } = challengeCardPendingGame(1807, "summoner");
  assert.equal(choices.length, 3);
  assert.equal(
    choices.every((id) => PERSONA_CARD_IDS.summoner.includes(id)),
    true,
    "召唤人格的挑战专属路线应展示人格专属牌"
  );
  assert.equal(game.gold, goldBeforeRoute + CHALLENGE_REWARD_DEFS.cards.gold);

  const chosenId = choices[0];
  const copiesBefore = game.deck.filter((card) => card.id === chosenId).length;
  const statsBefore = rewardStats(game);
  assert.equal(game.resolvePendingCardReward({ source: "challenge", choice: chosenId })?.choice, chosenId);
  assert.equal(game.deck.filter((card) => card.id === chosenId).length, copiesBefore + 1);
  assert.equal(game.stats.rewardsSeen, statsBefore.rewardsSeen + 1);
  assert.equal(game.stats.cardsTaken, statsBefore.cardsTaken + 1);
  assert.equal(game.stats.exclusiveTaken, statsBefore.exclusiveTaken + 1);
  assert.equal(game.pendingCombatReward, null);

  const settled = game.toJSON();
  assert.equal(game.resolvePendingCardReward({ source: "challenge", choice: chosenId }), null);
  assert.deepEqual(game.toJSON(), settled, "重复领取不能再次加牌、加统计或发放路线金币");
});

test("召唤人格的挑战专属卡阶段刷新后保留候选、路线与已发金币", () => {
  const { game: original, choices, goldBeforeRoute } = challengeCardPendingGame(1808, "summoner");
  const goldAfterRoute = original.gold;
  assert.equal(goldAfterRoute, goldBeforeRoute + CHALLENGE_REWARD_DEFS.cards.gold);

  const restored = SemesterGame.fromJSON(original.toJSON());
  assert.equal(restored.personaId, "summoner");
  assert.equal(restored.pendingCombatReward?.type, "challengeChain");
  assert.equal(restored.pendingCombatReward?.stage, "card");
  assert.equal(restored.pendingCombatReward?.route, "cards");
  assert.deepEqual(restored.pendingCombatReward?.choices, choices);
  assert.equal(restored.gold, goldAfterRoute, "刷新不能重复发放或吞掉挑战路线金币");

  const chosenId = choices.at(-1);
  const copiesBefore = restored.deck.filter((card) => card.id === chosenId).length;
  assert.equal(restored.resolvePendingCardReward({ source: "challenge", choice: chosenId })?.choice, chosenId);
  assert.equal(restored.deck.filter((card) => card.id === chosenId).length, copiesBefore + 1);
  assert.equal(restored.pendingCombatReward, null);
});

test("卡牌奖励页把人格专属牌与星座牌、普池牌分开说明", () => {
  assert.match(renderCardRewardSource, /CARD_DEFS\[id\]\.persona === game\.personaId/);
  assert.match(renderCardRewardSource, /张\$\{game\.persona\.name\}专属/);
  assert.match(renderCardRewardSource, /不会出现其他星座或人格专属牌/);
  assert.match(resumeChallengeCombatRewardSource, /game\.personaId === "student" \? "本星座" : game\.persona\.name/);
  assert.doesNotMatch(resumeChallengeCombatRewardSource, /挑战奖励 · 本星座专属池/);
});

test("默认 student 的挑战卡牌奖励刷新恢复后仍使用星座池并只结算一次", () => {
  const original = new SemesterGame(1805, "cancer");
  assert.equal(original.personaId, "student");
  original.week = 3;
  const affix = Object.keys(CHALLENGE_AFFIX_DEFS)[0];
  prepareWonChallenge(original, affix);
  assert.equal(original.choosePendingChallengeReward("cards"), true);

  const restored = SemesterGame.fromJSON(original.toJSON());
  assert.equal(restored.pendingCombatReward?.type, "challengeChain");
  assert.equal(restored.pendingCombatReward?.stage, "card");
  assert.deepEqual(
    restored.pendingCombatReward.choices.every((id) => ARCHETYPE_CARD_IDS[restored.archetypeId].includes(id)),
    true,
    "刷新后候选仍应来自当前星座专属池"
  );
  const choices = [...restored.pendingCombatReward.choices];
  const chosenId = choices[0];
  const copiesBefore = restored.deck.filter((card) => card.id === chosenId).length;
  const statsBefore = rewardStats(restored);
  let completions = 0;
  const { finish } = rewardHarness(restored, choices, () => {
    completions += 1;
    restored.completePendingCombatReward();
  });

  finish(chosenId);
  finish(chosenId);

  assert.equal(restored.deck.filter((card) => card.id === chosenId).length, copiesBefore + 1);
  assert.equal(restored.stats.rewardsSeen, statsBefore.rewardsSeen + 1);
  assert.equal(restored.stats.cardsTaken, statsBefore.cardsTaken + 1);
  assert.equal(completions, 1);
  assert.equal(restored.pendingCombatReward, null);
});

test("商店购卡入口已经按库存索引防止非候选与重复成交", () => {
  const game = new SemesterGame(1806, "cancer");
  const cardId = allowedChoices(game, 1)[0];
  game.gold = 1000;
  game.pendingShop = {
    cards: [{ id: cardId, sold: false }],
    items: [],
    removePrice: 75,
    removed: false
  };
  const price = game.shopPrice("card", cardId);
  const deckBefore = game.deck.length;
  const cardsTakenBefore = game.stats.cardsTaken;

  assert.equal(game.buyShopCard(99), null, "不存在的库存索引不能成交");
  assert.equal(game.buyShopCard(0)?.id, cardId);
  assert.equal(game.buyShopCard(0), null, "同一库存售罄后不能重复成交");
  assert.equal(game.deck.length, deckBefore + 1);
  assert.equal(game.gold, 1000 - price);
  assert.equal(game.stats.cardsTaken, cardsTakenBefore + 1);
  assert.equal(game.pendingShop.cards[0].sold, true);
});
