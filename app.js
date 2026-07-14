import {
  ACHIEVEMENT_DEFS,
  ALL_EVENT_IDS,
  ARCHETYPE_DEFS,
  ARCHETYPE_CARD_IDS,
  BOSS_ITEM_IDS,
  CARD_DEFS,
  ENEMY_DEFS,
  ENCHANTMENT_DEFS,
  EVENT_DEFS,
  ITEM_DEFS,
  PET_TALENT_DEFS,
  RARITY_LABELS,
  PUBLIC_REWARD_CARD_IDS,
  SAFE_EVENT_IDS,
  WEEK_PLAN
} from "./game-data.js";
import { SemesterGame, cardDefinition } from "./game-engine.js";
import { analyzeBuild, BUILD_STYLE_DEFS, choiceGuidance, evaluateCardFit } from "./build-analysis.js";
import {
  achievementProgress,
  createCareerProfile,
  normalizeCareerProfile,
  recordCareerCombat,
  recordEnemyEncounter
} from "./career.js";

const app = document.querySelector("#app");
const SAVE_KEY = "endless-semester-v2";
const CAREER_KEY = "endless-semester-career-v1";
let game = new SemesterGame();
let career = readCareer();
let screen = "intro";
let context = {};
let toast = "";
let lastEvent = null;
let selectedArchetype = "cancer";
let tutorialStep = -1;
let pileView = null;

const ICONS = {
  combat: "⚔",
  event: "?",
  rest: "☕",
  shop: "▣"
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setToast(message) {
  toast = message;
  window.clearTimeout(setToast.timer);
  setToast.timer = window.setTimeout(() => {
    toast = "";
    render();
  }, 2200);
}

function rarityName(rarity) {
  return RARITY_LABELS[rarity] || ({ starter: "基础", status: "状态" }[rarity] || rarity);
}

function readSave() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    return data?.version === 2 && ARCHETYPE_DEFS[data.archetypeId] && Array.isArray(data.deck) ? data : null;
  } catch {
    return null;
  }
}

function readCareer() {
  try {
    return normalizeCareerProfile(JSON.parse(localStorage.getItem(CAREER_KEY)));
  } catch {
    return createCareerProfile();
  }
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game.toJSON()));
  } catch {
    setToast("浏览器未允许本地存档，本次仍可继续游玩");
  }
}

function saveCareer() {
  try {
    localStorage.setItem(CAREER_KEY, JSON.stringify(career));
  } catch {
    // 生涯档案不可用不影响当前对局。
  }
}

function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // 存储不可用时仍允许当前局继续运行。
  }
}

function topBar() {
  if (screen === "intro") return "";
  const hpPercent = Math.max(0, (game.hp / game.maxHp) * 100);
  const bondStage = game.pet.bond >= 25 ? "生死之交" : game.pet.bond >= 10 ? "默契搭档" : game.pet.bond >= 3 ? "熟悉伙伴" : "刚认识";
  const petTalent = game.pet.talent ? PET_TALENT_DEFS[game.pet.talent] : null;
  return `
    <header class="topbar">
      <button class="brand" data-action="map" title="当前学期">无限学期 <small>V0.9 选牌建议</small></button>
      <div class="resource health-resource" title="生命会在战斗之间保留">
        <span>♥ ${game.hp}/${game.maxHp}</span>
        <i><b style="width:${hpPercent}%"></b></i>
      </div>
      <div class="resource">◎ ${game.gold} 校园币</div>
      <div class="resource">▦ ${game.deck.length} 张牌</div>
      <div class="resource">♢ ${game.items.length}/${game.backpackCapacity} 物品</div>
      <div class="resource pet-resource">鹅鹅羁绊 ${game.pet.bond} · ${petTalent ? `${petTalent.name} Lv.${game.pet.talentLevel}` : bondStage}</div>
      <div class="resource sign-resource">${game.archetype.sign} ${game.archetype.label}</div>
      ${screen !== "rules" ? '<button class="quiet-button" data-action="open-rules">规则</button>' : ""}
      ${screen !== "stats" ? '<button class="quiet-button" data-action="open-stats">战绩</button>' : ""}
      ${screen !== "archive" ? '<button class="quiet-button" data-action="open-archive">档案</button>' : ""}
      ${screen !== "deck" ? '<button class="quiet-button" data-action="open-deck">查看构筑</button>' : ""}
    </header>`;
}

function page(title, eyebrow, body, options = {}) {
  return `
    ${topBar()}
    <section class="page ${options.className || ""}">
      <div class="page-heading">
        <p class="eyebrow">${eyebrow || ""}</p>
        <h1>${title}</h1>
        ${options.description ? `<p class="description">${options.description}</p>` : ""}
      </div>
      ${body}
    </section>
    ${toast ? `<div class="toast">${escapeHtml(toast)}</div>` : ""}`;
}

function cardHtml(card, options = {}) {
  const instance = typeof card === "string" ? { id: card, uid: card, upgraded: false } : card;
  const definition = cardDefinition(instance);
  const owner = definition.archetype ? ARCHETYPE_DEFS[definition.archetype] : null;
  const playable = options.playable !== false;
  const action = options.action || "play-card";
  const cost = definition.cost === null ? "—" : definition.cost;
  const fit = options.fit;
  return `
    <button class="game-card type-${definition.type} rarity-${definition.rarity} ${owner ? `exclusive-card exclusive-${owner.id}` : ""} ${playable ? "" : "disabled"}"
      data-action="${action}" data-uid="${instance.uid}" data-id="${instance.id}" ${playable ? "" : "disabled"}>
      <span class="card-cost">${cost}</span>
      ${definition.enchantment ? `<span class="card-enchantment" title="${definition.enchantment.text}">${definition.enchantment.sign}</span>` : ""}
      <span class="card-rarity">${owner ? `${owner.sign}专属 · ` : ""}${rarityName(definition.rarity)}</span>
      <strong>${definition.displayName}</strong>
      <span class="card-art">${definition.type === "attack" ? "✦" : definition.type === "status" ? "!" : "◆"}</span>
      <span class="card-text">${definition.displayText}</span>
      ${fit ? `<span class="card-fit fit-${fit.id}"><b>${fit.label}</b><em>${fit.reason}</em></span>` : ""}
      <small>${definition.type === "attack" ? "攻击" : definition.type === "status" ? "状态" : "技能"}</small>
    </button>`;
}

function itemHtml(id, options = {}) {
  const item = ITEM_DEFS[id];
  return `
    <button class="item-tile rarity-${item.rarity}" data-action="${options.action || "choose-item"}" data-id="${id}"
      ${options.disabled ? "disabled" : ""}>
      <span class="item-icon">${item.rarity === "boss" ? "★" : "◇"}</span>
      <span><small>${rarityName(item.rarity)}物品</small><strong>${item.name}</strong><em>${item.text}</em></span>
      ${options.price !== undefined ? `<b>${options.price} 币</b>` : ""}
    </button>`;
}

