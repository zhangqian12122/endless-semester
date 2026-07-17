import test from "node:test";
import assert from "node:assert/strict";

import { CARD_DEFS } from "../game-data.js";
import { SemesterGame } from "../game-engine.js";

const CARD_IDS = Object.freeze({
  elbow: "elbowStrike",
  outrun: "cantOutrunMe"
});

const SUPPLY_IDS = Object.freeze({
  iceTea: "campusIceTea",
  crispyCone: "crispyCone"
});

function activeCombat(seed = 9001, enemyId = "alarmClock") {
  const game = new SemesterGame(seed, "cancer");
  game.startCombat(enemyId);
  game.combat.enemy.maxHp = 999;
  game.combat.enemy.hp = 999;
  game.combat.enemy.block = 0;
  game.combat.energy = 20;
  game.combat.hand = [];
  game.combat.drawPile = [];
  game.combat.discardPile = [];
  return game;
}

function addHandCard(game, id, upgraded = false) {
  const card = game.createCard(id);
  card.upgraded = upgraded;
  game.combat.hand.push(card);
  return card;
}

function assertSuccessful(result, message) {
  assert.equal(result?.ok, true, message);
}

test("肘击减攻可叠加但最高只降低 3 点", () => {
  const definition = CARD_DEFS[CARD_IDS.elbow];
  assert.equal(definition?.name, "肘击");
  assert.ok(definition.effect.enemyAttackDown > 0, "肘击必须公开 enemyAttackDown 效果");

  const game = activeCombat(9002);
  const cardsNeededToExceedCap = Math.ceil(3 / definition.effect.enemyAttackDown) + 2;
  const elbows = Array.from({ length: cardsNeededToExceedCap }, () => addHandCard(game, CARD_IDS.elbow));
  for (const card of elbows) assertSuccessful(game.playCard(card.uid), "连续肘击应可以正常结算");

  // 闹钟怪第三步的原始攻击为 14；无论继续叠多少肘击，最多只能降低 3。
  game.combat.enemy.intentTurn = 2;
  assert.equal(game.getIntent().attack, 11);
});

test("肘击减攻穿过非攻击回合保留，并只在真实攻击结算后消耗", () => {
  const reduction = CARD_DEFS[CARD_IDS.elbow].effect.enemyAttackDown;
  const game = activeCombat(9003);
  const elbow = addHandCard(game, CARD_IDS.elbow);
  assertSuccessful(game.playCard(elbow.uid));

  // 闹钟怪第一步只获得护甲；这一步不能浪费“下次攻击降低”。
  game.combat.enemy.intentTurn = 0;
  assert.equal(game.getIntent().attack, undefined);
  const guardTurn = game.endTurn();
  assert.equal(guardTurn.enemyResult.attack, null);

  // 第二步原始攻击为 7，仍应完整吃到肘击减攻。
  assert.equal(game.getIntent().attack, Math.max(0, 7 - reduction));
  const attackTurn = game.endTurn();
  assert.equal(attackTurn.enemyResult.attack.perHit, Math.max(0, 7 - reduction));

  // 第三步原始攻击为 14；上一轮真实攻击结算后，减攻必须已经消耗。
  assert.equal(game.getIntent().attack, 14);
});

test("你跑不过我你信吗只强化后续攻击，露怯取最大值且回合结束清零", () => {
  const definition = CARD_DEFS[CARD_IDS.outrun];
  assert.equal(definition?.name, "你跑不过我你信吗");
  assert.ok(definition.effect.enemyExposed > 0, "卡牌必须公开 enemyExposed 效果");

  const game = activeCombat(9004, "sleepyBug");
  const setup = addHandCard(game, CARD_IDS.outrun);
  const upgradedSetup = addHandCard(game, CARD_IDS.outrun, true);
  const damageSkill = addHandCard(game, "lendAHand");
  const followupAttack = addHandCard(game, "textbookStrike");
  const exposed = Math.max(
    definition.effect.enemyExposed,
    definition.upgradedEffect.enemyExposed
  );

  const hpBeforeSetup = game.combat.enemy.hp;
  assertSuccessful(game.playCard(setup.uid));
  assert.equal(
    hpBeforeSetup - game.combat.enemy.hp,
    definition.effect.damage,
    "设置露怯的第一次攻击不能强化自己"
  );

  const upgradedDefinition = CARD_DEFS[CARD_IDS.outrun].upgradedEffect;
  assert.equal(
    game.cardEffectPreview(upgradedSetup).damagePerHit,
    upgradedDefinition.damage + definition.effect.enemyExposed,
    "第一层露怯应强化后续攻击"
  );
  assertSuccessful(game.playCard(upgradedSetup.uid));

  assert.equal(
    game.cardEffectPreview(damageSkill).damagePerHit,
    CARD_DEFS.lendAHand.effect.damage,
    "露怯不能增幅技能牌造成的伤害"
  );
  assert.equal(
    game.cardEffectPreview(followupAttack).damagePerHit,
    CARD_DEFS.textbookStrike.effect.damage + exposed,
    "重复施加露怯应取最大值，不能相加"
  );

  const hpBeforeSkill = game.combat.enemy.hp;
  assertSuccessful(game.playCard(damageSkill.uid));
  assert.equal(hpBeforeSkill - game.combat.enemy.hp, CARD_DEFS.lendAHand.effect.damage);

  const hpBeforeFollowup = game.combat.enemy.hp;
  assertSuccessful(game.playCard(followupAttack.uid));
  assert.equal(
    hpBeforeFollowup - game.combat.enemy.hp,
    CARD_DEFS.textbookStrike.effect.damage + exposed
  );

  game.combat.enemy.intentTurn = 1; // 瞌睡虫本步只获得护甲，便于进入下一玩家回合。
  assertSuccessful(game.endTurn());
  const nextTurnAttack = game.createCard("textbookStrike");
  assert.equal(
    game.cardEffectPreview(nextTurnAttack).damagePerHit,
    CARD_DEFS.textbookStrike.effect.damage,
    "露怯只能持续当前玩家回合"
  );
});

