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

test("特殊敌人动作 profile 区分卷王冲刺、期末重压与发卷展开", () => {
  const profileSource = namedFunctionSource("enemyBattleMotionProfile");
  const resolveProfile = new Function(`${profileSource}; return enemyBattleMotionProfile;`)();

  assert.equal(resolveProfile({ enemyId: "rivalShadow", playerDamage: 3 }), "rival-rush");
  assert.equal(resolveProfile({ enemyId: "rivalShadow", playerBlockAbsorbed: 6 }), "rival-rush");
  assert.equal(resolveProfile({ enemyId: "finalExam", playerDamage: 8 }), "final-exam-smash");
  assert.equal(resolveProfile({ enemyId: "finalExam", playerBlockAbsorbed: 10 }), "final-exam-smash");
  assert.equal(resolveProfile({ enemyId: "finalExam", intentName: "发卷 · 第1轮" }), "final-exam-deal");
  assert.equal(resolveProfile({ enemyId: "sleepyBug", playerDamage: 5 }), "sleepy-sway");
  assert.equal(resolveProfile({ enemyId: "homeworkBlob", intentName: "堆作业" }), "blob-squash");
  assert.equal(resolveProfile({ enemyId: "unknownEnemy", playerDamage: 5 }), "default-attack");
  assert.equal(resolveProfile({ enemyId: "unknownEnemy" }), "default-skill");
});

test("敌方反馈保留敌人和意图身份并由结束回合显式传入", () => {
  const queueSource = namedFunctionSource("queueBattleFeedback");
  const finishSource = namedFunctionSource("finishPlayerTurn");

  assert.match(queueSource, /kind === "enemy"[\s\S]*?enemyId: String\(options\.enemyId \|\| ""\)[\s\S]*?intentName: String\(options\.intentName \|\| ""\)/);
  assert.match(finishSource, /const enemyId = game\.combat\.enemy\.id;/);
  assert.match(finishSource, /queueBattleFeedback\("enemy"[\s\S]*?enemyId,[\s\S]*?intentName: intent\.name,/);
});

test("特殊动作沿用 windup 和 impact 标签并保留未知敌人回退", () => {
  const motionSource = namedFunctionSource("addEnemyBattleMotion");

  assert.match(motionSource, /profile === "rival-rush"[\s\S]*?x: -52[\s\S]*?duration: \.11[\s\S]*?"windup\+=\.04"[\s\S]*?addLabel\("impact", \.15\)/);
  assert.match(motionSource, /profile === "final-exam-smash"[\s\S]*?scale: 1\.12[\s\S]*?x: -48[\s\S]*?addLabel\("impact", \.38\)/);
  assert.match(motionSource, /profile === "final-exam-deal"[\s\S]*?scaleX: \.78[\s\S]*?opacity: \.72[\s\S]*?addLabel\("impact", \.16\)/);
  assert.match(motionSource, /profile === "default-attack"[\s\S]*?x: -28[\s\S]*?duration: \.16[\s\S]*?addLabel\("impact", \.26\)[\s\S]*?duration: \.2/);
  assert.match(namedFunctionSource("runBattleMotion"), /addLabel\("windup", 0\)[\s\S]*?addEnemyBattleMotion\(timeline, attacker, feedback\)/);
});

test("特殊动作只动画合成属性并保留 reduced-motion 与完整清理", () => {
  const motionSource = namedFunctionSource("addEnemyBattleMotion");
  const runSource = namedFunctionSource("runBattleMotion");
  const cleanupSource = namedFunctionSource("clearBattleMotionArtifacts");

  assert.doesNotMatch(motionSource, /\b(?:top|right|bottom|left|width|height|margin|padding)\s*:/);
  assert.doesNotMatch(motionSource, /\brepeat\s*:/);
  assert.ok((motionSource.match(/clearProps: "transform(?:,filter|,opacity)?"/g) || []).length >= 4);
  assert.match(runSource, /prefers-reduced-motion: reduce/);
  assert.match(runSource, /matchMedia\(\)[\s\S]*?prefers-reduced-motion: no-preference/);
  assert.match(runSource, /return \(\) => \{[\s\S]*?timeline\?\.kill\(\);[\s\S]*?removeGhosts\(\);/);
  assert.match(cleanupSource, /activeTimeline\?\.kill\(\)[\s\S]*?activeMedia\?\.revert\(\)[\s\S]*?element\.remove\(\)/);
});