function renderIntro() {
  const saved = readSave();
  return `
    <section class="intro-shell">
      <div class="notebook-lines"></div>
      <div class="intro-copy">
        <p class="eyebrow">学生 × 卡牌构筑 × 宠物羁绊</p>
        <h1>无限学期</h1>
        <p class="intro-lead">上课、摸鱼、打期末。每张牌一句话看懂，但每个选择都会改变你的构筑。</p>
        <div class="rule-strip">
          <span><b>3</b> 能量</span><span><b>5</b> 张手牌</span><span><b>16</b> 周一学期</span><span><b>1</b> 只暴躁鹅</span>
        </div>
        <div class="archetype-picker">
          ${Object.values(ARCHETYPE_DEFS).map((archetype) => `
            <button data-action="select-archetype" data-id="${archetype.id}" class="archetype-option ${selectedArchetype === archetype.id ? "selected" : ""}">
              <span>${archetype.sign}</span><strong>${archetype.name}</strong><small>${archetype.label}</small><em>${archetype.text}</em><b>特性牌：${archetype.specialCardLabel}</b>
            </button>`).join("")}
        </div>
        <button class="primary big" data-action="new-game">开始第一学期</button>
        ${saved ? `<button class="continue-button" data-action="continue-game">继续第 ${saved.semester} 学期 · 第 ${saved.week} 周<br><small>${ARCHETYPE_DEFS[saved.archetypeId].name} · ${saved.deck.length} 张牌</small></button>` : ""}
        <button class="continue-button" data-action="open-archive">生涯档案 · ${career.unlockedAchievements.length}/${Object.keys(ACHIEVEMENT_DEFS).length} 成就</button>
        <p class="prototype-note">本版是完整规则灰盒：无付费、无体力墙、无概率付费抽卡。</p>
      </div>
      <aside class="intro-card-stack">
        <div class="poster-card poster-a"><span>1</span><strong>课本拍击</strong><b>5</b><small>造成 5 点伤害</small></div>
        <div class="poster-card poster-b"><span>1</span><strong>书包护身</strong><b>5</b><small>获得 5 点护甲</small></div>
        <div class="goose">GOOSE<br><b>鹅</b></div>
      </aside>
    </section>`;
}

function renderMap() {
  const nodes = WEEK_PLAN[game.week] || [];
  const body = `
    <div class="semester-progress">
      ${Array.from({ length: 16 }, (_, index) => {
        const week = index + 1;
        return `<div class="week-dot ${week < game.week ? "done" : week === game.week ? "current" : ""}">
          <i></i><span>${week}</span>
        </div>`;
      }).join("")}
    </div>
    <div class="route-callout">
      <div><small>当前目标</small><strong>${game.week === 16 ? "通过期末考试" : `完成第 ${game.week} 周`}</strong></div>
      <p>${game.week === 8 ? "期中精英战：拖得越久，伤害越高。" : game.week === 16 ? "一切意图都公开。用你的构筑交卷。" : "选择一条路线。完成后进入下一周。"}</p>
    </div>
    <div class="constellation-banner"><span>${game.archetype.sign}</span><p><b>${game.archetype.name}</b>${game.archetype.text}</p><small>每周开始自动存档</small></div>
    <div class="node-grid">
      ${nodes.map((node, index) => `
        <button class="route-node node-${node.type}" data-action="choose-node" data-index="${index}">
          <span class="node-icon">${ICONS[node.type]}</span>
          <span><small>${node.type === "combat" ? "战斗" : node.type === "event" ? "未知" : node.type === "rest" ? "休息" : "商店"}</small><strong>${node.label}</strong></span>
          <b>进入 →</b>
        </button>`).join("")}
    </div>
    <div class="map-tip"><b>本周规则：</b>你只需在可选节点中走一个；没有隐藏伤害，敌人下一步会在战斗中明确显示。</div>`;
  return page(`第 ${game.week} 周`, `第 ${game.semester} 学期 · 16 周路线`, body, {
    description: game.week < 8 ? "先建立构筑，再迎接期中考验。" : "越接近期末，卡组的缺点越难隐藏。",
    className: "map-page"
  });
}

function intentDescription(intent) {
  const parts = [];
  if (intent.attack) parts.push(`攻击 ${intent.attack}${intent.hits ? `×${intent.hits}` : ""}`);
  if (intent.block) parts.push(`护甲 ${intent.block}`);
  if (intent.debuff === "distracted") parts.push("施加走神");
  if (intent.addStatus) parts.push(`加入 ${intent.addStatus.count} 张${CARD_DEFS[intent.addStatus.id].name}`);
  return parts.join(" · ") || "不会造成伤害";
}

function registerEnemyEncounter() {
  const combat = game.combat;
  const result = recordEnemyEncounter(career, combat.enemy.id);
  combat.newEnemy = result.discovered;
  combat.newAchievements = result.newAchievements;
  if (result.discovered || result.newAchievements.length) saveCareer();
}

function recordCurrentCombat() {
  const combat = game.combat;
  if (!combat || combat.status === "active" || combat.careerRecorded) return;
  const summary = game.combatSummary();
  const newAchievements = recordCareerCombat(career, summary);
  combat.summary = summary;
  combat.careerRecorded = true;
  combat.newAchievements = Array.from(new Set([...(combat.newAchievements || []), ...newAchievements]));
  saveCareer();
}

function combatRecapAdvice(summary) {
  if (summary.result === "lost" && summary.cardsPlayed < summary.turns * 2) {
    return `本场平均每回合只打出 ${(summary.cardsPlayed / summary.turns).toFixed(1)} 张牌。优先花完能量，再考虑保留手牌。`;
  }
  if (summary.result === "lost" && summary.hpLost >= 12) {
    return "生命损失较高。先按公开意图准备等量护甲，再用剩余能量输出。";
  }
  if (summary.result === "won" && summary.hpLost === 0) {
    return "无伤胜利：当前防御节奏有效，可以继续围绕主力牌精简构筑。";
  }
  if (summary.turns >= 6) return "战斗拖得较久。增加稳定抽牌或移除低贡献牌，会比单纯拿高费牌更有效。";
  return `本场用 ${summary.turns} 回合结束战斗，损失 ${summary.hpLost} 生命。下一次保持输出，同时按公开意图补足护甲。`;
}

function renderCombatResult(combat) {
  const summary = combat.summary || game.combatSummary();
  const enemy = ENEMY_DEFS[summary.enemyId];
  const build = analyzeBuild(game);
  const unlocked = (combat.newAchievements || []).map((id) => ACHIEVEMENT_DEFS[id]).filter(Boolean);
  return `<div class="result-overlay">
    <div class="result-card recap-card ${combat.status}">
      <small>${combat.status === "won" ? "战斗复盘" : "挑战复盘"}</small>
      <h2>${combat.status === "won" ? "胜利" : "体力耗尽"}</h2>
      <p class="recap-enemy">对阵 ${enemy.name} · ${enemy.pattern}</p>
      <div class="recap-stats">
        <span><b>${summary.turns}</b>回合</span>
        <span><b>${summary.cardsPlayed}</b>出牌</span>
        <span><b>${summary.damageDealt}</b>伤害</span>
        <span><b>${summary.hpLost}</b>掉血</span>
      </div>
      <div class="recap-advice"><small>复盘建议</small><p>${combatRecapAdvice(summary)}</p><em>敌人提示：${enemy.tip}</em></div>
      <div class="recap-build"><b>${build.primary.sign} ${build.primary.label}</b><span>当前短板：${build.risk}。${build.suggestion}</span></div>
      ${combat.newEnemy ? '<div class="discovery-note">新敌人已收录进校园档案</div>' : ""}
      ${unlocked.length ? `<div class="unlocked-row"><small>新成就</small>${unlocked.map((achievement) => `<span><b>${achievement.icon}</b>${achievement.name}</span>`).join("")}</div>` : ""}
      <div class="recap-actions"><button class="quiet-button" data-action="open-archive">查看档案</button><button class="primary" data-action="combat-result">${combat.status === "won" ? "领取战利品" : "返回标题"}</button></div>
    </div>
  </div>`;
}

