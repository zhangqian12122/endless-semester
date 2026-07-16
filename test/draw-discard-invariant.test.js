import test from "node:test";
import assert from "node:assert/strict";

import { SemesterGame } from "../game-engine.js";

function prepareHand(game, cardId, extraCardId = null) {
  game.startCombat("sleepyBug");
  const actionCard = game.createCard(cardId);
  game.combat.hand = [
    actionCard,
    ...(extraCardId ? [game.createCard(extraCardId)] : [])
  ];
  game.combat.drawPile = [];
  game.combat.discardPile = [];
  game.combat.energy = 3;
  return actionCard;
}

for (const cardId of ["scratchPaper", "geminiSwitch"]) {
  test(`${cardId} does not queue an impossible discard when every source is empty`, () => {
    const game = new SemesterGame(7101, "gemini");
    const actionCard = prepareHand(game, cardId);

    assert.equal(game.playCard(actionCard.uid).ok, true);
    assert.equal(game.combat.hand.length, 0);
    assert.equal(game.combat.drawPile.length, 0);
    assert.equal(game.combat.pendingDiscard, 0);
    assert.equal(game.endTurn().ok, true);
  });

  test(`${cardId} still requires a discard when another card is available`, () => {
    const game = new SemesterGame(7102, "gemini");
    const actionCard = prepareHand(game, cardId, "textbookStrike");

    assert.equal(game.playCard(actionCard.uid).ok, true);
    assert.equal(game.combat.pendingDiscard, 1);
    assert.equal(game.endTurn().ok, false);

    const discardableCard = game.combat.hand[0];
    assert.equal(game.discardCard(discardableCard.uid).ok, true);
    assert.equal(game.combat.pendingDiscard, 0);
    assert.equal(game.endTurn().ok, true);
  });
}
