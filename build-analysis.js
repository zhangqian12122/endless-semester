import { cardDefinition } from "./game-engine.js";

export const BUILD_STYLE_DEFS = {
  offense: { id: "offense", label: "爆发强攻", sign: "✦", text: "用攻击密度和伤害增幅尽快结束战斗。" },
  defense: { id: "defense", label: "稳固防守", sign: "◆", text: "先覆盖公开伤害，再用安全回合慢慢取胜。" },
  cycle: { id: "cycle", label: "高速循环", sign: "↻", text: "依靠零费、抽牌和筛选反复找到关键牌。" },
  pet: { id: "pet", label: "鹅鹅协同", sign: "鹅", text: "稳定充能，让宠物成为每场战斗的固定节奏点。" }
};

function addArchetypeBias(scores, archetypeId) {
  if (archetypeId === "aries") scores.offense += 5;
  if (archetypeId === "gemini") scores.cycle += 7;
  if (archetypeId === "cancer") scores.defense += 5;
}

function addItemBias(scores, game) {
  if (game.hasItem("autoPencil")) scores.offense += 2;
  if (game.hasItem("thickNotebook") || game.hasItem("bandage")) scores.defense += 2;
  if (game.hasItem("referenceBooks")) scores.cycle += 4;
  if (game.hasItem("petSnack")) scores.pet += 5;
  if (game.pet.talent) scores.pet += 4 + game.pet.talentLevel * 2;
  if (game.pet.talent === "fury") scores.offense += 2;
  if (game.pet.talent === "guardian") scores.defense += 2;
  if (game.pet.talent === "scout") scores.cycle += 2;
}

export function analyzeBuild(game) {
  const scores = { offense: 0, defense: 0, cycle: 0, pet: 0 };
  const counts = { attacks: 0, guards: 0, cycleCards: 0, petCards: 0, highCost: 0 };

  for (const card of game.deck) {
    const definition = cardDefinition(card);
    const effect = definition.effect;
    if (definition.type === "attack") {
      counts.attacks += 1;
      scores.pet += 0.55;
    }
    if (typeof definition.cost === "number" && definition.cost >= 2) counts.highCost += 1;
    if (effect.damage) scores.offense += 2 + Math.min(4, (effect.damage * (effect.hits || 1)) / 5);
    if (effect.attackBonus || effect.doubleNextAttack) scores.offense += 4;
    if (effect.block) {
      counts.guards += 1;
      scores.defense += 2 + Math.min(4, effect.block / 5);
    }
    if (effect.clearDistracted || effect.exhaustStatuses) scores.defense += 2;
    if (effect.draw || effect.nextDrawBonus || definition.cost === 0 || effect.discard) {
      counts.cycleCards += 1;
      scores.cycle += (effect.draw || 0) * 2 + (effect.nextDrawBonus || 0) * 1.5 + (definition.cost === 0 ? 1.5 : 0) + (effect.discard ? 1 : 0);
    }
    if (effect.petCharge) {
      counts.petCards += 1;
      scores.pet += 7 * effect.petCharge;
    }
  }

  addArchetypeBias(scores, game.archetypeId);
  addItemBias(scores, game);
  const ranking = Object.entries(scores).sort((left, right) => right[1] - left[1]);
  const [primaryId] = ranking[0];
  const total = Math.max(1, Object.values(scores).reduce((sum, score) => sum + score, 0));
  const tendencies = Object.fromEntries(Object.entries(scores).map(([id, score]) => [id, Math.round((score / total) * 100)]));

  let risk = "结构均衡";
  let suggestion = "继续拿能直接强化主流派的牌，避免为了稀有度让卡组变厚。";
  if (game.deck.length >= 16) {
    risk = "卡组偏厚";
    suggestion = "优先移除低贡献基础牌，让核心牌更常回到手里。";
  } else if (counts.guards < 4) {
    risk = "防御密度偏低";
    suggestion = "至少补到 4 张可靠防御牌，先覆盖敌人的公开攻击。";
  } else if (counts.attacks < 4) {
    risk = "收尾手段偏少";
    suggestion = "补一张稳定攻击牌，避免只防不赢导致敌人越拖越强。";
  } else if (game.deck.length >= 13 && counts.cycleCards < 2) {
    risk = "找牌速度偏慢";
    suggestion = "增加抽牌或筛选，让关键卡在需要的回合出现。";
  } else if (counts.highCost >= 4) {
    risk = "高费牌拥挤";
    suggestion = "每回合通常只有 3 能量，减少同时抽到多张高费牌的概率。";
  }

  return {
    primary: BUILD_STYLE_DEFS[primaryId],
    secondary: BUILD_STYLE_DEFS[ranking[1][0]],
    scores,
    tendencies,
    counts,
    risk,
    suggestion
  };
}
