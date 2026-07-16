import test from "node:test";
import assert from "node:assert/strict";

import { SemesterGame } from "../game-engine.js";

function winUsingCard(game, card) {
  game.startCombat("sleepyBug");
  game.combat.hand = [{ ...card }];
  game.combat.drawPile = [];
  game.combat.discardPile = [];
  game.combat.energy = 3;
  game.combat.enemy.hp = 1;

  assert.equal(game.playCard(card.uid).ok, true);
  assert.equal(game.combat.status, "won");
}

function enterNextSemester(game) {
  game.week = 16;
  game.pendingSemesterReward = { stage: "summaryUpgrade", itemChoices: [], fallbackGold: 0 };
  assert.equal(game.completeCurrentSemester(), true);
  assert.equal(game.startNextSemester(), true);
}

test("同一学期的主力牌进度可保存恢复，读取不会改变状态或随机数", () => {
  const game = new SemesterGame(9201, "aries");
  const card = game.deck.find((candidate) => candidate.id === "textbookStrike");
  winUsingCard(game, card);
  winUsingCard(game, card);

  const savedBeforeRead = structuredClone(game.toJSON());
  assert.equal(savedBeforeRead.cardCombatUsesSemester, game.semester);
  const rngBeforeRead = game.rng.state;
  const first = game.summaryCardProgress(card.uid);
  const second = game.summaryCardProgress(card.uid);

  assert.deepEqual(first, {
    current: 2,
    target: 3,
    remaining: 1,
    eligible: false,
    upgradeable: false
  });
  assert.deepEqual(second, first);
  assert.deepEqual(game.toJSON(), savedBeforeRead);
  assert.equal(game.rng.state, rngBeforeRead);

  first.current = 99;
  assert.equal(game.summaryCardProgress(card.uid).current, 2, "调用方修改返回值不能污染引擎状态");

  const restored = SemesterGame.fromJSON(savedBeforeRead);
  assert.deepEqual(restored.summaryCardProgress(card.uid), second);
  assert.equal(restored.semester, game.semester);
});

test("同一张未升级牌在三场胜利中使用后进入期末升级候选", () => {
  const game = new SemesterGame(9202, "gemini");
  const card = game.deck.find((candidate) => candidate.id === "textbookStrike");

  winUsingCard(game, card);
  assert.equal(game.summaryCardProgress(card.uid).current, 1);
  winUsingCard(game, card);
  assert.equal(game.summaryCardProgress(card.uid).current, 2);
  winUsingCard(game, card);

  assert.deepEqual(game.summaryCardProgress(card.uid), {
    current: 3,
    target: 3,
    remaining: 0,
    eligible: true,
    upgradeable: true
  });
  assert.deepEqual(game.eligibleSummaryCards().map((candidate) => candidate.uid), [card.uid]);
});

test("进入下一学期时清空主力牌进度，不能跨学期拼满三场", () => {
  const game = new SemesterGame(9203, "cancer");
  const card = game.deck.find((candidate) => candidate.id === "textbookStrike");
  winUsingCard(game, card);
  winUsingCard(game, card);
  assert.equal(game.summaryCardProgress(card.uid).current, 2);

  enterNextSemester(game);

  assert.equal(game.semester, 2);
  assert.deepEqual(game.cardCombatUses, {});
  assert.deepEqual(game.summaryCardProgress(card.uid), {
    current: 0,
    target: 3,
    remaining: 3,
    eligible: false,
    upgradeable: false
  });

  winUsingCard(game, card);
  assert.equal(game.summaryCardProgress(card.uid).current, 1, "新学期首次使用只能从 0 增至 1");
});

test("删牌清理对应记录，已升级牌保留达标事实但不能成为幽灵候选", () => {
  const game = new SemesterGame(9204, "aries");
  const [removed, upgraded] = game.deck.filter((candidate) => candidate.id === "textbookStrike");
  game.cardCombatUses[removed.uid] = 3;
  game.cardCombatUses[upgraded.uid] = 8;

  assert.equal(game.removeCard(removed.uid), true);
  assert.equal(Object.hasOwn(game.cardCombatUses, removed.uid), false);
  assert.deepEqual(game.summaryCardProgress(removed.uid), {
    current: 0,
    target: 3,
    remaining: 3,
    eligible: false,
    upgradeable: false
  });

  assert.equal(game.upgradeCard(upgraded.uid), true);
  assert.deepEqual(game.summaryCardProgress(upgraded.uid), {
    current: 3,
    target: 3,
    remaining: 0,
    eligible: true,
    upgradeable: false
  });
  assert.equal(game.eligibleSummaryCards().some((card) => card.uid === upgraded.uid), false);
});

