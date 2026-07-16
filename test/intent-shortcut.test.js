import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  COMBAT_SHORTCUT_ACTION,
  combatShortcutCommand
} from "../app-flow.js";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const readmeSource = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("R 在可操作战斗中切换敌人意图，并在待弃牌时保留只读入口", () => {
  const expected = { action: COMBAT_SHORTCUT_ACTION.toggleIntentDetails };
  assert.deepEqual(combatShortcutCommand("KeyR"), expected);
  assert.deepEqual(combatShortcutCommand("KeyR", { pendingDiscard: true }), expected);
  assert.deepEqual(combatShortcutCommand("Escape", { intentDetailsOpen: true }), {
    action: COMBAT_SHORTCUT_ACTION.closeIntentDetails
  });
});

test("R 不会穿透敌方结算、教学和模态弹层", () => {
  for (const blockedState of [
    { resolvingEnemy: true },
    { lethalConfirmOpen: true },
    { pileOpen: true },
    { tutorialOpen: true }
  ]) {
    assert.equal(combatShortcutCommand("KeyR", blockedState), null);
  }
});

test("意图按钮、键盘处理和帮助文案共同公开 R 快捷键", () => {
  assert.match(appSource, /data-action="toggle-intent-details"[^>]*aria-keyshortcuts="R"/);
  assert.match(appSource, /<kbd>R<\/kbd> 查看意图/);
  assert.match(appSource, /command\.action === COMBAT_SHORTCUT_ACTION\.toggleIntentDetails[\s\S]*?setIntentDetailsOpen\(token, context\.intentDetailsPinned !== true\)/);
  assert.match(appSource, /点击或按 R 固定说明/);
  assert.match(readmeSource, /`R` 展开或收起敌人意图说明/);
});

test("390×650 短屏仍保留一行敌人行动名", () => {
  const shortScreenBlock = stylesSource.match(/@media \(max-width: 700px\) and \(max-height: 650px\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(shortScreenBlock, /\.combat-page \.enemy-intent-token > small \{[^}]*display: block;/);
  assert.doesNotMatch(shortScreenBlock, /\.enemy-intent-token > small \{[^}]*display: none;/);
});
