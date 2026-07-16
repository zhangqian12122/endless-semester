import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("敌人机制牌接入战场并在结算期间冻结刚刚执行的步骤", () => {
  assert.match(appSource, /enemyMechanicProgress[\s\S]*?from "\.\/app-flow\.js"/);
  assert.match(appSource, /function enemyMechanicProgressHtml\(enemy, resolution = null\)/);
  assert.match(appSource, /const intentTurn = resolution \? Math\.max\(0, resolution\.turn - 1\) : enemy\?\.intentTurn/);
  assert.match(appSource, /enemyMechanicProgress\(enemy\?\.id, intentTurn\)/);
  assert.match(appSource, /class="enemy-mechanic-progress kind-\$\{escapeHtml\(enemy\.id\)\}" id="enemy-mechanic-summary"/);
  assert.match(appSource, /class="mechanic-progress-track" aria-hidden="true"/);
  assert.match(appSource, /\$\{enemyMechanicProgressHtml\(combat\.enemy, enemyResolution\)\}/);
  assert.match(appSource, /const ariaLabel = `\$\{progress\.title\}。\$\{progress\.label\}。\$\{progress\.detail\}`/);
  assert.match(appSource, /const mechanicDescriptionId = enemyMechanicProgress\([\s\S]*?\? " enemy-mechanic-summary" : ""/);
  assert.match(appSource, /aria-describedby="enemy-intent-details\$\{mechanicDescriptionId\}"/);
});

test("持续递增格与实际动画目标只在敌方结算阶段获得合成层提示", () => {
  assert.match(appSource, /state === "continuing" \? " is-continuing" : ""/);
  assert.match(styles, /\.combat-board\.enemy-resolving \.enemy-avatar \{ will-change: transform, filter; \}/);
  const baseAvatarRule = styles.match(/\.student-avatar, \.enemy-avatar \{([^}]*)\}/)?.[1] || "";
  assert.doesNotMatch(baseAvatarRule, /will-change:/);
});

test("敌人机制牌 UI 资源使用同一缓存版本", () => {
  const styleVersion = indexSource.match(/styles\.css\?v=([\d.]+)/)?.[1];
  const appVersion = indexSource.match(/app\.js\?v=([\d.]+)/)?.[1];
  assert.equal(styleVersion, "1.8.21");
  assert.equal(appVersion, styleVersion);
});
