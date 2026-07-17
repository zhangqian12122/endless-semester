import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cardDefinition } from "../game-engine.js";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

function namedFunctionSource(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `缺少 ${name}`);
  const next = appSource.indexOf("\nfunction ", start + 1);
  return appSource.slice(start, next === -1 ? appSource.length : next);
}

function sourceBetween(startMarker, endMarker) {
  const start = appSource.indexOf(startMarker);
  const end = appSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `缺少源码片段：${startMarker}`);
  assert.notEqual(end, -1, `缺少源码片段结束标记：${endMarker}`);
  return appSource.slice(start, end);
}

function cssRuleBodies(source, selector) {
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, prelude]) => prelude.split(",").some((part) => part.trim().endsWith(selector)))
    .map(([, , body]) => body)
    .join("\n");
}

function assertDirectTerminalForwarding(source, label) {
  const recordIndex = source.indexOf("recordCurrentCombat()");
  const resolveIndex = source.indexOf("resolveCombatResult()", recordIndex + 1);
  const renderIndex = source.indexOf("render()", recordIndex + 1);

  assert.notEqual(recordIndex, -1, `${label} 必须先记录终局状态`);
  assert.notEqual(resolveIndex, -1, `${label} 发现战斗终局后必须直接进入奖励或失败流程`);
  assert.ok(renderIndex === -1 || resolveIndex < renderIndex, `${label} 不能先重绘战斗复盘再进入奖励`);
  assert.match(source.slice(recordIndex, resolveIndex), /\bif\b/, `${label} 只能在 recordCurrentCombat 返回终局时跳转`);
}

