import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { ENEMY_DEFS } from "../game-data.js";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

test("八名正式敌人都有与真实机制对应的应对建议", () => {
  const expectedSignals = {
    sleepyBug: /蜷起回合不会攻击.*按头顶公开伤害准备护甲/,
    homeworkBlob: /状态牌/,
    alarmClock: /蓄响回合不会攻击.*下回合会清零的护甲/,
    phoneSpirit: /走神只让攻击牌每段 -2.*伤害技能与宠物不受影响/,
    groupChat: /手牌、抽牌堆和弃牌堆.*清到 2 张以下.*自然消耗来不及/,
    printerJam: /6 点.*5 点.*打穿/,
    rivalShadow: new RegExp(`${ENEMY_DEFS.rivalShadow.interruptThreshold} 点实际伤害`),
    finalExam: new RegExp(`新获得的 ${ENEMY_DEFS.finalExam.blankArmor} 点护甲.*大题伤害 -${ENEMY_DEFS.finalExam.blankBreakAttackReduction}`)
  };

  assert.deepEqual(Object.keys(ENEMY_DEFS).sort(), Object.keys(expectedSignals).sort());
  for (const [enemyId, signal] of Object.entries(expectedSignals)) {
    const tip = ENEMY_DEFS[enemyId].tip;
    assert.equal(typeof tip, "string", `${enemyId} 应提供文字建议`);
    assert.match(tip, signal, `${enemyId} 的建议应写出关键应对条件`);
  }
});

test("应对建议只在玩家可操作的当前意图详情中按需显示", () => {
  assert.match(
    appSource,
    /!resolution && enemyDefinition\?\.tip \? `<span class="intent-counter-tip"><b>应对建议<\/b><span>\$\{escapeHtml\(enemyDefinition\.tip\)\}<\/span><\/span>` : ""/
  );
  assert.match(styles, /\.intent-counter-tip \{[^}]*grid-template-columns: auto minmax\(0, 1fr\)[^}]*border-left: 2px solid #75a98a/);
  assert.match(styles, /\.intent-counter-tip b \{[^}]*white-space: nowrap/);
  assert.match(styles, /\.enemy-intent-detail \{[^}]*top: 8px;/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.combat-board:has\(\.enemy-intent-token:not\(\.is-dismissed\):is\(:hover, :focus-visible, \.is-pinned\)\) \{[^}]*z-index: 40;[^}]*overflow: visible;/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.player-fighter, \.enemy-fighter \{[^}]*translate: none;/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.enemy-intent-detail \{[^}]*position: fixed;[^}]*max-height: calc\(100dvh - 20px - env\(safe-area-inset-bottom\)\);[^}]*overflow-y: auto;/);
  const combatLayer = Number(styles.match(/\.combat-board:has\([^}]+\) \{[^}]*z-index: (\d+)/)?.[1]);
  const modalLayers = ["result-overlay", "pile-overlay", "tutorial-overlay"].map((className) =>
    Number(styles.match(new RegExp(`\\.${className} \\{[^}]*z-index: (\\d+)`))?.[1])
  );
  assert.ok(combatLayer > 30, "展开说明的战场应高于移动端顶栏");
  assert.ok(modalLayers.every((layer) => layer > combatLayer), "牌堆、结果与教学模态层必须压住战场说明");
  assert.match(readme, /应对建议只在当前行动可操作时出现，结算阶段不会误导玩家/);
});
