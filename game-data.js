export const RARITY_LABELS = {
  common: "普通",
  uncommon: "进阶",
  rare: "稀有",
  boss: "期末"
};

export const ARCHETYPE_DEFS = {
  aries: {
    id: "aries",
    sign: "♈",
    name: "白羊座·热血生",
    label: "先手爆发",
    text: "每场战斗第一张攻击牌，每段伤害 +2。",
    specialCard: "classSprint",
    specialCardLabel: "下课冲刺"
  },
  gemini: {
    id: "gemini",
    sign: "♊",
    name: "双子座·灵感生",
    label: "零费循环",
    text: "每场战斗第一次打出 0 费牌时，抽 1 张牌。",
    specialCard: "scratchPaper",
    specialCardLabel: "草稿纸"
  },
  cancer: {
    id: "cancer",
    sign: "♋",
    name: "巨蟹座·守护生",
    label: "稳定防守",
    text: "每场战斗开始时，获得 4 点护甲。",
    specialCard: "payAttention",
    specialCardLabel: "认真听讲"
  }
};

export const ENCHANTMENT_DEFS = {
  ariesFlame: {
    id: "ariesFlame",
    archetype: "aries",
    sign: "焰",
    name: "赤焰刻印",
    text: "此牌每段攻击伤害 +2。"
  },
  geminiQuick: {
    id: "geminiQuick",
    archetype: "gemini",
    sign: "瞬",
    name: "瞬思刻印",
    text: "此牌费用 -1，最低为 0。"
  },
  cancerGuard: {
    id: "cancerGuard",
    archetype: "cancer",
    sign: "守",
    name: "守护刻印",
    text: "此牌获得的基础护甲 +3。"
  }
};

export const PET_TALENT_DEFS = {
  fury: {
    id: "fury",
    icon: "凶",
    name: "奶凶路线",
    tagline: "简单直接，但不会无限膨胀",
    levels: [
      { damageBonus: 1, text: "重启猛啄额外造成 1 点伤害。" },
      { damageBonus: 2, text: "重启猛啄额外造成 2 点伤害。" },
      { damageBonus: 3, text: "重启猛啄额外造成 3 点伤害。" }
    ]
  },
  guardian: {
    id: "guardian",
    icon: "护",
    name: "护崽路线",
    tagline: "把宠物出手变成攻防一体",
    levels: [
      { block: 3, text: "重启猛啄后获得 3 点护甲。" },
      { block: 5, text: "重启猛啄后获得 5 点护甲。" },
      { block: 7, text: "重启猛啄后获得 7 点护甲。" }
    ]
  },
  scout: {
    id: "scout",
    icon: "叼",
    name: "叼笔记路线",
    tagline: "用一次出手换取更多构筑选择",
    levels: [
      { draw: 1, text: "重启猛啄后抽 1 张牌。" },
      { draw: 1, nextDrawBonus: 1, text: "重启猛啄后抽 1 张牌，下回合多抽 1 张。" },
      { draw: 2, nextDrawBonus: 1, text: "重启猛啄后抽 2 张牌，下回合多抽 1 张。" }
    ]
  },
  sleepyPounce: {
    id: "sleepyPounce",
    icon: "扑",
    name: "梦游猛扑",
    tagline: "睡眼惺忪，也能越扑越准",
    levels: [
      { damageBonus: 1, text: "蜷睡扑击额外造成 1 点伤害。" },
      { damageBonus: 2, text: "蜷睡扑击额外造成 2 点伤害。" },
      { damageBonus: 3, text: "蜷睡扑击额外造成 3 点伤害。" }
    ]
  },
  sleepyPillow: {
    id: "sleepyPillow",
    icon: "枕",
    name: "抱枕护体",
    tagline: "把蜷成一团的姿势变成额外防护",
    levels: [
      { block: 2, text: "蜷睡扑击额外获得 2 点护甲。" },
      { block: 4, text: "蜷睡扑击额外获得 4 点护甲。" },
      { block: 6, text: "蜷睡扑击额外获得 6 点护甲。" }
    ]
  },
  sleepyRhythm: {
    id: "sleepyRhythm",
    icon: "梦",
    name: "回笼节拍",
    tagline: "在半梦半醒之间整理下一步",
    levels: [
      { draw: 1, text: "蜷睡扑击后抽 1 张牌。" },
      { draw: 1, nextDrawBonus: 1, text: "蜷睡扑击后抽 1 张牌，下回合多抽 1 张。" },
      { draw: 2, nextDrawBonus: 1, text: "蜷睡扑击后抽 2 张牌，下回合多抽 1 张。" }
    ]
  }
};

export const DEFAULT_PET_ID = "offlineDuck";

