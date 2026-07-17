import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_PET_ID,
  PET_DEFS,
  PET_EGG_DEFS,
  PET_TALENT_DEFS
} from "../game-data.js?v=1.8.63";
import {
  CHALLENGE_REWARD_DEFS,
  CHALLENGE_RULES,
  SemesterGame,
  TAROT_DEFS
} from "../game-engine.js";

function finishCombat(game, result = "won", enemyId = "alarmClock") {
  game.startCombat(enemyId);
  if (result === "won") game.combat.enemy.hp = 0;
  else game.hp = 0;
  game.checkCombatEnd();
  return game.combat;
}

function prepareChallenge(game, enemyId = "sleepyBug") {
  if (!game.tarotId) game.chooseTarot("chariot");
  game.week = 5;
  game.semesterPlan[game.week] = [{
    type: "combat",
    enemy: enemyId,
    label: "测试挑战",
    challenge: true,
    affix: "deadline"
  }];
  const pendingStart = game.prepareCombatStart(enemyId, "challenge", {
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
  return game.prepareChallengeCombatReward({ affix: "deadline", enemyId });
}

function prepareHatchRest(game, after = 0) {
  if (!game.tarotId) game.chooseTarot("chariot");
  const restWeeks = game.semesterPlan
    .map((nodes, week) => ({ nodes, week }))
    .filter(({ nodes, week }) => week > 0 && week < 16 && nodes.some((node) => node.type === "rest"))
    .map(({ week }) => week);
  game.week = restWeeks.find((week) => week > after) || restWeeks[0];
  return game.prepareRest();
}

test("开局宠物只从生涯解锁列表中选择，并在本局保持同一活动伙伴", () => {
  const selected = new SemesterGame(
    701,
    "aries",
    "sleepyBugCub",
    [DEFAULT_PET_ID, "sleepyBugCub"]
  );
  assert.deepEqual(selected.ownedPetIds(), [DEFAULT_PET_ID, "sleepyBugCub"]);
  assert.equal(selected.activePetId, "sleepyBugCub");
  assert.equal(selected.pet, selected.pets.sleepyBugCub);
  assert.equal(selected.getPetDefinition(), PET_DEFS.sleepyBugCub);
  assert.equal(selected.petSkillPreview().damage, 5);
  assert.equal(selected.petSkillPreview().block, 3);

  selected.startCombat("alarmClock");
  selected.pet.charge = 3;
  selected.combat.energy = 3;
  assert.equal(selected.usePetSkill().ok, true);
  assert.equal(selected.combat.playerBlock, 3);
  selected.week = 16;
  selected.awaitingNextSemester = true;
  assert.equal(selected.startNextSemester(), true);
  assert.equal(selected.activePetId, "sleepyBugCub");
  assert.equal(selected.pet, selected.pets.sleepyBugCub);

  const locked = new SemesterGame(702, "aries", "sleepyBugCub", [DEFAULT_PET_ID]);
  assert.equal(locked.activePetId, DEFAULT_PET_ID);
  assert.deepEqual(locked.ownedPetIds(), [DEFAULT_PET_ID]);
  assert.equal(typeof locked.switchPetAtRest, "undefined");
});

test("困困虫幼崽拥有独立技能与三条独立羁绊路线", () => {
  const game = new SemesterGame(703, "cancer", "sleepyBugCub", [DEFAULT_PET_ID, "sleepyBugCub"]);
  const pet = PET_DEFS.sleepyBugCub;
  assert.equal(pet.skill.name, "蜷睡扑击");
  assert.equal(pet.skill.baseDamage, 5);
  assert.equal(pet.skill.baseBlock, 3);
  assert.equal(pet.maxCharge, 3);
  assert.deepEqual(pet.talentIds, ["sleepyPounce", "sleepyPillow", "sleepyRhythm"]);
  assert.equal(pet.talentIds.every((id) => PET_TALENT_DEFS[id]), true);

  game.pet.bond = 3;
  assert.equal(game.updatePetMilestone(), "choose");
  assert.equal(game.resolvePetMilestone("sleepyPillow"), true);
  assert.equal(game.petSkillPreview().block, 5);
  assert.equal(game.resolvePetMilestone("guardian"), false);
});

test("通用塔罗与成就文案不会把非鸭宠物误称为鸭", () => {
  assert.equal(TAROT_DEFS.strength.tagline, "让伙伴先上");
  assert.equal(TAROT_DEFS.strength.rest.name, "伙伴夜训");
});

test("挑战瞌睡虫会固定蛋奖励，领取原子结算且刷新不会重复", () => {
  const game = new SemesterGame(704, "gemini");
  const pending = prepareChallenge(game, "sleepyBug");
  const bondBefore = game.pet.bond;
  const goldBefore = game.gold;

  assert.equal(pending.enemyId, "sleepyBug");
  assert.equal(pending.eggId, "sleepyBugEgg");
  assert.equal(pending.rewardVariant, "egg");
  const restoredAtRoute = SemesterGame.fromJSON(game.toJSON());
  assert.deepEqual(
    {
      enemyId: restoredAtRoute.pendingCombatReward.enemyId,
      eggId: restoredAtRoute.pendingCombatReward.eggId,
      rewardVariant: restoredAtRoute.pendingCombatReward.rewardVariant
    },
    { enemyId: "sleepyBug", eggId: "sleepyBugEgg", rewardVariant: "egg" }
  );
  assert.equal(game.choosePendingChallengeReward("pet"), true);
  assert.deepEqual(game.incubator, { eggId: "sleepyBugEgg", battles: 0 });
  assert.equal(game.pet.bond, bondBefore);
  assert.equal(game.gold, goldBefore + CHALLENGE_REWARD_DEFS.pet.gold);
  assert.equal(game.stats.challengeRewardChoices.pet, 1);

  assert.equal(game.choosePendingChallengeReward("pet"), false);
  assert.deepEqual(game.incubator, { eggId: "sleepyBugEgg", battles: 0 });
  assert.equal(game.gold, goldBefore + CHALLENGE_REWARD_DEFS.pet.gold);

  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.equal(restored.pendingCombatReward.route, "pet");
  assert.equal(restored.pendingCombatReward.rewardVariant, "egg");
  assert.equal(restored.pendingCombatReward.enemyId, "sleepyBug");
  assert.equal(restored.pendingCombatReward.eggId, "sleepyBugEgg");
  assert.deepEqual(restored.incubator, { eggId: "sleepyBugEgg", battles: 0 });
  assert.deepEqual(restored.loadRepairs, []);
});

test("非瞌睡虫、已有幼崽或孵化位占用时，伙伴路线固定回退羁绊 +2", () => {
  const otherEnemy = new SemesterGame(705, "aries");
  const otherPending = prepareChallenge(otherEnemy, "phoneSpirit");
  const otherBond = otherEnemy.pet.bond;
  assert.deepEqual(
    { enemyId: otherPending.enemyId, eggId: otherPending.eggId, rewardVariant: otherPending.rewardVariant },
    { enemyId: "phoneSpirit", eggId: null, rewardVariant: "bond" }
  );
  assert.equal(otherEnemy.choosePendingChallengeReward("pet"), true);
  assert.equal(otherEnemy.pet.bond, otherBond + 2);
  assert.equal(otherEnemy.incubator, null);

  const alreadyUnlocked = new SemesterGame(
    706,
    "aries",
    DEFAULT_PET_ID,
    [DEFAULT_PET_ID, "sleepyBugCub"]
  );
  const ownedPending = prepareChallenge(alreadyUnlocked, "sleepyBug");
  assert.equal(ownedPending.eggId, "sleepyBugEgg");
  assert.equal(ownedPending.rewardVariant, "bond");

  const occupied = new SemesterGame(707, "aries");
  assert.deepEqual(occupied.claimEgg("sleepyBugEgg"), {
    eggId: "sleepyBugEgg",
    petId: "sleepyBugCub",
    battles: 0,
    requiredCombats: 3
  });
  const occupiedPending = prepareChallenge(occupied, "sleepyBug");
  const occupiedBond = occupied.pet.bond;
  assert.equal(occupiedPending.rewardVariant, "bond");
  assert.equal(occupied.choosePendingChallengeReward("pet"), true);
  assert.equal(occupied.pet.bond, occupiedBond + 2);
  assert.deepEqual(occupied.incubator, { eggId: "sleepyBugEgg", battles: 0 });
});

test("困困虫蛋只在三次休息孵化后解锁，且不会自动替换参战宠物", () => {
  const game = new SemesterGame(708, "cancer");
  assert.equal(PET_EGG_DEFS.sleepyBugEgg.requiredCombats, 3);
  game.claimEgg("sleepyBugEgg");

  const combat = finishCombat(game);
  assert.equal(combat.petIncubationEvent, null);
  assert.deepEqual(game.incubator, { eggId: "sleepyBugEgg", battles: 0 });

  let previousWeek = 0;
  prepareHatchRest(game, previousWeek);
  previousWeek = game.week;
  const first = game.resolveRestHatch();
  assert.deepEqual(game.incubator, { eggId: "sleepyBugEgg", battles: 1 });
  assert.deepEqual(first, {
    type: "progress",
    eggId: "sleepyBugEgg",
    petId: "sleepyBugCub",
    battles: 1,
    requiredCombats: 3
  });
  assert.equal(game.resolveRestHatch(), null);
  game.completePendingRest();
  assert.deepEqual(game.incubator, { eggId: "sleepyBugEgg", battles: 1 });

  prepareHatchRest(game, previousWeek);
  previousWeek = game.week;
  const second = game.resolveRestHatch();
  assert.equal(second.battles, 2);
  game.completePendingRest();
  assert.deepEqual(game.incubator, { eggId: "sleepyBugEgg", battles: 2 });

  prepareHatchRest(game, previousWeek);
  const third = game.resolveRestHatch();
  assert.equal(third.type, "hatched");
  assert.equal(third.petId, "sleepyBugCub");
  assert.equal(game.incubator, null);
  assert.equal(game.hasPet("sleepyBugCub"), true);
  assert.equal(game.activePetId, DEFAULT_PET_ID);
  assert.equal(game.pet, game.pets[DEFAULT_PET_ID]);
  assert.deepEqual(game.pendingRest, { stage: "hatch", cardUids: [], ...third });
});

test("战斗失败不推进也不倒扣孵化进度", () => {
  const game = new SemesterGame(709, "cancer");
  game.claimEgg("sleepyBugEgg");
  game.incubator.battles = 1;
  const combat = finishCombat(game, "lost");
  assert.deepEqual(game.incubator, { eggId: "sleepyBugEgg", battles: 1 });
  assert.equal(combat.petIncubationEvent, null);
});

test("多宠物、活动宠物和孵化进度可往返，污染字段会严格清洗", () => {
  const roster = new SemesterGame(
    710,
    "gemini",
    "sleepyBugCub",
    [DEFAULT_PET_ID, "sleepyBugCub"]
  );
  roster.pets.offlineDuck.bond = 8;
  roster.pets.offlineDuck.talent = "guardian";
  roster.pets.offlineDuck.talentLevel = 2;
  roster.pet.bond = 4;
  roster.pet.talent = "sleepyPounce";
  roster.pet.talentLevel = 1;
  const restoredRoster = SemesterGame.fromJSON(roster.toJSON());
  assert.equal(restoredRoster.activePetId, "sleepyBugCub");
  assert.equal(restoredRoster.pet, restoredRoster.pets.sleepyBugCub);
  assert.equal(restoredRoster.pets.offlineDuck.bond, 8);
  assert.equal(restoredRoster.pets.offlineDuck.talent, "guardian");
  assert.equal(restoredRoster.pets.sleepyBugCub.bond, 4);
  assert.equal(restoredRoster.pets.sleepyBugCub.talent, "sleepyPounce");
  assert.deepEqual(restoredRoster.loadRepairs, []);

  const incubating = new SemesterGame(711, "aries");
  incubating.claimEgg("sleepyBugEgg");
  incubating.incubator.battles = 2;
  const restoredIncubator = SemesterGame.fromJSON(incubating.toJSON());
  assert.deepEqual(restoredIncubator.incubator, { eggId: "sleepyBugEgg", battles: 2 });

  const polluted = incubating.toJSON();
  polluted.pets.unknown = { id: "unknown", bond: 999 };
  polluted.pets.offlineDuck.name = "<img onerror=alert(1)>";
  polluted.pets.offlineDuck.maxCharge = 999;
  polluted.pet.name = "伪造宠物";
  polluted.pet.maxCharge = 999;
  polluted.activePetId = "unknown";
  polluted.incubator = { eggId: "sleepyBugEgg", battles: 99 };
  const repaired = SemesterGame.fromJSON(polluted);
  assert.equal(repaired.activePetId, DEFAULT_PET_ID);
  assert.equal(repaired.pet.name, PET_DEFS.offlineDuck.name);
  assert.equal(repaired.pet.maxCharge, PET_DEFS.offlineDuck.maxCharge);
  assert.deepEqual(repaired.ownedPetIds(), [DEFAULT_PET_ID]);
  assert.equal(repaired.incubator, null);
  assert.equal(repaired.loadRepairs.some((note) => /宠物名册/.test(note)), true);
  assert.equal(repaired.loadRepairs.some((note) => /孵化状态/.test(note)), true);
});

test("只有 pet 字段的旧档和 goose 别名继续迁移到宕机鸭", () => {
  const source = new SemesterGame(712, "cancer");
  const legacy = source.toJSON();
  delete legacy.pets;
  delete legacy.activePetId;
  delete legacy.incubator;
  legacy.pet = {
    id: "goose",
    name: "旧名字",
    bond: 12,
    charge: 1,
    maxCharge: 99,
    talent: "guardian",
    talentLevel: 2,
    pendingMilestone: null
  };
  const restored = SemesterGame.fromJSON(legacy);
  assert.equal(restored.activePetId, DEFAULT_PET_ID);
  assert.deepEqual(restored.ownedPetIds(), [DEFAULT_PET_ID]);
  assert.equal(restored.pet.name, PET_DEFS.offlineDuck.name);
  assert.equal(restored.pet.bond, 12);
  assert.equal(restored.pet.charge, 1);
  assert.equal(restored.pet.maxCharge, PET_DEFS.offlineDuck.maxCharge);
  assert.equal(restored.pet.talent, "guardian");
  assert.equal(restored.pet.talentLevel, 2);
});