test("校园冰茶与巧脆筒占用独立的 2 格用品栏，使用后立即移除", () => {
  const game = new SemesterGame(9005, "cancer");
  assert.equal(game.supplyCapacity, 2);
  assert.deepEqual(game.supplies, []);
  assert.equal(game.addSupply(SUPPLY_IDS.iceTea), true);
  assert.equal(game.addSupply(SUPPLY_IDS.crispyCone), true);
  assert.equal(game.addSupply(SUPPLY_IDS.iceTea), false, "用品栏满后不能再加入用品");
  assert.deepEqual(game.supplies, [SUPPLY_IDS.iceTea, SUPPLY_IDS.crispyCone]);
  assert.equal(game.items.includes(SUPPLY_IDS.iceTea), false);
  assert.equal(game.items.includes(SUPPLY_IDS.crispyCone), false);

  game.startCombat("sleepyBug");
  game.combat.energy = 1;
  game.combat.hand = [];
  game.combat.drawPile = [game.createCard("textbookStrike")];
  game.combat.discardPile = [];
  game.pet.charge = 0;

  assertSuccessful(game.useSupply(SUPPLY_IDS.iceTea), "校园冰茶应能在战斗中使用");
  assert.equal(game.combat.energy, 2, "校园冰茶应提供 1 点能量");
  assert.equal(game.combat.hand.length, 1, "校园冰茶应抽 1 张牌");
  assert.deepEqual(game.supplies, [SUPPLY_IDS.crispyCone]);
  assert.notEqual(game.useSupply(SUPPLY_IDS.iceTea)?.ok, true, "同一份用品不能重复使用");

  const blockBefore = game.combat.playerBlock;
  assertSuccessful(game.useSupply(SUPPLY_IDS.crispyCone), "巧脆筒应能在战斗中使用");
  assert.equal(game.combat.playerBlock, blockBefore + 8, "巧脆筒应提供 8 点护甲");
  assert.equal(game.pet.charge, 1, "巧脆筒应使宠物充能 +1");
  assert.deepEqual(game.supplies, []);
  assert.notEqual(game.useSupply(SUPPLY_IDS.crispyCone)?.ok, true, "已消耗的巧脆筒不能再次结算");
});

test("未使用用品和使用后的空位都能通过存档恢复", () => {
  const game = new SemesterGame(9006, "cancer");
  assert.equal(game.addSupply(SUPPLY_IDS.iceTea), true);
  assert.equal(game.addSupply(SUPPLY_IDS.crispyCone), true);

  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.equal(restored.supplyCapacity, 2);
  assert.deepEqual(restored.supplies, [SUPPLY_IDS.iceTea, SUPPLY_IDS.crispyCone]);
  assert.equal(restored.items.includes(SUPPLY_IDS.iceTea), false);
  assert.equal(restored.items.includes(SUPPLY_IDS.crispyCone), false);

  restored.startCombat("sleepyBug");
  restored.combat.hand = [];
  restored.combat.drawPile = [restored.createCard("textbookStrike")];
  restored.combat.discardPile = [];
  assertSuccessful(restored.useSupply(SUPPLY_IDS.iceTea));

  const afterUse = SemesterGame.fromJSON(restored.toJSON());
  assert.deepEqual(afterUse.supplies, [SUPPLY_IDS.crispyCone], "已使用的用品不能在读档后复活");
  assert.equal(afterUse.supplyCapacity, 2);
});
