import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CHALLENGE_AFFIX_DEFS,
  CHALLENGE_RULES,
  SemesterGame
} from "../game-engine.js";

const CORE_COMBAT_WEEKS = [4, 6, 11, 14, 15];
const FIXED_COMBAT_WEEKS = [1, 2, 8, 16];
const BASE_NORMAL_REWARD_GOLD = 15;
const HIGH_THREAT_BONUS_GOLD = 10;
const ROUTE_SEEDS = Array.from({ length: 64 }, (_, index) => index + 1);
const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const styleSource = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function readyGame(seed, week) {
  const game = new SemesterGame(seed, "cancer");
  assert.equal(game.chooseTarot("chariot"), true);
  game.week = week;
  return game;
}

function threatPair(game, week) {
  const nodes = game.semesterPlan[week];
  assert.equal(nodes.length, 2, `第 ${week} 周应提供两个战斗节点`);
  assert.ok(nodes.every((node) => node.type === "combat" && !node.challenge),
    `第 ${week} 周应只包含两个普通战斗节点`);
  for (const node of nodes) {
    assert.equal(Number.isFinite(node.routeThreat), true,
      `第 ${week} 周的 ${node.enemy} 必须公开可比较的 routeThreat`);
    assert.equal(Number.isInteger(node.bonusGold), true,
      `第 ${week} 周的 ${node.enemy} 必须公开整数 bonusGold`);
  }
  return [...nodes].sort((left, right) => left.routeThreat - right.routeThreat);
}

test("核心战斗周公开可比较的威胁值，且只有更危险路线承诺额外 10 校园币", () => {
  for (const seed of ROUTE_SEEDS) {
    const game = new SemesterGame(seed, "cancer");
    for (const week of CORE_COMBAT_WEEKS) {
      const [safer, riskier] = threatPair(game, week);
      assert.ok(riskier.routeThreat > safer.routeThreat,
        `种子 ${seed} 第 ${week} 周的两条路线必须有明确高低风险`);
      assert.equal(safer.bonusGold, 0,
        `种子 ${seed} 第 ${week} 周的较低威胁路线不应获得加练奖金`);
      assert.equal(riskier.bonusGold, HIGH_THREAT_BONUS_GOLD,
        `种子 ${seed} 第 ${week} 周的高威胁路线应承诺 +${HIGH_THREAT_BONUS_GOLD} 校园币`);
    }
  }
});

test("选择高威胁路线后，敌人、威胁与奖金检查点经过存档恢复保持一致", () => {
  const game = readyGame(20260717, 11);
  const [, riskier] = threatPair(game, game.week);
  const pending = game.prepareCombatStart(riskier.enemy, "normal");

  assert.ok(pending, "高威胁普通战应能建立战前检查点");
  assert.equal(pending.enemyId, riskier.enemy);
  assert.equal(pending.routeThreat, riskier.routeThreat);
  assert.equal(pending.bonusGold, riskier.bonusGold);

  const saved = game.toJSON();
  const restored = SemesterGame.fromJSON(saved);
  const restoredNode = restored.semesterPlan[restored.week]
    .find((node) => node.enemy === riskier.enemy && !node.challenge);

  assert.deepEqual(restored.semesterPlan, game.semesterPlan,
    "地图公开的威胁与奖金是存档事实，读取时不应重算成另一组承诺");
  assert.deepEqual(restoredNode, riskier);
  assert.deepEqual(restored.pendingCombatStart, game.pendingCombatStart,
    "已选择路线的战前检查点必须完整恢复");
  assert.equal(restored.pendingCombatStart.routeThreat, riskier.routeThreat);
  assert.equal(restored.pendingCombatStart.bonusGold, HIGH_THREAT_BONUS_GOLD);
  assert.equal(restored.rng.state, saved.rngState,
    "恢复路线奖金时不应额外消耗随机数");
});

test("高威胁普通战胜利后实际到账金额与地图承诺一致，并在奖励页公开拆分", () => {
  const game = readyGame(20260718, 14);
  const [, riskier] = threatPair(game, game.week);
  const pending = game.prepareCombatStart(riskier.enemy, "normal");
  assert.ok(pending);

  const restored = SemesterGame.fromJSON(game.toJSON());
  const promisedNode = restored.semesterPlan[restored.week]
    .find((node) => node.enemy === pending.enemyId && !node.challenge);
  restored.startCombat(pending.enemyId, restored.pendingCombatStart.modifiers);
  restored.combat.enemy.hp = 0;
  assert.equal(restored.checkCombatEnd(), "won");

  const goldBeforeReward = restored.gold;
  assert.equal(restored.completePendingCombatStart(), true);
  const reward = restored.prepareNormalCombatReward();
  const promisedTotal = BASE_NORMAL_REWARD_GOLD + promisedNode.bonusGold;

  assert.equal(restored.gold - goldBeforeReward, promisedTotal,
    "实际校园币增量必须等于基础奖励加地图承诺的路线奖金");
  assert.equal(reward.gold, promisedTotal,
    "奖励页状态应公开本场校园币总额");
  assert.equal(reward.bonusGold, promisedNode.bonusGold,
    "奖励页状态应公开其中的高威胁路线奖金");

  const restoredAtReward = SemesterGame.fromJSON(restored.toJSON());
  assert.equal(restoredAtReward.gold, restored.gold,
    "刷新奖励页不能重复发放路线奖金");
  assert.equal(restoredAtReward.pendingCombatReward.gold, promisedTotal);
  assert.equal(restoredAtReward.pendingCombatReward.bonusGold, promisedNode.bonusGold);
});

