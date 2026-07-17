import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { challengeRewardGuidance } from "../build-analysis.js";
import { CHALLENGE_REWARD_DEFS, CHALLENGE_RULES, SemesterGame } from "../game-engine.js";

function masterActivePet(game) {
  game.pet.talent = "guardian";
  game.pet.talentLevel = 3;
  game.pet.bond = 25;
}

function prepareChallenge(game, { enemyId = "phoneSpirit", affix = "deadline" } = {}) {
  if (!game.tarotId) game.chooseTarot("chariot");
  game.semesterPlan[game.week] = [{
    type: "combat",
    enemy: enemyId,
    label: "测试挑战",
    challenge: true,
    affix
  }];
  const pendingStart = game.prepareCombatStart(enemyId, "challenge", {
    challenge: true,
    hpMultiplier: CHALLENGE_RULES.hpMultiplier,
    damageMultiplier: CHALLENGE_RULES.damageMultiplier,
    affix
  });
  assert.ok(pendingStart);
  game.startCombat(pendingStart.enemyId, pendingStart.modifiers);
  game.combat.enemy.hp = 0;
  game.checkCombatEnd();
  assert.equal(game.completePendingCombatStart(), true);
  return game.prepareChallengeCombatReward({ affix, enemyId });
}

test("精通宠物的伙伴路线冻结为一次性校园币且不再增加无效羁绊", () => {
  const game = new SemesterGame(1601, "gemini");
  game.week = 6;
  masterActivePet(game);
  game.deck = Array.from({ length: 10 }, () => game.createCard("feedPet"));

  const pending = prepareChallenge(game, { affix: "backlog" });
  assert.equal(pending.rewardVariant, "mastery");
  const advice = challengeRewardGuidance(game, 4);
  assert.match(advice.options.pet.reason, /共 45 校园币/);
  assert.doesNotMatch(advice.options.pet.reason, /继续强化核心节奏/);

  const goldBefore = game.gold;
  const bondBefore = game.pet.bond;
  assert.equal(game.choosePendingChallengeReward("pet"), true);
  assert.equal(game.gold, goldBefore + CHALLENGE_REWARD_DEFS.pet.masteryFallbackGold);
  assert.equal(game.pet.bond, bondBefore);
  assert.equal(game.pendingCombatReward.rewardVariant, "mastery");
  assert.equal(game.pendingCombatReward.fallbackGold, CHALLENGE_REWARD_DEFS.pet.masteryFallbackGold);
  assert.equal(game.choosePendingChallengeReward("pet"), false);
  assert.equal(game.gold, goldBefore + CHALLENGE_REWARD_DEFS.pet.masteryFallbackGold);

  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.equal(restored.pendingCombatReward.rewardVariant, "mastery");
  assert.equal(restored.pendingCombatReward.fallbackGold, CHALLENGE_REWARD_DEFS.pet.masteryFallbackGold);
  assert.equal(restored.gold, game.gold);
});

test("未精通仍获得羁绊并触发里程碑，可领取宠物蛋时蛋优先于精通回退", () => {
  const nearMastery = new SemesterGame(1602, "cancer");
  nearMastery.week = 7;
  nearMastery.pet.talent = "guardian";
  nearMastery.pet.talentLevel = 2;
  nearMastery.pet.bond = 24;
  prepareChallenge(nearMastery);
  assert.equal(nearMastery.pendingCombatReward.rewardVariant, "bond");
  assert.equal(nearMastery.choosePendingChallengeReward("pet"), true);
  assert.equal(nearMastery.pet.bond, 27);
  assert.equal(nearMastery.pet.pendingMilestone, "master");
  assert.equal(nearMastery.pendingCombatReward.fallbackGold, 0);

  const eggPriority = new SemesterGame(1603, "aries");
  eggPriority.week = 9;
  masterActivePet(eggPriority);
  prepareChallenge(eggPriority, { affix: "earlyClass", enemyId: "sleepyBug" });
  assert.equal(eggPriority.pendingCombatReward.rewardVariant, "egg");
  const bondBefore = eggPriority.pet.bond;
  assert.equal(eggPriority.choosePendingChallengeReward("pet"), true);
  assert.equal(eggPriority.pet.bond, bondBefore);
  assert.equal(eggPriority.incubator?.eggId, "sleepyBugEgg");
});

test("挑战胜利跨过精通阈值后，不刷新也会把伙伴路线改为精通补贴", () => {
  const game = new SemesterGame(1605, "cancer");
  game.week = 7;
  game.pet.talent = "guardian";
  game.pet.talentLevel = 2;
  game.pet.bond = 24;
  game.chooseTarot("chariot");
  game.semesterPlan[game.week] = [{
    type: "combat",
    enemy: "phoneSpirit",
    label: "测试挑战",
    challenge: true,
    affix: "deadline"
  }];
  const pendingStart = game.prepareCombatStart("phoneSpirit", "challenge", {
    challenge: true,
    hpMultiplier: CHALLENGE_RULES.hpMultiplier,
    damageMultiplier: CHALLENGE_RULES.damageMultiplier,
    affix: "deadline"
  });
  assert.ok(pendingStart);
  game.startCombat(pendingStart.enemyId, pendingStart.modifiers);
  game.combat.enemy.hp = 0;
  game.checkCombatEnd();
  assert.equal(game.completePendingCombatStart(), true);
  assert.equal(game.pet.bond, 25);
  assert.equal(game.pet.pendingMilestone, "master");

  game.prepareChallengeCombatReward({ affix: "deadline", enemyId: "phoneSpirit" });
  assert.equal(game.pendingCombatReward.rewardVariant, "bond");
  assert.equal(game.resolvePetMilestone(), true);
  assert.equal(game.pet.talentLevel, 3);
  assert.equal(game.pendingCombatReward.rewardVariant, "mastery");

  const goldBefore = game.gold;
  assert.equal(game.choosePendingChallengeReward("pet"), true);
  assert.equal(game.gold, goldBefore + CHALLENGE_REWARD_DEFS.pet.masteryFallbackGold);
  assert.equal(game.pet.bond, 25);
});

test("旧版满级伙伴路线存档会在领取前升级为精通补贴，完成阶段不会重复结算", () => {
  const game = new SemesterGame(1604, "aries");
  game.week = 6;
  masterActivePet(game);
  prepareChallenge(game, { affix: "backlog" });
  const legacy = game.toJSON();
  legacy.pendingCombatReward.rewardVariant = "bond";
  delete legacy.pendingCombatReward.fallbackGold;

  const restored = SemesterGame.fromJSON(legacy);
  assert.equal(restored.pendingCombatReward.rewardVariant, "mastery");
  const goldBefore = restored.gold;
  assert.equal(restored.choosePendingChallengeReward("pet"), true);
  assert.equal(restored.gold, goldBefore + CHALLENGE_REWARD_DEFS.pet.masteryFallbackGold);
  const completed = SemesterGame.fromJSON(restored.toJSON());
  assert.equal(completed.gold, restored.gold);
  assert.equal(completed.pendingCombatReward.rewardVariant, "mastery");
});

test("伙伴精通补贴在奖励页公开真实总额、羁绊不变与完成提示", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /const hasMasteryFallback = pending\?\.rewardVariant === "mastery"/);
  assert.match(appSource, /当前宠物已经精通，本路线改为共 \$\{reward\.masteryFallbackGold\} 校园币/);
  assert.match(appSource, /羁绊保持 \$\{game\.pet\.bond\}/);
  assert.match(appSource, /已精通，羁绊保持不变/);
});
