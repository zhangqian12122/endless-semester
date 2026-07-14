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
  autoPencil: { id: "autoPencil", name: "自动铅笔", rarity: "common", text: "每回合第一张攻击牌，每段伤害+1。" },
  thickNotebook: { id: "thickNotebook", name: "厚笔记本", rarity: "common", text: "每回合第一次用牌获得护甲时，额外获得2点。" },
  studentId: { id: "studentId", name: "学生证", rarity: "common", text: "商店价格降低10%。" },
  mistakeBook: { id: "mistakeBook", name: "错题本", rarity: "uncommon", text: "每场第一次受到敌人未格挡伤害后，下回合多抽1张。" },
  earplugs: { id: "earplugs", name: "耳塞", rarity: "uncommon", text: "每场抵挡敌人施加的第一个负面效果。" },
  bandage: { id: "bandage", name: "创可贴", rarity: "common", text: "半血以下进入战斗时，获得6点护甲。" },
  petSnack: { id: "petSnack", name: "宠物零食", rarity: "rare", text: "每场战斗开始时，宠物获得1点充能。" },
  eraser: { id: "eraser", name: "橡皮擦", rarity: "uncommon", text: "每学期一次，刷新战后的卡牌奖励。" },
  allNighter: { id: "allNighter", name: "通宵复习计划", rarity: "boss", text: "每回合+1能量；每场开始洗入2张紧张。" },
  referenceBooks: { id: "referenceBooks", name: "全套参考书", rarity: "boss", text: "每回合多抽1张；每场第一回合少1能量。" }
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
    intents: [
      { name: "迷糊拍击", attack: 5 },
      { name: "蜷成一团", block: 5 },
      { name: "突然惊醒", attack: 7 }
    ]
  },
  homeworkBlob: {
    id: "homeworkBlob", name: "作业团", maxHp: 24, kind: "normal",
    subtitle: "越拖越多，但完成一点也有回报。",
    intents: [
      { name: "追加待办", attack: 3, addStatus: { id: "todo", count: 1, zone: "discard" } },
      { name: "催交", attack: 7 },
      { name: "堆成高墙", block: 6 }
    ]
  },
  alarmClock: {
    id: "alarmClock", name: "闹钟怪", maxHp: 28, kind: "normal",
    subtitle: "你清楚知道它什么时候会响。",
    intents: [
      { name: "蓄响", block: 5 },
      { name: "铃声", attack: 7 },
      { name: "夺命连环响", attack: 14 }
    ]
  },
  phoneSpirit: {
    id: "phoneSpirit", name: "手机精", maxHp: 22, kind: "normal",
    subtitle: "只看一眼，注意力就被吸走。",
    intents: [
      { name: "推送轰炸", debuff: "distracted" },
      { name: "震动撞击", attack: 8 },
      { name: "边刷边撞", attack: 5, debuff: "distracted" }
    ]
  },
  rivalShadow: {
    id: "rivalShadow", name: "卷王幻影", maxHp: 48, kind: "elite",
    subtitle: "每拖一个回合，它都比刚才更强。",
    intentAt(turn) {
      return { name: "加速内卷", attack: 6 + turn * 2 };
    }
  },
  finalExam: {
    id: "finalExam", name: "期末考试", maxHp: 90, kind: "boss",
    subtitle: "题目完全公开，但时间不会等你。",
    intentAt(turn) {
      const step = turn % 4;
      const cycle = Math.floor(turn / 4);
      if (step === 0) return { name: "发卷", addStatus: { id: "nervous", count: 2, zone: "draw" } };
      if (step === 1) return { name: "选择题", attack: 8 };
      if (step === 2) return { name: "填空题", attack: 10, block: 8 };
      return { name: "大题", attack: 16 + cycle * 2 };
    }
  }
};

export const NORMAL_ENEMY_IDS = ["sleepyBug", "homeworkBlob", "alarmClock", "phoneSpirit"];

export const WEEK_PLAN = {
  1: [{ type: "combat", enemy: "sleepyBug", label: "教学战：瞌睡虫" }],
  2: [{ type: "combat", enemy: "homeworkBlob", label: "宠物教学：作业团" }],
  3: [{ type: "event", pool: "safe", label: "？ 低风险校园事件" }],
  4: [{ type: "combat", enemy: "phoneSpirit", label: "普通战斗：手机精" }],
  5: [{ type: "rest", label: "休息节点" }],
  6: [
    { type: "combat", enemy: "alarmClock", label: "普通战斗：闹钟怪" },
    { type: "event", pool: "all", label: "？ 未知事件" }
  ],
  7: [
    { type: "shop", label: "校园商店" },
    { type: "combat", enemy: "sleepyBug", label: "普通战斗：瞌睡虫" }
  ],
  8: [{ type: "combat", enemy: "rivalShadow", label: "期中精英：卷王幻影" }],
  9: [{ type: "rest", label: "休息节点" }],
  10: [{ type: "event", pool: "all", label: "？ 未知事件" }],
  11: [{ type: "combat", enemy: "random", label: "普通战斗" }],
  12: [
    { type: "combat", enemy: "random", label: "普通战斗" },
    { type: "shop", label: "校园商店" }
  ],
  13: [{ type: "event", pool: "all", label: "？ 未知事件" }],
  14: [{ type: "combat", enemy: "random", label: "普通战斗" }],
  15: [{ type: "combat", enemy: "random", label: "期末前最后一战" }],
  16: [{ type: "combat", enemy: "finalExam", label: "期末Boss：期末考试" }]
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