export const PET_DEFS = Object.freeze({
  offlineDuck: Object.freeze({
    id: "offlineDuck",
    name: "宕机鸭",
    shortName: "鸭鸭",
    icon: "鸭",
    assets: Object.freeze({
      battle: "assets/characters/pet-offline-duck-battle-v1.webp",
      icon: "assets/characters/pet-offline-duck-icon-v1.webp"
    }),
    visual: "offlineDuck",
    maxCharge: 2,
    chargePerFirstAttack: 1,
    victoryBond: 1,
    bondMilestones: Object.freeze([3, 10, 25]),
    talentIds: Object.freeze(["fury", "guardian", "scout"]),
    skill: Object.freeze({
      id: "rebootPeck",
      name: "重启猛啄",
      baseDamage: 7,
      energyCost: 1,
      maxUsesPerCombat: 1
    })
  }),
  sleepyBugCub: Object.freeze({
    id: "sleepyBugCub",
    name: "困困虫幼崽",
    shortName: "小睡虫",
    icon: "眠",
    assets: Object.freeze({
      battle: null,
      icon: null
    }),
    visual: "sleepyBugCub",
    maxCharge: 3,
    chargePerFirstAttack: 1,
    victoryBond: 1,
    bondMilestones: Object.freeze([3, 10, 25]),
    talentIds: Object.freeze(["sleepyPounce", "sleepyPillow", "sleepyRhythm"]),
    skill: Object.freeze({
      id: "curledSleepPounce",
      name: "蜷睡扑击",
      baseDamage: 5,
      baseBlock: 3,
      energyCost: 1,
      maxUsesPerCombat: 1
    })
  })
});

export const PET_EGG_DEFS = Object.freeze({
  sleepyBugEgg: Object.freeze({
    id: "sleepyBugEgg",
    name: "困困虫蛋",
    petId: "sleepyBugCub",
    sourceEnemyIds: Object.freeze(["sleepyBug"]),
    requiredCombats: 3,
    assets: Object.freeze({
      egg: null
    })
  })
});

