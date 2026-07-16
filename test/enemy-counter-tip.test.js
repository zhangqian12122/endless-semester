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

test("动态应对建议只在玩家可操作的当前意图详情中显示", () => {
  assert.match(appSource, /enemyIntentCounterplayCue\(combat\.enemy\.id, intent, \{/);
  assert.match(appSource, /risk: turnRisk/);
  assert.match(appSource, /distracted: combat\.distracted/);
  assert.match(appSource, /enemy: combat\.enemy/);
  assert.match(appSource, /const handModels = combat\.hand\.map/);
  assert.match(appSource, /const immediatePlan = combatImmediateCounterplayPlan\(\[/);
  assert.match(appSource, /preview: petActionPreview/);
  assert.match(appSource, /playable: !petUnavailable/);
  assert.match(appSource, /combat\.pendingDiscard\s*\? "请先完成弃牌"/);
  assert.match(appSource, /combat\.energy < petCost\s*\? `还差 \$\{petCost - combat\.energy\} 点能量`/);
  assert.match(appSource, /class="pet-skill \$\{!petUnavailable \? "ready" : ""\}"/);
  assert.match(appSource, /plan: immediatePlan/);
  assert.match(appSource, /const plannedCard = handModels\.find\(\(model\) => model\.card\.uid === immediatePlan\.finish\.action\.key\)/);
  assert.match(appSource, /if \(plannedCard\) plannedCard\.tacticalCue = immediatePlan\.finish\.tacticalCue/);
  assert.match(appSource, /actionsEvaluated: true/);
  assert.match(appSource, /pendingDiscard: Boolean\(combat\.pendingDiscard\)/);
  assert.match(appSource, /handModels\.map\(\(\{ card, index, playable, combatPreview, tacticalCue \}\)/);
  assert.match(
    appSource,
    /!resolution && counterplayCue \? `<span class="intent-counter-tip tone-\$\{escapeHtml\(counterplayCue\.tone\)\}"><b>\$\{escapeHtml\(counterplayCue\.label\)\}<\/b><span>\$\{escapeHtml\(counterplayCue\.detail\)\}<\/span><\/span>` : ""/
  );
  assert.doesNotMatch(appSource, /escapeHtml\(enemyDefinition\.tip\)/);
  assert.match(styles, /\.intent-counter-tip \{[^}]*grid-template-columns: auto minmax\(0, 1fr\)[^}]*border-left: 2px solid var\(--counter-accent\)/);
  assert.match(styles, /\.intent-counter-tip\.tone-danger/);
  assert.match(styles, /\.intent-counter-tip\.tone-counter/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.intent-counter-tip \{[^}]*grid-template-columns: 1fr;[^}]*font-size: 11px;/);
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
  assert.match(readme, /应对建议会按当前行动、真实伤害倍率与机制进度变化/);
});