function renderCombat() {
  const combat = game.combat;
  const intent = game.getIntent();
  const enemyHp = (combat.enemy.hp / combat.enemy.maxHp) * 100;
  const playerHp = (game.hp / game.maxHp) * 100;
  const petPreview = game.petSkillPreview();
  const petExtras = [
    petPreview.block ? `护甲 ${petPreview.block}` : "",
    petPreview.draw ? `抽 ${petPreview.draw}` : "",
    petPreview.nextDrawBonus ? `下回合抽牌 +${petPreview.nextDrawBonus}` : ""
  ].filter(Boolean).join(" · ");
  const body = `
    <div class="combat-board">
      <section class="fighter player-fighter">
        <div class="fighter-label"><span>学生</span><b>护甲 ${combat.playerBlock}</b></div>
        <div class="student-avatar"><span>学</span></div>
        <div class="hpbar"><i style="width:${playerHp}%"></i><b>${game.hp}/${game.maxHp}</b></div>
        <div class="status-row">${combat.distracted ? '<span class="status negative">走神：攻击每段 -2</span>' : '<span class="status">状态正常</span>'}</div>
      </section>

      <section class="battle-center">
        <div class="turn-badge">第 ${combat.turn} 回合</div>
        <div class="intent-card ${intent.attack ? "danger" : "safe"}">
          <small>敌人下一步</small><strong>${intent.name}</strong><b>${intentDescription(intent)}</b>
        </div>
        <div class="combat-log">
          ${combat.log.slice(-6).reverse().map((entry) => `<p>${escapeHtml(entry)}</p>`).join("")}
        </div>
      </section>

      <section class="fighter enemy-fighter">
        <div class="fighter-label"><span>${combat.enemy.name}</span><b>护甲 ${combat.enemy.block}</b></div>
        <div class="enemy-avatar enemy-${combat.enemy.id}"><span>${combat.enemy.id === "finalExam" ? "卷" : combat.enemy.id === "rivalShadow" ? "卷" : "怪"}</span></div>
        <div class="hpbar enemy-hp"><i style="width:${enemyHp}%"></i><b>${combat.enemy.hp}/${combat.enemy.maxHp}</b></div>
        <p>${combat.enemy.subtitle}</p>
      </section>
    </div>

    <div class="combat-controls">
      <div class="energy-orb"><b>${combat.energy}</b><span>能量</span></div>
      <button class="pet-skill ${game.pet.charge >= game.pet.maxCharge && !combat.petUsed ? "ready" : ""}" data-action="pet-skill"
        ${game.pet.charge < game.pet.maxCharge || combat.petUsed || combat.energy < 1 || combat.status !== "active" ? "disabled" : ""}>
        <span class="pet-face">鹅</span>
        <span><strong>追着啄${petPreview.talent ? ` · ${petPreview.talent.name}` : ""}</strong><small>1 能量 · ${petPreview.damage} 伤害${petExtras ? ` · ${petExtras}` : ""} · 每场一次</small><i>${"●".repeat(game.pet.charge)}${"○".repeat(game.pet.maxCharge - game.pet.charge)}</i></span>
      </button>
      <div class="pile-counts">
        <button data-action="open-pile" data-zone="drawPile">抽牌堆 <b>${combat.drawPile.length}</b></button>
        <button data-action="open-pile" data-zone="discardPile">弃牌堆 <b>${combat.discardPile.length}</b></button>
        <button data-action="open-pile" data-zone="exhaustPile">消耗 <b>${combat.exhaustPile.length}</b></button>
      </div>
      <button class="end-turn" data-action="end-turn" ${combat.status !== "active" || combat.pendingDiscard ? "disabled" : ""}>结束回合</button>
    </div>

    ${combat.pendingDiscard ? '<div class="discard-prompt">草稿纸：请选择一张手牌弃掉</div>' : ""}
    <div class="hand">
      ${combat.hand.map((card) => {
        const playable = combat.pendingDiscard ? true : game.canPlay(card).ok;
        return cardHtml(card, { action: combat.pendingDiscard ? "discard-card" : "play-card", playable });
      }).join("")}
    </div>
    ${pileView ? renderPileOverlay(combat) : ""}
    ${tutorialStep >= 0 && combat.status === "active" ? renderTutorial() : ""}
    ${combat.status !== "active" ? renderCombatResult(combat) : ""}
  `;
  return `${topBar()}<main class="combat-page">${body}</main>${toast ? `<div class="toast">${escapeHtml(toast)}</div>` : ""}`;
}

function renderPileOverlay(combat) {
  const labels = {
    drawPile: ["抽牌堆", "牌序未知；用来判断接下来还可能抽到什么。"],
    discardPile: ["弃牌堆", "抽牌堆耗尽后，这些牌会重新洗回去。"],
    exhaustPile: ["消耗堆", "这些牌本场战斗不会再次进入抽牌堆。"]
  };
  const [title, description] = labels[pileView];
  const cards = combat[pileView] || [];
  return `<div class="pile-overlay">
    <div class="pile-dialog">
      <div><small>战斗信息</small><h2>${title} · ${cards.length}</h2><p>${description}</p></div>
      <div class="pile-card-grid">${cards.length ? cards.map((card) => cardHtml(card, { playable: false })).join("") : '<p class="empty-state">这里暂时没有牌。</p>'}</div>
      <button class="primary centered" data-action="close-pile">返回战斗</button>
    </div>
  </div>`;
}

function renderTutorial() {
  const steps = [
    { number: "01", title: "先看意图，再出牌", text: "中间红框是敌人下一步。它显示“攻击 5”，你获得 5 护甲就能完全挡住。" },
    { number: "02", title: "每回合只有 3 点能量", text: "卡牌左上角是费用。攻击造成伤害，护甲只保留到下个玩家回合开始。" },
    { number: "03", title: "让暴躁鹅一起打", text: "每回合第一次打出攻击牌，宠物充能 +1。充满后花 1 能量出手，每场一次。" }
  ];
  const step = steps[tutorialStep];
  return `<div class="tutorial-overlay">
    <div class="tutorial-card">
      <small>新生教学 ${step.number}/03</small><h2>${step.title}</h2><p>${step.text}</p>
      <div><button class="quiet-button" data-action="skip-tutorial">跳过教学</button><button class="primary" data-action="tutorial-next">${tutorialStep === steps.length - 1 ? "明白，开始战斗" : "下一条"}</button></div>
    </div>
  </div>`;
}

function renderCardReward() {
  const exclusiveCount = context.choices.filter((id) => CARD_DEFS[id].archetype === game.archetypeId).length;
  const publicCount = context.choices.length - exclusiveCount;
  const body = `
    <div class="choice-copy"><p>${context.message || "选一张加入构筑，也可以跳过。"}</p></div>
    <div class="pool-composition"><b>${game.archetype.sign} 当前奖励构成</b><span>${exclusiveCount} 张本星座专属</span><span>${publicCount} 张普池</span><em>不会出现其他星座专属牌</em></div>
    ${choiceAdviceHtml(context.choices)}
    <div class="card-choice-row">${context.choices.map((id) => cardHtml(id, { action: "take-reward-card", fit: evaluateCardFit(game, id) })).join("")}</div>
    <div class="choice-actions">
      ${game.hasItem("eraser") && !game.flags.eraserUsed && context.allowReroll !== false ? '<button class="secondary" data-action="reroll-reward">橡皮擦：本学期重抽一次</button>' : ""}
      <button class="quiet-button" data-action="skip-reward">跳过，不让卡组变厚</button>
    </div>`;
  return page(context.title || "选择一张新牌", context.eyebrow || "战斗奖励", body, {
    description: "强牌不一定适合当前构筑；能稳定抽到核心牌同样重要。",
    className: "reward-page"
  });
}

function choiceAdviceHtml(cardIds) {
  const build = analyzeBuild(game);
  return `<div class="choice-advice">
    <b>${build.primary.sign} ${build.primary.label}</b>
    <span>${choiceGuidance(game, cardIds)}</span>
    <em>标签只比较当前构筑，不改变卡牌效果、奖励概率或商店价格。</em>
  </div>`;
}

function renderItemReward() {
  const full = game.items.length >= game.backpackCapacity;
  const body = `
    ${full ? '<div class="warning-box">书包已满。选择新物品后，需要丢弃一件旧物品。</div>' : ""}
    <div class="item-choice-list">${context.choices.map((id) => itemHtml(id)).join("")}</div>
    <button class="quiet-button centered" data-action="skip-item">不拿，保持现有物品</button>`;
  return page(context.title || "选择随身物品", context.eyebrow || "额外奖励", body, {
    description: `物品提供自动规则，当前书包 ${game.items.length}/${game.backpackCapacity}。`
  });
}

