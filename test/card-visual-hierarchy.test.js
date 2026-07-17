import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `缺少样式规则：${selector}`);
  return match[1];
}

test("卡面同时公开类型、稀有度与费用数据，不依赖颜色猜测", () => {
  assert.match(appSource, /attack:\s*"攻击"/);
  assert.match(appSource, /skill:\s*"技能"/);
  assert.match(appSource, /power:\s*"能力"/);
  assert.match(appSource, /ability:\s*"能力"/);
  assert.match(appSource, /status:\s*"状态"/);
  assert.match(appSource, /class="card-cost" data-cost="\$\{cost\}" aria-label="费用 \$\{cost\}"/);
  assert.match(appSource, /<small class="card-rarity-label">\$\{rarityLabel\}<\/small>/);
});

test("攻击、技能、能力与状态牌拥有各自克制的框体和铭牌色", () => {
  for (const selector of [
    ".game-card.type-attack",
    ".game-card.type-skill",
    ".game-card.type-status"
  ]) {
    const body = rule(selector);
    assert.match(body, /--card-frame:/);
    assert.match(body, /--card-title-line:/);
    assert.match(body, /--card-plaque-top:/);
    assert.match(body, /--card-cost-ring:/);
  }

  const ability = rule(".game-card.type-ability");
  assert.match(ability, /--card-frame:/);
  assert.match(styles, /\.game-card\.type-power,\s*\n\.game-card\.type-ability\s*\{/);

  const plaque = rule(".card-type-banner b");
  assert.match(plaque, /display:\s*inline-flex/);
  assert.match(plaque, /var\(--card-plaque-top\)/);
  assert.match(plaque, /var\(--card-plaque-bottom\)/);
});

test("普通、罕见与稀有通过内框、文字和克制光晕形成递进", () => {
  const common = rule(".game-card.rarity-common");
  const uncommon = rule(".game-card.rarity-uncommon");
  const rare = rule(".game-card.rarity-rare");

  for (const body of [common, uncommon, rare]) {
    assert.match(body, /--rarity-line:/);
    assert.match(body, /--rarity-ink:/);
    assert.match(body, /--rarity-corner-opacity:/);
  }
  assert.doesNotMatch(common, /--rarity-shadow:\s*rgba/);
  assert.match(uncommon, /--rarity-shadow:\s*rgba/);
  assert.match(rare, /--rarity-shadow:\s*rgba/);
  assert.match(rule(".card-rarity-label"), /border-left:\s*1px solid var\(--rarity-line\)/);
});

test("费用徽章强化层级但不改变现有卡片与720p手牌尺寸", () => {
  const cost = rule(".card-cost");
  assert.match(cost, /width:\s*38px/);
  assert.match(cost, /height:\s*38px/);
  assert.match(cost, /border:\s*2px solid var\(--card-cost-ring\)/);
  assert.match(cost, /var\(--card-cost-halo\)/);
  assert.match(rule('.card-cost[data-cost="0"]'), /border-color:/);

  assert.match(rule(".game-card"), /min-height:\s*258px/);
  assert.match(rule(".hand .game-card"), /height:\s*280px/);
  assert.match(styles, /\.combat-action-dock \.hand \.game-card\s*\{[^}]*height:\s*212px;[^}]*min-height:\s*212px;/);
});