test("新版学期标记恢复当前进度，旧档只在第一学期兼容保留", () => {
  const newSaveGame = new SemesterGame(9205, "gemini");
  const newSaveCard = newSaveGame.deck.find((candidate) => candidate.id === "textbookStrike");
  enterNextSemester(newSaveGame);
  newSaveGame.cardCombatUses[newSaveCard.uid] = 2;
  const currentSave = newSaveGame.toJSON();
  assert.equal(currentSave.cardCombatUsesSemester, 2);
  const restoredCurrent = SemesterGame.fromJSON(currentSave);
  assert.equal(restoredCurrent.summaryCardProgress(newSaveCard.uid).current, 2);
  assert.equal(restoredCurrent.loadRepairs.some((note) => /主力进度/.test(note)), false);

  const legacyFirstGame = new SemesterGame(9206, "aries");
  const legacyFirstCard = legacyFirstGame.deck.find((candidate) => candidate.id === "textbookStrike");
  legacyFirstGame.cardCombatUses[legacyFirstCard.uid] = 2;
  const legacyFirstSave = legacyFirstGame.toJSON();
  delete legacyFirstSave.cardCombatUsesSemester;
  const restoredLegacyFirst = SemesterGame.fromJSON(legacyFirstSave);
  assert.equal(restoredLegacyFirst.summaryCardProgress(legacyFirstCard.uid).current, 2);
  assert.equal(restoredLegacyFirst.loadRepairs.some((note) => /主力进度/.test(note)), false);

  const legacyLaterSave = structuredClone(currentSave);
  delete legacyLaterSave.cardCombatUsesSemester;
  const restoredLegacyLater = SemesterGame.fromJSON(legacyLaterSave);
  assert.deepEqual(restoredLegacyLater.cardCombatUses, {});
  assert.equal(restoredLegacyLater.summaryCardProgress(newSaveCard.uid).current, 0);
  assert.equal(restoredLegacyLater.loadRepairs.some((note) => /主力进度/.test(note)), true);
});

test("错学期或污染的主力进度标记会清空记录并留下修复说明", () => {
  const game = new SemesterGame(9207, "cancer");
  const card = game.deck.find((candidate) => candidate.id === "textbookStrike");
  game.cardCombatUses[card.uid] = 3;
  const saved = game.toJSON();

  for (const marker of [2, "1", null, -1]) {
    const corrupted = structuredClone(saved);
    corrupted.cardCombatUsesSemester = marker;
    const restored = SemesterGame.fromJSON(corrupted);
    assert.deepEqual(restored.cardCombatUses, {}, `污染标记 ${String(marker)} 不能恢复进度`);
    assert.equal(restored.loadRepairs.some((note) => /主力进度/.test(note)), true);
  }
});

test("同一 UID 在单场打出多次也只累计一场，战败不累计", () => {
  const repeated = new SemesterGame(9208, "aries");
  const repeatedCard = repeated.deck.find((candidate) => candidate.id === "textbookStrike");
  repeated.startCombat("sleepyBug");
  repeated.combat.hand = [{ ...repeatedCard }];
  repeated.combat.drawPile = [];
  repeated.combat.discardPile = [];
  repeated.combat.energy = 3;
  assert.equal(repeated.playCard(repeatedCard.uid).ok, true);
  repeated.combat.hand = [repeated.combat.discardPile.pop()];
  assert.equal(repeated.playCard(repeatedCard.uid).ok, true);
  assert.equal(repeated.combat.cardsPlayed, 2);
  repeated.combat.enemy.hp = 0;
  assert.equal(repeated.checkCombatEnd(), "won");
  assert.equal(repeated.summaryCardProgress(repeatedCard.uid).current, 1);

  const defeated = new SemesterGame(9209, "gemini");
  const defeatedCard = defeated.deck.find((candidate) => candidate.id === "textbookStrike");
  defeated.startCombat("sleepyBug");
  defeated.combat.hand = [{ ...defeatedCard }];
  defeated.combat.drawPile = [];
  defeated.combat.discardPile = [];
  defeated.combat.energy = 3;
  assert.equal(defeated.playCard(defeatedCard.uid).ok, true);
  defeated.hp = 0;
  assert.equal(defeated.checkCombatEnd(), "lost");
  assert.equal(defeated.summaryCardProgress(defeatedCard.uid).current, 0);
  assert.equal(Object.hasOwn(defeated.cardCombatUses, defeatedCard.uid), false);
});