function renderReplaceItem() {
  const incoming = ITEM_DEFS[context.incoming];
  const body = `
    <div class="incoming-item"><small>准备装入</small><strong>${incoming.name}</strong><p>${incoming.text}</p></div>
    <p class="center-copy">选择一件旧物品丢弃：</p>
    <div class="item-choice-list">${game.items.map((id) => itemHtml(id, { action: "replace-item" })).join("")}</div>
    <button class="quiet-button centered" data-action="cancel-replace">取消</button>`;
  return page("整理书包", "容量已满", body);
}

function renderSelection() {
  const cards = context.cards || game.deck;
  const body = `
    <div class="deck-grid">
      ${cards.map((card) => cardHtml(card, { action: "select-deck-card", playable: !(context.disabled?.(card)) })).join("")}
    </div>
    ${context.canCancel ? '<button class="quiet-button centered" data-action="cancel-selection">取消</button>' : ""}`;
  return page(context.title, context.eyebrow || "选择卡牌", body, { description: context.description });
}

function buildProfileHtml(build, compact = false) {
  return `<section class="build-profile ${compact ? "compact" : ""}">
    <div class="build-identity"><span>${build.primary.sign}</span><div><small>当前主流派</small><h2>${build.primary.label}</h2><p>${build.primary.text}</p></div></div>
    <div class="build-tendencies">
      ${Object.values(BUILD_STYLE_DEFS).map((style) => `<div><span>${style.label}</span><i><b style="width:${build.tendencies[style.id]}%"></b></i><em>${build.tendencies[style.id]}%</em></div>`).join("")}
    </div>
    <div class="build-risk"><small>当前短板</small><strong>${build.risk}</strong><p>${build.suggestion}</p></div>
  </section>`;
}

function renderDeck() {
  const build = analyzeBuild(game);
  const body = `
    ${buildProfileHtml(build)}
    <div class="collection-summary">
      <span>攻击 ${game.deck.filter((card) => CARD_DEFS[card.id].type === "attack").length}</span>
      <span>技能 ${game.deck.filter((card) => CARD_DEFS[card.id].type === "skill").length}</span>
      <span>已升级 ${game.deck.filter((card) => card.upgraded).length}</span>
      <span>已刻印 ${game.deck.filter((card) => card.enchantment).length}</span>
    </div>
    <div class="deck-grid">${game.deck.map((card) => cardHtml(card, { playable: false })).join("")}</div>
    <h2 class="subheading">书包物品</h2>
    <div class="item-choice-list compact">${game.items.length ? game.items.map((id) => itemHtml(id, { disabled: true })).join("") : '<p class="empty-state">还没有物品。</p>'}</div>
    <button class="primary centered" data-action="close-deck">返回</button>`;
  return page("当前构筑", `${game.deck.length} 张牌 · ${game.items.length} 件物品`, body, {
    description: "卡组越薄，核心牌出现得越稳定；状态牌只在战斗中临时加入。"
  });
}

function renderEnchantment() {
  const enchantment = context.enchantment;
  const body = `
    <div class="enchantment-rule">
      <span>${game.archetype.sign}</span>
      <div><small>本学期命盘觉醒</small><strong>${enchantment.name}</strong><p>${enchantment.text}</p></div>
    </div>
    <p class="center-copy">从本场实际使用过的合格卡牌中选择一张。升级和刻印可以同时存在，但每张牌最多拥有一个刻印。</p>
    <div class="enchantment-grid">
      ${context.cards.map((card) => `<div class="enchantment-choice">${cardHtml(card, { action: "enchant-card" })}<small>刻印后：${enchantment.text}</small></div>`).join("")}
    </div>
    <button class="quiet-button centered" data-action="skip-enchantment">暂不刻印</button>`;
  return page("选择一张牌刻印", "期中精英奖励", body, {
    description: "刻印改变长期构筑方向，不会在每场战斗后频繁出现。"
  });
}

function renderPetMilestone() {
  const milestone = game.pet.pendingMilestone;
  const isChoice = milestone === "choose";
  const currentTalent = game.pet.talent ? PET_TALENT_DEFS[game.pet.talent] : null;
  const nextLevel = Math.min(3, game.pet.talentLevel + 1);
  const body = isChoice ? `
    <div class="pet-path-grid">
      ${Object.values(PET_TALENT_DEFS).map((talent) => `
        <button class="pet-path" data-action="select-pet-talent" data-id="${talent.id}">
          <span>${talent.icon}</span><small>羁绊路线</small><strong>${talent.name}</strong><em>${talent.tagline}</em><p>Lv.1：${talent.levels[0].text}</p>
        </button>`).join("")}
    </div>` : `
    <div class="pet-upgrade-card">
      <span>${currentTalent.icon}</span>
      <div><small>${milestone === "master" ? "终极默契" : "路线强化"}</small><h2>${currentTalent.name} Lv.${game.pet.talentLevel} → Lv.${nextLevel}</h2><p>${currentTalent.levels[nextLevel - 1].text}</p></div>
      <button class="primary" data-action="upgrade-pet-talent">确认强化</button>
    </div>`;
  return page(isChoice ? "暴躁鹅想学点新的" : "羁绊路线升级", `羁绊 ${game.pet.bond} · 里程碑`, body, {
    description: isChoice
      ? "路线一旦选择便不会更换；每种效果都受“每场一次、消耗 1 能量”的限制。"
      : "强化已有路线，不增加宠物每场出手次数。"
  });
}

function renderRules() {
  const body = `
    <div class="rules-grid">
      <article><b>01</b><h2>回合</h2><p>每回合获得 3 能量并抽 5 张牌。未用手牌回合结束时进入弃牌堆。</p></article>
      <article><b>02</b><h2>意图</h2><p>敌人下一步完全公开。攻击、护甲、负面状态都不会藏数值。</p></article>
      <article><b>03</b><h2>护甲</h2><p>护甲先抵挡伤害，并在下一个玩家回合开始时清空。</p></article>
      <article><b>04</b><h2>构筑</h2><p>战后可三选一或跳过。卡组越薄，关键牌越容易再次抽到。</p></article>
      <article><b>05</b><h2>宠物</h2><p>每回合第一次使用攻击牌可充能 1 点；满 2 点后可主动攻击，每场一次。羁绊 3、10、25 解锁路线成长。</p></article>
      <article><b>06</b><h2>学期</h2><p>生命在节点之间保留。第 16 周通过期末后，可保留构筑进入更难的新学期。</p></article>
    </div>
    <div class="rules-note"><b>${game.archetype.sign} 当前命盘：${game.archetype.name}</b><span>${game.archetype.text}</span></div>
    <button class="primary centered" data-action="close-rules">返回</button>`;
  return page("六条核心规则", "一分钟看懂", body, { description: "所有例外规则都写在卡牌、物品或敌人意图上。" });
}