export const CARD_DEFS = {
  textbookStrike: {
    id: "textbookStrike", name: "课本拍击", type: "attack", rarity: "starter", cost: 1,
    text: "造成5点伤害。", upgradedText: "造成7点伤害。",
    effect: { damage: 5 }, upgradedEffect: { damage: 7 }
  },
  backpackGuard: {
    id: "backpackGuard", name: "书包护身", type: "skill", rarity: "starter", cost: 1,
    text: "获得5点护甲。", upgradedText: "获得7点护甲。",
    effect: { block: 5 }, upgradedEffect: { block: 7 }
  },
  cramming: {
    id: "cramming", name: "临时抱佛脚", type: "skill", rarity: "starter", cost: 0,
    text: "抽2张牌。下回合少抽1张。消耗。", upgradedText: "抽3张牌。下回合少抽1张。消耗。",
    effect: { draw: 2, nextDrawPenalty: 1, exhaust: true },
    upgradedEffect: { draw: 3, nextDrawPenalty: 1, exhaust: true }
  },
  payAttention: {
    id: "payAttention", name: "认真听讲", type: "skill", rarity: "starter", cost: 1,
    text: "获得4点护甲。下回合多抽1张。", upgradedText: "获得6点护甲。下回合多抽1张。",
    effect: { block: 4, nextDrawBonus: 1 }, upgradedEffect: { block: 6, nextDrawBonus: 1 }
  },
  catCombo: {
    id: "catCombo", name: "猫猫拳连打", type: "attack", rarity: "common", cost: 1,
    text: "造成3点伤害2次。", upgradedText: "造成4点伤害2次。",
    effect: { damage: 3, hits: 2 }, upgradedEffect: { damage: 4, hits: 2 }
  },
  classSprint: {
    id: "classSprint", name: "下课冲刺", type: "attack", rarity: "common", cost: 1,
    text: "造成6点伤害。敌人不攻击时改为9点。", upgradedText: "造成8点伤害。敌人不攻击时改为11点。",
    effect: { damage: 6, safeDamage: 9 }, upgradedEffect: { damage: 8, safeDamage: 11 }
  },
  stubborn: {
    id: "stubborn", name: "头铁", type: "attack", rarity: "uncommon", cost: 2,
    text: "造成12点伤害。自己失去2点生命。", upgradedText: "造成15点伤害。自己失去2点生命。",
    effect: { damage: 12, selfDamage: 2 }, upgradedEffect: { damage: 15, selfDamage: 2 }
  },
  lendAHand: {
    id: "lendAHand", name: "搭把手", type: "skill", rarity: "common", cost: 1,
    text: "造成3点伤害。获得3点护甲。", upgradedText: "造成4点伤害。获得4点护甲。",
    effect: { damage: 3, block: 3 }, upgradedEffect: { damage: 4, block: 4 }
  },
  holdOn: {
    id: "holdOn", name: "硬撑", type: "skill", rarity: "common", cost: 2,
    text: "获得11点护甲。", upgradedText: "获得14点护甲。",
    effect: { block: 11 }, upgradedEffect: { block: 14 }
  },
  airplaneMode: {
    id: "airplaneMode", name: "飞行模式", type: "skill", rarity: "common", cost: 1,
    text: "获得5点护甲。移除走神。", upgradedText: "获得7点护甲。移除走神。",
    effect: { block: 5, clearDistracted: true }, upgradedEffect: { block: 7, clearDistracted: true }
  },
  scratchPaper: {
    id: "scratchPaper", name: "草稿纸", type: "skill", rarity: "common", cost: 0,
    text: "抽1张牌，然后弃1张牌。", upgradedText: "抽2张牌，然后弃1张牌。",
    effect: { draw: 1, discard: 1 }, upgradedEffect: { draw: 2, discard: 1 }
  },
  borrowNotes: {
    id: "borrowNotes", name: "借笔记", type: "skill", rarity: "uncommon", cost: 1,
    text: "抽2张牌。", upgradedText: "抽3张牌。",
    effect: { draw: 2 }, upgradedEffect: { draw: 3 }
  },
  clearBacklog: {
    id: "clearBacklog", name: "清空待办", type: "skill", rarity: "uncommon", cost: 1,
    text: "获得3点护甲。消耗手中状态牌，每张再获得2点。",
    upgradedText: "获得5点护甲。消耗手中状态牌，每张再获得3点。",
    effect: { block: 3, exhaustStatuses: true, blockPerStatus: 2 },
    upgradedEffect: { block: 5, exhaustStatuses: true, blockPerStatus: 3 }
  },
  feedPet: {
    id: "feedPet", name: "投喂一下", type: "skill", rarity: "uncommon", cost: 0,
    text: "宠物获得1点充能。消耗。", upgradedText: "宠物获得1点充能。获得2点护甲。消耗。",
    effect: { petCharge: 1, exhaust: true }, upgradedEffect: { petCharge: 1, block: 2, exhaust: true }
  },
  getInZone: {
    id: "getInZone", name: "进入状态", type: "skill", rarity: "uncommon", cost: 1,
    text: "本场战斗攻击牌每段伤害+1。消耗。", upgradedText: "本场战斗攻击牌每段伤害+2。消耗。",
    effect: { attackBonus: 1, exhaust: true }, upgradedEffect: { attackBonus: 2, exhaust: true }
  },
  overthink: {
    id: "overthink", name: "情绪内耗", type: "skill", rarity: "rare", cost: 1,
    text: "下一张攻击牌的攻击触发两次。回合结束失去4点生命。消耗。",
    upgradedText: "下一张攻击牌的攻击触发两次。回合结束失去2点生命。消耗。",
    effect: { doubleNextAttack: true, endTurnHpLoss: 4, exhaust: true },
    upgradedEffect: { doubleNextAttack: true, endTurnHpLoss: 2, exhaust: true }
  },
  ariesRush: {
    id: "ariesRush", name: "先冲再说", type: "attack", rarity: "common", archetype: "aries", cost: 1,
    text: "造成7点伤害。", upgradedText: "造成9点伤害。",
    effect: { damage: 7 }, upgradedEffect: { damage: 9 }
  },
  ariesRebound: {
    id: "ariesRebound", name: "不服再来", type: "attack", rarity: "uncommon", archetype: "aries", cost: 0,
    text: "造成4点伤害。自己失去2点生命。消耗。", upgradedText: "造成6点伤害。自己失去1点生命。消耗。",
    effect: { damage: 4, selfDamage: 2, exhaust: true }, upgradedEffect: { damage: 6, selfDamage: 1, exhaust: true }
  },
  ariesHeat: {
    id: "ariesHeat", name: "热血沸腾", type: "skill", rarity: "uncommon", archetype: "aries", cost: 1,
    text: "本场战斗攻击牌每段伤害+1。消耗。", upgradedText: "本场战斗攻击牌每段伤害+2。消耗。",
    effect: { attackBonus: 1, exhaust: true }, upgradedEffect: { attackBonus: 2, exhaust: true }
  },
  ariesUproar: {
    id: "ariesUproar", name: "全场起立", type: "attack", rarity: "rare", archetype: "aries", cost: 2,
    text: "造成9点伤害2次。自己失去3点生命。", upgradedText: "造成11点伤害2次。自己失去2点生命。",
    effect: { damage: 9, hits: 2, selfDamage: 3 }, upgradedEffect: { damage: 11, hits: 2, selfDamage: 2 }
  },
  geminiSwitch: {
    id: "geminiSwitch", name: "秒切桌面", type: "skill", rarity: "common", archetype: "gemini", cost: 0,
    text: "抽1张牌，然后弃1张牌。", upgradedText: "抽2张牌，然后弃1张牌。",
    effect: { draw: 1, discard: 1 }, upgradedEffect: { draw: 2, discard: 1 }
  },
  geminiJuggle: {
    id: "geminiJuggle", name: "左右横跳", type: "skill", rarity: "common", archetype: "gemini", cost: 1,
    text: "造成4点伤害。获得4点护甲。", upgradedText: "造成6点伤害。获得6点护甲。",
    effect: { damage: 4, block: 4 }, upgradedEffect: { damage: 6, block: 6 }
  },
  geminiEcho: {
    id: "geminiEcho", name: "灵感复制", type: "skill", rarity: "uncommon", archetype: "gemini", cost: 1,
    text: "下一张攻击牌触发两次。消耗。", upgradedText: "抽1张牌。下一张攻击牌触发两次。消耗。",
    effect: { doubleNextAttack: true, exhaust: true }, upgradedEffect: { draw: 1, doubleNextAttack: true, exhaust: true }
  },
  geminiDeadline: {
    id: "geminiDeadline", name: "截止前一分钟", type: "skill", rarity: "rare", archetype: "gemini", cost: 0,
    text: "抽3张牌。下回合少抽2张。消耗。", upgradedText: "抽4张牌。下回合少抽2张。消耗。",
    effect: { draw: 3, nextDrawPenalty: 2, exhaust: true }, upgradedEffect: { draw: 4, nextDrawPenalty: 2, exhaust: true }
  },
  cancerHuddle: {
    id: "cancerHuddle", name: "抱团取暖", type: "skill", rarity: "common", archetype: "cancer", cost: 1,
    text: "获得8点护甲。", upgradedText: "获得11点护甲。",
    effect: { block: 8 }, upgradedEffect: { block: 11 }
  },
  cancerCover: {
    id: "cancerCover", name: "我来兜底", type: "skill", rarity: "common", archetype: "cancer", cost: 1,
    text: "获得5点护甲。下回合多抽1张。", upgradedText: "获得8点护甲。下回合多抽1张。",
    effect: { block: 5, nextDrawBonus: 1 }, upgradedEffect: { block: 8, nextDrawBonus: 1 }
  },
  cancerSteady: {
    id: "cancerSteady", name: "慢慢来", type: "skill", rarity: "uncommon", archetype: "cancer", cost: 2,
    text: "获得14点护甲。移除走神。", upgradedText: "获得18点护甲。移除走神。",
    effect: { block: 14, clearDistracted: true }, upgradedEffect: { block: 18, clearDistracted: true }
  },
  cancerSafe: {
    id: "cancerSafe", name: "安全感拉满", type: "skill", rarity: "rare", archetype: "cancer", cost: 1,
    text: "获得10点护甲。抽1张牌。消耗。", upgradedText: "获得13点护甲。抽1张牌。消耗。",
    effect: { block: 10, draw: 1, exhaust: true }, upgradedEffect: { block: 13, draw: 1, exhaust: true }
  },
  todo: {
    id: "todo", name: "待办", type: "status", rarity: "status", cost: 1,
    text: "获得2点护甲。消耗。", upgradedText: "获得2点护甲。消耗。",
    effect: { block: 2, exhaust: true }, upgradedEffect: { block: 2, exhaust: true }
  },
  nervous: {
    id: "nervous", name: "紧张", type: "status", rarity: "status", cost: null,
    text: "无法打出。回合结束时消耗。", upgradedText: "无法打出。回合结束时消耗。",
    effect: { unplayable: true, exhaustAtEnd: true }, upgradedEffect: { unplayable: true, exhaustAtEnd: true }
  }
};

