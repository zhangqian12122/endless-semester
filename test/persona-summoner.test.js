import test from "node:test";
import assert from "node:assert/strict";

import * as Career from "../career.js";
import * as Data from "../game-data.js";
import * as Engine from "../game-engine.js";

const { SemesterGame } = Engine;
const STUDENT_PERSONA_ID = "student";
const SUMMONER_PERSONA_ID = "summoner";
const MAX_SUMMONS = 3;

function requiredFunction(namespace, name, owner) {
  assert.equal(typeof namespace[name], "function", `${owner} 应导出 ${name}()`);
  return namespace[name];
}

function personaDefinitions() {
  assert.ok(Data.PERSONA_DEFS, "game-data.js 应导出 PERSONA_DEFS");
  assert.ok(Data.PERSONA_DEFS[STUDENT_PERSONA_ID], "应保留默认 student 人格");
  assert.ok(Data.PERSONA_DEFS[SUMMONER_PERSONA_ID], "应定义第二人格 summoner");
  return Data.PERSONA_DEFS;
}

function summonerGame(seed) {
  const game = new SemesterGame(
    seed,
    "cancer",
    Data.DEFAULT_PET_ID,
    [Data.DEFAULT_PET_ID],
    SUMMONER_PERSONA_ID
  );
  assert.equal(game.personaId, SUMMONER_PERSONA_ID);
  return game;
}

function startSummonerCombat(seed, summons = 0) {
  const game = summonerGame(seed);
  game.startCombat("sleepyBug");
  game.combat.energy = 99;
  assert.equal(game.combat.summons, 0, "每场战斗应从 0 层召唤开始");
  if (summons) {
    requiredFunction(game, "addSummons", "SemesterGame").call(game, summons);
    assert.equal(game.combat.summons, Math.min(MAX_SUMMONS, summons));
  }
  return game;
}

function cardWithEffect(field) {
  const entry = Object.entries(Data.CARD_DEFS).find(([, definition]) => (
    Number.isFinite(definition.effect?.[field]) && definition.effect[field] > 0
  ));
  assert.ok(entry, `至少应有一张牌配置正数 ${field}`);
  return { id: entry[0], definition: entry[1] };
}

function playSingleCard(game, id) {
  const card = game.createCard(id);
  game.combat.hand = [card];
  const result = game.playCard(card.uid);
  assert.equal(result.ok, true, `${Data.CARD_DEFS[id]?.name || id} 应能正常打出`);
  return result;
}

test("默认人格是 student，召唤人格数据声明专属起始牌", () => {
  const personas = personaDefinitions();
  assert.equal(new SemesterGame(8301, "cancer").personaId, STUDENT_PERSONA_ID);
  assert.equal(personas[SUMMONER_PERSONA_ID].specialCard, "summonPaperCrane");
  assert.ok(Data.CARD_DEFS[personas[SUMMONER_PERSONA_ID].specialCard]);
});

test("完成第二学期才解锁 summoner，职业存档恢复后仍可选择", () => {
  const createCareerProfile = requiredFunction(Career, "createCareerProfile", "career.js");
  const recordSemesterCompletion = requiredFunction(Career, "recordSemesterCompletion", "career.js");
  const normalizeCareerProfile = requiredFunction(Career, "normalizeCareerProfile", "career.js");
  const canSelectPersona = requiredFunction(Career, "canSelectPersona", "career.js");
  const profile = createCareerProfile();

  assert.deepEqual(profile.unlockedPersonaIds, [STUDENT_PERSONA_ID]);
  assert.equal(canSelectPersona(profile, STUDENT_PERSONA_ID), true);
  assert.equal(canSelectPersona(profile, SUMMONER_PERSONA_ID), false);

  recordSemesterCompletion(profile, 1);
  assert.equal(canSelectPersona(profile, SUMMONER_PERSONA_ID), false, "第一学期结束不能提前解锁");

  recordSemesterCompletion(profile, 2);
  recordSemesterCompletion(profile, 2);
  assert.equal(canSelectPersona(profile, SUMMONER_PERSONA_ID), true);
  assert.deepEqual(
    profile.unlockedPersonaIds,
    [STUDENT_PERSONA_ID, SUMMONER_PERSONA_ID],
    "重复记录第二学期也应保持稳定且有序的人格列表"
  );

  const restored = normalizeCareerProfile(JSON.parse(JSON.stringify(profile)));
  assert.deepEqual(restored.unlockedPersonaIds, [STUDENT_PERSONA_ID, SUMMONER_PERSONA_ID]);
  assert.equal(canSelectPersona(restored, SUMMONER_PERSONA_ID), true);
});