function renderStats() {
  const stats = game.stats;
  const build = analyzeBuild(game);
  const winRate = stats.combatsCompleted ? Math.round((stats.combatsWon / stats.combatsCompleted) * 100) : 0;
  const averageTurns = stats.combatsCompleted ? (stats.combatTurns / stats.combatsCompleted).toFixed(1) : "—";
  const averageHpLost = stats.combatsStarted ? (stats.combatHpLost / stats.combatsStarted).toFixed(1) : "—";
  const topCards = Object.entries(stats.cardPlays).sort((left, right) => right[1] - left[1]).slice(0, 6);
  const body = `
    <div class="stats-grid">
      <article><small>开始战斗</small><strong>${stats.combatsStarted}</strong><span>场</span></article>
      <article><small>战斗胜率</small><strong>${winRate}</strong><span>%</span></article>
      <article><small>平均回合</small><strong>${averageTurns}</strong><span>回合</span></article>
      <article><small>平均战斗掉血</small><strong>${averageHpLost}</strong><span>生命</span></article>
      <article><small>累计出牌</small><strong>${stats.cardsPlayed}</strong><span>张</span></article>
      <article><small>宠物出手</small><strong>${stats.petUses}</strong><span>次</span></article>
    </div>
    ${buildProfileHtml(build, true)}
    <div class="stats-columns">
      <section class="stats-panel">
        <small>构筑选择</small><h2>你怎么拿牌</h2>
        <ul>
          <li><span>奖励出现</span><b>${stats.rewardsSeen}</b></li>
          <li><span>拿取卡牌</span><b>${stats.cardsTaken}</b></li>
          <li><span>${game.archetype.sign} 专属牌</span><b>${stats.exclusiveTaken}</b></li>
          <li><span>普池牌</span><b>${stats.publicTaken}</b></li>
          <li><span>主动跳过</span><b>${stats.rewardsSkipped}</b></li>
          <li><span>获得物品 / 刻印</span><b>${stats.itemsTaken} / ${stats.enchantments}</b></li>
        </ul>
      </section>
      <section class="stats-panel">
        <small>真实出牌次数</small><h2>最常用的牌</h2>
        ${topCards.length ? `<ol>${topCards.map(([id, count]) => `<li><span>${CARD_DEFS[id]?.name || id}</span><b>${count} 次</b></li>`).join("")}</ol>` : '<p class="empty-state">完成几场战斗后，这里会显示你的主力牌。</p>'}
      </section>
    </div>
    <div class="privacy-note">这些数据只保存在当前浏览器的游戏存档中，不会上传到服务器或第三方分析平台。</div>
    <button class="primary centered" data-action="close-stats">返回</button>`;
  return page("本局战绩", `第 ${game.semester} 学期 · 第 ${game.week} 周`, body, {
    description: "用真实出牌和选择记录判断构筑，而不是只看卡牌稀有度。"
  });
}

function renderArchive() {
  const achievementTotal = Object.keys(ACHIEVEMENT_DEFS).length;
  const kindLabels = { normal: "普通", elite: "精英", boss: "期末" };
  const enemyIcons = { sleepyBug: "困", homeworkBlob: "作", alarmClock: "闹", phoneSpirit: "机", groupChat: "99", printerJam: "印", rivalShadow: "卷", finalExam: "末" };
  const body = `
    <div class="archive-summary">
      <article><small>已解锁成就</small><strong>${career.unlockedAchievements.length}/${achievementTotal}</strong></article>
      <article><small>发现敌人</small><strong>${career.discoveredEnemies.length}/${Object.keys(ENEMY_DEFS).length}</strong></article>
      <article><small>生涯胜场</small><strong>${career.combatsWon}</strong></article>
      <article><small>生涯出牌</small><strong>${career.cardsPlayed}</strong></article>
    </div>
    <div class="archive-heading"><div><small>目标记录</small><h2>成就</h2></div><p>成就只负责记录玩法目标，不提供永久数值，不让新玩家因入场晚而变弱。</p></div>
    <div class="achievement-grid">
      ${Object.values(ACHIEVEMENT_DEFS).map((achievement) => {
        const progress = achievementProgress(career, achievement.id);
        const percent = Math.min(100, (progress.current / progress.target) * 100);
        return `<article class="achievement-card ${progress.unlocked ? "unlocked" : "locked"}">
          <span>${progress.unlocked ? achievement.icon : "?"}</span>
          <div><small>${progress.unlocked ? "已解锁" : `${progress.current}/${progress.target}`}</small><h3>${achievement.name}</h3><p>${achievement.text}</p><i><b style="width:${percent}%"></b></i></div>
        </article>`;
      }).join("")}
    </div>
    <div class="archive-heading"><div><small>遭遇记录</small><h2>敌人图鉴</h2></div><p>第一次遭遇后公开行动规律和一句应对建议。</p></div>
    <div class="enemy-codex">
      ${Object.values(ENEMY_DEFS).map((enemy) => {
        const discovered = career.discoveredEnemies.includes(enemy.id);
        return `<article class="enemy-entry ${discovered ? "discovered" : "locked"} ${context.focusEnemy === enemy.id ? "focused" : ""}">
          <span>${discovered ? enemyIcons[enemy.id] : "?"}</span>
          <div><small>${discovered ? `${kindLabels[enemy.kind]}敌人 · ${enemy.maxHp} 基础生命` : "尚未遭遇"}</small><h3>${discovered ? enemy.name : "未知记录"}</h3><p>${discovered ? enemy.subtitle : "在学期路线中遇见它，档案才会公开。"}</p></div>
          ${discovered ? `<dl><dt>行动规律</dt><dd>${enemy.pattern}</dd><dt>应对建议</dt><dd>${enemy.tip}</dd></dl>` : ""}
        </article>`;
      }).join("")}
    </div>
    <div class="privacy-note">生涯档案与成就只保存在当前浏览器，不上传，不跨设备追踪。</div>
    <button class="primary centered" data-action="close-archive">返回</button>`;
  return page("校园档案", "复盘 · 图鉴 · 成就", body, {
    description: "先看见自己的真实进步，再决定下一局要练什么。"
  });
}

function renderRest() {
  const missing = game.maxHp - game.hp;
  const canUpgrade = game.deck.some((card) => !card.upgraded);
  const body = `
    <div class="rest-scene"><span>☕</span><p>便利店的灯还亮着。今晚只能认真做一件事。</p></div>
    <div class="node-grid rest-options">
      <button class="route-node" data-action="rest-heal" ${missing === 0 ? "disabled" : ""}><span class="node-icon">♥</span><span><small>恢复</small><strong>好好睡一觉</strong><em>恢复 ${Math.min(15, missing)} 点生命</em></span></button>
      <button class="route-node" data-action="rest-upgrade" ${canUpgrade ? "" : "disabled"}><span class="node-icon">↑</span><span><small>强化</small><strong>整理课堂笔记</strong><em>${canUpgrade ? "升级一张卡牌" : "所有卡牌均已升级"}</em></span></button>
      <button class="route-node" data-action="rest-pet"><span class="node-icon">鹅</span><span><small>陪伴</small><strong>带鹅散步</strong><em>羁绊 +2</em></span></button>
    </div>`;
  return page("休息节点", `第 ${game.week} 周`, body, { description: "恢复解决眼前问题，升级和羁绊投资长期强度。" });
}

function discountedPrice(base, isItem = false) {
  let price = base;
  if (game.hasItem("studentId")) price *= 0.9;
  if (isItem && game.flags.nextShopHalf) price *= 0.5;
  return Math.ceil(price);
}

