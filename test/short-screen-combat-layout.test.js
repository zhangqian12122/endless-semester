import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const standardMarker = "@media (max-width: 700px) and (max-height: 900px)";
const compactMarker = "@media (max-width: 700px) and (max-height: 650px)";

function mediaBlock(marker) {
  const start = styles.indexOf(marker);
  assert.notEqual(start, -1, `缺少 ${marker}`);
  const next = styles.indexOf("\n@media ", start + marker.length);
  return styles.slice(start, next === -1 ? styles.length : next);
}

test("短屏战斗断点在标准手机规则之后覆盖固定高度", () => {
  const standardStart = styles.indexOf(standardMarker);
  const compactStart = styles.indexOf(compactMarker);

  assert.notEqual(standardStart, -1);
  assert.ok(compactStart > standardStart, "短屏覆盖必须位于标准手机规则之后");
  const compact = mediaBlock(compactMarker);
  assert.match(compact, /\.combat-page \.combat-board \{[\s\S]*?height: 240px;[\s\S]*?min-height: 230px;/);
  assert.match(compact, /\.combat-page \.combat-action-dock \{[^}]*flex: 0 0 260px;[^}]*min-height: 260px;/);
  assert.match(compact, /\.combat-page \.hand \{[\s\S]*?height: 202px;[\s\S]*?min-height: 202px;/);
  assert.match(compact, /\.combat-page \.hand \.game-card \{[\s\S]*?height: 184px;[\s\S]*?min-height: 184px;/);
});

test("短屏压缩角色与卡片内容但不缩小战斗触控按钮", () => {
  const compact = mediaBlock(compactMarker);

  assert.match(compact, /\.combat-page \.student-avatar,[\s\S]*?width: 96px; height: 120px;/);
  assert.match(compact, /\.combat-page \.hand \.card-art \{ height: 64px;/);
  assert.match(compact, /\.combat-page \.hand \.card-text \{[^}]*min-height: 32px;[^}]*font-size: 8px;/);
  assert.doesNotMatch(compact, /\.pile-button\s*\{[^}]*?(?:width|height):\s*(?:[0-3]\d|4[0-7])px/);
  assert.doesNotMatch(compact, /\.end-turn\s*\{[^}]*?(?:width|height|min-height):\s*(?:[0-3]\d|4[0-7])px/);
});

test("信息更密集的极短屏战斗保留局部纵向兜底", () => {
  const compact = mediaBlock(compactMarker);

  assert.match(compact, /\.combat-page:has\(\.challenge-contract\),[\s\S]*?\.combat-page:has\(\.combat-relic-row\.has-items\) \{[\s\S]*?overflow-y: auto;/);
  assert.match(compact, /overscroll-behavior-y: contain;/);
  assert.match(compact, /scrollbar-width: thin;/);
});
