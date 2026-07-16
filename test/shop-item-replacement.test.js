import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REGULAR_ITEM_IDS } from "../game-data.js";
import { SemesterGame } from "../game-engine.js";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function findShopWeek(game) {
  for (let week = 3; week <= 15; week += 1) {
    if (game.semesterPlan[week]?.some((node) => node.type === "shop")) return week;
  }
  assert.fail("测试路线缺少商店节点");
}

function fullShopGame({ seed = 1601, studentId = false, halfPrice = false } = {}) {
  const game = new SemesterGame(seed, "cancer");
  game.chooseTarot("strength");
  game.backpackCapacity = 6;
  const nonStudentItems = REGULAR_ITEM_IDS.filter((id) => id !== "studentId");
  game.items = studentId
    ? ["studentId", ...nonStudentItems.slice(0, game.backpackCapacity - 1)]
    : nonStudentItems.slice(0, game.backpackCapacity);
  game.gold = 1000;
  game.flags.nextShopHalf = halfPrice;
  game.week = findShopWeek(game);
  const shop = game.prepareShop();
  assert.ok(shop?.items.length, "商店必须生成至少一件未拥有物品");
  const incoming = shop.items[0].id;
  const outgoing = studentId ? "studentId" : game.items[0];
  return { game, incoming, outgoing };
}

function shopStock(game, id) {
  return game.pendingShop?.items.find((stock) => stock.id === id);
}

test("满书包准备商店替换时只冻结成交条件，不提前扣款、售罄或消耗优惠", () => {
  const { game, incoming } = fullShopGame({ halfPrice: true });
  const price = game.shopPrice("item", incoming);
  const goldBefore = game.gold;
  const itemsBefore = [...game.items];

  assert.deepEqual(game.prepareItemReplacement(incoming), {
    incoming,
    source: "shop",
    price,
    started: true
  });
  assert.equal(game.gold, goldBefore);
  assert.deepEqual(game.items, itemsBefore);
  assert.equal(shopStock(game, incoming).sold, false);
  assert.equal(game.flags.nextShopHalf, true);
});

test("确认商店替换会原子扣除冻结价格、替换物品、售罄库存且只统计一次", () => {
  const { game, incoming, outgoing } = fullShopGame({ seed: 1602 });
  const price = game.shopPrice("item", incoming);
  const goldBefore = game.gold;
  const itemsTakenBefore = game.stats.itemsTaken;
  game.prepareItemReplacement(incoming);

  const result = game.replacePendingItem(outgoing);
  assert.equal(result?.incoming, incoming);
  assert.equal(result?.outgoing, outgoing);
  assert.equal(result?.source, "shop");
  assert.equal(result?.price, price);
  assert.equal(game.gold, goldBefore - price);
  assert.equal(game.items.includes(incoming), true);
  assert.equal(game.items.includes(outgoing), false);
  assert.equal(game.items.length, game.backpackCapacity);
  assert.equal(shopStock(game, incoming).sold, true);
  assert.equal(game.stats.itemsTaken, itemsTakenBefore + 1);
  assert.equal(game.pendingItemReplacement, null);

  const goldAfter = game.gold;
  assert.equal(game.replacePendingItem(game.items[0]), null);
  assert.equal(game.gold, goldAfter, "重复确认不能再次扣款");
  assert.equal(game.stats.itemsTaken, itemsTakenBefore + 1);
});

test("取消商店替换会回到原库存，金币、书包、优惠与统计均无副作用", () => {
  const { game, incoming } = fullShopGame({ seed: 1603, halfPrice: true });
  const before = {
    gold: game.gold,
    items: [...game.items],
    shop: game.copyPendingShop(false),
    halfPrice: game.flags.nextShopHalf,
    itemsTaken: game.stats.itemsTaken
  };
  game.prepareItemReplacement(incoming);

  assert.equal(game.cancelPendingItemReplacement(), true);
  assert.equal(game.pendingItemReplacement, null);
  assert.equal(game.gold, before.gold);
  assert.deepEqual(game.items, before.items);
  assert.deepEqual(game.copyPendingShop(false), before.shop);
  assert.equal(game.flags.nextShopHalf, before.halfPrice);
  assert.equal(game.stats.itemsTaken, before.itemsTaken);
  assert.equal(game.cancelPendingItemReplacement(), false);
});

test("学生证与半价优惠会在进入替换时冻结，丢弃学生证仍按原折扣成交", () => {
  const { game, incoming } = fullShopGame({ seed: 1604, studentId: true, halfPrice: true });
  const frozenPrice = game.shopPrice("item", incoming);
  const goldBefore = game.gold;
  const pending = game.prepareItemReplacement(incoming);

  assert.equal(pending.price, frozenPrice);
  const result = game.replacePendingItem("studentId");
  assert.equal(result?.price, frozenPrice);
  assert.equal(game.gold, goldBefore - frozenPrice);
  assert.equal(game.hasItem("studentId"), false);
  assert.equal(game.hasItem(incoming), true);
  assert.equal(game.flags.nextShopHalf, false);
  assert.ok(game.shopPrice("item", incoming) > frozenPrice, "成交后重新询价应不再享受学生证与半价优惠");
});