function renderShop() {
  const availableCardIds = context.cards.filter((stock) => !stock.sold).map((stock) => stock.id);
  const body = `
    <div class="shopkeeper"><span>店</span><p>“别问进货渠道。学生证确实能打折。”</p></div>
    <h2 class="subheading">卡牌</h2>
    ${availableCardIds.length ? choiceAdviceHtml(availableCardIds) : ""}
    <div class="shop-grid">
      ${context.cards.map((stock, index) => {
        const base = { common: 40, uncommon: 65, rare: 100 }[CARD_DEFS[stock.id].rarity];
        const price = discountedPrice(base);
        return `<div class="shop-stock ${stock.sold ? "sold" : ""}">${cardHtml(stock.id, { action: "noop", playable: !stock.sold, fit: evaluateCardFit(game, stock.id) })}<button data-action="buy-card" data-index="${index}" ${stock.sold || game.gold < price ? "disabled" : ""}>${stock.sold ? "已售" : `${price} 币`}</button></div>`;
      }).join("")}
    </div>
    <h2 class="subheading">物品</h2>
    <div class="item-choice-list">
      ${context.items.map((stock) => {
        const price = discountedPrice({ common: 90, uncommon: 120, rare: 160 }[ITEM_DEFS[stock.id].rarity], true);
        return itemHtml(stock.id, { action: "buy-item", price: stock.sold ? "已售" : price, disabled: stock.sold || game.gold < price || game.items.length >= game.backpackCapacity });
      }).join("")}
    </div>
    <div class="shop-services">
      <div><strong>卡组瘦身</strong><p>移除一张牌。价格会随学期上涨。</p></div>
      <button data-action="shop-remove" ${game.gold < context.removePrice || game.deck.length <= 5 || context.removed ? "disabled" : ""}>${context.removed ? "本店已移除" : `${context.removePrice} 币`}</button>
    </div>
    <button class="primary centered" data-action="leave-shop">离开商店</button>`;
  return page("校园商店", `第 ${game.week} 周 · ${game.gold} 校园币`, body, { description: game.flags.nextShopHalf ? "饭卡优惠生效：本店第一件物品半价。" : "买的是构筑方向，不是单卡稀有度。" });
}

function eventChoices(id) {
  const choices = {
    hallwayBox: [
      ["打开纸箱", "50% 获得普通物品；50% 失去 6 生命", "box-open"],
      ["让暴躁鹅检查", "安全离开，羁绊 +1", "box-pet"],
      ["假装没看见", "无事发生", "leave"]
    ],
    popQuiz: [
      ["硬着头皮答", "失去 5 生命，升级一张牌", "quiz-upgrade"],
      ["借同桌答案", "选择一张进阶牌；下场加入 2 张紧张", "quiz-card"],
      ["交白卷", "无事发生", "leave"]
    ],
    clubRecruitment: [
      ["参加散打社", "从 3 张攻击牌中选择一张", "club-attack"],
      ["参加桌游社", "从 3 张技能牌中选择一张", "club-skill"],
      ["带宠物入社", "支付 30 币，羁绊 +2", "club-pet"]
    ],
    mealCard: [
      ["交到失物招领", "获得 40 校园币", "meal-gold"],
      ["研究优惠券", "下个商店第一件物品半价", "meal-sale"],
      ["给鹅加餐", "接下来 3 场战斗初始充能 +1", "meal-pet"]
    ],
    campusRumor: [
      ["进去调查", "与强化敌人战斗；胜利获得稀有物品", "rumor-fight"],
      ["做好准备再走", "获得 40 币；下个敌人初始 6 护甲", "rumor-gold"],
      ["撤退", "恢复 4 生命", "rumor-heal"]
    ],
    oldLocker: [
      ["强行撬开", "失去 6 生命，获得普通物品", "locker-open"],
      ["找管理员", "支付 50 币，移除一张牌", "locker-remove"],
      ["离开", "无事发生", "leave"]
    ]
  };
  return choices[id];
}

function renderEvent() {
  const event = EVENT_DEFS[context.eventId];
  const body = `
    <div class="event-scene"><span>?</span><div><small>${event.safe ? "校园日常" : "风险事件"}</small><p>${event.text}</p></div></div>
    <div class="event-options">
      ${eventChoices(event.id).map(([name, detail, id]) => {
        const unaffordable = (id === "club-pet" && game.gold < 30)
          || (id === "locker-remove" && (game.gold < 50 || game.deck.length <= 5))
          || (id === "quiz-upgrade" && !game.deck.some((card) => !card.upgraded));
        return `<button data-action="event-choice" data-choice="${id}" ${unaffordable ? "disabled" : ""}><strong>${name}</strong><span>${detail}</span></button>`;
      }).join("")}
    </div>`;
  return page(event.name, `？第 ${game.week} 周事件`, body, { description: "事件会说明代价，但结果不一定完全可控。" });
}

function renderSemesterComplete() {
  const body = `
    <div class="report-card">
      <div><small>SEMESTER</small><strong>${game.semester}</strong><span>完成</span></div>
      <ul>
        <li><span>剩余生命</span><b>${game.hp}/${game.maxHp}</b></li>
        <li><span>卡组规模</span><b>${game.deck.length}</b></li>
        <li><span>随身物品</span><b>${game.items.length}/${game.backpackCapacity}</b></li>
        <li><span>暴躁鹅羁绊</span><b>${game.pet.bond}</b></li>
        <li><span>累计战斗 / 掉血</span><b>${game.stats.combatsWon} / ${game.stats.combatHpLost}</b></li>
        <li><span>累计出牌</span><b>${game.stats.cardsPlayed}</b></li>
      </ul>
    </div>
    <div class="semester-actions">
      <button class="primary big" data-action="next-semester">插班进入第 ${game.semester + 1} 学期</button>
      <p>代价与补偿：敌人生命 +15%、攻击 +1；你最大生命 +2、书包容量 +1并回满生命。卡组和羁绊全部保留。</p>
      <button class="quiet-button" data-action="return-title">重新开始</button>
    </div>`;
  return page("这学期，过了。", "期末总结", body, {
    description: "无尽不是把数字无限放大，而是让旧构筑带着代价进入新循环。"
  });
}

function render() {
  const renderers = {
    intro: renderIntro,
    map: renderMap,
    combat: renderCombat,
    cardReward: renderCardReward,
    itemReward: renderItemReward,
    replaceItem: renderReplaceItem,
    selection: renderSelection,
    enchantment: renderEnchantment,
    petMilestone: renderPetMilestone,
    deck: renderDeck,
    rest: renderRest,
    shop: renderShop,
    event: renderEvent,
    semesterComplete: renderSemesterComplete,
    rules: renderRules,
    stats: renderStats,
    archive: renderArchive
  };
  app.innerHTML = (renderers[screen] || renderIntro)();
}

function changeScreen(next, nextContext = {}) {
  screen = next;
  context = nextContext;
  if (next !== "combat") pileView = null;
  if (next === "map") saveGame();
  window.scrollTo({ top: 0, behavior: "smooth" });
  render();
}

function advanceWeek() {
  game.week += 1;
  changeScreen("map");
}

function selectEvent(pool) {
  const ids = pool === "safe" ? SAFE_EVENT_IDS : ALL_EVENT_IDS;
  const available = ids.filter((id) => id !== lastEvent);
  const eventId = game.rng.pick(available.length ? available : ids);
  lastEvent = eventId;
  changeScreen("event", { eventId });
}

function startNode(node) {
  if (node.type === "combat") {
    game.startCombat(node.enemy);
    registerEnemyEncounter();
    tutorialStep = !game.tutorialSeen && game.semester === 1 && game.week === 1 ? 0 : -1;
    changeScreen("combat", { outcome: ENEMY_DEFS[game.combat.enemy.id].kind });
  } else if (node.type === "event") {
    selectEvent(node.pool);
  } else if (node.type === "rest") {
    changeScreen("rest");
  } else if (node.type === "shop") {
    openShop();
  }
}

function openShop() {
  const exclusive = game.rng.shuffle(ARCHETYPE_CARD_IDS[game.archetypeId]).slice(0, 1);
  const publicCards = game.rng.shuffle(PUBLIC_REWARD_CARD_IDS).slice(0, 2);
  const cardIds = game.rng.shuffle([...exclusive, ...publicCards]);
  const itemIds = game.rng.shuffle(Object.keys(ITEM_DEFS).filter((id) => ITEM_DEFS[id].rarity !== "boss" && !game.hasItem(id))).slice(0, 2);
  changeScreen("shop", {
    cards: cardIds.map((id) => ({ id, sold: false })),
    items: itemIds.map((id) => ({ id, sold: false })),
    removePrice: 75 + (game.semester - 1) * 15,
    removed: false
  });
}

