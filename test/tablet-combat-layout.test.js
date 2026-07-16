import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

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
      body: styles.slice(start, end + 1)
    };
  });
}

function mediaBlock(...conditions) {
  const block = mediaBlocks().find((candidate) => conditions.every((condition) => candidate.query.includes(condition)));
  assert.ok(block, `缺少同时包含 ${conditions.join("、")} 的媒体查询`);
  return block.body;
}

function exactMediaBlock(query) {
  const block = mediaBlocks().find((candidate) => candidate.query === query);
  assert.ok(block, `缺少媒体查询 ${query}`);
  return block.body;
}

test("701px 起平板与桌面战斗启用固定首屏与底部手牌坞", () => {
  const tablet = mediaBlock("min-width: 701px", "min-height: 680px");

  assert.match(tablet, /\.combat-page\s*\{[^}]*height:\s*calc\([^;]*(?:100dvh|100vh)[^;]*\);[^}]*overflow:\s*hidden;/);
  assert.match(tablet, /(?:\.combat-page\s+)?\.combat-action-dock\s*\{[^}]*position:\s*fixed;[^}]*bottom:\s*0;[^}]*(?:height|min-height):\s*\d+px;/);
  assert.match(tablet, /\.combat-action-dock \.hand\s*\{[^}]*(?:height|min-height):\s*\d+px;/);
});

test("701–980px 窄屏战斗顶栏保持单行并主动收敛次要入口", () => {
  const tablet = exactMediaBlock("(min-width: 701px) and (max-width: 980px)");

  assert.match(tablet, /\.topbar\s*\{[^}]*flex-wrap:\s*wrap;/, "非战斗页应通过换行保留全部顶栏入口");
  assert.match(tablet, /body:has\(\.combat-page\) \.topbar\s*\{[^}]*flex-wrap:\s*nowrap;[^}]*height:\s*64px;/);
  assert.match(tablet, /body:has\(\.combat-page\) \.topbar > \.resource:not\(\.health-resource\)\s*\{[^}]*display:\s*none;/);
  assert.match(tablet, /body:has\(\.combat-page\) \.topbar > \.quiet-button:not\(\[data-action="open-rules"\]\):not\(\[data-action="open-deck"\]\)\s*\{[^}]*display:\s*none;/);
  assert.doesNotMatch(tablet, /body:has\(\.combat-page\)\s*\{[^}]*overflow:\s*hidden;/, "短屏平板必须保留页面滚动兜底");
});

test("平板底部手牌坞为八张手牌保留独立压缩兜底", () => {
  const tablet = mediaBlock("min-width: 701px", "max-width: 980px", "min-height: 620px");
  const eightCards = tablet.match(/\.hand:has\(\.game-card:nth-child\(8\)\) \.game-card\s*\{([^}]*)\}/);

  assert.ok(eightCards, "缺少平板八手牌兜底选择器");
  assert.match(eightCards[1], /(?:flex-basis|width):\s*\d+px;/);
  assert.match(eightCards[1], /margin-right:\s*-\d+px;/);
});

test("701px 平板断点衔接 700px 手机规则并继续覆盖桌面", () => {
  const mobile = mediaBlock("max-width: 700px", "max-height: 900px");
  const desktop = mediaBlock("min-width: 701px", "min-height: 680px");

  assert.match(mobile, /\.combat-page\s*\{[^}]*height:\s*calc\(100dvh - 50px - env\(safe-area-inset-top\)\);[^}]*overflow:\s*hidden;/);
  assert.match(mobile, /\.combat-page \.hand\s*\{[^}]*overflow-x:\s*auto;/);
  assert.match(desktop, /\.combat-action-dock\s*\{[^}]*position:\s*fixed;[^}]*bottom:\s*0;[^}]*height:\s*294px;/);
  assert.match(desktop, /\.combat-action-dock \.hand\s*\{[^}]*height:\s*236px;[^}]*min-height:\s*236px;/);
});
