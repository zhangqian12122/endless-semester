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

function sourceBetween(startMarker, endMarker) {
  const start = appSource.indexOf(startMarker);
  const end = appSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `缺少源码片段：${startMarker}`);
  assert.notEqual(end, -1, `缺少源码片段结束标记：${endMarker}`);
  return appSource.slice(start, end);
}

function cssRuleBodies(source, selector) {
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, prelude]) => prelude.split(",").some((part) => part.trim() === selector))
    .map(([, , body]) => body)
    .join("\n");
}

function mediaBlocks() {
  return [...styles.matchAll(/@media\s+([^\{]+)\{/g)].map((match) => {
    const start = match.index;
    const openingBrace = styles.indexOf("{", start);
    let depth = 0;
    let end = openingBrace;
    for (; end < styles.length; end += 1) {
      if (styles[end] === "{") depth += 1;
      if (styles[end] === "}") depth -= 1;
      if (depth === 0) break;
    }
    return {
      query: match[1].replace(/\s+/g, " ").trim(),
      body: styles.slice(start, end + 1),
      start
    };
  });
}

function lastExactMediaBlock(query) {
  const matches = mediaBlocks().filter((candidate) => candidate.query === query);
  assert.ok(matches.length, `缺少媒体查询 ${query}`);
  return matches.at(-1);
}

test("事件与商店复用 encounterStageHtml，舞台输出两组完整关联的 tab 与 tabpanel", () => {
  const helper = namedFunctionSource("encounterStageHtml");
  const shop = namedFunctionSource("renderShop");
  const event = namedFunctionSource("renderEvent");
  const encounterStageHtml = new Function(
    "escapeHtml",
    "encounterStageView",
    `${helper}; return encounterStageHtml;`
  )((value) => String(value), "scene");
  const output = encounterStageHtml({
    id: "contract-stage",
    sceneHtml: "<div>场景</div>",
    decisionHtml: "<div>决策</div>",
    decisionLabel: "选择"
  });

  assert.match(shop, /encounterStageHtml\s*\(/, "商店必须复用共享遭遇舞台");
  assert.match(event, /encounterStageHtml\s*\(/, "事件必须复用共享遭遇舞台");
  assert.equal((output.match(/role="tab"/g) || []).length, 2, "共享舞台必须输出“场景/决策”两个 tab");
  assert.equal((output.match(/role="tabpanel"/g) || []).length, 2, "共享舞台必须输出两个 tabpanel");
  assert.equal((output.match(/aria-controls=/g) || []).length, 2, "每个 tab 都必须通过 aria-controls 指向面板");
  assert.equal((output.match(/aria-labelledby=/g) || []).length, 2, "每个 tabpanel 都必须通过 aria-labelledby 指回标签");
  assert.match(output, /class="[^"]*encounter-stage[^"]*"/);
  assert.match(output, /class="[^"]*encounter-stage-track[^"]*"/);
  assert.match(output, /class="[^"]*encounter-stage-panel[^"]*"/);
});

test("手机已选决策面板内有操作控件时不额外占用 Tab 停靠点", () => {
  const helper = namedFunctionSource("setEncounterStageView");

  assert.match(helper, /panel\.inert\s*=\s*mobileStage\s*&&\s*!selected/,
    "未选面板必须继续使用 inert 移出交互树");
  assert.match(helper, /panel\.querySelector\([\s\S]*?button:not\(:disabled\)[\s\S]*?\[tabindex\]:not\(\[tabindex="-1"\]\)[\s\S]*?\)/,
    "应检查已选面板内是否已有可聚焦后代");
  assert.match(helper, /panel\.tabIndex\s*=\s*mobileStage\s*&&\s*selected\s*&&\s*!hasFocusableDescendant\s*\?\s*0\s*:\s*-1/,
    "只有不含可聚焦后代的已选面板才能成为 Tab 停靠点");
  assert.doesNotMatch(helper, /panel\.tabIndex\s*=\s*mobileStage\s*&&\s*selected\s*\?\s*0\s*:\s*-1/,
    "不能让所有已选面板都占用额外 Tab 停靠点");
});

test("桌面舞台包装层不生成布局盒，既有事件与商店双栏视口契约保持不变", () => {
  const firstMedia = styles.indexOf("@media");
  const desktop = firstMedia === -1 ? styles : styles.slice(0, firstMedia);

  for (const selector of [".encounter-stage", ".encounter-stage-track", ".encounter-stage-panel"]) {
    assert.match(cssRuleBodies(desktop, selector), /display:\s*contents/, `${selector} 桌面必须透明参与既有网格`);
  }
  assert.match(cssRuleBodies(desktop, ".encounter-stage-tabs"), /display:\s*none/, "桌面双栏不应出现手机切换标签");

  const sharedPage = `${cssRuleBodies(desktop, ".shop-page")}\n${cssRuleBodies(desktop, ".event-page")}`;
  assert.match(sharedPage, /height:\s*calc\(100dvh\s*-\s*64px\)/, "桌面事件与商店必须继续锁定64px顶栏后的视口");
  assert.match(sharedPage, /overflow:\s*hidden/, "桌面事件与商店不能恢复整页纵向滚动");
  assert.match(cssRuleBodies(desktop, ".shop-page"), /grid-template-columns:\s*minmax\(/, "桌面商店必须继续左右分栏");
  assert.match(cssRuleBodies(desktop, ".event-page"), /grid-template-columns:\s*minmax\(/, "桌面事件必须继续左右分栏");
  assert.match(cssRuleBodies(desktop, ".event-page .event-options"), /grid-template-rows:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
});

test("最终手机覆盖把事件与商店锁进动态视口，并以横向吸附轨道切换两页舞台", () => {
  const mobile = lastExactMediaBlock("(max-width: 700px)").body;
  const pages = `${cssRuleBodies(mobile, ".shop-page")}\n${cssRuleBodies(mobile, ".event-page")}`;
  const stage = cssRuleBodies(mobile, ".encounter-stage");
  const track = cssRuleBodies(mobile, ".encounter-stage-track");
  const panel = cssRuleBodies(mobile, ".encounter-stage-panel");

  assert.match(pages, /height:\s*calc\(100dvh\s*-\s*54px\s*-\s*env\(safe-area-inset-top\)\)/);
  assert.match(pages, /min-height:\s*0/);
  assert.match(pages, /overflow:\s*hidden/);
  assert.doesNotMatch(pages, /height:\s*auto|overflow:\s*visible/, "最终手机规则不能退回整页下翻");
  assert.match(stage, /min-height:\s*0/);
  assert.match(track, /grid-auto-flow:\s*column/);
  assert.match(track, /grid-auto-columns:\s*(?:100%|minmax\(100%,\s*100%\))/);
  assert.match(track, /overflow-x:\s*auto/);
  assert.match(track, /overflow-y:\s*hidden/);
  assert.match(track, /scroll-snap-type:\s*x\s+mandatory/);
  assert.match(panel, /min-height:\s*0/);
  assert.match(panel, /scroll-snap-align:\s*start/);
  assert.match(panel, /overflow:\s*hidden/);
});

test("手机事件决策页固定为单列三行并按行流动，不再误用三行网格做横向自动放置", () => {
  const mobile = lastExactMediaBlock("(max-width: 700px)").body;
  const options = cssRuleBodies(mobile, ".event-page .event-options");

  assert.match(options, /grid-template-columns:\s*(?:1fr|minmax\(0,\s*1fr\))/);
  assert.match(options, /grid-template-rows:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(options, /grid-auto-flow:\s*row/);
  assert.match(options, /overflow:\s*hidden/);
  assert.doesNotMatch(options, /overflow-y:\s*(?:auto|scroll)/, "事件决策页不能要求上下滚动");
});

test("手机商店市场使用两列四行，三类货架内容只横向滚动", () => {
  const mobile = lastExactMediaBlock("(max-width: 700px)").body;
  const market = cssRuleBodies(mobile, ".shop-page .shop-market-layout");

  assert.match(market, /display:\s*grid/);
  assert.match(market, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(market, /grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)\s+auto\s+auto/);
  assert.match(market, /min-height:\s*0/);
  assert.match(market, /overflow:\s*hidden/);

  for (const selector of [
    ".shop-page .shop-grid",
    ".shop-page .item-choice-list",
    ".shop-page .supply-choice-list"
  ]) {
    const shelf = cssRuleBodies(mobile, selector);
    assert.match(shelf, /grid-auto-flow:\s*column/, `${selector} 必须横向排列商品`);
    assert.match(shelf, /overflow-x:\s*auto/, `${selector} 必须允许横向浏览商品`);
    assert.match(shelf, /overflow-y:\s*hidden/, `${selector} 不能引入局部纵向滚动`);
  }
});

test("离店操作仍位于市场第四行且不会被固定视口裁掉", () => {
  const shop = namedFunctionSource("renderShop");
  const marketStart = shop.indexOf('class="shop-market-layout"');
  const footerStart = shop.indexOf('class="shop-footer-row"');
  const leaveStart = shop.indexOf('data-action="leave-shop"');
  assert.ok(marketStart !== -1 && marketStart < footerStart && footerStart < leaveStart, "离店footer必须继续位于市场DOM内部");

  const mobile = lastExactMediaBlock("(max-width: 700px)").body;
  const footer = cssRuleBodies(mobile, ".shop-market-layout > .shop-footer-row");
  assert.match(footer, /grid-column:\s*1\s*\/\s*-1/);
  assert.match(footer, /grid-row:\s*4/);
  assert.doesNotMatch(footer, /display:\s*none|visibility:\s*hidden/);
  assert.doesNotMatch(mobile, /\.shop-footer-row[^{}]*\{[^}]*display:\s*none/, "手机市场不能隐藏离店footer");
});

test("短屏商店固定卡面高度，为44px购买按钮预留完整触控空间", () => {
  const shortMobile = lastExactMediaBlock("(max-width: 700px) and (max-height: 720px)").body;
  const card = cssRuleBodies(shortMobile, ".shop-page .shop-stock .game-card");
  const buyButton = cssRuleBodies(shortMobile, ".shop-page .shop-stock > button");

  assert.match(card, /flex:\s*0\s+0\s+140px/);
  assert.match(card, /height:\s*140px/);
  assert.match(card, /max-height:\s*140px/);
  assert.match(card, /overflow:\s*hidden/);
  assert.match(buyButton, /min-height:\s*44px/);
});

test("事件确认页在手机动态视口中完整展示代价与双操作按钮", () => {
  const renderer = namedFunctionSource("renderEventConfirm");
  const confirmPageClasses = renderer.match(/className:\s*"event-confirm-page"/g) || [];
  assert.equal(confirmPageClasses.length, 2, "正常与失效确认分支必须共用独立手机布局");

  const mobile = lastExactMediaBlock("(max-width: 700px)").body;
  const bodyLock = cssRuleBodies(mobile, "body:has(.event-confirm-page)");
  const page = cssRuleBodies(mobile, ".event-confirm-page");
  const heading = cssRuleBodies(mobile, ".event-confirm-page .page-heading");
  const card = cssRuleBodies(mobile, ".event-confirm-page .event-confirm-card");
  const preview = cssRuleBodies(mobile, ".event-confirm-page .tarot-preview-grid");
  const singlePreview = cssRuleBodies(mobile, ".event-confirm-page .tarot-preview-grid article:only-child");
  const warning = cssRuleBodies(mobile, ".event-confirm-page > .warning-box");
  const actions = cssRuleBodies(mobile, ".event-confirm-page .confirm-actions");
  const buttons = cssRuleBodies(mobile, ".event-confirm-page .confirm-actions button");
  const unavailableBack = cssRuleBodies(mobile, ".event-confirm-page > .centered");

  assert.match(bodyLock, /overflow:\s*hidden/);
  assert.match(page, /height:\s*calc\(100dvh\s*-\s*54px\s*-\s*env\(safe-area-inset-top\)\)/);
  assert.match(page, /min-height:\s*0/);
  assert.match(page, /overflow:\s*hidden/);
  assert.doesNotMatch(page, /height:\s*auto|overflow:\s*visible/);
  assert.match(heading, /margin:\s*0/);
  assert.match(card, /margin:\s*0/);
  assert.match(preview, /repeat\(auto-fit,\s*minmax\(130px,\s*1fr\)\)/);
  assert.match(preview, /margin:\s*0/);
  assert.doesNotMatch(preview, /display:\s*none|max-height:\s*0/, "真实前后值不能为省空间而隐藏");
  assert.match(singlePreview, /grid-column:\s*1\s*\/\s*-1/, "单项变化必须占满一行，不能只留在半栏");
  assert.match(warning, /margin:\s*0/);
  assert.doesNotMatch(warning, /display:\s*none|max-height:\s*0|line-clamp/, "完整结果说明必须始终可见");
  assert.match(actions, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(buttons, /min-height:\s*44px/);
  assert.match(unavailableBack, /min-height:\s*44px/);

  const shortMobile = lastExactMediaBlock("(max-width: 700px) and (max-height: 720px)").body;
  const shortPreview = cssRuleBodies(shortMobile, ".event-confirm-page .tarot-preview-grid");
  const shortWarning = cssRuleBodies(shortMobile, ".event-confirm-page > .warning-box");
  const shortButtons = cssRuleBodies(shortMobile, ".event-confirm-page .confirm-actions button");
  assert.doesNotMatch(shortPreview, /display:\s*none|max-height:\s*0/);
  assert.doesNotMatch(shortWarning, /display:\s*none|max-height:\s*0|line-clamp/);
  assert.match(shortButtons, /min-height:\s*44px/);
});

test("跨屏确认取消或完成后统一返回事件选择与商店货架，而不是重置到场景", () => {
  const helper = namedFunctionSource("returnToEncounterDecision");
  const changeScreen = namedFunctionSource("changeScreen");
  const resumeItemReward = namedFunctionSource("resumeItemRewardSource");
  const completeItemReward = namedFunctionSource("completeItemRewardSource");
  const clickHandler = sourceBetween(
    'app.addEventListener("click",',
    "function restoreDismissedIntentDetails("
  );
  const cancelEventStart = clickHandler.indexOf('action === "cancel-event-choice"');
  const confirmEventStart = clickHandler.indexOf('action === "confirm-event-choice"', cancelEventStart);
  const shopRemoveStart = clickHandler.indexOf('action === "shop-remove"');
  const leaveShopStart = clickHandler.indexOf('action === "leave-shop"', shopRemoveStart);
  assert.notEqual(cancelEventStart, -1, "缺少事件确认取消入口");
  assert.notEqual(confirmEventStart, -1, "无法确定事件确认取消入口边界");
  assert.notEqual(shopRemoveStart, -1, "缺少商店删牌入口");
  assert.notEqual(leaveShopStart, -1, "无法确定商店删牌入口边界");
  const cancelEvent = clickHandler.slice(cancelEventStart, confirmEventStart);
  const shopRemove = clickHandler.slice(shopRemoveStart, leaveShopStart);

  assert.match(
    helper,
    /changeScreen\(\s*next\s*,\s*nextContext\s*,\s*\{\s*encounterView:\s*"decision"\s*\}\s*\)/,
    "统一返回 helper 必须通过显式导航选项请求决策页，不能先赋值后又被 changeScreen 重置"
  );
  assert.match(
    changeScreen,
    /options\.encounterView\s*===\s*"decision"[\s\S]*?encounterStageView\s*=\s*"decision"/,
    "changeScreen 必须读取显式的 encounterStageView 决策页导航选项"
  );
  assert.match(
    cancelEvent,
    /returnToEncounterDecision\(\s*"event"\s*,\s*\{\s*eventId:\s*context\.eventId\s*\}\s*\)/,
    "取消事件确认后必须回到原事件的选择页"
  );
  assert.match(
    shopRemove,
    /onCancel\(\)\s*\{\s*returnToEncounterDecision\(\s*"shop"\s*\)/,
    "取消商店删牌后必须回到货架页"
  );
  assert.match(
    resumeItemReward,
    /source\s*===\s*"shop"[\s\S]*?returnToEncounterDecision\(\s*"shop"\s*\)/,
    "取消 shop 来源物品替换后必须通过统一 helper 回到货架页"
  );
  assert.match(
    completeItemReward,
    /source\s*===\s*"shop"[\s\S]*?returnToEncounterDecision\(\s*"shop"\s*\)/,
    "完成 shop 来源物品替换后必须通过统一 helper 回到货架页"
  );
});