function showCardReward(options = {}) {
  changeScreen("cardReward", {
    choices: options.choices || game.rewardCards(3, options.rarity),
    title: options.title,
    eyebrow: options.eyebrow,
    message: options.message,
    allowReroll: options.allowReroll,
    onDone: options.onDone || advanceWeek
  });
}

function showItemReward(choices, onDone = advanceWeek, title) {
  changeScreen("itemReward", { choices: choices.filter(Boolean), onDone, title });
}

function finishCardReward(id) {
  game.stats.rewardsSeen += 1;
  if (id) {
    game.addCard(id);
    game.stats.cardsTaken += 1;
    if (CARD_DEFS[id].archetype === game.archetypeId) game.stats.exclusiveTaken += 1;
    else game.stats.publicTaken += 1;
  } else {
    game.stats.rewardsSkipped += 1;
  }
  const next = context.onDone;
  if (typeof next === "function") next();
}

function grantItem(id) {
  if (game.addItem(id)) {
    game.stats.itemsTaken += 1;
    const next = context.onDone;
    if (typeof next === "function") next();
  } else if (game.items.length >= game.backpackCapacity) {
    changeScreen("replaceItem", { incoming: id, onDone: context.onDone, cancelTo: { screen: "itemReward", context } });
  } else {
    setToast("这个物品已经在书包里了");
  }
}

function showCardSelection(options) {
  changeScreen("selection", options);
}

function showEnchantmentReward(onDone = advanceWeek) {
  const usedUids = game.combat?.usedCardUids ? [...game.combat.usedCardUids] : [];
  const usedEligible = game.enchantableCards(usedUids);
  const cards = usedEligible.length ? usedEligible : game.enchantableCards();
  if (!cards.length) {
    onDone();
    setToast("当前没有符合本星座刻印条件的卡牌");
    return;
  }
  const enchantment = Object.values(ENCHANTMENT_DEFS).find((entry) => entry.archetype === game.archetypeId);
  changeScreen("enchantment", { cards, enchantment, onDone });
}

function showPetMilestone(onDone) {
  changeScreen("petMilestone", { onDone });
}

function gainPetBond(amount, onDone, message) {
  game.pet.bond += amount;
  game.updatePetMilestone();
  if (game.pet.pendingMilestone) showPetMilestone(onDone);
  else {
    setToast(message);
    onDone();
  }
}

function resolveCombatResult() {
  if (game.combat.status === "lost") {
    clearSave();
    game = new SemesterGame(Date.now(), selectedArchetype);
    changeScreen("intro");
    return;
  }
  const outcome = context.outcome;
  if (game.pet.pendingMilestone) {
    showPetMilestone(() => grantCombatRewards(outcome));
    return;
  }
  grantCombatRewards(outcome);
}

function grantCombatRewards(outcome) {
  if (outcome === "boss") {
    game.gold += 50;
    showItemReward(BOSS_ITEM_IDS.filter((id) => !game.hasItem(id)), () => showSemesterSummary(), "期末纪念物");
  } else if (outcome === "elite") {
    game.gold += 30;
    showCardReward({
      title: "精英战奖励",
      onDone: () => showItemReward(
        game.rng.shuffle(Object.keys(ITEM_DEFS).filter((id) => ITEM_DEFS[id].rarity !== "boss" && !game.hasItem(id))).slice(0, 2),
        () => showEnchantmentReward(advanceWeek),
        "精英物品奖励"
      )
    });
  } else if (outcome === "event") {
    const rares = Object.keys(ITEM_DEFS).filter((id) => ITEM_DEFS[id].rarity === "rare" && !game.hasItem(id));
    showItemReward(rares.length ? game.rng.shuffle(rares).slice(0, 2) : [game.randomItem()].filter(Boolean), advanceWeek, "怪谈调查奖励");
  } else {
    game.gold += 15;
    showCardReward({ title: "战斗奖励" });
  }
}

function showSemesterSummary() {
  const eligible = game.eligibleSummaryCards();
  if (!eligible.length) {
    changeScreen("semesterComplete");
    setToast("本学期没有一张未升级卡在至少 3 场战斗中使用，跳过期末总结升级");
    return;
  }
  showCardSelection({
    title: "期末总结：升级一张主力牌",
    eyebrow: "使用记录 ≥ 3 场",
    description: "只有真正进入过本学期战斗节奏的卡，才能沉淀为长期能力。",
    cards: eligible,
    onSelect(card) {
      game.upgradeCard(card.uid);
      changeScreen("semesterComplete");
    }
  });
}

function finishEvent(message = "事件结束") {
  setToast(message);
  advanceWeek();
}

function pickFilteredCards(type) {
  const mixedPool = [...PUBLIC_REWARD_CARD_IDS, ...ARCHETYPE_CARD_IDS[game.archetypeId]];
  const ids = mixedPool.filter((id) => type === "attack" ? CARD_DEFS[id].type === "attack" : CARD_DEFS[id].type !== "attack");
  return game.rng.shuffle(ids).slice(0, 3);
}

function resolveEventChoice(choice) {
  if (choice === "leave") return finishEvent("你选择安全离开");
  if (choice === "box-open") {
    if (game.rng.next() < 0.5) {
      const item = game.randomItem({ rarity: "common" });
      if (item) showItemReward([item], advanceWeek, "纸箱里的物品");
      else finishEvent("纸箱是空的");
    } else {
      game.hp = Math.max(1, game.hp - 6);
      finishEvent("纸箱怪叫了一声：失去 6 生命");
    }
  } else if (choice === "box-pet") {
    gainPetBond(1, advanceWeek, "暴躁鹅确认没有危险，羁绊 +1");
  } else if (choice === "quiz-upgrade") {
    game.hp = Math.max(1, game.hp - 5);
    const cards = game.deck.filter((card) => !card.upgraded);
    showCardSelection({ title: "升级一张牌", eyebrow: "突击测验 · 失去 5 生命", cards, onSelect(card) { game.upgradeCard(card.uid); advanceWeek(); } });
  } else if (choice === "quiz-card") {
    game.flags.nextCombatTension += 2;
    showCardReward({ choices: game.rewardCards(3, "uncommon"), title: "借来的答案", allowReroll: false });
  } else if (choice === "club-attack" || choice === "club-skill") {
    showCardReward({ choices: pickFilteredCards(choice === "club-attack" ? "attack" : "skill"), title: "社团赠礼", allowReroll: false });
  } else if (choice === "club-pet") {
    game.gold -= 30;
    gainPetBond(2, advanceWeek, "暴躁鹅成为荣誉社员：羁绊 +2");
  } else if (choice === "meal-gold") {
    game.gold += 40;
    finishEvent("获得 40 校园币");
  } else if (choice === "meal-sale") {
    game.flags.nextShopHalf = true;
    finishEvent("下个商店的第一件物品半价");
  } else if (choice === "meal-pet") {
    game.flags.petSnackCombats += 3;
    finishEvent("接下来 3 场战斗，暴躁鹅初始充能 +1");
  } else if (choice === "rumor-fight") {
    game.startCombat(game.randomEnemy(), { hpMultiplier: 1.3 });
    registerEnemyEncounter();
    changeScreen("combat", { outcome: "event" });
  } else if (choice === "rumor-gold") {
    game.gold += 40;
    game.flags.nextEnemyBlock += 6;
    finishEvent("获得 40 币；下个敌人初始获得 6 护甲");
  } else if (choice === "rumor-heal") {
    const healed = game.heal(4);
    finishEvent(`恢复 ${healed} 生命`);
  } else if (choice === "locker-open") {
    game.hp = Math.max(1, game.hp - 6);
    const item = game.randomItem({ rarity: "common" });
    if (item) showItemReward([item], advanceWeek, "旧柜里的物品");
    else finishEvent("失去 6 生命，但柜子里没有新东西");
  } else if (choice === "locker-remove") {
    game.gold -= 50;
    showCardSelection({
      title: "管理员帮你清理一张牌",
      eyebrow: "已支付 50 校园币",
      cards: game.deck,
      disabled: () => game.deck.length <= 5,
      onSelect(card) { game.removeCard(card.uid); advanceWeek(); }
    });
  }
}