// Card art is deliberately data-driven so the graybox compositions can later
// be replaced by approved raster artwork without touching combat rules.
export const CARD_ART_DEFS = {
  textbookStrike: {
    symbol: "啪",
    caption: "知识重击",
    motif: "impact",
    image: "assets/cards/textbook-strike-v1.webp",
    focus: "55% 58%"
  },
  backpackGuard: {
    symbol: "盾",
    caption: "书包防线",
    motif: "guard",
    image: "assets/cards/backpack-guard-v2.webp",
    focus: "60% 52%",
    tone: "saturate(.9) contrast(1) brightness(1.16)",
    hoverTone: "saturate(.98) contrast(1.04) brightness(1.23)"
  },
  cramming: {
    symbol: "速",
    caption: "临时冲刺",
    motif: "notes",
    image: "assets/cards/cramming-v1.webp",
    focus: "50% 56%",
    tone: "saturate(.9) contrast(1) brightness(1.12)",
    hoverTone: "saturate(.98) contrast(1.04) brightness(1.2)"
  },
  payAttention: {
    symbol: "记",
    caption: "认真听讲",
    motif: "focus",
    image: "assets/cards/pay-attention-v1.webp",
    focus: "55% 54%",
    tone: "saturate(.88) contrast(.99) brightness(1.14)",
    hoverTone: "saturate(.96) contrast(1.03) brightness(1.2)"
  },
  catCombo: {
    symbol: "喵",
    caption: "连续猫拳",
    motif: "combo",
    image: "assets/cards/cat-combo-v1.webp",
    focus: "50% 50%",
    tone: "saturate(.94) contrast(1.02) brightness(1.1)",
    hoverTone: "saturate(1.02) contrast(1.06) brightness(1.18)"
  },
  classSprint: {
    symbol: "冲",
    caption: "下课铃响",
    motif: "speed",
    image: "assets/cards/class-sprint-v1.webp",
    focus: "45% 55%",
    tone: "saturate(.93) contrast(1) brightness(1.12)",
    hoverTone: "saturate(1) contrast(1.04) brightness(1.2)"
  },
  stubborn: {
    symbol: "撞",
    caption: "头铁到底",
    motif: "impact",
    image: "assets/cards/stubborn-v1.webp",
    focus: "58% 54%",
    tone: "saturate(.92) contrast(1.02) brightness(1.1)",
    hoverTone: "saturate(1) contrast(1.06) brightness(1.18)"
  },
  lendAHand: {
    symbol: "搭",
    caption: "攻守兼备",
    motif: "balance",
    image: "assets/cards/lend-a-hand-v1.webp",
    focus: "55% 54%",
    tone: "saturate(.9) contrast(1) brightness(1.12)",
    hoverTone: "saturate(.98) contrast(1.04) brightness(1.2)"
  },
  holdOn: {
    symbol: "撑",
    caption: "咬牙扛住",
    motif: "guard",
    image: "assets/cards/hold-on-v1.webp",
    focus: "54% 52%",
    tone: "saturate(.9) contrast(1.02) brightness(1.1)",
    hoverTone: "saturate(.98) contrast(1.06) brightness(1.18)"
  },
  airplaneMode: {
    symbol: "静",
    caption: "断开干扰",
    motif: "focus",
    image: "assets/cards/airplane-mode-v1.webp",
    focus: "50% 55%",
    tone: "saturate(.86) contrast(1) brightness(1.12)",
    hoverTone: "saturate(.94) contrast(1.04) brightness(1.2)"
  },
  scratchPaper: {
    symbol: "草",
    caption: "灵感草稿",
    motif: "notes",
    image: "assets/cards/scratch-paper-v1.webp",
    focus: "50% 54%",
    tone: "saturate(.86) contrast(1) brightness(1.14)",
    hoverTone: "saturate(.94) contrast(1.04) brightness(1.22)"
  },
  borrowNotes: {
    symbol: "借",
    caption: "共享笔记",
    motif: "notes",
    image: "assets/cards/borrow-notes-v1.webp",
    focus: "52% 50%",
    tone: "saturate(.86) contrast(1) brightness(1.14)",
    hoverTone: "saturate(.94) contrast(1.04) brightness(1.22)"
  },
  clearBacklog: {
    symbol: "清",
    caption: "待办归零",
    motif: "clean",
    image: "assets/cards/clear-backlog-v1.webp",
    focus: "50% 54%",
    tone: "saturate(.86) contrast(1.02) brightness(1.12)",
    hoverTone: "saturate(.94) contrast(1.06) brightness(1.2)"
  },
  feedPet: {
    symbol: "粮",
    caption: "鸭鸭加餐",
    motif: "goose",
    image: "assets/cards/feed-pet-duck-v1.webp",
    focus: "52% 50%",
    tone: "saturate(.92) contrast(1) brightness(1.1)",
    hoverTone: "saturate(1) contrast(1.04) brightness(1.18)"
  },
  getInZone: {
    symbol: "燃", caption: "进入状态", motif: "power",
    image: "assets/cards/get-in-zone-v1.webp", focus: "52% 55%",
    tone: "saturate(.92) contrast(1.02) brightness(1.1)",
    hoverTone: "saturate(1) contrast(1.06) brightness(1.18)"
  },
  overthink: {
    symbol: "想", caption: "情绪内耗", motif: "void",
    image: "assets/cards/overthink-v1.webp", focus: "50% 50%",
    tone: "saturate(.88) contrast(1.02) brightness(1.1)",
    hoverTone: "saturate(.96) contrast(1.06) brightness(1.18)"
  },
  ariesRush: {
    symbol: "冲", caption: "白羊先手", motif: "aries",
    image: "assets/cards/aries-rush-v1.webp", focus: "55% 55%",
    tone: "saturate(.94) contrast(1.02) brightness(1.1)",
    hoverTone: "saturate(1.02) contrast(1.06) brightness(1.18)"
  },
  ariesRebound: {
    symbol: "再", caption: "不服再来", motif: "aries",
    image: "assets/cards/aries-rebound-v1.webp", focus: "48% 52%",
    tone: "saturate(.94) contrast(1.02) brightness(1.1)",
    hoverTone: "saturate(1.02) contrast(1.06) brightness(1.18)"
  },
  ariesHeat: {
    symbol: "热", caption: "热血沸腾", motif: "aries",
    image: "assets/cards/aries-heat-v1.webp", focus: "50% 52%",
    tone: "saturate(.94) contrast(1.02) brightness(1.1)",
    hoverTone: "saturate(1.02) contrast(1.06) brightness(1.18)"
  },
  ariesUproar: {
    symbol: "燃", caption: "全场起立", motif: "aries",
    image: "assets/cards/aries-uproar-v1.webp", focus: "50% 50%",
    tone: "saturate(.94) contrast(1.04) brightness(1.08)",
    hoverTone: "saturate(1.02) contrast(1.08) brightness(1.16)"
  },
  geminiSwitch: {
    symbol: "切", caption: "秒切桌面", motif: "gemini",
    image: "assets/cards/gemini-switch-v1.webp", focus: "50% 54%",
    tone: "saturate(.88) contrast(1.02) brightness(1.12)",
    hoverTone: "saturate(.96) contrast(1.06) brightness(1.2)"
  },
  geminiJuggle: {
    symbol: "↔", caption: "左右横跳", motif: "gemini",
    image: "assets/cards/gemini-juggle-v1.webp", focus: "50% 50%",
    tone: "saturate(.9) contrast(1.02) brightness(1.1)",
    hoverTone: "saturate(.98) contrast(1.06) brightness(1.18)"
  },
  geminiEcho: {
    symbol: "双", caption: "灵感复制", motif: "gemini",
    image: "assets/cards/gemini-echo-v1.webp", focus: "50% 50%",
    tone: "saturate(.9) contrast(1.02) brightness(1.1)",
    hoverTone: "saturate(.98) contrast(1.06) brightness(1.18)"
  },
  geminiDeadline: {
    symbol: "1′", caption: "截止冲刺", motif: "gemini",
    image: "assets/cards/gemini-deadline-v1.webp", focus: "50% 54%",
    tone: "saturate(.9) contrast(1.02) brightness(1.12)",
    hoverTone: "saturate(.98) contrast(1.06) brightness(1.2)"
  },
  cancerHuddle: {
    symbol: "抱", caption: "抱团取暖", motif: "cancer",
    image: "assets/cards/cancer-huddle-v1.webp", focus: "50% 52%",
    tone: "saturate(.86) contrast(1.02) brightness(1.12)",
    hoverTone: "saturate(.94) contrast(1.06) brightness(1.2)"
  },
  cancerCover: {
    symbol: "兜", caption: "我来兜底", motif: "cancer",
    image: "assets/cards/cancer-cover-v1.webp", focus: "53% 54%",
    tone: "saturate(.86) contrast(1.02) brightness(1.12)",
    hoverTone: "saturate(.94) contrast(1.06) brightness(1.2)"
  },
  cancerSteady: {
    symbol: "稳", caption: "慢慢来", motif: "cancer",
    image: "assets/cards/cancer-steady-v1.webp", focus: "50% 52%",
    tone: "saturate(.84) contrast(1.02) brightness(1.12)",
    hoverTone: "saturate(.92) contrast(1.06) brightness(1.2)"
  },
  cancerSafe: {
    symbol: "安", caption: "安全感拉满", motif: "cancer",
    image: "assets/cards/cancer-safe-v1.webp", focus: "55% 52%",
    tone: "saturate(.88) contrast(1.04) brightness(1.1)",
    hoverTone: "saturate(.96) contrast(1.08) brightness(1.18)"
  },
  todo: {
    symbol: "未", caption: "待办堆积", motif: "status",
    image: "assets/cards/todo-v1.webp", focus: "50% 54%",
    tone: "saturate(.72) contrast(1.04) brightness(1.08)",
    hoverTone: "saturate(.8) contrast(1.08) brightness(1.16)"
  },
  nervous: {
    symbol: "!", caption: "紧张上头", motif: "status",
    image: "assets/cards/nervous-v1.webp", focus: "50% 50%",
    tone: "saturate(.78) contrast(1.04) brightness(1.08)",
    hoverTone: "saturate(.86) contrast(1.08) brightness(1.16)"
  }
};

