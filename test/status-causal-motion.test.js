import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");

function namedFunctionSource(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `缺少 ${name}`);
  const next = appSource.indexOf("\nfunction ", start + 1);
  return appSource.slice(start, next === -1 ? appSource.length : next);
}

test("敌方状态反馈记录战斗各牌区并复用真实落点", () => {
  const snapshotSource = namedFunctionSource("battleStateSnapshot");
  const effectsSource = namedFunctionSource("enemyActionEffects");
  const causalSource = namedFunctionSource("enemyActionCausalEffects");
  const finishSource = namedFunctionSource("finishPlayerTurn");

  assert.match(appSource, /enemyStatusCausalPlacements/);
  for (const zone of ["hand", "drawPile", "discardPile", "exhaustPile"]) {
    assert.match(snapshotSource, new RegExp(`"${zone}"`));
  }
  assert.match(snapshotSource, /map\(\(card\) => String\(card\?\.uid \|\| ""\)\)\.filter\(Boolean\)/);
  assert.match(finishSource, /enemyStatusCausalPlacements\(before\.cardUids, game\.combat, result\.enemyResult\?\.statusAdded\)/);
  assert.match(finishSource, /enemyActionEffects\(result\.enemyResult, statusPlacements\)/);
  assert.match(finishSource, /enemyActionCausalEffects\(result\.enemyResult, statusPlacements\)/);
  assert.match(effectsSource, /placement\.target === "hand"[\s\S]*?"抽到手牌"[\s\S]*?placement\.target === "drawPile"[\s\S]*?"洗入抽牌堆"[\s\S]*?"加入弃牌堆"/);
  assert.match(causalSource, /\["hand", "drawPile", "discardPile"\]\.includes\(placement\.target\)/);
});

test("走神、待办和紧张共享单个带身份与数量的因果飞行体", () => {
  const ghostSource = namedFunctionSource("createBattleCausalGhost");
  const runSource = namedFunctionSource("runBattleMotion");

  assert.match(ghostSource, /new Set\(\["distracted", "todo", "nervous"\]\)/);
  assert.match(ghostSource, /effectSymbols = \{ distracted: "扰", todo: "待", nervous: "紧" \}/);
  assert.match(ghostSource, /ghost\.dataset\.effectId = effectId/);
  assert.match(ghostSource, /ghost\.dataset\.count = String\(effectCount\)/);
  assert.match(ghostSource, /effectCount > 1 \? " is-multiple"/);
  assert.match(ghostSource, /ghost\.setAttribute\("aria-hidden", "true"\)/);
  assert.match(ghostSource, /ghost\.innerHTML = `<b>\$\{effectSymbols\[effectId\] \|\| ""\}<\/b>`/);
  assert.match(runSource, /\(feedback\.causalEffects \|\| \[\]\)\.map\(\(effect\) => \(\{[\s\S]*?createBattleCausalGhost\(effect\)/);
  assert.doesNotMatch(ghostSource, /for \(|Array\.from\(/, "数量大于 1 时也只能创建一个飞行体");
});

test("状态飞行命中手牌或牌堆并经两段走廊绕开战场中心", () => {
  const routeSource = namedFunctionSource("battleCausalRoute");
  const route = new Function(`${routeSource}; return battleCausalRoute;`)();
  const sample = route(900, 240, 180, 610);
  const directY = 240 + (610 - 240) * ((sample.corridorX - 900) / (180 - 900));

  assert.ok(sample.corridorX < 900 && sample.corridorX > 180);
  assert.ok(sample.corridorY > directY + 100, "走廊节点应明显偏离穿过中心的直线路径");

  const runSource = namedFunctionSource("runBattleMotion");
  assert.match(runSource, /entry\.effect\.target === "hand"[\s\S]*?app\.querySelector\("\.hand"\)/);
  assert.match(runSource, /\.pile-button\[data-zone="\$\{entry\.effect\.target\}"\]/);
  assert.match(runSource, /x: motion\.corridorX, y: motion\.corridorY[\s\S]*?duration: \.13/);
  assert.match(runSource, /x: motion\.endX, y: motion\.endY[\s\S]*?duration: \.15/);
});

test("因果飞行不争用 scale 且在 impact 后 0.36 秒内收口", () => {
  const runSource = namedFunctionSource("runBattleMotion");

  assert.match(runSource, /const startAt = "impact"/);
  assert.match(runSource, /scale: \.78, autoAlpha: 1, duration: \.07/);
  assert.match(runSource, /x: motion\.corridorX, y: motion\.corridorY, rotation:[^}]*duration: \.13/);
  assert.match(runSource, /x: motion\.endX, y: motion\.endY, rotation:[^}]*duration: \.15/);
  assert.doesNotMatch(runSource, /x: motion\.(?:corridorX|endX)[^}]*scale:/, "位移 tween 不应同时争用 scale");
  assert.match(runSource, /scale: 1\.05, autoAlpha: 0, duration: \.06 \}, `\$\{startAt\}\+=\.28`/);
  assert.match(runSource, /duration: \.06, clearProps: "transform" \}, `\$\{startAt\}\+=\.3`/);
});
