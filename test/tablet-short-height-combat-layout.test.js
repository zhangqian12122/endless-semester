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

function shortTabletBlock() {
  const query = "(min-width: 701px) and (max-width: 980px) and (min-height: 620px) and (max-height: 680px)";
  const block = mediaBlocks().find((candidate) => candidate.query === query);
  assert.ok(block, `缺少短屏平板媒体查询：${query}`);
  return block.body;
}

function narrowTabletBlock() {
  const query = "(min-width: 701px) and (max-width: 980px) and (min-height: 620px)";
  const block = mediaBlocks().find((candidate) => candidate.query === query);
  assert.ok(block, `缺少窄屏平板媒体查询：${query}`);
  return block.body;
}

function fixedDockBlock() {
  const block = mediaBlocks().find((candidate) => candidate.query.includes(",")
    && candidate.query.includes("min-width: 701px")
    && candidate.query.includes("min-height: 680px")
    && candidate.query.includes("max-width: 980px")
    && candidate.query.includes("min-height: 620px")
    && candidate.query.includes("max-height: 680px"));
  assert.ok(block, "固定战斗坞媒体查询必须用逗号同时覆盖常规宽屏与 701–980×620–680 短屏");
  return block.body;
}

function challengeCompressionBlock() {
  const block = mediaBlocks().find((candidate) => candidate.query.includes("min-width: 701px")
    && candidate.query.includes("max-height: 933px"));
  assert.ok(block, "挑战密集态压缩必须延长到 933px 高度");
  return block.body;
}

test("701–980×620–680 纳入固定坞，并把滚动限制在战斗页内部", () => {
  const fixedDock = fixedDockBlock();
  const shortTablet = shortTabletBlock();

  assert.match(fixedDock, /\.combat-page\s*\{[^}]*height:\s*calc\(100vh - 64px\);[^}]*overflow:\s*hidden;/);
  assert.match(fixedDock, /\.combat-action-dock\s*\{[^}]*position:\s*fixed;[^}]*bottom:\s*0;/);
  assert.match(shortTablet, /body:has\(\.combat-page\)\s*\{[^}]*overflow:\s*hidden;/);
  assert.match(shortTablet, /\.combat-page\s*\{[^}]*height:\s*calc\(100dvh - 64px\);[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior-y:\s*contain;/);
  assert.match(fixedDock, /\.combat-action-dock\s*\{[^}]*height:\s*294px;/);
});

test("短屏平板固定坞完整保留卡面与战斗控件", () => {
  const fixedDock = fixedDockBlock();
  const shortTablet = shortTabletBlock();

  assert.match(fixedDock, /\.combat-action-dock \.hand\s*\{[^}]*height:\s*236px;[^}]*min-height:\s*236px;/);
  assert.match(fixedDock, /\.combat-action-dock \.hand \.game-card\s*\{[^}]*height:\s*212px;[^}]*min-height:\s*212px;/);
  assert.match(styles, /\.combat-controls\s*\{[^}]*display:\s*flex;/);
  assert.match(styles, /\.pile-button\s*\{[^}]*min-width:\s*62px;[^}]*height:\s*78px;/);
  assert.match(styles, /\.end-turn\s*\{[^}]*min-width:\s*132px;/);
  assert.doesNotMatch(shortTablet, /(?:\.combat-controls|\.energy-companion-stack|\.pile-counts|\.pile-button|\.end-turn)[^\{]*\{[^}]*display:\s*none;/);
});

test("挑战与试炼在 933px 以下并排压缩，随身物品密集态仍可局部查看", () => {
  const shortTablet = shortTabletBlock();
  const challenge = challengeCompressionBlock();

  assert.match(challenge, /\.combat-page:has\(\.challenge-contract\) \.challenge-contract,[\s\S]*?\.challenge-trial-progress\s*\{[^}]*position:\s*absolute;[^}]*height:\s*34px;/);
  assert.match(challenge, /\.combat-page:has\(\.challenge-contract\) \.challenge-contract\s*\{[^}]*right:\s*calc\(50% \+ 4px\);[^}]*left:/);
  assert.match(challenge, /\.combat-page:has\(\.challenge-contract\) \.challenge-trial-progress\s*\{[^}]*right:[^}]*left:\s*calc\(50% \+ 4px\);/);
  assert.match(challenge, /\.combat-page:has\(\.challenge-contract\) \.combat-relic-row\s*\{[^}]*margin-top:\s*40px;/);
  assert.match(shortTablet, /\.combat-page\s*\{[^}]*overflow-y:\s*auto;/, "挑战、试炼与物品同时出现时只能滚动战斗页，不能裁掉内容");
  assert.match(challenge, /\.combat-page:has\(\.challenge-contract\) \.enemy-intent-token,[\s\S]*?top:\s*-34px;/);
});

test("短屏平板九张手牌使用局部横滚，末张卡不继承负边距", () => {
  const shortTablet = shortTabletBlock();
  const narrowTablet = narrowTabletBlock();
  const nineCards = narrowTablet.match(/\.hand:has\(\.game-card:nth-child\(9\)\) \.game-card\s*\{([^}]*)\}/);

  assert.ok(nineCards, "缺少九张手牌专属压缩规则");
  assert.match(nineCards[1], /(?:flex-basis|width):\s*\d+px;/);
  assert.match(nineCards[1], /margin-right:\s*-\d+px;/);
  assert.match(narrowTablet, /\.hand:has\(\.game-card:nth-child\(9\)\) \.game-card:last-child\s*\{[^}]*margin-right:\s*0;/);
  assert.match(shortTablet, /\.combat-action-dock \.hand\s*\{[^}]*overflow-x:\s*auto;[^}]*overscroll-behavior-x:\s*contain;/);
});