test("未解锁档案不能选择 summoner，student 始终是安全回退", () => {
  const canSelectPersona = requiredFunction(Career, "canSelectPersona", "career.js");
  const locked = { ...Career.createCareerProfile(), unlockedPersonaIds: [STUDENT_PERSONA_ID] };

  assert.equal(canSelectPersona(locked, SUMMONER_PERSONA_ID), false);
  assert.equal(canSelectPersona({ ...locked, unlockedPersonaIds: [] }, STUDENT_PERSONA_ID), true);
  assert.equal(canSelectPersona(locked, "unknown-persona"), false);
});

test("summoner 开局包含专属召唤起始牌，student 开局不携带", () => {
  const specialCard = personaDefinitions()[SUMMONER_PERSONA_ID].specialCard;
  const summoner = summonerGame(8302);
  const student = new SemesterGame(8303, "cancer");

  assert.ok(summoner.deck.some((card) => card.id === specialCard));
  assert.equal(student.deck.some((card) => card.id === specialCard), false);

  const startingDeckFor = requiredFunction(Engine, "startingDeckFor", "game-engine.js");
  assert.ok(startingDeckFor("cancer", SUMMONER_PERSONA_ID).includes(specialCard));
  assert.equal(startingDeckFor("cancer", STUDENT_PERSONA_ID).includes(specialCard), false);
});

test("召唤层数每场从 0 开始且无论一次增加多少都封顶 3", () => {
  const game = startSummonerCombat(8304);
  const addSummons = requiredFunction(game, "addSummons", "SemesterGame");

  addSummons.call(game, 2);
  assert.equal(game.combat.summons, 2);
  addSummons.call(game, 99);
  assert.equal(game.combat.summons, MAX_SUMMONS);
  addSummons.call(game, 1);
  assert.equal(game.combat.summons, MAX_SUMMONS, "已满层时不能继续膨胀");
});

test("damagePerSummon 按当前召唤层数增加实际伤害", () => {
  const { id, definition } = cardWithEffect("damagePerSummon");
  const zero = startSummonerCombat(8305, 0);
  const two = startSummonerCombat(8306, 2);
  const zeroHp = zero.combat.enemy.hp;
  const twoHp = two.combat.enemy.hp;

  playSingleCard(zero, id);
  playSingleCard(two, id);

  const zeroDamage = zeroHp - zero.combat.enemy.hp;
  const twoDamage = twoHp - two.combat.enemy.hp;
  const hits = Math.max(1, Number(definition.effect.hits) || 1);
  assert.equal(
    twoDamage - zeroDamage,
    definition.effect.damagePerSummon * 2 * hits,
    "每层召唤应为每段伤害追加 damagePerSummon"
  );
});

test("blockPerSummon 按当前召唤层数增加实际护甲", () => {
  const { id, definition } = cardWithEffect("blockPerSummon");
  const zero = startSummonerCombat(8307, 0);
  const three = startSummonerCombat(8308, 3);
  const zeroBlock = zero.combat.playerBlock;
  const threeBlock = three.combat.playerBlock;

  playSingleCard(zero, id);
  playSingleCard(three, id);

  assert.equal(
    (three.combat.playerBlock - threeBlock) - (zero.combat.playerBlock - zeroBlock),
    definition.effect.blockPerSummon * MAX_SUMMONS,
    "每层召唤应追加 blockPerSummon 护甲"
  );
});

test("consumeSummons 清空当前全部召唤层数且重复调用幂等", () => {
  const game = startSummonerCombat(8309, MAX_SUMMONS);
  const consumeSummons = requiredFunction(game, "consumeSummons", "SemesterGame");

  consumeSummons.call(game);
  assert.equal(game.combat.summons, 0);
  consumeSummons.call(game);
  assert.equal(game.combat.summons, 0);
});
