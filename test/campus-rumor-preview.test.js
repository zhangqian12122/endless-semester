import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SemesterGame } from "../game-engine.js";
import { ENEMY_DEFS, ITEM_DEFS, NORMAL_ENEMY_IDS, REGULAR_ITEM_IDS } from "../game-data.js";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function readyRumor(seed = 7601) {
  const game = new SemesterGame(seed, "cancer");
  game.chooseTarot("chariot");
  game.week = 6;
  assert.equal(game.preparePendingEvent("campusRumor"), true);
  return game;
}

function sourceBetween(startMarker, endMarker) {
  const start = appSource.indexOf(startMarker);
  const end = appSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `缺少源码片段：${startMarker}`);
  assert.notEqual(end, -1, `缺少源码片段结束标记：${endMarker}`);
  return appSource.slice(start, end);
}

test("敌人预览不消耗随机数，下一次正式抽取命中同一敌人", () => {
  const game = new SemesterGame(7602, "aries");
  const rngBefore = game.rng.state;

  const firstPreview = game.previewRandomEnemy();
  const secondPreview = game.previewRandomEnemy();

  assert.ok(NORMAL_ENEMY_IDS.includes(firstPreview), "预览必须来自普通敌人池");
  assert.equal(secondPreview, firstPreview, "同一随机状态下重复预览必须稳定");
  assert.equal(game.rng.state, rngBefore, "预览不得推进正式随机数");
  assert.equal(game.randomEnemy(), firstPreview, "下一次正式抽取必须命中已公开的敌人");
  assert.notEqual(game.rng.state, rngBefore, "正式抽取仍需保持原有随机数消耗");
});

test("校园怪谈只在待处理怪谈事件中公开稳定的强化敌人", () => {
  const game = new SemesterGame(7603, "gemini");
  assert.equal(game.campusRumorPreview(), null, "普通流程不应泄露怪谈敌人");
  game.chooseTarot("hermit");
  game.week = 6;
  assert.equal(game.preparePendingEvent("mealCard"), true);
  assert.equal(game.campusRumorPreview(), null, "其他校园事件不应生成怪谈预览");

  const rumor = readyRumor(7604);
  const rngBefore = rumor.rng.state;
  const preview = rumor.campusRumorPreview();

  assert.ok(NORMAL_ENEMY_IDS.includes(preview.enemyId));
  assert.equal(ENEMY_DEFS[preview.enemyId].kind, "normal");
  assert.equal(preview.hpMultiplier, 1.3);
  assert.equal(rumor.rng.state, rngBefore, "读取怪谈线索不得改变后续随机结果");

  const restored = SemesterGame.fromJSON(rumor.toJSON());
  assert.deepEqual(restored.campusRumorPreview(), preview, "刷新恢复后必须继续显示同一线索");
  assert.equal(restored.rng.state, rngBefore);
  assert.equal(restored.randomEnemy(), preview.enemyId, "恢复后正式开战仍需命中公开敌人");
});

test("校园怪谈按物品收集状态公开稀有、普通与校园币三种真实奖励", () => {
  const rareItemIds = REGULAR_ITEM_IDS.filter((id) => ITEM_DEFS[id].rarity === "rare");
  assert.ok(rareItemIds.length > 0, "测试数据至少需要一件普通池稀有物品");

  const withRares = readyRumor(7605);
  const rareReward = withRares.campusRumorPreview().reward;
  assert.equal(rareReward.type, "rareItem");
  assert.equal(rareReward.choices, Math.min(2, rareItemIds.length));

  const withoutRares = readyRumor(7606);
  withoutRares.backpackCapacity = REGULAR_ITEM_IDS.length + 1;
  withoutRares.items = [...rareItemIds];
  const itemReward = withoutRares.campusRumorPreview().reward;
  assert.equal(itemReward.type, "item");
  assert.equal(itemReward.choices, 1);

  const collected = readyRumor(7607);
  collected.backpackCapacity = REGULAR_ITEM_IDS.length + 1;
  collected.items = [...REGULAR_ITEM_IDS];
  const goldReward = collected.campusRumorPreview().reward;
  assert.equal(goldReward.type, "gold");
  assert.equal(goldReward.gold, 70);
});

test("怪谈事件页公开敌人机制、30% 生命强化与动态奖励，不再让玩家盲选", () => {
  const eventSource = sourceBetween("function eventChoices(", "function renderEventConfirm(");

  assert.match(eventSource, /campusRumorPreview\(\)/, "事件页必须读取引擎提供的稳定怪谈线索");
  assert.match(eventSource, /ENEMY_DEFS\[[^\]]+enemyId[^\]]*\]/, "事件页必须读取预览敌人的资料");
  assert.match(eventSource, /mechanicName/, "调查线索必须公开敌人的核心机制名称");
  assert.match(eventSource, /mechanicText/, "调查线索必须解释敌人的核心机制");
  assert.match(eventSource, /生命\s*\+30%/, "调查线索必须把 1.3 倍生命翻译为直观文字");
  assert.match(eventSource, /reward\.type[\s\S]*rareItem[\s\S]*item[\s\S]*gold/, "事件页必须根据奖励三态生成真实描述");

  const styleVersion = indexSource.match(/styles\.css\?v=([\d.]+)/)?.[1];
  const appVersion = indexSource.match(/app\.js\?v=([\d.]+)/)?.[1];
  assert.ok(styleVersion && appVersion, "样式与脚本都必须携带缓存版本");
  assert.equal(appVersion, styleVersion, "样式与脚本必须使用同一缓存版本");
  assert.notEqual(appVersion, "1.8.43", "怪谈事件页更新后必须提升缓存版本");
});
