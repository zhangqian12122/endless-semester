import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");

function namedFunctionSource(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `缺少 ${name}`);
  const next = appSource.indexOf("\nfunction ", start + 1);
  return appSource.slice(start, next === -1 ? appSource.length : next);
}

test("精英刻印页面读取进入阶段时冻结的全部合格牌，无候选时走原子跳过", () => {
  const source = namedFunctionSource("showEnchantmentReward");
  assert.match(source, /const cards = game\.eligiblePendingEliteEnchantCards\(\)/);
  assert.doesNotMatch(source, /pending\.usedCardUids|game\.enchantableCards\(/);
  assert.match(source, /game\.resolvePendingEnchantment\(null\)/);
});

test("刻印与跳过按钮校验当前页面和结算锁，并且只调用引擎原子接口", () => {
  assert.match(appSource, /action === "enchant-card"[\s\S]*?screen !== "enchantment"[\s\S]*?rewardContext\.settling === true/);
  assert.match(appSource, /rewardContext\.cards\?\.some\(\(card\) => card\.uid === button\.dataset\.uid\)/);
  assert.match(appSource, /game\.resolvePendingEnchantment\(button\.dataset\.uid\)/);
  assert.match(appSource, /action === "skip-enchantment"[\s\S]*?screen !== "enchantment"[\s\S]*?game\.resolvePendingEnchantment\(null\)/);
});

test("精英物品领取、跳过和满包替换都由精英阶段接口推进", () => {
  const grantSource = namedFunctionSource("grantItem");
  const skipSource = namedFunctionSource("skipItemReward");
  const completionSource = namedFunctionSource("completeItemRewardSource");
  assert.match(grantSource, /pendingCombatReward\?\.type === "eliteChain"[\s\S]*?resolvePendingEliteItem\(id\)/);
  assert.match(skipSource, /pendingCombatReward\?\.type === "eliteChain"[\s\S]*?skipPendingEliteItem\(\)/);
  assert.doesNotMatch(completionSource, /advanceEliteCombatRewardFromItem/);
});