app.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;
  const action = button.dataset.action;

  if (action === "new-game") {
    game = new SemesterGame(Date.now(), selectedArchetype);
    lastEvent = null;
    changeScreen("map");
  } else if (action === "select-archetype") {
    selectedArchetype = button.dataset.id;
    render();
  } else if (action === "continue-game") {
    try {
      game = SemesterGame.fromJSON(readSave());
      selectedArchetype = game.archetypeId;
      changeScreen("map");
    } catch {
      clearSave();
      setToast("存档无法读取，已清理旧存档");
      render();
    }
  } else if (action === "return-title") {
    clearSave();
    game = new SemesterGame(Date.now(), selectedArchetype);
    changeScreen("intro");
  } else if (action === "map") {
    if (screen !== "map") setToast("请先完成当前节点");
  } else if (action === "choose-node") {
    startNode(WEEK_PLAN[game.week][Number(button.dataset.index)]);
  } else if (action === "play-card") {
    const result = game.playCard(button.dataset.uid);
    if (!result.ok) setToast(result.reason);
    recordCurrentCombat();
    render();
  } else if (action === "discard-card") {
    const result = game.discardCard(button.dataset.uid);
    if (!result.ok) setToast(result.reason);
    render();
  } else if (action === "end-turn") {
    const result = game.endTurn();
    if (!result.ok) setToast(result.reason);
    recordCurrentCombat();
    render();
  } else if (action === "pet-skill") {
    const result = game.usePetSkill();
    if (!result.ok) setToast(result.reason);
    recordCurrentCombat();
    render();
  } else if (action === "open-pile") {
    if (["drawPile", "discardPile", "exhaustPile"].includes(button.dataset.zone)) {
      pileView = button.dataset.zone;
      render();
    }
  } else if (action === "close-pile") {
    pileView = null;
    render();
  } else if (action === "combat-result") {
    resolveCombatResult();
  } else if (action === "take-reward-card") {
    finishCardReward(button.dataset.id);
  } else if (action === "skip-reward") {
    finishCardReward(null);
  } else if (action === "reroll-reward") {
    game.flags.eraserUsed = true;
    context.choices = game.rewardCards(3);
    render();
  } else if (action === "choose-item") {
    grantItem(button.dataset.id);
  } else if (action === "skip-item") {
    context.onDone();
  } else if (action === "replace-item") {
    const oldIndex = game.items.indexOf(button.dataset.id);
    if (oldIndex >= 0) {
      game.items.splice(oldIndex, 1, context.incoming);
      game.stats.itemsTaken += 1;
    }
    context.onDone();
  } else if (action === "cancel-replace") {
    changeScreen(context.cancelTo.screen, context.cancelTo.context);
  } else if (action === "open-deck") {
    const returnState = { screen, context };
    changeScreen("deck", { returnState });
  } else if (action === "close-deck") {
    const target = context.returnState || { screen: "map", context: {} };
    changeScreen(target.screen, target.context);
  } else if (action === "open-rules") {
    const returnState = { screen, context };
    changeScreen("rules", { returnState });
  } else if (action === "close-rules") {
    const target = context.returnState || { screen: "map", context: {} };
    changeScreen(target.screen, target.context);
  } else if (action === "open-stats") {
    const returnState = { screen, context };
    changeScreen("stats", { returnState });
  } else if (action === "close-stats") {
    const target = context.returnState || { screen: "map", context: {} };
    changeScreen(target.screen, target.context);
  } else if (action === "open-archive") {
    const returnState = { screen, context };
    const focusEnemy = game.combat?.enemy?.id || null;
    changeScreen("archive", { returnState, focusEnemy });
  } else if (action === "close-archive") {
    const target = context.returnState || { screen: "intro", context: {} };
    changeScreen(target.screen, target.context);
  } else if (action === "tutorial-next") {
    if (tutorialStep >= 2) {
      tutorialStep = -1;
      game.tutorialSeen = true;
    } else {
      tutorialStep += 1;
    }
    render();
  } else if (action === "skip-tutorial") {
    tutorialStep = -1;
    game.tutorialSeen = true;
    render();
  } else if (action === "select-deck-card") {
    const card = game.deck.find((candidate) => candidate.uid === button.dataset.uid);
    if (card && context.onSelect) context.onSelect(card);
  } else if (action === "enchant-card") {
    if (game.enchantCard(button.dataset.uid)) {
      game.stats.enchantments += 1;
      const done = context.onDone;
      setToast("星座刻印已写入卡牌");
      done();
    }
  } else if (action === "skip-enchantment") {
    context.onDone();
  } else if (action === "select-pet-talent") {
    if (game.resolvePetMilestone(button.dataset.id)) {
      const done = context.onDone;
      setToast(`暴躁鹅选择了${PET_TALENT_DEFS[game.pet.talent].name}`);
      done();
    }
  } else if (action === "upgrade-pet-talent") {
    if (game.resolvePetMilestone()) {
      const done = context.onDone;
      setToast(`${PET_TALENT_DEFS[game.pet.talent].name}提升至 Lv.${game.pet.talentLevel}`);
      done();
    }
  } else if (action === "cancel-selection") {
    context.onCancel?.();
  } else if (action === "rest-heal") {
    const healed = game.heal(15);
    setToast(`恢复 ${healed} 生命`);
    advanceWeek();
  } else if (action === "rest-pet") {
    gainPetBond(2, advanceWeek, "暴躁鹅羁绊 +2");
  } else if (action === "rest-upgrade") {
    const cards = game.deck.filter((card) => !card.upgraded);
    showCardSelection({ title: "整理课堂笔记", eyebrow: "升级一张牌", cards, onSelect(card) { game.upgradeCard(card.uid); advanceWeek(); } });
  } else if (action === "event-choice") {
    resolveEventChoice(button.dataset.choice);
  } else if (action === "buy-card") {
    const stock = context.cards[Number(button.dataset.index)];
    const price = discountedPrice({ common: 40, uncommon: 65, rare: 100 }[CARD_DEFS[stock.id].rarity]);
    if (!stock.sold && game.gold >= price) {
      game.gold -= price;
      game.addCard(stock.id);
      game.stats.cardsTaken += 1;
      if (CARD_DEFS[stock.id].archetype === game.archetypeId) game.stats.exclusiveTaken += 1;
      else game.stats.publicTaken += 1;
      stock.sold = true;
      render();
    }
  } else if (action === "buy-item") {
    const stock = context.items.find((entry) => entry.id === button.dataset.id);
    const price = discountedPrice({ common: 90, uncommon: 120, rare: 160 }[ITEM_DEFS[stock.id].rarity], true);
    if (!stock.sold && game.gold >= price) {
      if (game.items.length >= game.backpackCapacity) {
        setToast("书包已满，商店暂不提供替换服务");
      } else {
        game.gold -= price;
        game.addItem(stock.id);
        game.stats.itemsTaken += 1;
        stock.sold = true;
        game.flags.nextShopHalf = false;
        render();
      }
    }
  } else if (action === "shop-remove") {
    const shopContext = context;
    showCardSelection({
      title: "移除一张牌",
      eyebrow: `${shopContext.removePrice} 校园币`,
      cards: game.deck,
      canCancel: true,
      onSelect(card) {
        if (game.gold >= shopContext.removePrice && game.removeCard(card.uid)) {
          game.gold -= shopContext.removePrice;
          shopContext.removed = true;
          changeScreen("shop", shopContext);
        }
      },
      onCancel() { changeScreen("shop", shopContext); }
    });
  } else if (action === "leave-shop") {
    advanceWeek();
  } else if (action === "next-semester") {
    game.startNextSemester();
    changeScreen("map");
  }
});

render();
