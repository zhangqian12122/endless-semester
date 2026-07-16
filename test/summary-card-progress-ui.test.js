import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("构筑页公开完整主力进度，战斗卡面只用三枚小点区分同名卡", () => {
  assert.match(appSource, /function summaryTrainingPanelHtml\(\)/);
  assert.match(appSource, /本进度不会带入下一学期/);
  assert.match(appSource, /game\.deck\.map\(deckCardHtml\)/);
  assert.match(appSource, /class="summary-card-progress \$\{state\}"/);
  assert.match(appSource, /本学期再在 \$\{progress\.remaining\} 场胜利中使用即可达标/);
  assert.match(appSource, /summaryProgress: summaryProgressCard\(card\)/);
  assert.match(appSource, /class="card-summary-dots"/);
  assert.match(styles, /\.deck-card-slot\s*\{/);
  assert.match(styles, /\.summary-progress-pips b\.filled\s*\{/);
  assert.match(styles, /\.card-summary-dots i\.filled\s*\{/);
  assert.match(styles, /\.card-type-banner > i:last-child\s*\{/);
  assert.doesNotMatch(styles, /\.card-type-banner i:last-child\s*\{/);
});

test("胜利复盘只汇总本场实际使用过的可培养卡并限制展示数量", () => {
  assert.match(appSource, /function combatSummaryProgressHtml\(combat\)/);
  assert.match(appSource, /combat\.status !== "won"/);
  assert.match(appSource, /usedCardUids\.has\(card\.uid\)/);
  assert.match(appSource, /const visible = entries\.slice\(0, 4\)/);
  assert.match(appSource, /每张卡组副本独立累计，同一副本每场胜利最多记 1 次/);
  assert.match(appSource, /\$\{combatSummaryProgressHtml\(combat\)\}/);
  assert.match(appSource, /class="result-overlay" role="dialog" aria-modal="true" aria-labelledby="combat-result-title"/);
  assert.match(appSource, /class="result-card recap-card \$\{combat\.status\}" tabindex="-1" autofocus/);
  assert.doesNotMatch(appSource, /data-action="combat-result" autofocus/);
  assert.match(styles, /\.summary-progress-recap-list > span\.ready\s*\{/);
});

test("期末无人达标时指出最接近的牌，移动端反馈改为单列", () => {
  assert.match(appSource, /最接近的是\$\{closest\.name\} \$\{closest\.current\}\/\$\{closest\.target\}/);
  assert.match(appSource, /没有卡牌达到主力升级条件，已跳过/);
  assert.match(appSource, /setToast\(`没有卡牌达到主力升级条件[\s\S]*?game\.completeCurrentSemester\(\);[\s\S]*?changeScreen\("semesterComplete"\)/);
  assert.match(appSource, /game\.awaitingNextSemester/);
  assert.match(appSource, /本学期主力升级已经结算/);
  assert.match(appSource, /卡组和羁绊全部保留，主力进度清零/);
  assert.match(styles, /@media\s*\(max-width:\s*700px\)[\s\S]*?\.summary-progress-recap\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(styles, /@media\s*\(max-width:\s*700px\)[\s\S]*?\.summary-training-panel\s*\{[^}]*flex-direction:\s*column/);
  assert.match(styles, /\.summary-training-panel\.settled\s*\{/);
});