export const PUBLIC_REWARD_CARD_IDS = [
  "catCombo", "classSprint", "stubborn", "lendAHand", "holdOn", "airplaneMode",
  "scratchPaper", "borrowNotes", "clearBacklog", "feedPet", "getInZone", "overthink"
];

export const ARCHETYPE_CARD_IDS = {
  aries: ["ariesRush", "ariesRebound", "ariesHeat", "ariesUproar"],
  gemini: ["geminiSwitch", "geminiJuggle", "geminiEcho", "geminiDeadline"],
  cancer: ["cancerHuddle", "cancerCover", "cancerSteady", "cancerSafe"]
};

export const REWARD_CARD_IDS = [
  ...PUBLIC_REWARD_CARD_IDS,
  ...Object.values(ARCHETYPE_CARD_IDS).flat()
];

export const ITEM_DEFS = {
  autoPencil: { id: "autoPencil", name: "自动铅笔", rarity: "common", timing: "每回合 1 次", art: "assets/items/auto-pencil-v1.webp", text: "每回合第一张攻击牌，每段伤害+1。" },
  thickNotebook: { id: "thickNotebook", name: "厚笔记本", rarity: "common", timing: "每回合 1 次", art: "assets/items/thick-notebook-v1.webp", text: "每回合第一次用牌获得护甲时，额外获得2点。" },
  studentId: { id: "studentId", name: "学生证", rarity: "common", timing: "商店常驻", art: "assets/items/student-id-v1.webp", text: "商店卡牌、物品和删牌价格降低10%。" },
  mistakeBook: { id: "mistakeBook", name: "错题本", rarity: "uncommon", timing: "每场 1 次", art: "assets/items/mistake-book-v1.webp", text: "每场第一次受到敌人未格挡伤害后，下回合多抽1张。" },
  earplugs: { id: "earplugs", name: "耳塞", rarity: "uncommon", timing: "每场 1 次", art: "assets/items/earplugs-v1.webp", text: "每场抵挡敌人施加的第一次走神。" },
  bandage: { id: "bandage", name: "创可贴", rarity: "common", timing: "入场触发", art: "assets/items/bandage-v1.webp", text: "半血以下进入战斗时，获得6点护甲。" },
  petSnack: { id: "petSnack", name: "宠物零食", rarity: "rare", timing: "每场入场", art: "assets/items/pet-snack-v1.webp", text: "每场战斗开始时，宠物获得1点充能。" },
  eraser: { id: "eraser", name: "橡皮擦", rarity: "uncommon", timing: "每学期 1 次", art: "assets/items/eraser-v1.webp", text: "每学期一次，刷新战后的卡牌奖励。" },
  allNighter: { id: "allNighter", name: "通宵复习计划", rarity: "boss", timing: "每回合 / 每场", art: "assets/items/all-nighter-v1.webp", text: "每回合+1能量；每场开始洗入2张紧张。" },
  referenceBooks: { id: "referenceBooks", name: "全套参考书", rarity: "boss", timing: "每回合 / 首回合", art: "assets/items/reference-books-v1.webp", text: "每回合多抽1张；每场第一回合少1能量。" }
};

