import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { feedbackEntryDecision } from "../app-flow.js";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("战斗经规则页进入反馈时保留真实问题页面并返回同一规则页", () => {
  const combatContext = { outcome: "challenge", combatInputLocked: false };
  const rulesContext = { returnState: { screen: "combat", context: combatContext } };
  const decision = feedbackEntryDecision("rules", rulesContext);

  assert.equal(decision.issueScreen, "combat");
  assert.deepEqual(decision.returnState, { screen: "rules", context: rulesContext });
  assert.equal(decision.returnState.context.returnState.context, combatContext);
});

test("档案反馈继续返回档案，同时把来源页作为问题页面", () => {
  const archiveContext = { returnState: { screen: "intro", context: {} }, focusEnemy: null };
  assert.deepEqual(feedbackEntryDecision("archive", archiveContext), {
    issueScreen: "intro",
    returnState: { screen: "archive", context: archiveContext }
  });
  assert.deepEqual(feedbackEntryDecision("shop", { offer: 2 }), {
    issueScreen: "shop",
    returnState: { screen: "archive", context: { offer: 2 } }
  });
});

test("规则页提供不挤占战斗顶栏的当前现场反馈入口", () => {
  const rulesStart = appSource.indexOf("function renderRules()");
  const rulesEnd = appSource.indexOf("\nfunction renderStats()", rulesStart);
  const rulesSource = appSource.slice(rulesStart, rulesEnd);
  const topbarStart = appSource.indexOf("function topBar(");
  const topbarEnd = appSource.indexOf("\nfunction storageFailureWarning", topbarStart);
  const topbarSource = appSource.slice(topbarStart, topbarEnd);
  const handlerStart = appSource.indexOf('} else if (action === "open-feedback-report")');
  const handlerEnd = appSource.indexOf('} else if (action === "close-save-transfer")', handlerStart);
  const handlerSource = appSource.slice(handlerStart, handlerEnd);

  assert.match(rulesSource, /class="rules-feedback"/);
  assert.match(rulesSource, /data-action="open-feedback-report"/);
  assert.match(rulesSource, /生成当前现场反馈包/);
  assert.doesNotMatch(topbarSource, /data-action="open-feedback-report"/);
  assert.match(handlerSource, /feedbackEntryDecision\(screen, context\)/);
  assert.match(handlerSource, /returnState: destination\.returnState/);
  assert.match(appSource, /context\.returnState\?\.screen === "rules" \? "返回规则" : "返回档案"/);
  assert.match(appSource, /data-action="close-save-transfer">\$\{returnLabel\}<\/button>/);
  assert.match(styles, /\.rules-feedback\s*\{/);
  assert.match(styles, /\.rules-feedback button\s*\{[^}]*min-height:\s*42px/);
});
