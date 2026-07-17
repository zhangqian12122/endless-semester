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

function exactMediaBlock(query) {
  const block = mediaBlocks().find((candidate) => candidate.query === query);
  assert.ok(block, `缺少媒体查询 ${query}`);
  return block;
}

function cssRuleBody(source, selector) {
  const bodies = [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, prelude]) => prelude.split(",").some((part) => part.trim() === selector))
    .map(([, , body]) => body);
  assert.ok(bodies.length, `缺少 CSS 规则 ${selector}`);
  return bodies.join("\n");
}

function pixelProperty(body, property) {
  const match = body.match(new RegExp(`(?:^|;)\\s*${property.replace("-", "\\-")}\\s*:\\s*(?:calc\\()?\\s*(\\d+(?:\\.\\d+)?)px`, "m"));
  assert.ok(match, `缺少像素属性 ${property}`);
  return Number(match[1]);
}

test("手机非战斗顶栏只直出品牌、生命与校园币，其余入口归入可访问的更多菜单", () => {
  const source = namedFunctionSource("topBar");
  const menuStart = source.indexOf('id="mobile-topbar-menu"');
  const toggleStart = source.indexOf('data-action="toggle-mobile-topbar"');

  assert.notEqual(toggleStart, -1, "缺少手机顶栏“更多”按钮");
  assert.notEqual(menuStart, -1, "缺少手机顶栏菜单容器");
  assert.ok(toggleStart < menuStart, "更多按钮应位于受控菜单之前");
  assert.match(source, /class="[^"]*mobile-topbar-toggle[^"]*"[^>]*aria-expanded="\$\{[^}]*mobileTopbarOpen[^}]*\}"[^>]*aria-controls="mobile-topbar-menu"/);
  assert.match(source, /id="mobile-topbar-menu"[^>]*class="[^"]*mobile-topbar-menu[^"]*"|class="[^"]*mobile-topbar-menu[^"]*"[^>]*id="mobile-topbar-menu"/);

  for (const token of ['class="brand"', "health-resource", "campus-coin-resource"]) {
    const index = source.indexOf(token);
    assert.ok(index !== -1 && index < menuStart, `${token} 必须留在菜单外，保证手机首屏可见`);
  }

  for (const token of [
    "deck-resource",
    "items-resource",
    "pet-resource",
    "sign-resource",
    "tarot-resource",
    'data-action="open-rules"',
    'data-action="open-stats"',
    'data-action="open-deck"',
    'data-action="open-items"'
  ]) {
    assert.ok(source.indexOf(token) > menuStart, `${token} 必须进入手机更多菜单`);
  }
});

test("≤700px 非战斗顶栏固定为单行 50–56px，更多按钮满足 44px 触控尺寸且菜单脱离文档流", () => {
  const mobile = exactMediaBlock("(max-width: 700px)");
  const topbar = cssRuleBody(mobile.body, ".topbar");
  const toggle = cssRuleBody(mobile.body, ".mobile-topbar-toggle");
  const menu = cssRuleBody(mobile.body, ".mobile-topbar-menu");
  const height = pixelProperty(topbar, "height");
  const minHeight = pixelProperty(topbar, "min-height");

  assert.match(topbar, /flex-wrap:\s*nowrap/, "手机非战斗顶栏不能再通过换行堆高");
  assert.ok(height >= 50 && height <= 56, `手机顶栏高度必须在 50–56px，当前为 ${height}px`);
  assert.ok(minHeight >= 50 && minHeight <= 56, `手机顶栏最小高度必须在 50–56px，当前为 ${minHeight}px`);
  assert.match(toggle, /display:\s*(?:flex|grid|inline-flex|inline-grid)/, "手机断点必须显示更多按钮");
  assert.ok(pixelProperty(toggle, "min-width") >= 44, "更多按钮宽度必须至少 44px");
  assert.ok(pixelProperty(toggle, "min-height") >= 44, "更多按钮高度必须至少 44px");
  assert.match(menu, /position:\s*(?:absolute|fixed)/, "更多菜单必须脱离文档流，不能再次撑高顶栏");
});

