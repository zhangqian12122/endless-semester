import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");

test("挑战招牌物品从同一来源预览贯穿地图、战斗契约与战后路线", () => {
  assert.match(appSource, /function challengeRewardSourcePreview\(enemyId, pending = null\)/);
  assert.match(appSource, /const frozen = pending\?\.type === "challengeChain" && pending\.enemyId === canonicalEnemyId/);
  assert.match(appSource, /challengeRewardSourceHintHtml\(node\.enemy\)/);
  assert.match(appSource, /challengeRewardSourceHintText\(combat\.enemy\.id\)/);
  assert.match(appSource, /challengeRewardSourcePreview\(pending\?\.enemyId, pending\)/);
  assert.match(appSource, /确定掉落 · 招牌物品/);
  assert.match(appSource, /只占本次物品路线，不增加奖励份数/);
});

test("遗物展示移除方框底并用边缘渐隐保持小尺寸可读性", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.combat-relic > span \{[^}]*border: 0;[^}]*background: transparent;[^}]*box-shadow: none/);
  assert.match(styles, /\.combat-relic-icon img \{[^}]*mix-blend-mode: screen;[^}]*brightness\(1\.2\)[^}]*mask-image: radial-gradient/);
  assert.match(styles, /\.item-icon \{[^}]*border: 0;[^}]*background: transparent/);
  assert.match(styles, /\.challenge-reward-option > span\.signature-reward-icon \{ background: transparent; box-shadow: none; \}/);
});
