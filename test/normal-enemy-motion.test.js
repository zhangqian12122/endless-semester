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

const profileSource = namedFunctionSource("enemyBattleMotionProfile");
const recipeSource = namedFunctionSource("regularEnemyBattleMotionRecipe");
const addMotionSource = namedFunctionSource("addEnemyBattleMotion");
const resolveProfile = new Function(`${profileSource}; return enemyBattleMotionProfile;`)();
const resolveRecipe = new Function(`${recipeSource}; return regularEnemyBattleMotionRecipe;`)();
const addEnemyMotion = new Function(`${profileSource}\n${recipeSource}\n${addMotionSource}; return addEnemyBattleMotion;`)();

const ordinaryProfiles = Object.freeze({
  sleepyBug: "sleepy-sway",
  homeworkBlob: "blob-squash",
  alarmClock: "alarm-ring",
  phoneSpirit: "phone-vibrate",
  groupChat: "chat-pop",
  printerJam: "printer-feed"
});

function recordMotion(feedback) {
  const calls = [];
  const timeline = {
    to(target, vars, position) {
      calls.push({ kind: "to", target, vars: { ...vars }, position });
      return this;
    },
    fromTo(target, fromVars, toVars, position) {
      calls.push({ kind: "fromTo", target, fromVars: { ...fromVars }, vars: { ...toVars }, position });
      return this;
    },
    addLabel(name, position) {
      calls.push({ kind: "label", name, position });
      return this;
    }
  };
  const attacker = {};
  const profile = addEnemyMotion(timeline, attacker, feedback);
  return { calls, attacker, profile };
}

function motionFingerprint(record) {
  return JSON.stringify(record.calls
    .filter((call) => call.kind === "to" && call.vars.clearProps !== "transform")
    .map((call) => ({ position: call.position, vars: call.vars })));
}

test("六名普通敌人获得互不重复的动作身份且不覆盖特殊敌人", () => {
  const resolved = Object.entries(ordinaryProfiles).map(([enemyId, profile]) => {
    assert.equal(resolveProfile({ enemyId, motionType: "enemy-attack", playerDamage: 3 }), profile);
    assert.equal(resolveProfile({ enemyId, motionType: "enemy-skill" }), profile);
    return profile;
  });

  assert.equal(new Set(resolved).size, 6);
  assert.equal(resolveProfile({ enemyId: "rivalShadow", playerBlockAbsorbed: 4 }), "rival-rush");
  assert.equal(resolveProfile({ enemyId: "finalExam", playerDamage: 8 }), "final-exam-smash");
  assert.equal(resolveProfile({ enemyId: "finalExam", intentName: "发卷 · 第2轮" }), "final-exam-deal");
  assert.equal(resolveProfile({ enemyId: "unknownEnemy", playerDamage: 2 }), "default-attack");
  assert.equal(resolveProfile({ enemyId: "unknownEnemy" }), "default-skill");
});

test("每种普通敌人都拥有不同的攻击与技能节拍，并在 0.55 秒内回正", () => {
  const attackFingerprints = [];
  const skillFingerprints = [];

  for (const [enemyId, profile] of Object.entries(ordinaryProfiles)) {
    const attackRecipe = resolveRecipe(profile, true);
    const skillRecipe = resolveRecipe(profile, false);
    assert.ok(attackRecipe?.steps.length >= 2, `${enemyId} 缺少攻击动作步骤`);
    assert.ok(skillRecipe?.steps.length >= 2, `${enemyId} 缺少技能动作步骤`);
    assert.notDeepEqual(attackRecipe.steps, skillRecipe.steps, `${enemyId} 的攻击和技能不能完全相同`);
    assert.ok(attackRecipe.impactAt + attackRecipe.settleDelay + attackRecipe.settleDuration <= .55);
    assert.ok(skillRecipe.impactAt + skillRecipe.settleDelay + skillRecipe.settleDuration <= .55);

    const attack = recordMotion({ enemyId, motionType: "enemy-attack" });
    const skill = recordMotion({ enemyId, motionType: "enemy-skill" });
    attackFingerprints.push(motionFingerprint(attack));
    skillFingerprints.push(motionFingerprint(skill));

    for (const record of [attack, skill]) {
      assert.equal(record.calls.filter((call) => call.kind === "label" && call.name === "impact").length, 1);
      const attackerTweens = record.calls.filter((call) => call.kind === "to" && call.target === record.attacker);
      assert.equal(attackerTweens.at(-1)?.vars.clearProps, "transform");
    }
  }

  assert.equal(new Set(attackFingerprints).size, 6, "六名敌人的攻击动作应全部不同");
  assert.equal(new Set(skillFingerprints).size, 6, "六名敌人的技能动作应全部不同");
});

test("普通敌人动作只使用短时间轴与合成 transform 属性", () => {
  const forbidden = new Set([
    "top", "right", "bottom", "left", "width", "height", "margin", "padding",
    "filter", "opacity", "autoAlpha", "repeat", "delay"
  ]);

  for (const profile of Object.values(ordinaryProfiles)) {
    for (const attacksPlayer of [false, true]) {
      const recipe = resolveRecipe(profile, attacksPlayer);
      for (const step of recipe.steps) {
        assert.match(step.position, /^windup(?:\+=\.\d+)?$/);
        assert.ok(Number(step.vars.duration) > 0 && Number(step.vars.duration) <= .18);
        for (const key of Object.keys(step.vars)) {
          assert.equal(forbidden.has(key), false, `${profile} 不应动画 ${key}`);
        }
      }
    }
  }

  assert.doesNotMatch(addMotionSource, /setTimeout|setInterval/);
  assert.match(addMotionSource, /regularRecipe\.steps\.forEach/);
  assert.match(addMotionSource, /clearProps: "transform"/);
});