test("更多菜单支持点击切换，并能用 Escape 关闭后把焦点还给触发按钮", () => {
  const clickHandler = sourceBetween('app.addEventListener("click"', 'document.addEventListener("keydown"');
  const keyHandler = sourceBetween('document.addEventListener("keydown"', "\nrender();");

  assert.match(
    clickHandler,
    /action === "toggle-mobile-topbar"[\s\S]{0,500}(?:mobileTopbarOpen\s*=\s*!mobileTopbarOpen|setMobileTopbarOpen\(\s*!mobileTopbarOpen)/,
    "点击更多按钮必须真实切换菜单状态"
  );

  const escapeIndex = keyHandler.search(/mobileTopbarOpen[\s\S]{0,160}event\.key\s*===\s*"Escape"|event\.key\s*===\s*"Escape"[\s\S]{0,160}mobileTopbarOpen/);
  const combatGateIndex = keyHandler.indexOf('screen !== "combat"');
  assert.notEqual(escapeIndex, -1, "全局键盘处理必须在菜单打开时响应 Escape");
  assert.ok(combatGateIndex === -1 || escapeIndex < combatGateIndex, "Escape 关闭菜单必须发生在战斗快捷键的提前返回之前");
  assert.match(keyHandler.slice(escapeIndex), /event\.preventDefault\(\)/, "Escape 关闭菜单必须阻止默认行为");
  assert.match(keyHandler.slice(escapeIndex), /(?:mobileTopbarOpen\s*=\s*false|setMobileTopbarOpen\(\s*false)/, "Escape 必须关闭菜单状态");
  assert.match(
    keyHandler.slice(escapeIndex),
    /querySelector\([^)]*toggle-mobile-topbar[^)]*\)[\s\S]{0,260}\.focus\(\)|mobileTopbarToggle[\s\S]{0,260}\.focus\(\)/,
    "Escape 关闭后必须把焦点恢复到更多按钮"
  );
});

test("手机菜单改造不覆盖桌面 64px 与既有战斗顶栏规则", () => {
  const firstMedia = styles.indexOf("@media");
  const desktop = firstMedia === -1 ? styles : styles.slice(0, firstMedia);
  const mobile = exactMediaBlock("(max-width: 700px)");
  const mobileCombat = exactMediaBlock("(max-width: 700px) and (max-height: 900px)");
  const tablet = exactMediaBlock("(min-width: 701px) and (max-width: 980px)");

  assert.equal(pixelProperty(cssRuleBody(desktop, ".topbar"), "min-height"), 64, "桌面顶栏必须继续保持 64px");
  assert.match(cssRuleBody(desktop, ".mobile-topbar-toggle"), /display:\s*none/, "桌面不应出现手机更多按钮");
  assert.match(cssRuleBody(desktop, ".mobile-topbar-menu"), /display:\s*contents/, "桌面菜单容器应保持原顶栏项目排布");
  assert.ok(mobile.start < mobileCombat.start, "战斗手机规则必须位于通用手机顶栏规则之后并覆盖它");
  assert.match(mobileCombat.body, /body:has\(\.combat-page\) \.topbar\s*\{[^}]*flex-wrap:\s*nowrap;[^}]*height:\s*calc\(50px \+ env\(safe-area-inset-top\)\)/);
  assert.match(mobileCombat.body, /body:has\(\.combat-page\) \.topbar > :not\(\.brand\):not\(\.health-resource\)\s*\{[^}]*display:\s*none/);
  assert.match(tablet.body, /body:has\(\.combat-page\) \.topbar\s*\{[^}]*flex-wrap:\s*nowrap;[^}]*height:\s*64px/);
  assert.match(
    tablet.body,
    /body:has\(\.combat-page\) \.mobile-topbar-menu[\s\S]{0,180}display:\s*none|body:has\(\.combat-page\) \.topbar > \.mobile-topbar-menu[\s\S]{0,180}display:\s*none/,
    "平板战斗必须继续隐藏移动菜单中的次要资源和导航"
  );
});
