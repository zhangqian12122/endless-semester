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

function mediaBlocks() {
  return [...styles.matchAll(/@media\s+([^\{]+)\{/g)].map((match) => {
    const openingBrace = styles.indexOf("{", match.index);
    let depth = 0;
    let end = openingBrace;
    for (; end < styles.length; end += 1) {
      if (styles[end] === "{") depth += 1;
      if (styles[end] === "}") depth -= 1;
      if (depth === 0) break;
    }
    return {
      query: match[1].replace(/\s+/g, " ").trim(),
      body: styles.slice(openingBrace + 1, end)
    };
  });
}

function mediaBody(query) {
  const block = mediaBlocks().find((candidate) => candidate.query === query);
  assert.ok(block, `缺少媒体查询：${query}`);
  return block.body;
}

function cssRuleBody(source, selector) {
  const body = [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .find(([, prelude]) => prelude.split(",").some((part) => part.trim() === selector))?.[2];
  assert.ok(body, `缺少样式规则：${selector}`);
  return body;
}

const shortcut = new Function(`${namedFunctionSource("shopDetailShortcutCommand")}; return shopDetailShortcutCommand;`)();
const shortcutState = (overrides = {}) => ({
  currentScreen: "shop",
  code: "KeyR",
  key: "r",
  repeat: false,
  typing: false,
  modified: false,
  detailOpen: false,
  dialogOpen: false,
  hasCandidate: true,
  ...overrides
});

test("商店 R 快捷键仅在货架候选上打开，独立第二次 R 或 Esc 关闭且忽略长按重复", () => {
  assert.equal(shortcut(shortcutState()), "open");
  assert.equal(shortcut(shortcutState({ detailOpen: true, dialogOpen: true })), "close");
  assert.equal(shortcut(shortcutState({ code: "Escape", key: "Escape", detailOpen: true, dialogOpen: true })), "close");
  assert.equal(shortcut(shortcutState({ repeat: true })), null, "长按 R 的 repeat 事件不能打开或立即关闭详情");
  assert.equal(shortcut(shortcutState({ hasCandidate: false })), null, "焦点和悬停均不在货品上时 R 不应误触购买或离店");
  assert.equal(shortcut(shortcutState({ dialogOpen: true })), null, "其它模态打开时不能穿透开启货架详情");
  assert.equal(shortcut(shortcutState({ currentScreen: "combat" })), null, "战斗中的 R 必须继续只交给敌人意图快捷键");

  const keydown = appSource.slice(appSource.indexOf('document.addEventListener("keydown"'));
  assert.ok(keydown.indexOf("shopDetailShortcutCommand") < keydown.indexOf("combatShortcutCommand"),
    "商店详情应先按页面作用域判定，非商店时继续落到既有战斗快捷键");
  assert.match(keydown, /shopDetailCommand === "close"[\s\S]*?closeShopDetail\(\)[\s\S]*?openShopDetail\(shopDetailOffer, target\)/);
});

test("三类商店货品共用只读详情层并保留独立购买操作与移动查看入口", () => {
  assert.match(appSource, /cardDefinition\(\{ id, uid: id, upgraded: false, enchantment: null \}\)/);
  const shop = namedFunctionSource("renderShop");
  const detail = namedFunctionSource("renderShopDetail");

  for (const kind of ["card", "item", "supply"]) {
    assert.match(shop, new RegExp(`data-shop-detail-kind="${kind}"`), `缺少 ${kind} 详情候选标记`);
  }
  assert.doesNotMatch(shop, /action:\s*"noop"/, "卡面不能继续是无响应按钮");
  assert.match(shop, /action:\s*"open-shop-detail"/);
  assert.match(shop, /class="shop-detail-button"[\s\S]*?data-action="open-shop-detail"/,
    "物品与用品必须提供不依赖键盘的显式查看按钮");
  assert.match(shop, /class="shop-card-detail-cue"[\s\S]*?点击查看[\s\S]*?<kbd>R<\/kbd>/,
    "手机卡面必须明确提示点击查看");
  assert.match(shop, /data-action="buy-card"/);
  assert.match(shop, /action:\s*"buy-item"/);
  assert.match(shop, /action:\s*"buy-supply"/);
  assert.match(shop, /data-action="leave-shop"/);

  assert.match(detail, /role="dialog" aria-modal="true"/);
  assert.match(detail, /货架详情 · 只读/);
  assert.match(detail, /类别[\s\S]*?费用[\s\S]*?频率[\s\S]*?品质[\s\S]*?价格/);
  assert.match(detail, /definition\.displayText/);
  assert.match(detail, /item\.text/);
  assert.match(detail, /supply\.text/);
  assert.match(detail, /className:\s*"shop-detail-card-preview"[\s\S]*?ariaHidden:\s*true/);
  assert.match(detail, /data-action="close-shop-detail" autofocus/);

  const preview = cssRuleBody(styles, ".shop-detail-card-preview.game-card.disabled");
  assert.match(preview, /opacity:\s*1/);
  assert.match(preview, /filter:\s*none/);
  const viewButton = cssRuleBody(styles, ".shop-detail-button");
  assert.match(viewButton, /min-width:\s*44px/);
  assert.match(viewButton, /min-height:\s*44px/);
});

test("关闭商店详情会重绘货架并把焦点交还原查看或购买控件", () => {
  const close = namedFunctionSource("closeShopDetail");
  const focus = namedFunctionSource("focusActiveDialog");

  assert.match(close, /const previous = shopDetailState[\s\S]*?shopDetailState = null[\s\S]*?render\(\)/);
  assert.match(close, /candidate\.dataset\.shopDetailKind === previous\.kind/);
  assert.match(close, /control\.dataset\.action === previous\.returnAction/);
  assert.match(close, /focusTarget\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(focus, /dialog\.querySelector\("\[autofocus\]"\)/,
    "打开详情后必须复用现有模态自动聚焦");

  const clickStart = appSource.indexOf('app.addEventListener("click"');
  const clickHandler = appSource.slice(clickStart, appSource.indexOf("\nfunction restoreDismissedIntentDetails", clickStart));
  assert.match(clickHandler, /action === "close-shop-detail"[\s\S]*?dataset\.dismiss === "backdrop"[\s\S]*?closeShopDetail\(\)/,
    "背景关闭必须防止详情内容区点击穿透");
});

test("1280×720 与 1366×768 首页固定动态首屏，宠物超量只在局部横向浏览", () => {
  const compact = mediaBody("(min-width: 981px) and (max-height: 820px)");
  const body = cssRuleBody(compact, "body:has(.intro-shell:not(.new-game-confirm-shell))");
  const shell = cssRuleBody(compact, ".intro-shell:not(.new-game-confirm-shell)");
  const copy = cssRuleBody(compact, ".intro-shell:not(.new-game-confirm-shell) .intro-copy");
  const pets = cssRuleBody(compact, ".intro-shell:not(.new-game-confirm-shell) .starting-pet-picker");
  const runButton = cssRuleBody(compact, ".intro-shell:not(.new-game-confirm-shell) .intro-run-actions > button");

  assert.match(body, /height:\s*100dvh/);
  assert.match(body, /overflow:\s*hidden/);
  assert.match(shell, /height:\s*100dvh/);
  assert.match(shell, /min-height:\s*0/);
  assert.match(shell, /overflow:\s*hidden/);
  assert.match(copy, /max-height:\s*calc\(100dvh\s*-\s*20px\)/);
  assert.match(copy, /overflow:\s*hidden/);
  assert.match(pets, /grid-auto-flow:\s*column/);
  assert.match(pets, /overflow-x:\s*auto/);
  assert.match(pets, /overflow-y:\s*hidden/);
  assert.match(runButton, /min-height:\s*42px/);
  assert.doesNotMatch(runButton, /display:\s*none|visibility:\s*hidden/);
  assert.match(cssRuleBody(styles, ".intro-shell::before"), /campus-home-v1\.webp[\s\S]*?cover/,
    "固定首屏仍须保留校园背景主层级");
});
