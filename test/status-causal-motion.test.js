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
  assert.match(ghostSource, /ghost\.innerHTML = `<b>\$\{effectSymbols\[effectId\] \|\| ""\}<\/b><small>×\$\{effectCount\}<\/small>`/);
  assert.match(runSource, /\(feedback\.causalEffects \|\| \[\]\)\.map\(\(effect\) => \(\{[\s\S]*?createBattleCausalGhost\(effect\)/);
  assert.doesNotMatch(ghostSource, /for \(|Array\.from\(/, "数量大于 1 时也只能创建一个飞行体");
});

function routeSegments(start, route) {
  const points = [start, ...route.points];
  return points.slice(1).map((point, index) => [points[index], point]);
}

function segmentHitsRect([from, to], rect) {
  if (Math.abs(from.x - to.x) < .01) {
    return from.x >= rect.left && from.x <= rect.right
      && Math.max(Math.min(from.y, to.y), rect.top) <= Math.min(Math.max(from.y, to.y), rect.bottom);
  }
  return from.y >= rect.top && from.y <= rect.bottom
    && Math.max(Math.min(from.x, to.x), rect.left) <= Math.min(Math.max(from.x, to.x), rect.right);
}

test("状态飞行根据真实 HUD 障碍选择无碰撞折线路径", () => {
  const routeSource = namedFunctionSource("battleCausalRoute");
  const route = new Function(`${routeSource}; return battleCausalRoute;`)();
  const desktopBlockers = [
    { left: 745, top: 342, right: 965, bottom: 382 },
    { left: 290, top: 342, right: 535, bottom: 382 },
    { left: 470, top: 250, right: 540, bottom: 350 },
    { left: 40, top: 426, right: 110, bottom: 484 },
    { left: 1098, top: 426, right: 1230, bottom: 484 },
    { left: 300, top: 484, right: 980, bottom: 720 }
  ];
  const desktop = route(855, 271, 69, 664, {
    viewport: { width: 1280, height: 720 },
    blockers: desktopBlockers
  });
  assert.equal(desktop.collisions, 0);
  assert.deepEqual(desktop.points.at(-1), { x: 69, y: 664 });
  assert.ok(routeSegments({ x: 855, y: 271 }, desktop)
    .every((segment, index, segments) => desktopBlockers.every((rect) => index === segments.length - 1
      || !segmentHitsRect(segment, { left: rect.left - 13, top: rect.top - 13, right: rect.right + 13, bottom: rect.bottom + 13 }))));

  const mobile = route(288, 227, 195, 732, {
    viewport: { width: 390, height: 844 },
    blockers: [
      { left: 212, top: 317, right: 362, bottom: 337 },
      { left: 129, top: 241, right: 191, bottom: 315 },
      { left: 10, top: 499, right: 62, bottom: 553 },
      { left: 7, top: 560, right: 65, bottom: 618 },
      { left: 108, top: 560, right: 156, bottom: 614 },
      { left: 164, top: 560, right: 212, bottom: 614 },
      { left: 251, top: 560, right: 383, bottom: 615 },
      { left: 157, top: 624, right: 302, bottom: 840 }
    ]
  });
  assert.equal(mobile.collisions, 0);
  assert.deepEqual(mobile.points.at(-1), { x: 195, y: 732 });
  assert.ok(routeSegments({ x: 288, y: 227 }, mobile)
    .every((segment) => !segmentHitsRect(segment, { left: 238, top: 547, right: 396, bottom: 628 })));

  const runSource = namedFunctionSource("runBattleMotion");
  assert.match(runSource, /entry\.effect\.target === "hand"[\s\S]*?app\.querySelector\("\.hand"\)/);
  assert.match(runSource, /\.pile-button\[data-zone="\$\{entry\.effect\.target\}"\]/);
  assert.match(runSource, /routeBlockers = \[\.\.\.app\.querySelectorAll/);
  assert.match(runSource, /"\.end-turn"[\s\S]*?"\.hand \.game-card"/);
  assert.match(runSource, /motion\.points\.forEach\(\(point, pointIndex\) =>/);
});

test("因果飞行按路径长度分配固定 0.28 秒且不争用 scale", () => {
  const runSource = namedFunctionSource("runBattleMotion");

  assert.match(runSource, /const startAt = "impact"/);
  assert.match(runSource, /scale: \.78, autoAlpha: 1, duration: \.07/);
  assert.match(runSource, /const routeDuration = \.28/);
  assert.match(runSource, /const duration = routeDuration \* segmentDistance \/ routeDistance/);
  assert.doesNotMatch(runSource, /x: point\.x[^}]*scale:/, "位移 tween 不应同时争用 scale");
  assert.match(runSource, /scale: 1\.05, autoAlpha: 0, duration: \.06 \}, `\$\{startAt\}\+=\$\{routeDuration\}`/);
  assert.match(runSource, /clearProps: "transform" \}, `\$\{startAt\}\+=\$\{routeDuration \+ \.02\}`/);
});
