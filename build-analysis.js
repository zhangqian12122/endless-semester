import { cardDefinition } from "./game-engine.js";

export const BUILD_STYLE_DEFS = {
  offense: { id: "offense", label: "爆发强攻", sign: "✦", text: "用攻击密度和伤害增幅尽快结束战斗。" },
  defense: { id: "defense", label: "稳固防守", sign: "◆", text: "先覆盖公开伤害，再用安全回合慢慢取胜。" },
  cycle: { id: "cycle", label: "高速循环", sign: "↻", text: "依靠零费、抽牌和筛选反复找到关键牌。" },
  pet: { id: "pet", label: "鹅鹅协同", sign: "鹅", text: "稳定充能，让宠物成为每场战斗的固定节奏点。" }
};

function emptyScores() {
  return { offense: 0, defense: 0, cycle: 0, pet: 0 };
}

function emptyCounts() {
  return { attacks: 0, guards: 0, cycleCards: 0, petCards: 0, highCost: 0 };
}

export function cardStyleContribution(card) {
  const instance = typeof card === "string" ? { id: card, upgraded: false, enchantment: null } : card;
  const definition = cardDefinition(instance);
  const effect = definition.effect;
  const scores = emptyScores();
  const counts = emptyCounts();
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
  return { scores, counts };
}

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
  const scores = emptyScores();
  const counts = emptyCounts();

  for (const card of game.deck) {
    const contribution = cardStyleContribution(card);
    for (const id of Object.keys(scores)) scores[id] += contribution.scores[id];
    for (const id of Object.keys(counts)) counts[id] += contribution.counts[id];
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

export function evaluateCardFit(game, card) {
  const analysis = analyzeBuild(game);
  const contribution = cardStyleContribution(card);
  const ranking = Object.entries(contribution.scores).sort((left, right) => right[1] - left[1]);
  const [cardStyleId, cardStyleScore] = ranking[0];
  const repairStyles = {
    "防御密度偏低": "defense",
    "收尾手段偏少": "offense",
    "找牌速度偏慢": "cycle",
    "高费牌拥挤": "cycle"
  };
  const repairStyle = repairStyles[analysis.risk];

  if (repairStyle && contribution.scores[repairStyle] >= 3) {
    return {
      id: "repair",
      label: "补足短板",
      grade: 4,
      style: BUILD_STYLE_DEFS[repairStyle],
      reason: `直接改善“${analysis.risk}”`
    };
  }
  if (contribution.scores[analysis.primary.id] >= 3) {
    return {
      id: "core",
      label: "核心契合",
      grade: 3,
      style: analysis.primary,
      reason: `继续强化${analysis.primary.label}`
    };
  }
  if (cardStyleScore >= 3) {
    return {
      id: "pivot",
      label: "转型组件",
      grade: 2,
      style: BUILD_STYLE_DEFS[cardStyleId],
      reason: `更偏向${BUILD_STYLE_DEFS[cardStyleId].label}`
    };
  }
  return {
    id: "neutral",
    label: "中性选择",
    grade: 1,
    style: BUILD_STYLE_DEFS[cardStyleId],
    reason: "与当前主流派联系较弱"
  };
}

export function choiceGuidance(game, cards) {
  const analysis = analyzeBuild(game);
  const fits = cards.map((card) => evaluateCardFit(game, card));
  const repairs = fits.filter((fit) => fit.id === "repair").length;
  const cores = fits.filter((fit) => fit.id === "core").length;
  if (repairs) return `当前短板是“${analysis.risk}”，本组有 ${repairs} 张牌能直接补足。`;
  if (cores) return `当前主流派是“${analysis.primary.label}”，本组有 ${cores} 张核心契合牌。`;
  if (game.deck.length >= 14) return `当前 ${game.deck.length} 张牌，候选牌都不直接补强主流派；跳过能保持抽牌稳定。`;
  return "本组没有直接补强项；可选择转型，也可以跳过等待更合适的牌。";
}

export function challengeRewardGuidance(game, availableItemCount = 0) {
  const analysis = analyzeBuild(game);
  const deckSize = game.deck.length;
  const itemCount = game.items.length;
  const freeItemSlots = Math.max(0, game.backpackCapacity - itemCount);
  const options = [];

  let cardScore = 40;
  let cardReason;
  if (deckSize <= 12) {
    cardScore += 18;
    cardReason = `卡组仅 ${deckSize} 张，仍适合补一张强化${analysis.primary.label}的专属牌。`;
  } else if (deckSize >= 16) {
    cardScore -= 18;
    cardReason = `卡组已有 ${deckSize} 张，继续加牌会降低核心牌回手频率。`;
  } else {
    cardReason = `卡组 ${deckSize} 张，可寻找${analysis.primary.label}组件，但要留意牌库厚度。`;
  }
  options.push({ id: "cards", score: cardScore, reason: cardReason });

  let petScore = 38;
  let petReason;
  const nextMilestone = !game.pet.talent ? 3 : game.pet.talentLevel < 2 ? 10 : game.pet.talentLevel < 3 ? 25 : null;
  const nextBond = game.pet.bond + 2;
  if (nextMilestone && game.pet.bond < nextMilestone && nextBond >= nextMilestone) {
    petScore += 24;
    const milestoneAction = !game.pet.talent ? "选择战斗路线" : game.pet.talentLevel < 2 ? "强化当前路线" : "精通当前路线";
    petReason = `羁绊 ${game.pet.bond} → ${nextBond}，会立刻到达 ${nextMilestone} 并${milestoneAction}。`;
  } else if (analysis.primary.id === "pet") {
    petScore += 25;
    petReason = `当前主流派是${analysis.primary.label}，羁绊 ${game.pet.bond} → ${nextBond} 能继续强化核心节奏。`;
  } else if (nextMilestone) {
    petReason = `羁绊 ${game.pet.bond} → ${nextBond}，距离 ${nextMilestone} 里程碑还 ${Math.max(0, nextMilestone - nextBond)}。`;
  } else {
    petScore -= 10;
    petReason = `宠物路线已经精通；羁绊仍会增加，但不会立即解锁新效果。`;
  }
  options.push({ id: "pet", score: petScore, reason: petReason });

  let itemScore;
  let itemReason;
  if (availableItemCount <= 0) {
    itemScore = 18;
    itemReason = "可收集物品已经拿齐，本路线会折算为 45 校园币。";
  } else if (freeItemSlots > 0) {
    itemScore = 42 + Math.min(12, freeItemSlots * 3) + (itemCount === 0 ? 8 : 0) - (availableItemCount === 1 ? 5 : 0);
    itemReason = `书包还有 ${freeItemSlots} 个空位，当前有 ${availableItemCount} 件未拥有物品可进入候选。`;
  } else {
    itemScore = 34;
    itemReason = `书包已满；仍有 ${availableItemCount} 件新物品，但拿取时必须替换旧物。`;
  }
  options.push({ id: "item", score: itemScore, reason: itemReason });

  const recommendedId = options.reduce((best, option) => option.score > best.score ? option : best).id;
  return {
    build: analysis.primary,
    recommendedId,
    options: Object.fromEntries(options.map((option) => [option.id, {
      ...option,
      recommended: option.id === recommendedId
    }]))
  };
}
