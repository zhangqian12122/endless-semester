import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SemesterGame } from "../game-engine.js";
import { battleFeedbackFromDelta } from "../app-flow.js";

function card(game, id) {
  return game.createCard(id);
}

test("抽牌只在弃牌堆真实洗回时返回洗牌结果", () => {
  const game = new SemesterGame(7201, "cancer");
  game.startCombat("sleepyBug");
  game.combat.hand = [];
  game.combat.drawPile = [card(game, "textbookStrike")];
  game.combat.discardPile = [
    card(game, "backpackGuard"),
    card(game, "payAttention"),
    card(game, "scratchPaper")
  ];

  assert.deepEqual(game.drawCards(2), {
    requested: 2,
    drawn: 2,
    reshuffles: [{ moved: 3 }]
  });
  assert.equal(game.combat.hand.length, 2);
  assert.equal(game.combat.drawPile.length, 2);
  assert.equal(game.combat.discardPile.length, 0);

  game.combat.hand = [];
  game.combat.drawPile = [card(game, "textbookStrike")];
  game.combat.discardPile = [card(game, "backpackGuard")];
  assert.deepEqual(game.drawCards(1), { requested: 1, drawn: 1, reshuffles: [] });

  game.combat.hand = [];
  game.combat.drawPile = [];
  game.combat.discardPile = [];
  assert.deepEqual(game.drawCards(2), { requested: 2, drawn: 0, reshuffles: [] });
});

test("同一次出牌会合并双子额外抽牌与卡牌抽牌的真实洗牌结果", () => {
  const game = new SemesterGame(7202, "gemini");
  game.startCombat("sleepyBug");
  const action = card(game, "scratchPaper");
  game.combat.hand = [action];
  game.combat.drawPile = [];
  game.combat.discardPile = [card(game, "textbookStrike"), card(game, "backpackGuard")];
  game.combat.energy = 3;

  assert.deepEqual(game.playCard(action.uid), {
    ok: true,
    drawResult: {
      requested: 2,
      drawn: 2,
      reshuffles: [{ moved: 2 }]
    }
  });
  assert.equal(game.combat.pendingDiscard, 1);
});

test("宠物抽牌与下一回合抽牌都会向界面传递真实洗牌结果", () => {
  const petGame = new SemesterGame(7203, "cancer");
  petGame.startCombat("sleepyBug");
  petGame.pet.talent = "scout";
  petGame.pet.talentLevel = 1;
  petGame.pet.charge = petGame.pet.maxCharge;
  petGame.combat.energy = 3;
  petGame.combat.hand = [];
  petGame.combat.drawPile = [];
  petGame.combat.discardPile = [card(petGame, "textbookStrike"), card(petGame, "backpackGuard")];

  assert.deepEqual(petGame.usePetSkill(), {
    ok: true,
    drawResult: {
      requested: 1,
      drawn: 1,
      reshuffles: [{ moved: 2 }]
    }
  });

  const turnGame = new SemesterGame(7204, "cancer");
  turnGame.startCombat("sleepyBug");
  turnGame.combat.hand = [card(turnGame, "backpackGuard")];
  turnGame.combat.drawPile = [];
  turnGame.combat.discardPile = [];
  const turnResult = turnGame.endTurn();
  assert.deepEqual(turnResult.drawResult, {
    requested: 5,
    drawn: 1,
    reshuffles: [{ moved: 1 }]
  });
});

test("洗牌反馈公开移动数量，普通牌堆变化不会误报", () => {
  const feedback = battleFeedbackFromDelta(
    { handSize: 1 },
    { handSize: 2 },
    {
      kind: "card",
      cardPlayed: true,
      drawResult: { requested: 2, drawn: 2, reshuffles: [{ moved: 3 }] }
    }
  );
  assert.equal(feedback.pileReshuffles, 1);
  assert.equal(feedback.reshuffledCards, 3);
  assert.ok(feedback.summaryParts.includes("弃牌洗回抽牌堆 3 张"));

  const ordinary = battleFeedbackFromDelta(
    { handSize: 1, drawPileSize: 0, discardPileSize: 3 },
    { handSize: 2, drawPileSize: 1, discardPileSize: 0 },
    { kind: "card", cardPlayed: true }
  );
  assert.equal(ordinary.pileReshuffles, undefined);
  assert.equal(ordinary.summaryParts.includes("弃牌洗回抽牌堆 3 张"), false);
});

test("战斗界面创建并清理洗牌卡背，减少动态效果时只保留文字", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");

  assert.match(appSource, /createPileShuffleGhosts/);
  assert.match(appSource, /\.pile-button\[data-zone="discardPile"\]/);
  assert.match(appSource, /\.pile-button\[data-zone="drawPile"\]/);
  assert.match(appSource, /\.pile-shuffle-ghost/);
  assert.match(styles, /\.pile-shuffle-ghost/);
  assert.match(styles, /prefers-reduced-motion:[\s\S]*\.pile-shuffle-ghost/);
  assert.match(index, /styles\.css\?v=1\.8\.41/);
  assert.match(index, /app\.js\?v=1\.8\.41/);
});