test("固定战与挑战战不套用核心双战路线奖金", () => {
  for (const seed of ROUTE_SEEDS) {
    const plan = new SemesterGame(seed, "cancer").semesterPlan;
    for (const week of FIXED_COMBAT_WEEKS) {
      assert.equal(plan[week][0].bonusGold ?? 0, 0,
        `种子 ${seed} 第 ${week} 周固定战不应获得高威胁路线奖金`);
    }
    for (const node of plan.flat().filter((candidate) => candidate?.challenge)) {
      assert.equal(node.bonusGold ?? 0, 0,
        `种子 ${seed} 的挑战战 ${node.enemy} 已有独立奖励，不应叠加普通路线奖金`);
    }
  }

  const fixed = readyGame(20260719, 1);
  const fixedNode = fixed.semesterPlan[1][0];
  const fixedPending = fixed.prepareCombatStart(fixedNode.enemy, "normal");
  assert.ok(fixedPending);
  assert.equal(fixedPending.bonusGold ?? 0, 0);
  fixed.startCombat(fixedPending.enemyId, fixedPending.modifiers);
  fixed.combat.enemy.hp = 0;
  assert.equal(fixed.checkCombatEnd(), "won");
  const fixedGold = fixed.gold;
  assert.equal(fixed.completePendingCombatStart(), true);
  const fixedReward = fixed.prepareNormalCombatReward();
  assert.equal(fixed.gold - fixedGold, BASE_NORMAL_REWARD_GOLD,
    "固定普通战应继续只发基础校园币");
  assert.equal(fixedReward.bonusGold ?? 0, 0);

  const challenge = readyGame(20260720, 5);
  const challengeEntry = challenge.semesterPlan
    .map((nodes, week) => ({ week, node: nodes.find((candidate) => candidate.challenge) }))
    .find((entry) => entry.node);
  assert.ok(challengeEntry, "生成路线应包含挑战战");
  challenge.week = challengeEntry.week;
  const challengeNode = challengeEntry.node;
  const challengePending = challenge.prepareCombatStart(challengeNode.enemy, "challenge", {
    challenge: true,
    hpMultiplier: CHALLENGE_RULES.hpMultiplier,
    damageMultiplier: CHALLENGE_RULES.damageMultiplier,
    affix: challengeNode.affix
  });
  assert.ok(challengePending);
  assert.ok(CHALLENGE_AFFIX_DEFS[challengePending.modifiers.affix]);
  assert.equal(challengePending.bonusGold ?? 0, 0,
    "挑战战战前检查点不应带入普通高威胁路线奖金");
});

test("地图、战斗与领奖页连续公开同一份高威胁奖励承诺", () => {
  assert.match(appSource, /normalRouteDetailHtml[\s\S]*routeThreat[\s\S]*bonusGold/,
    "地图节点必须同时读取威胁和奖金");
  assert.match(appSource, /node-high-threat/, "高威胁路线必须拥有独立而非挑战战的视觉状态");
  assert.match(appSource, /route-threat-contract/, "战斗中必须继续显示已选择的高压加练契约");
  assert.match(appSource, /高压加练奖励[\s\S]*pending\.gold[\s\S]*pending\.bonusGold/,
    "领奖页必须使用已固定的奖励状态，而不是重新猜测");
  assert.match(styleSource, /\.node-high-threat\b/);
  assert.match(styleSource, /\.route-threat-chip\b/);
  assert.match(styleSource, /\.route-threat-contract\b/);
  assert.match(styleSource,
    /\.combat-page \.tarot-combat-contract,\s*\.combat-page \.challenge-contract,\s*\.combat-page \.route-threat-contract \{ gap: 12px; min-height: 34px;/,
    "桌面固定视口必须把高压契约压缩为单行，不能挤入手牌坞");
  assert.match(styleSource,
    /\.combat-page:has\(\.route-threat-contract\) \.route-threat-contract \{ position: absolute;[\s\S]{0,260}height: 34px;/,
    "桌面低高度必须给高压契约独立的紧凑定位");
  assert.match(styleSource,
    /\.combat-page \.challenge-contract,\s*\.combat-page \.route-threat-contract,\s*\.combat-page \.tarot-combat-contract,\s*\.combat-page \.challenge-trial-progress \{[\s\S]{0,220}flex: 0 0 34px;/,
    "移动战斗页必须把高压契约纳入 34px 紧凑条");
  assert.match(styleSource,
    /\.combat-page:has\(\.challenge-contract\),\s*\.combat-page:has\(\.route-threat-contract\),\s*\.combat-page:has\(\.challenge-trial-progress\),[\s\S]{0,150}overflow-y: auto;/,
    "移动短屏必须允许高压契约战斗页纵向滚动，避免内容被裁切");

  const styleVersion = indexSource.match(/styles\.css\?v=([\d.]+)/)?.[1];
  const appVersion = indexSource.match(/app\.js\?v=([\d.]+)/)?.[1];
  assert.equal(styleVersion, appVersion, "脚本与样式缓存版本必须同步");
  assert.equal(styleVersion, "1.8.62", "风险收益界面上线时必须提升缓存版本");
});
