import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const styles = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return styles.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] || "";
}

test("三种敌方状态拥有独立且紧凑的战斗飞行图形", () => {
  for (const [id, dimensions] of Object.entries({
    distracted: [32, 32],
    todo: [30, 34],
    nervous: [32, 34]
  })) {
    const body = rule(`.battle-causal-ghost[data-effect-id="${id}"]`);
    assert.match(body, new RegExp(`width:\\s*${dimensions[0]}px`));
    assert.match(body, new RegExp(`height:\\s*${dimensions[1]}px`));
    assert.ok(dimensions.every((value) => value <= 38));
    assert.doesNotMatch(body, /animation|transition/);
  }
});

test("状态图形支持单字标签与多张倍率徽标", () => {
  const label = rule(".battle-causal-ghost > b");
  const badge = rule(".battle-causal-ghost > small");
  const multiple = rule(".battle-causal-ghost.is-multiple > small");

  assert.match(label, /display:\s*grid/);
  assert.match(label, /place-items:\s*center/);
  assert.match(label, /font-size:\s*12px/);
  assert.match(badge, /display:\s*none/);
  assert.match(badge, /top:\s*-3px/);
  assert.match(badge, /min-width:\s*14px/);
  assert.match(multiple, /display:\s*grid/);
});

test("飞行图形不参与布局或鼠标事件且只预热 transform 与 opacity", () => {
  const base = rule(".battle-causal-ghost");
  assert.match(base, /position:\s*fixed/);
  assert.match(base, /pointer-events:\s*none/);
  assert.match(base, /contain:\s*layout paint style/);
  assert.match(base, /will-change:\s*transform, opacity/);
  assert.doesNotMatch(base, /will-change:[^;]*(?:filter|left|top)/);
  assert.doesNotMatch(base, /animation|transition/);
});

test("减少动态效果时继续彻底隐藏所有状态飞行图形", () => {
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.feedback-field, \.enemy-hit-pulse-layer \{ display: none !important; \}/);
  assert.match(styles, /\.feedback-ribbon \{ visibility: visible !important; opacity: 1 !important;/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.played-card-ghost, \.pet-flight, \.battle-causal-ghost \{ display: none !important; \}/);
});
