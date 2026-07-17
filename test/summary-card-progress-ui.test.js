import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

function namedFunctionSource(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `缺少 ${name}`);
  const next = appSource.indexOf("\nfunction ", start + 1);
  return appSource.slice(start, next === -1 ? appSource.length : next);
}

test("当前卡牌页不再展示主力进度，卡面只保留构筑信息与升级加号", () => {
  const deckRenderer = namedFunctionSource("renderDeck");
  assert.match(deckRenderer, /game\.deck\.map\(\(card\) => cardHtml\(card, \{ playable: false \}\)\)/);
  assert.doesNotMatch(deckRenderer, /summaryTraining|summaryProgress|主力进度|3\/3/);
  assert.doesNotMatch(appSource, /function summaryTrainingPanelHtml|function summaryProgressBadgeHtml|class="summary-card-progress/);
  assert.doesNotMatch(styles, /\.summary-training-panel|\.summary-card-progress|\.summary-progress-pips/);
});

test("战斗胜负直接进入奖励流程，不再渲染复盘或主力进度", () => {
  const combatRenderer = namedFunctionSource("renderCombat");
  assert.doesNotMatch(combatRenderer, /combatSummaryProgressHtml|renderCombatResult|主力进度/);
  assert.doesNotMatch(appSource, /function renderCombatResult|function combatSummaryProgressHtml/);
});

test("期末奖励允许从所有未升级牌中任选一张，完成后牌名以加号标记", () => {
  const semesterSummary = namedFunctionSource("showSemesterSummary");
  assert.match(semesterSummary, /game\.semesterUpgradeCandidates\(\)/);
  assert.match(semesterSummary, /期末战利品：升级一张牌/);
  assert.match(semesterSummary, /任选一张未升级的非状态牌/);
  assert.match(semesterSummary, /牌名会直接显示 \+/);
  assert.doesNotMatch(semesterSummary, /eligibleSummaryCards|主力|3\/3/);

  const cardRenderer = namedFunctionSource("cardHtml");
  assert.match(cardRenderer, /instance\.upgraded[\s\S]*?\+"/);
});