test("商店与替换检查点可一起恢复，刷新后仍按同一价格且只能成交一次", () => {
  const { game, incoming, outgoing } = fullShopGame({ seed: 1605, halfPrice: true });
  const frozenPrice = game.shopPrice("item", incoming);
  const goldBefore = game.gold;
  game.prepareItemReplacement(incoming);
  const savedShop = game.copyPendingShop(false);

  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.deepEqual(restored.copyPendingShop(false), savedShop);
  assert.deepEqual(restored.pendingItemReplacement, {
    incoming,
    source: "shop",
    price: frozenPrice
  });
  assert.deepEqual(restored.loadRepairs, []);

  assert.equal(restored.replacePendingItem(outgoing)?.price, frozenPrice);
  assert.equal(restored.gold, goldBefore - frozenPrice);
  assert.equal(shopStock(restored, incoming).sold, true);
  const settled = SemesterGame.fromJSON(restored.toJSON());
  const goldAfter = settled.gold;
  assert.equal(settled.pendingItemReplacement, null);
  assert.equal(settled.replacePendingItem(settled.items[0]), null);
  assert.equal(settled.gold, goldAfter);
});

test("同一商店先买物品填满书包再换下该物品，刷新后仍保留已结算库存", () => {
  const { game } = fullShopGame({ seed: 1606 });
  assert.equal(game.pendingShop.items.length, 2, "测试商店需要两件物品");
  const [first, second] = game.pendingShop.items.map((stock) => stock.id);
  game.items.pop();

  assert.equal(game.buyShopItem(first)?.id, first);
  assert.equal(game.items.length, game.backpackCapacity);
  const secondPrice = game.shopPrice("item", second);
  const goldBeforeSecond = game.gold;
  assert.equal(game.prepareItemReplacement(second)?.source, "shop");
  assert.equal(game.replacePendingItem(first)?.incoming, second);

  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.ok(restored.pendingShop, "合法商店不能因为已售物品被换下而在刷新后消失");
  assert.deepEqual(restored.pendingShop.items.map((stock) => stock.sold), [true, true]);
  assert.equal(restored.hasItem(first), false);
  assert.equal(restored.hasItem(second), true);
  assert.equal(restored.gold, goldBeforeSecond - secondPrice);
  assert.deepEqual(restored.loadRepairs, []);
  assert.equal(restored.completePendingShop(), true);
});

test("已售、未售已拥有、非满包、坏价格、错误来源或错误库存的商店替换存档会被清理", () => {
  const makeSave = (seed) => {
    const state = fullShopGame({ seed, halfPrice: true });
    state.game.prepareItemReplacement(state.incoming);
    return { ...state, save: state.game.toJSON() };
  };

  const sold = makeSave(1610);
  sold.save.pendingShop.items.find((stock) => stock.id === sold.incoming).sold = true;
  assert.equal(SemesterGame.fromJSON(sold.save).pendingItemReplacement, null);

  const unsoldOwned = makeSave(1615);
  unsoldOwned.save.items[0] = unsoldOwned.incoming;
  const unsoldOwnedRestored = SemesterGame.fromJSON(unsoldOwned.save);
  assert.equal(unsoldOwnedRestored.pendingShop, null);
  assert.equal(unsoldOwnedRestored.pendingItemReplacement, null);

  const notFull = makeSave(1611);
  notFull.save.items.pop();
  assert.equal(SemesterGame.fromJSON(notFull.save).pendingItemReplacement, null);

  const badPrice = makeSave(1612);
  badPrice.save.pendingItemReplacement.price += 1;
  assert.equal(SemesterGame.fromJSON(badPrice.save).pendingItemReplacement, null);

  const wrongSource = makeSave(1613);
  wrongSource.save.pendingItemReplacement.source = "event";
  assert.equal(SemesterGame.fromJSON(wrongSource.save).pendingItemReplacement, null);

  const wrongStock = makeSave(1614);
  wrongStock.save.pendingShop.items = wrongStock.save.pendingShop.items
    .filter((stock) => stock.id !== wrongStock.incoming);
  assert.equal(SemesterGame.fromJSON(wrongStock.save).pendingItemReplacement, null);
});

test("商店源码公开书包容量与购买后替换入口，样式和脚本缓存版本同步更新", () => {
  const shopStart = appSource.indexOf("function renderShop(");
  const shopEnd = appSource.indexOf("function eventChoices(", shopStart);
  assert.notEqual(shopStart, -1);
  assert.notEqual(shopEnd, -1);
  const shopRenderer = appSource.slice(shopStart, shopEnd);

  assert.match(shopRenderer, /game\.items\.length[\s\S]*?game\.backpackCapacity/, "商店必须公开当前书包容量");
  assert.match(shopRenderer, /购买后替换/, "满书包商品必须明确提示购买后需要替换");
  assert.doesNotMatch(
    shopRenderer,
    /disabled:\s*[^}\n]*game\.items\.length\s*>=\s*game\.backpackCapacity/,
    "满书包不能继续把商品入口直接禁用"
  );
  assert.match(
    appSource,
    /\["combat", "event", "semester", "shop"\]\.includes\(saved\?\.pendingItemReplacement\?\.source\)/,
    "标题页必须把未完成的商店替换识别为整理书包，而不是普通商店"
  );
  assert.match(appSource, /点击一件旧物品即会[\s\S]*?支付冻结价格/, "替换页必须说明点击旧物会立即成交");
  assert.match(appSource, /换下并支付 \$\{pending\.price\} 币/, "每件旧物按钮必须公开成交动作与价格");
  assert.match(appSource, /screen === "replaceItem"[\s\S]*?replace-item-page h1[\s\S]*?focus\(\{ preventScroll: true \}\)/, "替换页应聚焦标题并保持购买上下文在首屏");

  const styleVersion = indexSource.match(/styles\.css\?v=([\d.]+)/)?.[1];
  const appVersion = indexSource.match(/app\.js\?v=([\d.]+)/)?.[1];
  assert.ok(styleVersion);
  assert.equal(appVersion, styleVersion);
  assert.notEqual(styleVersion, "1.8.45", "本轮交互变化必须更新浏览器缓存版本");
});