test("战斗胜负结算不再渲染复盘弹窗，三个终局入口直接进入后续流程", () => {
  const combatRenderer = namedFunctionSource("renderCombat");
  const endTurn = namedFunctionSource("finishPlayerTurn");
  const playCard = sourceBetween(
    '} else if (action === "play-card") {',
    '} else if (action === "discard-card") {'
  );
  const petSkill = sourceBetween(
    '} else if (action === "pet-skill") {',
    '} else if (action === "open-pile") {'
  );

  assert.doesNotMatch(combatRenderer, /renderCombatResult\s*\(/, "战斗页不能再挂载战斗复盘弹窗");
  assertDirectTerminalForwarding(endTurn, "结束回合");
  assertDirectTerminalForwarding(playCard, "打出卡牌");
  assertDirectTerminalForwarding(petSkill, "宠物技能");
});

test("升级牌在所有复用卡面上以牌名加号明确区分", () => {
  const cardSource = namedFunctionSource("cardHtml");
  const renderCard = new Function(
    "cardDefinition",
    "ARCHETYPE_DEFS",
    "rarityName",
    "escapeHtml",
    "cardArtHtml",
    "combatCardPreviewHtml",
    `${cardSource}; return cardHtml;`
  )(
    cardDefinition,
    {},
    () => "普通",
    (value) => String(value),
    () => '<span class="card-art"></span>',
    () => ""
  );

  const normal = renderCard({ id: "textbookStrike", uid: "normal", upgraded: false, enchantment: null });
  const upgraded = renderCard({ id: "textbookStrike", uid: "upgraded", upgraded: true, enchantment: null });
  assert.match(normal, /<span class="card-name"><strong>课本拍击<\/strong><\/span>/);
  assert.match(upgraded, /<span class="card-name"><strong>课本拍击\+<\/strong><\/span>/);
});

test("顶栏只打开本局当前卡牌和当前物品，不再保留档案、图鉴或重复构筑入口", () => {
  const topBarSource = namedFunctionSource("topBar");
  const renderTopBar = new Function(
    "screen",
    "game",
    "PET_TALENT_DEFS",
    "currentPetDefinition",
    `${topBarSource}; return topBar();`
  );
  const game = {
    hp: 42,
    maxHp: 50,
    gold: 80,
    deck: Array.from({ length: 10 }),
    items: ["notebook"],
    backpackCapacity: 4,
    pet: { bond: 2, talent: null, talentLevel: 0 },
    archetype: { sign: "♈", label: "白羊座" },
    tarot: null
  };
  const html = renderTopBar("map", game, {}, () => ({ shortName: "小鸭" }));

  assert.doesNotMatch(html, /data-action="open-(?:archive|library|item-library)"/);
  assert.doesNotMatch(html, />查看构筑</);
  assert.match(html, /data-action="open-deck"[^>]*>[\s\S]*?卡牌/);
  assert.match(html, /data-action="open-items"[^>]*>[\s\S]*?物品/);

  const combatHtml = renderTopBar("combat", { ...game, combat: { hand: [] } }, {}, () => ({ shortName: "小鸭" }));
  assert.match(combatHtml, /data-action="open-deck"[^>]*>[\s\S]*?手牌/);

  const clickHandler = sourceBetween('app.addEventListener("click"', 'document.addEventListener("keydown"');
  assert.match(clickHandler, /action === "open-deck"[\s\S]*?changeScreen\("deck", \{ returnState, handOnly: screen === "combat" && Boolean\(game\.combat\)/);
  assert.match(clickHandler, /action === "open-items"[\s\S]*?changeScreen\("items"/);

  const deckRenderer = namedFunctionSource("renderDeck");
  assert.match(deckRenderer, /context\.handOnly && game\.combat/);
  assert.match(deckRenderer, /game\.combat\.hand/);
  assert.match(deckRenderer, /page\("当前手牌"/);
  assert.match(deckRenderer, /className: "current-hand-page"/);
  assert.match(styles, /\.current-hand-page \{[^}]*padding-top: 24px;[^}]*padding-bottom: 22px;/);
  assert.match(styles, /\.current-hand-page \.game-card:disabled \{[^}]*opacity: 1;[^}]*filter: none;/);

  const itemsRenderer = namedFunctionSource("renderItems");
  assert.match(itemsRenderer, /game\.items\.map\(/, "当前物品页必须从本局已持有物品生成");
  assert.match(itemsRenderer, /game\.supplies\.map\(/, "当前物品页必须同时列出本局临时用品");
  assert.match(itemsRenderer, /supplyHtml\(id, \{ disabled: true/, "当前物品页的临时用品只能查看，不能在战外误用");
  assert.doesNotMatch(itemsRenderer, /Object\.(?:keys|values|entries)\(ITEM_DEFS\)/, "当前物品页不能退化成物品图鉴");
});

test("商店与事件桌面页固定在一屏内，场景与决策左右分栏且内容局部排布", () => {
  const shopRenderer = namedFunctionSource("renderShop");
  const eventRenderer = namedFunctionSource("renderEvent");
  const firstMedia = styles.indexOf("@media");
  const desktopStyles = firstMedia === -1 ? styles : styles.slice(0, firstMedia);

  assert.match(shopRenderer, /className:\s*"shop-page"/);
  assert.match(eventRenderer, /className:\s*"event-page"/);

  for (const selector of [".shop-page", ".event-page"]) {
    const body = cssRuleBodies(desktopStyles, selector);
    assert.match(body, /height:\s*(?:calc\(|[\d.]+(?:d?vh|px))/, `${selector} 桌面版必须锁定在视口高度内`);
    assert.match(body, /overflow(?:-y)?:\s*hidden/, `${selector} 桌面版不能依赖整页纵向滚动`);
  }

  const shopCards = cssRuleBodies(desktopStyles, ".shop-page .shop-grid");
  const shopItems = cssRuleBodies(desktopStyles, ".shop-page .item-choice-list");
  const eventOptions = cssRuleBodies(desktopStyles, ".event-page .event-options");
  const horizontalLayout = /grid-template-columns:\s*(?:repeat|minmax)|grid-auto-flow:\s*column|flex-wrap:\s*nowrap/;

  assert.match(shopCards, horizontalLayout, "商店卡牌必须横向或多列展示");
  assert.match(shopItems, horizontalLayout, "商店物品必须横向或多列展示");
  assert.match(cssRuleBodies(desktopStyles, ".event-page"), /grid-template-columns:\s*minmax\(/, "事件页必须保持左场景、右决策的双栏舞台");
  assert.match(eventOptions, /grid-template-columns:\s*minmax\(0,\s*1fr\)/, "右侧事件决策应使用紧凑单列，避免三根拉伸空柱");
  assert.match(eventOptions, /grid-template-rows:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/, "三项事件选择必须均分右侧剩余高度");
  assert.match(eventOptions, /overflow(?:-y)?:\s*hidden/, "桌面事件选项本身不能再要求上下滚动");
  assert.doesNotMatch(eventOptions, /overflow-y:\s*auto|scrollbar-width/, "桌面事件选项不能保留局部纵向滚动条");
});

test("攻击牌只播放命中特效，不再克隆旧卡面人物残影", () => {
  const playCard = sourceBetween(
    '} else if (action === "play-card") {',
    '} else if (action === "discard-card") {'
  );
  const ghostSource = namedFunctionSource("createBattleMotionGhost");
  const studentAvatarSource = namedFunctionSource("renderStudentAvatar");
  const characterAssetSource = namedFunctionSource("characterAssetHtml");

  assert.doesNotMatch(playCard, /captureBattleMotionOrigin\(button,\s*"card"\)/, "出牌时不应再复制整张旧卡面作为攻击飞行体");
  assert.match(ghostSource, /origin\??\.kind\s*!==\s*"pet"[\s\S]*?return null/, "战斗动作克隆仅允许宠物自身，不允许普通卡牌人物残影");
  assert.ok(
    !/student-avatar-fallback/.test(studentAvatarSource)
      || /asset-failed|loaded(?:Character)?Assets?|characterAssetCache|\.complete\b|removeAttribute\(["']hidden["']\)|\bhidden\b/i.test(`${studentAvatarSource}\n${characterAssetSource}\n${styles}`),
    "学生旧建模只能在图片失败时出现，不能在每次出牌重绘后先闪现一帧"
  );
});
