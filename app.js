import {
  ACHIEVEMENT_DEFS,
  ALL_EVENT_IDS,
  ARCHETYPE_DEFS,
  ARCHETYPE_CARD_IDS,
  BOSS_ITEM_IDS,
  CARD_ART_DEFS,
  CARD_DEFS,
  ENEMY_DEFS,
  ENCHANTMENT_DEFS,
  EVENT_DEFS,
  ITEM_DEFS,
  PERSONA_DEFS,
  PERSONA_CARD_IDS,
  PET_EGG_DEFS,
  PET_DEFS,
  PET_TALENT_DEFS,
  RARITY_LABELS,
  PUBLIC_REWARD_CARD_IDS,
  SAFE_EVENT_IDS,
  SHOP_SCENE,
  SUPPLY_DEFS
} from "./game-data.js?v=1.8.62";
import { ARCHETYPE_TRIAL_DEFS, CHALLENGE_AFFIX_DEFS, CHALLENGE_REWARD_DEFS, CHALLENGE_RULES, HIGH_THREAT_ROUTE_BONUS_GOLD, NORMAL_COMBAT_REWARD_GOLD, TAROT_DEFS, SemesterGame, cardDefinition } from "./game-engine.js?v=1.8.62";
import { analyzeBuild, BUILD_STYLE_DEFS, challengeRewardGuidance, choiceGuidance, evaluateCardFit } from "./build-analysis.js?v=1.8.62";
import { CARD_LIBRARY_FILTERS, COMBAT_SHORTCUT_ACTION, END_TURN_ACTION, ITEM_LIBRARY_FILTERS, NEW_GAME_START, SEMESTER_WEEK_COUNT, battleFeedbackFromDelta, cardLibraryIds, combatCardTacticalCue, combatDirectActionPreview, combatEnergyState, combatImmediateCounterplayPlan, combatItemCue, combatMechanicStatusCleared, combatShortcutCommand, endTurnDecision, endTurnRiskGuidance, enemyHitPulseSequence, enemyIntentCounterplayCue, enemyIntentDetailLines, enemyMechanicProgress, enemyResolutionSnapshot, enemyResolveDuration, enemyStatusCausalPlacements, finalizeCombatPersistence, handCardPose, itemLibraryIds, newGameStartDecision, normalizeCardLibraryFilter, normalizeItemLibraryFilter, semesterCalendarWeeks, shouldShowCombatCardPreview } from "./app-flow.js?v=1.8.62";
import {
  STORAGE_RECORD_STATUS,
  createFeedbackReport,
  createSaveBackup,
  inspectStorageRecord,
  parseSaveBackup
} from "./save-transfer.js?v=1.8.62";
import {
  achievementProgress,
  createCareerProfile,
  normalizeCareerProfile,
  canSelectPersona,
  recordCareerCombat,
  recordEnemyEncounter,
  recordSemesterCompletion,
  trialCollectionProgress
} from "./career.js?v=1.8.62";

if (!window.gsap) {
  try {
    const gsapModule = await import("./vendor/gsap/index.js");
    window.gsap = gsapModule.gsap;
  } catch {
    // 外部脚本和本地模块都不可用时，保留原有 CSS 动画，玩法与输入不受影响。
  }
}

const app = document.querySelector("#app");
const toastLiveRegion = document.querySelector("#toast-live-region");
const APP_VERSION = "1.8.62";
const SAVE_KEY = "endless-semester-v2";
const CAREER_KEY = "endless-semester-career-v1";
const recentClientErrors = [];

function rememberClientError(type, error) {
  const message = error instanceof Error ? error.message : String(error ?? "未知错误");
  const stack = error instanceof Error ? error.stack : null;
  recentClientErrors.push({ type, message, stack, occurredAt: new Date().toISOString() });
  if (recentClientErrors.length > 5) recentClientErrors.splice(0, recentClientErrors.length - 5);
}