export const REGULAR_ITEM_IDS = [
  "autoPencil", "thickNotebook", "studentId", "mistakeBook",
  "earplugs", "bandage", "petSnack", "eraser"
];
export const BOSS_ITEM_IDS = ["allNighter", "referenceBooks"];

export const ENEMY_DEFS = {
  sleepyBug: {
    id: "sleepyBug", name: "瞌睡虫", maxHp: 20, kind: "normal",
    subtitle: "一边犯困，一边缓慢挥爪。",
    mechanicName: "张弛节拍",
    mechanicText: "两次攻击之间会蜷起防御，惊醒时再打出更高伤害。",
    pattern: "攻击 5 → 护甲 5 → 攻击 7",
    tip: "它蜷起来时不会攻击，适合补状态；惊醒前至少准备 7 点护甲。",
    intents: [
      { name: "迷糊拍击", attack: 5 },
      { name: "蜷成一团", block: 5 },
      { name: "突然惊醒", attack: 7 }
    ]
  },
  homeworkBlob: {
    id: "homeworkBlob", name: "作业团", maxHp: 24, kind: "normal",
    subtitle: "越拖越多，但完成一点也有回报。",
    mechanicName: "待办污染",
    mechanicText: "低伤拍击会把待办塞进弃牌堆，拖延会持续降低抽牌质量。",
    pattern: "攻击 3 并塞待办 → 攻击 7 → 护甲 6",
    tip: "待办会污染后续抽牌。尽快结束战斗，或用能消耗状态牌的卡清理。",
    intents: [
      { name: "追加待办", attack: 3, addStatus: { id: "todo", count: 1, zone: "discard" } },
      { name: "催交", attack: 7 },
      { name: "堆成高墙", block: 6 }
    ]
  },
  alarmClock: {
    id: "alarmClock", name: "闹钟怪", maxHp: 28, kind: "normal",
    subtitle: "你清楚知道它什么时候会响。",
    mechanicName: "公开倒计时",
    mechanicText: "先蓄响防御，再连续攻击并在第三次行动打出 14 点爆发。",
    pattern: "护甲 5 → 攻击 7 → 攻击 14",
    tip: "前两步是明确倒计时。不要把所有防御牌花在蓄响回合。",
    intents: [
      { name: "蓄响", block: 5 },
      { name: "铃声", attack: 7 },
      { name: "夺命连环响", attack: 14 }
    ]
  },
  phoneSpirit: {
    id: "phoneSpirit", name: "手机精", maxHp: 22, kind: "normal",
    subtitle: "只看一眼，注意力就被吸走。",
    mechanicName: "分心护屏",
    mechanicText: "发动带走神的推送行动时同步获得护甲 4 或 3，逼你错开爆发回合。",
    pattern: "护甲 4 并施加走神 → 攻击 8 → 攻击 5、护甲 3 并走神",
    tip: "走神让攻击每段 -2，它还会在走神回合护屏。先防御，等状态消失再爆发。",
    intents: [
      { name: "推送轰炸", block: 4, debuff: "distracted" },
      { name: "震动撞击", attack: 8 },
      { name: "边刷边撞", attack: 5, block: 3, debuff: "distracted" }
    ]
  },
  groupChat: {
    id: "groupChat", name: "群聊99+", maxHp: 26, kind: "normal",
    subtitle: "你不回复，它也会自己越聊越多。",
    mechanicName: "未读压力",
    mechanicText: "战斗区每有 1 张紧张，消息轰炸就多攻击 1 段，最多额外 2 段；清理紧张会立刻降压。",
    pattern: "攻击 3×(2+未读压力，最多 4 段) → 塞入 1 张紧张 → 攻击 5 并塞紧张",
    tip: "它会先制造紧张，再借未读压力刷屏。轰炸前把手中的紧张消耗掉，可以立即减少攻击段数。",
    intents: [
      {
        name: "消息轰炸", attack: 3, hits: 2,
        scaling: { type: "statusHits", statusId: "nervous", maxBonus: 2, label: "未读" }
      },
      { name: "疯狂艾特", addStatus: { id: "nervous", count: 1, zone: "discard" } },
      { name: "催你回复", attack: 5, addStatus: { id: "nervous", count: 1, zone: "discard" } }
    ]
  },
  printerJam: {
    id: "printerJam", name: "卡纸打印机", maxHp: 32, kind: "normal",
    subtitle: "越着急，它越能吐出一叠没用的纸。",
    mechanicName: "卡纸蓄压",
    mechanicText: "剩余护甲会转为等量重击伤害，最多加 6；6 点以上的护甲不会继续增伤，压到 5 点或更少才会逐点降伤。",
    pattern: "护甲 8 并塞待办 → 重击 6+剩余护甲（最多 +6） → 攻击 4×2",
    tip: "先打掉超出 6 点的护甲；压到 5 点或更少后，每少 1 甲，重击少 1 伤害，打穿则解除全部蓄压。",
    intents: [
      { name: "疯狂卡纸", block: 8, addStatus: { id: "todo", count: 1, zone: "discard" } },
      {
        name: "蓄压出纸", attack: 6,
        scaling: { type: "enemyBlockAttack", maxBonus: 6, label: "蓄压" }
      },
      { name: "双面打印", attack: 4, hits: 2 }
    ]
  },
  rivalShadow: {
    id: "rivalShadow", name: "卷王幻影", maxHp: 48, kind: "elite",
    subtitle: "每拖一个回合，它都比刚才更强。",
    mechanicName: "无休加速",
    mechanicText: "每次行动都攻击；首次基础伤害为 6，之后每次都比上一次加 2，没有防御或休息回合。",
    pattern: "连续攻击 6 → 8 → 10 → …（每次 +2，无休息）",
    tip: "它没有休息回合。精简卡组、持续输出比等待完美手牌更重要。",
    intentAt(turn) {
      return { name: `加速内卷 · 第${turn + 1}次`, attack: 6 + turn * 2 };
    }
  },
  finalExam: {
    id: "finalExam", name: "期末考试", maxHp: 90, kind: "boss",
    subtitle: "题目完全公开，但时间不会等你。",
    mechanicName: "四步递增",
    mechanicText: "每 4 次行动固定轮转发卷、选择题、填空题、大题；每完成一轮，下一次大题基础伤害加 2。",
    pattern: "塞入 2 张紧张 → 攻击 8 → 攻击 10 并护甲 8 → 大题 16（每轮 +2）",
    tip: "四回合为一轮。发卷回合整理手牌，大题前保存高额防御。",
    intentAt(turn) {
      const step = turn % 4;
      const cycle = Math.floor(turn / 4);
      const roundLabel = `第${cycle + 1}轮`;
      if (step === 0) return { name: `发卷 · ${roundLabel}`, addStatus: { id: "nervous", count: 2, zone: "draw" } };
      if (step === 1) return { name: `选择题 · ${roundLabel}`, attack: 8 };
      if (step === 2) return { name: `填空题 · ${roundLabel}`, attack: 10, block: 8 };
      return { name: `大题 · ${roundLabel}`, attack: 16 + cycle * 2 };
    }
  }
};

