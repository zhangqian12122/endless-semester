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

test("同一战斗反馈重绘后保留静态结果且不会重复播放", () => {
  const htmlSource = namedFunctionSource("battleFeedbackHtml");
  const scheduleSource = namedFunctionSource("scheduleBattleMotion");
  const runSource = namedFunctionSource("runBattleMotion");

  assert.match(htmlSource, /feedback\.id === lastAnimatedFeedbackId[\s\S]*?" motion-settled"[\s\S]*?" motion-pending"/);
  assert.match(scheduleSource, /feedback\.id === lastAnimatedFeedbackId/);
  assert.match(runSource, /feedbackRoot\.classList\.remove\("motion-pending", "motion-settled"\)/);
  assert.match(runSource, /feedbackRoot\.classList\.add\("gsap-driven"\)/);
  assert.match(styles, /\.battle-feedback\.motion-settled \.feedback-ribbon \{[^}]*opacity:\s*1;[^}]*animation:\s*none !important;/);
  assert.match(styles, /\.battle-feedback\.motion-settled \.feedback-field,[\s\S]*?\.enemy-hit-pulse-layer \{ display:\s*none; \}/);
});

test("动画等待态在 GSAP 接管前不闪烁，失败时恢复 CSS 反馈", () => {
  const runSource = namedFunctionSource("runBattleMotion");

  assert.match(styles, /\.battle-feedback:is\(\.gsap-driven, \.motion-pending\) \.feedback-ribbon/);
  assert.match(styles, /\.battle-feedback:is\(\.gsap-driven, \.motion-pending\)[\s\S]*?\.feedback-number \{ opacity:\s*0; \}/);
  assert.match(runSource, /!feedbackRoot \|\| !gsap \|\| window\.matchMedia/);
  assert.match(runSource, /feedbackRoot\?\.classList\.remove\("motion-pending", "gsap-driven"\)/);
});

test("临时战斗演出位于模态层下方且不拦截交互", () => {
  for (const selector of [".pet-flight", ".battle-causal-ghost", ".hand .played-card-ghost.game-card"]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const body = styles.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] || "";
    assert.match(body, /z-index:\s*45(?:\s*!important)?/);
    assert.match(body, /pointer-events:\s*none(?:\s*!important)?/);
  }
  assert.match(styles, /\.result-overlay \{[^}]*z-index:\s*50/);
  assert.match(styles, /\.pile-overlay \{[^}]*z-index:\s*58/);
  assert.match(styles, /\.tutorial-overlay \{[^}]*z-index:\s*60/);
});

test("CSS 数字反馈只使用合成 transform 位移", () => {
  const keyframes = styles.match(/@keyframes feedback-number \{([^\n]+)\}/)?.[1] || "";
  assert.match(keyframes, /translate\(-50%,18px\)/);
  assert.match(keyframes, /translate\(-50%,-35px\)/);
  assert.doesNotMatch(keyframes, /margin-(?:top|bottom)/);
});