window.addEventListener("error", (event) => {
  rememberClientError("window.error", event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  rememberClientError("unhandledrejection", event.reason);
});
const storageFailures = { run: null, career: null };
let game = new SemesterGame();
let career = readCareer();
let hasActiveRun = false;
let screen = "intro";
let context = {};
let toast = "";
let selectedArchetype = "cancer";
let selectedPetId = "offlineDuck";
let selectedPersonaId = "student";
let tutorialStep = -1;
let pileView = null;
let battleFeedbackTimer = null;
let battleInputTimer = null;
let battleFeedbackSequence = 0;
let battleMotionTimeline = null;
let battleMotionMedia = null;
let lastAnimatedFeedbackId = 0;
let semesterCalendarOpen = false;
let mobileTopbarOpen = false;
let encounterStageView = "scene";
let encounterStageFrame = null;
let toastAnnouncementFrame = null;
let shopDetailState = null;

const ICONS = {
  combat: "⚔",
  event: "?",
  rest: "☕",
  shop: "▣"
};

const CALENDAR_EVENT_META = Object.freeze({
  combat: { icon: "⚔", label: "战斗" },
  elite: { icon: "◆", label: "期中精英" },
  challenge: { icon: "!", label: "挑战" },
  event: { icon: "?", label: "事件" },
  rest: { icon: "☕", label: "休息" },
  shop: { icon: "▣", label: "商店" },
  boss: { icon: "末", label: "期末" },
  unknown: { icon: "·", label: "待定" }
});

const ENEMY_ART = {
  sleepyBug: { mark: "Z Z", caption: "困意实体" },
  homeworkBlob: { mark: "DDL", caption: "作业聚合物" },
  alarmClock: { mark: "07:30", caption: "起床警报" },
  phoneSpirit: { mark: "99+", caption: "注意力捕手" },
  groupChat: { mark: "99+", caption: "群聊风暴" },
  printerJam: { mark: "卡纸", caption: "办公室异兽" },
  rollCallWarden: { mark: "到", caption: "缺席追查者" },
  clubMegaphone: { mark: "播", caption: "社团音浪" },
  rivalShadow: { mark: "S+", caption: "内卷投影" },
  finalExam: { mark: "期末", caption: "终极试卷" },
  madMilkDragon: { mark: "HA", caption: "失控奶泡异兽" }
};

const CHARACTER_ASSET_PATHS = Object.freeze({
  students: Object.freeze({
    aries: "assets/characters/student-jiahao-v1.webp",
    gemini: "assets/characters/student-jiahao-v1.webp",
    cancer: "assets/characters/student-jiahao-v1.webp"
  }),
  enemies: Object.freeze({
    sleepyBug: "assets/characters/enemy-sleepyBug-v1.webp",
    homeworkBlob: "assets/characters/enemy-homeworkBlob-v1.webp",
    alarmClock: "assets/characters/enemy-alarmClock-v1.webp",
    phoneSpirit: "assets/characters/enemy-phoneSpirit-v1.webp",
    groupChat: "assets/characters/enemy-groupChat-v1.webp",
    printerJam: "assets/characters/enemy-printerJam-v1.webp",
    rollCallWarden: "assets/characters/enemy-rollCallWarden-v1.webp",
    clubMegaphone: "assets/characters/enemy-clubMegaphone-v1.webp",
    rivalShadow: "assets/characters/enemy-rivalShadow-v1.webp",
    finalExam: "assets/characters/enemy-finalExam-v1.webp",
    madMilkDragon: "assets/characters/enemy-madMilkDragon-v1.webp"
  })
});

function currentPetDefinition() {
  return PET_DEFS[game.activePetId] || PET_DEFS[game.pet?.id] || PET_DEFS.offlineDuck;
}

function unlockedPetIds() {
  return [...new Set(["offlineDuck", ...(career.unlockedPetIds || [])])]
    .filter((id) => PET_DEFS[id]);
}

function selectedPetDefinition() {
  const available = unlockedPetIds();
  if (!available.includes(selectedPetId)) selectedPetId = "offlineDuck";
  return PET_DEFS[selectedPetId] || PET_DEFS.offlineDuck;
}

function unlockedPersonaIds() {
  return Object.keys(PERSONA_DEFS).filter((id) => canSelectPersona(career, id));
}

function selectedPersonaDefinition() {
  const available = unlockedPersonaIds();
  if (!available.includes(selectedPersonaId)) selectedPersonaId = "student";
  return PERSONA_DEFS[selectedPersonaId] || PERSONA_DEFS.student;
}

function petEggDefinition(eggId) {
  return PET_EGG_DEFS?.[eggId] || null;
}

function challengeRewardSourcePreview(enemyId, pending = null) {
  const canonicalEnemyId = ENEMY_DEFS[enemyId] ? enemyId : null;
  if (!canonicalEnemyId) return { enemy: null, egg: null, signatureItem: null };
  const frozen = pending?.type === "challengeChain" && pending.enemyId === canonicalEnemyId;
  const petState = frozen ? null : game.challengePetRewardState(canonicalEnemyId);
  const itemState = frozen ? null : game.challengeSignatureItemRewardState(canonicalEnemyId);
  const eggId = frozen
    ? (pending.rewardVariant === "egg" ? pending.eggId : null)
    : (petState?.rewardVariant === "egg" ? petState.eggId : null);
  const signatureItemId = frozen ? pending.signatureItemId : itemState?.signatureItemId;
  return {
    enemy: ENEMY_DEFS[canonicalEnemyId],
    egg: petEggDefinition(eggId),
    signatureItem: ITEM_DEFS[signatureItemId] || null
  };
}

function challengeRewardSourceHintText(enemyId, pending = null) {
  const preview = challengeRewardSourcePreview(enemyId, pending);
  const targets = [
    preview.egg ? `伙伴路线：${preview.egg.name}` : "",
    preview.signatureItem ? `失物招领：${preview.signatureItem.name}` : ""
  ].filter(Boolean);
  return targets.length ? `确定目标 · ${targets.join(" · ")}` : "";
}

function challengeRewardSourceHintHtml(enemyId, pending = null) {
  const hint = challengeRewardSourceHintText(enemyId, pending);
  return hint ? `<br><i class="challenge-source-hint">${escapeHtml(hint)}</i>` : "";
}

function eggRequiredCombats(egg) {
  return Math.max(1, Number(egg?.requiredCombats) || 3);
}

function eggVisualId(egg) {
  return egg?.visual || egg?.enemyId || egg?.sourceEnemyId || egg?.id || "unknown";
}

function petVisualId(pet) {
  return pet?.visual || pet?.id || "offlineDuck";
}

function petEggHtml(eggId, className = "pet-egg") {
  const egg = petEggDefinition(eggId);
  if (!egg) return "";
  const asset = egg.assets?.egg;
  return `<span class="${escapeHtml(className)} egg-${escapeHtml(eggVisualId(egg))} ${asset ? "has-image" : ""}" aria-hidden="true">
    ${asset ? `<img src="${escapeHtml(asset)}" alt="" loading="lazy" onerror="this.remove();this.parentElement.classList.remove('has-image')">` : ""}<i></i><b></b>
  </span>`;
}

function incubatorStatusHtml(location = "map") {
  const incubator = game.incubator;
  const egg = petEggDefinition(incubator?.eggId);
  if (!incubator || !egg) return "";
  const required = eggRequiredCombats(egg);
  const hatchCount = Math.min(required, Math.max(0, Number(incubator.battles) || 0));
  const hatchling = PET_DEFS[egg.petId];
  const percent = Math.round((hatchCount / required) * 100);
  return `<section class="incubator-status location-${escapeHtml(location)}" aria-label="${escapeHtml(`${egg.name}孵化进度 ${hatchCount}/${required}`)}">
    ${petEggHtml(egg.id)}
    <div><small>休息区孵化位 · 不占书包${game.queuedEggIds.length ? ` · 后续排队 ${game.queuedEggIds.length} 枚` : ""}</small><strong>${escapeHtml(egg.name)}</strong><p>还需在休息节点主动孵化 ${required - hatchCount} 次，才能得到${escapeHtml(hatchling?.name || "动物幼崽")}。</p></div>
    <span><b>${hatchCount}/${required}</b><i aria-hidden="true"><em style="width:${percent}%"></em></i></span>
  </section>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sceneBannerHtml(scene = {}, options = {}) {
  const content = { ...scene, ...options };
  const toneMap = { risk: "risk", safe: "safe", shop: "shop", neutral: "neutral", 紧张: "risk", 日常: "safe", 温暖: "shop" };
  const tone = toneMap[content.tone] || "neutral";
  const mark = content.mark || (tone === "shop" ? "店" : "?");
  const image = content.scene
    ? `<img class="scene-banner-image" src="${escapeHtml(content.scene)}" alt="${escapeHtml(content.sceneAlt || "")}" draggable="false" decoding="async"
        onload="this.closest('.scene-banner').classList.add('asset-ready')" onerror="this.remove()">`
    : "";
  return `<section class="scene-banner tone-${tone}">
    <div class="scene-banner-visual">
      <div class="scene-banner-fallback" aria-hidden="true"><span>${escapeHtml(mark)}</span><i></i><i></i></div>
      ${image}
      <div class="scene-banner-vignette" aria-hidden="true"></div>
    </div>
    <div class="scene-banner-copy">
      <small>${escapeHtml(content.eyebrow || "校园事件")}</small>
      <p>${escapeHtml(content.text || "前方似乎发生了什么。")}</p>
    </div>
  </section>`;
}

function encounterStageHtml({ id, sceneHtml, decisionHtml, decisionLabel = "选择" }) {
  const safeId = escapeHtml(id);
  const activeView = encounterStageView === "decision" ? "decision" : "scene";
  const tabHtml = (view, label) => {
    const selected = activeView === view;
    return `<button type="button" id="${safeId}-${view}-tab" role="tab" data-action="switch-encounter-stage" data-stage-view="${view}"
      aria-selected="${selected}" aria-controls="${safeId}-${view}-panel" tabindex="${selected ? "0" : "-1"}">${escapeHtml(label)}</button>`;
  };
  const panelHtml = (view, html) => `<div class="encounter-stage-panel is-${view}" id="${safeId}-${view}-panel" role="tabpanel"
    data-stage-panel="${view}" aria-labelledby="${safeId}-${view}-tab" tabindex="-1">${html}</div>`;

  return `<section class="encounter-stage" data-encounter-stage="${safeId}">
    <div class="encounter-stage-tabs" role="tablist" aria-label="场景与${escapeHtml(decisionLabel)}">
      ${tabHtml("scene", "场景")}
      ${tabHtml("decision", decisionLabel)}
    </div>
    <div class="encounter-stage-track" data-encounter-stage-track>
      ${panelHtml("scene", sceneHtml)}
      ${panelHtml("decision", decisionHtml)}
    </div>
  </section>`;
}

function clearToastAnnouncement() {
  if (!toastLiveRegion) return;
  if (toastAnnouncementFrame !== null) window.cancelAnimationFrame(toastAnnouncementFrame);
  toastAnnouncementFrame = null;
  toastLiveRegion.textContent = "";
}

function announceToast(message) {
  if (!toastLiveRegion) return;
  clearToastAnnouncement();
  toastAnnouncementFrame = window.requestAnimationFrame(() => {
    toastAnnouncementFrame = null;
    toastLiveRegion.textContent = String(message);
  });
}

function setToast(message) {
  toast = message;
  announceToast(message);
  window.clearTimeout(setToast.timer);
  setToast.timer = window.setTimeout(() => {
    toast = "";
    clearToastAnnouncement();
    render();
  }, 2200);
}

function rarityName(rarity) {
  return RARITY_LABELS[rarity] || ({ starter: "基础", status: "状态" }[rarity] || rarity);
}

function cardArtHtml(card, definition) {
  const art = CARD_ART_DEFS[card.id] || {
    symbol: definition.type === "attack" ? "击" : definition.type === "status" ? "!" : "策",
    caption: definition.type === "attack" ? "发起攻击" : definition.type === "status" ? "负面状态" : "执行策略",
    motif: definition.type
  };
  const imageStyle = [
    `object-position:${art.focus || "50% 50%"}`,
    art.tone ? `--card-image-filter:${art.tone}` : "",
    art.hoverTone ? `--card-image-hover-filter:${art.hoverTone}` : ""
  ].filter(Boolean).join(";");
  const visual = art.image
    ? `<img src="${escapeHtml(art.image)}" alt="" style="${escapeHtml(imageStyle)}" draggable="false">`
    : `<i class="card-art-orbit"></i><b>${escapeHtml(art.symbol)}</b><em>${escapeHtml(art.caption)}</em>`;
  return `<span class="card-art art-${art.motif} ${art.image ? "has-image" : ""}" aria-hidden="true">
    ${visual}
  </span>`;
}

function validStoredRun(data) {
  if (!(data?.version === 2 && ARCHETYPE_DEFS[data.archetypeId] && Array.isArray(data.deck))) return false;
  try {
    SemesterGame.fromJSON(data);
    return true;
  } catch {
    return false;
  }
}

function readSaveState() {
  try {
    return inspectStorageRecord(localStorage.getItem(SAVE_KEY), validStoredRun);
  } catch (error) {
    return { status: "unavailable", value: null, raw: null, reason: error instanceof Error ? error.message : "storage-unavailable" };
  }
}

function readSave() {
  const state = readSaveState();
  return state.status === STORAGE_RECORD_STATUS.valid ? state.value : null;
}

function readCareer() {
  try {
    return normalizeCareerProfile(JSON.parse(localStorage.getItem(CAREER_KEY)));
  } catch {
    return createCareerProfile();
  }
}

function saveGame() {
  if (game.combat?.status === "lost") return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game.toJSON()));
    storageFailures.run = null;
    return true;
  } catch (error) {
    storageFailures.run = { occurredAt: new Date().toISOString(), message: error instanceof Error ? error.message : "本地存档写入失败" };
    rememberClientError("storage.run.write", error);
    setToast("浏览器未允许本地存档，本次仍可继续游玩");
    return false;
  }
}

function saveCareer() {
  try {
    localStorage.setItem(CAREER_KEY, JSON.stringify(career));
    storageFailures.career = null;
    return true;
  } catch (error) {
    storageFailures.career = { occurredAt: new Date().toISOString(), message: error instanceof Error ? error.message : "生涯档案写入失败" };
    rememberClientError("storage.career.write", error);
    setToast("生涯进度尚未保存，请先不要关闭页面");
    return false;
  }
}

function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
    storageFailures.run = null;
    return true;
  } catch (error) {
    storageFailures.run = { occurredAt: new Date().toISOString(), message: error instanceof Error ? error.message : "本地存档清理失败" };
    rememberClientError("storage.run.clear", error);
    return false;
  }
}

function topBar(mobileTopbarOpen = false) {
  if (screen === "intro" || (["library", "itemLibrary"].includes(screen) && context.returnState?.screen === "intro")) return "";
  const hpPercent = Math.max(0, (game.hp / game.maxHp) * 100);
  const bondStage = game.pet.bond >= 25 ? "生死之交" : game.pet.bond >= 10 ? "默契搭档" : game.pet.bond >= 3 ? "熟悉伙伴" : "刚认识";
  const petTalent = game.pet.talent ? PET_TALENT_DEFS[game.pet.talent] : null;
  const pet = currentPetDefinition();
  return `
    <header class="topbar${mobileTopbarOpen ? " mobile-menu-open" : ""}">
      <button class="brand" data-action="map" title="当前学期">无限学期 <small>V1.8.62</small></button>
      <div class="resource health-resource" title="生命会在战斗之间保留">
        <span>♥ ${game.hp}/${game.maxHp}</span>
        <i><b style="width:${hpPercent}%"></b></i>
      </div>
      <div class="resource resource-stat campus-coin-resource" aria-label="校园币：${game.gold}">
        <span class="resource-icon campus-coin-icon" aria-hidden="true"></span><span>${game.gold}<span class="resource-unit"> 校园币</span></span>
      </div>
      ${screen !== "combat" ? `
        <button type="button" class="mobile-topbar-toggle" data-action="toggle-mobile-topbar" aria-expanded="${mobileTopbarOpen}" aria-controls="mobile-topbar-menu">
          <span aria-hidden="true">•••</span><b>更多</b>
        </button>
        <div id="mobile-topbar-menu" class="mobile-topbar-menu"${mobileTopbarOpen ? ' role="dialog" aria-modal="true" aria-label="更多状态与入口" data-action="close-mobile-topbar" data-dismiss="backdrop"' : ""}>
          <div class="mobile-topbar-panel">
            ${mobileTopbarOpen ? '<button type="button" class="mobile-topbar-close" data-action="close-mobile-topbar" autofocus><span>更多</span><b aria-hidden="true">×</b></button>' : ""}
            <div class="resource resource-stat deck-resource" aria-label="卡组：${game.deck.length} 张牌">
              <span class="resource-icon deck-stack-icon" aria-hidden="true"></span><span>${game.deck.length} 张牌</span>
            </div>
            <div class="resource resource-stat items-resource" aria-label="随身物品：${game.items.length} 件，容量 ${game.backpackCapacity} 件">
              <span class="resource-icon backpack-icon" aria-hidden="true"></span><span>${game.items.length}/${game.backpackCapacity} 物品</span>
            </div>
            <div class="resource pet-resource">${pet.shortName}羁绊 ${game.pet.bond} · ${petTalent ? `${petTalent.name} Lv.${game.pet.talentLevel}` : bondStage}</div>
            <div class="resource sign-resource">${game.archetype.sign} ${game.archetype.label}</div>
            ${game.tarot ? `<div class="resource tarot-resource">${game.tarot.number} · ${game.tarot.name}</div>` : ""}
            ${screen !== "rules" ? '<button class="quiet-button" data-action="open-rules">规则</button>' : ""}
            ${screen !== "stats" ? '<button class="quiet-button" data-action="open-stats">战绩</button>' : ""}
            ${screen !== "deck" ? `<button class="quiet-button" data-action="open-deck">卡牌</button>` : ""}
            ${screen !== "items" ? '<button class="quiet-button" data-action="open-items">物品</button>' : ""}
          </div>
        </div>
      ` : `
        <div class="resource resource-stat deck-resource" aria-label="手牌：${game.combat?.hand.length || 0} 张">
          <span class="resource-icon deck-stack-icon" aria-hidden="true"></span><span>${game.combat?.hand.length || 0} 手牌</span>
        </div>
        <div class="resource resource-stat items-resource" aria-label="随身物品：${game.items.length} 件，容量 ${game.backpackCapacity} 件">
          <span class="resource-icon backpack-icon" aria-hidden="true"></span><span>${game.items.length}/${game.backpackCapacity} 物品</span>
        </div>
        <div class="resource pet-resource">${pet.shortName}羁绊 ${game.pet.bond} · ${petTalent ? `${petTalent.name} Lv.${game.pet.talentLevel}` : bondStage}</div>
        <div class="resource sign-resource">${game.archetype.sign} ${game.archetype.label}</div>
        ${game.tarot ? `<div class="resource tarot-resource">${game.tarot.number} · ${game.tarot.name}</div>` : ""}
        <button class="quiet-button" data-action="open-rules">规则</button>
        <button class="quiet-button" data-action="open-stats">战绩</button>
        <button class="quiet-button" data-action="open-deck">手牌</button>
        <button class="quiet-button" data-action="open-items">物品</button>
      `}
    </header>`;
}

function storageFailureWarning() {
  const failed = [storageFailures.run ? "本局进度" : "", storageFailures.career ? "生涯解锁" : ""].filter(Boolean);
  if (!failed.length) return "";
  return `<aside class="storage-failure-warning" role="alert">
    <span><b>进度尚未保存</b><small>${failed.join("、")}写入失败。请保持页面开启，并先导出当前内存存档。</small></span>
    <button type="button" class="quiet-button" data-action="open-emergency-save">立即备份</button>
  </aside>`;
}

function page(title, eyebrow, body, options = {}) {
  return `
    ${topBar(mobileTopbarOpen)}
    ${storageFailureWarning()}
    <section class="page ${options.className || ""}">
      <div class="page-heading">
        <p class="eyebrow">${eyebrow || ""}</p>
        <h1>${title}</h1>
        ${options.description ? `<p class="description">${options.description}</p>` : ""}
      </div>
      ${body}
    </section>
    ${toast ? `<div class="toast" aria-hidden="true">${escapeHtml(toast)}</div>` : ""}`;
}

function combatCardPreviewHtml(preview) {
  if (!shouldShowCombatCardPreview(preview)) return "";
  const values = [];
  if (preview.hasDamage) {
    const damage = preview.hits > 1
      ? `${preview.damagePerHit}×${preview.hits}=${preview.attackTotal}`
      : `${preview.attackTotal}`;
    values.push(`伤害 ${damage}`);
    if (preview.healthDamage !== preview.attackTotal) values.push(`敌人掉血 ${preview.healthDamage}`);
  }
  if (preview.block) values.push(`护甲 +${preview.block}`);
  if (preview.selfDamage) values.push(`自伤 ${preview.selfDamage}`);
  if (!values.length) return "";
  const detail = preview.modifiers.length ? preview.modifiers.join(" · ") : "敌方护甲已计入";
  return `<span class="card-live-preview" title="${escapeHtml(detail)}"><b>当前</b>${values.join(" · ")}</span>`;
}

function cardHtml(card, options = {}) {
  const instance = typeof card === "string" ? { id: card, uid: card, upgraded: false } : card;
  const definition = cardDefinition(instance);
  const owner = definition.archetype ? ARCHETYPE_DEFS[definition.archetype] : null;
  const playable = options.playable !== false;
  const action = options.action || "play-card";
  const cost = definition.cost === null ? "—" : definition.cost;
  const fit = options.fit;
  const tacticalCue = options.tacticalCue;
  const displayName = `${definition.displayName}${instance.upgraded && !String(definition.displayName).trimEnd().endsWith("+") ? "+" : ""}`;
  const typeLabel = ({ attack: "攻击", skill: "技能", power: "能力", ability: "能力", status: "状态" })[definition.type] || "技能";
  const rarityLabel = definition.rarity === "status" ? "" : rarityName(definition.rarity);
  const extraClass = options.className ? ` ${escapeHtml(options.className)}` : "";
  const tacticalClass = tacticalCue ? ` tactical-${escapeHtml(tacticalCue.tone)}` : "";
  const pressed = typeof options.pressed === "boolean" ? ` aria-pressed="${options.pressed}"` : "";
  const handStyle = options.handPose
    ? `style="--hand-angle:${options.handPose.angle}deg;--hand-drop:${options.handPose.drop}px;--hand-layer:${options.handPose.layer}"`
    : "";
  const rewardAttributes = options.rewardSource && options.rewardToken
    ? ` data-reward-source="${escapeHtml(options.rewardSource)}" data-reward-token="${escapeHtml(options.rewardToken)}"`
    : "";
  const ariaKeyShortcut = options.ariaKeyShortcut || options.shortcut;
  return `
    <button type="button" class="game-card type-${definition.type} rarity-${definition.rarity} ${owner ? `exclusive-card exclusive-${owner.id}` : ""} ${playable ? "" : "disabled"}${extraClass}${tacticalClass}"
      title="${owner ? `${owner.name}专属 · ` : ""}${rarityName(definition.rarity)}${definition.enchantment ? ` · ${definition.enchantment.name}` : ""}"
      data-action="${action}" data-uid="${instance.uid}" data-id="${instance.id}"${rewardAttributes}${pressed} ${handStyle} ${ariaKeyShortcut ? `aria-keyshortcuts="${escapeHtml(ariaKeyShortcut)}"` : ""} ${options.ariaHidden ? 'aria-hidden="true"' : ""} ${playable ? "" : "disabled"}>
      <span class="card-cost" data-cost="${cost}" aria-label="费用 ${cost}"><b>${cost}</b></span>
      ${options.shortcut ? `<kbd class="card-shortcut" aria-hidden="true">${options.shortcut}</kbd>` : ""}
      ${definition.enchantment ? `<span class="card-enchantment" title="${definition.enchantment.text}">${definition.enchantment.sign}</span>` : ""}
      <span class="card-name"><strong>${displayName}</strong></span>
      ${cardArtHtml(instance, definition)}
      <span class="card-type-banner"><i aria-hidden="true"></i><b>${owner ? `${owner.sign} · ` : ""}${typeLabel}${rarityLabel ? `<small class="card-rarity-label">${rarityLabel}</small>` : ""}</b><i aria-hidden="true"></i></span>
      ${tacticalCue ? `<span class="card-tactical-cue cue-${escapeHtml(tacticalCue.tone)}" title="${escapeHtml(tacticalCue.detail)}" aria-hidden="true"><b>${escapeHtml(tacticalCue.label)}</b></span><span class="sr-only card-tactical-description">${escapeHtml(tacticalCue.detail)}</span>` : ""}
      <span class="card-text">${definition.displayText}</span>
      ${combatCardPreviewHtml(options.combatPreview)}
      ${fit ? `<span class="card-fit fit-${fit.id}"><b>${fit.label}</b><em>${fit.reason}</em></span>` : ""}
    </button>`;
}

const ITEM_ICON_FALLBACK = Object.freeze({
  autoPencil: "铅", thickNotebook: "本", studentId: "证", mistakeBook: "错", earplugs: "塞",
  bandage: "贴", petSnack: "粮", eraser: "擦", silentPhone: "机", allNighter: "宵", referenceBooks: "参"
});

function itemIconHtml(item, className = "item-icon") {
  const fallback = ITEM_ICON_FALLBACK[item.id] || (item.rarity === "boss" ? "★" : "◇");
  return `<span class="${className} ${item.art ? "has-image" : ""}" aria-hidden="true">${item.art ? `<img src="${item.art}" alt="" loading="lazy">` : fallback}</span>`;
}

function itemHtml(id, options = {}) {
  const item = ITEM_DEFS[id];
  return `
    <button class="item-tile rarity-${item.rarity} ${options.className || ""}" data-action="${options.action || "choose-item"}" data-id="${id}" ${options.ariaKeyShortcut ? `aria-keyshortcuts="${escapeHtml(options.ariaKeyShortcut)}"` : ""}
      ${options.disabled ? "disabled" : ""}>
      ${itemIconHtml(item)}
      <span><small>${rarityName(item.rarity)}物品 · ${item.timing}${item.source ? ` · ${item.source}` : ""}</small><strong>${item.name}</strong><em>${item.text}</em></span>
      ${options.price !== undefined ? `<b>${typeof options.price === "number" ? `${options.price} 币` : options.price}</b>` : ""}
    </button>`;
}

function renderIntro() {
  const storedSave = readSaveState();
  const saved = storedSave.status === STORAGE_RECORD_STATUS.valid ? storedSave.value : null;
  const blockedByStoredSave = [STORAGE_RECORD_STATUS.corrupt, "unavailable"].includes(storedSave.status);
  const pet = selectedPetDefinition();
  const persona = selectedPersonaDefinition();
  const availablePets = unlockedPetIds();
  const savedAtSemesterEnd = saved?.awaitingNextSemester === true && Number(saved.week) === 16;
  const savedAtSemesterReward = Number(saved?.week) === 16
    && ["bossEgg", "bossItem", "summaryUpgrade"].includes(saved?.pendingSemesterReward?.stage);
  const savedAtCombatReward = Number(saved?.week) < 16
    && ["normalCard", "eliteChain", "challengeChain", "eventItem"].includes(saved?.pendingCombatReward?.type);
  const savedAtCombatStart = Number(saved?.week) <= 16
    && ["normal", "elite", "boss", "challenge", "event"].includes(saved?.pendingCombatStart?.outcome);
  const savedAtEventReward = Number(saved?.week) < 16
    && ["card", "upgrade", "remove", "item"].includes(saved?.pendingEventReward?.type);
  const savedAtPendingEvent = Number(saved?.week) < 16 && Boolean(EVENT_DEFS[saved?.pendingEventId]);
  const savedAtItemReplacement = ["combat", "event", "semester", "shop"].includes(saved?.pendingItemReplacement?.source)
    && Boolean(ITEM_DEFS[saved?.pendingItemReplacement?.incoming]);
  const savedAtRest = Number(saved?.week) < 16
    && ["choice", "upgrade", "pet", "tarotRemove", "tarotUpgrade", "tarotBond", "hatch"].includes(saved?.pendingRest?.stage);
  const savedAtPetMilestone = Number(saved?.week) < 16 && ["choose", "upgrade", "master"].includes(saved?.pet?.pendingMilestone);
  const savedAtShop = Number(saved?.week) < 16 && Array.isArray(saved?.pendingShop?.cards);
  const continueProgress = savedAtItemReplacement
    ? `继续第 ${saved.semester} 学期 · 整理书包`
    : savedAtSemesterReward
    ? `继续第 ${saved.semester} 学期 · 期末结算`
    : savedAtCombatReward
    ? `继续第 ${saved.semester} 学期 · 战斗奖励`
    : savedAtCombatStart
    ? `继续第 ${saved.semester} 学期 · 战斗开局`
    : savedAtEventReward
    ? `继续第 ${saved.semester} 学期 · 事件奖励`
    : savedAtPendingEvent
    ? `继续第 ${saved.semester} 学期 · 问号事件`
    : savedAtRest
    ? `继续第 ${saved.semester} 学期 · 休息节点`
    : savedAtPetMilestone
    ? `继续第 ${saved.semester} 学期 · 羁绊成长`
    : savedAtShop
    ? `继续第 ${saved.semester} 学期 · 校园商店`
    : savedAtSemesterEnd
    ? `继续第 ${saved.semester} 学期 · 期末总结`
    : saved ? `继续第 ${saved.semester} 学期 · 第 ${saved.week} 周` : "";
  return `
    <section class="intro-shell">
      <div class="notebook-lines"></div>
      <div class="intro-copy">
        ${storageFailureWarning()}
        ${blockedByStoredSave ? `<aside class="corrupt-save-warning" role="alert">
          <span><small>检测到异常存档</small><strong>${storedSave.status === "unavailable" ? "浏览器暂时拒绝读取本地存档" : "旧存档无法安全读取，但原始数据仍然保留"}</strong><p>为避免覆盖现有数据，开始新游戏已暂时锁定。请先查看、复制或明确丢弃异常存档。</p></span>
          <button type="button" class="quiet-button" data-action="open-corrupt-save">处理异常存档</button>
        </aside>` : ""}
        <p class="eyebrow">学生 × 卡牌构筑 × 宠物羁绊</p>
        <h1>无限学期</h1>
        <p class="intro-lead">上课、摸鱼、打期末。每张牌一句话看懂，但每个选择都会改变你的构筑。</p>
        <div class="rule-strip">
          <span><b>3</b> 能量</span><span><b>5</b> 张手牌</span><span><b>16</b> 周一学期</span><span><b>1</b> 只${pet.name}</span>
        </div>
        <div class="archetype-picker">
          ${Object.values(ARCHETYPE_DEFS).map((archetype) => `
            <button data-action="select-archetype" data-id="${archetype.id}" class="archetype-option ${selectedArchetype === archetype.id ? "selected" : ""}">
              <span>${archetype.sign}</span><strong>${archetype.name}</strong><small>${archetype.label}</small><em>${archetype.text}</em><b>特性牌：${archetype.specialCardLabel}</b>
            </button>`).join("")}
        </div>
        <div class="starting-pet-heading persona-heading"><div><small>本局人格</small><strong>选择这次开学的玩法核心</strong></div><span>第二学期通关后解锁召唤人格</span></div>
        <div class="persona-picker" role="group" aria-label="选择本局人格">
          ${Object.values(PERSONA_DEFS).map((option) => {
            const unlocked = canSelectPersona(career, option.id);
            const selected = selectedPersonaId === option.id;
            return `<button class="persona-option ${selected ? "selected" : ""} ${unlocked ? "" : "locked"}" data-action="select-persona" data-id="${escapeHtml(option.id)}" aria-pressed="${selected}" ${unlocked ? "" : "disabled"}>
              <span>${unlocked ? option.icon : "锁"}</span><strong>${escapeHtml(option.name)}</strong><small>${unlocked ? escapeHtml(option.label) : `完成第 ${option.unlockSemester} 学期解锁`}</small><em>${escapeHtml(option.text)}</em>
            </button>`;
          }).join("")}
        </div>
        <div class="starting-pet-heading"><div><small>开局伙伴</small><strong>选择本局参战宠物</strong></div><span>开始后锁定，直到下一局才能更换</span></div>
        <div class="starting-pet-picker" role="group" aria-label="选择本局参战宠物">
          ${availablePets.map((petId) => {
            const option = PET_DEFS[petId];
            const selected = selectedPetId === petId;
            return `<button class="starting-pet-option ${selected ? "selected" : ""}" data-action="select-starting-pet" data-id="${escapeHtml(petId)}" aria-pressed="${selected}">
              ${renderPetFaceFor(petId)}
              <span><small>${selected ? "本局已选择" : "已解锁"}</small><strong>${escapeHtml(option.name)}</strong><em>${escapeHtml(option.skill.name)} · ${option.maxCharge} 点充能</em></span>
              <b>${selected ? "同行中" : "选择"}</b>
            </button>`;
          }).join("")}
        </div>
        <div class="intro-run-actions">
          <button class="primary big" data-action="new-game" ${blockedByStoredSave ? "disabled" : ""}>${blockedByStoredSave ? "请先处理异常存档" : saved ? `以${persona.name}开始新游戏（覆盖当前进度）` : `以${persona.name}开始第一学期`}</button>
          ${saved ? `<button class="continue-button" data-action="continue-game">${continueProgress}<br><small>${ARCHETYPE_DEFS[saved.archetypeId].name} · ${saved.deck.length} 张牌</small></button>` : ""}
        </div>
        <div class="intro-meta-actions">
          <button class="continue-button" data-action="open-archive">生涯档案 · ${career.unlockedAchievements.length}/${Object.keys(ACHIEVEMENT_DEFS).length} 成就</button>
          <button class="continue-button" data-action="open-library">卡牌图鉴 · ${Object.keys(CARD_DEFS).length} 张正式卡图</button>
          <button class="continue-button" data-action="open-item-library">物品图鉴 · ${Object.keys(ITEM_DEFS).length} 件随身物品</button>
        </div>
        <p class="prototype-note">本版是完整规则灰盒：无付费、无体力墙、无概率付费抽卡。</p>
      </div>
      <aside class="intro-card-stack">
        <div class="poster-card poster-a"><span>1</span><strong>课本拍击</strong><b>5</b><small>造成 5 点伤害</small></div>
        <div class="poster-card poster-b"><span>1</span><strong>书包护身</strong><b>5</b><small>获得 5 点护甲</small></div>
        <div class="intro-pet" role="img" aria-label="${pet.name}">${renderPetFaceFor(pet.id)}<b>${pet.name}</b></div>
      </aside>
    </section>`;
}

function renderNewGameConfirm() {
  const saved = context.saved;
  const savedAtSemesterEnd = saved?.awaitingNextSemester === true && Number(saved.week) === 16;
  const savedAtSemesterReward = Number(saved?.week) === 16
    && ["bossEgg", "bossItem", "summaryUpgrade"].includes(saved?.pendingSemesterReward?.stage);
  const savedAtCombatReward = Number(saved?.week) < 16
    && ["normalCard", "eliteChain", "challengeChain", "eventItem"].includes(saved?.pendingCombatReward?.type);
  const savedAtCombatStart = Number(saved?.week) <= 16
    && ["normal", "elite", "boss", "challenge", "event"].includes(saved?.pendingCombatStart?.outcome);
  const savedAtEventReward = Number(saved?.week) < 16
    && ["card", "upgrade", "remove", "item"].includes(saved?.pendingEventReward?.type);
  const savedAtPendingEvent = Number(saved?.week) < 16 && Boolean(EVENT_DEFS[saved?.pendingEventId]);
  const savedAtItemReplacement = ["combat", "event", "semester", "shop"].includes(saved?.pendingItemReplacement?.source)
    && Boolean(ITEM_DEFS[saved?.pendingItemReplacement?.incoming]);
  const savedAtRest = Number(saved?.week) < 16
    && ["choice", "upgrade", "pet", "tarotRemove", "tarotUpgrade", "tarotBond", "hatch"].includes(saved?.pendingRest?.stage);
  const savedAtPetMilestone = Number(saved?.week) < 16 && ["choose", "upgrade", "master"].includes(saved?.pet?.pendingMilestone);
  const savedAtShop = Number(saved?.week) < 16 && Array.isArray(saved?.pendingShop?.cards);
  const oldArchetype = ARCHETYPE_DEFS[saved?.archetypeId];
  const nextArchetype = ARCHETYPE_DEFS[context.archetypeId] || ARCHETYPE_DEFS[selectedArchetype];
  const nextPet = PET_DEFS[context.petId] || selectedPetDefinition();
  return `
    <section class="intro-shell new-game-confirm-shell">
      <div class="notebook-lines"></div>
      <div class="intro-copy new-game-confirm-copy">
        <p class="eyebrow">覆盖本地进度</p>
        <h1>确定重新开学？</h1>
        <p class="intro-lead">新游戏会替换当前对局存档，这一步确认后无法撤销。</p>
        <div class="save-overwrite-summary">
          <article><small>将被覆盖</small><strong>${savedAtItemReplacement ? `第 ${saved.semester} 学期 · 书包待整理` : savedAtSemesterReward ? `第 ${saved.semester} 学期 · 期末待结算` : savedAtCombatReward ? `第 ${saved.semester} 学期 · 战斗奖励待选择` : savedAtCombatStart ? `第 ${saved.semester} 学期 · 战斗开局待继续` : savedAtEventReward ? `第 ${saved.semester} 学期 · 事件奖励待选择` : savedAtPendingEvent ? `第 ${saved.semester} 学期 · 问号事件待选择` : savedAtRest ? `第 ${saved.semester} 学期 · 休息待结算` : savedAtPetMilestone ? `第 ${saved.semester} 学期 · 羁绊成长待选择` : savedAtShop ? `第 ${saved.semester} 学期 · 商店待离开` : savedAtSemesterEnd ? `第 ${saved.semester} 学期 · 已完成` : `第 ${saved?.semester || 1} 学期 · 第 ${saved?.week || 1} 周`}</strong><span>${oldArchetype ? `${oldArchetype.sign} ${oldArchetype.name}` : "现有学生"} · ${saved?.deck?.length || 0} 张牌</span></article>
          <b>→</b>
          <article class="new-run-summary"><small>准备开始</small><strong>第 1 学期 · 第 1 周</strong><span>${nextArchetype.sign} ${nextArchetype.name} · ${escapeHtml(nextPet.name)}同行</span></article>
        </div>
        <div class="overwrite-warning"><b>会重置</b><span>学期、卡组、校园币、随身物品与本局宠物养成</span><b>不会重置</b><span>生涯档案、敌人图鉴、成就与已解锁宠物</span></div>
        <div class="confirm-actions new-game-confirm-actions">
          <button class="quiet-button" data-action="cancel-new-game">取消，继续当前进度</button>
          <button class="primary" data-action="confirm-new-game">确认覆盖并开始</button>
        </div>
      </div>
    </section>`;
}

function renderTarotChoice() {
  const body = `
    <div class="tarot-rule">
      <span>✦</span><div><small>每学期一次</small><strong>选择一张命运牌</strong><p>收益和代价会同时生效，并在地图与每场战斗中持续公开。本学期选定后不能更换。</p></div>
    </div>
    <div class="tarot-grid">
      ${Object.values(TAROT_DEFS).map((tarot) => `
        <button class="tarot-card tarot-${tarot.id}" data-action="choose-tarot" data-id="${tarot.id}">
          <small>${tarot.number} · MAJOR ARCANA</small>
          <span>${tarot.icon}</span>
          <h2>${tarot.name}</h2>
          <em>${tarot.tagline}</em>
          <dl><dt>收益</dt><dd>${tarot.boon}</dd><dt>代价</dt><dd>${tarot.cost}</dd></dl>
          <b>签下本学期契约 →</b>
        </button>`).join("")}
    </div>
    <div class="privacy-note">旧存档如果还没有命运牌，会在当前位置补选一次；不会重置周数、卡组或已有进度。</div>`;
  return page("抽取本学期命运", `第 ${game.semester} 学期 · 塔罗契约`, body, {
    description: "不是白送强化：每张牌都用明确代价换一种构筑节奏。",
    className: "tarot-page"
  });
}

function renderMap() {
  const nodes = game.semesterPlan[game.week] || [];
  const coreCombatChoiceWeeks = [4, 6, 11, 14, 15];
  const isCoreCombatChoiceWeek = nodes.length === 2
    && nodes.every((node) => node.type === "combat" && !node.challenge);
  const routeUsesCoreCombatDensity = coreCombatChoiceWeeks.every((week) => (
    game.semesterPlan[week]?.length === 2
    && game.semesterPlan[week].every((node) => node.type === "combat" && !node.challenge)
  ));
  const trial = ARCHETYPE_TRIAL_DEFS[game.archetypeId];
  const tarot = game.tarot;
  const calendarWeeks = semesterCalendarWeeks(game.semesterPlan, game.week);
  const nextChallenge = Array.from(
    { length: 17 - game.week },
    (_, index) => game.week + index
  ).map((week) => ({ week, node: game.semesterPlan[week].find((node) => node.challenge) }))
    .find((entry) => entry.node);
  const challengeHpPercent = Math.round((CHALLENGE_RULES.hpMultiplier - 1) * 100);
  const challengeDamagePercent = Math.round((CHALLENGE_RULES.damageMultiplier - 1) * 100);
  const nodeTypeName = (node) => node.challenge ? "挑战" : ({ combat: "战斗", event: "未知", rest: "休息", shop: "商店" }[node.type]);
  const normalRouteDetailHtml = (node) => {
    if (node.type !== "combat" || node.challenge || !Number.isInteger(node.routeThreat) || node.routeThreat <= 0) return "";
    const bonusGold = node.bonusGold === HIGH_THREAT_ROUTE_BONUS_GOLD ? HIGH_THREAT_ROUTE_BONUS_GOLD : 0;
    const totalGold = NORMAL_COMBAT_REWARD_GOLD + bonusGold;
    return `<em class="normal-route-detail"><span>${escapeHtml(ENEMY_DEFS[node.enemy].mechanicName)} · 威胁 ${node.routeThreat}</span><span>${bonusGold ? `<i class="route-threat-chip">高压加练 +${bonusGold} 币</i>` : "常规路线"} · 胜利共 ${totalGold} 币</span></em>`;
  };
  const currentWeekSymbols = calendarWeeks[game.week - 1]?.nodes
    .map((node) => (CALENDAR_EVENT_META[node.type] || CALENDAR_EVENT_META.unknown).icon)
    .join(" ") || "·";
  const nextChallengeSummary = nextChallenge
    ? `下一场挑战：第 ${nextChallenge.week} 周 · ${CHALLENGE_AFFIX_DEFS[nextChallenge.node.affix].name} · ${trial.name}`
    : "本学期挑战已完成";
  const body = `
    <div class="route-callout">
      <div><small>当前目标</small><strong>${game.week === 16 ? "通过期末考试" : `完成第 ${game.week} 周`}</strong></div>
      <p>${game.week === 8 ? "期中精英战：拖得越久，伤害越高。" : game.week === 16 ? "一切意图都公开。用你的构筑交卷。" : isCoreCombatChoiceWeek ? "核心战斗周：从两名不同敌人中选择一名，胜利后继续学期。" : "本学期路线已经确定；先看完整日历，再选择本周节点。"}</p>
    </div>
    <div class="constellation-banner"><span>${game.archetype.sign}</span><p><b>${game.archetype.name}</b>${game.archetype.text}</p><small>每周开始自动存档</small></div>
    ${tarot ? `<div class="tarot-banner"><span>${tarot.number}</span><p><b>塔罗·${tarot.name}</b><em>收益：${tarot.boon}</em><i>代价：${tarot.cost}</i></p><small>本学期固定</small></div>` : ""}
    ${incubatorStatusHtml("map")}
    <button class="semester-calendar-trigger" data-action="open-calendar" aria-haspopup="dialog" aria-controls="semester-calendar-dialog" aria-expanded="${semesterCalendarOpen}">
      <span><small>学期日历</small><strong>当前周 · 第 ${game.week} 周</strong></span>
      <i aria-hidden="true">${currentWeekSymbols}</i>
      <em>点击查看 ${SEMESTER_WEEK_COUNT} 周全览</em>
      <b aria-hidden="true">↗</b>
    </button>
    ${semesterCalendarOpen ? `
      <div class="semester-calendar-backdrop" data-action="close-calendar" data-dismiss="backdrop">
        <section class="semester-calendar" id="semester-calendar-dialog" role="dialog" aria-modal="true" aria-labelledby="semester-calendar-title" aria-describedby="semester-calendar-challenge">
          <div class="semester-calendar-heading">
            <div><small>学期日历</small><strong id="semester-calendar-title">${SEMESTER_WEEK_COUNT} 周全览</strong></div>
            <span id="semester-calendar-challenge">${nextChallengeSummary}</span>
            <button class="quiet-button calendar-dialog-close" data-action="close-calendar" autofocus aria-label="关闭学期日历">关闭 ×</button>
            <div class="calendar-legend" aria-label="日历符号说明">
              ${["combat", "elite", "event", "rest", "shop", "challenge", "boss"].map((type) => `<i><b>${CALENDAR_EVENT_META[type].icon}</b>${CALENDAR_EVENT_META[type].label}</i>`).join("")}
            </div>
          </div>
          <div class="semester-calendar-grid">
            ${calendarWeeks.map((entry) => `
              <article class="calendar-week state-${entry.status}" aria-label="第 ${entry.week} 周，${entry.status === "done" ? "已完成" : entry.status === "current" ? "当前周" : "未开始"}">
                <div class="calendar-week-date"><small>第</small><b>${entry.week}</b><em>周</em>${entry.status === "done" ? '<i aria-hidden="true">✓</i>' : ""}</div>
                <div class="calendar-week-events">
                  ${entry.nodes.map((node) => {
                    const meta = CALENDAR_EVENT_META[node.type] || CALENDAR_EVENT_META.unknown;
                    return `<span class="calendar-event event-${node.type}" title="${escapeHtml(node.label)}"><b>${meta.icon}</b><em>${meta.label}</em></span>`;
                  }).join("") || '<span class="calendar-event event-unknown"><b>·</b><em>待定</em></span>'}
                </div>
              </article>`).join("")}
          </div>
        </section>
      </div>` : ""}
    <div class="node-grid">
      ${nodes.map((node, index) => `
        <button class="route-node node-${node.type} ${node.challenge ? "node-challenge" : ""} ${node.bonusGold === HIGH_THREAT_ROUTE_BONUS_GOLD ? "node-high-threat" : ""}" data-action="choose-node" data-index="${index}">
          <span class="node-icon">${ICONS[node.type]}</span>
          <span><small>${nodeTypeName(node)}</small><strong>${node.label}</strong>${node.challenge ? `<em><i class="challenge-affix-chip">${CHALLENGE_AFFIX_DEFS[node.affix].icon} ${CHALLENGE_AFFIX_DEFS[node.affix].name}</i>${CHALLENGE_AFFIX_DEFS[node.affix].text}<br>基础强化：生命 +${challengeHpPercent}% · 伤害 +${challengeDamagePercent}%<br><i class="challenge-trial-chip">${trial.icon} ${trial.name}</i>${trial.text} 完成额外 +${trial.bonusGold} 币。<br>胜利：专属牌 / 宠物 / 物品三选一${challengeRewardSourceHintHtml(node.enemy)}</em>` : normalRouteDetailHtml(node)}</span>
          <b>进入 →</b>
        </button>`).join("")}
    </div>
    <div class="map-tip"><b>路线规则：</b>${routeUsesCoreCombatDensity ? "每学期至少经历 9 场战斗；核心战斗周从两名普通敌人中任选其一。" : "当前沿用旧存档路线；下一学期起启用五个核心战斗周。"}期中前后各有一次可绕开的挑战战，星座试炼失败不影响基础奖励。</div>`;
  return page(`第 ${game.week} 周`, `第 ${game.semester} 学期 · 16 周路线`, body, {
    description: game.week < 8 ? "路线在学期开始时生成并保存，可以提前规划构筑与补给。" : "越接近期末，卡组的缺点越难隐藏。",
    className: "map-page"
  });
}

function enemyIntentTokenHtml(intent, resolution = null, counterplayCue = null) {
  const chips = [];
  if (resolution) {
    chips.push({ kind: resolution.tone === "danger" ? "attack" : "effect", icon: "结", value: "算" });
  } else {
    if (intent.attack) chips.push({ kind: "attack", icon: "⚔", value: `${intent.attack}${intent.hits > 1 ? `×${intent.hits}` : ""}` });
    if (intent.block) chips.push({ kind: "block", icon: "盾", value: `+${intent.block}` });
    if (intent.debuff) chips.push({ kind: "debuff", icon: "扰", value: "!" });
    if (intent.addStatus) chips.push({ kind: "status", icon: "牌", value: `+${intent.addStatus.count}` });
    if (!chips.length) chips.push({ kind: "effect", icon: "◆", value: "…" });
  }
  const name = resolution?.name || intent.name;
  const detailLines = resolution
    ? [resolution.result]
    : enemyIntentDetailLines(intent, (id) => CARD_DEFS[id]?.name || id);
  const tone = resolution ? resolution.tone : intent.attack ? "danger" : intent.block ? "block" : "safe";
  const pinned = context.intentDetailsPinned === true;
  const dismissed = context.intentDetailsDismissed === true;
  const enemyDefinition = ENEMY_DEFS[game.combat?.enemy?.id];
  const mechanicDescriptionId = enemyMechanicProgress(
    enemyDefinition?.id,
    resolution ? Math.max(0, resolution.turn - 1) : game.combat?.enemy?.intentTurn,
    resolution?.mechanicState || intent.mechanicState,
    resolution?.intent || intent
  ) ? " enemy-mechanic-summary" : "";
  return `<button type="button" class="enemy-intent-token state-${tone} ${pinned ? "is-pinned" : ""} ${dismissed ? "is-dismissed" : ""}" data-action="toggle-intent-details" aria-keyshortcuts="R" aria-expanded="${pinned}" aria-controls="enemy-intent-details" aria-describedby="enemy-intent-details${mechanicDescriptionId}" aria-label="敌人意图：${escapeHtml(name)}">
    <span class="enemy-intent-chips" aria-hidden="true">${chips.map((chip) => `<i class="intent-chip intent-${chip.kind}"><em>${chip.icon}</em><b>${escapeHtml(chip.value)}</b></i>`).join("")}</span>
    <small>${escapeHtml(name)}</small>
    <span class="enemy-intent-detail" id="enemy-intent-details" role="tooltip">
      <span class="intent-detail-heading"><small>${resolution ? "刚刚结算" : "当前意图"}</small><strong>${escapeHtml(name)}</strong></span>
      <span class="intent-detail-list">${detailLines.map((line) => `<span><i aria-hidden="true"></i>${escapeHtml(line)}</span>`).join("")}</span>
      ${enemyDefinition?.mechanicName && enemyDefinition?.mechanicText ? `<span class="intent-mechanic"><b>特性 · ${escapeHtml(enemyDefinition.mechanicName)}</b><span>${escapeHtml(enemyDefinition.mechanicText)}</span></span>` : ""}
      ${!resolution && counterplayCue ? `<span class="intent-counter-tip tone-${escapeHtml(counterplayCue.tone)}"><b>${escapeHtml(counterplayCue.label)}</b><span>${escapeHtml(counterplayCue.detail)}</span></span>` : ""}
      ${enemyDefinition?.pattern ? `<span class="intent-cycle"><b>行动周期</b>${escapeHtml(enemyDefinition.pattern)}</span>` : ""}
      <em class="intent-detail-hint">${pinned ? "点击关闭 · R / Esc 也可关闭" : "点击或按 R 固定说明"}</em>
    </span>
  </button>`;
}

function enemyMechanicProgressHtml(enemy, intent, resolution = null) {
  const intentTurn = resolution ? Math.max(0, resolution.turn - 1) : enemy?.intentTurn;
  const progress = enemyMechanicProgress(
    enemy?.id,
    intentTurn,
    resolution?.mechanicState || intent?.mechanicState,
    resolution?.intent || intent
  );
  if (!progress) return "";
  const segments = progress.segments.map((state) => {
    const stateClass = state === "done"
      ? "is-complete"
      : ["current", "continuing"].includes(state)
      ? `is-current${state === "continuing" ? " is-continuing" : ""}`
      : "";
    return `<b class="${stateClass}" aria-hidden="true"></b>`;
  }).join("");
  const ariaLabel = `${progress.title}。${progress.label}。${progress.detail}`;
  return `<aside class="enemy-mechanic-progress kind-${escapeHtml(enemy.id)}" id="enemy-mechanic-summary" data-progress-kind="${escapeHtml(progress.kind)}" aria-label="${escapeHtml(ariaLabel)}">
    <span><b>${escapeHtml(progress.title)}</b><em>${escapeHtml(progress.label)}</em></span>
    <i class="mechanic-progress-track" aria-hidden="true">${segments}</i>
  </aside>`;
}

function setIntentDetailsOpen(button, open) {
  context.intentDetailsPinned = open;
  context.intentDetailsDismissed = !open;
  button.classList.toggle("is-pinned", open);
  button.classList.toggle("is-dismissed", !open);
  button.setAttribute("aria-expanded", String(open));
  const hint = button.querySelector(".intent-detail-hint");
  if (hint) hint.textContent = open ? "点击关闭 · R / Esc 也可关闭" : "点击或按 R 固定说明";
}

function characterAssetHtml(src, className = "character-asset", alt = "") {
  if (!src) return "";
  return `<img class="${escapeHtml(className)}" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" draggable="false" decoding="async"
    onload="this.parentElement.classList.add('asset-ready')" onerror="const host=this.parentElement;this.remove();host?.querySelector('.avatar-fallback')?.removeAttribute('hidden')">`;
}

function supplyIconHtml(supply, className = "supply-icon") {
  return `<span class="${className} ${supply.art ? "has-image" : ""}" aria-hidden="true">${supply.art
    ? `<img src="${escapeHtml(supply.art)}" alt="" loading="lazy" onerror="this.remove()">`
    : escapeHtml(supply.icon)}</span>`;
}

function supplyHtml(id, options = {}) {
  const supply = SUPPLY_DEFS[id];
  if (!supply) return "";
  return `<button class="supply-tile ${options.className || ""}" data-action="${options.action || "use-supply"}" data-id="${escapeHtml(id)}" ${options.ariaKeyShortcut ? `aria-keyshortcuts="${escapeHtml(options.ariaKeyShortcut)}"` : ""} ${options.disabled ? "disabled" : ""}>
    ${supplyIconHtml(supply)}<span><small>一次性用品</small><strong>${escapeHtml(supply.name)}</strong><em>${escapeHtml(supply.text)}</em></span>
    ${options.price !== undefined ? `<b>${typeof options.price === "number" ? `${options.price} 币` : escapeHtml(options.price)}</b>` : ""}
  </button>`;
}

function renderStudentAvatar() {
  const asset = CHARACTER_ASSET_PATHS.students[game.archetypeId];
  return `<div class="student-avatar student-jiahao student-${game.archetypeId}" role="img" aria-label="嘉豪，${game.archetype.name}战斗形象">
    <span class="avatar-halo"></span>
    ${characterAssetHtml(asset, "character-asset", "嘉豪战斗形象")}
    <span class="avatar-fallback student-avatar-fallback" aria-hidden="true"${asset ? " hidden" : ""}>
      <span class="student-backpack"></span>
      <span class="student-body"><i class="student-collar"></i><b>${game.archetype.sign}</b></span>
      <span class="student-head">
        <i class="student-hair"></i><i class="student-brow brow-left"></i><i class="student-brow brow-right"></i>
        <i class="student-eye eye-left"></i><i class="student-eye eye-right"></i><i class="student-mouth"></i>
      </span>
    </span>
    <em>准备上课</em>
  </div>`;
}

function renderEnemyAvatar(enemy) {
  const art = ENEMY_ART[enemy.id] || { mark: "!", caption: "校园怪谈" };
  const asset = CHARACTER_ASSET_PATHS.enemies[enemy.id];
  return `<div class="enemy-avatar enemy-${enemy.id}" role="img" aria-label="${enemy.name}战斗形象">
    <span class="avatar-halo"></span>
    ${characterAssetHtml(asset)}
    <span class="avatar-fallback enemy-avatar-fallback" aria-hidden="true"${asset ? " hidden" : ""}>
      <span class="enemy-body"><i class="enemy-eye eye-left"></i><i class="enemy-eye eye-right"></i><i class="enemy-mouth"></i></span>
      <strong class="enemy-mark">${art.mark}</strong>
    </span>
    <em>${art.caption}</em>
  </div>`;
}

function renderBattlePet() {
  const pet = currentPetDefinition();
  const visual = petVisualId(pet);
  const asset = pet.assets.battle;
  const fallbackState = asset ? " hidden" : "";
  const fallback = visual === "sleepyBugCub"
    ? `<span class="avatar-fallback battle-pet-fallback pet-cub-full-fallback" aria-hidden="true"${fallbackState}><i class="pet-cub-body"><b></b><em></em></i><i class="pet-cub-face"><b></b><em></em></i></span>`
    : `<span class="avatar-fallback battle-pet-fallback pet-full-fallback" aria-hidden="true"${fallbackState}>
        <i class="battle-pet-body"><b></b></i>
        <i class="pet-head"><b></b><em></em><strong></strong></i>
        <i class="battle-pet-legs"></i>
      </span>`;
  return `<div class="battle-pet pet-${escapeHtml(visual)}" role="img" aria-label="战斗伙伴${pet.name}">
    <span class="battle-pet-halo" aria-hidden="true"></span>
    ${characterAssetHtml(asset, "character-asset battle-pet-asset", `${pet.name}战斗形象`)}
    ${fallback}
  </div>`;
}

function renderPetFace() {
  const pet = currentPetDefinition();
  return renderPetFaceFor(pet.id);
}

function renderPetFaceFor(petId) {
  const pet = PET_DEFS[petId] || PET_DEFS.offlineDuck;
  const visual = petVisualId(pet);
  const asset = pet.assets.icon;
  const fallbackState = asset ? " hidden" : "";
  const fallback = visual === "sleepyBugCub"
    ? `<span class="avatar-fallback pet-icon-fallback pet-cub-icon-fallback"${fallbackState}><i class="pet-cub-face"><b></b><em></em></i></span>`
    : `<span class="avatar-fallback pet-icon-fallback"${fallbackState}><i class="pet-head"><b></b><em></em><strong></strong></i></span>`;
  return `<span class="pet-face pet-${escapeHtml(visual)}" aria-hidden="true">
    ${characterAssetHtml(asset, "character-asset pet-icon-asset")}
    ${fallback}
  </span>`;
}

function combatPassiveTrayHtml(tarot) {
  const archetype = game.archetype;
  return `<section class="combat-passive-tray" aria-label="本场被动效果">
    <article class="combat-passive-token sign-token" tabindex="0" aria-label="星座被动：${escapeHtml(archetype.name)}，${escapeHtml(archetype.text)}">
      <span aria-hidden="true">${archetype.sign}</span><small>星座</small>
      <div class="combat-passive-tooltip" role="tooltip"><em>主角被动</em><b>${escapeHtml(archetype.name)}</b><p>${escapeHtml(archetype.text)}</p></div>
    </article>
    ${tarot ? `<article class="combat-passive-token tarot-token" tabindex="0" aria-label="塔罗契约：${escapeHtml(tarot.name)}。收益：${escapeHtml(tarot.boon)}。代价：${escapeHtml(tarot.cost)}">
      <span aria-hidden="true">${tarot.number.replace(/[^IVX]/g, "") || "T"}</span><small>塔罗</small>
      <div class="combat-passive-tooltip" role="tooltip"><em>塔罗契约</em><b>${escapeHtml(tarot.number)} · ${escapeHtml(tarot.name)}</b><p>收益：${escapeHtml(tarot.boon)}</p><i>代价：${escapeHtml(tarot.cost)}</i></div>
    </article>` : ""}
  </section>`;
}

function captureBattleMotionOrigin(element, kind = "card") {
  if (kind !== "pet") return null;
  const visual = element?.querySelector?.(".pet-face");
  if (!(visual instanceof HTMLElement)) return null;
  const rect = visual.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    kind: "pet",
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    html: visual.outerHTML
  };
}

function createBattleMotionGhost(origin) {
  if (origin?.kind !== "pet" || !origin.html) return null;
  const template = document.createElement("template");
  template.innerHTML = origin.html.trim();
  const ghost = template.content.firstElementChild;
  if (!(ghost instanceof HTMLElement)) return null;
  ghost.removeAttribute("data-action");
  ghost.removeAttribute("aria-keyshortcuts");
  ghost.removeAttribute("style");
  ghost.setAttribute("aria-hidden", "true");
  ghost.setAttribute("tabindex", "-1");
  ghost.classList.add("pet-flight");
  document.body.append(ghost);
  return ghost;
}

function createBattleCausalGhost(effect) {
  if (!effect || !["debuff", "status"].includes(effect.type)) return null;
  const safeEffectIds = new Set(["distracted", "todo", "nervous"]);
  const effectId = safeEffectIds.has(effect.id) ? effect.id : effect.type;
  const effectCount = Math.max(1, Math.floor(Number(effect.count) || 1));
  const effectSymbols = { distracted: "扰", todo: "待", nervous: "紧" };
  const ghost = document.createElement("i");
  ghost.className = `battle-causal-ghost cause-${effect.type}${effectCount > 1 ? " is-multiple" : ""}`;
  ghost.dataset.effectId = effectId;
  ghost.dataset.count = String(effectCount);
  ghost.setAttribute("aria-hidden", "true");
  ghost.innerHTML = `<b>${effectSymbols[effectId] || ""}</b><small>×${effectCount}</small>`;
  document.body.append(ghost);
  return ghost;
}

function createPileShuffleGhosts(movedCards) {
  const source = app.querySelector('.pile-button[data-zone="discardPile"]');
  const destination = app.querySelector('.pile-button[data-zone="drawPile"]');
  if (!(source instanceof HTMLElement) || !(destination instanceof HTMLElement)) return null;
  const sourceRect = source.getBoundingClientRect();
  const destinationRect = destination.getBoundingClientRect();
  if (!sourceRect.width || !sourceRect.height || !destinationRect.width || !destinationRect.height) return null;
  const moved = Math.max(1, Math.floor(Number(movedCards) || 1));
  const ghosts = Array.from({ length: Math.min(4, moved) }, (_, index) => {
    const ghost = document.createElement("i");
    ghost.className = "pile-shuffle-ghost";
    ghost.dataset.layer = String(index);
    ghost.setAttribute("aria-hidden", "true");
    if (index === 0) ghost.innerHTML = `<b>×${moved}</b>`;
    document.body.append(ghost);
    return ghost;
  });
  return { source, destination, sourceRect, destinationRect, ghosts };
}

function battleCausalRoute(startX, startY, endX, endY, options = {}) {
  const viewportWidth = Math.max(320, Number(options.viewport?.width) || 1280);
  const viewportHeight = Math.max(480, Number(options.viewport?.height) || 720);
  const clearance = 13;
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const normalizedRect = (rect) => {
    const left = Number(rect?.left);
    const top = Number(rect?.top);
    const right = Number(rect?.right);
    const bottom = Number(rect?.bottom);
    if (![left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top) return null;
    return { left: left - clearance, top: top - clearance, right: right + clearance, bottom: bottom + clearance };
  };
  const blockers = (Array.isArray(options.blockers) ? options.blockers : []).map(normalizedRect).filter(Boolean);
  const pointInside = (point, rect) => point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
  const segmentHits = (from, to, rect) => {
    if (Math.abs(from.x - to.x) < .01) {
      return from.x >= rect.left && from.x <= rect.right
        && Math.max(Math.min(from.y, to.y), rect.top) <= Math.min(Math.max(from.y, to.y), rect.bottom);
    }
    if (Math.abs(from.y - to.y) < .01) {
      return from.y >= rect.top && from.y <= rect.bottom
        && Math.max(Math.min(from.x, to.x), rect.left) <= Math.min(Math.max(from.x, to.x), rect.right);
    }
    return true;
  };
  const uniqueAxes = (values, maximum) => [...new Set(values
    .map((value) => Math.round(clamp(Number(value) || 0, 18, maximum - 18) * 2) / 2))];
  const xAxes = uniqueAxes([
    startX, endX, (startX + endX) / 2, 18, viewportWidth - 18,
    ...blockers.flatMap((rect) => [rect.left - 1, rect.right + 1])
  ], viewportWidth);
  const yAxes = uniqueAxes([
    startY, endY, (startY + endY) / 2, 52, viewportHeight - 18,
    ...blockers.flatMap((rect) => [rect.top - 1, rect.bottom + 1])
  ], viewportHeight);
  const nearestAxes = (axes, pivot, limit) => axes
    .slice()
    .sort((left, right) => Math.abs(left - pivot) - Math.abs(right - pivot))
    .slice(0, limit);
  const exitAxes = nearestAxes(xAxes, startX, 12);
  const laneAxes = nearestAxes(yAxes, (startY + endY) / 2, 14);
  const railAxes = nearestAxes(xAxes, endX, 12);
  const start = { x: startX, y: startY };
  const end = { x: endX, y: endY };
  let best = null;

  for (const exitX of exitAxes) {
    for (const laneY of laneAxes) {
      for (const railX of railAxes) {
        const rawPoints = [
          { x: exitX, y: startY },
          { x: exitX, y: laneY },
          { x: railX, y: laneY },
          { x: railX, y: endY },
          end
        ];
        const points = rawPoints.filter((point, index) => index === 0
          ? Math.abs(point.x - start.x) > .01 || Math.abs(point.y - start.y) > .01
          : Math.abs(point.x - rawPoints[index - 1].x) > .01 || Math.abs(point.y - rawPoints[index - 1].y) > .01);
        const path = [start, ...points];
        let collisions = 0;
        let distance = 0;
        for (let index = 1; index < path.length; index += 1) {
          const from = path[index - 1];
          const to = path[index];
          const isFirst = index === 1;
          const isLast = index === path.length - 1;
          distance += Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
          collisions += blockers.filter((rect) => {
            if (isFirst && pointInside(start, rect)) return false;
            if (isLast && pointInside(end, rect)) return false;
            return segmentHits(from, to, rect);
          }).length;
        }
        const score = collisions * 10000 + distance + points.length * 8;
        if (!best || score < best.score) best = { score, collisions, points };
      }
    }
  }

  return best || { score: 0, collisions: 0, points: [end] };
}

function clearBattleMotionArtifacts() {
  const activeTimeline = battleMotionTimeline;
  battleMotionTimeline = null;
  activeTimeline?.kill();
  const activeMedia = battleMotionMedia;
  battleMotionMedia = null;
  activeMedia?.revert();
  document.querySelectorAll(".played-card-ghost, .pet-flight, .battle-causal-ghost, .pile-shuffle-ghost").forEach((element) => element.remove());
}

function enemyBattleMotionProfile(feedback) {
  const attacksPlayer = feedback?.motionType === "enemy-attack"
    || Boolean(feedback?.playerDamage || feedback?.playerBlockAbsorbed);
  if (
    feedback?.enemyId === "alarmClock"
    && attacksPlayer
    && /^夺命连环响(?:\s*·|$)/.test(feedback?.intentName || "")
  ) return "alarm-burst";
  if (feedback?.enemyId === "rivalShadow" && attacksPlayer) return "rival-rush";
  if (feedback?.enemyId === "finalExam" && attacksPlayer) return "final-exam-smash";
  if (feedback?.enemyId === "finalExam" && /^发卷/.test(feedback?.intentName || "")) return "final-exam-deal";
  const regularProfiles = {
    sleepyBug: "sleepy-sway",
    homeworkBlob: "blob-squash",
    alarmClock: "alarm-ring",
    phoneSpirit: "phone-vibrate",
    groupChat: "chat-pop",
    printerJam: "printer-feed",
    rollCallWarden: "roll-call-snap",
    clubMegaphone: "megaphone-blast"
  };
  if (regularProfiles[feedback?.enemyId]) return regularProfiles[feedback.enemyId];
  return attacksPlayer ? "default-attack" : "default-skill";
}

function regularEnemyBattleMotionRecipe(profile, attacksPlayer) {
  const recipes = {
    "sleepy-sway": {
      attack: {
        steps: [
          { position: "windup", vars: { x: 6, y: 4, rotation: 4, scaleX: .96, scaleY: 1.03, duration: .14, ease: "sine.inOut" } },
          { position: "windup+=.14", vars: { x: -24, y: 2, rotation: -5, scaleX: 1.04, scaleY: .97, duration: .12, ease: "power2.in" } }
        ],
        impactAt: .26, settleDelay: .05, settleDuration: .16
      },
      skill: {
        steps: [
          { position: "windup", vars: { x: 4, y: 5, rotation: 3, scaleX: .94, scaleY: .9, duration: .17, ease: "sine.inOut" } },
          { position: "windup+=.17", vars: { x: 0, y: 2, rotation: 0, scaleX: 1.02, scaleY: 1.03, duration: .09, ease: "power1.out" } }
        ],
        impactAt: .26, settleDelay: 0, settleDuration: .14
      }
    },
    "blob-squash": {
      attack: {
        steps: [
          { position: "windup", vars: { x: 5, y: 6, rotation: 2, scaleX: 1.1, scaleY: .88, duration: .11, ease: "power2.in" } },
          { position: "windup+=.11", vars: { x: -30, y: 0, rotation: -3, scaleX: 1.14, scaleY: .9, duration: .13, ease: "power3.in" } }
        ],
        impactAt: .24, settleDelay: .05, settleDuration: .17
      },
      skill: {
        steps: [
          { position: "windup", vars: { y: -7, rotation: -1, scaleX: .92, scaleY: 1.15, duration: .17, ease: "power2.out" } },
          { position: "windup+=.17", vars: { y: 0, rotation: 0, scaleX: 1.03, scaleY: .98, duration: .09, ease: "back.out(1.3)" } }
        ],
        impactAt: .26, settleDelay: 0, settleDuration: .14
      }
    },
    "alarm-ring": {
      attack: {
        steps: [
          { position: "windup", vars: { x: 3, rotation: 5, scale: .98, duration: .07, ease: "power1.inOut" } },
          { position: "windup+=.07", vars: { x: -3, rotation: -6, scale: 1.02, duration: .07, ease: "power1.inOut" } },
          { position: "windup+=.14", vars: { x: -28, rotation: -3, scale: 1.06, duration: .11, ease: "power4.in" } }
        ],
        impactAt: .25, settleDelay: .05, settleDuration: .17
      },
      skill: {
        steps: [
          { position: "windup", vars: { y: 3, rotation: -3, scale: .96, duration: .11, ease: "power1.inOut" } },
          { position: "windup+=.11", vars: { y: -2, rotation: 3, scale: 1.04, duration: .1, ease: "power1.inOut" } }
        ],
        impactAt: .21, settleDelay: 0, settleDuration: .15
      }
    },
    "alarm-burst": {
      attack: {
        steps: [
          { position: "windup", vars: { x: 7, y: 2, rotation: 6, scaleX: .92, scaleY: 1.08, duration: .05, ease: "power1.inOut" } },
          { position: "windup+=.05", vars: { x: -5, y: -2, rotation: -8, scaleX: 1.04, scaleY: .96, duration: .05, ease: "power1.inOut" } },
          { position: "windup+=.1", vars: { x: 4, y: 1, rotation: 8, scaleX: .95, scaleY: 1.05, duration: .04, ease: "power1.inOut" } },
          { position: "windup+=.14", vars: { x: -40, y: 2, rotation: -5, scaleX: 1.12, scaleY: .9, duration: .08, ease: "power4.in" } }
        ],
        impactAt: .22, settleDelay: .04, settleDuration: .18
      }
    },
    "phone-vibrate": {
      attack: {
        steps: [
          { position: "windup", vars: { x: 4, rotation: 2, duration: .05, ease: "power1.inOut" } },
          { position: "windup+=.05", vars: { x: -5, rotation: -2, duration: .05, ease: "power1.inOut" } },
          { position: "windup+=.1", vars: { x: -27, rotation: -3, scaleX: 1.06, duration: .12, ease: "power3.in" } }
        ],
        impactAt: .22, settleDelay: .05, settleDuration: .16
      },
      skill: {
        steps: [
          { position: "windup", vars: { y: -4, rotation: 2, scale: 1.06, duration: .11, ease: "power2.out" } },
          { position: "windup+=.11", vars: { x: -5, y: 0, rotation: -3, scaleX: 1.04, duration: .1, ease: "power2.inOut" } }
        ],
        impactAt: .21, settleDelay: 0, settleDuration: .15
      }
    },
    "chat-pop": {
      attack: {
        steps: [
          { position: "windup", vars: { x: 7, y: -2, scaleX: .92, scaleY: 1.04, duration: .1, ease: "power2.in" } },
          { position: "windup+=.1", vars: { x: -29, y: 0, rotation: -3, scaleX: 1.09, scaleY: .94, duration: .12, ease: "power3.in" } }
        ],
        impactAt: .22, settleDelay: .05, settleDuration: .17
      },
      skill: {
        steps: [
          { position: "windup", vars: { y: -6, rotation: 2, scale: 1.11, duration: .11, ease: "back.out(1.35)" } },
          { position: "windup+=.11", vars: { x: -5, y: 0, rotation: -2, scale: 1.04, duration: .1, ease: "power2.inOut" } }
        ],
        impactAt: .21, settleDelay: 0, settleDuration: .15
      }
    },
    "printer-feed": {
      attack: {
        steps: [
          { position: "windup", vars: { x: 8, y: 3, rotation: 2, scaleX: .9, scaleY: 1.06, duration: .13, ease: "power2.in" } },
          { position: "windup+=.13", vars: { x: -34, y: 0, rotation: -4, scaleX: 1.1, scaleY: .92, duration: .13, ease: "power4.in" } }
        ],
        impactAt: .26, settleDelay: .05, settleDuration: .18
      },
      skill: {
        steps: [
          { position: "windup", vars: { y: 5, rotation: 2, scaleX: 1.07, scaleY: .9, duration: .14, ease: "power2.in" } },
          { position: "windup+=.14", vars: { y: -4, rotation: -1, scaleX: .95, scaleY: 1.08, duration: .1, ease: "power2.out" } }
        ],
        impactAt: .24, settleDelay: 0, settleDuration: .16
      }
    },
    "roll-call-snap": {
      attack: {
        steps: [
          { position: "windup", vars: { x: 7, y: -3, rotation: 5, scaleX: .94, scaleY: 1.04, duration: .12, ease: "power2.in" } },
          { position: "windup+=.12", vars: { x: -33, y: 3, rotation: -6, scaleX: 1.08, scaleY: .95, duration: .13, ease: "power4.in" } }
        ],
        impactAt: .25, settleDelay: .04, settleDuration: .17
      },
      skill: {
        steps: [
          { position: "windup", vars: { x: 2, y: -9, rotation: -4, scaleX: .97, scaleY: 1.08, duration: .13, ease: "power2.out" } },
          { position: "windup+=.13", vars: { x: -5, y: 5, rotation: 3, scaleX: 1.06, scaleY: .91, duration: .11, ease: "power3.in" } }
        ],
        impactAt: .24, settleDelay: 0, settleDuration: .16
      }
    },
    "megaphone-blast": {
      attack: {
        steps: [
          { position: "windup", vars: { x: 9, y: 1, rotation: 4, scaleX: .9, scaleY: 1.05, duration: .1, ease: "power2.in" } },
          { position: "windup+=.1", vars: { x: -31, y: -2, rotation: -4, scaleX: 1.12, scaleY: .94, duration: .12, ease: "power4.in" } },
          { position: "windup+=.22", vars: { x: -23, y: 1, rotation: 2, scaleX: 1.05, scaleY: .98, duration: .07, ease: "power1.out" } }
        ],
        impactAt: .29, settleDelay: .03, settleDuration: .16
      },
      skill: {
        steps: [
          { position: "windup", vars: { x: 3, y: 2, rotation: -5, scaleX: 1.13, scaleY: .96, duration: .14, ease: "back.out(1.25)" } },
          { position: "windup+=.14", vars: { x: -7, y: -3, rotation: 5, scaleX: .96, scaleY: 1.07, duration: .1, ease: "power2.inOut" } }
        ],
        impactAt: .24, settleDelay: 0, settleDuration: .16
      }
    }
  };
  return recipes[profile]?.[attacksPlayer ? "attack" : "skill"] || null;
}

function addEnemyBattleMotion(timeline, attacker, feedback) {
  const profile = enemyBattleMotionProfile(feedback);
  const attacksPlayer = feedback?.motionType === "enemy-attack"
    || Boolean(feedback?.playerDamage || feedback?.playerBlockAbsorbed);

  if (attacker && profile === "rival-rush") {
    timeline.to(attacker, { x: -52, rotation: -3, scaleX: 1.04, filter: "brightness(1.08)", duration: .11, ease: "power4.in" }, "windup+=.04");
    timeline.addLabel("impact", .15);
    timeline.to(attacker, { x: 10, rotation: 1, scaleX: .98, filter: "brightness(1.02)", duration: .09, ease: "power4.out" }, "impact");
    timeline.to(attacker, { x: 0, rotation: 0, scaleX: 1, filter: "brightness(1)", duration: .13, ease: "power2.out", clearProps: "transform,filter" }, "impact+=.09");
    return profile;
  }

  if (attacker && profile === "final-exam-smash") {
    timeline.to(attacker, { x: 9, y: -4, scale: 1.12, rotation: 2, duration: .22, ease: "power2.out" }, "windup");
    timeline.to(attacker, { x: -48, y: 8, scaleX: 1.08, scaleY: .92, rotation: -5, filter: "brightness(1.18)", duration: .16, ease: "power4.in" }, "windup+=.22");
    timeline.addLabel("impact", .38);
    timeline.to(attacker, { x: 9, y: -4, scaleX: .98, scaleY: 1.04, rotation: 2, filter: "brightness(1.04)", duration: .12, ease: "power4.out" }, "impact");
    timeline.to(attacker, { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, filter: "brightness(1)", duration: .18, ease: "power2.out", clearProps: "transform,filter" }, "impact+=.12");
    return profile;
  }

  if (attacker && profile === "final-exam-deal") {
    timeline.fromTo(
      attacker,
      { x: 10, scaleX: .78, scaleY: 1.05, rotation: 2, opacity: .72 },
      { x: -8, scaleX: 1.08, scaleY: .96, rotation: -1, opacity: 1, duration: .16, ease: "power3.out" },
      "windup"
    );
    timeline.addLabel("impact", .16);
    timeline.to(attacker, { x: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, duration: .14, ease: "back.out(1.4)", clearProps: "transform,opacity" }, "impact");
    return profile;
  }

  const regularRecipe = regularEnemyBattleMotionRecipe(profile, attacksPlayer);
  if (attacker && regularRecipe) {
    regularRecipe.steps.forEach((step) => timeline.to(attacker, step.vars, step.position));
    timeline.addLabel("impact", regularRecipe.impactAt);
    timeline.to(attacker, {
      x: 0,
      y: 0,
      rotation: 0,
      scale: 1,
      scaleX: 1,
      scaleY: 1,
      duration: regularRecipe.settleDuration,
      ease: "power2.out",
      clearProps: "transform"
    }, `impact+=${regularRecipe.settleDelay}`);
    return profile;
  }

  if (attacker && profile === "default-attack") {
    timeline.to(attacker, { x: -28, rotation: -2, duration: .16, ease: "power2.in" }, "windup+=.1");
    timeline.addLabel("impact", .26);
    timeline.to(attacker, { x: 0, rotation: 0, duration: .2, ease: "power3.out", clearProps: "transform" }, "impact+=.08");
  } else {
    timeline.addLabel("impact", .2);
  }
  return profile;
}

function runBattleMotion(feedback, origin = null) {
  if (!feedback || feedback.id === lastAnimatedFeedbackId || screen !== "combat") return;
  clearBattleMotionArtifacts();
  const feedbackRoot = app.querySelector(`[data-feedback-id="${feedback.id}"]`);
  const gsap = window.gsap;
  if (!feedbackRoot || !gsap || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    feedbackRoot?.classList.remove("motion-pending", "gsap-driven");
    return;
  }

  lastAnimatedFeedbackId = feedback.id;
  feedbackRoot.classList.remove("motion-pending", "motion-settled");
  feedbackRoot.classList.add("gsap-driven");
  const media = gsap.matchMedia();
  battleMotionMedia = media;
  media.add("(prefers-reduced-motion: no-preference)", () => {
    if (screen !== "combat" || context.battleFeedback?.id !== feedback.id) return undefined;
    const motionType = feedback.motionType || (feedback.kind === "enemy" ? "enemy-skill" : "skill");
    const ghost = createBattleMotionGhost(origin);
    const targetsEnemy = feedback.kind !== "enemy"
      && (motionType === "attack" || motionType === "pet" || feedback.enemyDamage > 0 || feedback.enemyBlockLoss > 0);
    const target = app.querySelector(feedback.kind === "enemy" || !targetsEnemy ? ".student-avatar" : ".enemy-avatar");
    const attacker = feedback.kind === "enemy" ? app.querySelector(".enemy-avatar") : null;
    const causalGhosts = (feedback.causalEffects || []).map((effect) => ({
      effect,
      element: createBattleCausalGhost(effect)
    })).filter((entry) => entry.element);
    const shuffleMotion = feedback.pileReshuffles
      ? createPileShuffleGhosts(feedback.reshuffledCards)
      : null;
    const targetRect = target?.getBoundingClientRect();
    const attackerRect = attacker?.getBoundingClientRect();
    const routeBlockers = [...app.querySelectorAll([
      ".player-fighter .student-avatar",
      ".battle-pet",
      ".combat-vitals",
      ".enemy-intent-token",
      ".enemy-mechanic-progress",
      ".pet-companion-token",
      ".energy-orb",
      ".end-turn",
      ".hand .game-card"
    ].join(","))].map((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    });
    const causalMotions = causalGhosts.map((entry, index) => {
      const destination = entry.effect.type === "status"
        ? entry.effect.target === "hand"
          ? app.querySelector(".hand")
          : app.querySelector(`.pile-button[data-zone="${entry.effect.target}"]`)
        : app.querySelector(".player-fighter .status-row") || app.querySelector(".student-avatar");
      const destinationRect = destination?.getBoundingClientRect();
      if (!attackerRect || !destinationRect) return null;
      const startX = attackerRect.left + attackerRect.width / 2 + index * 7;
      const startY = attackerRect.top + attackerRect.height * .42;
      const endX = destinationRect.left + destinationRect.width / 2;
      const endY = destinationRect.top + destinationRect.height / 2;
      return {
        ...entry,
        destination,
        startX,
        startY,
        ...battleCausalRoute(startX, startY, endX, endY, {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          sourceRect: attackerRect,
          destinationRect,
          blockers: routeBlockers
        })
      };
    }).filter(Boolean);
    const intentToken = feedback.kind === "enemy" ? app.querySelector(".enemy-intent-token") : null;
    const ribbon = feedbackRoot.querySelector(".feedback-ribbon");
    const streak = feedbackRoot.querySelector(".feedback-streak");
    const burst = feedbackRoot.querySelector(".feedback-burst");
    const shield = feedbackRoot.querySelector(".feedback-shield");
    const feathers = feedbackRoot.querySelector(".feedback-feathers");
    const numbers = feedbackRoot.querySelectorAll(".feedback-number");
    const hitPulses = feedbackRoot.parentElement?.querySelectorAll(".enemy-hit-pulse") || [];
    const actualShield = app.querySelector(feedback.enemyBlockGain ? ".enemy-fighter .block-shield" : ".player-fighter .block-shield");
    let timeline;
    const removeGhosts = () => {
      ghost?.remove();
      causalGhosts.forEach(({ element }) => element.remove());
      shuffleMotion?.ghosts.forEach((element) => element.remove());
    };
    const finish = () => {
      removeGhosts();
      if (battleMotionTimeline === timeline) battleMotionTimeline = null;
      queueMicrotask(() => {
        if (battleMotionMedia !== media) return;
        battleMotionMedia = null;
        media.revert();
      });
    };
    timeline = gsap.timeline({ defaults: { ease: "power2.out" }, onComplete: finish, onInterrupt: removeGhosts });
    battleMotionTimeline = timeline;
    timeline.addLabel("windup", 0);
    if (ribbon) timeline.fromTo(ribbon, { y: -10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .16 }, "windup");

    if (feedback.kind === "enemy") {
      if (intentToken) timeline.fromTo(intentToken, { y: -6, scale: .82, autoAlpha: .5 }, { y: 0, scale: 1.12, autoAlpha: 1, duration: .16, ease: "back.out(1.7)" }, "windup");
      addEnemyBattleMotion(timeline, attacker, feedback);
    } else if (ghost && targetRect) {
      const originCenterX = origin.left + origin.width / 2;
      const originCenterY = origin.top + origin.height / 2;
      const targetX = targetRect.left + targetRect.width / 2 - originCenterX;
      const targetY = targetRect.top + targetRect.height / 2 - originCenterY;
      const directAttack = motionType === "attack" || motionType === "pet";
      gsap.set(ghost, { left: origin.left, top: origin.top, width: origin.width, height: origin.height, x: 0, y: 0, rotation: 0, scale: origin.kind === "pet" ? 1 : .86, autoAlpha: 1 });
      timeline.to(ghost, { y: directAttack ? -24 : -38, scale: origin.kind === "pet" ? 1.08 : directAttack ? .94 : .78, duration: directAttack ? .13 : .18 }, "windup");
      timeline.to(ghost, { x: targetX, y: targetY, scale: origin.kind === "pet" ? .78 : directAttack ? .42 : .3, rotation: origin.kind === "pet" ? 13 : directAttack ? 5 : -3, duration: directAttack ? .26 : .34, ease: directAttack ? "power3.in" : "power2.inOut" }, "windup+=.11");
      timeline.addLabel("impact", directAttack ? .37 : .46);
      timeline.to(ghost, { scale: .25, autoAlpha: 0, duration: .1 }, "impact");
    } else {
      timeline.addLabel("impact", .18);
    }

    if (streak && ["attack", "enemy-attack", "pet"].includes(motionType)) {
      timeline.fromTo(streak, { scaleX: .05, autoAlpha: 0 }, { scaleX: 1, autoAlpha: 1, duration: .18, ease: "power3.out" }, "impact-=.05");
      timeline.to(streak, { scaleX: 1.08, autoAlpha: 0, duration: .14 }, "impact+=.15");
    }
    if (burst && ["attack", "enemy-attack", "pet"].includes(motionType)) {
      timeline.fromTo(burst, { scale: .24, rotation: -12, autoAlpha: 0 }, { scale: 1.12, rotation: 8, autoAlpha: 1, duration: .19 }, "impact");
      timeline.to(burst, { scale: 1.28, autoAlpha: 0, duration: .15 }, "impact+=.17");
    }
    if (target && (feedback.enemyDamage || feedback.playerDamage)) {
      const hitDirection = feedback.kind === "enemy" ? -14 : 14;
      timeline.to(target, { x: hitDirection, rotation: feedback.kind === "enemy" ? -2 : 2, filter: "brightness(1.45)", duration: .07, ease: "power4.out" }, "impact");
      timeline.to(target, { x: -hitDirection * .35, rotation: 0, filter: "brightness(1.08)", duration: .09 }, "impact+=.07");
      timeline.to(target, { x: 0, filter: "brightness(1)", duration: .13, clearProps: "transform,filter" }, "impact+=.16");
    }
    if (shield) {
      timeline.fromTo(shield, { scale: .56, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .2, ease: "back.out(1.7)" }, "impact-=.03");
      timeline.to(shield, { scale: 1.08, autoAlpha: 0, duration: .18 }, "impact+=.2");
    }
    if (actualShield && (feedback.playerBlockGain || feedback.playerBlockAbsorbed || feedback.enemyBlockGain)) {
      timeline.fromTo(actualShield, { scale: .7 }, { scale: 1.16, duration: .16, ease: "back.out(2)" }, "impact");
      timeline.to(actualShield, { scale: 1, duration: .13, clearProps: "transform" }, "impact+=.16");
    }
    if (feathers) timeline.fromTo(feathers, { x: -45, y: 25, rotation: -12, autoAlpha: 0 }, { x: 85, y: -18, rotation: 18, autoAlpha: 1, duration: .4 }, "impact-=.08");
    if (numbers.length) {
      timeline.fromTo(numbers, { y: 16, scale: .72, autoAlpha: 0 }, { y: -12, scale: 1.08, autoAlpha: 1, duration: .24, stagger: .04, ease: "back.out(1.7)" }, "impact");
      timeline.to(numbers, { y: -35, autoAlpha: 0, duration: .24, stagger: .04 }, "impact+=.28");
    }
    if (hitPulses.length) {
      timeline.fromTo(hitPulses, { scale: .35, autoAlpha: 0 }, { scale: 1.12, autoAlpha: 1, duration: .2, stagger: .18, ease: "power3.out" }, "impact");
      timeline.to(hitPulses, { scale: 1.28, autoAlpha: 0, duration: .16, stagger: .18 }, "impact+=.18");
    }
    causalMotions.forEach((motion, index) => {
      const startAt = "impact";
      const routeDuration = .28;
      const routePath = [{ x: motion.startX, y: motion.startY }, ...motion.points];
      const routeDistance = routePath.slice(1).reduce((total, point, pointIndex) => {
        const previous = routePath[pointIndex];
        return total + Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y);
      }, 0) || 1;
      let routeElapsed = 0;
      gsap.set(motion.element, { left: 0, top: 0, x: motion.startX, y: motion.startY, scale: .55, rotation: -8 + index * 6, autoAlpha: 0 });
      timeline.fromTo(motion.element, { scale: .55, autoAlpha: 0 }, { scale: .78, autoAlpha: 1, duration: .07 }, startAt);
      motion.points.forEach((point, pointIndex) => {
        const previous = routePath[pointIndex];
        const segmentDistance = Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y);
        const duration = routeDuration * segmentDistance / routeDistance;
        timeline.to(motion.element, {
          x: point.x,
          y: point.y,
          rotation: -4 + pointIndex * 3 + index * 4,
          duration,
          ease: pointIndex === motion.points.length - 1 ? "power2.inOut" : "power1.inOut"
        }, routeElapsed ? `${startAt}+=${routeElapsed}` : startAt);
        routeElapsed += duration;
      });
      timeline.to(motion.element, { scale: 1.05, autoAlpha: 0, duration: .06 }, `${startAt}+=${routeDuration}`);
      timeline.fromTo(motion.destination, { scale: .94 }, { scale: 1.05, duration: .05, ease: "back.out(1.7)", immediateRender: false }, `${startAt}+=${routeDuration - .03}`);
      timeline.to(motion.destination, { scale: 1, duration: .06, clearProps: "transform" }, `${startAt}+=${routeDuration + .02}`);
    });
    if (feedback.petChargeGain) {
      const petToken = app.querySelector(".pet-companion-token");
      if (petToken) timeline.fromTo(petToken, { scale: .82 }, { scale: 1.14, duration: .14, ease: "back.out(2)" }, "impact+=.08").to(petToken, { scale: 1, duration: .12, clearProps: "transform" });
    }
    if (shuffleMotion?.ghosts.length) {
      const sourceX = shuffleMotion.sourceRect.left + shuffleMotion.sourceRect.width / 2;
      const sourceY = shuffleMotion.sourceRect.top + shuffleMotion.sourceRect.height / 2;
      const destinationX = shuffleMotion.destinationRect.left + shuffleMotion.destinationRect.width / 2;
      const destinationY = shuffleMotion.destinationRect.top + shuffleMotion.destinationRect.height / 2;
      const travelX = destinationX - sourceX;
      const travelY = destinationY - sourceY;
      const startAt = "pileShuffle";
      timeline.addLabel(startAt, feedback.kind === "enemy" ? "impact+=.1" : "impact+=.04");
      timeline.fromTo(
        shuffleMotion.source,
        { scale: 1, filter: "brightness(1)" },
        { scale: .88, filter: "brightness(1.35)", duration: .09, ease: "power2.in", immediateRender: false },
        startAt
      );
      timeline.to(shuffleMotion.source, { scale: 1, filter: "brightness(1)", duration: .12, clearProps: "transform,filter" }, `${startAt}+=.1`);
      shuffleMotion.ghosts.forEach((shuffleGhost, index) => {
        const stagger = index * .025;
        gsap.set(shuffleGhost, {
          left: sourceX - 13 + index * 2,
          top: sourceY - 19 - index * 2,
          x: 0,
          y: 0,
          rotation: 8 + index * 3,
          scale: .82,
          autoAlpha: 0
        });
        timeline.to(shuffleGhost, { autoAlpha: 1, scale: .96, duration: .06 }, `${startAt}+=${stagger}`);
        timeline.to(shuffleGhost, {
          x: travelX * .55,
          y: travelY * .5 - 30 - index * 2,
          rotation: -9 + index * 4,
          scale: 1.04,
          duration: .15,
          ease: "power2.out"
        }, `${startAt}+=${stagger + .04}`);
        timeline.to(shuffleGhost, {
          x: travelX,
          y: travelY,
          rotation: -4 + index * 2,
          scale: .82,
          duration: .14,
          ease: "power2.in"
        }, `${startAt}+=${stagger + .19}`);
        timeline.to(shuffleGhost, { autoAlpha: 0, scale: .62, duration: .06 }, `${startAt}+=${stagger + .31}`);
      });
      timeline.fromTo(
        shuffleMotion.destination,
        { scale: .9, filter: "brightness(1.4)" },
        { scale: 1.08, filter: "brightness(1.15)", duration: .1, ease: "back.out(2)", immediateRender: false },
        `${startAt}+=.3`
      );
      timeline.to(shuffleMotion.destination, { scale: 1, filter: "brightness(1)", duration: .1, clearProps: "transform,filter" }, `${startAt}+=.4`);
    }
    timeline.to(ribbon, { autoAlpha: 0, y: -4, duration: .18 }, ">-.12");
    return () => {
      timeline?.kill();
      removeGhosts();
    };
  });
}

function scheduleBattleMotion() {
  const feedback = context.battleFeedback;
  if (screen !== "combat" || !feedback || feedback.id === lastAnimatedFeedbackId) return;
  window.requestAnimationFrame(() => {
    if (screen !== "combat" || context.battleFeedback?.id !== feedback.id) return;
    runBattleMotion(feedback, context.battleMotionOrigin);
  });
}

function battleStateSnapshot() {
  const combat = game.combat;
  const cardUids = Object.fromEntries(
    ["hand", "drawPile", "discardPile", "exhaustPile"].map((zone) => [
      zone,
      Array.isArray(combat?.[zone])
        ? combat[zone].map((card) => String(card?.uid || "")).filter(Boolean)
        : []
    ])
  );
  return {
    playerHp: game.hp,
    playerBlock: combat?.playerBlock || 0,
    enemyHp: combat?.enemy?.hp || 0,
    enemyBlock: combat?.enemy?.block || 0,
    handSize: combat?.hand?.length || 0,
    petCharge: game.pet.charge,
    cardUids
  };
}

function counterplayFeedbackParts(before, after) {
  if (before?.type === "rivalInterrupt" && !before.triggered && after?.triggered) {
    return [`打断内卷 · 敌方攻击 ${after.attackBefore}→${after.attackAfter}`];
  }
  if (before?.type === "examBlank" && !before.triggered && after?.triggered) {
    return [`破题成功 · 大题 ${after.attackBefore}→${after.attackAfter}`];
  }
  return [];
}

function queueBattleFeedback(kind, label, before, options = {}) {
  battleFeedbackSequence += 1;
  const feedbackDelta = battleFeedbackFromDelta(before, battleStateSnapshot(), {
    ...options,
    id: battleFeedbackSequence,
    kind,
    label
  });
  const feedback = kind === "enemy"
    ? {
      ...feedbackDelta,
      enemyId: String(options.enemyId || ""),
      intentName: String(options.intentName || "")
    }
    : feedbackDelta;
  const locksCombatInput = kind === "enemy" && options.lockCombatInput !== false;
  const enemyResolution = locksCombatInput
    ? enemyResolutionSnapshot(options.enemyResolution, feedback)
    : null;
  context = {
    ...context,
    battleFeedback: feedback,
    battleMotionOrigin: options.motionOrigin || null,
    combatInputLocked: locksCombatInput,
    combatLockId: locksCombatInput ? feedback.id : null,
    enemyResolution
  };
  window.clearTimeout(battleInputTimer);
  let resolveMs = 0;
  if (locksCombatInput) {
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    resolveMs = enemyResolveDuration(prefersReducedMotion, enemyResolution?.hitBreakdown.length || 1);
    if (resolveMs === 0) {
      context = { ...context, combatInputLocked: false, combatLockId: null, enemyResolution: null };
    } else {
      battleInputTimer = window.setTimeout(() => {
        if (screen !== "combat" || context.combatLockId !== feedback.id) return;
        context = { ...context, combatInputLocked: false, combatLockId: null, enemyResolution: null };
        render();
      }, resolveMs);
    }
  }
  window.clearTimeout(battleFeedbackTimer);
  battleFeedbackTimer = window.setTimeout(() => {
    if (screen !== "combat" || context.battleFeedback?.id !== feedback.id) return;
    context = { ...context, battleFeedback: null, battleMotionOrigin: null };
    render();
  }, Math.max(1150, resolveMs + 120));
}

function battleFeedbackHtml(feedback) {
  if (!feedback) return "";
  const motionEnabled = Boolean(window.gsap)
    && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const motionState = !motionEnabled
    ? ""
    : feedback.id === lastAnimatedFeedbackId
    ? " motion-settled"
    : " motion-pending";
  const enemyResult = feedback.enemyDamage
    ? `-${feedback.enemyDamage}`
    : feedback.enemyBlockLoss
    ? `护甲 -${feedback.enemyBlockLoss}`
    : feedback.enemyBlockGain
    ? `护甲 +${feedback.enemyBlockGain}`
    : "";
  const playerResult = feedback.playerDamage && !feedback.hidePlayerDamageNumber
    ? `-${feedback.playerDamage}`
    : feedback.kind !== "enemy" && feedback.endTurnHpLoss
    ? `内耗 -${feedback.endTurnHpLoss}`
    : feedback.playerBlockGain
    ? `护甲 +${feedback.playerBlockGain}`
    : feedback.playerBlockAbsorbed
    ? `挡下 ${feedback.playerBlockAbsorbed}`
    : "";
  return `<div class="battle-feedback kind-${feedback.kind} tone-${feedback.tone} motion-${feedback.motionType}${motionState}" data-feedback-id="${feedback.id}" role="status" aria-live="polite" aria-atomic="true">
    <div class="feedback-ribbon"><small>${escapeHtml(feedback.label)}</small><strong>${feedback.summaryParts.map(escapeHtml).join(" · ")}</strong></div>
    <div class="feedback-field" aria-hidden="true">
      <i class="feedback-streak"></i><i class="feedback-burst"></i>
      ${feedback.tone === "guard" || feedback.playerBlockGain || feedback.playerBlockAbsorbed ? '<i class="feedback-shield"></i>' : ""}
      ${feedback.kind === "pet" ? '<i class="feedback-feathers">◆ ◆ ◆</i>' : ""}
      ${enemyResult ? `<b class="feedback-number target-enemy">${escapeHtml(enemyResult)}</b>` : ""}
      ${playerResult ? `<b class="feedback-number target-player">${escapeHtml(playerResult)}</b>` : ""}
    </div>
  </div>`;
}

function incomingDamageHtml(preview) {
  const details = [];
  if (preview.attackTotal) {
    const attackFormula = preview.hits > 1
      ? `${preview.perHit}×${preview.hits}=${preview.attackTotal}`
      : `${preview.attackTotal}`;
    details.push(`攻击 ${attackFormula}，护甲抵挡 ${preview.blocked}`);
  }
  if (preview.endTurnHpLoss) details.push(`情绪内耗 ${preview.endTurnHpLoss}（无视护甲）`);
  if (!details.length) details.push("当前行动不会造成生命伤害");
  const state = preview.lethal ? "lethal" : preview.totalHpLoss > 0 ? "hit" : "safe";
  const headline = preview.lethal
    ? "结束回合将被击倒"
    : preview.totalHpLoss > 0
    ? `预计掉血 ${preview.totalHpLoss}`
    : preview.attackTotal > 0
    ? "护甲足够 · 预计掉血 0"
    : "预计掉血 0";
  return `<div class="incoming-damage state-${state}">
    <span>${details.join(" · ")}</span>
    <strong>${headline}</strong>
    <em>结束后生命 ${preview.hpAfter}/${game.maxHp}</em>
  </div>`;
}

function turnRiskAdviceHtml(guidance) {
  const stateLabel = guidance.state === "lethal"
    ? "致命预警"
    : guidance.state === "hit"
    ? `预计损失 ${guidance.totalHpLoss} 生命`
    : guidance.attackTotal > 0
    ? "预计无伤"
    : "安全窗口";
  return `<div class="turn-risk-advice state-${guidance.state}" role="note" aria-label="${escapeHtml(`${stateLabel}：${guidance.headline}。${guidance.detail}`)}">
    <small>${escapeHtml(stateLabel)}</small>
    <span><strong>${escapeHtml(guidance.headline)}</strong><em>${escapeHtml(guidance.detail)}</em></span>
    ${guidance.armorNeeded > 0 ? `<b>缺 ${guidance.armorNeeded} 护甲</b>` : `<b>${escapeHtml(guidance.buttonDetail)}</b>`}
  </div>`;
}

function enemyResolutionAdviceHtml(resolution) {
  return `<div class="turn-risk-advice state-resolving" role="note" aria-label="${escapeHtml(`第 ${resolution.turn} 回合敌方行动：${resolution.name}。${resolution.result}`)}">
    <small>敌方回合</small>
    <span><strong>${escapeHtml(resolution.name)} 已结算</strong><em>${escapeHtml(resolution.result)}</em></span>
    <b>即将轮到你</b>
  </div>`;
}

function enemyHitBreakdownHtml(steps = []) {
  if (!steps.length) return "";
  const accessibleSummary = steps.map((step) => `第 ${step.index} 段，护甲抵挡 ${step.blocked}，生命损失 ${step.hpLoss}`).join("；");
  return `<div class="enemy-hit-breakdown" aria-label="${escapeHtml(accessibleSummary)}">
    ${steps.map((step) => {
      const parts = [step.blocked ? `挡 ${step.blocked}` : "", step.hpLoss ? `掉 ${step.hpLoss}` : ""].filter(Boolean);
      return `<span class="enemy-hit-step ${step.hpLoss ? "hit-damage" : "hit-blocked"}"><b>第 ${step.index} 段</b><em>${parts.join(" · ") || "无伤"}</em></span>`;
    }).join("")}
  </div>`;
}

function enemyHitPulseHtml(steps = []) {
  const pulses = enemyHitPulseSequence(steps);
  if (!pulses.length) return "";
  return `<div class="enemy-hit-pulse-layer" aria-hidden="true">
    ${pulses.map((pulse) => `<i class="enemy-hit-pulse pulse-${pulse.tone}" style="--hit-delay:${pulse.delay}ms"><b>${escapeHtml(pulse.label)}</b></i>`).join("")}
  </div>`;
}

function enemyActionEffects(result, statusPlacements = []) {
  if (!result) return [];
  const effects = [];
  if (result.debuff) {
    const debuffName = result.debuff.id === "distracted" ? "走神" : result.debuff.id;
    if (result.debuff.applied) effects.push({ tone: "danger", label: `受到${debuffName}` });
    else if (result.debuff.blockedBy) {
      const itemName = ITEM_DEFS[result.debuff.blockedBy]?.name || result.debuff.blockedBy;
      effects.push({ tone: "guard", label: `${itemName}抵挡${debuffName}` });
    }
  }
  for (const placement of statusPlacements) {
    const cardName = CARD_DEFS[placement.id]?.name || placement.id;
    const zoneName = placement.target === "hand"
      ? "抽到手牌"
      : placement.target === "drawPile"
      ? "洗入抽牌堆"
      : "加入弃牌堆";
    effects.push({ tone: "status", label: `${zoneName} ${placement.count} 张${cardName}` });
  }
  for (const trigger of result.triggers || []) {
    const itemName = ITEM_DEFS[trigger.id]?.name || trigger.id;
    if (trigger.effect === "nextDraw") effects.push({ tone: "item", label: `${itemName}触发：下回合抽牌 +${trigger.amount}` });
  }
  return effects;
}

function enemyActionCausalEffects(result, statusPlacements = []) {
  if (!result) return [];
  const effects = [];
  if (result.debuff?.applied === true) {
    effects.push({ type: "debuff", id: result.debuff.id, applied: true });
  }
  for (const placement of statusPlacements) {
    if (!["hand", "drawPile", "discardPile"].includes(placement.target)) continue;
    effects.push({
      type: "status",
      id: placement.id,
      count: placement.count,
      target: placement.target
    });
  }
  return effects;
}

function enemyEffectChipsHtml(effects = []) {
  if (!effects.length) return "";
  return `<div class="enemy-effect-results">${effects.map((effect) => `<span class="effect-${effect.tone}">${escapeHtml(effect.label)}</span>`).join("")}</div>`;
}

function renderLethalEndTurnConfirm(preview) {
  return `<div class="result-overlay lethal-end-turn-overlay" role="dialog" aria-modal="true" aria-labelledby="lethal-end-turn-title" aria-describedby="lethal-end-turn-description">
    <div class="result-card lethal-end-turn-card">
      <small>危险操作确认</small>
      <h2 id="lethal-end-turn-title">结束回合会被击倒</h2>
      <p id="lethal-end-turn-description">敌人行动后预计损失 <b>${preview.totalHpLoss}</b> 点生命，生命将从 <b>${game.hp}</b> 降至 <b>${preview.hpAfter}</b>。</p>
      <div class="lethal-end-turn-summary">
        <span>当前护甲 <b>${game.combat.playerBlock}</b></span>
        <span>预计掉血 <b>${preview.totalHpLoss}</b></span>
        <span>回合后生命 <b>${preview.hpAfter}/${game.maxHp}</b></span>
      </div>
      <p class="lethal-end-turn-tip">你还可以继续出牌、使用宠物技能，或确认承担这次伤害。</p>
      <div class="confirm-actions">
        <button class="quiet-button" data-action="cancel-lethal-end-turn" autofocus>继续出牌</button>
        <button class="danger-button" data-action="confirm-lethal-end-turn">确认结束回合</button>
      </div>
    </div>
  </div>`;
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
  if (!combat || combat.status === "active") return false;
  if (combat.careerRecorded) return true;
  const summary = game.combatSummary();
  const newAchievements = recordCareerCombat(career, summary);
  combat.summary = summary;
  combat.careerRecorded = true;
  combat.newAchievements = Array.from(new Set([...(combat.newAchievements || []), ...newAchievements]));
  saveCareer();
  finalizeCombatPersistence(summary.result, {
    completeCheckpoint: () => game.completePendingCombatStart(),
    clearRunSave: clearSave
  });
  if (summary.result === "won" && context.outcome === "event") game.completePendingEvent();
  if (summary.result === "won" && context.outcome === "boss") {
    game.prepareSemesterRewards(BOSS_ITEM_IDS);
    saveGame();
  } else if (summary.result === "won" && context.outcome === "elite") {
    game.prepareEliteCombatReward();
    saveGame();
  } else if (summary.result === "won" && context.outcome === "challenge") {
    game.prepareChallengeCombatReward({
      enemyId: summary.enemyId,
      affix: summary.challengeAffix,
      trialCompleted: summary.challengeTrial?.completed,
      trialBonus: summary.challengeTrialBonus
    });
    saveGame();
  } else if (summary.result === "won" && context.outcome === "event") {
    game.prepareEventCombatReward();
    saveGame();
  } else if (summary.result === "won" && context.outcome === "normal") {
    game.prepareNormalCombatReward();
    saveGame();
  }
  return true;
}

function finishPlayerTurn() {
  context.confirmLethalEndTurn = false;
  const before = battleStateSnapshot();
  const intent = game.getIntent();
  const enemyId = game.combat.enemy.id;
  const resolvingTurn = game.combat.turn;
  const result = game.endTurn();
  const statusPlacements = result.ok
    ? enemyStatusCausalPlacements(before.cardUids, game.combat, result.enemyResult?.statusAdded)
    : [];
  const actualEffects = enemyActionEffects(result.enemyResult, statusPlacements);
  if (!result.ok) {
    setToast(result.reason);
  } else {
    const endTurnHpLoss = result.endTurnResult?.hpLossApplied || 0;
    if (!result.enemyResult) {
      queueBattleFeedback("status", "情绪内耗", before, {
        cardType: "status",
        endTurnHpLoss,
        enemyAttackHpLoss: 0,
        drawResult: result.drawResult,
        effectParts: endTurnHpLoss ? ["无视护甲"] : []
      });
    } else {
      const enemyAttack = result.enemyResult.attack;
      const hitBreakdown = enemyAttack?.segments || [];
      const label = endTurnHpLoss
        ? `情绪内耗 → ${game.combat.enemy.name} · ${intent.name}`
        : `${game.combat.enemy.name} · ${intent.name}`;
      queueBattleFeedback("enemy", label, before, {
        enemyId,
        intentName: intent.name,
        endTurnHpLoss,
        enemyAttackHpLoss: enemyAttack?.healthDamage || 0,
        playerBlockAbsorbed: enemyAttack?.blocked || 0,
        enemyBlockGain: result.enemyResult.block?.gained || 0,
        hidePlayerDamageNumber: hitBreakdown.length > 0,
        lockCombatInput: game.combat.status === "active",
        drawResult: result.drawResult,
        effectParts: actualEffects.map((effect) => effect.label),
        causalEffects: enemyActionCausalEffects(result.enemyResult, statusPlacements),
        enemyResolution: {
          turn: resolvingTurn,
          name: intent.name,
          detail: enemyIntentDetailLines(intent, (id) => CARD_DEFS[id]?.name || id).join(" · "),
          intent: { attack: intent.attack, block: intent.block, hits: intent.hits },
          hitBreakdown,
          effects: actualEffects,
          mechanicState: result.enemyResult.mechanicState || intent.mechanicState
        }
      });
    }
  }
  const combatFinished = recordCurrentCombat();
  if (combatFinished) {
    resolveCombatResult();
    return;
  }
  render();
}

function combatRelicRowHtml() {
  const items = game.items.map((id) => {
    const item = ITEM_DEFS[id];
    const cue = combatItemCue(id, { combat: game.combat, flags: game.flags, maxHp: game.maxHp });
    return { item, cue };
  }).filter(({ item }) => item);
  return `<section class="combat-relic-row ${items.length ? "has-items" : "is-empty"}" aria-label="战斗随身物品">
    <div class="combat-relic-heading"><span>随身物品</span><b>${items.length}/${game.backpackCapacity}</b></div>
    ${items.length ? `<div class="combat-relic-icons" role="list">
      ${items.map(({ item, cue }) => `<article class="combat-relic state-${cue.tone}" role="listitem" tabindex="0" aria-label="${escapeHtml(`${item.name}，${item.timing}，${item.text}，当前状态：${cue.label}`)}">
        ${itemIconHtml(item, "combat-relic-icon")}
        <i class="combat-relic-state" aria-hidden="true"></i>
        <div class="combat-relic-tooltip" role="tooltip">
          <small>${rarityName(item.rarity)}物品 · ${escapeHtml(item.timing)}</small>
          <b>${escapeHtml(item.name)}</b>
          <p>${escapeHtml(item.text)}</p>
          <em>${escapeHtml(cue.label)}</em>
        </div>
      </article>`).join("")}
    </div>` : '<span class="combat-relic-empty">本场尚未携带物品</span>'}
  </section>`;
}

const COMBAT_SETUP_LOG_PATTERN = /^(?:遭遇 |塔罗契约·|挑战词缀·|新生首手保底：|创可贴生效：|静音手机生效：|巨蟹座命盘：|第一节早课：|塔罗·.+生效：|第 \d+ 回合：抽 )/;

function visibleCombatLogEntries(entries) {
  return entries.filter((entry) => !COMBAT_SETUP_LOG_PATTERN.test(entry)).slice(-3);
}

function renderCombat() {
  const combat = game.combat;
  const battleFeedback = context.battleFeedback;
  const combatInputLocked = context.combatInputLocked === true && combat.status === "active";
  const enemyResolution = combatInputLocked ? context.enemyResolution : null;
  const tarot = game.tarot;
  const challengeAffix = CHALLENGE_AFFIX_DEFS[combat.modifiers.affix];
  const challengeTrial = combat.modifiers.challenge ? game.challengeTrialStatus() : null;
  const challengeSourceHint = combat.modifiers.challenge
    ? challengeRewardSourceHintText(combat.enemy.id)
    : "";
  const intent = game.getIntent();
  const incomingDamage = game.incomingDamagePreview();
  const turnRisk = endTurnRiskGuidance(incomingDamage, game.hp);
  const enemyHp = (combat.enemy.hp / combat.enemy.maxHp) * 100;
  const playerHp = (game.hp / game.maxHp) * 100;
  const petPreview = game.petSkillPreview();
  const petExtras = [
    petPreview.block ? `护甲 ${petPreview.block}` : "",
    petPreview.draw ? `抽 ${petPreview.draw}` : "",
    petPreview.nextDrawBonus ? `下回合抽牌 +${petPreview.nextDrawBonus}` : ""
  ].filter(Boolean).join(" · ");
  const petReady = game.pet.charge >= game.pet.maxCharge;
  const petCost = Math.max(0, Number(petPreview.skill?.energyCost) || 0);
  const petUnavailable = combatInputLocked
    || Boolean(combat.pendingDiscard)
    || !petReady
    || combat.energy < petCost
    || combat.status !== "active";
  const petAvailabilityText = combat.status !== "active"
    ? "战斗已经结束"
    : combatInputLocked
        ? "敌方行动结算中，暂不可发动"
        : combat.pendingDiscard
          ? "请先完成弃牌"
          : !petReady
            ? "每回合首张攻击牌充能 +1"
            : combat.energy < petCost
              ? `还差 ${petCost - combat.energy} 点能量`
              : "充能完成，可以发动";
  const petButtonText = !petUnavailable
    ? "发动技能"
    : combat.status !== "active"
      ? "战斗已结束"
      : combatInputLocked
          ? "敌方行动中"
          : combat.pendingDiscard
            ? "先完成弃牌"
            : !petReady
              ? "尚未充满"
              : "能量不足";
  const mechanicStatusName = CARD_DEFS[intent.scaling?.statusId]?.name || "状态";
  const handModels = combat.hand.map((card, index) => {
    const actionable = !combatInputLocked && !combat.pendingDiscard && game.canPlay(card).ok;
    const playable = combatInputLocked ? false : combat.pendingDiscard ? true : actionable;
    const combatPreview = game.cardEffectPreview(card);
    const distractedFollowup = game.clearDistractedFollowupPreview(card);
    const mechanicStatusCleared = combatMechanicStatusCleared(combatPreview, intent, combat.hand);
    const tacticalCue = combatInputLocked || combat.pendingDiscard ? null : combatCardTacticalCue(combatPreview, incomingDamage, {
      enemyHp: combat.enemy.hp,
      playerHp: game.hp,
      playable: actionable,
      mechanicState: intent.mechanicState,
      mechanicStatusCleared,
      mechanicStatusName,
      distractedFollowup
    });
    return {
      card,
      index,
      playable,
      actionable,
      combatPreview,
      distractedFollowup,
      mechanicStatusCleared,
      tacticalCue
    };
  });
  const petActionPreview = combatDirectActionPreview(petPreview, {
    cost: petCost,
    enemyBlock: combat.enemy.block,
    enemyHp: combat.enemy.hp
  });
  const immediatePlan = combatImmediateCounterplayPlan([
    ...handModels.map((model) => ({
      key: model.card.uid,
      source: "card",
      name: cardDefinition(model.card).displayName,
      playable: model.actionable,
      cost: model.combatPreview.cost,
      preview: model.combatPreview,
      mechanicStatusCleared: model.mechanicStatusCleared,
      mechanicStatusName,
      distractedFollowup: model.distractedFollowup,
      tacticalCue: model.tacticalCue,
      unaffectedByDistracted: CARD_DEFS[model.card.id]?.type === "skill" && model.combatPreview.hasDamage
    })),
    {
      key: `pet-${game.activePetId}`,
      source: "pet",
      name: `${petPreview.pet?.shortName || petPreview.pet?.name || "宠物"}·${petPreview.skill?.name || "技能"}`,
      playable: !petUnavailable,
      cost: petCost,
      preview: petActionPreview,
      mechanicStatusCleared: 0,
      mechanicStatusName,
      distractedFollowup: null,
      unaffectedByDistracted: true
    }
  ], intent, incomingDamage, {
    enemyHp: combat.enemy.hp,
    playerHp: game.hp,
    distracted: combat.distracted,
    disabled: combatInputLocked || Boolean(combat.pendingDiscard) || combat.status !== "active"
  });
  if (immediatePlan.finish?.tacticalCue?.tone === "finish") {
    const plannedCard = handModels.find((model) => model.card.uid === immediatePlan.finish.action.key);
    if (plannedCard) plannedCard.tacticalCue = immediatePlan.finish.tacticalCue;
  }
  const intentCounterplayCue = enemyIntentCounterplayCue(combat.enemy.id, intent, {
    intentTurn: combat.enemy.intentTurn,
    risk: turnRisk,
    distracted: combat.distracted,
    enemy: combat.enemy,
    plan: immediatePlan,
    actionsEvaluated: true,
    pendingDiscard: Boolean(combat.pendingDiscard),
    fallback: ENEMY_DEFS[combat.enemy.id]?.tip
  });
  const petChargePercent = Math.round((game.pet.charge / Math.max(1, game.pet.maxCharge)) * 100);
  const energy = combatEnergyState(combat);
  const visibleCombatLog = visibleCombatLogEntries(combat.log);
  const body = `
    ${combat.routeBonusGold ? `<div class="route-threat-contract"><b>高压加练 · 威胁 ${combat.routeThreat}</b><span>你主动选择了本周更危险的对手</span><em>胜利额外 +${combat.routeBonusGold} 币 · 共 ${NORMAL_COMBAT_REWARD_GOLD + combat.routeBonusGold} 币</em></div>` : ""}
    ${combat.modifiers.challenge ? `<div class="challenge-contract"><b>${challengeAffix.icon} ${challengeAffix.name}</b><span>${challengeSourceHint ? `<i class="challenge-source-hint">${escapeHtml(challengeSourceHint)}</i> · ` : ""}${challengeAffix.text}</span><small>基础强化：生命 +${Math.round((CHALLENGE_RULES.hpMultiplier - 1) * 100)}% · 攻击伤害 +${Math.round((CHALLENGE_RULES.damageMultiplier - 1) * 100)}%</small><em>胜利：三种奖励方向任选一</em></div>` : ""}
    ${challengeTrial ? `<div class="challenge-trial-progress state-${challengeTrial.state}"><b>${challengeTrial.icon} 星座试炼 · ${challengeTrial.name}</b><span>${challengeTrial.text}</span><em>${challengeTrial.progress}</em><i>${challengeTrial.state === "achieved" ? "已达成，赢下战斗即可结算" : challengeTrial.state === "failed" ? "本场已经错过，不影响挑战胜负" : `完成额外 +${challengeTrial.bonusGold} 币`}</i></div>` : ""}
    ${combatRelicRowHtml()}
    <div class="combat-board ${battleFeedback ? `feedback-${battleFeedback.kind} feedback-${battleFeedback.tone}` : ""} ${combatInputLocked ? "enemy-resolving" : ""}">
      ${combatPassiveTrayHtml(tarot)}
      ${battleFeedbackHtml(battleFeedback)}
      ${enemyResolution ? enemyHitPulseHtml(enemyResolution.hitBreakdown) : ""}
      ${combatInputLocked ? '<div class="enemy-resolve-phase" role="status" aria-live="polite"><i aria-hidden="true"></i><span><b>敌方行动结算中</b><small>看清结果后继续出牌</small></span></div>' : ""}
      <section class="fighter player-fighter">
        <div class="fighter-label"><span>学生</span></div>
        <div class="player-character-stage">
          ${renderStudentAvatar()}
          ${renderBattlePet()}
        </div>
        <div class="combat-vitals">
          <span class="block-shield ${combat.playerBlock > 0 ? "has-block" : "is-empty"}" aria-label="当前护甲 ${combat.playerBlock}"><b>${combat.playerBlock}</b></span>
          <div class="hpbar"><i style="width:${playerHp}%"></i><b>${game.hp}/${game.maxHp}</b></div>
        </div>
        <div class="status-row">${combat.distracted ? '<span class="status negative">走神：攻击每段 -2</span>' : '<span class="status">状态正常</span>'}${combat.summons ? `<span class="status summon-status">纸灵 ${combat.summons}/3</span>` : ""}</div>
      </section>

      <section class="battle-center">
        <div class="combat-log">
          ${visibleCombatLog.reverse().map((entry) => `<p>${escapeHtml(entry)}</p>`).join("")}
        </div>
      </section>

      <section class="fighter enemy-fighter">
        <div class="fighter-label"><span>${combat.enemy.name}</span></div>
        ${enemyIntentTokenHtml(intent, enemyResolution, intentCounterplayCue)}
        ${enemyMechanicProgressHtml(combat.enemy, intent, enemyResolution)}
        ${renderEnemyAvatar(combat.enemy)}
        <div class="combat-vitals enemy-vitals">
          <span class="block-shield ${combat.enemy.block > 0 ? "has-block" : "is-empty"}" aria-label="敌人当前护甲 ${combat.enemy.block}"><b>${combat.enemy.block}</b></span>
          <div class="hpbar enemy-hp"><i style="width:${enemyHp}%"></i><b>${combat.enemy.hp}/${combat.enemy.maxHp}</b></div>
        </div>
        <p>${combat.enemy.subtitle}</p>
        <div class="status-row enemy-status-row">${combat.enemyAttackDown ? `<span class="status negative">压制：下次攻击 -${combat.enemyAttackDown}/段</span>` : ""}${combat.enemyExposed ? `<span class="status exposed">露怯：后续攻击 +${combat.enemyExposed}/段</span>` : ""}</div>
      </section>
    </div>

    <section class="combat-action-dock" aria-label="战斗操作区">
    <div class="combat-controls">
      <div class="energy-companion-stack">
        <article class="pet-companion-token ${petReady ? "ready" : ""}" tabindex="0" style="--pet-charge:${petChargePercent}%" aria-label="查看宠物技能，当前充能 ${game.pet.charge}/${game.pet.maxCharge}">
          ${renderPetFace()}<b>${game.pet.charge}/${game.pet.maxCharge}</b>
          <div class="pet-companion-tooltip" role="tooltip">
            <small>战斗伙伴 · 当前充能 ${game.pet.charge}/${game.pet.maxCharge}</small>
            <strong>${currentPetDefinition().skill.name}${petPreview.talent ? ` · ${petPreview.talent.name}` : ""}</strong>
            <p>${petCost} 能量 · ${petPreview.damage} 伤害${petExtras ? ` · ${petExtras}` : ""} · 出手后充能归零</p>
            <em>${petAvailabilityText}</em>
            <button class="pet-skill ${!petUnavailable ? "ready" : ""}" data-action="pet-skill" aria-keyshortcuts="G" ${petUnavailable ? "disabled" : ""}><kbd class="control-shortcut" aria-hidden="true">G</kbd>${petButtonText}</button>
          </div>
        </article>
        <div class="energy-orb" aria-label="当前能量 ${energy.current}，本回合上限 ${energy.maximum}">
          <i class="energy-orb-core" aria-hidden="true"></i>
          <span class="energy-orb-value"><b>${energy.current}</b><i>/</i><strong>${energy.maximum}</strong></span>
          <small>能量</small>
        </div>
      </div>
      ${combatSupplyTrayHtml(combatInputLocked || Boolean(combat.pendingDiscard) || combat.status !== "active")}
      <button class="end-turn state-${combatInputLocked ? "resolving" : turnRisk.state}" data-action="end-turn" aria-keyshortcuts="E" aria-label="${combatInputLocked ? "敌方行动正在结算" : `结束回合，${escapeHtml(turnRisk.buttonDetail)}`}" ${combatInputLocked || combat.status !== "active" || combat.pendingDiscard ? "disabled" : ""}><kbd class="control-shortcut" aria-hidden="true">E</kbd><span>${combatInputLocked ? "等待结算" : "结束回合"}<small>${combatInputLocked ? "敌方行动中" : escapeHtml(turnRisk.buttonDetail)}</small></span></button>
    </div>
    <div class="pile-counts" aria-label="战斗牌堆">
      <button class="pile-button pile-draw" data-action="open-pile" data-zone="drawPile" aria-label="查看抽牌堆，共 ${combat.drawPile.length} 张" ${combatInputLocked ? "disabled" : ""}><i class="pile-stack" aria-hidden="true"></i><span>抽牌堆</span><b>${combat.drawPile.length}</b></button>
      <button class="pile-button pile-discard" data-action="open-pile" data-zone="discardPile" aria-label="查看弃牌堆，共 ${combat.discardPile.length} 张" ${combatInputLocked ? "disabled" : ""}><i class="pile-stack" aria-hidden="true"></i><span>弃牌堆</span><b>${combat.discardPile.length}</b></button>
    </div>
    <div class="combat-shortcut-guide" aria-label="战斗快捷键">
      <span><kbd>1–9</kbd> 对应手牌</span><span><kbd>R</kbd> 查看意图</span><span><kbd>G</kbd> ${currentPetDefinition().shortName}出手</span><span><kbd>E</kbd> 结束回合</span><span><kbd>Esc</kbd> 关闭弹层</span>
    </div>

    ${combat.pendingDiscard ? '<div class="discard-prompt">草稿纸：请选择一张手牌弃掉</div>' : ""}
    <div class="hand">
      ${handModels.map(({ card, index, playable, combatPreview, tacticalCue }) => {
        return cardHtml(card, {
          action: combat.pendingDiscard ? "discard-card" : "play-card",
          playable,
          combatPreview,
          tacticalCue,
          handPose: handCardPose(index, combat.hand.length),
          shortcut: index < 9 ? index + 1 : null
        });
      }).join("")}
    </div>
    </section>
    ${pileView ? renderPileOverlay(combat) : ""}
    ${tutorialStep >= 0 && combat.status === "active" ? renderTutorial() : ""}
    ${context.confirmLethalEndTurn && combat.status === "active" ? renderLethalEndTurnConfirm(incomingDamage) : ""}
  `;
  return `${topBar()}<main class="combat-page" aria-busy="${combatInputLocked}">${body}</main>${toast ? `<div class="toast" aria-hidden="true">${escapeHtml(toast)}</div>` : ""}`;
}

function renderPileOverlay(combat) {
  const labels = {
    drawPile: ["抽牌堆", "仅按牌名整理展示；实际抽取顺序仍未知。"],
    discardPile: ["弃牌堆", "抽牌堆耗尽后，这些牌会重新洗回去。"],
    exhaustPile: ["消耗堆", "这些牌本场战斗不会再次进入抽牌堆。"]
  };
  const [title, description] = labels[pileView];
  const cards = [...(combat[pileView] || [])];
  if (pileView === "drawPile") {
    cards.sort((left, right) => cardDefinition(left).displayName.localeCompare(cardDefinition(right).displayName, "zh-CN"));
  }
  return `<div class="pile-overlay">
    <section class="pile-dialog" role="dialog" aria-modal="true" aria-labelledby="pile-dialog-title" aria-describedby="pile-dialog-description">
      <div class="pile-dialog-heading"><small>战斗信息</small><h2 id="pile-dialog-title">${title} · ${cards.length}</h2><p id="pile-dialog-description">${description}</p></div>
      <div class="pile-card-grid">${cards.length ? cards.map((card) => cardHtml(card, { playable: false })).join("") : '<p class="empty-state">这里暂时没有牌。</p>'}</div>
      <button class="primary centered" data-action="close-pile" autofocus>返回战斗</button>
    </section>
  </div>`;
}

function renderTutorial() {
  const steps = [
    { number: "01", title: "先看意图，再出牌", text: "首场前 3 张手牌固定为攻击、防御与主角特性牌。敌人头顶图标公开它的下一步；获得 5 护甲就能完全挡住“攻击 5”。" },
    { number: "02", title: "一回合：你出牌，敌人行动", text: "卡牌左上角是费用；玩家回合开始抽 5 张并获得 3 能量。出牌后点“结束回合”，敌人按头顶意图行动，再进入下一回合；护甲会在下个玩家回合开始时清空。" },
    { number: "03", title: `让${currentPetDefinition().name}一起打`, text: "每回合第一次打出攻击牌，宠物充能 +1。充满后花 1 能量出手，充能归零后可以重新积累。" }
  ];
  const step = steps[tutorialStep];
  return `<div class="tutorial-overlay">
    <section class="tutorial-card" id="tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="tutorial-progress tutorial-title" aria-describedby="tutorial-description">
      <small id="tutorial-progress">新生教学 ${step.number}/03</small><h2 id="tutorial-title">${step.title}</h2><p id="tutorial-description">${step.text}</p>
      <div><button class="quiet-button" data-action="skip-tutorial">跳过教学</button><button class="primary" data-action="tutorial-next" autofocus>${tutorialStep === steps.length - 1 ? "明白，开始战斗" : "下一条"}</button></div>
    </section>
  </div>`;
}

function combatSupplyTrayHtml(inputLocked = false) {
  if (!game.supplies.length) return '<div class="combat-supply-tray is-empty" aria-label="临时用品栏为空"><small>用品</small><span>0/2</span></div>';
  return `<div class="combat-supply-tray" aria-label="临时用品 ${game.supplies.length}/${game.supplyCapacity}">
    <small>用品</small>${game.supplies.map((id, index) => {
      const supply = SUPPLY_DEFS[id];
      return `<button data-action="use-supply" data-id="${escapeHtml(id)}" data-index="${index}" ${inputLocked ? "disabled" : ""} aria-label="使用${escapeHtml(supply.name)}：${escapeHtml(supply.text)}">
        ${supplyIconHtml(supply, "combat-supply-icon")}<span>${escapeHtml(supply.name)}</span>
      </button>`;
    }).join("")}<b>${game.supplies.length}/${game.supplyCapacity}</b>
  </div>`;
}

function completeTutorial() {
  tutorialStep = -1;
  game.tutorialSeen = true;
  saveGame();
  render();
  app.querySelector('[data-action="toggle-intent-details"]')?.focus();
}

function availableChallengeItems(pending = game.pendingCombatReward) {
  return game.availableChallengeItemIds(pending?.enemyId, pending?.signatureItemId);
}

function renderChallengeReward() {
  const affix = CHALLENGE_AFFIX_DEFS[context.affix];
  const pending = game.pendingCombatReward;
  const rewardSource = challengeRewardSourcePreview(pending?.enemyId, pending);
  const rewardEgg = rewardSource.egg;
  const rewardSignatureItem = rewardSource.signatureItem;
  const hasEggRoute = pending?.rewardVariant === "egg" && Boolean(rewardEgg);
  const hasMasteryFallback = pending?.rewardVariant === "mastery";
  const hasSignatureItemRoute = Boolean(rewardSignatureItem);
  const availableItems = availableChallengeItems(pending);
  const hasNewItems = availableItems.length > 0;
  const advice = challengeRewardGuidance(game, availableItems.length);
  const recommendedReward = CHALLENGE_REWARD_DEFS[advice.recommendedId];
  const recommendedRewardName = advice.recommendedId === "pet" && hasEggRoute
    ? rewardEgg.name
    : advice.recommendedId === "item" && hasSignatureItemRoute
      ? rewardSignatureItem.name
    : recommendedReward.name;
  const body = `
    <div class="challenge-reward-summary"><b>${affix.icon} ${affix.name}完成</b><span>${context.trialCompleted ? `星座试炼额外 ${context.trialBonus} 校园币已到账。` : "奖励只改变本局构筑，不提供跨对局永久数值。"}</span></div>
    <div class="challenge-reward-advisor">
      <span>${advice.build.sign}</span>
      <div><small>本局构筑参谋</small><b>优先考虑：${recommendedRewardName}</b><p>${advice.recommendedId === "pet" && hasEggRoute ? `本场击败${ENEMY_DEFS[pending.enemyId]?.name || "可驯化怪物"}，现在选择即可确定获得对应宠物蛋。` : advice.options[advice.recommendedId].reason}</p></div>
      <em>只读取当前构筑并解释判断，不改变奖励内容，也不会自动选择。</em>
    </div>
    <div class="challenge-reward-grid">
      ${Object.values(CHALLENGE_REWARD_DEFS).map((reward) => {
        const guide = advice.options[reward.id];
        const isEggReward = reward.id === "pet" && hasEggRoute;
        const isMasteryFallback = reward.id === "pet" && hasMasteryFallback;
        const isSignatureItemReward = reward.id === "item" && hasSignatureItemRoute;
        const text = isEggReward
          ? `获得 ${reward.gold} 校园币与${rewardEgg.name}。宠物蛋进入独立孵化位，不占书包。`
          : isMasteryFallback
          ? `当前宠物已经精通，本路线改为共 ${reward.masteryFallbackGold} 校园币，不再增加无效羁绊。`
          : isSignatureItemReward
          ? `获得 ${reward.gold} 校园币，并确定领取${rewardSignatureItem.name}。只占本次物品路线，不增加奖励份数。`
          : reward.id === "item" && !hasNewItems
          ? `随身物品已全部收集，选择后改为获得 ${reward.fallbackGold} 校园币。`
          : reward.text;
        const preview = reward.id === "cards"
          ? `结算后 ${game.gold + reward.gold} 币 · 再选 1 张牌`
          : reward.id === "pet"
            ? isEggReward
              ? `结算后 ${game.gold + reward.gold} 币 · 孵化 0/${eggRequiredCombats(rewardEgg)}`
              : isMasteryFallback
                ? `结算后 ${game.gold + reward.masteryFallbackGold} 币 · 羁绊保持 ${game.pet.bond}`
                : `结算后 ${game.gold + reward.gold} 币 · 羁绊 ${game.pet.bond + reward.bond}`
            : isSignatureItemReward
              ? `结算后 ${game.gold + reward.gold} 币 · 确定 1 件招牌物品`
            : hasNewItems
              ? `结算后 ${game.gold + reward.gold} 币 · 再选 1 件物品`
              : `结算后 ${game.gold + reward.fallbackGold} 币`;
        const name = isEggReward ? rewardEgg.name : isSignatureItemReward ? rewardSignatureItem.name : reward.name;
        const icon = isEggReward
          ? petEggHtml(rewardEgg.id, "reward-egg")
          : isSignatureItemReward
            ? itemIconHtml(rewardSignatureItem, "item-icon challenge-signature-icon")
            : escapeHtml(reward.icon);
        const reason = isEggReward
          ? `来源公开：${ENEMY_DEFS[pending.enemyId]?.name || "本场怪物"}。领取后需在休息节点主动孵化 ${eggRequiredCombats(rewardEgg)} 次。`
          : isSignatureItemReward
            ? `招牌来源：${rewardSource.enemy?.name || "本场怪物"}。${rewardSignatureItem.text}`
          : guide.reason;
        return `<button class="challenge-reward-option reward-${reward.id} ${guide.recommended ? "is-recommended" : ""}" data-action="choose-challenge-reward" data-id="${reward.id}">
          ${guide.recommended ? '<i class="reward-recommend-badge">本局推荐</i>' : ""}
          <span class="${isEggReward ? "egg-reward-icon" : isSignatureItemReward ? "signature-reward-icon" : ""}">${icon}</span><small>${isEggReward ? "确定掉落 · 宠物蛋" : isSignatureItemReward ? "确定掉落 · 招牌物品" : "奖励路线"}</small><strong>${name}</strong><p>${text}</p><em>${reason}</em><b>${preview} · 选择 →</b>
        </button>`;
      }).join("")}
    </div>`;
  return page("选择挑战奖励", "自习室荣誉", body, {
    description: "没有绝对最强的奖励；选择最能补足当前构筑目标的一条。",
    className: "challenge-reward-page"
  });
}

function renderCardReward() {
  const archetypeCount = context.choices.filter((id) => CARD_DEFS[id].archetype === game.archetypeId).length;
  const personaCount = context.choices.filter((id) => CARD_DEFS[id].persona === game.personaId).length;
  const publicCount = context.choices.length - archetypeCount - personaCount;
  const poolLabels = [
    personaCount ? `${personaCount} 张${game.persona.name}专属` : "",
    archetypeCount ? `${archetypeCount} 张本星座专属` : "",
    publicCount ? `${publicCount} 张普池` : ""
  ].filter(Boolean);
  const poolMark = personaCount ? game.persona.icon : game.archetype.sign;
  const body = `
    <div class="choice-copy"><p>${context.message || "选一张加入构筑，也可以跳过。"}</p></div>
    <div class="pool-composition"><b>${poolMark} 当前奖励构成</b>${poolLabels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}<em>不会出现其他星座或人格专属牌</em></div>
    ${choiceAdviceHtml(context.choices)}
    <div class="card-choice-row">${context.choices.map((id) => cardHtml(id, {
      action: "take-reward-card",
      fit: evaluateCardFit(game, id),
      rewardSource: context.rewardSource,
      rewardToken: context.rewardToken
    })).join("")}</div>
    <div class="choice-actions">
      ${game.hasItem("eraser") && !game.flags.eraserUsed && context.allowReroll !== false ? '<button class="secondary" data-action="reroll-reward">橡皮擦：本学期重抽一次</button>' : ""}
      <button class="quiet-button" data-action="skip-reward" data-reward-source="${escapeHtml(context.rewardSource || "")}" data-reward-token="${escapeHtml(context.rewardToken || "")}">跳过，不让卡组变厚</button>
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
  const pending = game.pendingItemReplacement;
  const incoming = ITEM_DEFS[pending?.incoming];
  if (!incoming) {
    return page("整理书包", "状态异常", '<div class="warning-box">待替换物品已经失效。</div>');
  }
  const shopPurchase = pending.source === "shop";
  const body = `
    <div class="incoming-item"><small>${shopPurchase ? `商店待付款 · ${pending.price} 校园币` : "准备装入"}</small><strong>${incoming.name}</strong><p>${incoming.text}</p></div>
    <p class="center-copy">${shopPurchase ? "点击一件旧物品即会将它放回柜台，并支付冻结价格完成购买。" : "选择一件旧物品丢弃："}</p>
    <div class="replace-item-toolbar"><button class="quiet-button centered" data-action="cancel-replace">${shopPurchase ? "取消购买，返回商店" : "取消"}</button></div>
    <div class="item-choice-list">${game.items.map((id) => itemHtml(id, {
      action: "replace-item",
      price: shopPurchase ? `换下并支付 ${pending.price} 币` : undefined
    })).join("")}</div>`;
  return page("整理书包", shopPurchase ? `容量 ${game.items.length}/${game.backpackCapacity} · 尚未扣款` : "容量已满", body, { className: "replace-item-page" });
}

function renderBossEggReward() {
  const pending = game.pendingSemesterReward;
  const egg = petEggDefinition(pending?.eggId);
  if (pending?.stage !== "bossEgg" || !egg) {
    return page("奖励状态已变化", "期末战利品", '<button class="primary centered" data-action="resume-semester-reward">继续结算</button>');
  }
  const hatchling = PET_DEFS[egg.petId];
  const queueText = game.incubator
    ? `当前孵化位已有${petEggDefinition(game.incubator.eggId)?.name || "另一枚蛋"}，本蛋会进入等待队列。`
    : "领取后会放入休息区孵化位。";
  const body = `<section class="boss-egg-reward">
    <div class="boss-egg-visual">${petEggHtml(egg.id, "pet-egg boss-egg")}</div>
    <div><small>魔笑奶团龙 · 限定掉落</small><h2>${escapeHtml(egg.name)}</h2><p>在休息节点主动照料 3 次，孵化为${escapeHtml(hatchling?.name || "奶团龙幼崽")}。不会自动替换当前参战宠物。</p><em>${escapeHtml(queueText)}</em></div>
  </section><button class="primary big centered" data-action="claim-boss-egg">收下奶龙蛋</button>`;
  return page("Boss 战利品", `第 ${game.semester} 学期 · 独特伙伴蛋`, body, {
    className: "boss-egg-reward-page",
    description: "蛋是新的养成路线，不占随身物品容量。"
  });
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
  const handOnly = Boolean(context.handOnly && game.combat);
  if (handOnly) {
    const cards = Array.isArray(game.combat.hand) ? game.combat.hand : [];
    const body = `
      <div class="collection-summary">
        <span>当前手牌 ${cards.length} 张</span>
        <span>本回合能量 ${game.combat.energy}/${game.combat.maxEnergy}</span>
        <span>抽牌堆 ${game.combat.drawPile.length} 张</span>
        <span>弃牌堆 ${game.combat.discardPile.length} 张</span>
      </div>
      <div class="deck-grid current-hand-grid">${cards.length
        ? cards.map((card) => cardHtml(card, { playable: false })).join("")
        : '<p class="empty-state">当前手牌为空。返回战斗并结束回合后会重新抽牌。</p>'}</div>
      <button class="primary centered" data-action="close-deck">返回战斗</button>`;
    return page("当前手牌", `${cards.length} 张牌`, body, {
      className: "current-hand-page",
      description: "这里只显示当前回合真正拿在手里的牌；返回战斗后照常出牌。"
    });
  }
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
    <button class="primary centered" data-action="close-deck">返回</button>`;
  return page("当前卡牌", `${game.deck.length} 张牌`, body, {
    className: "current-deck-page",
    description: "卡组越薄，核心牌出现得越稳定；状态牌只在战斗中临时加入。"
  });
}

function renderItems() {
  const supplyCount = game.supplies.length;
  const body = `
    <div class="collection-summary">
      <span>已携带 ${game.items.length} 件</span>
      <span>书包容量 ${game.backpackCapacity} 件</span>
      <span>临时用品 ${supplyCount}/${game.supplyCapacity}</span>
    </div>
    <h2 class="subheading">随身物品</h2>
    <div class="item-choice-list compact current-items-list">
      ${game.items.length
        ? game.items.map((id) => itemHtml(id, { disabled: true })).join("")
        : '<p class="empty-state">书包还是空的。战斗、事件和商店都可能获得随身物品。</p>'}
    </div>
    <h2 class="subheading current-supplies-heading">临时用品</h2>
    <div class="supply-choice-list current-supplies-list">
      ${supplyCount
        ? game.supplies.map((id) => supplyHtml(id, { disabled: true, action: "inspect-supply" })).join("")
        : '<p class="empty-state">暂无临时用品；商店和部分事件会提供一次性用品。</p>'}
    </div>
    <button class="primary centered" data-action="close-items">返回</button>`;
  return page("当前物品", `${game.items.length} 件物品 · ${supplyCount} 件用品`, body, {
    description: "这里汇总本局已获得的随身物品与一次性用品；战斗中只能从用品栏主动使用临时用品。"
  });
}

const CARD_LIBRARY_FILTER_LABELS = Object.freeze({
  all: "全部",
  public: "公共牌",
  aries: `${ARCHETYPE_DEFS.aries.sign} 白羊`,
  gemini: `${ARCHETYPE_DEFS.gemini.sign} 双子`,
  cancer: `${ARCHETYPE_DEFS.cancer.sign} 巨蟹`,
  summoner: "召 召唤人格",
  status: "状态牌"
});

function renderLibrary() {
  const filter = normalizeCardLibraryFilter(context.libraryFilter);
  const cardIds = cardLibraryIds(CARD_DEFS, filter);
  const upgradedId = cardIds.includes(context.upgradedId) ? context.upgradedId : null;
  const typeCounts = cardIds.reduce((counts, id) => {
    const type = CARD_DEFS[id].type;
    counts[type] = (counts[type] || 0) + 1;
    return counts;
  }, {});
  const body = `
    <div class="library-toolbar">
      <div class="library-filters" role="group" aria-label="筛选卡牌池">
        ${CARD_LIBRARY_FILTERS.map((id) => {
          const active = id === filter;
          const count = cardLibraryIds(CARD_DEFS, id).length;
          return `<button type="button" data-action="filter-library" data-filter="${id}" aria-pressed="${active}" class="${active ? "active" : ""}">${CARD_LIBRARY_FILTER_LABELS[id]}<b>${count}</b></button>`;
        }).join("")}
      </div>
      <div class="library-summary" aria-live="polite">
        <span>攻击 ${typeCounts.attack || 0}</span>
        <span>技能 ${typeCounts.skill || 0}</span>
        <span>状态 ${typeCounts.status || 0}</span>
        <em>${upgradedId ? `${CARD_DEFS[upgradedId].name}：正在查看升级版` : "点击任意卡牌查看升级后数值"}</em>
      </div>
    </div>
    <div class="library-grid">
      ${cardIds.map((id) => {
        const upgraded = id === upgradedId;
        return cardHtml({ id, uid: `library-${id}`, upgraded }, {
          action: "toggle-library-upgrade",
          pressed: upgraded,
          className: `library-card${upgraded ? " is-upgraded" : ""}`
        });
      }).join("")}
    </div>
    <button class="primary centered" data-action="close-library">返回</button>`;
  return page("卡牌图鉴", `${CARD_LIBRARY_FILTER_LABELS[filter]} · ${cardIds.length}/${Object.keys(CARD_DEFS).length} 张`, body, {
    className: "library-page",
    description: "图鉴只读，不会改变当前卡组、奖励概率或存档；再次点击升级牌可恢复基础数值。"
  });
}

const ITEM_LIBRARY_FILTER_LABELS = Object.freeze({
  all: "全部",
  common: "普通",
  uncommon: "进阶",
  rare: "稀有",
  boss: "期末纪念物"
});

function renderItemLibrary() {
  const filter = normalizeItemLibraryFilter(context.itemLibraryFilter);
  const itemIds = itemLibraryIds(ITEM_DEFS, filter);
  const ownedCount = itemIds.filter((id) => game.hasItem(id)).length;
  const body = `
    <div class="library-toolbar item-library-toolbar">
      <div class="library-filters" role="group" aria-label="筛选随身物品">
        ${ITEM_LIBRARY_FILTERS.map((id) => {
          const active = id === filter;
          const count = itemLibraryIds(ITEM_DEFS, id).length;
          return `<button type="button" data-action="filter-item-library" data-filter="${id}" aria-pressed="${active}" class="${active ? "active" : ""}">${ITEM_LIBRARY_FILTER_LABELS[id]}<b>${count}</b></button>`;
        }).join("")}
      </div>
      <div class="library-summary" aria-live="polite">
        <span>当前页 ${itemIds.length}</span>
        <span>已拥有 ${ownedCount}</span>
        <em>所有物品都是自动规则，不占用出牌行动</em>
      </div>
    </div>
    <div class="item-library-grid">
      ${itemIds.map((id) => `
        <div class="item-library-entry ${game.hasItem(id) ? "is-owned" : ""}">
          ${itemHtml(id, { disabled: true })}
          ${game.hasItem(id) ? '<span class="item-owned-mark">书包已有</span>' : ""}
        </div>`).join("")}
    </div>
    <button class="primary centered" data-action="close-item-library">返回</button>`;
  return page("随身物品图鉴", `${ITEM_LIBRARY_FILTER_LABELS[filter]} · ${itemIds.length}/${Object.keys(ITEM_DEFS).length} 件`, body, {
    className: "item-library-page",
    description: "图鉴只读，不会改变书包、商店库存、奖励候选、随机数或存档。"
  });
}

function renderEnchantment() {
  const enchantment = context.enchantment;
  const body = `
    <div class="enchantment-rule">
      <span>${game.archetype.sign}</span>
      <div><small>本学期命盘觉醒</small><strong>${enchantment.name}</strong><p>${enchantment.text}</p></div>
    </div>
    <p class="center-copy">从当前卡组所有符合条件的牌中亲自选择一张。升级和刻印可以同时存在，但每张牌最多拥有一个刻印。</p>
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
  const petDefinition = currentPetDefinition();
  const talentChoices = (petDefinition.talentIds || [])
    .map((id) => PET_TALENT_DEFS[id])
    .filter(Boolean);
  const currentTalent = game.pet.talent ? PET_TALENT_DEFS[game.pet.talent] : null;
  const nextLevel = Math.min(3, game.pet.talentLevel + 1);
  const body = isChoice ? `
    <div class="pet-path-grid">
      ${talentChoices.map((talent) => `
        <button class="pet-path" data-action="select-pet-talent" data-id="${talent.id}">
          <span>${talent.icon}</span><small>羁绊路线</small><strong>${talent.name}</strong><em>${talent.tagline}</em><p>Lv.1：${talent.levels[0].text}</p>
        </button>`).join("") || '<div class="warning-box">这只宠物暂时没有可选择的羁绊路线。</div>'}
    </div>` : `
    <div class="pet-upgrade-card">
      <span>${currentTalent.icon}</span>
      <div><small>${milestone === "master" ? "终极默契" : "路线强化"}</small><h2>${currentTalent.name} Lv.${game.pet.talentLevel} → Lv.${nextLevel}</h2><p>${currentTalent.levels[nextLevel - 1].text}</p></div>
      <button class="primary" data-action="upgrade-pet-talent">确认强化</button>
    </div>`;
  return page(isChoice ? `${currentPetDefinition().name}想学点新的` : "羁绊路线升级", `羁绊 ${game.pet.bond} · 里程碑`, body, {
    description: isChoice
      ? "路线一旦选择便不会更换；宠物每次出手消耗 1 能量并清空充能，之后可以重新积累。"
      : "强化已有路线只提高效果，不改变充能速度与能量消耗。"
  });
}

function renderRules() {
  const body = `
    <div class="rules-grid">
      <article><b>01</b><h2>回合</h2><p>每回合获得 3 能量并抽 5 张牌。未用手牌回合结束时进入弃牌堆。</p></article>
      <article><b>02</b><h2>意图</h2><p>敌人下一步完全公开。攻击、护甲、负面状态都不会藏数值。</p></article>
      <article><b>03</b><h2>护甲</h2><p>护甲先抵挡伤害，并在下一个玩家回合开始时清空。</p></article>
      <article><b>04</b><h2>构筑</h2><p>战后可三选一或跳过。卡组越薄，关键牌越容易再次抽到。</p></article>
      <article><b>05</b><h2>宠物</h2><p>每回合第一次使用攻击牌可充能 1 点；充满后可消耗 1 能量主动出手，随后清空充能并可再次积累。羁绊 3、10、25 解锁路线成长。</p></article>
      <article><b>06</b><h2>学期</h2><p>生命在节点之间保留。挑战词缀与星座试炼提前公开；试炼失败不影响挑战胜负与基础奖励。</p></article>
    </div>
    <div class="rules-note"><b>${game.archetype.sign} 当前命盘：${game.archetype.name}</b><span>${game.archetype.text}</span></div>
    ${game.tarot ? `<div class="rules-note tarot-note"><b>${game.tarot.number} 塔罗契约：${game.tarot.name}</b><span>收益：${game.tarot.boon} 代价：${game.tarot.cost}</span></div>` : ""}
    <button class="primary centered" data-action="close-rules">返回</button>`;
  return page("六条核心规则", "一分钟看懂", body, { description: "所有例外规则都写在卡牌、物品或敌人意图上。" });
}

function renderStats() {
  const stats = game.stats;
  const challengeRewards = stats.challengeRewardChoices || { cards: 0, pet: 0, item: 0 };
  const tarotChoices = stats.tarotChoices || { chariot: 0, strength: 0, hermit: 0 };
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
          <li><span>挑战战胜利</span><b>${stats.challengeWins || 0}</b></li>
          <li><span>星座试炼完成 / 尝试</span><b>${stats.trialsCompleted || 0} / ${stats.trialsAttempted || 0}</b></li>
          <li><span>塔罗休息共鸣</span><b>${stats.tarotRestUses || 0}</b></li>
          <li><span>塔罗：战车 / 力量 / 隐者</span><b>${tarotChoices.chariot} / ${tarotChoices.strength} / ${tarotChoices.hermit}</b></li>
          <li><span>挑战奖励：牌 / ${currentPetDefinition().shortName} / 物</span><b>${challengeRewards.cards} / ${challengeRewards.pet} / ${challengeRewards.item}</b></li>
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
  const trialProgress = trialCollectionProgress(career);
  const kindLabels = { normal: "普通", elite: "精英", boss: "期末" };
  const enemyIcons = { sleepyBug: "困", homeworkBlob: "作", alarmClock: "闹", phoneSpirit: "机", groupChat: "99", printerJam: "印", rivalShadow: "卷", finalExam: "末", madMilkDragon: "笑" };
  const body = `
    <div class="archive-summary">
      <article><small>已解锁成就</small><strong>${career.unlockedAchievements.length}/${achievementTotal}</strong></article>
      <article><small>发现敌人</small><strong>${career.discoveredEnemies.length}/${Object.keys(ENEMY_DEFS).length}</strong></article>
      <article><small>生涯胜场</small><strong>${career.combatsWon}</strong></article>
      <article><small>生涯出牌</small><strong>${career.cardsPlayed}</strong></article>
    </div>
    <div class="archive-heading"><div><small>跨对局收藏</small><h2>星座试炼册</h2></div><p>完成挑战战中的星座试炼即可盖章。印章只记录经历，不提供永久战力。</p></div>
    <div class="trial-stamp-grid">
      ${Object.entries(ARCHETYPE_TRIAL_DEFS).map(([archetypeId, trial]) => {
        const count = career.trialCompletions?.[archetypeId] || 0;
        const archetype = ARCHETYPE_DEFS[archetypeId];
        return `<article class="trial-stamp ${count > 0 ? "stamped" : "unstamped"}">
          <span>${count > 0 ? trial.icon : "?"}</span>
          <div><small>${archetype.sign} · ${archetype.name}</small><h3>${trial.name}</h3><p>${trial.text}</p><b>${count > 0 ? `已完成 ${count} 次` : "尚未盖章"}</b></div>
        </article>`;
      }).join("")}
    </div>
    <div class="trial-collection-summary ${trialProgress.completedSigns === trialProgress.totalSigns ? "complete" : ""}">
      <strong>${trialProgress.completedSigns}/${trialProgress.totalSigns} 枚星座印章</strong>
      <span>${trialProgress.completedSigns === trialProgress.totalSigns ? "三星连珠已完成：三种学生的试炼均已通过。" : `再完成 ${trialProgress.totalSigns - trialProgress.completedSigns} 种星座试炼，即可解锁「三星连珠」。`}</span>
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
    <section class="save-transfer-panel" aria-labelledby="save-transfer-title">
      <div><small>封闭试玩保障</small><h2 id="save-transfer-title">存档与问题反馈</h2><p>可备份当前对局，也可以生成包含版本、所在页面、最近错误和存档状态的反馈包；两者都只在本地生成，不会自动上传。</p></div>
      <div class="save-transfer-actions">
        <button type="button" class="secondary" data-action="open-save-export">导出存档码</button>
        <button type="button" class="quiet-button" data-action="open-save-import">导入存档码</button>
        <button type="button" class="quiet-button" data-action="open-feedback-report">生成反馈包</button>
      </div>
    </section>
    <button class="primary centered" data-action="close-archive">返回</button>`;
  return page("校园档案", "复盘 · 图鉴 · 成就", body, {
    description: "先看见自己的真实进步，再决定下一局要练什么。"
  });
}

function renderSaveExport() {
  const backupText = context.backupText || currentSaveBackup();
  const body = `<section class="save-transfer-editor">
    <div class="save-transfer-explainer"><small>只保存在你手里</small><h2>复制试玩存档码</h2><p>它包含当前对局与生涯档案，不会自动上传。请把整段内容保存到自己的记事本。</p></div>
    <label for="save-backup-output">存档码</label>
    <textarea id="save-backup-output" readonly spellcheck="false">${escapeHtml(backupText)}</textarea>
    <div class="save-transfer-actions">
      <button type="button" class="primary" data-action="copy-save-backup">复制存档码</button>
      <button type="button" class="quiet-button" data-action="close-save-transfer">返回档案</button>
    </div>
  </section>`;
  return page("导出试玩存档", "本地备份 · 不上传", body, {
    className: "save-transfer-page",
    description: "保存这段存档码，之后可以在校园档案中恢复当前对局与生涯解锁。"
  });
}

function renderSaveImport() {
  const body = `<section class="save-transfer-editor import-editor">
    <div class="save-transfer-explainer"><small>导入前确认</small><h2>粘贴试玩存档码</h2><p>系统会先完整校验，再一次性覆盖当前浏览器里的对局与生涯档案；无效内容不会改动现有存档。</p></div>
    <label for="save-backup-input">存档码</label>
    <textarea id="save-backup-input" spellcheck="false" autocomplete="off" placeholder="在这里粘贴完整存档码"></textarea>
    <div class="warning-box">导入成功后会返回标题页。当前浏览器里的旧存档将被替换，请先确认已经备份。</div>
    <div class="save-transfer-actions">
      <button type="button" class="primary" data-action="import-save-backup">确认导入并覆盖当前浏览器存档</button>
      <button type="button" class="quiet-button" data-action="close-save-transfer">取消并返回档案</button>
    </div>
  </section>`;
  return page("导入试玩存档", "校验后覆盖 · 失败不写入", body, {
    className: "save-transfer-page",
    description: "只接受由无限学期导出的完整存档码；格式错误或数据无效时会保留当前存档。"
  });
}

function renderCorruptSave() {
  const stored = context.storedSave || readSaveState();
  const hasRaw = stored.status === STORAGE_RECORD_STATUS.corrupt && typeof stored.raw === "string";
  const raw = hasRaw ? stored.raw : "浏览器当前拒绝读取本地存储，暂时无法显示原始内容。";
  const body = `<section class="save-transfer-editor corrupt-save-editor">
    <div class="save-transfer-explainer"><small>原始数据仍保留</small><h2>先备份，再决定是否丢弃</h2><p>游戏不会自动删除或覆盖这份异常存档。可以先复制下面的原始内容发给开发者，再明确选择清除。</p></div>
    <label for="corrupt-save-output">异常存档原始内容</label>
    <textarea id="corrupt-save-output" readonly spellcheck="false">${escapeHtml(raw)}</textarea>
    <div class="warning-box"><b>清除操作不可撤销。</b>只有确认不再需要抢救这份数据时才清除；返回标题不会修改原始存档。</div>
    <div class="save-transfer-actions">
      <button type="button" class="primary" data-action="copy-corrupt-save" ${hasRaw ? "" : "disabled"}>复制原始存档</button>
      <button type="button" class="danger-button" data-action="discard-corrupt-save" ${stored.status === "unavailable" ? "disabled" : ""}>确认清除异常存档</button>
      <button type="button" class="quiet-button" data-action="retry-corrupt-save">重新读取</button>
      <button type="button" class="quiet-button" data-action="return-title">保留并返回标题</button>
    </div>
  </section>`;
  return page("异常存档保护", "不自动覆盖 · 可复制抢救", body, {
    className: "save-transfer-page corrupt-save-page",
    description: "损坏、版本不兼容或浏览器拒绝访问都会进入保护页，而不是被当作新游戏。"
  });
}

function renderFeedbackReport() {
  const description = context.feedbackDescription || "";
  const reportText = context.reportText || currentFeedbackReport(description, context.issueScreen, context.createdAt);
  const errorCount = recentClientErrors.length;
  const body = `<section class="save-transfer-editor feedback-report-editor">
    <div class="save-transfer-explainer"><small>试玩问题复现</small><h2>生成可直接发送的反馈包</h2><p>简单写下你做了什么、看到了什么。反馈包会附带当前版本、问题页面、最近 ${errorCount} 条脚本错误以及本地存档，方便开发者直接复现。</p></div>
    <label for="feedback-description">问题描述</label>
    <textarea id="feedback-description" class="feedback-description" maxlength="1200" spellcheck="true" placeholder="例如：第 8 周打完精英后，点击刻印卡牌没有进入下一步。">${escapeHtml(description)}</textarea>
    <div class="feedback-report-meta" aria-label="反馈包内容">
      <span><small>游戏版本</small><strong>V${APP_VERSION}</strong></span>
      <span><small>问题页面</small><strong>${escapeHtml(context.issueScreen || "unknown")}</strong></span>
      <span><small>最近错误</small><strong>${errorCount} 条</strong></span>
      <span><small>当前对局</small><strong>${readSave() ? "已包含" : "无进行中对局"}</strong></span>
    </div>
    <label for="feedback-report-output">反馈包预览</label>
    <textarea id="feedback-report-output" readonly spellcheck="false">${escapeHtml(reportText)}</textarea>
    <div class="warning-box">反馈包包含当前对局与生涯解锁数据，但不会自动上传。复制后请只发送给你信任的开发者。</div>
    <div class="save-transfer-actions">
      <button type="button" class="primary" data-action="copy-feedback-report">复制最新反馈包</button>
      <button type="button" class="quiet-button" data-action="close-save-transfer">返回档案</button>
    </div>
  </section>`;
  return page("试玩问题反馈", `V${APP_VERSION} · 本地生成 · 不自动上传`, body, {
    className: "save-transfer-page feedback-report-page",
    description: "把版本、问题现场和存档状态合成一个可复制的复现包。"
  });
}

function restCurrentPetHtml() {
  const pet = currentPetDefinition();
  const talent = game.pet.talent ? PET_TALENT_DEFS[game.pet.talent] : null;
  return `<section class="rest-pet-roster" aria-labelledby="rest-pet-roster-title">
    <div class="rest-pet-roster-heading"><div><small>本局同行伙伴</small><h2 id="rest-pet-roster-title">${escapeHtml(pet.name)}</h2></div><span>开局后已锁定，下局可重新选择</span></div>
    <article class="rest-pet-card active">
      ${renderPetFaceFor(pet.id)}
      <div><small>当前参战</small><strong>${escapeHtml(pet.name)}</strong><p>${escapeHtml(pet.skill.name)} · 羁绊 ${game.pet.bond}${talent ? ` · ${escapeHtml(talent.name)} Lv.${game.pet.talentLevel}` : ""}</p></div>
      <b>同行中</b>
    </article>
  </section>`;
}

function unlockHatchedPet(petId) {
  career.unlockedPetIds ??= [];
  if (!PET_DEFS[petId] || career.unlockedPetIds.includes(petId)) return false;
  career.unlockedPetIds.push(petId);
  saveCareer();
  return true;
}

function renderRest() {
  const missing = game.maxHp - game.hp;
  const canUpgrade = game.deck.some((card) => !card.upgraded);
  const tarotRest = game.tarotRestStatus();
  const incubator = game.incubator;
  const egg = petEggDefinition(incubator?.eggId);
  const hatchCount = Math.max(0, Number(incubator?.battles) || 0);
  const hatchRequired = eggRequiredCombats(egg);
  const body = `
    <div class="rest-scene"><span>☕</span><p>便利店的灯还亮着。今晚只能认真做一件事。</p></div>
    ${incubatorStatusHtml("rest")}
    ${restCurrentPetHtml()}
    <div class="node-grid rest-options">
      <button class="route-node" data-action="rest-heal" ${missing === 0 ? "disabled" : ""}><span class="node-icon">♥</span><span><small>恢复</small><strong>好好睡一觉</strong><em>恢复 ${Math.min(15, missing)} 点生命</em></span></button>
      <button class="route-node" data-action="rest-upgrade" ${canUpgrade ? "" : "disabled"}><span class="node-icon">↑</span><span><small>强化</small><strong>整理课堂笔记</strong><em>${canUpgrade ? "升级一张卡牌" : "所有卡牌均已升级"}</em></span></button>
      <button class="route-node" data-action="rest-pet"><span class="node-icon">${currentPetDefinition().icon}</span><span><small>陪伴</small><strong>带${currentPetDefinition().shortName}散步</strong><em>羁绊 +2</em></span></button>
      ${egg ? `<button class="route-node rest-hatch-option" data-action="rest-hatch"><span class="node-icon">${petEggHtml(egg.id, "pet-egg compact")}</span><span><small>主动孵化 · ${hatchCount}/${hatchRequired}</small><strong>照料${escapeHtml(egg.name)}</strong><em>推进 1 次孵化；共需 ${hatchRequired} 次休息</em></span></button>` : ""}
      ${tarotRest ? `<button class="route-node tarot-rest-option" data-action="rest-tarot" ${tarotRest.available ? "" : "disabled"}><span class="node-icon">${game.tarot.icon}</span><span><small>${game.tarot.number} · 塔罗共鸣 · 每学期一次</small><strong>${tarotRest.name}</strong><em>${tarotRest.text}${tarotRest.available ? "" : ` · ${tarotRest.reason}`}</em></span></button>` : ""}
    </div>`;
  return page("休息节点", `第 ${game.week} 周`, body, { description: "每次休息只能完成一件事；宠物蛋必须在这里主动孵化 3 次。" });
}

function renderTarotRestConfirm() {
  const preview = game.tarotRestPreview();
  if (!preview?.available) {
    return page("当前无法共鸣", "塔罗休息共鸣", `<div class="warning-box">${preview?.reason || "当前没有塔罗契约"}</div><button class="primary centered" data-action="cancel-tarot-rest">返回休息点</button>`);
  }
  const fields = [
    ["hp", "生命", (value) => `${value}/${game.maxHp}`],
    ["gold", "校园币", (value) => `${value}`],
    ["bond", `${currentPetDefinition().shortName}羁绊`, (value) => `${value}`],
    ["deckSize", "卡组张数", (value) => `${value}`],
    ["upgradedCards", "已升级牌", (value) => `${value}`]
  ].filter(([key]) => preview.before[key] !== preview.after[key]);
  const needsCardChoice = preview.action === "remove" || preview.action === "upgrade";
  const body = `
    <div class="tarot-confirm-card">
      <span>${game.tarot.icon}</span>
      <div><small>${game.tarot.number} · ${game.tarot.name} · 本学期一次</small><h2>${preview.name}</h2><p>${preview.text}</p></div>
    </div>
    <div class="tarot-preview-grid">
      ${fields.map(([key, label, format]) => `<article><small>${label}</small><span>${format(preview.before[key])}</span><b>→</b><strong>${format(preview.after[key])}</strong></article>`).join("")}
    </div>
    <div class="warning-box"><b>确认后立即支付代价。</b>${needsCardChoice ? " 下一步再选择具体卡牌；选择完成后本次休息结束。" : " 共鸣结算后本次休息结束。"}</div>
    <div class="confirm-actions"><button class="quiet-button" data-action="cancel-tarot-rest">取消，不消耗任何资源</button><button class="primary" data-action="confirm-tarot-rest">确认：${preview.name}</button></div>`;
  return page("确认塔罗共鸣", `第 ${game.week} 周 · 休息节点`, body, {
    description: "先核对真实前后变化，再决定是否支付代价。"
  });
}

function confirmTarotRest() {
  const result = game.resolveTarotRest();
  if (!result.ok) {
    setToast(result.reason);
    changeScreen("rest");
  } else {
    saveGame();
    resumePendingRest();
  }
}

function resumePendingRest() {
  const pending = game.pendingRest;
  if (!pending) {
    changeScreen("map");
    setToast("休息节点状态无法恢复，已返回本周地图");
    return;
  }
  if (pending.stage === "choice") {
    changeScreen("rest");
    return;
  }
  if (["upgrade", "tarotRemove", "tarotUpgrade"].includes(pending.stage)) {
    const cards = pending.cardUids
      .map((uid) => game.deck.find((card) => card.uid === uid))
      .filter(Boolean);
    const labels = {
      upgrade: ["整理课堂笔记", "升级一张牌"],
      tarotRemove: ["战车共鸣：强行超车", "已失去 6 生命 · 移除一张牌"],
      tarotUpgrade: ["隐者共鸣：闭门精读", "已支付 35 币 · 升级一张牌"]
    };
    showCardSelection({
      title: labels[pending.stage][0],
      eyebrow: labels[pending.stage][1],
      cards,
      onSelect(card) {
        const resolved = game.resolvePendingRestCard(card.uid);
        if (!resolved) {
          setToast("这张牌已不在本次休息候选中");
          return resumePendingRest();
        }
        setToast(resolved.stage === "tarotRemove"
          ? "移除完成，本学期的战车共鸣已使用"
          : resolved.stage === "tarotUpgrade"
          ? "升级完成，本学期的隐者共鸣已使用"
          : "课堂笔记整理完成");
        advanceWeek();
      }
    });
    return;
  }
  if (["pet", "tarotBond"].includes(pending.stage)) {
    const done = () => {
      const message = pending.stage === "tarotBond"
        ? `羁绊 +${pending.bond}，恢复 ${pending.healed} 生命；本学期的力量共鸣已使用`
        : `${currentPetDefinition().name}羁绊 +2`;
      game.completePendingRest();
      setToast(message);
      advanceWeek();
    };
    if (game.pet.pendingMilestone) showPetMilestone(done);
    else done();
    return;
  }
  if (pending.stage === "hatch") {
    const egg = petEggDefinition(pending.eggId);
    const pet = PET_DEFS[pending.petId];
    if (pending.type === "hatched") unlockHatchedPet(pending.petId);
    game.completePendingRest();
    setToast(pending.type === "hatched"
      ? `${pet?.name || "动物幼崽"}孵化完成，已永久解锁；下一局可在开始界面选择；本局伙伴不变`
      : `${egg?.name || "宠物蛋"}孵化推进至 ${pending.battles}/${pending.requiredCombats}`);
    advanceWeek();
    return;
  }
  game.completePendingRest();
  changeScreen("map");
  setToast("休息节点阶段异常，已安全结束结算");
}

function shopDetailShortcutCommand({ currentScreen, code, key, repeat, typing, modified, detailOpen, dialogOpen, hasCandidate }) {
  if (currentScreen !== "shop") return null;
  if (detailOpen && key === "Escape") return "close";
  if (code !== "KeyR" || repeat || typing || modified) return null;
  if (detailOpen) return "close";
  if (dialogOpen || !hasCandidate) return null;
  return "open";
}

function shopDetailOfferFromTarget(target) {
  const focusedOffer = target instanceof Element
    ? target.closest('.shop-page [data-shop-detail-kind]')
    : null;
  return focusedOffer || app.querySelector('.shop-page [data-shop-detail-kind]:hover');
}

function openShopDetail(offer, origin = null) {
  if (screen !== "shop" || !(offer instanceof Element) || !game.pendingShop) return false;
  const kind = offer.dataset.shopDetailKind;
  if (!['card', 'item', 'supply'].includes(kind)) return false;
  const originAction = origin instanceof Element && offer.contains(origin)
    ? origin.closest("[data-action]")?.dataset.action
    : null;
  shopDetailState = {
    kind,
    id: offer.dataset.shopDetailId,
    index: Number(offer.dataset.shopDetailIndex) || 0,
    returnAction: originAction || "open-shop-detail"
  };
  render();
  return true;
}

function closeShopDetail() {
  if (!shopDetailState) return false;
  const previous = shopDetailState;
  shopDetailState = null;
  render();
  const offer = [...app.querySelectorAll('.shop-page [data-shop-detail-kind]')].find((candidate) => (
    candidate.dataset.shopDetailKind === previous.kind
    && candidate.dataset.shopDetailId === previous.id
    && Number(candidate.dataset.shopDetailIndex) === previous.index
  ));
  const controls = offer ? [...offer.querySelectorAll("[data-action]")] : [];
  const focusTarget = controls.find((control) => control.dataset.action === previous.returnAction && !control.disabled)
    || controls.find((control) => control.dataset.action === "open-shop-detail" && !control.disabled)
    || controls.find((control) => !control.disabled);
  focusTarget?.focus({ preventScroll: true });
  return true;
}

function renderShopDetail() {
  if (!shopDetailState || !game.pendingShop) return "";
  const { kind, index } = shopDetailState;
  const stocks = kind === "card"
    ? game.pendingShop.cards
    : kind === "item"
      ? game.pendingShop.items
      : game.pendingShop.supplies;
  const stock = stocks?.[index];
  if (!stock) return "";
  const id = stock.id;
  const price = stock.sold ? "已售" : `${game.shopPrice(kind, id)} 校园币`;
  let name;
  let category;
  let frequency;
  let effectHtml;
  let visualHtml;
  let rarity;

  if (kind === "card") {
    const definition = cardDefinition({ id, uid: id, upgraded: false, enchantment: null });
    name = definition.displayName;
    category = ({ attack: "攻击牌", skill: "技能牌", power: "能力牌", ability: "能力牌", status: "状态牌" })[definition.type] || "卡牌";
    frequency = definition.cost === null ? "不可主动打出" : `${definition.cost} 能量`;
    effectHtml = definition.displayText;
    rarity = rarityName(definition.rarity);
    visualHtml = cardHtml(id, {
      playable: false,
      className: "shop-detail-card-preview",
      ariaHidden: true
    });
  } else if (kind === "item") {
    const item = ITEM_DEFS[id];
    name = item.name;
    category = "随身物品";
    frequency = item.timing;
    effectHtml = escapeHtml(item.text);
    rarity = rarityName(item.rarity);
    visualHtml = `<div class="shop-detail-object-preview item-preview" aria-hidden="true">${itemIconHtml(item, "shop-detail-object-icon")}<strong>${escapeHtml(item.name)}</strong></div>`;
  } else {
    const supply = SUPPLY_DEFS[id];
    name = supply.name;
    category = "临时用品";
    frequency = "一次性使用";
    effectHtml = escapeHtml(supply.text);
    rarity = "消耗后移除";
    visualHtml = `<div class="shop-detail-object-preview supply-preview" aria-hidden="true">${supplyIconHtml(supply, "shop-detail-object-icon")}<strong>${escapeHtml(supply.name)}</strong></div>`;
  }

  return `<div class="pile-overlay shop-detail-overlay" data-action="close-shop-detail" data-dismiss="backdrop">
    <section class="pile-dialog shop-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="shop-detail-title" aria-describedby="shop-detail-effect">
      <div class="shop-detail-heading"><small>货架详情 · 只读</small><h2 id="shop-detail-title">${escapeHtml(name)}</h2><p>按 R 或 Esc 返回货架，不会购买或离店。</p></div>
      <div class="shop-detail-content">
        <div class="shop-detail-visual">${visualHtml}</div>
        <div class="shop-detail-copy">
          <dl>
            <div><dt>类别</dt><dd>${escapeHtml(category)}</dd></div>
            <div><dt>${kind === "card" ? "费用" : "频率"}</dt><dd>${escapeHtml(frequency)}</dd></div>
            <div><dt>品质</dt><dd>${escapeHtml(rarity)}</dd></div>
            <div><dt>价格</dt><dd>${escapeHtml(price)}</dd></div>
          </dl>
          <div class="shop-detail-effect" id="shop-detail-effect"><small>完整效果</small><p>${effectHtml}</p></div>
        </div>
      </div>
      <button type="button" class="primary centered shop-detail-close" data-action="close-shop-detail" autofocus>返回货架 <kbd aria-hidden="true">R / Esc</kbd></button>
    </section>
  </div>`;
}

function renderShop() {
  const shop = game.pendingShop;
  const removePrice = game.shopRemovePrice();
  const backpackFull = game.items.length >= game.backpackCapacity;
  const availableCardIds = shop.cards.filter((stock) => !stock.sold).map((stock) => stock.id);
  const marketHtml = `<div class="shop-market-layout">
      <div class="shop-backpack-status ${backpackFull ? "is-full" : ""}">
        <span><small>随身物品容量</small><strong>${game.items.length}/${game.backpackCapacity}</strong></span>
        <p>${backpackFull ? "书包已满；点选新物品后进入替换确认，取消不会扣款。" : `还可直接装入 ${game.backpackCapacity - game.items.length} 件物品。`}</p>
      </div>
      <section class="shop-card-shelf" aria-label="在售卡牌">
        <h2 class="subheading">卡牌</h2>
        ${availableCardIds.length ? choiceAdviceHtml(availableCardIds) : ""}
        <div class="shop-grid">
          ${shop.cards.map((stock, index) => {
            const price = game.shopPrice("card", stock.id);
            return `<div class="shop-stock ${stock.sold ? "sold" : ""}" data-shop-detail-kind="card" data-shop-detail-id="${escapeHtml(stock.id)}" data-shop-detail-index="${index}">
              ${cardHtml(stock.id, { action: "open-shop-detail", playable: true, fit: evaluateCardFit(game, stock.id), ariaKeyShortcut: "R" })}
              <span class="shop-card-detail-cue" aria-hidden="true">点击查看 <kbd>R</kbd></span>
              <button data-action="buy-card" data-index="${index}" ${stock.sold || game.gold < price ? "disabled" : ""}>${stock.sold ? "已售" : `${price} 币`}</button>
            </div>`;
          }).join("")}
        </div>
      </section>
      <section class="shop-item-shelf" aria-label="在售物品">
        <h2 class="subheading">物品</h2>
        <div class="item-choice-list">
          ${shop.items.map((stock, index) => {
            const price = game.shopPrice("item", stock.id);
            const needsReplacement = backpackFull && !stock.sold;
            return `<div class="shop-offer" data-shop-detail-kind="item" data-shop-detail-id="${escapeHtml(stock.id)}" data-shop-detail-index="${index}">${itemHtml(stock.id, {
              action: "buy-item",
              price: stock.sold ? "已售" : needsReplacement ? `${price} 币 · 购买后替换` : price,
              disabled: stock.sold || game.gold < price,
              className: needsReplacement ? "needs-replacement" : "",
              ariaKeyShortcut: "R"
            })}<button type="button" class="shop-detail-button" data-action="open-shop-detail" aria-label="查看${escapeHtml(ITEM_DEFS[stock.id].name)}完整详情">查看</button></div>`;
          }).join("")}
        </div>
      </section>
      <section class="shop-supply-shelf" aria-label="在售临时用品">
        <h2 class="subheading">临时用品 <small>${game.supplies.length}/${game.supplyCapacity}</small></h2>
        <div class="supply-choice-list">
          ${(shop.supplies || []).map((stock, index) => {
            const price = game.shopPrice("supply", stock.id);
            const full = game.supplies.length >= game.supplyCapacity;
            return `<div class="shop-offer" data-shop-detail-kind="supply" data-shop-detail-id="${escapeHtml(stock.id)}" data-shop-detail-index="${index}">${supplyHtml(stock.id, {
              action: "buy-supply",
              price: stock.sold ? "已售" : full ? "用品栏已满" : price,
              disabled: stock.sold || full || game.gold < price,
              ariaKeyShortcut: "R"
            })}<button type="button" class="shop-detail-button" data-action="open-shop-detail" aria-label="查看${escapeHtml(SUPPLY_DEFS[stock.id].name)}完整详情">查看</button></div>`;
          }).join("")}
        </div>
      </section>
      <div class="shop-footer-row">
        <div class="shop-services">
          <div><strong>卡组瘦身</strong><p>移除一张牌。价格会随学期上涨。</p></div>
          <button data-action="shop-remove" ${removePrice === null || game.gold < removePrice || game.deck.length <= 5 || shop.removed ? "disabled" : ""}>${shop.removed ? "本店已移除" : `${removePrice} 币`}</button>
        </div>
        <button class="primary" data-action="leave-shop">离开商店</button>
      </div>
    </div>`;
  const body = `${encounterStageHtml({
    id: "shop-stage",
    sceneHtml: sceneBannerHtml(SHOP_SCENE),
    decisionHtml: marketHtml,
    decisionLabel: "货架"
  })}${renderShopDetail()}`;
  return page("校园商店", `第 ${game.week} 周 · ${game.gold} 校园币`, body, {
    className: "shop-page",
    description: game.flags.nextShopHalf ? "饭卡优惠生效：本店第一件物品半价。" : "买的是构筑方向，不是单卡稀有度。"
  });
}

function eventChoices(id) {
  const choices = {
    hallwayBox: [
      ["打开纸箱", "50% 获得普通物品；50% 失去 6 生命", "box-open"],
      [`让${currentPetDefinition().name}检查`, "安全离开，羁绊 +1", "box-pet"],
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
      [`带${currentPetDefinition().shortName}入社`, "支付 30 币，羁绊 +2", "club-pet"]
    ],
    mealCard: [
      ["交到失物招领", "获得 40 校园币", "meal-gold"],
      ["研究优惠券", "下个商店第一件物品半价", "meal-sale"],
      [`给${currentPetDefinition().shortName}加餐`, "接下来 3 场战斗初始充能 +1", "meal-pet"]
    ],
    campusRumor: [
      ["进去调查", "查看已锁定的对手、强化与真实奖励后开战", "rumor-fight"],
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

function campusRumorRewardText(reward) {
  if (!reward) return "胜利后结算调查奖励";
  if (reward.type === "rareItem") {
    return reward.choices > 1
      ? `胜利后从 ${reward.choices} 件未拥有稀有物品中选 1 件`
      : "胜利后获得最后 1 件未拥有稀有物品";
  }
  if (reward.type === "item") return "稀有物品已收齐；胜利后获得 1 件其他未拥有物品";
  if (reward.type === "gold") return `随身物品已收齐；胜利后获得 ${reward.gold} 校园币`;
  return "胜利后结算调查奖励";
}

function campusRumorIntelHtml(preview) {
  if (!preview || !ENEMY_DEFS[preview.enemyId]) return "";
  const enemy = ENEMY_DEFS[preview.enemyId];
  const hpBonus = Math.round((preview.hpMultiplier - 1) * 100);
  const hpBonusText = preview.hpMultiplier === 1.3 ? "生命 +30%" : `生命 +${hpBonus}%`;
  const rewardText = campusRumorRewardText(preview.reward);
  return `<section class="event-intel" aria-label="校园怪谈调查线索">
    <div class="event-intel-heading"><small>调查线索 · 对手已锁定</small><strong>${escapeHtml(enemy.name)}</strong><span>${escapeHtml(enemy.mechanicName)}</span></div>
    <p>${escapeHtml(enemy.mechanicText)}</p>
    <div class="event-intel-facts"><b>强化：${hpBonusText}</b><b>${escapeHtml(rewardText)}</b></div>
  </section>`;
}

const CONFIRMED_EVENT_CHOICES = new Set(["quiz-upgrade", "club-pet", "locker-open", "locker-remove"]);

function eventConfirmOutcome(choice) {
  if (choice === "club-pet") {
    return `立即获得 2 点${currentPetDefinition().shortName}羁绊；若到达里程碑，将继续选择宠物路线。`;
  }
  return {
    "quiz-upgrade": "支付生命后，再选择一张卡牌升级。",
    "locker-open": "支付生命后，获得一件未拥有的普通物品；书包已满时可选择替换。",
    "locker-remove": "支付校园币后，再选择一张卡牌移除。"
  }[choice] || "确认后继续结算本次事件。";
}

function renderEvent() {
  const event = EVENT_DEFS[context.eventId];
  const rumorPreview = event.id === "campusRumor" ? game.campusRumorPreview() : null;
  const rumorRewardText = campusRumorRewardText(rumorPreview?.reward);
  const rumorHpBonusText = rumorPreview?.hpMultiplier === 1.3
    ? "生命 +30%"
    : `生命 +${Math.round(((rumorPreview?.hpMultiplier || 1) - 1) * 100)}%`;
  const sceneOptions = {
    tone: event.tone || (event.safe ? "safe" : "risk"),
    mark: "?",
    eyebrow: event.safe ? "校园日常" : "风险事件"
  };
  const eventScene = { ...event, scene: event.scene || "assets/scenes/campus-corridor-v1.webp" };
  const decisionHtml = `<div class="event-choice-panel">
      ${campusRumorIntelHtml(rumorPreview)}
      <div class="event-options">
        ${eventChoices(event.id).map(([name, detail, id]) => {
          const status = game.eventChoiceStatus(id);
          const currentDetail = id === "rumor-heal" && status.actualHeal !== null
            ? `恢复 ${status.actualHeal} 生命`
            : id === "rumor-fight" && rumorPreview
              ? `迎战 ${ENEMY_DEFS[rumorPreview.enemyId].name}（${rumorHpBonusText}）；${rumorRewardText}`
            : detail;
          const statusDetail = status.available ? currentDetail : `${currentDetail} · ${status.reason}`;
          return `<button data-action="event-choice" data-choice="${id}" ${status.available ? "" : "disabled"}><strong>${name}</strong><span>${statusDetail}</span></button>`;
        }).join("")}
      </div>
    </div>`;
  const body = encounterStageHtml({
    id: "event-stage",
    sceneHtml: sceneBannerHtml(eventScene, sceneOptions),
    decisionHtml,
    decisionLabel: "选择"
  });
  return page(event.name, `？第 ${game.week} 周事件`, body, {
    className: "event-page",
    description: "事件会说明代价，但结果不一定完全可控。"
  });
}

function renderEventConfirm() {
  const preview = game.eventChoicePreview(context.choice);
  const event = EVENT_DEFS[context.eventId];
  const choice = eventChoices(context.eventId)?.find(([, , id]) => id === context.choice);
  if (!event || !choice || !preview.available) {
    const reason = preview.reason || "这个选择已经不可用";
    return page("当前无法选择", "事件确认", `<div class="warning-box">${reason}</div><button class="primary centered" data-action="cancel-event-choice">返回事件</button>`, {
      className: "event-confirm-page"
    });
  }
  const fields = [
    ["hp", "生命", (value) => `${value}/${game.maxHp}`],
    ["gold", "校园币", (value) => `${value}`],
    ["bond", `${currentPetDefinition().shortName}羁绊`, (value) => `${value}`],
    ["deckSize", "卡组张数", (value) => `${value}`],
    ["upgradedCards", "已升级牌", (value) => `${value}`]
  ].filter(([key]) => preview.before[key] !== preview.after[key]);
  const body = `
    <div class="tarot-confirm-card event-confirm-card"><span>?</span><div><small>${event.name} · 确认选择</small><h2>${choice[0]}</h2><p>${choice[1]}</p></div></div>
    <div class="tarot-preview-grid">
      ${fields.map(([key, label, format]) => `<article><small>${label}</small><span>${format(preview.before[key])}</span><b>→</b><strong>${format(preview.after[key])}</strong></article>`).join("")}
    </div>
    <div class="warning-box"><b>确认后立即支付代价。</b>${escapeHtml(eventConfirmOutcome(context.choice))}</div>
    <div class="confirm-actions"><button class="quiet-button" data-action="cancel-event-choice">取消，不消耗任何资源</button><button class="primary" data-action="confirm-event-choice">确认：${choice[0]}</button></div>`;
  return page("确认事件选择", `第 ${game.week} 周 · ${event.name}`, body, {
    className: "event-confirm-page",
    description: "先核对真实前后变化，再决定是否支付代价。"
  });
}

function renderSemesterComplete() {
  const body = `
    <div class="report-card">
      <div><small>SEMESTER</small><strong>${game.semester}</strong><span>完成</span></div>
      <ul>
        <li><span>剩余生命</span><b>${game.hp}/${game.maxHp}</b></li>
        <li><span>卡组规模</span><b>${game.deck.length}</b></li>
        <li><span>随身物品</span><b>${game.items.length}/${game.backpackCapacity}</b></li>
        <li><span>${currentPetDefinition().name}羁绊</span><b>${game.pet.bond}</b></li>
        <li><span>本学期塔罗</span><b>${game.tarot ? `${game.tarot.number} · ${game.tarot.name}` : "未选择"}</b></li>
        <li><span>累计战斗 / 掉血</span><b>${game.stats.combatsWon} / ${game.stats.combatHpLost}</b></li>
        <li><span>累计出牌</span><b>${game.stats.cardsPlayed}</b></li>
      </ul>
    </div>
    <div class="semester-actions">
      <button class="primary big" data-action="next-semester">插班进入第 ${game.semester + 1} 学期</button>
      <p>代价与补偿：敌人生命 +15%、攻击 +1；你最大生命 +2、书包容量 +1并回满生命。卡组、升级与羁绊全部保留。</p>
      <button class="quiet-button" data-action="return-title">保存并返回标题</button>
    </div>`;
  return page("这学期，过了。", "期末总结", body, {
    description: "无尽不是把数字无限放大，而是让旧构筑带着代价进入新循环。"
  });
}

function activeDialog() {
  return app.querySelector('[role="dialog"][aria-modal="true"]');
}

function closeSemesterCalendar() {
  if (!semesterCalendarOpen) return;
  semesterCalendarOpen = false;
  render();
  app.querySelector('[data-action="open-calendar"]')?.focus();
}

function focusMobileTopbarToggle() {
  const mobileTopbarToggle = app.querySelector('[data-action="toggle-mobile-topbar"]');
  if (mobileTopbarToggle instanceof HTMLElement && mobileTopbarToggle.offsetParent !== null) {
    mobileTopbarToggle.focus();
  } else {
    app.querySelector(".brand")?.focus();
  }
}

function currentSaveBackup() {
  return createSaveBackup({
    save: hasActiveRun && game.combat?.status !== "lost" ? game.toJSON() : readSave(),
    career,
    exportedAt: new Date().toISOString()
  });
}

function currentFeedbackReport(description = "", issueScreen = screen, createdAt = new Date().toISOString()) {
  return createFeedbackReport({
    appVersion: APP_VERSION,
    screen: issueScreen,
    description,
    save: hasActiveRun && game.combat?.status !== "lost" ? game.toJSON() : readSave(),
    career,
    errors: recentClientErrors,
    environment: {
      page: `${window.location.pathname}${window.location.search}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language || null,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches
    },
    createdAt
  });
}

function restoreStorageValue(key, value) {
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
}

function restoreSaveBackup(text) {
  const payload = parseSaveBackup(text);
  const restoredGame = payload.save === null ? null : SemesterGame.fromJSON(payload.save);
  const restoredCareer = normalizeCareerProfile(payload.career);
  const nextSave = restoredGame ? JSON.stringify(restoredGame.toJSON()) : null;
  const nextCareer = JSON.stringify(restoredCareer);
  const previousSave = localStorage.getItem(SAVE_KEY);
  const previousCareer = localStorage.getItem(CAREER_KEY);

  try {
    restoreStorageValue(SAVE_KEY, nextSave);
    restoreStorageValue(CAREER_KEY, nextCareer);
  } catch (error) {
    try {
      restoreStorageValue(SAVE_KEY, previousSave);
      restoreStorageValue(CAREER_KEY, previousCareer);
    } catch {
      // 浏览器连回滚都拒绝时仍保留内存中的原状态，不继续切换页面。
    }
    throw error;
  }

  career = restoredCareer;
  game = restoredGame || new SemesterGame();
  hasActiveRun = Boolean(restoredGame);
  storageFailures.run = null;
  storageFailures.career = null;
  selectedArchetype = restoredGame?.archetypeId || "cancer";
  selectedPetId = restoredGame?.activePetId || career.unlockedPetIds?.[0] || "offlineDuck";
  selectedPersonaId = restoredGame?.personaId || "student";
  return { hasRun: Boolean(restoredGame), exportedAt: payload.exportedAt };
}

async function copySaveBackup() {
  const output = app.querySelector("#save-backup-output");
  if (!(output instanceof HTMLTextAreaElement)) return false;
  output.focus();
  output.select();
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(output.value);
    else if (!document.execCommand("copy")) throw new Error("copy unavailable");
    setToast("试玩存档码已复制；可保存到自己的记事本");
  } catch {
    setToast("自动复制失败，存档码已全选，请手动复制");
  }
  render();
  return true;
}

async function copyCorruptSave() {
  const output = app.querySelector("#corrupt-save-output");
  if (!(output instanceof HTMLTextAreaElement)) return false;
  output.focus();
  output.select();
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(output.value);
    else if (!document.execCommand("copy")) throw new Error("copy unavailable");
    setToast("异常存档原始内容已复制；原数据仍保留在浏览器中");
  } catch {
    setToast("自动复制失败，原始内容已全选，请手动复制");
  }
  render();
  return true;
}

async function copyFeedbackReport() {
  const description = app.querySelector("#feedback-description");
  const output = app.querySelector("#feedback-report-output");
  if (!(description instanceof HTMLTextAreaElement) || !(output instanceof HTMLTextAreaElement)) return false;
  context.feedbackDescription = description.value;
  context.reportText = currentFeedbackReport(description.value, context.issueScreen, context.createdAt);
  output.value = context.reportText;
  output.focus();
  output.select();
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(output.value);
    else if (!document.execCommand("copy")) throw new Error("copy unavailable");
    setToast("试玩反馈包已复制，可以直接发给开发者");
  } catch {
    setToast("自动复制失败，反馈包已全选，请手动复制");
  }
  render();
  return true;
}

function closeMobileTopbar() {
  if (!mobileTopbarOpen) return;
  mobileTopbarOpen = false;
  render();
  focusMobileTopbarToggle();
}

function focusActiveDialog() {
  const dialog = activeDialog();
  if (!dialog || dialog.contains(document.activeElement)) return;
  const focusTarget = dialog.querySelector("[autofocus]")
    || dialog.querySelector("button:not(:disabled)");
  focusTarget?.focus();
}

function trapDialogFocus(event, dialog) {
  const focusable = [...dialog.querySelectorAll('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')];
  if (!focusable.length) return;
  const currentIndex = focusable.indexOf(document.activeElement);
  const nextIndex = currentIndex < 0
    ? 0
    : (currentIndex + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
  event.preventDefault();
  focusable[nextIndex].focus();
}

function setEncounterStageView(view, { scroll = true, focus = false, behavior = "smooth" } = {}) {
  const nextView = view === "decision" ? "decision" : "scene";
  const stage = app.querySelector("[data-encounter-stage]");
  const track = stage?.querySelector("[data-encounter-stage-track]");
  if (!(stage instanceof HTMLElement) || !(track instanceof HTMLElement)) return;

  encounterStageView = nextView;
  const mobileStage = window.matchMedia("(max-width: 700px)").matches;
  stage.querySelectorAll('[role="tab"][data-stage-view]').forEach((tab) => {
    const selected = tab.dataset.stageView === nextView;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (focus && selected && tab instanceof HTMLElement) tab.focus({ preventScroll: true });
  });
  stage.querySelectorAll("[data-stage-panel]").forEach((panel) => {
    const selected = panel.dataset.stagePanel === nextView;
    const hasFocusableDescendant = Boolean(panel.querySelector(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    ));
    panel.inert = mobileStage && !selected;
    panel.tabIndex = mobileStage && selected && !hasFocusableDescendant ? 0 : -1;
  });
  if (scroll && mobileStage) {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({
      left: nextView === "decision" ? track.clientWidth : 0,
      behavior: reducedMotion ? "auto" : behavior
    });
  }
}

function scheduleEncounterStagePosition() {
  window.cancelAnimationFrame(encounterStageFrame);
  encounterStageFrame = window.requestAnimationFrame(() => {
    encounterStageFrame = null;
    setEncounterStageView(encounterStageView, { behavior: "auto" });
  });
}

function render() {
  const renderers = {
    intro: renderIntro,
    newGameConfirm: renderNewGameConfirm,
    tarotChoice: renderTarotChoice,
    map: renderMap,
    combat: renderCombat,
    challengeReward: renderChallengeReward,
    cardReward: renderCardReward,
    itemReward: renderItemReward,
    bossEggReward: renderBossEggReward,
    replaceItem: renderReplaceItem,
    selection: renderSelection,
    enchantment: renderEnchantment,
    petMilestone: renderPetMilestone,
    deck: renderDeck,
    items: renderItems,
    library: renderLibrary,
    itemLibrary: renderItemLibrary,
    rest: renderRest,
    tarotRestConfirm: renderTarotRestConfirm,
    shop: renderShop,
    event: renderEvent,
    eventConfirm: renderEventConfirm,
    semesterComplete: renderSemesterComplete,
    rules: renderRules,
    stats: renderStats,
    archive: renderArchive,
    saveExport: renderSaveExport,
    saveImport: renderSaveImport,
    corruptSave: renderCorruptSave,
    feedbackReport: renderFeedbackReport
  };
  clearBattleMotionArtifacts();
  app.innerHTML = (renderers[screen] || renderIntro)();
  scheduleEncounterStagePosition();
  focusActiveDialog();
  if (screen === "replaceItem") {
    const heading = app.querySelector(".replace-item-page h1");
    if (heading instanceof HTMLElement) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }
  scheduleBattleMotion();
}

function startNewGame(archetypeId = selectedArchetype, petId = selectedPetId, personaId = selectedPersonaId) {
  const availablePets = unlockedPetIds();
  const startingPetId = availablePets.includes(petId) ? petId : "offlineDuck";
  const startingPersonaId = canSelectPersona(career, personaId) ? personaId : "student";
  game = new SemesterGame(Date.now(), archetypeId, startingPetId, availablePets, startingPersonaId);
  hasActiveRun = true;
  selectedArchetype = archetypeId;
  selectedPetId = game.activePetId;
  selectedPersonaId = game.personaId;
  changeScreen("tarotChoice");
}

function changeScreen(next, nextContext = {}, options = {}) {
  if (options.encounterView === "decision") encounterStageView = "decision";
  else if (next !== screen) encounterStageView = "scene";
  mobileTopbarOpen = false;
  if (next !== "shop") shopDetailState = null;
  screen = next;
  context = nextContext;
  if (next !== "map") semesterCalendarOpen = false;
  if (next !== "combat") pileView = null;
  if (!game.pendingCombatStart
    && (next === "map" || next === "tarotChoice" || next === "semesterComplete" || game.pendingSemesterReward
      || game.pendingCombatReward || game.pendingEventReward || game.pendingEventId || game.pendingShop
      || game.pendingRest || game.pendingItemReplacement || game.pet.pendingMilestone)) saveGame();
  window.scrollTo({ top: 0, behavior: "smooth" });
  render();
}

function returnToEncounterDecision(next, nextContext = {}) {
  changeScreen(next, nextContext, { encounterView: "decision" });
}

function advanceWeek() {
  game.week += 1;
  changeScreen("map");
}

function selectEvent(pool) {
  if (game.pendingEventId) {
    changeScreen("event", { eventId: game.pendingEventId });
    return;
  }
  const ids = pool === "safe" ? SAFE_EVENT_IDS : ALL_EVENT_IDS;
  const available = ids.filter((id) => id !== game.lastEventId);
  const eventId = game.rng.pick(available.length ? available : ids);
  if (game.preparePendingEvent(eventId)) changeScreen("event", { eventId });
  else {
    changeScreen("map");
    setToast("事件状态无法建立，请重新选择本周路线");
  }
}

function launchPendingCombat() {
  const pending = game.pendingCombatStart;
  if (!pending) {
    changeScreen("map");
    setToast("战斗开局状态无法恢复，已返回本周地图");
    return false;
  }
  game.startCombat(pending.enemyId, pending.modifiers);
  registerEnemyEncounter();
  tutorialStep = !game.tutorialSeen && game.semester === 1 && game.week === 1 ? 0 : -1;
  changeScreen("combat", { outcome: pending.outcome });
  return true;
}

function beginCombat(enemyId, outcome, modifiers = {}) {
  const pending = game.prepareCombatStart(enemyId, outcome, modifiers);
  if (!pending) {
    setToast("战斗开局状态无法建立，请重新选择本周路线");
    render();
    return false;
  }
  saveGame();
  return launchPendingCombat();
}

function startNode(node) {
  if (node.type === "combat") {
    beginCombat(node.enemy, node.challenge ? "challenge" : ENEMY_DEFS[node.enemy].kind, node.challenge ? {
      challenge: true,
      hpMultiplier: CHALLENGE_RULES.hpMultiplier,
      damageMultiplier: CHALLENGE_RULES.damageMultiplier,
      affix: node.affix
    } : {});
  } else if (node.type === "event") {
    selectEvent(node.pool);
  } else if (node.type === "rest") {
    if (game.prepareRest()) changeScreen("rest");
    else {
      changeScreen("map");
      setToast("休息节点状态无法建立，请重新选择本周路线");
    }
  } else if (node.type === "shop") {
    openShop();
  }
}

function openShop() {
  if (game.prepareShop()) changeScreen("shop");
  else {
    changeScreen("map");
    setToast("商店状态无法建立，请重新选择本周路线");
  }
}

function cardRewardToken(source, choices) {
  return `${game.semester}:${game.week}:${source || "unknown"}:${choices.join(",")}`;
}

function showCardReward(options = {}) {
  const choices = [...(options.choices || game.rewardCards(3, options.rarity))];
  const rewardSource = options.rewardSource || null;
  changeScreen("cardReward", {
    choices,
    rewardSource,
    rewardToken: cardRewardToken(rewardSource, choices),
    settling: false,
    title: options.title,
    eyebrow: options.eyebrow,
    message: options.message,
    allowReroll: options.allowReroll,
    onDone: options.onDone || advanceWeek
  });
}

function showItemReward(choices, onDone = advanceWeek, title, rewardSource = null) {
  const available = choices.filter(Boolean).filter((id) => !game.hasItem(id));
  if (!available.length) {
    setToast("没有新的随身物品，本次物品奖励已跳过");
    onDone();
    return false;
  }
  changeScreen("itemReward", {
    choices: available,
    onDone,
    title,
    rewardSource,
    settling: false
  });
  return true;
}

function finishCardReward(id, source, token) {
  const rewardContext = context;
  if (screen !== "cardReward" || rewardContext.settling === true) return false;

  const inferredSource = game.pendingCombatReward?.type === "normalCard"
    ? "normal"
    : game.pendingCombatReward?.type === "eliteChain" && game.pendingCombatReward.stage === "card"
      ? "elite"
      : game.pendingCombatReward?.type === "challengeChain"
        && game.pendingCombatReward.stage === "card"
        && game.pendingCombatReward.route === "cards"
        ? "challenge"
        : game.pendingEventReward?.type === "card"
          ? "event"
          : null;
  const rewardSource = source || rewardContext.rewardSource || inferredSource;
  if (!rewardSource || (rewardContext.rewardSource && rewardSource !== rewardContext.rewardSource)) return false;
  if (rewardContext.rewardToken && token !== rewardContext.rewardToken) return false;

  const pending = rewardSource === "event" ? game.pendingEventReward : game.pendingCombatReward;
  const authoritativeChoices = Array.isArray(pending?.choices) ? pending.choices : [];
  const contextMatchesPending = authoritativeChoices.length > 0
    && authoritativeChoices.length === rewardContext.choices?.length
    && authoritativeChoices.every((choice, index) => rewardContext.choices[index] === choice);
  if (!contextMatchesPending || id === undefined
    || (id !== null && (!CARD_DEFS[id] || !authoritativeChoices.includes(id)))) return false;

  const next = rewardContext.onDone;
  if (typeof next !== "function") return false;
  const result = game.resolvePendingCardReward({ source: rewardSource, choice: id });
  if (!result) {
    setToast("这份卡牌奖励已经失效，请按当前奖励状态重新选择");
    render();
    return false;
  }
  rewardContext.settling = true;
  next(result);
  return true;
}

function grantItem(id) {
  const rewardContext = context;
  if (screen !== "itemReward" || rewardContext.settling === true
    || !rewardContext.choices?.includes(id)) return false;
  const source = game.itemRewardSourceFor(id);
  if (!source || source !== rewardContext.rewardSource || typeof rewardContext.onDone !== "function") return false;

  if (source === "semester") {
    const result = game.resolvePendingSemesterItem(id);
    if (!result) return false;
    rewardContext.settling = true;
    if (result.status === "replacement") resumePendingItemReplacement();
    else rewardContext.onDone(result);
    return true;
  }

  if (source === "combat" && game.pendingCombatReward?.type === "eliteChain") {
    const result = game.resolvePendingEliteItem(id);
    if (!result) return false;
    rewardContext.settling = true;
    if (result.status === "replacement") resumePendingItemReplacement();
    else rewardContext.onDone(result);
    return true;
  }

  if (game.items.length >= game.backpackCapacity) {
    const replacement = game.prepareItemReplacement(id);
    if (replacement) {
      rewardContext.settling = true;
      resumePendingItemReplacement();
      return true;
    }
    setToast("这件物品当前无法进入替换流程");
    return false;
  }
  if (!game.addItem(id)) {
    setToast("这个物品已经在书包里了");
    return false;
  }
  game.stats.itemsTaken += 1;
  rewardContext.settling = true;
  rewardContext.onDone({ id, status: "claimed" });
  return true;
}

function skipItemReward() {
  const rewardContext = context;
  if (screen !== "itemReward" || rewardContext.settling === true
    || typeof rewardContext.onDone !== "function" || !rewardContext.rewardSource
    || !rewardContext.choices?.length
    || !rewardContext.choices.every((id) => game.itemRewardSourceFor(id) === rewardContext.rewardSource)) return false;
  if (rewardContext.rewardSource === "semester" && !game.skipPendingSemesterItem()) return false;
  if (rewardContext.rewardSource === "combat" && game.pendingCombatReward?.type === "eliteChain"
    && !game.skipPendingEliteItem()) return false;
  rewardContext.settling = true;
  rewardContext.onDone({ status: "skipped" });
  return true;
}

function resumeItemRewardSource(source) {
  if (source === "semester") resumeSemesterRewards();
  else if (source === "event") resumePendingEventReward();
  else if (source === "combat") resumePendingCombatReward();
  else if (source === "shop" && game.pendingShop) returnToEncounterDecision("shop");
  else {
    changeScreen("map");
    setToast("物品奖励来源已经失效");
  }
}

function completeItemRewardSource(source) {
  if (source === "semester") {
    resumeSemesterRewards();
  } else if (source === "event") {
    game.completePendingEventReward();
    advanceWeek();
  } else if (source === "combat") {
    if (game.pendingCombatReward?.type === "eliteChain") {
      resumeEliteCombatReward();
    } else {
      game.completePendingCombatReward();
      advanceWeek();
    }
  } else if (source === "shop" && game.pendingShop) {
    returnToEncounterDecision("shop");
  }
}

function resumePendingItemReplacement() {
  const pending = game.pendingItemReplacement;
  if (!pending || !ITEM_DEFS[pending.incoming]) {
    changeScreen("map");
    setToast("物品替换状态无法恢复，已返回本周地图");
    return;
  }
  changeScreen("replaceItem");
}

function showCardSelection(options) {
  changeScreen("selection", options);
}

function showEnchantmentReward(onDone = advanceWeek) {
  const pending = game.pendingCombatReward;
  if (pending?.type !== "eliteChain" || pending.stage !== "enchant" || typeof onDone !== "function") return false;
  const cards = game.eligiblePendingEliteEnchantCards();
  if (!cards.length) {
    const result = game.resolvePendingEnchantment(null);
    if (!result) return false;
    setToast("当前卡组没有符合条件的卡牌，已跳过刻印");
    onDone(result);
    return true;
  }
  const enchantment = Object.values(ENCHANTMENT_DEFS).find((entry) => entry.archetype === game.archetypeId);
  changeScreen("enchantment", { cards, enchantment, onDone, settling: false });
  return true;
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

function resolveChallengeReward(id) {
  if (!game.choosePendingChallengeReward(id)) return;
  saveGame();
  resumeChallengeCombatReward();
}

function resolveCombatResult() {
  if (game.combat.status === "lost") {
    clearSave();
    hasActiveRun = false;
    game = new SemesterGame(Date.now(), selectedArchetype, selectedPetId, unlockedPetIds());
    changeScreen("intro");
    return;
  }
  const outcome = context.outcome;
  if (game.pet.pendingMilestone) {
    showPetMilestone(() => outcome === "boss"
      ? resumeSemesterRewards()
      : ["normal", "elite", "challenge", "event"].includes(outcome) ? resumePendingCombatReward() : grantCombatRewards(outcome));
    return;
  }
  grantCombatRewards(outcome);
}

function grantCombatRewards(outcome) {
  game.completePendingCombatStart();
  if (outcome === "boss") {
    game.prepareSemesterRewards(BOSS_ITEM_IDS);
    resumeSemesterRewards();
  } else if (outcome === "elite") {
    game.prepareEliteCombatReward();
    resumeEliteCombatReward();
  } else if (outcome === "challenge") {
    const trial = game.challengeTrialStatus();
    game.prepareChallengeCombatReward({
      enemyId: game.combat?.enemy?.id,
      affix: game.combat.modifiers.affix,
      trialCompleted: trial?.completed,
      trialBonus: game.combat.trialBonusGold
    });
    resumeChallengeCombatReward();
  } else if (outcome === "event") {
    game.completePendingEvent();
    game.prepareEventCombatReward();
    resumeEventCombatReward();
  } else {
    game.prepareNormalCombatReward();
    resumeNormalCombatReward();
  }
}

function resumeNormalCombatReward() {
  const pending = game.pendingCombatReward || game.prepareNormalCombatReward();
  if (!pending) {
    changeScreen("map");
    setToast("战斗奖励状态无法恢复，已返回本周地图");
    return;
  }
  if (game.pet.pendingMilestone) {
    showPetMilestone(resumeNormalCombatReward);
    return;
  }
  showCardReward({
    choices: pending.choices,
    rewardSource: "normal",
    title: "战斗奖励",
    eyebrow: pending.bonusGold ? "高压加练奖励" : "战斗奖励",
    message: pending.bonusGold
      ? `${pending.gold} 校园币已到账（基础 ${NORMAL_COMBAT_REWARD_GOLD} + 高压加练 ${pending.bonusGold}）。再选一张加入构筑，也可以跳过。`
      : `${pending.gold || NORMAL_COMBAT_REWARD_GOLD} 校园币已到账。选一张加入构筑，也可以跳过。`,
    onDone() {
      advanceWeek();
    }
  });
}

function resumeEliteCombatReward() {
  const pending = game.pendingCombatReward
    || game.prepareEliteCombatReward();
  if (!pending || pending.type !== "eliteChain") {
    changeScreen("map");
    setToast("精英奖励状态无法恢复，已返回本周地图");
    return;
  }
  if (game.pet.pendingMilestone) {
    showPetMilestone(resumeEliteCombatReward);
    return;
  }
  if (pending.stage === "card") {
    showCardReward({
      choices: pending.choices,
      rewardSource: "elite",
      title: "精英战奖励",
      onDone() {
        resumeEliteCombatReward();
      }
    });
    return;
  }
  if (pending.stage === "item") {
    const choices = pending.itemChoices.filter((id) => !game.hasItem(id));
    if (choices.length) {
      showItemReward(choices, () => {
        resumeEliteCombatReward();
      }, "精英物品奖励", "combat");
      return;
    }
    if (!game.skipPendingEliteItem()) {
      changeScreen("map");
      setToast("精英物品奖励状态已经失效，请重新进入结算");
      return;
    }
    return resumeEliteCombatReward();
  }
  if (pending.stage === "enchant") {
    showEnchantmentReward(() => {
      const fallbackGold = pending.fallbackGold;
      if (fallbackGold) setToast(`普通物品已收齐，精英物品改为 ${fallbackGold} 校园币`);
      advanceWeek();
    });
    return;
  }
  game.completePendingCombatReward();
  changeScreen("map");
  setToast("精英奖励阶段异常，已安全结束结算");
}

function resumeChallengeCombatReward() {
  const trial = game.combat ? game.challengeTrialStatus() : null;
  const pending = game.pendingCombatReward || game.prepareChallengeCombatReward({
    enemyId: game.combat?.enemy?.id,
    affix: game.combat?.modifiers.affix,
    trialCompleted: trial?.completed,
    trialBonus: game.combat?.trialBonusGold
  });
  if (!pending || pending.type !== "challengeChain") {
    setToast("挑战奖励状态无法恢复，已返回本周地图");
    changeScreen("map");
    return;
  }
  if (game.pet.pendingMilestone) {
    showPetMilestone(resumeChallengeCombatReward);
    return;
  }
  if (pending.stage === "route") {
    changeScreen("challengeReward", {
      affix: pending.affix,
      trialCompleted: pending.trialCompleted,
      trialBonus: pending.trialBonus
    });
    return;
  }
  if (pending.stage === "card") {
    const reward = CHALLENGE_REWARD_DEFS.cards;
    const exclusivePoolName = game.personaId === "student" ? "本星座" : game.persona.name;
    showCardReward({
      choices: pending.choices,
      rewardSource: "challenge",
      title: reward.name,
      eyebrow: `挑战奖励 · ${exclusivePoolName}专属池`,
      message: `${reward.gold} 校园币已到账。从三张${exclusivePoolName}专属牌中选一张，也可以跳过。`,
      allowReroll: false,
      onDone() {
        advanceWeek();
      }
    });
    return;
  }
  if (pending.stage === "item") {
    const choices = pending.itemChoices.filter((id) => !game.hasItem(id));
    if (choices.length) {
      const signatureItem = ITEM_DEFS[pending.signatureItemId];
      showItemReward(choices, () => {
        game.completePendingCombatReward();
        advanceWeek();
      }, `${signatureItem ? `${ENEMY_DEFS[pending.enemyId]?.name || "挑战怪物"}遗落 · ${signatureItem.name}` : "失物招领"} · ${CHALLENGE_REWARD_DEFS.item.gold} 校园币已到账`, "combat");
      return;
    }
    game.completePendingCombatReward();
    return advanceWeek();
  }
  if (pending.stage === "complete") {
    const route = pending.route;
    const fallbackGold = pending.fallbackGold;
    const rewardVariant = pending.rewardVariant;
    const rewardEgg = petEggDefinition(pending.eggId);
    game.completePendingCombatReward();
    if (route === "pet" && rewardVariant === "egg" && rewardEgg) {
      const required = eggRequiredCombats(rewardEgg);
      const battles = game.incubator?.eggId === rewardEgg.id ? game.incubator.battles : 0;
      setToast(`${CHALLENGE_REWARD_DEFS.pet.gold} 校园币已到账，${rewardEgg.name}已放入孵化位 · ${battles}/${required}`);
    } else if (route === "pet" && rewardVariant === "mastery") {
      setToast(`${fallbackGold} 校园币已到账，${currentPetDefinition().name}已精通，羁绊保持不变`);
    } else if (route === "pet") {
      const reward = CHALLENGE_REWARD_DEFS.pet;
      setToast(`${reward.gold} 校园币已到账，${currentPetDefinition().name}羁绊 +${reward.bond}`);
    } else if (fallbackGold) {
      setToast(`随身物品已全部收集，改为获得 ${fallbackGold} 校园币`);
    }
    advanceWeek();
    return;
  }
  game.completePendingCombatReward();
  setToast("挑战奖励阶段异常，已安全结束结算");
  changeScreen("map");
}

function resumeEventCombatReward() {
  const pending = game.pendingCombatReward || game.prepareEventCombatReward();
  if (!pending || pending.type !== "eventItem") {
    setToast("怪谈奖励状态无法恢复，已返回本周地图");
    changeScreen("map");
    return;
  }
  if (game.pet.pendingMilestone) {
    showPetMilestone(resumeEventCombatReward);
    return;
  }
  if (pending.stage === "item") {
    const choices = pending.itemChoices.filter((id) => !game.hasItem(id));
    if (choices.length) {
      showItemReward(choices, () => {
        game.completePendingCombatReward();
        advanceWeek();
      }, "怪谈调查奖励", "combat");
      return;
    }
    game.completePendingCombatReward();
    return advanceWeek();
  }
  if (pending.stage === "complete") {
    const fallbackGold = pending.fallbackGold;
    game.completePendingCombatReward();
    if (fallbackGold) setToast(`随身物品已全部收集，怪谈奖励改为 ${fallbackGold} 校园币`);
    advanceWeek();
    return;
  }
  game.completePendingCombatReward();
  setToast("怪谈奖励阶段异常，已安全结束结算");
  changeScreen("map");
}

function resumePendingCombatReward() {
  if (game.pendingCombatReward?.type === "eliteChain") return resumeEliteCombatReward();
  if (game.pendingCombatReward?.type === "challengeChain") return resumeChallengeCombatReward();
  if (game.pendingCombatReward?.type === "eventItem") return resumeEventCombatReward();
  return resumeNormalCombatReward();
}

function resumePendingEventReward() {
  const pending = game.pendingEventReward;
  if (!pending) {
    changeScreen("map");
    setToast("事件奖励状态无法恢复，已返回本周地图");
    return;
  }
  const finish = () => {
    game.completePendingEventReward();
    advanceWeek();
  };
  if (pending.type === "card") {
    showCardReward({
      choices: pending.choices,
      rewardSource: "event",
      title: pending.source === "quiz-card" ? "借来的答案" : "社团赠礼",
      eyebrow: pending.source === "quiz-card" ? "下场战斗初始紧张 +2" : "校园社团 · 选一张加入卡组",
      allowReroll: false,
      onDone: advanceWeek
    });
    return;
  }
  if (pending.type === "upgrade" || pending.type === "remove") {
    const cards = pending.cardUids
      .map((uid) => game.deck.find((card) => card.uid === uid))
      .filter(Boolean)
      .filter((card) => pending.type === "remove" || (!card.upgraded && !["nervous", "todo"].includes(card.id)));
    if (!cards.length || (pending.type === "remove" && game.deck.length <= 5)) {
      game.completePendingEventReward();
      changeScreen("map");
      setToast("事件候选已失效，本次奖励已安全结束");
      return;
    }
    showCardSelection({
      title: pending.type === "upgrade" ? "升级一张牌" : "管理员帮你清理一张牌",
      eyebrow: pending.type === "upgrade" ? "突击测验 · 已失去 5 生命" : "已支付 50 校园币",
      cards,
      disabled: () => pending.type === "remove" && game.deck.length <= 5,
      onSelect(card) {
        const resolved = pending.type === "upgrade" ? game.upgradeCard(card.uid) : game.removeCard(card.uid);
        if (resolved) finish();
        else {
          setToast("这张牌当前无法处理，请选择另一张");
          render();
        }
      }
    });
    return;
  }
  if (pending.type === "item") {
    showItemReward(pending.itemChoices, finish, pending.source === "box-open" ? "纸箱里的物品" : "旧柜里的物品", "event");
    return;
  }
  game.completePendingEventReward();
  changeScreen("map");
  setToast("事件奖励阶段异常，已安全结束结算");
}

function resumeSemesterRewards() {
  const pending = game.pendingSemesterReward;
  if (!pending) {
    const prepared = game.prepareSemesterRewards(BOSS_ITEM_IDS);
    if (prepared) return resumeSemesterRewards();
    changeScreen("map");
    setToast("期末奖励尚未解锁，请先完成第 16 周的期末考试");
    return false;
  }
  if (game.pet.pendingMilestone) {
    showPetMilestone(resumeSemesterRewards);
    return;
  }
  if (pending.stage === "bossEgg") {
    changeScreen("bossEggReward");
    return;
  }
  if (pending.stage === "bossItem") {
    const choices = pending.itemChoices.filter((id) => !game.hasItem(id));
    if (choices.length) {
      showItemReward(choices, () => {
        showSemesterSummary();
      }, "期末纪念物", "semester");
      return;
    }
    if (!game.skipPendingSemesterItem()) {
      changeScreen("map");
      setToast("期末纪念物状态已经失效，请重新进入结算");
      return false;
    }
  }
  showSemesterSummary();
  if (pending.fallbackGold) setToast(`Boss 物品已收齐，纪念物改为 ${pending.fallbackGold} 校园币`);
}

function showSemesterSummary() {
  const candidates = game.semesterUpgradeCandidates();
  if (!candidates.length) {
    setToast("所有可升级牌都已经升级，本次升级奖励已自动结算");
    if (completeSemesterAndRecord()) changeScreen("semesterComplete");
    else {
      setToast("期末总结状态已经失效，请重新进入结算");
      resumeSemesterRewards();
    }
    return;
  }
  showCardSelection({
    title: "期末战利品：升级一张牌",
    eyebrow: "从当前卡组中亲自选择",
    description: "任选一张未升级的非状态牌。升级完成后，牌名会直接显示 +。",
    cards: candidates,
    onSelect(card) {
      if (completeSemesterAndRecord(card.uid)) changeScreen("semesterComplete");
      else {
        setToast("这张牌不在本次升级候选中");
        render();
      }
    }
  });
}

function completeSemesterAndRecord(uid = undefined) {
  const completedSemester = game.semester;
  const summonerWasUnlocked = canSelectPersona(career, "summoner");
  if (!game.completeCurrentSemester(uid)) return false;
  recordSemesterCompletion(career, completedSemester);
  saveCareer();
  if (!summonerWasUnlocked && canSelectPersona(career, "summoner")) {
    setToast("第二人格「社团召集者」已解锁：下局可选择召唤流");
  }
  return true;
}

function finishEvent(message = "事件结束") {
  game.completePendingEvent();
  setToast(message);
  advanceWeek();
}

function gainEventPetBond(amount, message) {
  game.completePendingEvent();
  gainPetBond(amount, advanceWeek, message);
}

function beginEventReward(pending) {
  if (!pending) return false;
  game.completePendingEvent();
  resumePendingEventReward();
  return true;
}

function pickFilteredCards(type) {
  const personaPool = game.personaId === "student" ? [] : (PERSONA_CARD_IDS[game.personaId] || []);
  const mixedPool = [...PUBLIC_REWARD_CARD_IDS, ...ARCHETYPE_CARD_IDS[game.archetypeId], ...personaPool];
  const ids = mixedPool.filter((id) => type === "attack" ? CARD_DEFS[id].type === "attack" : CARD_DEFS[id].type !== "attack");
  return game.rng.shuffle(ids).slice(0, 3);
}

function resolveEventChoice(choice) {
  if (choice === "leave") return finishEvent("你选择安全离开");
  const status = game.eventChoiceStatus(choice);
  if (!status.available) {
    setToast(status.reason);
    render();
    return;
  }
  if (choice === "box-open") {
    if (game.rng.next() < 0.5) {
      const item = game.randomItem({ rarity: "common" });
      if (item && beginEventReward(game.prepareEventItemReward("box-open", [item]))) return;
      else finishEvent("纸箱是空的");
    } else {
      game.hp = Math.max(1, game.hp - 6);
      finishEvent("纸箱怪叫了一声：失去 6 生命");
    }
  } else if (choice === "box-pet") {
    gainEventPetBond(1, `${currentPetDefinition().name}确认没有危险，羁绊 +1`);
  } else if (choice === "quiz-upgrade") {
    game.hp -= 5;
    const cards = game.deck.filter((card) => !card.upgraded && !["nervous", "todo"].includes(card.id));
    if (beginEventReward(game.prepareEventDeckReward("quiz-upgrade", cards.map((card) => card.uid)))) return;
    else finishEvent("失去 5 生命，但没有可升级的牌");
  } else if (choice === "quiz-card") {
    game.flags.nextCombatTension += 2;
    if (beginEventReward(game.prepareEventCardReward("quiz-card", game.rewardCards(3, "uncommon")))) return;
    else finishEvent("下场战斗初始紧张 +2，但没有可带走的答案");
  } else if (choice === "club-attack" || choice === "club-skill") {
    if (beginEventReward(game.prepareEventCardReward(choice, pickFilteredCards(choice === "club-attack" ? "attack" : "skill")))) return;
    else finishEvent("社团今天没有合适的赠礼");
  } else if (choice === "club-pet") {
    game.gold -= 30;
    gainEventPetBond(2, `${currentPetDefinition().name}成为荣誉社员：羁绊 +2`);
  } else if (choice === "meal-gold") {
    game.gold += 40;
    finishEvent("获得 40 校园币");
  } else if (choice === "meal-sale") {
    game.flags.nextShopHalf = true;
    finishEvent("下个商店的第一件物品半价");
  } else if (choice === "meal-pet") {
    game.flags.petSnackCombats += 3;
    finishEvent(`接下来 3 场战斗，${currentPetDefinition().name}初始充能 +1`);
  } else if (choice === "rumor-fight") {
    beginCombat(game.randomEnemy(), "event", { hpMultiplier: 1.3 });
  } else if (choice === "rumor-gold") {
    game.gold += 40;
    game.flags.nextEnemyBlock += 6;
    finishEvent("获得 40 币；下个敌人初始获得 6 护甲");
  } else if (choice === "rumor-heal") {
    const healed = game.heal(status.actualHeal);
    finishEvent(`恢复 ${healed} 生命`);
  } else if (choice === "locker-open") {
    game.hp -= 6;
    const item = game.randomItem({ rarity: "common" });
    if (item && beginEventReward(game.prepareEventItemReward("locker-open", [item]))) return;
    else finishEvent("失去 6 生命，但柜子里没有新东西");
  } else if (choice === "locker-remove") {
    game.gold -= 50;
    if (beginEventReward(game.prepareEventDeckReward("locker-remove", game.deck.map((card) => card.uid)))) return;
    else finishEvent("已支付 50 校园币，但当前没有可清理的牌");
  }
}

app.addEventListener("input", (event) => {
  const input = event.target;
  if (screen !== "feedbackReport" || !(input instanceof HTMLTextAreaElement)
    || input.id !== "feedback-description") return;
  context.feedbackDescription = input.value;
  context.reportText = currentFeedbackReport(input.value, context.issueScreen, context.createdAt);
  const output = app.querySelector("#feedback-report-output");
  if (output instanceof HTMLTextAreaElement) output.value = context.reportText;
});

app.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled || event.detail > 1) return;
  const action = button.dataset.action;

  if (action === "toggle-mobile-topbar") {
    if (screen === "combat" || (!mobileTopbarOpen && activeDialog())) return;
    mobileTopbarOpen = !mobileTopbarOpen;
    render();
    if (!mobileTopbarOpen) focusMobileTopbarToggle();
  } else if (action === "close-mobile-topbar") {
    if (button.dataset.dismiss === "backdrop" && event.target !== button) return;
    closeMobileTopbar();
  } else if (action === "open-shop-detail") {
    const offer = button.closest("[data-shop-detail-kind]");
    openShopDetail(offer, button);
  } else if (action === "close-shop-detail") {
    if (button.dataset.dismiss === "backdrop" && event.target !== button) return;
    closeShopDetail();
  } else if (action === "switch-encounter-stage") {
    setEncounterStageView(button.dataset.stageView, { focus: true });
  } else if (action === "new-game") {
    const storedSave = readSaveState();
    if (![STORAGE_RECORD_STATUS.empty, STORAGE_RECORD_STATUS.valid].includes(storedSave.status)) {
      changeScreen("corruptSave", { returnState: { screen: "intro", context: {} }, storedSave });
      return;
    }
    const saved = storedSave.status === STORAGE_RECORD_STATUS.valid ? storedSave.value : null;
    if (newGameStartDecision(saved) === NEW_GAME_START.confirm) {
      changeScreen("newGameConfirm", { saved, archetypeId: selectedArchetype, petId: selectedPetId, personaId: selectedPersonaId });
    } else {
      startNewGame();
    }
  } else if (action === "cancel-new-game") {
    changeScreen("intro");
  } else if (action === "confirm-new-game") {
    if (newGameStartDecision(context.saved, true) === NEW_GAME_START.start) {
      startNewGame(context.archetypeId, context.petId, context.personaId);
    }
  } else if (action === "select-archetype") {
    selectedArchetype = button.dataset.id;
    render();
  } else if (action === "select-starting-pet") {
    if (unlockedPetIds().includes(button.dataset.id)) {
      selectedPetId = button.dataset.id;
      render();
    }
  } else if (action === "select-persona") {
    if (canSelectPersona(career, button.dataset.id)) {
      selectedPersonaId = button.dataset.id;
      render();
    }
  } else if (action === "continue-game") {
    try {
      game = SemesterGame.fromJSON(readSave());
      hasActiveRun = true;
      selectedArchetype = game.archetypeId;
      selectedPetId = game.activePetId;
      selectedPersonaId = game.personaId;
      if (game.loadRepairs.length) {
        const visibleRepairs = game.loadRepairs.slice(0, 3).join("；");
        const remaining = game.loadRepairs.length - 3;
        setToast(`存档已自动修复：${visibleRepairs}${remaining > 0 ? `；另 ${remaining} 项` : ""}`);
      }
      if (game.pendingItemReplacement) resumePendingItemReplacement();
      else if (game.awaitingNextSemester) changeScreen("semesterComplete");
      else if (game.pendingSemesterReward) resumeSemesterRewards();
      else if (game.pendingCombatReward) resumePendingCombatReward();
      else if (game.pendingCombatStart) launchPendingCombat();
      else if (game.pendingEventReward) resumePendingEventReward();
      else if (game.pendingEventId) changeScreen("event", { eventId: game.pendingEventId });
      else if (game.pendingRest) resumePendingRest();
      else if (game.pet.pendingMilestone) showPetMilestone(advanceWeek);
      else if (game.pendingShop) changeScreen("shop");
      else changeScreen(game.tarot ? "map" : "tarotChoice");
    } catch (error) {
      hasActiveRun = false;
      rememberClientError("storage.run.load", error);
      setToast("存档无法读取，原始数据仍然保留");
      changeScreen("corruptSave", {
        returnState: { screen: "intro", context: {} },
        storedSave: readSaveState()
      });
    }
  } else if (action === "return-title") {
    changeScreen("intro");
  } else if (action === "resume-semester-reward") {
    resumeSemesterRewards();
  } else if (action === "claim-boss-egg") {
    const result = game.resolvePendingSemesterEgg();
    if (!result) {
      setToast("这枚 Boss 蛋已经领取或奖励状态已变化");
      resumeSemesterRewards();
    } else {
      saveGame();
      setToast(result.queued ? `奶龙蛋已排在第 ${result.position} 位` : "奶龙蛋已放入休息区孵化位");
      resumeSemesterRewards();
    }
  } else if (action === "map") {
    if (screen !== "map") {
      setToast("请先完成当前节点");
      render();
    }
  } else if (action === "open-calendar" && screen === "map") {
    semesterCalendarOpen = true;
    render();
  } else if (action === "close-calendar") {
    if (button.dataset.dismiss === "backdrop" && event.target !== button) return;
    closeSemesterCalendar();
  } else if (action === "choose-node") {
    startNode(game.semesterPlan[game.week][Number(button.dataset.index)]);
  } else if (action === "choose-tarot") {
    if (game.chooseTarot(button.dataset.id)) {
      setToast(`塔罗·${game.tarot.name}已生效：收益与代价持续到本学期结束`);
      changeScreen("map");
    }
  } else if (action === "toggle-intent-details") {
    setIntentDetailsOpen(button, context.intentDetailsPinned !== true);
  } else if (action === "play-card") {
    const card = game.combat.hand.find((held) => held.uid === button.dataset.uid);
    const definition = card ? cardDefinition(card) : null;
    const counterplayBefore = game.getIntent().mechanicState;
    const wasDistracted = game.combat.distracted === true;
    const statusCardsBefore = game.combat.hand.filter((held) => CARD_DEFS[held.id]?.type === "status").length;
    const before = battleStateSnapshot();
    const result = game.playCard(button.dataset.uid);
    if (!result.ok) setToast(result.reason);
    else {
      const statusCardsAfter = game.combat.hand.filter((held) => CARD_DEFS[held.id]?.type === "status").length;
      const distractedCleared = Boolean(definition?.effect.clearDistracted && wasDistracted && !game.combat.distracted);
      const cleanseApplied = Boolean(distractedCleared
        || (definition?.effect.exhaustStatuses && statusCardsAfter < statusCardsBefore));
      const counterplayAfter = game.getIntent().mechanicState;
      queueBattleFeedback("card", definition?.displayName || "卡牌生效", before, {
        cardPlayed: true,
        cardType: definition?.type || "skill",
        cleanseApplied,
        effectParts: [
          ...(distractedCleared ? ["移除走神"] : []),
          ...counterplayFeedbackParts(counterplayBefore, counterplayAfter)
        ],
        drawResult: result.drawResult
      });
    }
    const combatFinished = recordCurrentCombat();
    if (combatFinished) {
      resolveCombatResult();
      return;
    }
    render();
  } else if (action === "use-supply") {
    const supply = SUPPLY_DEFS[button.dataset.id];
    const before = battleStateSnapshot();
    const result = game.useSupply(button.dataset.id);
    if (!result.ok) setToast(result.reason);
    else {
      const parts = [
        supply.effect.energy ? `能量 +${supply.effect.energy}` : ""
      ].filter(Boolean);
      queueBattleFeedback("status", supply.name, before, { effectParts: parts, drawResult: result.drawResult });
      saveGame();
    }
    render();
  } else if (action === "discard-card") {
    const result = game.discardCard(button.dataset.uid);
    if (!result.ok) setToast(result.reason);
    render();
  } else if (action === "end-turn") {
    if (endTurnDecision(game.incomingDamagePreview()) === END_TURN_ACTION.confirm) {
      context.confirmLethalEndTurn = true;
      render();
    } else {
      finishPlayerTurn();
    }
  } else if (action === "cancel-lethal-end-turn") {
    context.confirmLethalEndTurn = false;
    render();
  } else if (action === "confirm-lethal-end-turn") {
    if (endTurnDecision(game.incomingDamagePreview(), true) === END_TURN_ACTION.end) finishPlayerTurn();
  } else if (action === "pet-skill") {
    const motionOrigin = captureBattleMotionOrigin(app.querySelector(".pet-companion-token"), "pet");
    const counterplayBefore = game.getIntent().mechanicState;
    const before = battleStateSnapshot();
    const result = game.usePetSkill();
    if (!result.ok) setToast(result.reason);
    else {
      const pet = currentPetDefinition();
      const counterplayAfter = game.getIntent().mechanicState;
      queueBattleFeedback("pet", `${pet.name} · ${pet.skill.name}`, before, {
        effectParts: counterplayFeedbackParts(counterplayBefore, counterplayAfter),
        drawResult: result.drawResult,
        motionOrigin
      });
    }
    const combatFinished = recordCurrentCombat();
    if (combatFinished) {
      resolveCombatResult();
      return;
    }
    render();
  } else if (action === "open-pile") {
    if (["drawPile", "discardPile", "exhaustPile"].includes(button.dataset.zone)) {
      pileView = button.dataset.zone;
      render();
    }
  } else if (action === "close-pile") {
    pileView = null;
    render();
  } else if (action === "choose-challenge-reward") {
    resolveChallengeReward(button.dataset.id);
  } else if (action === "take-reward-card") {
    finishCardReward(button.dataset.id, button.dataset.rewardSource, button.dataset.rewardToken);
  } else if (action === "skip-reward") {
    finishCardReward(null, button.dataset.rewardSource, button.dataset.rewardToken);
  } else if (action === "reroll-reward") {
    const pending = game.pendingCombatReward;
    const canReroll = screen === "cardReward"
      && context.settling !== true
      && ["normal", "elite"].includes(context.rewardSource)
      && context.allowReroll !== false
      && Array.isArray(pending?.choices)
      && pending.choices.length === context.choices?.length
      && pending.choices.every((choice, index) => context.choices[index] === choice);
    if (!canReroll) return;
    const rerolled = game.rerollPendingCombatReward();
    if (!rerolled.ok) {
      setToast(rerolled.reason);
      render();
      return;
    }
    context.choices = [...rerolled.choices];
    context.rewardToken = cardRewardToken(context.rewardSource, context.choices);
    saveGame();
    render();
  } else if (action === "choose-item") {
    grantItem(button.dataset.id);
  } else if (action === "skip-item") {
    skipItemReward();
  } else if (action === "replace-item") {
    const result = game.replacePendingItem(button.dataset.id);
    if (result) {
      const payment = result.source === "shop" ? `，支付 ${result.price} 校园币` : "";
      setToast(`已用${ITEM_DEFS[result.incoming].name}替换${ITEM_DEFS[result.outgoing].name}${payment}`);
      completeItemRewardSource(result.source);
    } else {
      setToast("这件旧物品当前无法替换");
      resumePendingItemReplacement();
    }
  } else if (action === "cancel-replace") {
    const source = game.pendingItemReplacement?.source;
    if (game.cancelPendingItemReplacement()) resumeItemRewardSource(source);
  } else if (action === "open-library") {
    const returnState = { screen, context };
    changeScreen("library", { returnState, libraryFilter: "all", upgradedId: null });
  } else if (action === "close-library") {
    const target = context.returnState || { screen: "intro", context: {} };
    changeScreen(target.screen, target.context);
  } else if (action === "filter-library") {
    const nextFilter = normalizeCardLibraryFilter(button.dataset.filter);
    if (nextFilter !== button.dataset.filter) return;
    context = { ...context, libraryFilter: nextFilter, upgradedId: null };
    render();
  } else if (action === "toggle-library-upgrade") {
    const visibleIds = cardLibraryIds(CARD_DEFS, context.libraryFilter);
    if (!visibleIds.includes(button.dataset.id)) return;
    context = {
      ...context,
      upgradedId: context.upgradedId === button.dataset.id ? null : button.dataset.id
    };
    render();
  } else if (action === "open-item-library") {
    const returnState = { screen, context };
    changeScreen("itemLibrary", { returnState, itemLibraryFilter: "all" });
  } else if (action === "close-item-library") {
    const target = context.returnState || { screen: "intro", context: {} };
    changeScreen(target.screen, target.context);
  } else if (action === "filter-item-library") {
    const nextFilter = normalizeItemLibraryFilter(button.dataset.filter);
    if (nextFilter !== button.dataset.filter) return;
    context = { ...context, itemLibraryFilter: nextFilter };
    render();
  } else if (action === "open-deck") {
    const returnState = { screen, context };
    changeScreen("deck", { returnState, handOnly: screen === "combat" && Boolean(game.combat) });
  } else if (action === "close-deck") {
    const target = context.returnState || { screen: "map", context: {} };
    changeScreen(target.screen, target.context);
  } else if (action === "open-items") {
    const returnState = { screen, context };
    changeScreen("items", { returnState });
  } else if (action === "close-items") {
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
  } else if (action === "open-emergency-save") {
    changeScreen("saveExport", {
      returnState: { screen, context },
      backupText: currentSaveBackup()
    });
  } else if (action === "open-corrupt-save") {
    changeScreen("corruptSave", {
      returnState: { screen: "intro", context: {} },
      storedSave: readSaveState()
    });
  } else if (action === "open-save-export") {
    changeScreen("saveExport", {
      returnState: { screen: "archive", context },
      backupText: currentSaveBackup()
    });
  } else if (action === "open-save-import") {
    changeScreen("saveImport", { returnState: { screen: "archive", context } });
  } else if (action === "open-feedback-report") {
    const issueScreen = context.returnState?.screen || "archive";
    const createdAt = new Date().toISOString();
    changeScreen("feedbackReport", {
      returnState: { screen: "archive", context },
      issueScreen,
      createdAt,
      feedbackDescription: "",
      reportText: currentFeedbackReport("", issueScreen, createdAt)
    });
  } else if (action === "close-save-transfer") {
    const target = context.returnState || { screen: "archive", context: {} };
    changeScreen(target.screen, target.context);
  } else if (action === "copy-save-backup") {
    void copySaveBackup();
  } else if (action === "copy-corrupt-save") {
    void copyCorruptSave();
  } else if (action === "copy-feedback-report") {
    void copyFeedbackReport();
  } else if (action === "discard-corrupt-save") {
    if (clearSave()) {
      hasActiveRun = false;
      changeScreen("intro");
      setToast("异常存档已按你的确认清除，现在可以开始新游戏");
      render();
    } else {
      setToast("浏览器拒绝清除存档；原始数据仍然保留");
      render();
    }
  } else if (action === "retry-corrupt-save") {
    const storedSave = readSaveState();
    if ([STORAGE_RECORD_STATUS.empty, STORAGE_RECORD_STATUS.valid].includes(storedSave.status)) {
      changeScreen("intro");
      setToast(storedSave.status === STORAGE_RECORD_STATUS.valid ? "存档已恢复可读取" : "当前没有异常存档");
      render();
    } else {
      context.storedSave = storedSave;
      setToast("仍然无法安全读取；原始数据没有被修改");
      render();
    }
  } else if (action === "import-save-backup") {
    const input = app.querySelector("#save-backup-input");
    if (!(input instanceof HTMLTextAreaElement)) return;
    try {
      const result = restoreSaveBackup(input.value);
      setToast(result.hasRun ? "存档已导入，可以继续当前对局" : "生涯档案已导入；备份中没有进行中的对局");
      changeScreen("intro");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "存档导入失败，现有数据未改变");
      render();
      app.querySelector("#save-backup-input")?.focus();
    }
  } else if (action === "close-archive") {
    const target = context.returnState || { screen: "intro", context: {} };
    changeScreen(target.screen, target.context);
  } else if (action === "tutorial-next") {
    if (tutorialStep >= 2) {
      completeTutorial();
    } else {
      tutorialStep += 1;
      render();
    }
  } else if (action === "skip-tutorial") {
    completeTutorial();
  } else if (action === "select-deck-card") {
    const card = game.deck.find((candidate) => candidate.uid === button.dataset.uid);
    if (card && context.onSelect) context.onSelect(card);
  } else if (action === "enchant-card") {
    const rewardContext = context;
    if (screen !== "enchantment" || rewardContext.settling === true
      || typeof rewardContext.onDone !== "function"
      || !rewardContext.cards?.some((card) => card.uid === button.dataset.uid)) return;
    const result = game.resolvePendingEnchantment(button.dataset.uid);
    if (!result) {
      setToast("这张牌不在当前精英刻印候选中");
      render();
      return;
    }
    rewardContext.settling = true;
    const done = rewardContext.onDone;
    setToast("星座刻印已写入卡牌");
    done(result);
  } else if (action === "skip-enchantment") {
    const rewardContext = context;
    if (screen !== "enchantment" || rewardContext.settling === true
      || typeof rewardContext.onDone !== "function") return;
    const result = game.resolvePendingEnchantment(null);
    if (!result) return;
    rewardContext.settling = true;
    rewardContext.onDone(result);
  } else if (action === "select-pet-talent") {
    if (game.resolvePetMilestone(button.dataset.id)) {
      const done = context.onDone;
      setToast(`${currentPetDefinition().name}选择了${PET_TALENT_DEFS[game.pet.talent].name}`);
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
    const result = game.resolveRestHeal();
    if (result) {
      setToast(`恢复 ${result.healed} 生命`);
      advanceWeek();
    }
  } else if (action === "rest-pet") {
    if (game.resolveRestPet()) resumePendingRest();
  } else if (action === "rest-upgrade") {
    if (game.prepareRestUpgrade()) resumePendingRest();
  } else if (action === "rest-hatch") {
    const result = game.resolveRestHatch();
    if (!result) {
      setToast("当前没有可孵化的宠物蛋，或本次休息已选择其它行动");
      render();
    } else {
      if (result.type === "hatched") unlockHatchedPet(result.petId);
      saveGame();
      resumePendingRest();
    }
  } else if (action === "rest-tarot") {
    changeScreen("tarotRestConfirm");
  } else if (action === "cancel-tarot-rest") {
    changeScreen("rest");
  } else if (action === "confirm-tarot-rest") {
    confirmTarotRest();
  } else if (action === "event-choice") {
    const choice = button.dataset.choice;
    if (CONFIRMED_EVENT_CHOICES.has(choice)) changeScreen("eventConfirm", { eventId: context.eventId, choice });
    else resolveEventChoice(choice);
  } else if (action === "cancel-event-choice") {
    returnToEncounterDecision("event", { eventId: context.eventId });
  } else if (action === "confirm-event-choice") {
    resolveEventChoice(context.choice);
  } else if (action === "buy-card") {
    if (game.buyShopCard(Number(button.dataset.index))) {
      saveGame();
      render();
    }
  } else if (action === "buy-item") {
    if (game.items.length >= game.backpackCapacity) {
      if (game.prepareItemReplacement(button.dataset.id)) resumePendingItemReplacement();
      else setToast("这件物品当前无法进入购买替换流程");
    } else if (game.buyShopItem(button.dataset.id)) {
      saveGame();
      render();
    }
  } else if (action === "buy-supply") {
    const result = game.buyShopSupply(button.dataset.id);
    if (result) {
      saveGame();
      setToast(`已购买${SUPPLY_DEFS[result.id].name}`);
      render();
    } else {
      setToast("用品栏已满或校园币不足");
      render();
    }
  } else if (action === "shop-remove") {
    const removePrice = game.shopRemovePrice();
    showCardSelection({
      title: "移除一张牌",
      eyebrow: `${removePrice} 校园币`,
      cards: game.deck,
      canCancel: true,
      onSelect(card) {
        if (game.removeShopCard(card.uid)) returnToEncounterDecision("shop");
      },
      onCancel() { returnToEncounterDecision("shop"); }
    });
  } else if (action === "leave-shop") {
    game.completePendingShop();
    advanceWeek();
  } else if (action === "next-semester") {
    if (game.startNextSemester()) changeScreen("tarotChoice");
    else {
      setToast("本学期尚未完成期末结算");
      render();
    }
  }
});

function restoreDismissedIntentDetails(target) {
  const token = target instanceof Element ? target.closest('[data-action="toggle-intent-details"]') : null;
  if (!token || context.intentDetailsDismissed !== true) return;
  context.intentDetailsDismissed = false;
  token.classList.remove("is-dismissed");
}

app.addEventListener("pointerout", (event) => {
  const token = event.target instanceof Element ? event.target.closest('[data-action="toggle-intent-details"]') : null;
  const relatedTarget = event.relatedTarget instanceof Node ? event.relatedTarget : null;
  if (!token || token.contains(relatedTarget)) return;
  restoreDismissedIntentDetails(token);
});

app.addEventListener("focusin", (event) => restoreDismissedIntentDetails(event.target));

app.addEventListener("scroll", (event) => {
  const track = event.target;
  if (!(track instanceof HTMLElement) || !track.matches("[data-encounter-stage-track]")) return;
  window.cancelAnimationFrame(encounterStageFrame);
  encounterStageFrame = window.requestAnimationFrame(() => {
    encounterStageFrame = null;
    const view = track.scrollLeft >= track.clientWidth / 2 ? "decision" : "scene";
    setEncounterStageView(view, { scroll: false });
  });
}, true);

window.addEventListener("resize", scheduleEncounterStagePosition);

document.addEventListener("keydown", (event) => {
  const dialog = activeDialog();
  const target = event.target;
  const typing = target instanceof HTMLElement
    && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
  if (mobileTopbarOpen && event.key === "Escape") {
    event.preventDefault();
    mobileTopbarOpen = false;
    render();
    const mobileTopbarToggle = app.querySelector('[data-action="toggle-mobile-topbar"]');
    if (mobileTopbarToggle instanceof HTMLElement && mobileTopbarToggle.offsetParent !== null) {
      mobileTopbarToggle.focus();
    } else {
      app.querySelector(".brand")?.focus();
    }
    return;
  }
  if (semesterCalendarOpen && dialog?.id === "semester-calendar-dialog" && event.key === "Escape") {
    event.preventDefault();
    closeSemesterCalendar();
    return;
  }
  const shopDetailOffer = screen === "shop" ? shopDetailOfferFromTarget(target) : null;
  const shopDetailCommand = shopDetailShortcutCommand({
    currentScreen: screen,
    code: event.code,
    key: event.key,
    repeat: event.repeat,
    typing,
    modified: event.altKey || event.ctrlKey || event.metaKey || event.shiftKey,
    detailOpen: Boolean(shopDetailState && dialog?.classList.contains("shop-detail-dialog")),
    dialogOpen: Boolean(dialog),
    hasCandidate: Boolean(shopDetailOffer)
  });
  if (shopDetailCommand) {
    event.preventDefault();
    if (shopDetailCommand === "close") closeShopDetail();
    else openShopDetail(shopDetailOffer, target);
    return;
  }
  if (dialog && event.key === "Tab") {
    trapDialogFocus(event, dialog);
    return;
  }
  const encounterTab = target instanceof Element ? target.closest('[role="tab"][data-stage-view]') : null;
  if (encounterTab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    const nextView = ["ArrowRight", "End"].includes(event.key) ? "decision" : "scene";
    setEncounterStageView(nextView, { focus: true });
    return;
  }
  if (typing || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
    || screen !== "combat" || game.combat?.status !== "active") return;

  const command = combatShortcutCommand(event.code, {
    resolvingEnemy: context.combatInputLocked === true,
    lethalConfirmOpen: context.confirmLethalEndTurn === true,
    pileOpen: Boolean(pileView),
    intentDetailsOpen: context.intentDetailsPinned === true,
    tutorialOpen: tutorialStep >= 0,
    pendingDiscard: game.combat.pendingDiscard > 0,
    cardCount: game.combat.hand.length
  });
  if (!command) return;

  if (command.action === COMBAT_SHORTCUT_ACTION.closeIntentDetails) {
    event.preventDefault();
    const token = app.querySelector('[data-action="toggle-intent-details"]');
    if (token) setIntentDetailsOpen(token, false);
    return;
  }

  if (command.action === COMBAT_SHORTCUT_ACTION.toggleIntentDetails) {
    event.preventDefault();
    const token = app.querySelector('[data-action="toggle-intent-details"]');
    if (token) setIntentDetailsOpen(token, context.intentDetailsPinned !== true);
    return;
  }

  let button;
  if ([COMBAT_SHORTCUT_ACTION.playCard, COMBAT_SHORTCUT_ACTION.discardCard].includes(command.action)) {
    button = app.querySelectorAll(`.hand [data-action="${command.action}"]`)[command.cardIndex];
  } else {
    button = app.querySelector(`[data-action="${command.action}"]`);
  }
  if (!button || button.disabled) return;
  event.preventDefault();
  button.click();
});

render();