export const NORMAL_ENEMY_IDS = Object.freeze([
  "sleepyBug", "homeworkBlob", "alarmClock", "phoneSpirit", "groupChat", "printerJam"
]);

export const FIRST_SEMESTER_NORMAL_ENEMY_POOLS = Object.freeze([
  Object.freeze({
    id: "foundation",
    startWeek: 1,
    endWeek: 5,
    enemyIds: Object.freeze(["sleepyBug", "alarmClock"])
  }),
  Object.freeze({
    id: "status",
    startWeek: 6,
    endWeek: 10,
    enemyIds: Object.freeze(["sleepyBug", "alarmClock", "homeworkBlob", "phoneSpirit"])
  }),
  Object.freeze({
    id: "full",
    startWeek: 11,
    endWeek: 16,
    enemyIds: NORMAL_ENEMY_IDS
  })
]);

export const ACHIEVEMENT_DEFS = {
  firstWin: { id: "firstWin", icon: "✓", name: "顺利下课", text: "赢得第一场战斗。", metric: "combatsWon", target: 1 },
  cleanWin: { id: "cleanWin", icon: "♥", name: "一滴没掉", text: "无伤赢得一场战斗。", metric: "cleanWins", target: 1 },
  quickWin: { id: "quickWin", icon: "3", name: "三回合下课", text: "在 3 回合内赢得一场战斗。", metric: "quickWins", target: 1 },
  gooseCall: { id: "gooseCall", icon: "伴", name: "伙伴来！", text: "累计让任意宠物出手 5 次。", metric: "petUses", target: 5 },
  campusArchive: { id: "campusArchive", icon: "?", name: "怪事见多了", text: "发现任意 4 种普通敌人。", metric: "normalEnemies", target: 4 },
  challengeWon: { id: "challengeWon", icon: "难", name: "主动加练", text: "赢得一次可选挑战战。", metric: "challengeWins", target: 1 },
  firstTrial: { id: "firstTrial", icon: "印", name: "试炼盖章", text: "完成任意一次星座试炼。", metric: "trialCompletions", target: 1 },
  allTrials: { id: "allTrials", icon: "星", name: "三星连珠", text: "分别完成白羊、双子与巨蟹的星座试炼。", metric: "trialSigns", target: 3 },
  midtermPass: { id: "midtermPass", icon: "中", name: "期中不挂科", text: "击败一次精英敌人。", metric: "eliteWins", target: 1 },
  finalSubmitted: { id: "finalSubmitted", icon: "末", name: "期末交卷", text: "击败一次期末考试。", metric: "bossWins", target: 1 },
  cardRiver: { id: "cardRiver", icon: "∞", name: "出牌如流水", text: "生涯累计打出 100 张牌。", metric: "cardsPlayed", target: 100 }
};

export const EVENT_DEFS = {
  hallwayBox: { id: "hallwayBox", name: "走廊纸箱", text: "纸箱里传来窸窸窣窣的声音。", safe: false },
  popQuiz: { id: "popQuiz", name: "突击测验", text: "老师突然把试卷拍在桌上。", safe: false },
  clubRecruitment: { id: "clubRecruitment", name: "社团招新", text: "三个社团同时向你递来传单。", safe: true },
  mealCard: { id: "mealCard", name: "捡到饭卡", text: "余额还不少，宠物也盯着它看。", safe: true },
  campusRumor: { id: "campusRumor", name: "校园怪谈", text: "废弃教室里传出了奇怪的响声。", safe: false },
  oldLocker: { id: "oldLocker", name: "旧储物柜", text: "柜门锈住了，里面似乎还有东西。", safe: true }
};

export const SAFE_EVENT_IDS = Object.values(EVENT_DEFS).filter((event) => event.safe).map((event) => event.id);
export const ALL_EVENT_IDS = Object.keys(EVENT_DEFS);
