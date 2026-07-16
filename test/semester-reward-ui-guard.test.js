import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { BOSS_ITEM_IDS } from "../game-data.js";
import { SemesterGame } from "../game-engine.js";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");

test("跨页面双击只消费第一次点击，第二击不会穿透到新页面", () => {
  assert.match(appSource, /if \(!button \|\| button\.disabled \|\| event\.detail > 1\) return;/);
});

function namedFunctionSource(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `缺少 ${name}`);
  const next = appSource.indexOf("\nfunction ", start + 1);
  return appSource.slice(start, next === -1 ? appSource.length : next);
}

const grantItemSource = namedFunctionSource("grantItem");
const skipItemRewardSource = namedFunctionSource("skipItemReward");

function winFinalExam(game) {
  game.chooseTarot("chariot");
  game.week = 16;
  const pending = game.prepareCombatStart("finalExam", "boss");
  game.startCombat(pending.enemyId, pending.modifiers);
  game.combat.enemy.hp = 0;
  assert.equal(game.checkCombatEnd(), "won");
  assert.equal(game.completePendingCombatStart(), true);
  return game.prepareSemesterRewards(BOSS_ITEM_IDS);
}

function itemHarness(game, choices, onDone) {
  const initialContext = {
    choices: [...choices],
    rewardSource: "semester",
    settling: false,
    onDone
  };
  return new Function("game", "initialContext", `
    let context = initialContext;
    let screen = "itemReward";
    let replacementResumes = 0;
    const setToast = () => {};
    const resumePendingItemReplacement = () => { replacementResumes += 1; };
    ${grantItemSource}
    ${skipItemRewardSource}
    return {
      grantItem,
      skipItemReward,
      setScreen(value) { screen = value; },
      replacementResumes() { return replacementResumes; }
    };
  `)(game, initialContext);
}

test("期末纪念物页面只接受当前候选，成功后旧按钮不能补领第二件", () => {
  const game = new SemesterGame(720, "aries");
  const pending = winFinalExam(game);
  const [chosen, stale] = pending.itemChoices;
  let completions = 0;
  const harness = itemHarness(game, pending.itemChoices, () => { completions += 1; });

  assert.equal(harness.grantItem("autoPencil"), false);
  assert.equal(harness.grantItem(chosen), true);
  assert.equal(harness.grantItem(stale), false);
  assert.equal(completions, 1);
  assert.equal(game.items.includes(chosen), true);
  assert.equal(game.items.includes(stale), false);
  assert.equal(game.pendingSemesterReward?.stage, "summaryUpgrade");
});

test("已离开奖励页的旧纪念物按钮与重复跳过都不会推进状态", () => {
  const stalePage = new SemesterGame(721, "gemini");
  const stalePending = winFinalExam(stalePage);
  let staleCompletions = 0;
  const staleHarness = itemHarness(stalePage, stalePending.itemChoices, () => { staleCompletions += 1; });
  staleHarness.setScreen("selection");
  assert.equal(staleHarness.grantItem(stalePending.itemChoices[0]), false);
  assert.equal(staleCompletions, 0);
  assert.equal(stalePage.pendingSemesterReward?.stage, "bossItem");

  const skipped = new SemesterGame(722, "cancer");
  const skippedPending = winFinalExam(skipped);
  let skipCompletions = 0;
  const skipHarness = itemHarness(skipped, skippedPending.itemChoices, () => { skipCompletions += 1; });
  assert.equal(skipHarness.skipItemReward(), true);
  assert.equal(skipHarness.skipItemReward(), false);
  assert.equal(skipHarness.grantItem(skippedPending.itemChoices[0]), false);
  assert.equal(skipCompletions, 1);
  assert.equal(skipped.pendingSemesterReward?.stage, "summaryUpgrade");
  assert.equal(skipped.items.some((id) => BOSS_ITEM_IDS.includes(id)), false);
});
