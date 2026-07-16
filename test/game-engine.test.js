import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";

import { ARCHETYPE_TRIAL_DEFS, CHALLENGE_AFFIX_DEFS, CHALLENGE_REWARD_DEFS, CHALLENGE_RULES, ITEM_REWARD_FALLBACK_GOLD, TAROT_DEFS, SemesterGame, STARTING_DECK, cardDefinition, normalRouteEnemyPool, startingDeckFor } from "../game-engine.js";
import { ACHIEVEMENT_DEFS, ARCHETYPE_CARD_IDS, BOSS_ITEM_IDS, CARD_ART_DEFS, CARD_DEFS, CHALLENGE_SIGNATURE_ITEM_DROPS, DEFAULT_PET_ID, ENCHANTMENT_DEFS, ENEMY_DEFS, FIRST_SEMESTER_NORMAL_ENEMY_POOLS, ITEM_DEFS, NORMAL_ENEMY_IDS, PET_DEFS, PET_TALENT_DEFS, PUBLIC_REWARD_CARD_IDS, REGULAR_ITEM_IDS } from "../game-data.js";
import { analyzeBuild, challengeRewardGuidance, choiceGuidance, evaluateCardFit } from "../build-analysis.js";
import { CARD_LIBRARY_FILTERS, COMBAT_SHORTCUT_ACTION, END_TURN_ACTION, ENEMY_EXTRA_HIT_RESOLVE_MS, ENEMY_RESOLVE_MS, ITEM_LIBRARY_FILTERS, NEW_GAME_START, SEMESTER_WEEK_COUNT, battleFeedbackFromDelta, cardLibraryIds, combatCardTacticalCue, combatEnemyBlockAttackProjection, combatEnergyState, combatItemCue, combatMechanicStatusCleared, combatShortcutCommand, endTurnDecision, endTurnRiskGuidance, enemyHitBreakdown, enemyHitPulseSequence, enemyIntentDetailLines, enemyResolutionSnapshot, enemyResolveDuration, finalizeCombatPersistence, handCardPose, itemLibraryIds, newGameStartDecision, normalizeCardLibraryFilter, normalizeItemLibraryFilter, semesterCalendarWeeks, shouldShowCombatCardPreview } from "../app-flow.js";
import {
  achievementProgress,
  createCareerProfile,
  normalizeCareerProfile,
  recordCareerCombat,
  recordEnemyEncounter,
  trialCollectionProgress
} from "../career.js";

function putCardInHand(game, id) {
  const combat = game.combat;
  const card = game.deck.find((candidate) => candidate.id === id) || game.createCard(id);
  combat.hand = [{ ...card }];
  combat.drawPile = [];
  combat.discardPile = [];
  return combat.hand[0];
}

function findRouteWeek(game, type) {
  for (let week = 2; week < 16; week += 1) {
    if (game.semesterPlan[week]?.some((node) => node.type === type)) return week;
  }
  return null;
}

test("每张卡牌都有可替换的独立卡面美术标识", () => {
  const cardIds = Object.keys(CARD_DEFS).sort();
  const artIds = Object.keys(CARD_ART_DEFS).sort();
  const captions = artIds.map((id) => CARD_ART_DEFS[id].caption);
  const motifs = new Set([
    "impact", "guard", "notes", "focus", "combo", "speed", "balance", "clean",
    "goose", "power", "void", "aries", "gemini", "cancer", "status"
  ]);

  assert.deepEqual(artIds, cardIds);
  assert.equal(new Set(captions).size, captions.length);
  const formalArtIds = artIds.filter((id) => CARD_ART_DEFS[id].image);
  const requiredFormalArtIds = [
    "textbookStrike", "backpackGuard", "payAttention", "classSprint",
    "scratchPaper", "cramming", "catCombo", "stubborn", "airplaneMode",
    "lendAHand", "holdOn", "borrowNotes", "clearBacklog", "feedPet",
    "getInZone", "overthink", "ariesRush", "ariesRebound", "ariesHeat",
    "ariesUproar", "geminiSwitch", "geminiJuggle", "geminiEcho", "geminiDeadline",
    "cancerHuddle", "cancerCover", "cancerSteady", "cancerSafe", "todo", "nervous"
  ];
  assert.equal(formalArtIds.length, cardIds.length, "三十张卡牌必须全部接入正式卡图");
  assert.ok(requiredFormalArtIds.every((id) => formalArtIds.includes(id)), "三十张正式卡图未完整接入");
  assert.equal(new Set(formalArtIds.map((id) => CARD_ART_DEFS[id].image)).size, formalArtIds.length, "正式卡图路径必须唯一");
  for (const id of artIds) {
    const art = CARD_ART_DEFS[id];
    assert.match(art.symbol, /\S/, `${id} 缺少主视觉符号`);
    assert.match(art.caption, /\S/, `${id} 缺少画面说明`);
    assert.ok(motifs.has(art.motif), `${id} 使用了未知视觉母题 ${art.motif}`);
    if (art.image) {
      const imageUrl = new URL(`../${art.image}`, import.meta.url);
      assert.match(art.image, /\.webp$/, `${id} 的运行卡图必须使用 WebP`);
      assert.ok(existsSync(imageUrl), `${id} 的正式卡图文件不存在`);
      assert.ok(statSync(imageUrl).size <= 200 * 1024, `${id} 的运行卡图超过 200KB`);
      if (art.tone) assert.match(art.tone, /^saturate\([^)]+\) contrast\([^)]+\) brightness\([^)]+\)$/);
      if (art.hoverTone) assert.match(art.hoverTone, /^saturate\([^)]+\) contrast\([^)]+\) brightness\([^)]+\)$/);
    }
  }
});

test("嘉豪、宕机鸭与八名敌人保持独立素材并保留灰盒降级", () => {
  const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const jiahaoAsset = "assets/characters/student-jiahao-v1.webp";
  const duck = PET_DEFS.offlineDuck;
  const duckAssets = {
    battle: "assets/characters/pet-offline-duck-battle-v1.webp",
    icon: "assets/characters/pet-offline-duck-icon-v1.webp"
  };
  const studentAssets = {
    aries: jiahaoAsset,
    gemini: jiahaoAsset,
    cancer: jiahaoAsset
  };
  const enemyAssets = {
    sleepyBug: "assets/characters/enemy-sleepyBug-v1.webp",
    homeworkBlob: "assets/characters/enemy-homeworkBlob-v1.webp",
    alarmClock: "assets/characters/enemy-alarmClock-v1.webp",
    phoneSpirit: "assets/characters/enemy-phoneSpirit-v1.webp",
    groupChat: "assets/characters/enemy-groupChat-v1.webp",
    printerJam: "assets/characters/enemy-printerJam-v1.webp",
    rivalShadow: "assets/characters/enemy-rivalShadow-v1.webp",
    finalExam: "assets/characters/enemy-finalExam-v1.webp"
  };

  assert.equal(DEFAULT_PET_ID, "offlineDuck");
  assert.equal(duck.id, "offlineDuck");
  assert.equal(duck.name, "宕机鸭");
  assert.equal(duck.shortName, "鸭鸭");
  assert.deepEqual(duck.assets, duckAssets);
  assert.match(appSource, /const CHARACTER_ASSET_PATHS = Object\.freeze\(/);
  assert.deepEqual(new Set(Object.values(studentAssets)), new Set([jiahaoAsset]), "三种星座当前必须共用嘉豪外观");
  for (const [id, asset] of Object.entries({ ...studentAssets, ...enemyAssets })) {
    assert.match(appSource, new RegExp(`${id}:\\s*["']${asset.replaceAll("/", "\\/")}["']`), `${id} 缺少战场资产映射`);
    assert.match(asset, /\.webp$/, `${id} 的运行资产槽位必须使用 WebP`);
  }
  const independentRoleAssets = [jiahaoAsset, ...Object.values(duckAssets), ...Object.values(enemyAssets)];
  assert.equal(new Set(independentRoleAssets).size, independentRoleAssets.length, "嘉豪、鸭的两张素材与八名敌人必须保留彼此独立的路径");

  for (const [label, asset] of Object.entries({
    jiahao: jiahaoAsset,
    duckBattle: duckAssets.battle,
    duckIcon: duckAssets.icon,
    ...enemyAssets
  })) {
    const assetUrl = new URL(`../${asset}`, import.meta.url);
    assert.match(asset, /\.webp$/, `${label} 的运行资产必须使用 WebP`);
    assert.ok(existsSync(assetUrl), `${label} 正式 WebP 文件不存在`);
    assert.ok(statSync(assetUrl).size > 0, `${label} 正式 WebP 文件不能为空`);
    assert.ok(statSync(assetUrl).size <= 200 * 1024, `${label} 正式 WebP 文件超过 200KB`);
    const assetBytes = readFileSync(assetUrl);
    const header = assetBytes.subarray(0, 12);
    assert.equal(header.subarray(0, 4).toString("ascii"), "RIFF", `${label} 素材不是有效 WebP 容器`);
    assert.equal(header.subarray(8, 12).toString("ascii"), "WEBP", `${label} 素材缺少 WebP 文件标识`);
    assert.ok(assetBytes.includes(Buffer.from("ALPH")) || assetBytes.includes(Buffer.from("VP8L")), `${label} 必须包含透明通道`);
  }

  assert.match(appSource, /function characterAssetHtml\(src, className = "character-asset", alt = ""\)/);
  assert.match(appSource, /function characterAssetHtml\([\s\S]*?if \(!src\) return "";/, "未制作立绘的敌人应直接使用灰盒");
  assert.match(appSource, /onload="[^"]*classList\.add\('asset-ready'\)[^"]*"/, "图片加载成功后应隐藏灰盒占位");
  assert.match(appSource, /onerror=["'][^"']*\.remove\(\)/, "图片失败时应移除损坏节点并露出灰盒");
  assert.match(appSource, /class="student-avatar student-jiahao[^"']*"[^>]*aria-label="嘉豪，\$\{game\.archetype\.name\}战斗形象"/, "战场应把当前正式主角标记为嘉豪");
  assert.match(appSource, /characterAssetHtml\(asset, "character-asset", "嘉豪战斗形象"\)/, "嘉豪正式图片必须提供可访问替代文本");
  assert.match(appSource, /function renderBattlePet\(\)[\s\S]*?pet-full-fallback[\s\S]*?characterAssetHtml\(pet\.assets\.battle, "character-asset battle-pet-asset", `\$\{pet\.name\}战斗形象`\)/, "战场必须使用当前宠物完整图并保留 CSS 鸭降级");
  assert.match(appSource, /function renderPetFaceFor\(petId\)[\s\S]*?pet-icon-fallback[\s\S]*?characterAssetHtml\(pet\.assets\.icon, "character-asset pet-icon-asset"\)/, "充能头像必须使用当前宠物独立头像并保留 CSS 降级");
  assert.match(appSource, /pet-cub-full-fallback/, "困困虫正式素材未接入前必须拥有独立战场降级形象");
  assert.match(appSource, /pet-cub-icon-fallback/, "困困虫正式素材未接入前必须拥有独立头像降级形象");
  assert.match(styles, /\.avatar-fallback\s*\{[^}]*opacity:\s*1/);
  assert.match(styles, /\.asset-ready\s*>?\s*\.avatar-fallback\s*\{[^}]*opacity:\s*0/);
  assert.match(styles, /\.battle-pet-body\s*\{/);
  assert.match(styles, /\.battle-pet-legs\s*\{/);
  assert.match(styles, /\.pet-head\s*\{/);
  assert.match(styles, /\.pet-icon-asset\s*\{/);
  assert.match(styles, /\.pet-icon-fallback\s*\{/);
  assert.match(styles, /\.enemy-sleepyBug\.asset-ready\s*>\s*\.character-asset\s*\{[^}]*width:\s*144%/, "瞌睡虫横向立绘需要独立放大以保持战场辨识度");
  assert.match(styles, /\.enemy-homeworkBlob\.asset-ready\s*>\s*\.character-asset\s*\{[^}]*width:\s*132%[^}]*object-position:\s*center bottom/, "作业团需要独立横向放大并落在战场地面");
  assert.match(styles, /\.enemy-alarmClock\.asset-ready\s*>\s*\.character-asset\s*\{[^}]*width:\s*156%[^}]*object-position:\s*center bottom/, "闹钟怪需要按自身透明边距放大并落在战场地面");
  assert.match(styles, /\.enemy-phoneSpirit\.asset-ready\s*>\s*\.character-asset\s*\{[^}]*width:\s*140%[^}]*object-position:\s*center bottom/, "手机精需要按透明边距放大并落在战场地面");
  assert.match(styles, /\.enemy-groupChat\.asset-ready\s*>\s*\.character-asset\s*\{[^}]*width:\s*128%[^}]*object-position:\s*48% bottom/, "群聊99+需要兼顾左侧通知流与右侧通知堆");
  assert.match(styles, /\.enemy-printerJam\.asset-ready\s*>\s*\.character-asset\s*\{[^}]*width:\s*124%[^}]*object-position:\s*48% bottom/, "卡纸打印机需要同时保留左侧重击与右侧眼部");
  assert.match(styles, /\.enemy-rivalShadow\.asset-ready\s*>\s*\.character-asset\s*\{[^}]*width:\s*128%[^}]*object-position:\s*52% bottom/, "卷王幻影需要保留向玩家冲刺的完整动作");
  assert.match(styles, /\.enemy-finalExam\.asset-ready\s*>\s*\.character-asset\s*\{[^}]*width:\s*124%[^}]*object-position:\s*center bottom/, "期末考试需要在 Boss 槽位保留完整轮廓");
  assert.match(styles, /@media \(max-width:\s*700px\)[\s\S]*?\.enemy-groupChat\.asset-ready\s*>\s*\.character-asset\s*\{[^}]*width:\s*120%[\s\S]*?\.enemy-printerJam\.asset-ready\s*>\s*\.character-asset\s*\{[^}]*width:\s*118%[\s\S]*?\.enemy-rivalShadow\.asset-ready\s*>\s*\.character-asset\s*\{[^}]*width:\s*118%[\s\S]*?\.enemy-finalExam\.asset-ready\s*>\s*\.character-asset\s*\{[^}]*width:\s*116%/, "四名后段敌人在 120×150 战场槽位中需要独立收缩并保留动作轮廓");

  const styleVersion = indexSource.match(/styles\.css\?v=([\d.]+)/)?.[1];
  const appVersion = indexSource.match(/app\.js\?v=([\d.]+)/)?.[1];
  assert.ok(styleVersion, "index.html 必须加载带缓存版本的角色样式");
  assert.equal(appVersion, styleVersion, "角色脚本与样式必须使用同一缓存版本");
});

test("玩家可见宠物文案支持多宠物，同时保留兼容用内部标识", () => {
  const playerFacingSources = [
    "app.js", "game-data.js", "game-engine.js", "build-analysis.js",
    "career.js", "styles.css", "index.html", "README.md"
  ];
  const forbiddenVisibleTerms = ["暴躁鹅", "鹅鹅", "追着啄", "GOOSE"];

  for (const file of playerFacingSources) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    for (const term of forbiddenVisibleTerms) {
      assert.equal(source.includes(term), false, `${file} 仍包含玩家可见旧宠物文案：${term}`);
    }
  }

  assert.equal(CARD_ART_DEFS.feedPet.motif, "goose", "内部卡图 motif 可以继续兼容 goose 标识");
  assert.equal(ACHIEVEMENT_DEFS.gooseCall.id, "gooseCall", "生涯存档必须继续兼容 gooseCall 内部 ID");
  assert.equal(ACHIEVEMENT_DEFS.gooseCall.icon, "伴");
  assert.equal(ACHIEVEMENT_DEFS.gooseCall.name, "伙伴来！");
  assert.match(ACHIEVEMENT_DEFS.gooseCall.text, /任意宠物/);
  const engineSource = readFileSync(new URL("../game-engine.js", import.meta.url), "utf8");
  assert.match(engineSource, /LEGACY_PET_ID_ALIASES\s*=\s*Object\.freeze\(\{\s*goose:\s*DEFAULT_PET_ID\s*\}\)/, "旧 goose 宠物 ID 必须继续迁移到默认宠物");
});

test("十一件随身物品公开触发频率，文案边界与实际规则一致", () => {
  assert.equal(Object.keys(ITEM_DEFS).length, 11);
  for (const item of Object.values(ITEM_DEFS)) {
    assert.equal(typeof item.timing, "string");
    assert.ok(item.timing.length > 0);
  }
  assert.match(ITEM_DEFS.earplugs.text, /第一次走神/);
  assert.match(ITEM_DEFS.studentId.text, /删牌价格降低10%/);
  assert.match(ITEM_DEFS.silentPhone.text, /第一回合多抽1张/);

  const halfHp = new SemesterGame(570, "aries");
  halfHp.addItem("bandage");
  halfHp.hp = halfHp.maxHp / 2;
  halfHp.startCombat("sleepyBug");
  assert.equal(halfHp.combat.playerBlock, 6);

  const aboveHalf = new SemesterGame(571, "aries");
  aboveHalf.addItem("bandage");
  aboveHalf.hp = aboveHalf.maxHp / 2 + 1;
  aboveHalf.startCombat("sleepyBug");
  assert.equal(aboveHalf.combat.playerBlock, 0);

  const silentPhone = new SemesterGame(572, "aries");
  silentPhone.tutorialSeen = true;
  silentPhone.addItem("silentPhone");
  silentPhone.startCombat("sleepyBug");
  assert.equal(silentPhone.combat.hand.length, 6);
  assert.match(silentPhone.combat.log.join("\n"), /静音手机生效：第一回合多抽 1 张牌/);

  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /\$\{rarityName\(item\.rarity\)\}物品 · \$\{escapeHtml\(item\.timing\)\}/);
});

test("十一件随身物品全部使用克制的无方框小尺寸独立图标", () => {
  const artItemIds = Object.keys(ITEM_DEFS);
  const artPaths = artItemIds.map((id) => ITEM_DEFS[id].art);
  assert.equal(artItemIds.length, 11);
  assert.equal(new Set(artPaths).size, artItemIds.length);
  for (const [index, art] of artPaths.entries()) {
    assert.match(art, /^assets\/items\/.+-v1\.webp$/);
    const imageUrl = new URL(`../${art}`, import.meta.url);
    const sourceUrl = new URL(`../${art.replace(/\.webp$/, ".png")}`, import.meta.url);
    assert.ok(existsSync(imageUrl), `${artItemIds[index]} 的物品图标不存在`);
    assert.ok(existsSync(sourceUrl), `${artItemIds[index]} 的物品图标源文件不存在`);
    assert.ok(statSync(imageUrl).size <= 40 * 1024, `${artItemIds[index]} 的运行图标超过 40KB`);
  }

  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(appSource, /function itemIconHtml\(item, className = "item-icon"\)/);
  assert.match(appSource, /loading="lazy"/);
  assert.match(styles, /\.item-icon \{[^}]*width: 44px;[^}]*height: 44px/);
  assert.match(styles, /\.item-icon \{[^}]*background: transparent/);
  assert.match(styles, /\.item-icon img \{[^}]*mix-blend-mode: screen;[^}]*mask-image: radial-gradient/);
  assert.match(styles, /\.combat-relic-icon img \{[^}]*mix-blend-mode: screen;[^}]*mask-image: radial-gradient/);
});

test("顶栏校园币、卡组与物品使用统一的小尺寸原生图标", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.doesNotMatch(appSource, /<div class="resource">[◎▦♢]/);
  assert.match(appSource, /class="resource resource-stat campus-coin-resource" aria-label="校园币：\$\{game\.gold\}"/);
  assert.match(appSource, /class="resource resource-stat deck-resource" aria-label="卡组：\$\{game\.deck\.length\} 张牌"/);
  assert.match(appSource, /class="resource resource-stat items-resource" aria-label="随身物品：\$\{game\.items\.length\} 件，容量 \$\{game\.backpackCapacity\} 件"/);
  for (const iconClass of ["campus-coin-icon", "deck-stack-icon", "backpack-icon"]) {
    assert.match(appSource, new RegExp(`<span class="resource-icon ${iconClass}" aria-hidden="true"></span>`));
  }

  assert.match(styles, /\.resource-stat \{[^}]*display: inline-flex;[^}]*flex: 0 0 auto;[^}]*gap: 5px;/);
  assert.match(styles, /\.resource-icon \{[^}]*flex: 0 0 14px;[^}]*width: 14px;[^}]*height: 14px;/);
  assert.match(styles, /\.campus-coin-icon \{[^}]*border: 1px solid currentColor;[^}]*border-radius: 50%;[^}]*box-shadow: inset/);
  assert.match(styles, /\.campus-coin-icon::before,[\s\S]*?\.campus-coin-icon::after \{[^}]*width: 4px;[^}]*height: 4px;/);
  assert.match(styles, /\.deck-stack-icon \{[^}]*width: 13px;[^}]*height: 11px;[^}]*border: 1px solid currentColor;/);
  assert.match(styles, /\.backpack-icon \{[^}]*width: 12px;[^}]*height: 10px;[^}]*border: 1px solid currentColor;/);
  assert.match(styles, /@media \(max-width: 700px\) \{[\s\S]*?\.topbar \{[^}]*flex-wrap: wrap;[\s\S]*?\.resource-stat \{ gap: 4px; \}/);
});

test("随身物品图鉴按稀有度完整筛选并保持只读入口", () => {
  const allIds = itemLibraryIds(ITEM_DEFS, "all");
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.deepEqual(ITEM_LIBRARY_FILTERS, ["all", "common", "uncommon", "rare", "boss"]);
  assert.deepEqual(allIds, Object.keys(ITEM_DEFS));
  assert.equal(itemLibraryIds(ITEM_DEFS, "common").length, 4);
  assert.equal(itemLibraryIds(ITEM_DEFS, "uncommon").length, 3);
  assert.deepEqual(itemLibraryIds(ITEM_DEFS, "rare"), ["petSnack", "silentPhone"]);
  assert.deepEqual(itemLibraryIds(ITEM_DEFS, "boss"), ["allNighter", "referenceBooks"]);
  for (const rarity of ITEM_LIBRARY_FILTERS.slice(1)) {
    assert.ok(itemLibraryIds(ITEM_DEFS, rarity).every((id) => ITEM_DEFS[id].rarity === rarity));
  }
  assert.equal(normalizeItemLibraryFilter("unknown"), "all");
  assert.match(appSource, /data-action="open-item-library"/);
  assert.match(appSource, /data-action="filter-item-library"/);
  assert.match(appSource, /data-action="close-item-library"/);
  assert.match(appSource, /function renderItemLibrary\(\)/);
  assert.match(appSource, /itemHtml\(id, \{ disabled: true \}\)/);
  assert.match(styles, /\.item-library-grid \{[^}]*grid-template-columns: repeat\(auto-fit/);
  assert.match(styles, /\.item-library-entry \.item-tile:disabled \{[^}]*opacity: 1/);
});

test("战斗遗物栏公开待触发、已触发、持续与战外状态", () => {
  const readyState = {
    combat: {
      startingHp: 30,
      pencilUsed: false,
      notebookUsed: false,
      mistakeBookUsed: false,
      earplugsUsed: false
    },
    flags: { eraserUsed: false },
    maxHp: 60
  };
  const snapshot = JSON.stringify(readyState);

  assert.deepEqual(combatItemCue("autoPencil", readyState), { label: "首张攻击待触发", tone: "ready" });
  assert.deepEqual(combatItemCue("thickNotebook", readyState), { label: "首次护甲待触发", tone: "ready" });
  assert.deepEqual(combatItemCue("mistakeBook", readyState), { label: "破防后待触发", tone: "ready" });
  assert.deepEqual(combatItemCue("earplugs", readyState), { label: "首次走神待抵挡", tone: "ready" });
  assert.deepEqual(combatItemCue("bandage", readyState), { label: "入场已触发", tone: "active" });
  assert.deepEqual(combatItemCue("bandage", { combat: { startingHp: 31 }, maxHp: 60 }), { label: "未达半血", tone: "passive" });
  assert.deepEqual(combatItemCue("petSnack", readyState), { label: "入场已充能", tone: "active" });
  assert.deepEqual(combatItemCue("silentPhone", readyState), { label: "首回合已多抽 1 张", tone: "active" });
  assert.deepEqual(combatItemCue("allNighter", readyState), { label: "持续：能量 +1", tone: "active" });
  assert.deepEqual(combatItemCue("referenceBooks", readyState), { label: "持续：抽牌 +1", tone: "active" });
  assert.deepEqual(combatItemCue("studentId", readyState), { label: "商店生效", tone: "passive" });
  assert.deepEqual(combatItemCue("eraser", readyState), { label: "战后奖励待命", tone: "passive" });
  assert.deepEqual(combatItemCue("autoPencil", { combat: { pencilUsed: true } }), { label: "本回合已触发", tone: "spent" });
  assert.deepEqual(combatItemCue("earplugs", { combat: { earplugsUsed: true } }), { label: "本场已触发", tone: "spent" });
  assert.deepEqual(combatItemCue("eraser", { flags: { eraserUsed: true } }), { label: "本学期已使用", tone: "spent" });
  assert.equal(JSON.stringify(readyState), snapshot, "状态提示必须保持只读");

  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(appSource, /function combatRelicRowHtml\(\)/);
  assert.match(appSource, /combatItemCue\(id, \{ combat: game\.combat, flags: game\.flags, maxHp: game\.maxHp \}\)/);
  assert.match(appSource, /\$\{combatRelicRowHtml\(\)\}/);
  assert.match(appSource, /class="combat-relic state-\$\{cue\.tone\}"/);
  assert.match(appSource, /class="combat-relic-tooltip" role="tooltip"/);
  assert.match(styles, /\.combat-relic-row \{[^}]*display: flex/);
  assert.match(styles, /\.combat-relic\.state-ready/);
  assert.match(styles, /\.combat-relic\.state-spent/);
  assert.match(styles, /\.combat-relic:focus \.combat-relic-tooltip/);
});

test("十六周日历收纳为可访问弹层并完整保留进度与节点符号", () => {
  const semesterPlan = Array.from({ length: 17 }, () => []);
  semesterPlan[1] = [{ type: "combat", label: "入学测试" }];
  semesterPlan[3] = [
    { type: "event", label: "神秘纸箱" },
    { type: "combat", challenge: true, label: "限时下课" }
  ];
  semesterPlan[8] = [{ type: "combat", label: "期中考试" }];
  semesterPlan[16] = [{ type: "combat", label: "期末考试" }];
  const snapshot = JSON.stringify(semesterPlan);

  const weeks = semesterCalendarWeeks(semesterPlan, 3);
  assert.equal(SEMESTER_WEEK_COUNT, 16);
  assert.equal(weeks.length, 16);
  assert.deepEqual(weeks.slice(0, 4).map(({ status }) => status), ["done", "done", "current", "upcoming"]);
  assert.deepEqual(weeks[2].nodes.map(({ type }) => type), ["event", "challenge"]);
  assert.equal(weeks[7].nodes[0].type, "elite");
  assert.equal(weeks[15].nodes[0].type, "boss");
  assert.equal(JSON.stringify(semesterPlan), snapshot, "日历投影必须保持只读");

  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(appSource, /class="semester-calendar-trigger"[^>]*data-action="open-calendar"[^>]*aria-haspopup="dialog"/);
  assert.match(appSource, /semesterCalendarOpen \? `\s*<div class="semester-calendar-backdrop"/);
  assert.match(appSource, /id="semester-calendar-dialog" role="dialog" aria-modal="true"/);
  assert.match(appSource, /id="semester-calendar-challenge">\$\{nextChallengeSummary\}/);
  assert.match(appSource, /class="quiet-button calendar-dialog-close"[^>]*data-action="close-calendar"[^>]*autofocus/);
  assert.match(appSource, /button\.dataset\.dismiss === "backdrop" && event\.target !== button/);
  assert.match(appSource, /event\.key === "Escape"[\s\S]*?closeSemesterCalendar\(\)/);
  assert.match(appSource, /app\.querySelector\('\[data-action="open-calendar"\]'\)\?\.focus\(\)/);
  assert.match(appSource, /trapDialogFocus\(event, dialog\)/);
  assert.match(appSource, /class="calendar-week state-\$\{entry\.status\}"/);
  assert.match(appSource, /class="calendar-event event-\$\{node\.type\}"/);
  assert.doesNotMatch(appSource, /未来四周/);
  assert.match(styles, /\.semester-calendar-trigger \{[^}]*min-height:\s*62px/);
  assert.match(styles, /\.semester-calendar-backdrop \{[^}]*position:\s*fixed/);
  assert.match(styles, /\.semester-calendar \{[^}]*max-height:[^;}]*100vh/);
  assert.match(styles, /\.semester-calendar-grid \{[^}]*grid-template-columns: repeat\(4/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.semester-calendar-grid \{[^}]*grid-template-columns: repeat\(2/);
  assert.match(styles, /\.calendar-week\.state-done \.calendar-week-date/);
  assert.match(styles, /\.calendar-week\.state-current/);
});

test("卡牌图鉴按公共池、三种星座和状态牌完整筛选", () => {
  const allIds = cardLibraryIds(CARD_DEFS, "all");
  const publicIds = cardLibraryIds(CARD_DEFS, "public");
  const statusIds = cardLibraryIds(CARD_DEFS, "status");
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.deepEqual(CARD_LIBRARY_FILTERS, ["all", "public", "aries", "gemini", "cancer", "status"]);
  assert.deepEqual(allIds, Object.keys(CARD_DEFS));
  assert.equal(publicIds.length, 16);
  assert.ok(PUBLIC_REWARD_CARD_IDS.every((id) => publicIds.includes(id)));
  assert.ok(["textbookStrike", "backpackGuard", "cramming", "payAttention"].every((id) => publicIds.includes(id)));
  assert.equal(publicIds.some((id) => CARD_DEFS[id].archetype || CARD_DEFS[id].type === "status"), false);
  assert.deepEqual(cardLibraryIds(CARD_DEFS, "aries"), ARCHETYPE_CARD_IDS.aries);
  assert.deepEqual(cardLibraryIds(CARD_DEFS, "gemini"), ARCHETYPE_CARD_IDS.gemini);
  assert.deepEqual(cardLibraryIds(CARD_DEFS, "cancer"), ARCHETYPE_CARD_IDS.cancer);
  assert.deepEqual(statusIds, ["todo", "nervous"]);
  assert.equal(normalizeCardLibraryFilter("unknown"), "all");
  assert.match(appSource, /data-action="open-library"/);
  assert.match(appSource, /data-action="filter-library"/);
  assert.match(appSource, /action: "toggle-library-upgrade"/);
  assert.match(appSource, /action === "toggle-library-upgrade"/);
  assert.match(styles, /\.library-grid \{[^}]*grid-template-columns: repeat\(auto-fill/);
});

test("战斗冲击反馈只展示实际结算差值并区分攻防与敌方行动", () => {
  const attack = battleFeedbackFromDelta(
    { playerHp: 40, playerBlock: 2, enemyHp: 30, enemyBlock: 4, handSize: 5, petCharge: 0 },
    { playerHp: 40, playerBlock: 8, enemyHp: 24, enemyBlock: 0, handSize: 4, petCharge: 1 },
    { id: 7, kind: "card", label: "左右横跳", cardPlayed: true, cardType: "attack" }
  );
  assert.equal(attack.tone, "attack");
  assert.equal(attack.motionType, "attack");
  assert.equal(attack.enemyDamage, 6);
  assert.equal(attack.enemyBlockLoss, 4);
  assert.equal(attack.playerBlockGain, 6);
  assert.equal(attack.cardsDrawn, 0);
  assert.equal(attack.petChargeGain, 1);
  assert.deepEqual(attack.summaryParts, ["敌方生命 -6", "击破护甲 4", "护甲 +6", "宠物充能 +1"]);

  const guard = battleFeedbackFromDelta(
    { playerHp: 40, playerBlock: 0, enemyHp: 30, enemyBlock: 0, handSize: 5, petCharge: 2 },
    { playerHp: 40, playerBlock: 8, enemyHp: 30, enemyBlock: 0, handSize: 5, petCharge: 2 },
    { kind: "card", label: "认真听讲", cardPlayed: true }
  );
  assert.equal(guard.tone, "guard");
  assert.equal(guard.motionType, "guard");
  assert.equal(guard.cardsDrawn, 1);
  assert.deepEqual(guard.summaryParts, ["护甲 +8", "抽牌 +1"]);

  const enemy = battleFeedbackFromDelta(
    { playerHp: 40, playerBlock: 7, enemyHp: 30, enemyBlock: 5, handSize: 4, petCharge: 2 },
    { playerHp: 37, playerBlock: 0, enemyHp: 30, enemyBlock: 9, handSize: 5, petCharge: 2 },
    {
      kind: "enemy",
      label: "作业团 · 堆作业",
      playerBlockAbsorbed: 7,
      enemyBlockGain: 9,
      causalEffects: [
        { type: "debuff", id: "distracted", applied: true },
        { type: "debuff", id: "ignored", applied: false }
      ]
    }
  );
  assert.equal(enemy.tone, "danger");
  assert.equal(enemy.motionType, "enemy-attack");
  assert.equal(enemy.enemyBlockLoss, 0);
  assert.equal(enemy.cardsDrawn, 0);
  assert.deepEqual(enemy.causalEffects, [{ type: "debuff", id: "distracted", target: "player", count: 1 }]);
  assert.deepEqual(enemy.summaryParts, ["生命 -3", "护甲挡下 7", "敌方护甲 +9"]);

  const statusEnemy = battleFeedbackFromDelta(
    { playerHp: 40, playerBlock: 0, enemyHp: 30, enemyBlock: 0 },
    { playerHp: 40, playerBlock: 0, enemyHp: 30, enemyBlock: 0 },
    {
      kind: "enemy",
      effectParts: ["加入弃牌堆 1 张待办"],
      causalEffects: [{ type: "status", id: "todo", target: "discardPile", count: 2 }]
    }
  );
  assert.equal(statusEnemy.motionType, "enemy-skill");
  assert.deepEqual(statusEnemy.causalEffects, [{ type: "status", id: "todo", target: "discardPile", count: 2 }]);
  assert.deepEqual(statusEnemy.summaryParts, ["加入弃牌堆 1 张待办"]);

  const skill = battleFeedbackFromDelta(
    { enemyHp: 20 },
    { enemyHp: 15 },
    { kind: "card", cardType: "skill" }
  );
  assert.equal(skill.motionType, "attack", "带伤害的技能也应播放真实命中，而不是普通技能演出");
  const statusGuard = battleFeedbackFromDelta(
    { playerBlock: 0 },
    { playerBlock: 2 },
    { kind: "card", cardType: "status" }
  );
  assert.equal(statusGuard.motionType, "guard", "待办等状态牌实际获得护甲时应播放护甲演出");
  const cleanse = battleFeedbackFromDelta(
    { playerBlock: 0 },
    { playerBlock: 5 },
    { kind: "card", cardType: "skill", cleanseApplied: true, effectParts: ["移除走神"] }
  );
  assert.deepEqual(cleanse.summaryParts, ["护甲 +5", "移除走神"]);
  assert.equal(cleanse.motionType, "cleanse");
  assert.equal(battleFeedbackFromDelta({}, {}, { kind: "card", cardType: "status" }).motionType, "status");
  assert.equal(battleFeedbackFromDelta({}, {}, { kind: "card", cleanseApplied: true }).motionType, "cleanse");

  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(appSource, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(appSource, /queueBattleFeedback\("card"/);
  assert.match(appSource, /queueBattleFeedback\("pet"/);
  assert.match(appSource, /queueBattleFeedback\("enemy"/);
  assert.match(styles, /@keyframes feedback-enemy-hit/);
  assert.match(styles, /\.motion-guard \.feedback-streak, \.motion-guard \.feedback-burst/);
  assert.match(styles, /\.motion-status \.feedback-streak, \.motion-status \.feedback-burst/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("战斗演出使用固定 GSAP 时间轴并为减少动态效果提供可靠降级", () => {
  const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const serverSource = readFileSync(new URL("../server.mjs", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const packageData = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

  assert.match(indexSource, /gsap@3\.15\.0\/dist\/gsap\.min\.js/);
  assert.equal(packageData.dependencies.gsap, "^3.15.0");
  assert.match(appSource, /await import\("\.\/vendor\/gsap\/index\.js"\)/);
  assert.match(serverSource, /relative\.startsWith\("vendor\/gsap\/"\)/);
  assert.match(appSource, /function captureBattleMotionOrigin\(/);
  assert.match(appSource, /function createBattleMotionGhost\(/);
  assert.match(appSource, /function runBattleMotion\(/);
  assert.match(appSource, /function scheduleBattleMotion\(/);
  assert.match(appSource, /window\.gsap/);
  assert.match(appSource, /\.timeline\s*\(/);
  assert.match(appSource, /\.addLabel\(\s*["']windup["']/);
  assert.match(appSource, /\.addLabel\(\s*["']impact["']/);
  assert.match(appSource, /prefers-reduced-motion:\s*reduce/);
  assert.match(appSource, /\.remove\(\)/, "动画残影在完成或降级时必须从 DOM 清理");

  assert.match(appSource, /action === "play-card"[\s\S]*?const motionOrigin = captureBattleMotionOrigin\([\s\S]*?queueBattleFeedback\("card"[\s\S]*?cardPlayed: true,[\s\S]*?cardType:[\s\S]*?cleanseApplied,[\s\S]*?motionOrigin/);
  assert.match(appSource, /action === "pet-skill"[\s\S]*?const motionOrigin = captureBattleMotionOrigin\([\s\S]*?queueBattleFeedback\("pet"[\s\S]*?motionOrigin/);
  assert.match(appSource, /function render\(\)[\s\S]*?app\.innerHTML[\s\S]*?scheduleBattleMotion\(\);/);

  assert.match(styles, /\.played-card-ghost\b/);
  assert.match(styles, /\.pet-flight\b/);
  assert.match(styles, /\.battle-causal-ghost \{[^}]*position: fixed;[^}]*pointer-events: none;[^}]*will-change: transform, opacity;/);
  assert.match(styles, /\.battle-causal-ghost\.cause-debuff/);
  assert.match(styles, /\.battle-causal-ghost\.cause-status/);
  assert.match(styles, /\.battle-feedback:is\(\.gsap-driven, \.motion-pending\)/);
  assert.match(styles, /\.battle-feedback\.motion-settled \.feedback-ribbon/);
});

test("战斗手牌支持鼠标悬停和键盘聚焦放大查看", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(styles, /\.hand \.game-card:not\(:disabled\):is\(:hover, :focus-visible\)/);
  assert.match(styles, /translateY\(-32px\) scale\(1\.18\)/);
  assert.match(styles, /\.hand \{[^}]*flex-wrap: nowrap;[^}]*gap: 0;/);
  assert.match(styles, /\.hand \.game-card \{[^}]*margin-right: -56px;/);
  assert.match(styles, /\.hand \.game-card \{[^}]*height: 280px;/);
});

test("平板与桌面战斗操作区固定在首屏底部并保留完整出牌入口", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(appSource, /<section class="combat-action-dock" aria-label="战斗操作区">/);
  assert.match(styles, /@media \(min-width: 701px\) and \(min-height: 680px\)/);
  assert.match(styles, /\.combat-page \{[^}]*height: calc\(100vh - 64px\);[^}]*overflow: hidden;/);
  assert.match(styles, /\.combat-action-dock \{ position: fixed;[^}]*bottom: 0;[^}]*height: 294px;/);
  assert.match(styles, /\.combat-action-dock \.hand \{[^}]*height: 236px;[^}]*min-height: 236px;/);
  assert.match(styles, /\.combat-action-dock \.combat-shortcut-guide \{ display: none; \}/);
  assert.match(styles, /\.combat-action-dock \.hand \.game-card \{[^}]*flex-basis: 146px;[^}]*width: 146px;[^}]*transform: none;/);
  assert.match(styles, /\.combat-action-dock \.hand:has\(\.game-card:nth-child\(8\)\) \.game-card \{[^}]*flex-basis: 132px;[^}]*margin-right: -60px;/);
  assert.match(styles, /@media \(min-width: 701px\) and \(max-width: 980px\) and \(min-height: 620px\)/);
  assert.match(styles, /@media \(max-width: 1100px\) \{\s*\.topbar \.sign-resource, \.topbar \.tarot-resource \{ display: none; \}/);
});

test("手机战斗首屏固定在动态视口内并保留横向出牌入口", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(styles, /@media \(max-width: 700px\) and \(max-height: 900px\)/);
  assert.match(styles, /body:has\(\.combat-page\) \{ overflow: hidden; \}/);
  assert.match(styles, /body:has\(\.combat-page\) \.topbar \{[\s\S]*?height: calc\(50px \+ env\(safe-area-inset-top\)\);/);
  assert.match(styles, /\.combat-page \{[\s\S]*?height: calc\(100dvh - 50px - env\(safe-area-inset-top\)\);[\s\S]*?overflow: hidden;/);
  assert.match(styles, /\.combat-page \.combat-relic-row\.is-empty \{ display: none; \}/);
  assert.match(styles, /\.combat-page \.combat-action-dock \.pile-counts \{[\s\S]*?position: absolute;[\s\S]*?top: 0;/);
  assert.match(styles, /\.combat-page \.combat-action-dock \.pile-button \{[\s\S]*?min-width: 48px;[\s\S]*?min-height: 48px;/);
  assert.match(styles, /\.combat-page \.hand \{[\s\S]*?height: 216px;[\s\S]*?overflow-x: auto;[\s\S]*?scroll-snap-type: x proximity;/);
  assert.match(styles, /\.combat-page \.hand \.game-card \{[\s\S]*?flex: 0 0 138px;[\s\S]*?height: 202px;/);
  assert.match(styles, /\.combat-page \.pet-companion-tooltip \{[\s\S]*?position: fixed;[\s\S]*?bottom: max\(12px, env\(safe-area-inset-bottom\)\);/);
});

test("战斗双方共享校园舞台并把中央战报降为次要信息", () => {
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const backgroundAsset = "assets/scenes/classroom-battle-v1.webp";
  const backgroundUrl = new URL(`../${backgroundAsset}`, import.meta.url);

  assert.match(styles, /\.combat-board \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(styles, new RegExp(`url\\("${backgroundAsset.replaceAll("/", "\\/")}"\\) center 57% \\/ cover no-repeat`));
  assert.ok(existsSync(backgroundUrl), "教室战斗背景文件不存在");
  assert.ok(statSync(backgroundUrl).size > 0, "教室战斗背景不能为空");
  assert.ok(statSync(backgroundUrl).size <= 350 * 1024, "教室战斗背景超过 350KB");
  const backgroundHeader = readFileSync(backgroundUrl).subarray(0, 12);
  assert.equal(backgroundHeader.subarray(0, 4).toString("ascii"), "RIFF", "教室战斗背景不是有效 WebP 容器");
  assert.equal(backgroundHeader.subarray(8, 12).toString("ascii"), "WEBP", "教室战斗背景缺少 WebP 标识");
  assert.match(styles, /\.battle-center \{[^}]*position: absolute;[^}]*left: 50%;[^}]*pointer-events: none;/);
  assert.match(styles, /\.combat-log \{[^}]*width: min\(250px, 100%\);[^}]*max-height: 30px;[^}]*opacity: \.67;/);
  assert.match(styles, /\.combat-log p:first-child \{[^}]*display: block;[^}]*text-overflow: ellipsis;/);
  assert.match(styles, /\.combat-vitals \{[^}]*width: min\(232px, 82%\);[^}]*margin: -7px auto 0;/);
  assert.match(styles, /\.combat-action-dock::before \{[^}]*border-top: 1px solid rgba\(194,207,207,\.13\);/);
  assert.match(styles, /@media \(min-width: 701px\) and \(min-height: 680px\) and \(max-height: 933px\)/);
  assert.match(styles, /\.combat-page:has\(\.challenge-contract\) \.combat-board \{ height: 226px; min-height: 226px; \}/);
  assert.match(styles, /\.combat-page:has\(\.challenge-contract\) \.combat-log,[\s\S]*?\.enemy-fighter > p \{ display: none; \}/);
});

test("战斗牌堆、复合敌人意图与护甲盾牌使用统一战场图形", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const mixedIntent = ENEMY_DEFS.finalExam.intentAt(2);

  assert.equal(mixedIntent.attack, 10);
  assert.equal(mixedIntent.block, 8);
  assert.match(appSource, /if \(intent\.attack\) chips\.push\(\{ kind: "attack"/);
  assert.match(appSource, /if \(intent\.block\) chips\.push\(\{ kind: "block"/);
  assert.match(appSource, /class="intent-chip intent-\$\{chip\.kind\}"/);
  assert.match(styles, /\.intent-chip\.intent-block/);
  assert.match(appSource, /class="block-shield \$\{combat\.playerBlock > 0/);
  assert.match(styles, /\.block-shield::before, \.block-shield::after \{[^}]*clip-path: polygon/);
  assert.match(appSource, /class="pile-button pile-draw"/);
  assert.match(appSource, /class="pile-button pile-discard"/);
  assert.match(appSource, /data-zone="drawPile"/);
  assert.match(appSource, /data-zone="discardPile"/);
  assert.doesNotMatch(appSource, /data-zone="exhaustPile"/);
  assert.match(styles, /\.pile-stack \{[^}]*box-shadow: -\d+px \d+px 0 -1px[^}]*, -\d+px \d+px 0 0/);
});

test("战场意图移除黑色大底，回合规则回到新生教学", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(appSource, /<button type="button" class="enemy-intent-token state-\$\{tone\}/);
  assert.match(appSource, /data-action="toggle-intent-details"[^>]*aria-expanded="\$\{pinned\}"/);
  assert.match(appSource, /aria-label="敌人意图：\$\{escapeHtml\(name\)\}"/);
  assert.match(appSource, /class="intent-mechanic"><b>特性 · \$\{escapeHtml\(enemyDefinition\.mechanicName\)\}/);
  assert.match(appSource, /escapeHtml\(enemyDefinition\.mechanicText\)/);
  assert.match(appSource, /function setIntentDetailsOpen\(button, open\)[\s\S]*?classList\.toggle\("is-dismissed", !open\)/);
  assert.match(appSource, /action === "toggle-intent-details"[\s\S]*?setIntentDetailsOpen\(button, context\.intentDetailsPinned !== true\)/);
  assert.match(styles, /\.enemy-intent-token \{[^}]*border: 0;[^}]*background: transparent;[^}]*box-shadow: none;/);
  assert.match(styles, /\.intent-chip \{[^}]*border: 1px solid rgba/);
  assert.match(styles, /\.enemy-intent-token\.state-safe > small/);
  assert.doesNotMatch(appSource, /class="turn-badge"/);
  assert.doesNotMatch(styles, /\.turn-badge/);
  assert.match(appSource, /一回合：你出牌，敌人行动/);
  assert.match(appSource, /玩家回合开始抽 5 张并获得 3 能量/);
  assert.match(appSource, /敌人按头顶意图行动，再进入下一回合/);
  assert.match(appSource, /const COMBAT_SETUP_LOG_PATTERN = \/\^\(\?:遭遇 /);
  assert.match(appSource, /function visibleCombatLogEntries\(entries\)/);
  assert.match(appSource, /entries\.filter\(\(entry\) => !COMBAT_SETUP_LOG_PATTERN\.test\(entry\)\)\.slice\(-3\)/);
  assert.match(appSource, /visibleCombatLog\.reverse\(\)/);
});

test("新生教学使用真正模态弹层并在完成后交回战斗焦点", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");

  assert.match(appSource, /class="tutorial-card" id="tutorial-dialog" role="dialog" aria-modal="true"/);
  assert.match(appSource, /aria-labelledby="tutorial-progress tutorial-title" aria-describedby="tutorial-description"/);
  assert.match(appSource, /id="tutorial-progress">新生教学 \$\{step\.number\}\/03/);
  assert.match(appSource, /id="tutorial-title">\$\{step\.title\}<\/h2><p id="tutorial-description">\$\{step\.text\}/);
  assert.match(appSource, /data-action="tutorial-next" autofocus/);
  assert.match(appSource, /const focusTarget = dialog\.querySelector\("\[autofocus\]"\)[\s\S]*?\|\| dialog\.querySelector\("button:not\(:disabled\)"\);[\s\S]*?focusTarget\?\.focus\(\);/);
  assert.match(appSource, /function completeTutorial\(\) \{[\s\S]*?game\.tutorialSeen = true;[\s\S]*?saveGame\(\);[\s\S]*?render\(\);[\s\S]*?toggle-intent-details[\s\S]*?\.focus\(\);/);
  assert.match(appSource, /action === "tutorial-next"[\s\S]*?completeTutorial\(\)[\s\S]*?tutorialStep \+= 1;[\s\S]*?render\(\);/);
  assert.match(appSource, /action === "skip-tutorial"[\s\S]*?completeTutorial\(\)/);
  assert.match(appSource, /function activeDialog\(\) \{[\s\S]*?\[role="dialog"\]\[aria-modal="true"\]/);
  assert.match(appSource, /if \(dialog && event\.key === "Tab"\) \{[\s\S]*?trapDialogFocus\(event, dialog\)/);
});

test("牌堆弹层保持卡牌正常亮度且不泄露抽牌顺序", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(appSource, /class="pile-dialog" role="dialog" aria-modal="true"/);
  assert.match(appSource, /const cards = \[\.\.\.\(combat\[pileView\] \|\| \[\]\)\];/);
  assert.match(appSource, /if \(pileView === "drawPile"\) \{\s*cards\.sort/);
  assert.match(appSource, /仅按牌名整理展示；实际抽取顺序仍未知/);
  assert.match(styles, /\.pile-overlay \{[^}]*background: rgba\(16,19,23,\.54\);/);
  assert.match(styles, /\.pile-dialog \{[^}]*background: linear-gradient\(180deg, #f2ecdf, #d8cfbf\);/);
  assert.match(styles, /\.pile-card-grid \.game-card:disabled \{[^}]*cursor: default;[^}]*opacity: 1;[^}]*filter: none;/);
});

test("战场宠物缩小并贴近学生，充能头像尺寸保持独立", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(appSource, /<div class="player-character-stage">[\s\S]*?\$\{renderBattlePet\(\)\}/);
  assert.match(styles, /\.battle-pet \{[^}]*right: -48px;[^}]*transform: scale\(\.82\);[^}]*transform-origin: center bottom;/);
  assert.match(styles, /\.battle-pet \{ right: -36px; bottom: 19px; width: 76px; height: 90px; \}/);
  assert.doesNotMatch(styles, /\.pet-companion-token \{[^}]*transform: scale\(\.82\)/);
});

test("宠物充能入口与能量组合固定在一起，并保留技能详情操作", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.deepEqual(combatEnergyState({ energy: 2, maxEnergy: 4 }), { current: 2, maximum: 4 });
  assert.deepEqual(combatEnergyState({ energy: 4 }), { current: 4, maximum: 4 });
  assert.deepEqual(combatEnergyState({ energy: -2, maxEnergy: -1 }), { current: 0, maximum: 0 });
  assert.match(appSource, /const petChargePercent = Math\.round\(\(game\.pet\.charge \/ Math\.max\(1, game\.pet\.maxCharge\)\) \* 100\)/);
  assert.match(appSource, /<div class="energy-companion-stack">[\s\S]*?<article class="pet-companion-token[\s\S]*?<div class="energy-orb" aria-label="当前能量 \$\{energy\.current\}，本回合上限 \$\{energy\.maximum\}">/);
  assert.match(appSource, /class="energy-orb-value"><b>\$\{energy\.current\}<\/b><i>\/<\/i><strong>\$\{energy\.maximum\}<\/strong>/);
  assert.match(appSource, /style="--pet-charge:\$\{petChargePercent\}%"/);
  assert.match(appSource, /aria-label="[^\"]*\$\{game\.pet\.charge\}\/\$\{game\.pet\.maxCharge\}"/);
  assert.match(appSource, /class="pet-companion-tooltip" role="tooltip"/);
  assert.match(appSource, /class="pet-skill \$\{!petUnavailable \? "ready" : ""\}" data-action="pet-skill"/);
  assert.match(styles, /\.pet-companion-tooltip \{[^}]*position: absolute;[^}]*bottom: calc\(100% \+ 8px\);[^}]*width: min\(350px, calc\(100vw - 32px\)\);/);
});

test("星座与塔罗作为战斗被动图标提供完整可访问说明", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");

  assert.match(appSource, /function combatPassiveTrayHtml\(tarot\)/);
  assert.match(appSource, /class="combat-passive-tray" aria-label="[^"]+"/);
  assert.match(appSource, /class="combat-passive-token sign-token"[^>]*aria-label="[^\"]*\$\{escapeHtml\(archetype\.name\)\}[^\"]*\$\{escapeHtml\(archetype\.text\)\}"/);
  assert.match(appSource, /class="combat-passive-token tarot-token"[^>]*aria-label="[^\"]*\$\{escapeHtml\(tarot\.name\)\}[\s\S]*?\$\{escapeHtml\(tarot\.boon\)\}[\s\S]*?\$\{escapeHtml\(tarot\.cost\)\}"/);
  assert.match(appSource, /class="combat-passive-tooltip" role="tooltip"/);
  assert.match(appSource, /\$\{combatPassiveTrayHtml\(tarot\)\}/);
});

test("卡面采用低圆角暗色金属框架而非高亮玩具样式", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(styles, /\.game-card \{[^}]*border: 3px solid var\(--card-frame\);[^}]*border-radius: 8px;/);
  assert.match(styles, /\.card-name \{[^}]*border-radius: 2px;[^}]*background: linear-gradient\(100deg, #17191a/);
  assert.match(styles, /\.card-cost \{[^}]*border-radius: 50%;[^}]*radial-gradient\(circle at 36% 28%/);
  assert.match(styles, /\.card-cost::before \{[^}]*border-radius: 50%/);
  assert.match(styles, /\.card-cost::after \{ display: none;/);
  assert.match(styles, /\.card-art \{[^}]*height: 124px;[^}]*border-radius: 2px;/);
  assert.match(appSource, /class="card-type-banner"/);
  assert.match(styles, /\.card-type-banner \{[^}]*grid-template-columns: 1fr auto 1fr;[^}]*margin: -18px auto 4px;/);
});

test("战斗手牌按中心生成对称且受限的扇形姿态", () => {
  assert.deepEqual(handCardPose(3, 7), { angle: 0, drop: 0, layer: 4 });
  assert.deepEqual(handCardPose(0, 7), { angle: -4.2, drop: 14, layer: 1 });
  assert.deepEqual(handCardPose(6, 7), { angle: 4.2, drop: 14, layer: 7 });
  assert.equal(handCardPose(0, 20).angle, -6);
  assert.equal(handCardPose(19, 20).angle, 6);
  assert.deepEqual(handCardPose(-5, 1), { angle: 0, drop: 0, layer: 1 });
});

test("已有存档时必须二次确认才能开始新游戏", () => {
  const saved = new SemesterGame(516, "aries").toJSON();

  assert.equal(newGameStartDecision(null), NEW_GAME_START.start);
  assert.equal(newGameStartDecision(saved), NEW_GAME_START.confirm);
  assert.equal(newGameStartDecision(saved, true), NEW_GAME_START.start);
});

test("战败会立即终结战斗检查点并退休本局存档", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /function saveGame\(\) \{\s*if \(game\.combat\?\.status === "lost"\) return;/,
    "战败复盘打开档案等只读页面时也不能把已退休对局重新写回");

  const game = new SemesterGame(517, "cancer");
  game.chooseTarot("strength");
  const pending = game.prepareCombatStart("sleepyBug", "normal", {});
  assert.equal(pending.started, true);
  game.startCombat(pending.enemyId, pending.modifiers);
  game.hp = 0;
  game.checkCombatEnd();
  assert.equal(game.combat.result, "lost");
  assert.notEqual(game.pendingCombatStart, null, "战前检查点在终局持久化前仍存在");

  let clearedRunSaves = 0;
  assert.equal(finalizeCombatPersistence(game.combat.result, {
    completeCheckpoint: () => game.completePendingCombatStart(),
    clearRunSave: () => { clearedRunSaves += 1; }
  }), true);
  assert.equal(game.pendingCombatStart, null);
  assert.equal(game.toJSON().pendingCombatStart, null);
  assert.equal(clearedRunSaves, 1);

  let wonCheckpoints = 0;
  let clearedWonSaves = 0;
  assert.equal(finalizeCombatPersistence("won", {
    completeCheckpoint: () => { wonCheckpoints += 1; },
    clearRunSave: () => { clearedWonSaves += 1; }
  }), true);
  assert.equal(wonCheckpoints, 1);
  assert.equal(clearedWonSaves, 0);

  let activeCallbacks = 0;
  assert.equal(finalizeCombatPersistence("active", {
    completeCheckpoint: () => { activeCallbacks += 1; },
    clearRunSave: () => { activeCallbacks += 1; }
  }), false);
  assert.equal(activeCallbacks, 0);
});

test("只有预计致命的结束回合需要二次确认", () => {
  assert.equal(endTurnDecision(null), END_TURN_ACTION.end);
  assert.equal(endTurnDecision({ lethal: false }), END_TURN_ACTION.end);
  assert.equal(endTurnDecision({ lethal: true }), END_TURN_ACTION.confirm);
  assert.equal(endTurnDecision({ lethal: true }, true), END_TURN_ACTION.end);
});

test("结束回合提示区分安全、可防掉血与无视护甲的致命伤害", () => {
  const idle = endTurnRiskGuidance({
    attackTotal: 0, currentBlock: 0, blocked: 0, attackHpLoss: 0,
    endTurnHpLoss: 0, totalHpLoss: 0, lethal: false
  }, 50);
  assert.equal(idle.state, "safe");
  assert.equal(idle.buttonDetail, "安全");
  assert.match(idle.headline, /安全窗口/);

  const blocked = endTurnRiskGuidance({
    attackTotal: 5, currentBlock: 5, blocked: 5, attackHpLoss: 0,
    endTurnHpLoss: 0, totalHpLoss: 0, lethal: false
  }, 50);
  assert.equal(blocked.state, "safe");
  assert.equal(blocked.buttonDetail, "无伤");
  assert.match(blocked.detail, /5 护甲已挡住 5 点攻击/);

  const exposed = endTurnRiskGuidance({
    attackTotal: 5, currentBlock: 2, blocked: 2, attackHpLoss: 3,
    endTurnHpLoss: 0, totalHpLoss: 3, lethal: false
  }, 50);
  assert.equal(exposed.state, "hit");
  assert.equal(exposed.armorNeeded, 3);
  assert.equal(exposed.headline, "还差 3 护甲可无伤");
  assert.equal(exposed.buttonDetail, "-3 生命");

  const mixed = endTurnRiskGuidance({
    attackTotal: 5, currentBlock: 3, blocked: 3, attackHpLoss: 2,
    endTurnHpLoss: 3, totalHpLoss: 5, lethal: false
  }, 50);
  assert.equal(mixed.armorNeeded, 2);
  assert.match(mixed.detail, /仍会承受 3 点情绪内耗/);
  assert.equal(mixed.buttonDetail, "-5 生命");

  const preventableLethal = endTurnRiskGuidance({
    attackTotal: 5, currentBlock: 0, blocked: 0, attackHpLoss: 5,
    endTurnHpLoss: 0, totalHpLoss: 5, lethal: true
  }, 4);
  assert.equal(preventableLethal.state, "lethal");
  assert.equal(preventableLethal.armorNeeded, 2);
  assert.equal(preventableLethal.headline, "还差 2 护甲才能活下来");

  const unavoidableLethal = endTurnRiskGuidance({
    attackTotal: 0, currentBlock: 99, blocked: 0, attackHpLoss: 0,
    endTurnHpLoss: 4, totalHpLoss: 4, lethal: true
  }, 4);
  assert.equal(unavoidableLethal.state, "lethal");
  assert.equal(unavoidableLethal.armorNeeded, 0);
  assert.match(unavoidableLethal.headline, /情绪内耗将直接击倒/);

  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.doesNotMatch(appSource, /enemyResolution \? enemyResolutionAdviceHtml\(enemyResolution\) : turnRiskAdviceHtml\(turnRisk\)/);
  assert.match(appSource, /enemyIntentTokenHtml\(intent, enemyResolution, intentCounterplayCue\)/);
  assert.match(appSource, /state-\$\{combatInputLocked \? "resolving" : turnRisk\.state\}/);
  assert.match(styles, /\.end-turn\.state-safe/);
});

test("手牌只在斩杀、解除致命或补足无伤时显示极简战术标记", () => {
  const finish = combatCardTacticalCue(
    { healthDamage: 7, block: 0, selfDamage: 0 },
    { totalHpLoss: 0 },
    { enemyHp: 7, playerHp: 30, playable: true }
  );
  assert.deepEqual(finish, {
    tone: "finish",
    label: "可结束战斗",
    detail: "预计造成 7 点生命伤害"
  });
  assert.equal(combatCardTacticalCue(
    { healthDamage: 7, block: 0 },
    { totalHpLoss: 0 },
    { enemyHp: 7, playerHp: 30, playable: false }
  ), null);
  assert.equal(combatCardTacticalCue(
    { healthDamage: 6, block: 0 },
    { totalHpLoss: 0 },
    { enemyHp: 7, playerHp: 30, playable: true }
  ), null);

  const rescue = combatCardTacticalCue(
    { healthDamage: 0, block: 3, selfDamage: 0 },
    { attackTotal: 5, currentBlock: 0, attackHpLoss: 5, endTurnHpLoss: 0, totalHpLoss: 5, lethal: true },
    { enemyHp: 20, playerHp: 4, playable: true }
  );
  assert.deepEqual(rescue, {
    tone: "rescue",
    label: "解除致命",
    detail: "打出后预计剩余 2 生命"
  });

  const guard = combatCardTacticalCue(
    { healthDamage: 0, block: 3, selfDamage: 0 },
    { attackTotal: 5, currentBlock: 2, attackHpLoss: 3, endTurnHpLoss: 0, totalHpLoss: 3, lethal: false },
    { enemyHp: 20, playerHp: 30, playable: true }
  );
  assert.deepEqual(guard, {
    tone: "guard",
    label: "打出后无伤",
    detail: "本回合护甲 +3"
  });

  assert.equal(combatCardTacticalCue(
    { healthDamage: 0, block: 12, selfDamage: 0 },
    { attackTotal: 0, currentBlock: 0, attackHpLoss: 0, endTurnHpLoss: 3, totalHpLoss: 3, lethal: false },
    { enemyHp: 20, playerHp: 30, playable: true }
  ), null, "纯情绪内耗不能被防御牌错误标记为无伤");

  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(appSource, /combatCardTacticalCue\(combatPreview, incomingDamage/);
  assert.match(appSource, /\n\s+tacticalCue,/);
  assert.match(appSource, /class="card-tactical-cue cue-/);
  assert.match(styles, /\.card-tactical-cue\.cue-finish/);
  assert.match(styles, /\.hand \.game-card\.tactical-rescue/);
});

test("解除走神会按真实公式预告本回合可衔接的攻击牌", () => {
  const game = new SemesterGame(901, "cancer");
  game.startCombat("phoneSpirit");
  const clear = game.createCard("airplaneMode");
  const strike = game.createCard("textbookStrike");
  const guard = game.createCard("backpackGuard");
  game.combat.hand = [clear, strike, guard];
  game.combat.drawPile = [];
  game.combat.discardPile = [];
  game.combat.exhaustPile = [];
  game.combat.distracted = true;
  game.combat.energy = 2;
  game.combat.enemy.block = 4;
  game.combat.enemy.hp = 20;
  game.combat.playerBlock = 0;
  game.hp = 48;

  const stateBefore = JSON.stringify(game.toJSON());
  const projection = game.clearDistractedFollowupPreview(clear);
  assert.deepEqual(projection, {
    cardUid: strike.uid,
    cardId: "textbookStrike",
    cardName: "课本拍击",
    cardCost: 1,
    remainingEnergy: 1,
    damagePerHitBefore: 3,
    damagePerHitAfter: 5,
    hits: 1,
    attackTotalBefore: 3,
    attackTotalAfter: 5,
    enemyBlockAbsorbedBefore: 3,
    enemyBlockAbsorbedAfter: 4,
    healthDamageBefore: 0,
    healthDamageAfter: 1,
    followupSelfDamage: 0,
    attackGain: 2,
    lethalBefore: false,
    lethalAfter: false,
    attackCount: 1
  });
  assert.equal(JSON.stringify(game.toJSON()), stateBefore, "双预览不能消耗能量、随机数或一次性攻击加成");

  const incoming = {
    perHit: 8, hits: 1, attackTotal: 8, currentBlock: 0,
    attackHpLoss: 8, endTurnHpLoss: 0, totalHpLoss: 8, lethal: false
  };
  assert.deepEqual(combatCardTacticalCue(game.cardEffectPreview(clear), incoming, {
    enemyHp: game.combat.enemy.hp,
    playerHp: game.hp,
    playable: true,
    distractedFollowup: projection
  }), {
    tone: "counter",
    label: "解除走神 · 可接攻击",
    detail: "移除当前走神；打出后剩余 1 能量，可接「课本拍击」（1费）：伤害 3→5，击破护甲 3→4，敌人掉血 0→1"
  });
  assert.deepEqual(combatCardTacticalCue(game.cardEffectPreview(clear), { ...incoming, lethal: true }, {
    enemyHp: game.combat.enemy.hp,
    playerHp: 4,
    playable: true,
    distractedFollowup: projection
  }), {
    tone: "rescue",
    label: "解除致命",
    detail: "打出后预计剩余 1 生命"
  }, "清理牌自身能脱险时，生存提示必须高于进攻衔接");
  assert.equal(combatCardTacticalCue(game.cardEffectPreview(clear), {
    ...incoming, attackTotal: 12, attackHpLoss: 12, totalHpLoss: 12, lethal: true
  }, {
    enemyHp: game.combat.enemy.hp,
    playerHp: 4,
    playable: true,
    distractedFollowup: projection
  }), null, "清理与后续攻击都不能结束战斗时，不得用正向提示盖住致命风险");
  const finishingProjection = { ...projection, healthDamageAfter: 1, lethalAfter: true };
  assert.deepEqual(combatCardTacticalCue(game.cardEffectPreview(clear), {
    ...incoming, attackTotal: 12, attackHpLoss: 12, totalHpLoss: 12, lethal: true
  }, {
    enemyHp: 1,
    playerHp: 4,
    playable: true,
    distractedFollowup: finishingProjection
  }), {
    tone: "finish",
    label: "解除走神 · 可接斩杀",
    detail: "移除当前走神；打出后剩余 1 能量，可接「课本拍击」（1费）：伤害 3→5，击破护甲 3→4，敌人掉血 0→1，可结束战斗"
  }, "若恢复的伤害能结束战斗，应明确给出两牌斩杀路线");
  assert.equal(combatCardTacticalCue(game.cardEffectPreview(clear), {
    ...incoming, attackTotal: 0, attackHpLoss: 0, totalHpLoss: 0, lethal: false
  }, {
    enemyHp: 1,
    playerHp: 4,
    playable: true,
    distractedFollowup: { ...finishingProjection, followupSelfDamage: 4 }
  }), null, "会令玩家倒下的自伤攻击不能标记为可接斩杀");
  assert.equal(combatCardTacticalCue({ ...game.cardEffectPreview(clear), block: 0 }, {
    ...incoming, attackTotal: 0, attackHpLoss: 0, endTurnHpLoss: 4, totalHpLoss: 4, lethal: false
  }, {
    enemyHp: 20,
    playerHp: 6,
    playable: true,
    distractedFollowup: { ...projection, followupSelfDamage: 2 }
  }), null, "攻击牌自伤后会被回合末损失击倒时，不能显示正向衔接提示");

  assert.deepEqual(game.playCard(clear.uid), { ok: true });
  const restored = game.cardEffectPreview(strike);
  assert.equal(restored.damagePerHit, projection.damagePerHitAfter);
  assert.equal(restored.healthDamage, projection.healthDamageAfter);
  assert.deepEqual(game.playCard(strike.uid), { ok: true });
  assert.equal(game.combat.enemy.block, 0);
  assert.equal(game.combat.enemy.hp, 19);

  const complex = new SemesterGame(902, "aries");
  complex.addItem("autoPencil");
  complex.startCombat("phoneSpirit");
  const complexClear = complex.createCard("airplaneMode");
  const combo = complex.createCard("catCombo");
  complex.combat.hand = [complexClear, complex.createCard("textbookStrike"), combo, complex.createCard("lendAHand")];
  complex.combat.distracted = true;
  complex.combat.energy = 2;
  complex.combat.enemy.block = 6;
  complex.combat.enemy.hp = 100;
  complex.combat.attackBonus = 1;
  complex.combat.doubleNextAttack = true;
  const complexBefore = JSON.stringify(complex.toJSON());
  const complexProjection = complex.clearDistractedFollowupPreview(complexClear);
  assert.equal(complexProjection.cardUid, combo.uid, "多段牌应按真实总增益成为最佳衔接");
  assert.deepEqual({
    perHitBefore: complexProjection.damagePerHitBefore,
    perHitAfter: complexProjection.damagePerHitAfter,
    hits: complexProjection.hits,
    totalBefore: complexProjection.attackTotalBefore,
    totalAfter: complexProjection.attackTotalAfter,
    healthBefore: complexProjection.healthDamageBefore,
    healthAfter: complexProjection.healthDamageAfter,
    gain: complexProjection.attackGain
  }, { perHitBefore: 5, perHitAfter: 7, hits: 4, totalBefore: 20, totalAfter: 28, healthBefore: 14, healthAfter: 22, gain: 8 });
  assert.equal(JSON.stringify(complex.toJSON()), complexBefore);
  assert.deepEqual(complex.playCard(complexClear.uid), { ok: true });
  const complexRestored = complex.cardEffectPreview(combo);
  assert.deepEqual({
    perHit: complexRestored.damagePerHit,
    hits: complexRestored.hits,
    total: complexRestored.attackTotal,
    health: complexRestored.healthDamage
  }, { perHit: 7, hits: 4, total: 28, health: 22 });
  assert.equal(complex.combat.archetypeAttackUsed, false);
  assert.equal(complex.combat.pencilUsed, false);
  assert.equal(complex.combat.doubleNextAttack, true);

  const safeFallback = new SemesterGame(904, "cancer");
  safeFallback.hp = 2;
  safeFallback.startCombat("phoneSpirit");
  const safeClear = safeFallback.createCard("airplaneMode");
  const unsafeAttack = safeFallback.createCard("stubborn");
  const safeAttack = safeFallback.createCard("textbookStrike");
  safeFallback.combat.hand = [safeClear, unsafeAttack, safeAttack];
  safeFallback.combat.distracted = true;
  safeFallback.combat.energy = 3;
  safeFallback.combat.enemy.block = 0;
  safeFallback.combat.enemy.hp = 100;
  assert.equal(safeFallback.clearDistractedFollowupPreview(safeClear).cardUid, safeAttack.uid,
    "高收益自伤牌会让玩家归零时，必须回退到安全攻击牌");

  const quick = new SemesterGame(903, "gemini");
  quick.startCombat("phoneSpirit");
  const quickClear = quick.createCard("airplaneMode");
  quickClear.enchantment = "geminiQuick";
  const quickStrike = quick.createCard("textbookStrike");
  quick.combat.hand = [quickClear, quickStrike];
  quick.combat.distracted = true;
  quick.combat.energy = 1;
  assert.equal(quick.clearDistractedFollowupPreview(quickClear).cardUid, quickStrike.uid, "瞬思后的有效费用必须用于衔接判断");
  quickClear.enchantment = null;
  quickStrike.enchantment = "geminiQuick";
  assert.equal(quick.clearDistractedFollowupPreview(quickClear).cardUid, quickStrike.uid, "后续攻击牌的瞬思费用也必须参与衔接判断");
  quickStrike.enchantment = null;
  assert.equal(quick.clearDistractedFollowupPreview(quickClear), null, "支付清理牌后能量不足时不能虚报衔接");
  quickClear.enchantment = "geminiQuick";
  quick.combat.hand = [quickClear, quick.createCard("lendAHand")];
  assert.equal(quick.clearDistractedFollowupPreview(quickClear), null, "有伤害的技能不受走神影响，不能算攻击牌");
  quick.combat.distracted = false;
  assert.equal(quick.clearDistractedFollowupPreview(quickClear), null);

  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /game\.clearDistractedFollowupPreview\(card\)/);
  assert.match(appSource, /distractedFollowup/);
  assert.match(appSource, /\.\.\.\(distractedCleared \? \["移除走神"\] : \[\]\)/);
});

test("自伤让双方同时归零时仍按玩家战败结算", () => {
  const game = new SemesterGame(905, "cancer");
  game.startCombat("sleepyBug");
  const stubborn = game.createCard("stubborn");
  game.combat.hand = [stubborn];
  game.combat.energy = 2;
  game.combat.enemy.block = 0;
  game.combat.enemy.hp = 12;
  game.hp = 2;

  assert.equal(combatCardTacticalCue(game.cardEffectPreview(stubborn), game.incomingDamagePreview(), {
    enemyHp: 12,
    playerHp: 2,
    playable: true
  }), null, "会让自己归零的攻击不能标记为可结束战斗");
  assert.deepEqual(game.playCard(stubborn.uid), { ok: true });
  assert.equal(game.combat.enemy.hp, 0);
  assert.equal(game.hp, 0);
  assert.equal(game.combat.result, "lost");
  assert.equal(game.stats.combatsWon, 0);
});

test("清空待办会在出牌前准确预告群聊轰炸减段与生命结果", () => {
  const intent = {
    scaling: { type: "statusHits", statusId: "nervous" },
    mechanicState: { type: "statusHits", value: 2, cap: 2, sourceCount: 2 }
  };
  assert.equal(combatMechanicStatusCleared(
    { statusCount: 2 },
    intent,
    [{ id: "nervous" }, { id: "todo" }]
  ), 1, "全部状态预览中只有手牌里的紧张能降低未读压力");
  assert.equal(combatMechanicStatusCleared(
    { statusCount: 0 },
    intent,
    [{ id: "nervous" }]
  ), 0, "不清理状态的牌不能借用手牌紧张生成机制提示");
  assert.equal(combatMechanicStatusCleared(
    { statusCount: 1 },
    { scaling: { type: "enemyBlockAttack", statusId: "nervous" } },
    [{ id: "nervous" }]
  ), 0, "非状态段数机制不能生成群聊反制提示");
  assert.equal(combatMechanicStatusCleared(
    { statusCount: 1 },
    intent,
    []
  ), 0, "抽牌堆和弃牌堆的紧张不会被误算为本次手牌清理");

  const fourHitIncoming = {
    perHit: 3,
    hits: 4,
    attackTotal: 12,
    currentBlock: 0,
    attackHpLoss: 12,
    endTurnHpLoss: 0,
    totalHpLoss: 12,
    lethal: false
  };
  const noDamage = combatCardTacticalCue(
    { healthDamage: 0, block: 7, selfDamage: 0, statusCount: 2 },
    fourHitIncoming,
    {
      enemyHp: 20,
      playerHp: 30,
      playable: true,
      mechanicState: intent.mechanicState,
      mechanicStatusCleared: 2,
      mechanicStatusName: "紧张"
    }
  );
  assert.deepEqual(noDamage, {
    tone: "guard",
    label: "轰炸 4→2段 · 无伤",
    detail: "清理 2 张紧张：轰炸从 4 段降至 2 段，打出后无伤"
  });

  const rescued = combatCardTacticalCue(
    { healthDamage: 0, block: 7, selfDamage: 0, statusCount: 2 },
    { ...fourHitIncoming, lethal: true },
    {
      enemyHp: 20,
      playerHp: 8,
      playable: true,
      mechanicState: intent.mechanicState,
      mechanicStatusCleared: 2,
      mechanicStatusName: "紧张"
    }
  );
  assert.deepEqual(rescued, {
    tone: "rescue",
    label: "轰炸 4→2段 · 脱险",
    detail: "清理 2 张紧张：轰炸从 4 段降至 2 段，解除致命，预计剩余 8 生命"
  });

  const onePressure = { type: "statusHits", value: 1, cap: 2, sourceCount: 1 };
  const threeHitIncoming = { ...fourHitIncoming, hits: 3, attackTotal: 9, attackHpLoss: 9, totalHpLoss: 9 };
  assert.deepEqual(combatCardTacticalCue(
    { healthDamage: 0, block: 5, selfDamage: 0, statusCount: 1 },
    threeHitIncoming,
    {
      enemyHp: 20,
      playerHp: 30,
      playable: true,
      mechanicState: onePressure,
      mechanicStatusCleared: 1,
      mechanicStatusName: "紧张"
    }
  ), {
    tone: "counter",
    label: "轰炸 3→2段 · -1生命",
    detail: "清理 1 张紧张：轰炸从 3 段降至 2 段，预计损失 1 生命"
  });
  assert.deepEqual(combatCardTacticalCue(
    { healthDamage: 0, block: 5, selfDamage: 0, statusCount: 1 },
    { ...threeHitIncoming, lethal: true },
    {
      enemyHp: 20,
      playerHp: 1,
      playable: true,
      mechanicState: onePressure,
      mechanicStatusCleared: 1,
      mechanicStatusName: "紧张"
    }
  ), {
    tone: "danger",
    label: "轰炸 3→2段 · 仍致命",
    detail: "清理 1 张紧张：轰炸从 3 段降至 2 段，仍会致命，预计损失 1 生命"
  });

  const saturatedPressure = { type: "statusHits", value: 2, cap: 2, sourceCount: 4 };
  assert.equal(combatCardTacticalCue(
    { healthDamage: 0, block: 0, selfDamage: 0, statusCount: 1 },
    fourHitIncoming,
    {
      enemyHp: 20,
      playerHp: 30,
      playable: true,
      mechanicState: saturatedPressure,
      mechanicStatusCleared: 1,
      mechanicStatusName: "紧张"
    }
  ), null, "未跨过压力上限时不能虚假显示减段");
  assert.deepEqual(combatCardTacticalCue(
    { healthDamage: 0, block: 0, selfDamage: 0, statusCount: 3 },
    fourHitIncoming,
    {
      enemyHp: 20,
      playerHp: 30,
      playable: true,
      mechanicState: saturatedPressure,
      mechanicStatusCleared: 3,
      mechanicStatusName: "紧张"
    }
  ), {
    tone: "counter",
    label: "轰炸 4→3段 · -9生命",
    detail: "清理 3 张紧张：轰炸从 4 段降至 3 段，预计损失 9 生命"
  });

  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(appSource, /combatMechanicStatusCleared\(combatPreview, intent, combat\.hand\)/);
  assert.match(appSource, /mechanicState: intent\.mechanicState/);
  assert.match(appSource, /aria-hidden="true"><b>\$\{escapeHtml\(tacticalCue\.label\)\}<\/b><\/span><span class="sr-only card-tactical-description">\$\{escapeHtml\(tacticalCue\.detail\)\}/);
  assert.match(styles, /\.card-tactical-cue\.cue-counter/);
  assert.match(styles, /\.hand \.game-card\.tactical-counter/);
  assert.match(styles, /\.card-tactical-cue\.cue-danger/);
  assert.match(styles, /\.hand \.game-card\.tactical-danger/);
  assert.match(styles, /\.card-tactical-cue \{[^}]*max-width: calc\(100% - 16px\);[^}]*text-overflow: ellipsis;/);
});

test("击破打印机护甲会按真实断点预告重击降伤与生存结果", () => {
  const mechanicState = { type: "enemyBlockAttack", value: 6, cap: 6, sourceCount: 8 };
  const incoming = {
    perHit: 12,
    hits: 1,
    attackTotal: 12,
    currentBlock: 0,
    attackHpLoss: 12,
    endTurnHpLoss: 0,
    totalHpLoss: 12,
    lethal: true
  };

  assert.equal(combatEnemyBlockAttackProjection(
    { enemyBlockAbsorbed: 2 },
    incoming,
    mechanicState
  ), null, "8 点护甲只打掉 2 点时仍处于 +6 上限，不能虚报降伤");
  assert.deepEqual(combatEnemyBlockAttackProjection(
    { enemyBlockAbsorbed: 5 },
    incoming,
    mechanicState
  ), {
    blockBroken: 5,
    sourceBefore: 8,
    sourceAfter: 3,
    bonusBefore: 6,
    bonusAfter: 3,
    bonusReduced: 3,
    perHitBefore: 12,
    perHitAfter: 9,
    hits: 1,
    attackTotalAfter: 9
  });
  assert.equal(combatEnemyBlockAttackProjection(
    { enemyBlockAbsorbed: 5 },
    incoming,
    { type: "statusHits", value: 2, cap: 2, sourceCount: 2 }
  ), null, "其他敌人机制不能生成打印机重击预告");

  const challengeProjection = combatEnemyBlockAttackProjection(
    { enemyBlockAbsorbed: 5 },
    { ...incoming, perHit: 15, attackTotal: 15, totalHpLoss: 15 },
    mechanicState
  );
  assert.equal(challengeProjection.perHitAfter, 12, "挑战倍率只影响基础伤害，蓄压减少量不能再次乘倍率");

  const cardPreview = {
    healthDamage: 0,
    block: 0,
    selfDamage: 0,
    enemyBlockAbsorbed: 5
  };
  assert.deepEqual(combatCardTacticalCue(cardPreview, incoming, {
    enemyHp: 32,
    playerHp: 10,
    playable: true,
    mechanicState
  }), {
    tone: "rescue",
    label: "重击 12→9 · 脱险",
    detail: "击破 5 点护甲：敌方护甲从 8 降至 3，蓄压 +6→+3，重击从 12 降至 9，解除致命，预计剩余 1 生命"
  });
  assert.deepEqual(combatCardTacticalCue(cardPreview, { ...incoming, lethal: false }, {
    enemyHp: 32,
    playerHp: 30,
    playable: true,
    mechanicState
  }), {
    tone: "counter",
    label: "重击 12→9 · -9生命",
    detail: "击破 5 点护甲：敌方护甲从 8 降至 3，蓄压 +6→+3，重击从 12 降至 9，敌方行动预计造成 9 点生命损失"
  });
  assert.deepEqual(combatCardTacticalCue(cardPreview, {
    ...incoming,
    currentBlock: 9,
    attackHpLoss: 3,
    totalHpLoss: 3,
    lethal: false
  }, {
    enemyHp: 32,
    playerHp: 30,
    playable: true,
    mechanicState
  }), {
    tone: "guard",
    label: "重击 12→9 · 无伤",
    detail: "击破 5 点护甲：敌方护甲从 8 降至 3，蓄压 +6→+3，重击从 12 降至 9，打出后无伤"
  });
  assert.deepEqual(combatCardTacticalCue({ ...cardPreview, selfDamage: 3 }, incoming, {
    enemyHp: 32,
    playerHp: 12,
    playable: true,
    mechanicState
  }), {
    tone: "danger",
    label: "重击 12→9 · 仍致命",
    detail: "击破 5 点护甲：敌方护甲从 8 降至 3，蓄压 +6→+3，重击从 12 降至 9，仍会致命，预计合计损失 12 生命（卡牌自伤 3，敌方行动 9）"
  });
  assert.deepEqual(combatCardTacticalCue({ ...cardPreview, healthDamage: 1 }, incoming, {
    enemyHp: 1,
    playerHp: 10,
    playable: true,
    mechanicState
  }), {
    tone: "finish",
    label: "可结束战斗",
    detail: "预计造成 1 点生命伤害"
  }, "斩杀提示必须优先于已经不会发生的敌方重击");
  assert.equal(combatCardTacticalCue(cardPreview, incoming, {
    enemyHp: 32,
    playerHp: 10,
    playable: false,
    mechanicState
  }), null, "无法支付的卡牌不能显示反制提示");

  const integration = new SemesterGame(224, "cancer");
  integration.startCombat("printerJam");
  integration.endTurn();
  integration.hp = 10;
  const strike = integration.createCard("textbookStrike");
  integration.combat.hand = [strike];
  integration.combat.drawPile = [];
  integration.combat.discardPile = [];
  const stateBeforePreview = JSON.stringify(integration.toJSON());
  const strikePreview = integration.cardEffectPreview(strike);
  const strikeIntent = integration.getIntent();
  const strikeIncoming = integration.incomingDamagePreview();
  const strikeCue = combatCardTacticalCue(strikePreview, strikeIncoming, {
    enemyHp: integration.combat.enemy.hp,
    playerHp: integration.hp,
    playable: integration.canPlay(strike).ok,
    mechanicState: strikeIntent.mechanicState
  });
  assert.equal(JSON.stringify(integration.toJSON()), stateBeforePreview, "重击投影必须保持存档与随机数状态只读");
  assert.equal(strikePreview.enemyBlockAbsorbed, 5);
  assert.equal(strikeCue.label, "重击 12→9 · 脱险");
  integration.playCard(strike.uid);
  assert.equal(integration.combat.enemy.block, 3);
  assert.equal(integration.getIntent().attack, 9);
  const resolved = integration.endTurn().enemyResult;
  assert.equal(resolved.attack.perHit, 9);
  assert.equal(integration.hp, 1, "预告的剩余生命必须与真实结算一致");
});

test("卡面只在实时数值确实变化时显示紧凑预览", () => {
  assert.equal(shouldShowCombatCardPreview(null), false);
  assert.equal(shouldShowCombatCardPreview({
    hasDamage: true, attackTotal: 5, healthDamage: 5, modifiers: []
  }), false);
  assert.equal(shouldShowCombatCardPreview({
    hasDamage: false, attackTotal: 0, healthDamage: 0, modifiers: []
  }), false);
  assert.equal(shouldShowCombatCardPreview({
    hasDamage: true, attackTotal: 7, healthDamage: 7, modifiers: ["白羊首击 +2"]
  }), true);
  assert.equal(shouldShowCombatCardPreview({
    hasDamage: true, attackTotal: 5, healthDamage: 1, modifiers: []
  }), true);
});

test("战斗快捷键只在当前交互层可用，并正确映射手牌与操作", () => {
  assert.deepEqual(combatShortcutCommand("Digit1", { cardCount: 5 }), {
    action: COMBAT_SHORTCUT_ACTION.playCard,
    cardIndex: 0
  });
  assert.deepEqual(combatShortcutCommand("Numpad5", { cardCount: 5 }), {
    action: COMBAT_SHORTCUT_ACTION.playCard,
    cardIndex: 4
  });
  assert.equal(combatShortcutCommand("Digit6", { cardCount: 5 }), null);
  assert.deepEqual(combatShortcutCommand("KeyG"), { action: COMBAT_SHORTCUT_ACTION.petSkill });
  assert.deepEqual(combatShortcutCommand("KeyE"), { action: COMBAT_SHORTCUT_ACTION.endTurn });

  assert.deepEqual(combatShortcutCommand("Digit2", { cardCount: 3, pendingDiscard: true }), {
    action: COMBAT_SHORTCUT_ACTION.discardCard,
    cardIndex: 1
  });
  assert.equal(combatShortcutCommand("KeyE", { pendingDiscard: true }), null);
  assert.equal(combatShortcutCommand("KeyG", { pendingDiscard: true }), null);

  assert.deepEqual(combatShortcutCommand("Escape", { lethalConfirmOpen: true }), {
    action: COMBAT_SHORTCUT_ACTION.cancelLethalEndTurn
  });
  assert.equal(combatShortcutCommand("KeyE", { lethalConfirmOpen: true }), null);
  assert.deepEqual(combatShortcutCommand("Escape", { pileOpen: true }), {
    action: COMBAT_SHORTCUT_ACTION.closePile
  });
  assert.deepEqual(combatShortcutCommand("Escape", { intentDetailsOpen: true }), {
    action: COMBAT_SHORTCUT_ACTION.closeIntentDetails
  });
  assert.deepEqual(combatShortcutCommand("Escape", {
    lethalConfirmOpen: true,
    pileOpen: true,
    intentDetailsOpen: true
  }), { action: COMBAT_SHORTCUT_ACTION.cancelLethalEndTurn });
  assert.equal(combatShortcutCommand("Digit1", { cardCount: 3, pileOpen: true }), null);
  assert.equal(combatShortcutCommand("Digit1", { cardCount: 3, tutorialOpen: true }), null);
  assert.equal(combatShortcutCommand("Digit1", { cardCount: 3, resolvingEnemy: true }), null);
  assert.equal(combatShortcutCommand("KeyG", { resolvingEnemy: true }), null);
  assert.equal(combatShortcutCommand("KeyE", { resolvingEnemy: true }), null);
});

test("敌人意图说明按真实字段展开每段攻击、走神和状态牌去向", () => {
  assert.deepEqual(enemyIntentDetailLines({
    attack: 3,
    hits: 2,
    block: 4,
    debuff: "distracted",
    addStatus: { id: "nervous", count: 1, zone: "draw" }
  }, (id) => CARD_DEFS[id]?.name || id), [
    "每段 3 点伤害，共 2 段（合计 6 点）",
    "获得 4 点护甲",
    "施加走神：下回合你的攻击每段 -2",
    "将 1 张「紧张」加入抽牌堆"
  ]);
  assert.deepEqual(enemyIntentDetailLines({
    addStatus: { id: "todo", count: 2, zone: "discard" }
  }, (id) => CARD_DEFS[id]?.name || id), ["将 2 张「待办」加入弃牌堆"]);
  assert.deepEqual(enemyIntentDetailLines({ attack: 7 }), ["造成 7 点伤害"]);
  assert.deepEqual(enemyIntentDetailLines({
    attack: 12,
    mechanicState: { type: "enemyBlockAttack", value: 6, cap: 6, sourceCount: 8 }
  }), [
    "造成 12 点伤害",
    "当前 8 点护甲使重击 +6；再击破 3 点，伤害才会下降 1"
  ]);
  for (const [armor, hitsToBreakpoint] of [[8, 3], [7, 2]]) {
    assert.match(enemyIntentDetailLines({
      mechanicState: { type: "enemyBlockAttack", value: 6, cap: 6, sourceCount: armor }
    })[0], new RegExp(`再击破 ${hitsToBreakpoint} 点`));
  }
  assert.match(enemyIntentDetailLines({
    mechanicState: { type: "enemyBlockAttack", value: 6, cap: 6, sourceCount: 6 }
  })[0], /每击破 1 点，伤害降低 1/);
  assert.match(enemyIntentDetailLines({
    mechanicState: { type: "enemyBlockAttack", value: 5, cap: 6, sourceCount: 5 }
  })[0], /每击破 1 点，伤害降低 1/);
  assert.match(enemyIntentDetailLines({
    mechanicState: { type: "enemyBlockAttack", value: 0, cap: 6, sourceCount: 0 }
  })[0], /蓄压额外伤害已解除/);

  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(appSource, /role="tooltip"/);
  assert.match(appSource, /aria-controls="enemy-intent-details"/);
  assert.match(appSource, /aria-label="敌人意图：\$\{escapeHtml\(name\)\}"/);
  assert.match(appSource, /enemyDefinition\?\.pattern/);
  assert.match(appSource, /intentDetailsOpen: context\.intentDetailsPinned === true/);
  assert.match(styles, /\.enemy-intent-token:not\(\.is-dismissed\):is\(:hover, :focus-visible, \.is-pinned\) \.enemy-intent-detail/);
  assert.match(appSource, /command\.action === COMBAT_SHORTCUT_ACTION\.closeIntentDetails[\s\S]*?setIntentDetailsOpen\(token, false\)/);
  assert.match(styles, /\.enemy-intent-token:focus-visible \.enemy-intent-chips/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.enemy-intent-token \{[^}]*left: 0;[^}]*width: 62%;[^}]*transform: none;/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.enemy-intent-detail \{[^}]*position: fixed;[^}]*right: 10px;[^}]*bottom: max\(10px, env\(safe-area-inset-bottom\)\);[^}]*left: 10px;/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.enemy-intent-detail::after \{[^}]*display: none;/);
  assert.match(appSource, /context\.intentDetailsDismissed = !open;/);
  assert.match(appSource, /app\.addEventListener\("pointerout"/);
});

test("敌方行动结算阶段短暂隔离输入，并尊重减少动态效果设置", () => {
  assert.equal(ENEMY_RESOLVE_MS, 700);
  assert.equal(ENEMY_EXTRA_HIT_RESOLVE_MS, 180);
  assert.equal(enemyResolveDuration(false), 700);
  assert.equal(enemyResolveDuration(false, 2), 880);
  assert.equal(enemyResolveDuration(false, 9), 1240);
  assert.equal(enemyResolveDuration(true), 0);

  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(appSource, /combatInputLocked: locksCombatInput/);
  assert.match(appSource, /combatLockId: locksCombatInput \? feedback\.id : null/);
  const enemyUnlockCallback = appSource.match(/battleInputTimer = window\.setTimeout\(\(\) => \{([\s\S]*?)\}, resolveMs\);/)?.[1] || "";
  assert.match(enemyUnlockCallback, /context\.combatLockId !== feedback\.id/);
  assert.doesNotMatch(enemyUnlockCallback, /context\.battleFeedback/, "输入解锁不能依赖可能先被清理的视觉反馈");
  assert.match(appSource, /Math\.max\(1150, resolveMs \+ 120\)/);
  assert.match(appSource, /aria-busy="\$\{combatInputLocked\}"/);
  assert.match(appSource, /敌方行动结算中/);
  assert.match(styles, /\.enemy-resolve-phase/);
  assert.match(styles, /\.combat-page\[aria-busy="true"\]/);
});

test("敌方结算阶段冻结本次行动与实际结果，不提前显示下一意图", () => {
  assert.deepEqual(enemyResolutionSnapshot({
    turn: 2,
    name: "消息轰炸",
    detail: "攻击 3×2",
    incoming: { perHit: 3, hits: 2, currentBlock: 4 }
  }, {
    playerDamage: 2,
    summaryParts: ["生命 -2", "护甲挡下 4"]
  }), {
    turn: 2,
    name: "消息轰炸",
    detail: "攻击 3×2",
    result: "生命 -2 · 护甲挡下 4",
    tone: "danger",
    hitBreakdown: [
      { index: 1, blocked: 3, hpLoss: 0, blockAfter: 1 },
      { index: 2, blocked: 1, hpLoss: 2, blockAfter: 0 }
    ],
    effects: [],
    mechanicState: null
  });
  assert.equal(enemyResolutionSnapshot(null, {}), null);
  assert.equal(enemyResolutionSnapshot({ name: "蜷成一团" }, {
    playerDamage: 0,
    summaryParts: ["敌方护甲 +5"]
  }).tone, "safe");

  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(appSource, /function enemyIntentTokenHtml\(intent, resolution = null, counterplayCue = null\)/);
  assert.match(appSource, /enemyIntentTokenHtml\(intent, enemyResolution, intentCounterplayCue\)/);
  assert.match(appSource, /enemyHitPulseHtml\(enemyResolution\.hitBreakdown\)/);
  assert.match(styles, /\.enemy-intent-token\.state-safe/);
  assert.match(styles, /\.end-turn\.state-resolving/);
  assert.match(styles, /\.enemy-hit-step\.hit-damage/);
});

test("敌方非伤害行动返回真实结果，并区分施加、加入与物品抵挡", () => {
  const distracted = new SemesterGame(560, "cancer");
  distracted.startCombat("phoneSpirit");
  const distractedResult = distracted.endTurn().enemyResult;
  assert.deepEqual(distractedResult.debuff, { id: "distracted", applied: true, blockedBy: null });
  assert.equal(distracted.combat.distracted, true);

  const protectedGame = new SemesterGame(561, "cancer");
  protectedGame.items = ["earplugs"];
  protectedGame.startCombat("phoneSpirit");
  const protectedResult = protectedGame.endTurn().enemyResult;
  assert.deepEqual(protectedResult.debuff, { id: "distracted", applied: false, blockedBy: "earplugs" });
  assert.equal(protectedGame.combat.distracted, false);

  const statusGame = new SemesterGame(562, "cancer");
  statusGame.startCombat("groupChat");
  statusGame.combat.enemy.intentTurn = 1;
  const statusResult = statusGame.endTurn().enemyResult;
  assert.deepEqual(statusResult.statusAdded, { id: "nervous", count: 1, zone: "discard" });
  assert.equal(statusGame.combat.discardPile.some((card) => card.id === "nervous"), true);

  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(appSource, /function enemyActionEffects\(result, statusPlacements = \[\]\)/);
  assert.match(appSource, /effectParts: actualEffects\.map/);
  assert.match(appSource, /enemyIntentTokenHtml\(intent, enemyResolution, intentCounterplayCue\)/);
  assert.match(styles, /\.enemy-intent-token\.state-safe/);
});

test("多段敌方攻击逐段消耗护甲并标出开始掉血的位置", () => {
  assert.deepEqual(enemyHitBreakdown({ perHit: 3, hits: 2, currentBlock: 4 }), [
    { index: 1, blocked: 3, hpLoss: 0, blockAfter: 1 },
    { index: 2, blocked: 1, hpLoss: 2, blockAfter: 0 }
  ]);
  assert.deepEqual(enemyHitBreakdown({ perHit: 4, hits: 2, currentBlock: 10 }), [
    { index: 1, blocked: 4, hpLoss: 0, blockAfter: 6 },
    { index: 2, blocked: 4, hpLoss: 0, blockAfter: 2 }
  ]);
  assert.deepEqual(enemyHitBreakdown({ perHit: 0, hits: 2, currentBlock: 10 }), []);
});

test("逐段冲击按真实结果错峰播放并区分护盾与掉血", () => {
  assert.deepEqual(enemyHitPulseSequence([
    { index: 1, blocked: 3, hpLoss: 0 },
    { index: 2, blocked: 1, hpLoss: 2 }
  ]), [
    { index: 1, delay: 0, tone: "blocked", label: "挡 3" },
    { index: 2, delay: 180, tone: "damage", label: "-2" }
  ]);
  assert.deepEqual(enemyHitPulseSequence(null), []);

  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(appSource, /enemyHitPulseHtml\(enemyResolution\.hitBreakdown\)/);
  assert.match(appSource, /--hit-delay:\$\{pulse\.delay\}ms/);
  assert.match(styles, /@keyframes enemy-hit-pulse/);
  assert.match(styles, /\.enemy-hit-pulse\.pulse-damage/);
  assert.match(styles, /\.enemy-hit-pulse-layer \{ display: none; \}/);
});

test("学生初始卡组为 10 张，结构是 4 攻 4 防 2 特性牌", () => {
  const game = new SemesterGame(1);
  assert.equal(game.deck.length, 10);
  assert.deepEqual(game.deck.map((card) => card.id), STARTING_DECK);
  assert.equal(game.deck.filter((card) => card.id === "textbookStrike").length, 4);
  assert.equal(game.deck.filter((card) => card.id === "backpackGuard").length, 4);
});

test("攻击牌消耗能量、造成明确伤害，并且每回合最多为宠物充能一次", () => {
  const game = new SemesterGame(2);
  game.startCombat("sleepyBug");
  const first = putCardInHand(game, "textbookStrike");
  game.combat.energy = 3;

  assert.equal(game.playCard(first.uid).ok, true);
  assert.equal(game.combat.enemy.hp, 15);
  assert.equal(game.combat.energy, 2);
  assert.equal(game.pet.charge, 1);

  const second = { ...game.deck.filter((card) => card.id === "textbookStrike")[1] };
  game.combat.hand.push(second);
  game.playCard(second.uid);
  assert.equal(game.pet.charge, 1);
});

test("战斗记录当前回合能量上限，出牌后仍可显示当前值与上限", () => {
  const game = new SemesterGame(301, "cancer");
  game.startCombat("sleepyBug");
  assert.equal(game.combat.energy, 3);
  assert.equal(game.combat.maxEnergy, 3);

  const attack = game.combat.hand.find((card) => CARD_DEFS[card.id].type === "attack");
  assert.equal(game.playCard(attack.uid).ok, true);
  assert.equal(game.combat.energy, 2);
  assert.equal(game.combat.maxEnergy, 3);

  game.items = ["allNighter"];
  game.endTurn();
  assert.equal(game.combat.energy, 4);
  assert.equal(game.combat.maxEnergy, 4);
});

test("护甲抵挡敌人攻击，并在下一个玩家回合清空", () => {
  const game = new SemesterGame(3);
  game.startCombat("sleepyBug");
  const guard = putCardInHand(game, "backpackGuard");
  game.combat.energy = 3;
  game.playCard(guard.uid);
  assert.equal(game.combat.playerBlock, 9);

  game.endTurn();
  assert.equal(game.hp, 50);
  assert.equal(game.combat.playerBlock, 0);
  assert.equal(game.combat.turn, 2);
});

test("结束回合预览会合并多段攻击、当前护甲与无视护甲损失", () => {
  const game = new SemesterGame(547, "gemini");
  game.startCombat("groupChat");
  game.combat.playerBlock = 4;
  game.combat.endTurnHpLoss = 3;
  const preview = game.incomingDamagePreview();

  assert.deepEqual(preview, {
    perHit: 3,
    hits: 2,
    attackTotal: 6,
    currentBlock: 4,
    blocked: 4,
    attackHpLoss: 2,
    endTurnHpLoss: 3,
    totalHpLoss: 5,
    hpAfter: 45,
    lethal: false
  });
  assert.equal(game.hp, 50);
  assert.equal(game.combat.playerBlock, 4);
  assert.equal(game.combat.endTurnHpLoss, 3);
});

test("非攻击意图显示零掉血，回合末损失致命时不重复计算敌方攻击", () => {
  const safe = new SemesterGame(548, "cancer");
  safe.startCombat("groupChat");
  safe.combat.enemy.intentTurn = 1;
  assert.deepEqual(safe.incomingDamagePreview(), {
    perHit: 0,
    hits: 0,
    attackTotal: 0,
    currentBlock: 4,
    blocked: 0,
    attackHpLoss: 0,
    endTurnHpLoss: 0,
    totalHpLoss: 0,
    hpAfter: 50,
    lethal: false
  });

  const lethal = new SemesterGame(549, "aries");
  lethal.hp = 4;
  lethal.startCombat("sleepyBug");
  lethal.combat.playerBlock = 10;
  lethal.combat.endTurnHpLoss = 4;
  const preview = lethal.incomingDamagePreview();
  assert.equal(preview.attackTotal, 5);
  assert.equal(preview.attackHpLoss, 0);
  assert.equal(preview.totalHpLoss, 4);
  assert.equal(preview.hpAfter, 0);
  assert.equal(preview.lethal, true);
});

test("作业团会把待办状态牌加入战斗牌堆", () => {
  const game = new SemesterGame(4);
  game.startCombat("homeworkBlob");
  game.endTurn();
  const allZones = [game.combat.hand, game.combat.drawPile, game.combat.discardPile, game.combat.exhaustPile].flat();
  assert.equal(allZones.some((card) => card.id === "todo"), true);
});

test("宕机鸭需要 2 点充能，重启猛啄花费 1 能量造成 7 伤害且每场一次", () => {
  const game = new SemesterGame(5);
  game.startCombat("alarmClock");
  const duck = PET_DEFS.offlineDuck;

  assert.equal(game.pet.id, "offlineDuck");
  assert.equal(game.pet.name, "宕机鸭");
  assert.equal(game.pet.maxCharge, 2);
  assert.equal(duck.skill.name, "重启猛啄");
  assert.equal(duck.skill.energyCost, 1);
  assert.equal(duck.skill.baseDamage, 7);
  assert.equal(game.petSkillPreview().damage, 7);
  game.pet.charge = 1;
  game.combat.energy = 3;
  assert.equal(game.usePetSkill().ok, false, "未满 2 点充能时不能发动");

  game.pet.charge = 2;
  const hp = game.combat.enemy.hp;

  assert.equal(game.usePetSkill().ok, true);
  assert.equal(game.combat.enemy.hp, hp - 7);
  assert.equal(game.combat.energy, 2);
  assert.equal(game.pet.charge, 0);
  assert.equal(game.stats.petUses, 1);
  assert.match(game.combat.log.at(-1), /宕机鸭·重启猛啄：造成 7 伤害/);
  assert.equal(game.usePetSkill().ok, false);
});

test("等待弃牌时不能绕过输入顺序发动宠物技能", () => {
  const game = new SemesterGame(51);
  game.startCombat("alarmClock");
  game.pet.charge = game.pet.maxCharge;
  game.combat.energy = 3;
  game.combat.pendingDiscard = 1;

  const before = {
    energy: game.combat.energy,
    enemyHp: game.combat.enemy.hp,
    charge: game.pet.charge
  };
  assert.deepEqual(game.usePetSkill(), { ok: false, reason: "请先选择一张牌弃掉" });
  assert.deepEqual({
    energy: game.combat.energy,
    enemyHp: game.combat.enemy.hp,
    charge: game.pet.charge
  }, before);
});

test("无宠物 ID 与 legacy goose 旧档都会迁移为宕机鸭且保留养成进度", () => {
  const source = new SemesterGame(505, "cancer");
  source.pet.bond = 12;
  source.pet.charge = 1;
  source.pet.talent = "guardian";
  source.pet.talentLevel = 2;
  const baseSave = source.toJSON();

  for (const legacyId of [undefined, "goose"]) {
    const saved = JSON.parse(JSON.stringify(baseSave));
    saved.pet.name = "暴躁鹅";
    if (legacyId === undefined) delete saved.pet.id;
    else saved.pet.id = legacyId;

    const restored = SemesterGame.fromJSON(saved);
    assert.equal(restored.pet.id, "offlineDuck");
    assert.equal(restored.pet.name, "宕机鸭");
    assert.equal(restored.pet.bond, 12);
    assert.equal(restored.pet.charge, 1);
    assert.equal(restored.pet.talent, "guardian");
    assert.equal(restored.pet.talentLevel, 2);
  }
});

test("卡牌升级后使用升级数值", () => {
  const game = new SemesterGame(6);
  const strike = game.deck.find((card) => card.id === "textbookStrike");
  assert.equal(game.upgradeCard(strike.uid), true);
  assert.equal(cardDefinition(strike).effect.damage, 7);
  assert.match(cardDefinition(strike).displayName, /\+$/);
});

test("带伤害的技能不被误算为攻击牌，不触发宠物充能与攻击加成", () => {
  const game = new SemesterGame(8);
  game.addCard("lendAHand");
  game.startCombat("alarmClock");
  const card = putCardInHand(game, "lendAHand");
  game.combat.energy = 3;
  game.combat.attackBonus = 3;
  game.combat.distracted = true;

  game.playCard(card.uid);
  assert.equal(game.combat.enemy.hp, 25);
  assert.equal(game.pet.charge, 0);
});

test("卡牌预览合并当前攻击修正与敌方护甲，且与正式结算一致", () => {
  const game = new SemesterGame(801, "aries");
  game.addItem("autoPencil");
  game.addCard("catCombo");
  game.startCombat("alarmClock");
  const card = putCardInHand(game, "catCombo");
  game.combat.enemy.block = 6;
  game.combat.attackBonus = 1;
  game.combat.distracted = true;
  game.combat.doubleNextAttack = true;
  const before = {
    enemyHp: game.combat.enemy.hp,
    enemyBlock: game.combat.enemy.block,
    ariesUsed: game.combat.archetypeAttackUsed,
    pencilUsed: game.combat.pencilUsed,
    doubled: game.combat.doubleNextAttack,
    rng: game.rng.state
  };

  const preview = game.cardEffectPreview(card);
  assert.deepEqual(preview, {
    cost: 1,
    hasDamage: true,
    damagePerHit: 5,
    hits: 4,
    attackTotal: 20,
    enemyBlockAbsorbed: 6,
    healthDamage: 14,
    baseBlock: 0,
    statusBlock: 0,
    block: 0,
    selfDamage: 0,
    ariesBonus: true,
    pencilBonus: true,
    doubleAttack: true,
    notebookBonus: false,
    statusCount: 0,
    modifiers: ["攻击加成 +1", "走神 -2", "白羊首击 +2", "自动铅笔 +1", "双倍攻击"]
  });
  assert.deepEqual({
    enemyHp: game.combat.enemy.hp,
    enemyBlock: game.combat.enemy.block,
    ariesUsed: game.combat.archetypeAttackUsed,
    pencilUsed: game.combat.pencilUsed,
    doubled: game.combat.doubleNextAttack,
    rng: game.rng.state
  }, before);

  assert.equal(game.playCard(card.uid).ok, true);
  assert.equal(game.combat.enemy.hp, before.enemyHp - preview.healthDamage);
  assert.equal(game.combat.enemy.block, 0);
  assert.equal(game.combat.archetypeAttackUsed, true);
  assert.equal(game.combat.pencilUsed, true);
  assert.equal(game.combat.doubleNextAttack, false);
});

test("动态护甲预览合并厚笔记本与待办清理且不提前消耗效果", () => {
  const game = new SemesterGame(802, "cancer");
  game.addItem("thickNotebook");
  game.startCombat("alarmClock");
  const card = game.createCard("clearBacklog");
  game.combat.hand = [card, game.createCard("todo"), game.createCard("todo")];
  const handBefore = game.combat.hand.map((held) => held.uid);
  const blockBefore = game.combat.playerBlock;

  const preview = game.cardEffectPreview(card);
  assert.equal(preview.baseBlock, 5);
  assert.equal(preview.statusBlock, 4);
  assert.equal(preview.block, 9);
  assert.equal(preview.statusCount, 2);
  assert.deepEqual(preview.modifiers, ["厚笔记本 +2", "清理 2 张状态 +4"]);
  assert.equal(game.combat.notebookUsed, false);
  assert.deepEqual(game.combat.hand.map((held) => held.uid), handBefore);

  assert.equal(game.playCard(card.uid).ok, true);
  assert.equal(game.combat.playerBlock - blockBefore, preview.block);
  assert.equal(game.combat.notebookUsed, true);
  assert.equal(game.combat.exhaustPile.filter((held) => held.id === "todo").length, 2);
});

test("三种星座学生拥有不同特性牌，且初始卡组都保持 10 张", () => {
  assert.equal(startingDeckFor("aries").length, 10);
  assert.equal(startingDeckFor("gemini").length, 10);
  assert.equal(startingDeckFor("cancer").length, 10);
  assert.equal(startingDeckFor("aries").at(-1), "classSprint");
  assert.equal(startingDeckFor("gemini").at(-1), "scratchPaper");
  assert.equal(startingDeckFor("cancer").at(-1), "payAttention");
});

test("首场教学战前三张稳定展示攻防与主角特性，后续和挑战战保持随机", () => {
  const archetypes = {
    aries: "classSprint",
    gemini: "scratchPaper",
    cancer: "payAttention"
  };
  for (const [archetypeId, specialCard] of Object.entries(archetypes)) {
    for (let seed = 1; seed <= 20; seed += 1) {
      const game = new SemesterGame(seed, archetypeId);
      game.startCombat("sleepyBug");
      assert.equal(game.combat.tutorialOpening, true);
      assert.deepEqual(
        game.combat.hand.slice(0, 3).map((card) => card.id),
        ["textbookStrike", "backpackGuard", specialCard]
      );
      assert.match(game.combat.log.join("\n"), /新生首手保底/);
    }
  }

  const laterCombat = new SemesterGame(3001, "cancer");
  laterCombat.stats.combatsStarted = 1;
  laterCombat.startCombat("sleepyBug");
  assert.equal(laterCombat.combat.tutorialOpening, false);
  assert.doesNotMatch(laterCombat.combat.log.join("\n"), /新生首手保底/);

  const challenge = new SemesterGame(3002, "cancer");
  challenge.startCombat("sleepyBug", { challenge: true, affix: "deadline" });
  assert.equal(challenge.combat.tutorialOpening, false);
});

test("白羊座首张攻击牌每段伤害加 2，且每场只触发一次", () => {
  const game = new SemesterGame(9, "aries");
  game.startCombat("alarmClock");
  const first = putCardInHand(game, "textbookStrike");
  game.combat.energy = 3;
  game.playCard(first.uid);
  assert.equal(game.combat.enemy.hp, 21);

  const second = { ...game.deck.filter((card) => card.id === "textbookStrike")[1] };
  game.combat.hand.push(second);
  game.playCard(second.uid);
  assert.equal(game.combat.enemy.hp, 16);
});

test("双子座每场第一次打出零费牌额外抽 1 张", () => {
  const game = new SemesterGame(10, "gemini");
  game.startCombat("alarmClock");
  const zeroCost = putCardInHand(game, "cramming");
  game.combat.drawPile = [{ ...game.deck.find((card) => card.id === "textbookStrike") }];
  game.combat.energy = 3;
  game.playCard(zeroCost.uid);
  assert.equal(game.combat.hand.length, 1);
  assert.equal(game.combat.archetypeZeroUsed, true);
});

test("存档恢复保留星座、构筑、羁绊和随机数状态", () => {
  const game = new SemesterGame(11, "gemini");
  game.week = 7;
  game.gold = 123;
  game.pet.bond = 9;
  game.updatePetMilestone();
  game.resolvePetMilestone("scout");
  const savedCard = game.addCard("catCombo", true);
  game.enchantCard(savedCard.uid);
  game.addItem("autoPencil");
  game.stats.cardsPlayed = 12;
  game.stats.cardPlays.textbookStrike = 8;
  const restored = SemesterGame.fromJSON(game.toJSON());

  assert.equal(restored.archetypeId, "gemini");
  assert.equal(restored.week, 7);
  assert.equal(restored.gold, 123);
  assert.equal(restored.pet.bond, 9);
  assert.equal(restored.pet.talent, "scout");
  assert.equal(restored.pet.talentLevel, 1);
  assert.equal(restored.deck.at(-1).id, "catCombo");
  assert.equal(restored.deck.at(-1).upgraded, true);
  assert.equal(restored.deck.at(-1).enchantment, "geminiQuick");
  assert.deepEqual(restored.items, ["autoPencil"]);
  assert.equal(restored.rng.state, game.rng.state);
  assert.equal(restored.stats.cardsPlayed, 12);
  assert.equal(restored.stats.cardPlays.textbookStrike, 8);
  assert.deepEqual(restored.loadRepairs, []);
  assert.equal(Object.hasOwn(restored.toJSON(), "loadRepairs"), false);
});

test("每个星座首批都有 4 张专属牌，且归属数据完整", () => {
  for (const [archetypeId, ids] of Object.entries(ARCHETYPE_CARD_IDS)) {
    assert.equal(ids.length, 4);
    for (const id of ids) {
      assert.equal(CARD_DEFS[id].archetype, archetypeId);
      assert.ok(CARD_DEFS[id].effect);
      assert.ok(CARD_DEFS[id].upgradedEffect);
    }
  }
});

test("普通战后三选一严格为 1 张本星座专属和 2 张普池", () => {
  for (const archetypeId of Object.keys(ARCHETYPE_CARD_IDS)) {
    for (let seed = 1; seed <= 40; seed += 1) {
      const game = new SemesterGame(seed, archetypeId);
      const choices = game.rewardCards(3);
      assert.equal(choices.length, 3);
      assert.equal(choices.filter((id) => ARCHETYPE_CARD_IDS[archetypeId].includes(id)).length, 1);
      assert.equal(choices.filter((id) => PUBLIC_REWARD_CARD_IDS.includes(id)).length, 2);
      assert.equal(choices.some((id) => CARD_DEFS[id].archetype && CARD_DEFS[id].archetype !== archetypeId), false);
    }
  }
});

test("指定稀有度奖励仍保持 1 专属 + 2 普池且全部同稀有度", () => {
  const game = new SemesterGame(99, "gemini");
  const choices = game.rewardCards(3, "uncommon");
  assert.equal(choices.filter((id) => ARCHETYPE_CARD_IDS.gemini.includes(id)).length, 1);
  assert.equal(choices.filter((id) => PUBLIC_REWARD_CARD_IDS.includes(id)).length, 2);
  assert.equal(choices.every((id) => CARD_DEFS[id].rarity === "uncommon"), true);
});

test("白羊赤焰刻印让攻击牌每段伤害加 2，并可与升级叠加", () => {
  const game = new SemesterGame(101, "aries");
  const strike = game.deck.find((card) => card.id === "textbookStrike");
  assert.equal(game.enchantCard(strike.uid), true);
  assert.equal(cardDefinition(strike).effect.damage, 7);
  game.upgradeCard(strike.uid);
  assert.equal(cardDefinition(strike).effect.damage, 9);
  assert.equal(cardDefinition(strike).enchantment, ENCHANTMENT_DEFS.ariesFlame);
  assert.equal(game.enchantCard(strike.uid), false);
});

test("双子瞬思刻印让非零费牌费用减 1，最低为 0", () => {
  const game = new SemesterGame(102, "gemini");
  const guard = game.deck.find((card) => card.id === "backpackGuard");
  assert.equal(game.enchantCard(guard.uid), true);
  assert.equal(cardDefinition(guard).cost, 0);
  game.startCombat("sleepyBug");
  const combatGuard = { ...guard };
  game.combat.hand = [combatGuard];
  game.combat.energy = 0;
  assert.equal(game.playCard(combatGuard.uid).ok, true);
  assert.equal(game.combat.energy, 0);
});

test("巨蟹守护刻印让卡牌基础护甲加 3，不能刻在纯攻击牌上", () => {
  const game = new SemesterGame(103, "cancer");
  const guard = game.deck.find((card) => card.id === "backpackGuard");
  const strike = game.deck.find((card) => card.id === "textbookStrike");
  assert.equal(game.enchantCard(strike.uid), false);
  assert.equal(game.enchantCard(guard.uid), true);
  assert.equal(cardDefinition(guard).effect.block, 8);
  game.upgradeCard(guard.uid);
  assert.equal(cardDefinition(guard).effect.block, 10);
});

test("宠物在羁绊 3、10、25 依次选择、强化和精通路线", () => {
  const game = new SemesterGame(104, "aries");
  game.pet.bond = 3;
  assert.equal(game.updatePetMilestone(), "choose");
  assert.equal(game.resolvePetMilestone("fury"), true);
  assert.equal(game.petSkillPreview().damage, 8);

  game.pet.bond = 10;
  assert.equal(game.updatePetMilestone(), "upgrade");
  assert.equal(game.resolvePetMilestone(), true);
  assert.equal(game.petSkillPreview().damage, 9);

  game.pet.bond = 25;
  assert.equal(game.updatePetMilestone(), "master");
  assert.equal(game.resolvePetMilestone(), true);
  assert.equal(game.petSkillPreview().damage, 10);
  assert.equal(game.pet.talentLevel, 3);
});

test("护崽路线让宠物技能获得护甲，但不增加出手次数", () => {
  const game = new SemesterGame(105, "aries");
  game.pet.talent = "guardian";
  game.pet.talentLevel = 2;
  game.startCombat("alarmClock");
  game.pet.charge = 2;
  game.combat.energy = 3;
  assert.equal(game.usePetSkill().ok, true);
  assert.equal(game.combat.playerBlock, 5);
  assert.equal(game.usePetSkill().ok, false);
});

test("叼笔记路线立即抽牌并为下回合提供抽牌奖励", () => {
  const game = new SemesterGame(106, "gemini");
  game.pet.talent = "scout";
  game.pet.talentLevel = 2;
  game.startCombat("alarmClock");
  game.pet.charge = 2;
  game.combat.energy = 3;
  const handSize = game.combat.hand.length;
  game.usePetSkill();
  assert.equal(game.combat.hand.length, handSize + 1);
  assert.equal(game.combat.nextDrawBonus, 1);
  assert.equal(game.petSkillPreview().talent, PET_TALENT_DEFS.scout);
});

test("战斗胜利跨过羁绊 3 时生成路线选择，不直接偷偷加数值", () => {
  const game = new SemesterGame(107, "cancer");
  game.pet.bond = 2;
  game.startCombat("sleepyBug");
  game.combat.enemy.hp = 1;
  const strike = putCardInHand(game, "textbookStrike");
  game.combat.energy = 3;
  game.playCard(strike.uid);
  assert.equal(game.pet.bond, 3);
  assert.equal(game.pet.pendingMilestone, "choose");
  assert.equal(game.petSkillPreview().damage, 7);
});

test("试玩统计记录战斗、回合、出牌与常用卡", () => {
  const game = new SemesterGame(108, "aries");
  game.startCombat("sleepyBug");
  game.combat.enemy.hp = 5;
  const strike = putCardInHand(game, "textbookStrike");
  game.combat.energy = 3;
  game.playCard(strike.uid);

  assert.equal(game.stats.combatsStarted, 1);
  assert.equal(game.stats.combatsCompleted, 1);
  assert.equal(game.stats.combatsWon, 1);
  assert.equal(game.stats.combatTurns, 1);
  assert.equal(game.stats.cardsPlayed, 1);
  assert.equal(game.stats.cardPlays.textbookStrike, 1);
});

test("试玩统计只累计真正穿过护甲的战斗生命损失", () => {
  const game = new SemesterGame(109, "aries");
  game.startCombat("sleepyBug");
  game.combat.playerBlock = 3;
  game.endTurn();
  assert.equal(game.hp, 48);
  assert.equal(game.stats.combatHpLost, 2);
});

test("战斗复盘记录回合、出牌、实际伤害和掉血", () => {
  const game = new SemesterGame(110, "aries");
  game.startCombat("sleepyBug");
  game.combat.enemy.hp = 5;
  const strike = putCardInHand(game, "textbookStrike");
  game.combat.energy = 3;
  game.playCard(strike.uid);
  const summary = game.combatSummary();

  assert.equal(summary.result, "won");
  assert.equal(summary.enemyId, "sleepyBug");
  assert.equal(summary.turns, 1);
  assert.equal(summary.cardsPlayed, 1);
  assert.equal(summary.damageDealt, 5);
  assert.equal(summary.hpLost, 0);
});

test("生涯档案跨对局记录发现与成就进度", () => {
  const profile = createCareerProfile();
  for (const enemyId of ["sleepyBug", "homeworkBlob", "alarmClock", "phoneSpirit"]) {
    recordEnemyEncounter(profile, enemyId);
  }
  const unlocked = recordCareerCombat(profile, {
    result: "won", enemyKind: "normal", turns: 3, cardsPlayed: 6, hpLost: 0, petUsed: true
  });

  assert.equal(profile.discoveredEnemies.length, 4);
  assert.ok(profile.unlockedAchievements.includes("campusArchive"));
  assert.ok(unlocked.includes("firstWin"));
  assert.ok(unlocked.includes("cleanWin"));
  assert.ok(unlocked.includes("quickWin"));
  assert.deepEqual(achievementProgress(profile, "gooseCall"), { current: 1, target: 5, unlocked: false });
  assert.equal(ACHIEVEMENT_DEFS.gooseCall.name, "伙伴来！");

  const restored = normalizeCareerProfile(JSON.parse(JSON.stringify(profile)));
  assert.equal(restored.cardsPlayed, 6);
  assert.deepEqual(restored.unlockedAchievements, profile.unlockedAchievements);
});

test("孵化只在生涯档案解锁宠物种类，旧档与污染列表安全回退", () => {
  const profile = createCareerProfile();
  assert.deepEqual(profile.unlockedPetIds, [DEFAULT_PET_ID]);

  recordCareerCombat(profile, {
    result: "won",
    enemyKind: "normal",
    turns: 2,
    cardsPlayed: 4,
    hpLost: 1,
    petUsed: false,
    petIncubationEvent: { type: "hatched", eggId: "sleepyBugEgg", petId: "sleepyBugCub" }
  });
  assert.deepEqual(profile.unlockedPetIds, [DEFAULT_PET_ID, "sleepyBugCub"]);

  const restored = normalizeCareerProfile({
    ...JSON.parse(JSON.stringify(profile)),
    unlockedPetIds: ["sleepyBugCub", "sleepyBugCub", "unknownPet"]
  });
  assert.deepEqual(restored.unlockedPetIds, [DEFAULT_PET_ID, "sleepyBugCub"]);
  assert.deepEqual(normalizeCareerProfile({ ...createCareerProfile(), unlockedPetIds: undefined }).unlockedPetIds, [DEFAULT_PET_ID]);
});

test("星座试炼册分别记录三种印章并解锁三星连珠", () => {
  const profile = createCareerProfile();
  const completedTrial = (archetypeId) => ({
    result: "won",
    enemyKind: "normal",
    turns: 3,
    cardsPlayed: 4,
    hpLost: 0,
    challenge: true,
    challengeTrial: { archetypeId, completed: true }
  });

  const firstUnlocks = recordCareerCombat(profile, completedTrial("aries"));
  recordCareerCombat(profile, completedTrial("aries"));
  recordCareerCombat(profile, completedTrial("gemini"));
  const finalUnlocks = recordCareerCombat(profile, completedTrial("cancer"));

  assert.equal(profile.trialCompletions.aries, 2);
  assert.deepEqual(trialCollectionProgress(profile), { completedSigns: 3, totalSigns: 3, totalCompletions: 4 });
  assert.ok(firstUnlocks.includes("firstTrial"));
  assert.ok(finalUnlocks.includes("allTrials"));
  assert.deepEqual(achievementProgress(profile, "allTrials"), { current: 3, target: 3, unlocked: true });

  const restored = normalizeCareerProfile({
    ...JSON.parse(JSON.stringify(profile)),
    trialCompletions: { aries: -2, gemini: "3", cancer: 1, unknown: 99 }
  });
  assert.deepEqual(restored.trialCompletions, { aries: 0, gemini: 3, cancer: 1 });

  const legacy = normalizeCareerProfile({ ...createCareerProfile(), trialCompletions: undefined });
  assert.deepEqual(legacy.trialCompletions, { aries: 0, gemini: 0, cancer: 0 });
});

test("三种学生的初始卡组会识别为各自核心流派", () => {
  assert.equal(analyzeBuild(new SemesterGame(201, "aries")).primary.id, "offense");
  assert.equal(analyzeBuild(new SemesterGame(202, "gemini")).primary.id, "cycle");
  assert.equal(analyzeBuild(new SemesterGame(203, "cancer")).primary.id, "defense");
});

test("宠物牌与羁绊路线足够集中时识别为伙伴协同", () => {
  const game = new SemesterGame(204, "gemini");
  game.deck = Array.from({ length: 8 }, () => game.createCard("feedPet"));
  game.pet.talent = "scout";
  game.pet.talentLevel = 2;
  const analysis = analyzeBuild(game);
  assert.equal(analysis.primary.id, "pet");
  assert.equal(analysis.primary.label, "伙伴协同");
  assert.equal(analysis.risk, "防御密度偏低");
});

test("候选牌会区分核心契合、转型组件和补足短板", () => {
  const offense = new SemesterGame(207, "aries");
  assert.equal(evaluateCardFit(offense, "stubborn").id, "core");
  assert.equal(evaluateCardFit(offense, "borrowNotes").id, "pivot");
  assert.match(choiceGuidance(offense, ["stubborn", "borrowNotes"]), /1 张核心契合牌/);

  const fragile = new SemesterGame(208, "aries");
  fragile.deck = Array.from({ length: 8 }, () => fragile.createCard("textbookStrike"));
  assert.equal(evaluateCardFit(fragile, "holdOn").id, "repair");
  assert.match(choiceGuidance(fragile, ["holdOn", "borrowNotes"]), /防御密度偏低/);
});

test("选牌契合评估不会修改卡组或随机数状态", () => {
  const game = new SemesterGame(209, "gemini");
  const before = JSON.stringify(game.toJSON());
  evaluateCardFit(game, "feedPet");
  choiceGuidance(game, ["feedPet", "catCombo", "holdOn"]);
  assert.equal(JSON.stringify(game.toJSON()), before);
});

test("挑战奖励参谋会根据卡组、宠物里程碑和书包状态给出唯一建议", () => {
  const openBackpack = new SemesterGame(210, "cancer");
  const itemAdvice = challengeRewardGuidance(openBackpack, 8);
  assert.equal(itemAdvice.recommendedId, "item");
  assert.match(itemAdvice.options.item.reason, /6 个空位/);
  assert.equal(Object.values(itemAdvice.options).filter((option) => option.recommended).length, 1);

  const nearMilestone = new SemesterGame(211, "cancer");
  nearMilestone.pet.talent = "guardian";
  nearMilestone.pet.talentLevel = 1;
  nearMilestone.pet.bond = 8;
  const petAdvice = challengeRewardGuidance(nearMilestone, 0);
  assert.equal(petAdvice.recommendedId, "pet");
  assert.match(petAdvice.options.pet.reason, /8 → 10/);

  const finishedCollection = new SemesterGame(212, "aries");
  finishedCollection.pet.talent = "fury";
  finishedCollection.pet.talentLevel = 3;
  finishedCollection.pet.bond = 25;
  const cardAdvice = challengeRewardGuidance(finishedCollection, 0);
  assert.equal(cardAdvice.recommendedId, "cards");
  assert.match(cardAdvice.options.item.reason, /45 校园币/);
});

test("挑战奖励参谋只读取本局状态，不修改卡组、统计或随机数", () => {
  const game = new SemesterGame(213, "gemini");
  game.pet.bond = 8;
  const before = JSON.stringify(game.toJSON());
  challengeRewardGuidance(game, 5);
  assert.equal(JSON.stringify(game.toJSON()), before);
});

test("卷王幻影与期末考试公开专属机制、当前进度和不变的真实数值", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /enemyDefinition\?\.mechanicName && enemyDefinition\?\.mechanicText/);
  assert.match(appSource, /特性 · \$\{escapeHtml\(enemyDefinition\.mechanicName\)\}/);
  assert.match(appSource, /<b>行动周期<\/b>\$\{escapeHtml\(enemyDefinition\.pattern\)\}/);

  const rival = ENEMY_DEFS.rivalShadow;
  assert.equal(rival.mechanicName, "无休加速");
  assert.match(rival.mechanicText, /首次基础伤害为 6/);
  assert.match(rival.mechanicText, /每次都比上一次加 2/);
  assert.match(rival.mechanicText, /没有防御或休息回合/);
  assert.deepEqual([0, 1, 2, 4].map((turn) => rival.intentAt(turn)), [
    { name: "加速内卷 · 第1次", attack: 6 },
    { name: "加速内卷 · 第2次", attack: 8 },
    { name: "加速内卷 · 第3次", attack: 10 },
    { name: "加速内卷 · 第5次", attack: 14 }
  ]);

  const rivalGame = new SemesterGame(222, "cancer");
  rivalGame.startCombat("rivalShadow");
  rivalGame.combat.enemy.intentTurn = 3;
  const rivalIntent = rivalGame.getIntent();
  assert.deepEqual({ name: rivalIntent.name, attack: rivalIntent.attack }, {
    name: "加速内卷 · 第4次",
    attack: 12
  });
  const rivalResult = rivalGame.endTurn().enemyResult;
  assert.equal(rivalResult.intentName, rivalIntent.name);
  assert.equal(rivalResult.attack.perHit, rivalIntent.attack);

  const exam = ENEMY_DEFS.finalExam;
  assert.equal(exam.mechanicName, "四步破题");
  assert.match(exam.mechanicText, /每 4 次行动固定轮转/);
  assert.match(exam.mechanicText, /击破全部护甲/);
  assert.match(exam.mechanicText, /大题最终伤害 -6/);
  assert.match(exam.mechanicText, /每轮 \+2/);
  assert.deepEqual([0, 1, 2, 3].map((turn) => exam.intentAt(turn)), [
    { name: "发卷 · 第1轮", addStatus: { id: "nervous", count: 2, zone: "draw" } },
    { name: "选择题 · 第1轮", attack: 8 },
    { name: "填空题 · 第1轮", attack: 10, block: 8 },
    { name: "大题 · 第1轮", attack: 16 }
  ]);
  assert.deepEqual([4, 5, 6, 7].map((turn) => exam.intentAt(turn)), [
    { name: "发卷 · 第2轮", addStatus: { id: "nervous", count: 2, zone: "draw" } },
    { name: "选择题 · 第2轮", attack: 8 },
    { name: "填空题 · 第2轮", attack: 10, block: 8 },
    { name: "大题 · 第2轮", attack: 18 }
  ]);
  assert.deepEqual(exam.intentAt(11), { name: "大题 · 第3轮", attack: 20 });

  const examGame = new SemesterGame(223, "cancer");
  examGame.startCombat("finalExam");
  examGame.combat.enemy.intentTurn = 7;
  const examIntent = examGame.getIntent();
  assert.deepEqual({ name: examIntent.name, attack: examIntent.attack }, {
    name: "大题 · 第2轮",
    attack: 18
  });
  const examResult = examGame.endTurn().enemyResult;
  assert.equal(examResult.intentName, examIntent.name);
  assert.equal(examResult.attack.perHit, examIntent.attack);
});

test("随机池新增群聊99+与卡纸打印机，且机制按公开意图执行", () => {
  assert.ok(NORMAL_ENEMY_IDS.includes("groupChat"));
  assert.ok(NORMAL_ENEMY_IDS.includes("printerJam"));
  const mechanicNames = new Set();
  const mechanicTexts = new Set();
  for (const id of NORMAL_ENEMY_IDS) {
    const enemy = ENEMY_DEFS[id];
    assert.ok(enemy.pattern);
    assert.ok(enemy.tip);
    assert.equal(typeof enemy.mechanicName, "string", `${id} 缺少短机制名`);
    assert.equal(typeof enemy.mechanicText, "string", `${id} 缺少机制说明`);
    assert.ok(enemy.mechanicName.trim().length >= 2 && enemy.mechanicName.length <= 6, `${id} 机制名必须短而可读`);
    assert.ok(enemy.mechanicText.trim().length >= 12, `${id} 机制说明必须解释真实循环`);
    mechanicNames.add(enemy.mechanicName);
    mechanicTexts.add(enemy.mechanicText);
  }
  assert.equal(mechanicNames.size, NORMAL_ENEMY_IDS.length, "普通敌人的机制名不能重复");
  assert.equal(mechanicTexts.size, NORMAL_ENEMY_IDS.length, "普通敌人的机制说明不能重复");

  assert.deepEqual(ENEMY_DEFS.phoneSpirit.intents, [
    { name: "推送轰炸", block: 4, debuff: "distracted" },
    { name: "震动撞击", attack: 8 },
    { name: "边刷边撞", attack: 5, block: 3, debuff: "distracted" }
  ]);

  const phoneOpening = new SemesterGame(204, "cancer");
  phoneOpening.startCombat("phoneSpirit");
  const openingResult = phoneOpening.endTurn().enemyResult;
  assert.deepEqual(openingResult.block, { gained: 4 });
  assert.deepEqual(openingResult.debuff, { id: "distracted", applied: true, blockedBy: null });
  assert.equal(phoneOpening.combat.enemy.block, 4);

  const phoneWithEarplugs = new SemesterGame(204, "cancer");
  phoneWithEarplugs.items = ["earplugs"];
  phoneWithEarplugs.startCombat("phoneSpirit");
  const protectedOpeningResult = phoneWithEarplugs.endTurn().enemyResult;
  assert.deepEqual(protectedOpeningResult.block, { gained: 4 });
  assert.deepEqual(protectedOpeningResult.debuff, { id: "distracted", applied: false, blockedBy: "earplugs" });
  assert.equal(phoneWithEarplugs.combat.enemy.block, 4, "耳塞只抵挡走神，不能阻止推送行动护屏");

  const phoneComposite = new SemesterGame(204, "cancer");
  phoneComposite.startCombat("phoneSpirit");
  phoneComposite.combat.playerBlock = 0;
  phoneComposite.combat.enemy.intentTurn = 2;
  const compositeResult = phoneComposite.endTurn().enemyResult;
  assert.deepEqual(compositeResult.attack, {
    perHit: 5,
    hits: 1,
    hitsResolved: 1,
    blocked: 0,
    healthDamage: 5,
    segments: [{ index: 1, blocked: 0, hpLoss: 5, blockAfter: 0 }]
  });
  assert.deepEqual(compositeResult.block, { gained: 3 });
  assert.deepEqual(compositeResult.debuff, { id: "distracted", applied: true, blockedBy: null });
  assert.equal(phoneComposite.combat.enemy.block, 3);

  const chatGame = new SemesterGame(205, "cancer");
  chatGame.startCombat("groupChat");
  chatGame.endTurn();
  assert.equal(chatGame.hp, 48);

  const printerGame = new SemesterGame(206, "cancer");
  printerGame.startCombat("printerJam");
  printerGame.endTurn();
  assert.equal(printerGame.combat.enemy.block, 8);
  assert.ok(printerGame.combat.discardPile.some((card) => card.id === "todo"));
});

test("群聊未读压力按紧张数量即时增加轰炸段数，清理后预告与结算同步降低", () => {
  const game = new SemesterGame(214, "cancer");
  game.startCombat("groupChat");
  game.combat.enemy.intentTurn = 0;
  const clearBacklog = game.createCard("clearBacklog");
  game.combat.hand = [clearBacklog, game.createCard("nervous"), game.createCard("nervous")];
  game.combat.drawPile = [];
  game.combat.discardPile = [];
  game.combat.exhaustPile = [];

  const pressured = game.getIntent();
  assert.equal(pressured.attack, 3);
  assert.equal(pressured.hits, 4);
  assert.match(pressured.name, /未读 2\/2/);
  assert.deepEqual(pressured.mechanicState, {
    type: "statusHits",
    label: "未读",
    value: 2,
    cap: 2,
    sourceCount: 2
  });
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /intent-detail-heading[\s\S]*?<strong>\$\{escapeHtml\(name\)\}<\/strong>/,
    "意图详情标题必须直接显示含 value\/cap 的动态名称");

  const clearPreview = game.cardEffectPreview(clearBacklog);
  const matchingStatuses = combatMechanicStatusCleared(clearPreview, pressured, game.combat.hand);
  assert.deepEqual(combatCardTacticalCue(clearPreview, game.incomingDamagePreview(), {
    enemyHp: game.combat.enemy.hp,
    playerHp: game.hp,
    playable: true,
    mechanicState: pressured.mechanicState,
    mechanicStatusCleared: matchingStatuses,
    mechanicStatusName: "紧张"
  }), {
    tone: "guard",
    label: "轰炸 4→2段 · 无伤",
    detail: "清理 2 张紧张：轰炸从 4 段降至 2 段，打出后无伤"
  }, "出牌前提示必须与清理后的真实段数和护甲结果一致");

  assert.deepEqual(game.playCard(clearBacklog.uid), { ok: true });
  const relieved = game.getIntent();
  assert.equal(relieved.hits, 2, "出牌清理紧张后，当前意图应立即少两段");
  assert.match(relieved.name, /未读 0\/2/);
  assert.equal(relieved.mechanicState.value, 0);
  assert.equal(game.combat.exhaustPile.filter((card) => card.id === "nervous").length, 2);

  const resolved = game.endTurn().enemyResult;
  assert.deepEqual(resolved.attack, {
    perHit: relieved.attack,
    hits: relieved.hits,
    hitsResolved: 2,
    blocked: 6,
    healthDamage: 0,
    segments: [
      { index: 1, blocked: 3, hpLoss: 0, blockAfter: 8 },
      { index: 2, blocked: 3, hpLoss: 0, blockAfter: 5 }
    ]
  });
  assert.deepEqual(resolved.mechanicState, relieved.mechanicState, "结算必须复用玩家刚看到的动态意图");
});

test("双子瞬思清空待办只清理打出瞬间已有状态，新抽状态保留并与预览一致", () => {
  const game = new SemesterGame(215, "gemini");
  game.startCombat("groupChat");
  const clearBacklog = game.createCard("clearBacklog");
  clearBacklog.enchantment = "geminiQuick";
  const drawnNervous = game.createCard("nervous");
  game.combat.hand = [clearBacklog];
  game.combat.drawPile = [drawnNervous];
  game.combat.discardPile = [];
  game.combat.exhaustPile = [];
  game.combat.energy = 0;
  game.combat.playerBlock = 0;

  const preview = game.cardEffectPreview(clearBacklog);
  assert.equal(preview.cost, 0);
  assert.equal(preview.statusCount, 0);
  assert.equal(preview.statusBlock, 0);
  assert.equal(preview.block, 3);

  assert.deepEqual(game.playCard(clearBacklog.uid), { ok: true });
  assert.equal(game.combat.playerBlock, preview.block);
  assert.equal(game.combat.archetypeZeroUsed, true);
  assert.deepEqual(game.combat.hand.map((card) => card.uid), [drawnNervous.uid],
    "零费被动新抽到的状态不属于打出瞬间的清理集合");
  assert.equal(game.combat.exhaustPile.some((card) => card.uid === drawnNervous.uid), false);
  assert.equal(game.combat.discardPile.some((card) => card.uid === clearBacklog.uid), true);
  assert.equal(game.stats.cardPlays.clearBacklog, 1);
});

test("Gemini clear backlog freezes existing status objects even when a new draw reuses the same uid", () => {
  const game = new SemesterGame(215, "gemini");
  game.startCombat("groupChat");
  game.combat.enemy.intentTurn = 0;
  const clearBacklog = game.createCard("clearBacklog");
  clearBacklog.enchantment = "geminiQuick";
  const existingNervous = game.createCard("nervous");
  const drawnNervous = game.createCard("nervous");
  drawnNervous.uid = existingNervous.uid;
  game.combat.hand = [clearBacklog, existingNervous];
  game.combat.drawPile = [drawnNervous];
  game.combat.discardPile = [];
  game.combat.exhaustPile = [];
  game.combat.energy = 0;
  game.combat.playerBlock = 0;

  const preview = game.cardEffectPreview(clearBacklog);
  assert.equal(preview.statusCount, 1);
  assert.equal(preview.block, 5);
  assert.equal(game.getIntent().hits, 4);

  assert.deepEqual(game.playCard(clearBacklog.uid), { ok: true });
  assert.equal(game.combat.playerBlock, preview.block);
  assert.equal(game.combat.hand.length, 1);
  assert.equal(game.combat.hand[0], drawnNervous,
    "the newly drawn object stays in hand even if it reuses an existing uid");
  assert.equal(game.combat.exhaustPile.length, 1);
  assert.equal(game.combat.exhaustPile[0], existingNervous,
    "only the status object present when the card was played is exhausted");
  assert.equal(game.getIntent().hits, 3);
});

test("群聊未读压力只统计未清理的紧张且严格封顶两段", () => {
  const game = new SemesterGame(215, "cancer");
  game.startCombat("groupChat");
  game.combat.enemy.intentTurn = 0;
  game.combat.hand = [game.createCard("nervous")];
  game.combat.drawPile = [game.createCard("nervous")];
  game.combat.discardPile = [game.createCard("nervous"), game.createCard("nervous")];
  game.combat.exhaustPile = [game.createCard("nervous"), game.createCard("nervous")];

  const capped = game.getIntent();
  assert.equal(capped.mechanicState.sourceCount, 4);
  assert.equal(capped.mechanicState.value, 2);
  assert.equal(capped.hits, 4);

  const resolved = game.endTurn().enemyResult;
  assert.equal(resolved.attack.hits, capped.hits);
  assert.equal(resolved.mechanicState.value, 2);
});

test("打印机剩余护甲会即时转为有上限的重击伤害，击破护甲可完整反制", () => {
  const fullPressure = new SemesterGame(216, "cancer");
  fullPressure.startCombat("printerJam");
  const jamResult = fullPressure.endTurn().enemyResult;
  assert.deepEqual(jamResult.block, { gained: 8 });
  const fullIntent = fullPressure.getIntent();
  assert.equal(fullIntent.attack, 12);
  assert.match(fullIntent.name, /蓄压 6\/6/);
  assert.deepEqual(fullIntent.mechanicState, {
    type: "enemyBlockAttack",
    label: "蓄压",
    value: 6,
    cap: 6,
    sourceCount: 8
  });
  const originalGetIntent = fullPressure.getIntent.bind(fullPressure);
  let intentReadsDuringResolution = 0;
  fullPressure.getIntent = () => {
    intentReadsDuringResolution += 1;
    return originalGetIntent();
  };
  const fullResult = fullPressure.endTurn().enemyResult;
  assert.equal(intentReadsDuringResolution, 1, "敌方结算只能冻结并消费一次 resolved intent");
  assert.equal(fullResult.attack.perHit, fullIntent.attack);
  assert.deepEqual(fullResult.mechanicState, fullIntent.mechanicState);

  const countered = new SemesterGame(217, "cancer");
  countered.startCombat("printerJam");
  countered.endTurn();
  const stubborn = countered.createCard("stubborn");
  countered.combat.hand = [stubborn];
  countered.combat.energy = 2;
  assert.equal(countered.getIntent().attack, 12);
  assert.deepEqual(countered.playCard(stubborn.uid), { ok: true });
  const relieved = countered.getIntent();
  assert.equal(countered.combat.enemy.block, 0);
  assert.equal(relieved.attack, 6, "打穿卡纸护甲后重击应立刻降回基础伤害");
  assert.match(relieved.name, /蓄压 0\/6/);
  const counteredResult = countered.endTurn().enemyResult;
  assert.equal(counteredResult.attack.perHit, relieved.attack);
  assert.deepEqual(counteredResult.mechanicState, relieved.mechanicState);

  const capped = new SemesterGame(218, "cancer");
  capped.startCombat("printerJam");
  capped.combat.enemy.intentTurn = 1;
  capped.combat.enemy.block = 99;
  const cappedIntent = capped.getIntent();
  assert.equal(cappedIntent.attack, 12);
  assert.equal(cappedIntent.mechanicState.sourceCount, 99);
  assert.equal(cappedIntent.mechanicState.value, 6);

  const breakpoint = new SemesterGame(219, "cancer");
  breakpoint.startCombat("printerJam");
  breakpoint.endTurn();
  breakpoint.combat.enemy.block = 7;
  assert.equal(breakpoint.getIntent().attack, 12, "7 点护甲仍未越过蓄压上限断点");
  breakpoint.combat.enemy.block = 6;
  assert.equal(breakpoint.getIntent().attack, 12, "6 点护甲仍提供完整蓄压");
  breakpoint.combat.enemy.block = 5;
  assert.equal(breakpoint.getIntent().attack, 11, "压到 5 点护甲后重击应降低 1");
});

test("动态敌人意图在学期与挑战倍率下仍让预告和真实结算完全一致", () => {
  const modifiers = {
    challenge: true,
    hpMultiplier: CHALLENGE_RULES.hpMultiplier,
    damageMultiplier: CHALLENGE_RULES.damageMultiplier,
    affix: "earlyClass"
  };

  const chat = new SemesterGame(219, "cancer");
  chat.semester = 2;
  chat.startCombat("groupChat", modifiers);
  chat.combat.enemy.intentTurn = 0;
  chat.combat.hand = [chat.createCard("nervous"), chat.createCard("nervous")];
  chat.combat.drawPile = [];
  chat.combat.discardPile = [];
  const chatIntent = chat.getIntent();
  assert.equal(chatIntent.attack, 5);
  assert.equal(chatIntent.hits, 4);
  const chatResult = chat.endTurn().enemyResult;
  assert.equal(chatResult.attack.perHit, chatIntent.attack);
  assert.equal(chatResult.attack.hits, chatIntent.hits);
  assert.deepEqual(chatResult.mechanicState, chatIntent.mechanicState);

  const printer = new SemesterGame(220, "cancer");
  printer.semester = 2;
  printer.startCombat("printerJam", modifiers);
  printer.endTurn();
  const printerIntent = printer.getIntent();
  assert.equal(printerIntent.attack, 15);
  printer.combat.enemy.block = 0;
  const printerWithoutPressure = printer.getIntent();
  assert.equal(printerWithoutPressure.attack, 9);
  assert.equal(printerIntent.attack - printerWithoutPressure.attack, 6,
    "蓄压 value/cap 必须表示倍率结算后的真实额外伤害");
  printer.combat.enemy.block = 8;
  const printerResult = printer.endTurn().enemyResult;
  assert.equal(printerResult.attack.perHit, printerIntent.attack);
  assert.deepEqual(printerResult.mechanicState, printerIntent.mechanicState);
});

test("动态敌人状态由战场即时推导，旧版战斗检查点无需新增存档字段", () => {
  const game = new SemesterGame(221, "gemini");
  game.chooseTarot("hermit");
  game.week = 6;
  game.flags.nextCombatTension = 3;
  assert.equal(game.preparePendingEvent("campusRumor"), true);
  assert.notEqual(game.prepareCombatStart("groupChat", "event", { hpMultiplier: 1.3 }), null);
  const legacyCheckpoint = game.toJSON();
  assert.equal(legacyCheckpoint.version, 2);
  assert.equal(Object.hasOwn(legacyCheckpoint, "enemyMechanics"), false);

  const restored = SemesterGame.fromJSON(legacyCheckpoint);
  assert.deepEqual(restored.pendingCombatStart, {
    enemyId: "groupChat",
    outcome: "event",
    modifiers: { hpMultiplier: 1.3 }
  });
  restored.startCombat(restored.pendingCombatStart.enemyId, restored.pendingCombatStart.modifiers);
  const intent = restored.getIntent();
  assert.equal(intent.hits, 4);
  assert.equal(intent.mechanicState.sourceCount, 3);
  assert.equal(intent.mechanicState.value, 2);
});

test("第一学期普通路线在周段边界逐步解锁敌人，后段开放完整池", () => {
  const foundation = ["sleepyBug", "alarmClock"];
  const status = ["sleepyBug", "alarmClock", "homeworkBlob", "phoneSpirit"];
  assert.deepEqual(
    FIRST_SEMESTER_NORMAL_ENEMY_POOLS.map(({ id, startWeek, endWeek }) => ({ id, startWeek, endWeek })),
    [
      { id: "foundation", startWeek: 1, endWeek: 5 },
      { id: "status", startWeek: 6, endWeek: 10 },
      { id: "full", startWeek: 11, endWeek: 16 }
    ]
  );
  assert.deepEqual([...normalRouteEnemyPool(1, 1)], foundation);
  assert.deepEqual([...normalRouteEnemyPool(1, 5)], foundation);
  assert.deepEqual([...normalRouteEnemyPool(1, 6)], status);
  assert.deepEqual([...normalRouteEnemyPool(1, 10)], status);
  assert.deepEqual([...normalRouteEnemyPool(1, 11)], NORMAL_ENEMY_IDS);
  assert.deepEqual([...normalRouteEnemyPool(1, 16)], NORMAL_ENEMY_IDS);
  assert.deepEqual([...normalRouteEnemyPool(2, 1)], NORMAL_ENEMY_IDS);

  const lateEnemiesSeen = new Set();
  for (let seed = 1; seed <= 120; seed += 1) {
    const game = new SemesterGame(seed, "cancer");
    for (let week = 3; week <= 15; week += 1) {
      const allowed = normalRouteEnemyPool(1, week);
      const normalRouteNodes = game.semesterPlan[week].filter((node) => (
        node.type === "combat" && node.challenge !== true && ENEMY_DEFS[node.enemy].kind === "normal"
      ));
      assert.ok(normalRouteNodes.every((node) => allowed.includes(node.enemy)));
      if (week >= 11) normalRouteNodes.forEach((node) => lateEnemiesSeen.add(node.enemy));
    }
  }
  assert.deepEqual([...lateEnemiesSeen].sort(), [...NORMAL_ENEMY_IDS].sort());
});

test("新路线让连续出现的普通与挑战战使用不同敌人", () => {
  for (let seed = 1; seed <= 1000; seed += 1) {
    const game = new SemesterGame(seed, "cancer");
    const routeCombats = game.semesterPlan.slice(3, 16)
      .flat()
      .filter((node) => node.type === "combat" && ENEMY_DEFS[node.enemy].kind === "normal");
    for (let index = 1; index < routeCombats.length; index += 1) {
      assert.notEqual(
        routeCombats[index].enemy,
        routeCombats[index - 1].enemy,
        `种子 ${seed} 的连续路线战斗重复了 ${routeCombats[index].enemy}`
      );
    }
  }
});

test("敌人排除规则只过滤最近敌人，单敌池仍能安全回退", () => {
  const game = new SemesterGame(305, "cancer");
  let receivedPool = null;
  game.rng.pick = (pool) => {
    receivedPool = [...pool];
    return pool[0];
  };
  assert.equal(game.randomEnemy({ source: "route", week: 4, exclude: "sleepyBug" }), "alarmClock");
  assert.deepEqual(receivedPool, ["alarmClock"]);

  const originalFoundation = FIRST_SEMESTER_NORMAL_ENEMY_POOLS[0].enemyIds;
  assert.equal(game.randomEnemy({ source: "route", week: 4, exclude: [...originalFoundation] }), "sleepyBug");
  assert.deepEqual(receivedPool, [...originalFoundation]);
});

test("教学考试与固定事件保持原位，挑战和怪谈继续使用完整普通敌人池", () => {
  const game = new SemesterGame(300, "cancer");
  game.rng = {
    pick(pool) {
      if (pool.length && pool.every((id) => NORMAL_ENEMY_IDS.includes(id))) return pool.at(-1);
      return pool[0];
    },
    shuffle(pool) {
      return [...pool];
    }
  };
  const plan = game.generateSemesterPlan();
  assert.equal(plan[1][0].enemy, "sleepyBug");
  assert.equal(plan[2][0].enemy, "homeworkBlob");
  assert.equal(plan[8][0].enemy, "rivalShadow");
  assert.equal(plan[16][0].enemy, "finalExam");
  assert.ok(plan[3].some((node) => node.type === "event" && node.pool === "safe"));
  assert.ok(plan[10].some((node) => node.type === "event" && node.pool === "all"));
  assert.ok(plan[13].some((node) => node.type === "event" && node.pool === "all"));
  assert.equal(plan[5].find((node) => node.challenge).enemy, "printerJam");
  assert.equal(plan[10].find((node) => node.challenge).enemy, "printerJam");

  let eventPool = null;
  game.rng.pick = (pool) => {
    eventPool = pool;
    return pool.at(-1);
  };
  assert.equal(game.randomEnemy(), "printerJam");
  assert.deepEqual([...eventPool], NORMAL_ENEMY_IDS);
});

test("同一种子生成相同路线，且固定周、节点差异与补给保底成立", () => {
  const first = new SemesterGame(301, "gemini");
  const second = new SemesterGame(301, "gemini");
  assert.deepEqual(first.semesterPlan, second.semesterPlan);
  assert.equal(first.semesterPlan.length, 17);
  assert.equal(first.semesterPlan[1][0].enemy, "sleepyBug");
  assert.equal(first.semesterPlan[2][0].enemy, "homeworkBlob");
  assert.equal(first.semesterPlan[8][0].enemy, "rivalShadow");
  assert.equal(first.semesterPlan[16][0].enemy, "finalExam");

  const openWeeks = [3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
  for (const week of openWeeks) {
    const nodes = first.semesterPlan[week];
    assert.equal(nodes.length, 2);
    assert.equal(new Set(nodes.map((node) => node.type)).size, 2);
    for (const node of nodes.filter((candidate) => candidate.type === "combat")) {
      assert.equal(ENEMY_DEFS[node.enemy].kind, "normal");
    }
  }
  const allNodes = first.semesterPlan.flat();
  assert.ok(allNodes.filter((node) => node.type === "rest").length >= 2);
  assert.ok(allNodes.filter((node) => node.type === "shop").length >= 2);
  const challenges = allNodes.filter((node) => node.challenge);
  assert.equal(challenges.length, 2);
  assert.ok(challenges.every((node) => CHALLENGE_AFFIX_DEFS[node.affix]));
  assert.equal(new Set(challenges.map((node) => node.affix)).size, 2);
  assert.equal(first.semesterPlan.slice(3, 8).flat().filter((node) => node.challenge).length, 1);
  assert.equal(first.semesterPlan.slice(9, 16).flat().filter((node) => node.challenge).length, 1);
  for (let week = 3; week <= 15; week += 1) {
    if (first.semesterPlan[week].some((node) => node.challenge)) {
      assert.ok(first.semesterPlan[week].some((node) => node.type !== "combat"));
    }
  }
});

test("路线随存档恢复，旧存档迁移也不会消耗后续随机数", () => {
  const game = new SemesterGame(302, "aries");
  game.week = 7;
  const saved = game.toJSON();
  const restored = SemesterGame.fromJSON(saved);
  assert.deepEqual(restored.semesterPlan, game.semesterPlan);
  assert.equal(restored.rng.state, saved.rngState);

  const versionElevenRoute = game.toJSON();
  for (const nodes of versionElevenRoute.semesterPlan) {
    for (const node of nodes) delete node.affix;
  }
  const migratedAffixes = SemesterGame.fromJSON(versionElevenRoute);
  assert.equal(migratedAffixes.rng.state, versionElevenRoute.rngState);
  assert.deepEqual(
    migratedAffixes.semesterPlan.flat().filter((node) => node.challenge).map((node) => node.enemy),
    versionElevenRoute.semesterPlan.flat().filter((node) => node.challenge).map((node) => node.enemy)
  );
  assert.equal(new Set(migratedAffixes.semesterPlan.flat().filter((node) => node.challenge).map((node) => node.affix)).size, 2);

  const versionOneRoute = game.toJSON();
  for (const nodes of versionOneRoute.semesterPlan) {
    for (const node of nodes) {
      delete node.challenge;
      delete node.affix;
    }
  }
  const migratedRoute = SemesterGame.fromJSON(versionOneRoute);
  assert.equal(migratedRoute.rng.state, versionOneRoute.rngState);
  assert.equal(migratedRoute.semesterPlan.flat().filter((node) => node.challenge).length, 2);
  assert.equal(new Set(migratedRoute.semesterPlan.flat().filter((node) => node.challenge).map((node) => node.affix)).size, 2);
  assert.deepEqual(
    migratedRoute.semesterPlan.flat().map(({ type, enemy }) => ({ type, enemy })),
    versionOneRoute.semesterPlan.flat().map(({ type, enemy }) => ({ type, enemy }))
  );

  const legacy = game.toJSON();
  delete legacy.semesterPlan;
  const migrated = SemesterGame.fromJSON(legacy);
  assert.equal(migrated.week, 7);
  assert.equal(migrated.rng.state, legacy.rngState);
  assert.equal(migrated.semesterPlan.length, 17);
  assert.ok(migrated.semesterPlan[7].length > 0);
});

test("旧存档中的超前敌人保持原路线，后续新学期才应用当前生成规则", () => {
  const game = new SemesterGame(304, "aries");
  const saved = game.toJSON();
  const savedWeekFourCombat = saved.semesterPlan[4].find((node) => node.type === "combat");
  savedWeekFourCombat.enemy = "printerJam";
  const restored = SemesterGame.fromJSON(saved);
  assert.equal(restored.semesterPlan[4].find((node) => node.type === "combat").enemy, "printerJam");
  assert.equal(restored.rng.state, saved.rngState);

  restored.semester = 1;
  restored.startNextSemester();
  assert.equal(restored.semester, 2);
  assert.deepEqual([...normalRouteEnemyPool(restored.semester, 1)], NORMAL_ENEMY_IDS);
});

test("挑战战公开强化数值，并记录挑战胜利与成就", () => {
  const game = new SemesterGame(303, "cancer");
  game.startCombat("alarmClock", {
    challenge: true,
    hpMultiplier: CHALLENGE_RULES.hpMultiplier,
    damageMultiplier: CHALLENGE_RULES.damageMultiplier,
    affix: "deadline"
  });
  assert.equal(game.combat.enemy.maxHp, 38);
  game.combat.enemy.intentTurn = 1;
  assert.equal(game.getIntent().attack, 9);
  game.combat.turn = 4;
  assert.equal(game.getIntent().attack, 13);

  game.combat.enemy.hp = 0;
  game.checkCombatEnd();
  const summary = game.combatSummary();
  assert.equal(summary.challenge, true);
  assert.equal(game.stats.challengeWins, 1);

  const profile = createCareerProfile();
  const unlocked = recordCareerCombat(profile, summary);
  assert.equal(profile.challengeWins, 1);
  assert.ok(unlocked.includes("challengeWon"));
});

test("挑战胜利的三条奖励路线数值公开、互斥选择并写入存档", () => {
  for (const [id, reward] of Object.entries(CHALLENGE_REWARD_DEFS)) {
    const game = new SemesterGame(330 + reward.gold, "aries");
    const beforeGold = game.gold;
    assert.equal(game.claimChallengeReward(id), reward);
    assert.equal(game.gold, beforeGold + reward.gold);
    assert.equal(game.stats.challengeRewardChoices[id], 1);
    assert.equal(
      Object.values(game.stats.challengeRewardChoices).reduce((sum, count) => sum + count, 0),
      1
    );

    const restored = SemesterGame.fromJSON(game.toJSON());
    assert.deepEqual(restored.stats.challengeRewardChoices, game.stats.challengeRewardChoices);
  }

  const invalid = new SemesterGame(399, "cancer");
  const beforeGold = invalid.gold;
  assert.equal(invalid.claimChallengeReward("unknown"), null);
  assert.equal(invalid.gold, beforeGold);
  assert.deepEqual(invalid.stats.challengeRewardChoices, { cards: 0, pet: 0, item: 0 });
});

test("挑战战复盘会固定试炼与路线状态，专属牌候选刷新后不重抽", () => {
  const game = new SemesterGame(524, "aries");
  game.week = 5;
  const goldBefore = game.gold;
  game.startCombat("sleepyBug", { challenge: true, affix: "deadline" });
  game.combat.enemy.hp = 0;
  game.checkCombatEnd();
  const summary = game.combatSummary();
  const pending = game.prepareChallengeCombatReward({
    affix: summary.challengeAffix,
    trialCompleted: summary.challengeTrial.completed,
    trialBonus: summary.challengeTrialBonus
  });

  assert.equal(game.gold, goldBefore + 10);
  assert.equal(pending.type, "challengeChain");
  assert.equal(pending.stage, "route");
  assert.equal(pending.trialCompleted, true);
  assert.equal(pending.trialBonus, 10);
  assert.equal(game.prepareChallengeCombatReward().started, false);
  assert.equal(game.gold, goldBefore + 10);

  const restoredAtRoute = SemesterGame.fromJSON(game.toJSON());
  assert.equal(restoredAtRoute.pendingCombatReward.stage, "route");
  assert.equal(restoredAtRoute.pendingCombatReward.affix, "deadline");
  assert.equal(restoredAtRoute.pendingCombatReward.trialBonus, 10);
  const goldAtRoute = restoredAtRoute.gold;
  assert.equal(restoredAtRoute.choosePendingChallengeReward("cards"), true);
  assert.equal(restoredAtRoute.gold, goldAtRoute + CHALLENGE_REWARD_DEFS.cards.gold);
  assert.equal(restoredAtRoute.pendingCombatReward.stage, "card");
  assert.equal(restoredAtRoute.pendingCombatReward.choices.length, 3);
  assert.equal(restoredAtRoute.pendingCombatReward.choices.every((id) => ARCHETYPE_CARD_IDS.aries.includes(id)), true);
  assert.equal(restoredAtRoute.stats.challengeRewardChoices.cards, 1);
  assert.equal(restoredAtRoute.choosePendingChallengeReward("pet"), false);
  assert.equal(restoredAtRoute.gold, goldAtRoute + CHALLENGE_REWARD_DEFS.cards.gold);

  const restoredAtCard = SemesterGame.fromJSON(restoredAtRoute.toJSON());
  assert.deepEqual(restoredAtCard.pendingCombatReward.choices, restoredAtRoute.pendingCombatReward.choices);
  assert.equal(restoredAtCard.gold, restoredAtRoute.gold);
  assert.equal(restoredAtCard.stats.challengeRewardChoices.cards, 1);
});

test("挑战物品候选会保存，物品收齐时 45 币替代奖励只结算一次", () => {
  const game = new SemesterGame(525, "gemini");
  game.week = 6;
  game.prepareChallengeCombatReward({ affix: "backlog" });
  const goldBefore = game.gold;
  assert.equal(game.choosePendingChallengeReward("item"), true);
  assert.equal(game.pendingCombatReward.stage, "item");
  assert.equal(game.pendingCombatReward.itemChoices.length, 2);
  assert.equal(game.gold, goldBefore + CHALLENGE_REWARD_DEFS.item.gold);
  const restoredAtItem = SemesterGame.fromJSON(game.toJSON());
  assert.deepEqual(restoredAtItem.pendingCombatReward.itemChoices, game.pendingCombatReward.itemChoices);

  const collected = new SemesterGame(526, "cancer");
  collected.week = 7;
  collected.backpackCapacity = 12;
  collected.items = [...REGULAR_ITEM_IDS];
  collected.prepareChallengeCombatReward({ affix: "earlyClass" });
  const collectedGold = collected.gold;
  assert.equal(collected.choosePendingChallengeReward("item"), true);
  assert.equal(collected.pendingCombatReward.stage, "complete");
  assert.equal(collected.pendingCombatReward.fallbackGold, CHALLENGE_REWARD_DEFS.item.fallbackGold);
  assert.equal(collected.gold, collectedGold + CHALLENGE_REWARD_DEFS.item.fallbackGold);
  assert.equal(collected.choosePendingChallengeReward("item"), false);
  assert.equal(collected.gold, collectedGold + CHALLENGE_REWARD_DEFS.item.fallbackGold);
  const restoredFallback = SemesterGame.fromJSON(collected.toJSON());
  assert.equal(restoredFallback.pendingCombatReward.stage, "complete");
  assert.equal(restoredFallback.pendingCombatReward.fallbackGold, CHALLENGE_REWARD_DEFS.item.fallbackGold);
  assert.equal(restoredFallback.gold, collected.gold);
});

test("只有挑战手机精的既有物品路线会固定静音手机，普通池与其他挑战不会混入", () => {
  assert.equal(CHALLENGE_SIGNATURE_ITEM_DROPS.phoneSpirit, "silentPhone");
  assert.equal(REGULAR_ITEM_IDS.includes("silentPhone"), false);

  const phoneChallenge = new SemesterGame(1525, "gemini");
  phoneChallenge.week = 6;
  const pending = phoneChallenge.prepareChallengeCombatReward({ affix: "backlog", enemyId: "phoneSpirit" });
  assert.equal(pending.signatureItemId, "silentPhone");
  const restoredRoute = SemesterGame.fromJSON(phoneChallenge.toJSON());
  assert.equal(restoredRoute.pendingCombatReward.signatureItemId, "silentPhone");
  const rngBeforeChoice = restoredRoute.rng.state;
  const goldBeforeChoice = restoredRoute.gold;
  assert.equal(restoredRoute.choosePendingChallengeReward("item"), true);
  assert.deepEqual(restoredRoute.pendingCombatReward.itemChoices, ["silentPhone"]);
  assert.equal(restoredRoute.rng.state, rngBeforeChoice, "确定掉落不应额外消耗随机数");
  assert.equal(restoredRoute.gold, goldBeforeChoice + CHALLENGE_REWARD_DEFS.item.gold);
  const restoredItem = SemesterGame.fromJSON(restoredRoute.toJSON());
  assert.deepEqual(restoredItem.pendingCombatReward.itemChoices, ["silentPhone"]);

  const alreadyOwned = new SemesterGame(1526, "aries");
  alreadyOwned.week = 7;
  assert.equal(alreadyOwned.addItem("silentPhone"), true);
  alreadyOwned.prepareChallengeCombatReward({ affix: "deadline", enemyId: "phoneSpirit" });
  assert.equal(alreadyOwned.pendingCombatReward.signatureItemId, null);
  assert.equal(alreadyOwned.choosePendingChallengeReward("item"), true);
  assert.equal(alreadyOwned.pendingCombatReward.itemChoices.length, 2);
  assert.equal(alreadyOwned.pendingCombatReward.itemChoices.every((id) => REGULAR_ITEM_IDS.includes(id)), true);

  const otherChallenge = new SemesterGame(1527, "cancer");
  otherChallenge.week = 9;
  otherChallenge.prepareChallengeCombatReward({ affix: "earlyClass", enemyId: "sleepyBug" });
  assert.equal(otherChallenge.pendingCombatReward.signatureItemId, null);
  assert.equal(otherChallenge.choosePendingChallengeReward("item"), true);
  assert.equal(otherChallenge.pendingCombatReward.itemChoices.includes("silentPhone"), false);
});

test("挑战手机精招牌物品在书包满时复用原有替换流程", () => {
  const game = new SemesterGame(1528, "aries");
  game.week = 6;
  game.items = REGULAR_ITEM_IDS.slice(0, game.backpackCapacity);
  game.prepareChallengeCombatReward({ affix: "backlog", enemyId: "phoneSpirit" });
  game.choosePendingChallengeReward("item");
  assert.deepEqual(game.pendingCombatReward.itemChoices, ["silentPhone"]);
  assert.deepEqual(game.prepareItemReplacement("silentPhone"), {
    incoming: "silentPhone",
    source: "combat",
    started: true
  });
  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.deepEqual(restored.pendingItemReplacement, { incoming: "silentPhone", source: "combat" });
  const outgoing = restored.items[0];
  const result = restored.replacePendingItem(outgoing);
  assert.equal(result.incoming, "silentPhone");
  assert.equal(restored.hasItem("silentPhone"), true);
  assert.equal(restored.items.length, restored.backpackCapacity);
});

test("旧版手机精挑战奖励存档会补全静音手机且不打断已开始的普通物品替换", () => {
  const routeGame = new SemesterGame(1529, "gemini");
  routeGame.week = 6;
  routeGame.prepareChallengeCombatReward({ affix: "backlog", enemyId: "phoneSpirit" });
  const legacyRouteSave = routeGame.toJSON();
  delete legacyRouteSave.pendingCombatReward.signatureItemId;
  const restoredRoute = SemesterGame.fromJSON(legacyRouteSave);
  assert.equal(restoredRoute.pendingCombatReward.signatureItemId, "silentPhone");
  assert.equal(restoredRoute.pendingCombatReward.stage, "route");

  const explicitNullSave = routeGame.toJSON();
  explicitNullSave.pendingCombatReward.signatureItemId = null;
  const restoredExplicitNull = SemesterGame.fromJSON(explicitNullSave);
  assert.equal(restoredExplicitNull.pendingCombatReward.signatureItemId, null);

  const itemGame = new SemesterGame(1530, "aries");
  itemGame.week = 7;
  itemGame.prepareChallengeCombatReward({ affix: "deadline", enemyId: "phoneSpirit" });
  itemGame.choosePendingChallengeReward("item");
  const legacyItemSave = itemGame.toJSON();
  delete legacyItemSave.pendingCombatReward.signatureItemId;
  legacyItemSave.pendingCombatReward.itemChoices = REGULAR_ITEM_IDS.slice(0, 2);
  const restoredItem = SemesterGame.fromJSON(legacyItemSave);
  assert.equal(restoredItem.pendingCombatReward.signatureItemId, "silentPhone");
  assert.deepEqual(restoredItem.pendingCombatReward.itemChoices, ["silentPhone"]);

  const replacementGame = new SemesterGame(1531, "cancer");
  replacementGame.week = 9;
  replacementGame.items = REGULAR_ITEM_IDS.slice(0, replacementGame.backpackCapacity);
  replacementGame.prepareChallengeCombatReward({ affix: "earlyClass", enemyId: "phoneSpirit" });
  replacementGame.choosePendingChallengeReward("item");
  const legacyReplacementSave = replacementGame.toJSON();
  const incoming = REGULAR_ITEM_IDS.find((id) => !legacyReplacementSave.items.includes(id));
  delete legacyReplacementSave.pendingCombatReward.signatureItemId;
  legacyReplacementSave.pendingCombatReward.itemChoices = [incoming];
  legacyReplacementSave.pendingItemReplacement = { incoming, source: "combat" };
  const restoredReplacement = SemesterGame.fromJSON(legacyReplacementSave);
  assert.equal(restoredReplacement.pendingCombatReward.signatureItemId, null);
  assert.deepEqual(restoredReplacement.pendingCombatReward.itemChoices, [incoming]);
  assert.deepEqual(restoredReplacement.pendingItemReplacement, { incoming, source: "combat" });
});

test("挑战宠物路线跨过羁绊里程碑时保存完成阶段且不会重复增加羁绊", () => {
  const game = new SemesterGame(527, "cancer");
  game.week = 9;
  game.pet.bond = 1;
  game.prepareChallengeCombatReward({ affix: "deadline" });
  const goldBefore = game.gold;

  assert.equal(game.choosePendingChallengeReward("pet"), true);
  assert.equal(game.pendingCombatReward.stage, "complete");
  assert.equal(game.pet.bond, 3);
  assert.equal(game.pet.pendingMilestone, "choose");
  assert.equal(game.gold, goldBefore + CHALLENGE_REWARD_DEFS.pet.gold);
  assert.equal(game.stats.challengeRewardChoices.pet, 1);
  assert.equal(game.choosePendingChallengeReward("pet"), false);
  assert.equal(game.pet.bond, 3);

  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.equal(restored.pendingCombatReward.stage, "complete");
  assert.equal(restored.pendingCombatReward.route, "pet");
  assert.equal(restored.pet.bond, 3);
  assert.equal(restored.pet.pendingMilestone, "choose");
  assert.equal(restored.gold, game.gold);
});

test("怪谈战会固定稀有物品候选，刷新恢复时不重抽", () => {
  const game = new SemesterGame(528, "aries");
  game.week = 10;
  const goldBefore = game.gold;
  const pending = game.prepareEventCombatReward();
  const rngAfterReward = game.rng.state;
  const rareItems = REGULAR_ITEM_IDS.filter((id) => ITEM_DEFS[id].rarity === "rare");

  assert.equal(pending.type, "eventItem");
  assert.equal(pending.stage, "item");
  assert.equal(pending.started, true);
  assert.equal(pending.itemChoices.length, Math.min(2, rareItems.length));
  assert.equal(pending.itemChoices.every((id) => ITEM_DEFS[id].rarity === "rare"), true);
  assert.equal(game.gold, goldBefore);
  assert.deepEqual(game.prepareEventCombatReward().itemChoices, pending.itemChoices);
  assert.equal(game.rng.state, rngAfterReward);

  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.deepEqual(restored.pendingCombatReward, {
    type: "eventItem",
    stage: "item",
    choices: [],
    itemChoices: pending.itemChoices,
    usedCardUids: [],
    fallbackGold: 0
  });
  assert.equal(restored.rng.state, rngAfterReward);
  assert.equal(restored.gold, goldBefore);
});

test("怪谈战没有稀有物品时回退到一件普通候选，全部收齐后 70 币只发一次", () => {
  const rareItems = REGULAR_ITEM_IDS.filter((id) => ITEM_DEFS[id].rarity === "rare");
  const withoutRares = new SemesterGame(529, "gemini");
  withoutRares.week = 11;
  withoutRares.backpackCapacity = 12;
  withoutRares.items = [...rareItems];
  const itemPending = withoutRares.prepareEventCombatReward();
  assert.equal(itemPending.stage, "item");
  assert.equal(itemPending.itemChoices.length, 1);
  assert.notEqual(ITEM_DEFS[itemPending.itemChoices[0]].rarity, "rare");

  const collected = new SemesterGame(530, "cancer");
  collected.week = 12;
  collected.backpackCapacity = 12;
  collected.items = [...REGULAR_ITEM_IDS];
  const goldBefore = collected.gold;
  const fallback = collected.prepareEventCombatReward();
  assert.equal(fallback.stage, "complete");
  assert.equal(fallback.fallbackGold, ITEM_REWARD_FALLBACK_GOLD.event);
  assert.equal(collected.gold, goldBefore + ITEM_REWARD_FALLBACK_GOLD.event);
  assert.equal(collected.prepareEventCombatReward().started, false);
  assert.equal(collected.gold, goldBefore + ITEM_REWARD_FALLBACK_GOLD.event);

  const restored = SemesterGame.fromJSON(collected.toJSON());
  assert.equal(restored.pendingCombatReward.stage, "complete");
  assert.equal(restored.pendingCombatReward.fallbackGold, ITEM_REWARD_FALLBACK_GOLD.event);
  assert.equal(restored.gold, collected.gold);
});

test("白羊、双子与巨蟹拥有不同且公开的星座试炼", () => {
  assert.deepEqual(Object.keys(ARCHETYPE_TRIAL_DEFS), ["aries", "gemini", "cancer"]);
  assert.equal(new Set(Object.values(ARCHETYPE_TRIAL_DEFS).map((trial) => trial.id)).size, 3);
  assert.ok(Object.values(ARCHETYPE_TRIAL_DEFS).every((trial) => trial.bonusGold === 10));

  const aries = new SemesterGame(401, "aries");
  const ariesGold = aries.gold;
  aries.startCombat("sleepyBug", { challenge: true, affix: "deadline" });
  assert.equal(aries.stats.trialsAttempted, 1);
  aries.combat.enemy.hp = 0;
  aries.checkCombatEnd();
  assert.equal(aries.combatSummary().challengeTrial.archetypeId, "aries");
  assert.equal(aries.combatSummary().challengeTrial.completed, true);
  assert.equal(aries.combatSummary().challengeTrialBonus, 10);
  assert.equal(aries.gold, ariesGold + 10);
  assert.equal(aries.stats.trialsCompleted, 1);
  aries.checkCombatEnd();
  assert.equal(aries.gold, ariesGold + 10);

  const lateAries = new SemesterGame(402, "aries");
  lateAries.startCombat("sleepyBug", { challenge: true, affix: "deadline" });
  lateAries.combat.turn = 4;
  lateAries.combat.enemy.hp = 0;
  lateAries.checkCombatEnd();
  assert.equal(lateAries.combatSummary().challengeTrial.state, "failed");
  assert.equal(lateAries.combatSummary().challengeTrialBonus, 0);

  const gemini = new SemesterGame(403, "gemini");
  gemini.startCombat("sleepyBug", { challenge: true, affix: "earlyClass" });
  gemini.combat.hand = Array.from({ length: 4 }, () => gemini.createCard("cramming"));
  gemini.combat.drawPile = [];
  gemini.combat.discardPile = [];
  for (const card of [...gemini.combat.hand]) assert.equal(gemini.playCard(card.uid).ok, true);
  assert.equal(gemini.challengeTrialStatus().state, "achieved");
  gemini.combat.enemy.hp = 0;
  gemini.checkCombatEnd();
  assert.equal(gemini.combatSummary().challengeTrial.completed, true);

  const cancer = new SemesterGame(404, "cancer");
  cancer.startCombat("sleepyBug", { challenge: true, affix: "backlog" });
  cancer.hp -= 5;
  cancer.combat.enemy.hp = 0;
  cancer.checkCombatEnd();
  assert.equal(cancer.combatSummary().challengeTrial.completed, true);

  const hurtCancer = new SemesterGame(405, "cancer");
  hurtCancer.startCombat("sleepyBug", { challenge: true, affix: "backlog" });
  hurtCancer.hp -= 6;
  hurtCancer.combat.enemy.hp = 0;
  hurtCancer.checkCombatEnd();
  assert.equal(hurtCancer.combatSummary().challengeTrial.state, "failed");
});

test("星座试炼统计写入存档，旧存档缺少字段时安全补零", () => {
  const game = new SemesterGame(406, "aries");
  game.startCombat("sleepyBug", { challenge: true, affix: "deadline" });
  game.combat.enemy.hp = 0;
  game.checkCombatEnd();
  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.equal(restored.stats.trialsAttempted, 1);
  assert.equal(restored.stats.trialsCompleted, 1);

  const legacy = game.toJSON();
  delete legacy.stats.trialsAttempted;
  delete legacy.stats.trialsCompleted;
  const migrated = SemesterGame.fromJSON(legacy);
  assert.equal(migrated.stats.trialsAttempted, 0);
  assert.equal(migrated.stats.trialsCompleted, 0);
});

test("三张塔罗契约都有一句话收益与代价，并真实改变战斗开局", () => {
  assert.deepEqual(Object.keys(TAROT_DEFS), ["chariot", "strength", "hermit"]);
  assert.ok(Object.values(TAROT_DEFS).every((tarot) => tarot.boon && tarot.cost));

  const chariot = new SemesterGame(501, "aries");
  assert.equal(chariot.chooseTarot("chariot"), true);
  assert.equal(chariot.chooseTarot("hermit"), false);
  chariot.startCombat("sleepyBug");
  assert.equal(chariot.combat.enemy.maxHp, 23);
  assert.equal(chariot.combat.energy, 4);

  const strength = new SemesterGame(502, "gemini");
  strength.chooseTarot("strength");
  strength.startCombat("sleepyBug");
  assert.equal(strength.pet.charge, 1);
  assert.equal(strength.getIntent().attack, 7);

  const hermit = new SemesterGame(503, "cancer");
  hermit.chooseTarot("hermit");
  hermit.startCombat("sleepyBug");
  assert.equal(hermit.combat.hand.length, 7);
  assert.equal(hermit.combat.enemy.block, 8);
});

test("塔罗选择写入存档，每个新学期重新选择且旧存档安全补空", () => {
  const game = new SemesterGame(504, "aries");
  game.chooseTarot("hermit");
  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.equal(restored.tarotId, "hermit");
  assert.deepEqual(restored.stats.tarotChoices, { chariot: 0, strength: 0, hermit: 1 });

  restored.startNextSemester();
  assert.equal(restored.tarotId, null);
  assert.equal(restored.chooseTarot("chariot"), true);
  assert.deepEqual(restored.stats.tarotChoices, { chariot: 1, strength: 0, hermit: 1 });

  const legacy = game.toJSON();
  delete legacy.tarotId;
  delete legacy.stats.tarotChoices;
  const migrated = SemesterGame.fromJSON(legacy);
  assert.equal(migrated.tarotId, null);
  assert.deepEqual(migrated.stats.tarotChoices, { chariot: 0, strength: 0, hermit: 0 });
});

test("三种塔罗在休息点各提供一次有代价的专属共鸣", () => {
  const chariot = new SemesterGame(505, "aries");
  chariot.chooseTarot("chariot");
  assert.equal(chariot.tarotRestStatus().available, true);
  const chariotResult = chariot.resolveTarotRest();
  assert.equal(chariotResult.action, "remove");
  assert.equal(chariot.hp, 44);
  assert.equal(chariot.resolveTarotRest().ok, false);

  const fragileChariot = new SemesterGame(506, "aries");
  fragileChariot.chooseTarot("chariot");
  fragileChariot.hp = 6;
  assert.equal(fragileChariot.tarotRestStatus().available, false);
  assert.match(fragileChariot.tarotRestStatus().reason, /至少需要 7 点生命/);

  const strength = new SemesterGame(507, "gemini");
  strength.chooseTarot("strength");
  strength.hp = 40;
  const strengthResult = strength.resolveTarotRest();
  assert.deepEqual(
    { action: strengthResult.action, healed: strengthResult.healed, bond: strengthResult.bond },
    { action: "bond", healed: 6, bond: 4 }
  );
  assert.equal(strength.gold, 20);
  assert.equal(strength.hp, 46);
  assert.equal(strength.pet.bond, 4);
  assert.equal(strength.pet.pendingMilestone, "choose");

  const hermit = new SemesterGame(508, "cancer");
  hermit.chooseTarot("hermit");
  hermit.hp = 45;
  const hermitResult = hermit.resolveTarotRest();
  assert.equal(hermitResult.action, "upgrade");
  assert.equal(hermit.gold, 15);
  assert.equal(hermit.hp, 50);
  assert.equal(hermit.stats.tarotRestUses, 1);
  hermit.startNextSemester();
  assert.equal(hermit.flags.tarotRestUsed, false);
});

test("塔罗共鸣预览给出真实前后值且不会提前支付代价", () => {
  const game = new SemesterGame(509, "gemini");
  game.chooseTarot("strength");
  game.hp = 47;
  const before = game.toJSON();
  const preview = game.tarotRestPreview();

  assert.equal(preview.available, true);
  assert.deepEqual(preview.before, { hp: 47, gold: 50, bond: 0, deckSize: 10, upgradedCards: 0 });
  assert.deepEqual(preview.after, { hp: 50, gold: 20, bond: 4, deckSize: 10, upgradedCards: 0 });
  assert.deepEqual(game.toJSON(), before);
  assert.equal(game.flags.tarotRestUsed, false);
  assert.equal(game.stats.tarotRestUses, 0);
});

test("休息节点与普通升级候选会保存，刷新后不能返回地图改选路线", () => {
  const game = new SemesterGame(539, "cancer");
  game.chooseTarot("strength");
  game.week = findRouteWeek(game, "rest");

  const entered = game.prepareRest();
  assert.deepEqual(entered, { stage: "choice", cardUids: [], started: true });
  assert.equal(game.prepareShop(), null);
  const upgrade = game.prepareRestUpgrade();
  assert.equal(upgrade.stage, "upgrade");
  assert.deepEqual(upgrade.cardUids, game.deck.map((card) => card.uid));

  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.deepEqual(restored.pendingRest, {
    stage: "upgrade",
    cardUids: game.deck.map((card) => card.uid)
  });
  assert.deepEqual(restored.loadRepairs, []);
  const chosenUid = restored.pendingRest.cardUids[0];
  assert.deepEqual(restored.resolvePendingRestCard(chosenUid), { stage: "upgrade", uid: chosenUid });
  assert.equal(restored.deck.find((card) => card.uid === chosenUid).upgraded, true);
  assert.equal(restored.pendingRest, null);
  assert.equal(restored.resolvePendingRestCard(chosenUid), null);
});

test("休息恢复与陪伴会原子结算，宠物里程碑可跨刷新继续", () => {
  const heal = new SemesterGame(540, "gemini");
  heal.chooseTarot("hermit");
  heal.week = findRouteWeek(heal, "rest");
  heal.hp = 31;
  heal.prepareRest();
  assert.deepEqual(heal.resolveRestHeal(), { healed: 15 });
  assert.equal(heal.hp, 46);
  assert.equal(heal.pendingRest, null);
  assert.equal(heal.resolveRestHeal(), null);

  const pet = new SemesterGame(541, "aries");
  pet.chooseTarot("chariot");
  pet.week = findRouteWeek(pet, "rest");
  pet.pet.bond = 2;
  pet.prepareRest();
  assert.deepEqual(pet.resolveRestPet(), { bond: 2, pendingMilestone: "choose" });
  const restored = SemesterGame.fromJSON(pet.toJSON());
  assert.deepEqual(restored.pendingRest, { stage: "pet", cardUids: [], bond: 2, healed: 0 });
  assert.equal(restored.pet.bond, 4);
  assert.equal(restored.resolvePetMilestone("scout"), true);
  assert.equal(restored.completePendingRest(), true);
  assert.equal(restored.pendingRest, null);
});

test("塔罗共鸣支付后的选牌阶段会保存，异常休息状态会被清理", () => {
  const game = new SemesterGame(542, "aries");
  game.chooseTarot("chariot");
  game.week = findRouteWeek(game, "rest");
  game.prepareRest();
  assert.equal(game.resolveTarotRest().action, "remove");
  assert.equal(game.hp, 44);
  assert.equal(game.flags.tarotRestUsed, true);
  assert.equal(game.pendingRest.stage, "tarotRemove");

  const restored = SemesterGame.fromJSON(game.toJSON());
  const removedUid = restored.pendingRest.cardUids[0];
  assert.deepEqual(restored.resolvePendingRestCard(removedUid), { stage: "tarotRemove", uid: removedUid });
  assert.equal(restored.hp, 44);
  assert.equal(restored.deck.length, 9);
  assert.equal(restored.resolveTarotRest().ok, false);

  const corrupted = game.toJSON();
  corrupted.pendingRest.cardUids = ["not-a-real-card"];
  const repaired = SemesterGame.fromJSON(corrupted);
  assert.equal(repaired.pendingRest, null);
  assert.equal(repaired.loadRepairs.some((note) => /休息节点状态/.test(note)), true);
});

test("事件会禁用空收益与付不起代价的选择，并显示真实恢复量", () => {
  const game = new SemesterGame(510, "cancer");
  const pristine = game.toJSON();

  assert.deepEqual(game.eventChoiceStatus("rumor-heal"), {
    choice: "rumor-heal",
    available: false,
    reason: "生命已经全满",
    actualHeal: 0
  });
  assert.deepEqual(game.toJSON(), pristine);
  game.hp = 48;
  assert.equal(game.eventChoiceStatus("rumor-heal").available, true);
  assert.equal(game.eventChoiceStatus("rumor-heal").actualHeal, 2);

  game.hp = 5;
  assert.match(game.eventChoiceStatus("quiz-upgrade").reason, /至少需要 6 点生命/);
  game.hp = 50;
  game.deck.forEach((card) => { card.upgraded = true; });
  assert.match(game.eventChoiceStatus("quiz-upgrade").reason, /没有可升级的牌/);

  game.flags.nextShopHalf = true;
  assert.match(game.eventChoiceStatus("meal-sale").reason, /优惠已经生效/);
  game.gold = 29;
  assert.match(game.eventChoiceStatus("club-pet").reason, /需要 30 校园币/);
  game.gold = 49;
  assert.match(game.eventChoiceStatus("locker-remove").reason, /需要 50 校园币/);
  game.hp = 6;
  assert.match(game.eventChoiceStatus("locker-open").reason, /至少需要 7 点生命/);
});

test("确定性事件代价会给出无副作用的真实前后预览", () => {
  const game = new SemesterGame(511, "cancer");
  game.hp = 20;
  game.gold = 80;
  game.pet.bond = 2;
  const before = game.toJSON();

  assert.deepEqual(game.eventChoicePreview("quiz-upgrade").after, {
    hp: 15,
    gold: 80,
    bond: 2,
    deckSize: 10,
    upgradedCards: 1
  });
  assert.deepEqual(game.eventChoicePreview("club-pet").after, {
    hp: 20,
    gold: 50,
    bond: 4,
    deckSize: 10,
    upgradedCards: 0
  });
  assert.equal(game.eventChoicePreview("locker-open").after.hp, 14);
  assert.equal(game.eventChoicePreview("locker-remove").after.gold, 30);
  assert.equal(game.eventChoicePreview("locker-remove").after.deckSize, 9);
  assert.deepEqual(game.toJSON(), before);
});

test("物品候选只返回未拥有物品，普通物品收齐后禁用对应事件", () => {
  const game = new SemesterGame(512, "cancer");
  const commonItems = REGULAR_ITEM_IDS.filter((id) => ITEM_DEFS[id].rarity === "common");
  game.items = [...commonItems];

  assert.deepEqual(game.availableItemIds({ rarity: "common" }), []);
  assert.match(game.eventChoiceStatus("box-open").reason, /普通物品已经收齐/);
  assert.match(game.eventChoiceStatus("locker-open").reason, /普通物品已经收齐/);
  assert.equal(game.eventChoiceStatus("box-pet").available, true);

  game.items = [...REGULAR_ITEM_IDS, BOSS_ITEM_IDS[0]];
  assert.deepEqual(game.availableItemIds(), []);
  assert.deepEqual(game.availableItemIds({ ids: BOSS_ITEM_IDS }), [BOSS_ITEM_IDS[1]]);
  assert.equal(game.randomItem(), null);

  const gold = game.gold;
  assert.deepEqual(game.claimItemRewardFallback("elite"), { source: "elite", gold: 50, totalGold: gold + 50 });
  assert.deepEqual(game.claimItemRewardFallback("event"), { source: "event", gold: 70, totalGold: gold + 120 });
  assert.deepEqual(game.claimItemRewardFallback("boss"), { source: "boss", gold: 100, totalGold: gold + 220 });
  assert.equal(game.claimItemRewardFallback("unknown"), null);
});

test("受污染存档的战绩计数会恢复为可安全累加的非负整数", () => {
  const saved = new SemesterGame(407, "gemini").toJSON();
  saved.pet = {
    ...saved.pet,
    name: "<img src=x onerror=alert(1)>",
    bond: "8",
    charge: 99,
    maxCharge: "not-a-number"
  };
  saved.stats.cardsPlayed = "7";
  saved.stats.combatTurns = -3;
  saved.stats.petUses = 2.8;
  saved.stats.tarotRestUses = "3";
  saved.stats.combatsWon = "not-a-number";
  saved.stats.cardPlays = { cramming: "4", textbookStrike: -2, unknown: 99 };
  saved.stats.tarotChoices = { chariot: "2", strength: -1, hermit: 1.8, unknown: 99 };
  saved.stats.challengeRewardChoices = { cards: "3", pet: 1.9, item: -4 };
  saved.flags.tarotRestUsed = "true";

  const restored = SemesterGame.fromJSON(saved);

  assert.equal(restored.pet.id, "offlineDuck");
  assert.equal(restored.pet.name, "宕机鸭");
  assert.equal(restored.pet.bond, 8);
  assert.equal(restored.pet.maxCharge, 2);
  assert.equal(restored.pet.charge, 2);
  assert.equal(restored.stats.cardsPlayed, 7);
  assert.equal(restored.stats.combatTurns, 0);
  assert.equal(restored.stats.petUses, 2);
  assert.equal(restored.stats.tarotRestUses, 3);
  assert.equal(restored.stats.combatsWon, 0);
  assert.deepEqual(restored.stats.cardPlays, { cramming: 4, textbookStrike: 0 });
  assert.deepEqual(restored.stats.tarotChoices, { chariot: 2, strength: 0, hermit: 1 });
  assert.deepEqual(restored.stats.challengeRewardChoices, { cards: 3, pet: 1, item: 0 });
  assert.equal(restored.flags.tarotRestUsed, false);
});

test("受污染存档不会用重复物品占满书包，临时标志恢复为安全类型", () => {
  const saved = new SemesterGame(513, "aries").toJSON();
  saved.backpackCapacity = 7;
  saved.items = [
    "autoPencil", "autoPencil", "unknown", "studentId", "studentId",
    "bandage", "earplugs", "mistakeBook", "petSnack", "eraser", "thickNotebook"
  ];
  saved.flags = {
    ...saved.flags,
    nextCombatTension: "3",
    nextEnemyBlock: -6,
    petSnackCombats: 2.9,
    nextShopHalf: "true",
    eraserUsed: 1,
    tarotRestUsed: true,
    injectedFlag: 999
  };

  const restored = SemesterGame.fromJSON(saved);

  assert.deepEqual(restored.items, [
    "autoPencil", "studentId", "bandage", "earplugs", "mistakeBook", "petSnack", "eraser"
  ]);
  assert.equal(restored.items.length, restored.backpackCapacity);
  assert.deepEqual(restored.flags, {
    nextCombatTension: 3,
    nextEnemyBlock: 0,
    petSnackCombats: 2,
    nextShopHalf: false,
    eraserUsed: false,
    tarotRestUsed: true
  });
  assert.equal(restored.loadRepairs.some((note) => /重复或无效物品/.test(note)), true);
  assert.equal(restored.loadRepairs.some((note) => /异常临时状态/.test(note)), true);
});

test("受污染卡组会重建唯一 UID、移除状态牌并保留可恢复构筑", () => {
  const saved = new SemesterGame(514, "aries").toJSON();
  saved.cardSerial = -20;
  saved.deck = [
    { id: "textbookStrike", uid: "duplicate", upgraded: "true", enchantment: "ariesFlame" },
    { id: "backpackGuard", uid: "duplicate", upgraded: false, enchantment: "ariesFlame" },
    { id: "classSprint", uid: "<script>", upgraded: true, enchantment: null },
    { id: "todo", uid: "status-card", upgraded: true, enchantment: null },
    { id: "unknown", uid: "unknown-card", upgraded: true, enchantment: null }
  ];
  saved.cardCombatUses = { duplicate: "4", "<script>": 99, "status-card": 8, ghost: 12 };

  const restored = SemesterGame.fromJSON(saved);
  const uids = restored.deck.map((card) => card.uid);

  assert.equal(restored.deck.length, 5);
  assert.equal(restored.deck.some((card) => CARD_DEFS[card.id].type === "status"), false);
  assert.equal(new Set(uids).size, uids.length);
  assert.equal(uids.every((uid) => /^[A-Za-z0-9_-]{1,64}$/.test(uid)), true);
  assert.equal(restored.deck[0].upgraded, false);
  assert.equal(restored.deck[0].enchantment, "ariesFlame");
  assert.equal(restored.deck[1].enchantment, null);
  assert.deepEqual(restored.cardCombatUses, { duplicate: 4 });
  assert.equal(restored.loadRepairs.some((note) => /无效或临时牌/.test(note)), true);
  assert.equal(restored.loadRepairs.some((note) => /卡牌编号/.test(note)), true);
  assert.equal(restored.loadRepairs.some((note) => /基础牌/.test(note)), true);
  assert.equal(restored.loadRepairs.some((note) => /卡牌使用记录/.test(note)), true);
  const added = restored.addCard("catCombo");
  assert.equal(uids.includes(added.uid), false);

  const unusable = saved;
  unusable.deck = [{ id: "todo", uid: "only-status" }, { id: "unknown", uid: "bad" }];
  const rebuilt = SemesterGame.fromJSON(unusable);
  assert.deepEqual(rebuilt.deck.map((card) => card.id), startingDeckFor("aries"));
  assert.equal(rebuilt.loadRepairs.some((note) => /重建完整初始卡组/.test(note)), true);
});

test("桌面爆满与第一节早课词缀分别污染牌堆和压缩首回合能量", () => {
  const backlog = new SemesterGame(304, "gemini");
  backlog.startCombat("sleepyBug", { challenge: true, affix: "backlog" });
  const backlogCards = [...backlog.combat.hand, ...backlog.combat.drawPile, ...backlog.combat.discardPile];
  assert.equal(backlogCards.filter((card) => card.id === "todo").length, 2);
  assert.equal(backlogCards.length, backlog.deck.length + 2);

  const earlyClass = new SemesterGame(305, "cancer");
  earlyClass.startCombat("sleepyBug", { challenge: true, affix: "earlyClass" });
  assert.equal(earlyClass.combat.energy, 2);
  assert.match(earlyClass.combat.log.join("\n"), /第一节早课：本回合少 1 点能量/);
});

test("无尽学期保留构筑并施加明确的成长代价", () => {
  const game = new SemesterGame(7);
  game.addCard("catCombo");
  game.pet.bond = 8;
  game.hp = 1;
  game.startNextSemester();

  assert.equal(game.semester, 2);
  assert.equal(game.week, 1);
  assert.equal(game.deck.length, 11);
  assert.equal(game.pet.bond, 8);
  assert.equal(game.maxHp, 52);
  assert.equal(game.hp, 52);
  assert.equal(game.backpackCapacity, 7);
  assert.equal(game.tarotId, null);
});

test("期末完成状态可保存恢复，并在进入下一学期后清除", () => {
  const game = new SemesterGame(517, "cancer");

  assert.equal(game.completeCurrentSemester(), false);
  assert.equal(game.awaitingNextSemester, false);
  game.week = 16;
  assert.equal(game.completeCurrentSemester(), true);
  assert.equal(game.awaitingNextSemester, true);

  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.equal(restored.semester, 1);
  assert.equal(restored.week, 16);
  assert.equal(restored.awaitingNextSemester, true);
  assert.deepEqual(restored.loadRepairs, []);

  restored.startNextSemester();
  assert.equal(restored.semester, 2);
  assert.equal(restored.week, 1);
  assert.equal(restored.awaitingNextSemester, false);

  const corrupted = game.toJSON();
  corrupted.week = 4;
  corrupted.awaitingNextSemester = true;
  const repaired = SemesterGame.fromJSON(corrupted);
  assert.equal(repaired.awaitingNextSemester, false);
  assert.equal(repaired.loadRepairs.some((note) => /学期完成状态/.test(note)), true);
});

test("Boss 胜利后的纪念物与总结升级按阶段保存且不会重复发奖", () => {
  const game = new SemesterGame(518, "aries");
  game.week = 16;
  const goldBefore = game.gold;
  const pending = game.prepareSemesterRewards(BOSS_ITEM_IDS);

  assert.equal(pending.stage, "bossItem");
  assert.equal(pending.started, true);
  assert.deepEqual(pending.itemChoices, BOSS_ITEM_IDS);
  assert.equal(game.gold, goldBefore + 50);
  assert.equal(game.prepareSemesterRewards(BOSS_ITEM_IDS).started, false);
  assert.equal(game.gold, goldBefore + 50);

  const itemStage = SemesterGame.fromJSON(game.toJSON());
  assert.deepEqual(itemStage.pendingSemesterReward, {
    stage: "bossItem",
    itemChoices: BOSS_ITEM_IDS
  });
  assert.equal(itemStage.advanceSemesterRewards(), true);
  const summaryStage = SemesterGame.fromJSON(itemStage.toJSON());
  assert.deepEqual(summaryStage.pendingSemesterReward, {
    stage: "summaryUpgrade",
    itemChoices: [],
    fallbackGold: 0
  });

  assert.equal(summaryStage.completeCurrentSemester(), true);
  assert.equal(summaryStage.pendingSemesterReward, null);
  assert.equal(summaryStage.awaitingNextSemester, true);
});

test("Boss 物品收齐时待结算状态只发放一次替代校园币", () => {
  const game = new SemesterGame(519, "gemini");
  game.week = 16;
  game.items = [...BOSS_ITEM_IDS];
  const pending = game.prepareSemesterRewards(BOSS_ITEM_IDS);

  assert.deepEqual(pending, {
    stage: "summaryUpgrade",
    itemChoices: [],
    fallbackGold: 100,
    started: true
  });
  assert.equal(game.gold, 200);
  game.prepareSemesterRewards(BOSS_ITEM_IDS);
  assert.equal(game.gold, 200);

  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.deepEqual(restored.pendingSemesterReward, {
    stage: "summaryUpgrade",
    itemChoices: [],
    fallbackGold: 100
  });
});

test("普通战奖励候选与金币在复盘时固定，恢复后不会重复生成", () => {
  const game = new SemesterGame(520, "cancer");
  const goldBefore = game.gold;
  const pending = game.prepareNormalCombatReward();
  const rngAfterReward = game.rng.state;

  assert.equal(pending.type, "normalCard");
  assert.equal(pending.started, true);
  assert.equal(pending.choices.length, 3);
  assert.equal(pending.choices.filter((id) => CARD_DEFS[id].archetype === "cancer").length, 1);
  assert.equal(game.gold, goldBefore + 15);
  assert.deepEqual(game.prepareNormalCombatReward().choices, pending.choices);
  assert.equal(game.gold, goldBefore + 15);
  assert.equal(game.rng.state, rngAfterReward);

  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.deepEqual(restored.pendingCombatReward, {
    type: "normalCard",
    choices: pending.choices
  });
  assert.equal(restored.gold, goldBefore + 15);
  assert.equal(restored.rng.state, rngAfterReward);
  assert.equal(restored.completePendingCombatReward(), true);
  assert.equal(restored.pendingCombatReward, null);
});

test("普通战橡皮擦重抽后的候选会替换待结算存档", () => {
  const game = new SemesterGame(521, "gemini");
  const first = game.prepareNormalCombatReward().choices;
  const rerolled = game.rewardCards(3);

  assert.equal(game.replacePendingCombatRewardChoices(rerolled), true);
  assert.notDeepEqual(rerolled, first);
  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.deepEqual(restored.pendingCombatReward.choices, rerolled);

  const corrupted = game.toJSON();
  corrupted.pendingCombatReward = { type: "normalCard", choices: ["unknown", "ariesRush"] };
  const repaired = SemesterGame.fromJSON(corrupted);
  assert.equal(repaired.pendingCombatReward, null);
  assert.equal(repaired.loadRepairs.some((note) => /战斗奖励状态/.test(note)), true);
});

test("精英战的卡牌、物品与刻印奖励可逐段保存，恢复时不重复发币或重抽", () => {
  const game = new SemesterGame(522, "aries");
  game.week = 8;
  const usedCardUids = [game.deck[0].uid, game.deck[1].uid];
  const goldBefore = game.gold;
  const pending = game.prepareEliteCombatReward(usedCardUids);
  const rngAfterCardReward = game.rng.state;

  assert.equal(pending.type, "eliteChain");
  assert.equal(pending.stage, "card");
  assert.equal(pending.started, true);
  assert.equal(pending.choices.length, 3);
  assert.deepEqual(pending.usedCardUids, usedCardUids);
  assert.equal(game.gold, goldBefore + 30);
  assert.deepEqual(game.prepareEliteCombatReward().choices, pending.choices);
  assert.equal(game.gold, goldBefore + 30);
  assert.equal(game.rng.state, rngAfterCardReward);

  const rerolled = game.rewardCards(3);
  assert.equal(game.replacePendingCombatRewardChoices(rerolled), true);
  assert.deepEqual(game.pendingCombatReward.choices, rerolled);
  assert.equal(game.advanceEliteCombatRewardFromCard(), true);
  assert.equal(game.pendingCombatReward.stage, "item");
  assert.equal(game.pendingCombatReward.itemChoices.length, 2);
  assert.equal(game.advanceEliteCombatRewardFromCard(), false);

  const restoredAtItem = SemesterGame.fromJSON(game.toJSON());
  assert.equal(restoredAtItem.pendingCombatReward.stage, "item");
  assert.deepEqual(restoredAtItem.pendingCombatReward.itemChoices, game.pendingCombatReward.itemChoices);
  assert.deepEqual(restoredAtItem.pendingCombatReward.usedCardUids, usedCardUids);
  assert.equal(restoredAtItem.gold, goldBefore + 30);

  assert.equal(restoredAtItem.advanceEliteCombatRewardFromItem(), true);
  assert.equal(restoredAtItem.pendingCombatReward.stage, "enchant");
  assert.equal(restoredAtItem.advanceEliteCombatRewardFromItem(), false);
  const restoredAtEnchant = SemesterGame.fromJSON(restoredAtItem.toJSON());
  assert.equal(restoredAtEnchant.pendingCombatReward.stage, "enchant");
  assert.deepEqual(restoredAtEnchant.pendingCombatReward.usedCardUids, usedCardUids);
  assert.equal(restoredAtEnchant.completePendingCombatReward(), true);
  assert.equal(restoredAtEnchant.pendingCombatReward, null);
});

test("精英物品收齐时只发放一次替代校园币，并直接进入刻印阶段", () => {
  const game = new SemesterGame(523, "cancer");
  game.week = 8;
  game.backpackCapacity = 12;
  game.items = [...REGULAR_ITEM_IDS];
  const goldBefore = game.gold;

  game.prepareEliteCombatReward([game.deck[0].uid, "not-in-deck"]);
  assert.equal(game.advanceEliteCombatRewardFromCard(), true);
  assert.equal(game.pendingCombatReward.stage, "enchant");
  assert.equal(game.pendingCombatReward.fallbackGold, 50);
  assert.equal(game.gold, goldBefore + 80);
  assert.equal(game.advanceEliteCombatRewardFromCard(), false);
  assert.equal(game.gold, goldBefore + 80);

  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.equal(restored.pendingCombatReward.stage, "enchant");
  assert.equal(restored.pendingCombatReward.fallbackGold, 50);
  assert.deepEqual(restored.pendingCombatReward.usedCardUids, [game.deck[0].uid]);
  assert.equal(restored.loadRepairs.some((note) => /精英刻印候选/.test(note)), true);
  assert.equal(restored.gold, goldBefore + 80);
});

test("事件卡牌奖励会固定候选，刷新恢复时不会重抽或重复代价", () => {
  const game = new SemesterGame(524, "gemini");
  game.week = 6;
  game.hp -= 5;
  game.flags.nextCombatTension += 2;
  const choices = game.rewardCards(3, "uncommon");
  const pending = game.prepareEventCardReward("quiz-card", choices);
  const rngAfterReward = game.rng.state;

  assert.equal(pending.type, "card");
  assert.equal(pending.source, "quiz-card");
  assert.equal(pending.started, true);
  assert.deepEqual(pending.choices, choices);
  assert.equal(game.prepareEventCardReward("quiz-card", choices).started, false);

  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.deepEqual(restored.pendingEventReward, {
    type: "card",
    source: "quiz-card",
    choices,
    cardUids: [],
    itemChoices: []
  });
  assert.equal(restored.hp, 45);
  assert.equal(restored.flags.nextCombatTension, 2);
  assert.equal(restored.rng.state, rngAfterReward);
  assert.equal(restored.completePendingEventReward(), true);
  assert.equal(restored.pendingEventReward, null);
});

test("事件升级、删牌与物品候选均按独立待结算状态恢复", () => {
  const upgrade = new SemesterGame(525, "cancer");
  upgrade.week = 7;
  const upgradeUids = upgrade.deck.filter((card) => !card.upgraded).map((card) => card.uid);
  upgrade.prepareEventDeckReward("quiz-upgrade", upgradeUids);
  const restoredUpgrade = SemesterGame.fromJSON(upgrade.toJSON());
  assert.equal(restoredUpgrade.pendingEventReward.type, "upgrade");
  assert.deepEqual(restoredUpgrade.pendingEventReward.cardUids, upgradeUids);

  const remove = new SemesterGame(526, "aries");
  remove.week = 9;
  remove.gold -= 50;
  const removeUids = remove.deck.map((card) => card.uid);
  remove.prepareEventDeckReward("locker-remove", removeUids);
  const restoredRemove = SemesterGame.fromJSON(remove.toJSON());
  assert.equal(restoredRemove.pendingEventReward.type, "remove");
  assert.deepEqual(restoredRemove.pendingEventReward.cardUids, removeUids);
  assert.equal(restoredRemove.gold, 0);

  const item = new SemesterGame(527, "gemini");
  item.week = 10;
  const commonItem = Object.keys(ITEM_DEFS).find((id) => ITEM_DEFS[id].rarity === "common");
  item.prepareEventItemReward("box-open", [commonItem]);
  const restoredItem = SemesterGame.fromJSON(item.toJSON());
  assert.deepEqual(restoredItem.pendingEventReward.itemChoices, [commonItem]);
  assert.equal(restoredItem.pendingEventReward.source, "box-open");
});

test("书包已满时会固定待替换物品，刷新后从同一整理阶段继续", () => {
  const game = new SemesterGame(543, "gemini");
  game.chooseTarot("hermit");
  game.week = 6;
  const incoming = REGULAR_ITEM_IDS.find((id) => ITEM_DEFS[id].rarity === "common");
  game.backpackCapacity = 6;
  game.items = REGULAR_ITEM_IDS.filter((id) => id !== incoming).slice(0, 6);
  game.prepareEventItemReward("box-open", [incoming]);

  assert.deepEqual(game.prepareItemReplacement(incoming), {
    incoming,
    source: "event",
    started: true
  });
  assert.equal(game.completePendingEventReward(), false);
  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.deepEqual(restored.pendingItemReplacement, { incoming, source: "event" });
  assert.deepEqual(restored.loadRepairs, []);

  const outgoing = restored.items[0];
  const itemsTakenBefore = restored.stats.itemsTaken;
  assert.deepEqual(restored.replacePendingItem(outgoing), { incoming, outgoing, source: "event" });
  assert.equal(restored.hasItem(incoming), true);
  assert.equal(restored.hasItem(outgoing), false);
  assert.equal(restored.stats.itemsTaken, itemsTakenBefore + 1);
  assert.equal(restored.pendingItemReplacement, null);
  assert.equal(restored.replacePendingItem(restored.items[0]), null);
  assert.equal(restored.completePendingEventReward(), true);
});

test("战斗与期末物品奖励共用可取消的整理书包状态", () => {
  const combat = new SemesterGame(544, "cancer");
  combat.chooseTarot("strength");
  combat.week = 6;
  combat.backpackCapacity = 6;
  combat.items = REGULAR_ITEM_IDS.slice(0, 6);
  combat.prepareChallengeCombatReward({ affix: Object.keys(CHALLENGE_AFFIX_DEFS)[0] });
  combat.choosePendingChallengeReward("item");
  const combatIncoming = combat.pendingCombatReward.itemChoices[0];
  assert.equal(combat.prepareItemReplacement(combatIncoming).source, "combat");
  assert.equal(combat.completePendingCombatReward(), false);
  assert.equal(combat.cancelPendingItemReplacement(), true);
  assert.equal(combat.pendingCombatReward.stage, "item");

  const semester = new SemesterGame(545, "aries");
  semester.chooseTarot("chariot");
  semester.week = 16;
  semester.backpackCapacity = 6;
  semester.items = REGULAR_ITEM_IDS.slice(0, 6);
  semester.prepareSemesterRewards(BOSS_ITEM_IDS);
  const semesterIncoming = semester.pendingSemesterReward.itemChoices[0];
  assert.equal(semester.prepareItemReplacement(semesterIncoming).source, "semester");
  assert.equal(semester.advanceSemesterRewards(), false);
  assert.equal(semester.cancelPendingItemReplacement(), true);
  assert.equal(semester.advanceSemesterRewards(), true);
});

test("错误来源、已拥有物品或未满书包的替换存档会被清理", () => {
  const game = new SemesterGame(546, "cancer");
  game.chooseTarot("strength");
  game.week = 7;
  const incoming = REGULAR_ITEM_IDS.find((id) => ITEM_DEFS[id].rarity === "common");
  game.backpackCapacity = 6;
  game.items = REGULAR_ITEM_IDS.filter((id) => id !== incoming).slice(0, 6);
  game.prepareEventItemReward("locker-open", [incoming]);
  game.prepareItemReplacement(incoming);

  const wrongSource = game.toJSON();
  wrongSource.pendingItemReplacement.source = "combat";
  const repairedSource = SemesterGame.fromJSON(wrongSource);
  assert.equal(repairedSource.pendingItemReplacement, null);
  assert.equal(repairedSource.loadRepairs.some((note) => /物品替换状态/.test(note)), true);

  const notFull = game.toJSON();
  notFull.backpackCapacity = 7;
  const repairedCapacity = SemesterGame.fromJSON(notFull);
  assert.equal(repairedCapacity.pendingItemReplacement, null);
  assert.equal(repairedCapacity.loadRepairs.some((note) => /物品替换状态/.test(note)), true);
});

test("受污染事件奖励不会跨星座、跨类型或与战斗奖励并存", () => {
  const game = new SemesterGame(528, "cancer");
  game.week = 6;
  const corrupted = game.toJSON();
  corrupted.pendingEventReward = {
    type: "card",
    source: "club-attack",
    choices: ["ariesRush"],
    cardUids: [],
    itemChoices: []
  };
  const repaired = SemesterGame.fromJSON(corrupted);
  assert.equal(repaired.pendingEventReward, null);
  assert.equal(repaired.loadRepairs.some((note) => /事件奖励状态/.test(note)), true);

  const conflict = game.toJSON();
  conflict.pendingCombatReward = { type: "normalCard", choices: game.rewardCards(3) };
  conflict.pendingEventReward = {
    type: "upgrade",
    source: "quiz-upgrade",
    choices: [],
    cardUids: game.deck.map((card) => card.uid),
    itemChoices: []
  };
  const restoredConflict = SemesterGame.fromJSON(conflict);
  assert.notEqual(restoredConflict.pendingCombatReward, null);
  assert.equal(restoredConflict.pendingEventReward, null);
  assert.equal(restoredConflict.loadRepairs.some((note) => /事件奖励状态/.test(note)), true);
});

test("进入问号节点后会固定当前事件，刷新恢复不再重新抽取", () => {
  const game = new SemesterGame(529, "cancer");
  game.chooseTarot("strength");
  game.week = 6;
  const rngBefore = game.rng.state;

  assert.equal(game.preparePendingEvent("popQuiz"), true);
  assert.equal(game.pendingEventId, "popQuiz");
  assert.equal(game.lastEventId, "popQuiz");
  assert.equal(game.rng.state, rngBefore);
  assert.equal(game.preparePendingEvent("popQuiz"), true);
  assert.equal(game.preparePendingEvent("mealCard"), false);

  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.equal(restored.pendingEventId, "popQuiz");
  assert.equal(restored.lastEventId, "popQuiz");
  assert.deepEqual(restored.loadRepairs, []);
  assert.equal(restored.completePendingEvent(), true);
  assert.equal(restored.pendingEventId, null);
  assert.equal(restored.lastEventId, "popQuiz");
  assert.equal(restored.completePendingEvent(), false);

  restored.startNextSemester();
  assert.equal(restored.pendingEventId, null);
  assert.equal(restored.lastEventId, null);
});

test("待处理事件只允许出现在合法普通周，且不能覆盖奖励或羁绊结算", () => {
  const fixedWeek = new SemesterGame(530, "aries");
  fixedWeek.chooseTarot("chariot");
  fixedWeek.week = 8;
  assert.equal(fixedWeek.preparePendingEvent("mealCard"), false);

  const corrupted = new SemesterGame(531, "gemini");
  corrupted.chooseTarot("hermit");
  corrupted.week = 7;
  const saved = corrupted.toJSON();
  saved.lastEventId = "unknown";
  saved.pendingEventId = "popQuiz";
  saved.pet.pendingMilestone = "choose";
  const repaired = SemesterGame.fromJSON(saved);
  assert.equal(repaired.lastEventId, null);
  assert.equal(repaired.pendingEventId, null);
  assert.equal(repaired.pet.pendingMilestone, "choose");
  assert.equal(repaired.loadRepairs.some((note) => /上一事件记录/.test(note)), true);
  assert.equal(repaired.loadRepairs.some((note) => /待处理事件/.test(note)), true);

  const rewardConflict = new SemesterGame(532, "cancer");
  rewardConflict.chooseTarot("strength");
  rewardConflict.week = 6;
  rewardConflict.prepareEventCardReward("quiz-card", rewardConflict.rewardCards(3, "uncommon"));
  const conflictingSave = rewardConflict.toJSON();
  conflictingSave.lastEventId = "popQuiz";
  conflictingSave.pendingEventId = "popQuiz";
  const restoredConflict = SemesterGame.fromJSON(conflictingSave);
  assert.notEqual(restoredConflict.pendingEventReward, null);
  assert.equal(restoredConflict.pendingEventId, null);
  assert.equal(restoredConflict.loadRepairs.some((note) => /待处理事件/.test(note)), true);
});

test("战斗开局检查点会重建同一首手牌，并且临时状态只消耗一次", () => {
  const game = new SemesterGame(533, "cancer");
  game.chooseTarot("strength");
  game.flags.nextCombatTension = 2;
  game.flags.nextEnemyBlock = 6;
  game.flags.petSnackCombats = 3;
  const pending = game.prepareCombatStart("sleepyBug", "normal", {});
  const preCombatSave = game.toJSON();

  assert.deepEqual(pending, {
    enemyId: "sleepyBug",
    outcome: "normal",
    modifiers: {},
    started: true
  });
  assert.equal(game.prepareCombatStart("homeworkBlob", "normal", {}).started, false);
  assert.equal(game.prepareNormalCombatReward(), null);
  game.startCombat(pending.enemyId, pending.modifiers);
  const firstStart = {
    hand: game.combat.hand.map((card) => [card.id, card.uid]),
    drawPile: game.combat.drawPile.map((card) => [card.id, card.uid]),
    enemyBlock: game.combat.enemy.block,
    petCharge: game.pet.charge,
    flags: { ...game.flags },
    combatsStarted: game.stats.combatsStarted,
    cardSerial: game.cardSerial,
    rngState: game.rng.state
  };

  const restored = SemesterGame.fromJSON(preCombatSave);
  assert.deepEqual(restored.pendingCombatStart, {
    enemyId: "sleepyBug",
    outcome: "normal",
    modifiers: {}
  });
  restored.startCombat(restored.pendingCombatStart.enemyId, restored.pendingCombatStart.modifiers);
  const secondStart = {
    hand: restored.combat.hand.map((card) => [card.id, card.uid]),
    drawPile: restored.combat.drawPile.map((card) => [card.id, card.uid]),
    enemyBlock: restored.combat.enemy.block,
    petCharge: restored.pet.charge,
    flags: { ...restored.flags },
    combatsStarted: restored.stats.combatsStarted,
    cardSerial: restored.cardSerial,
    rngState: restored.rng.state
  };
  assert.deepEqual(secondStart, firstStart);
  assert.equal(secondStart.enemyBlock, 6);
  assert.equal(secondStart.petCharge, 2);
  assert.equal(secondStart.flags.nextCombatTension, 0);
  assert.equal(secondStart.flags.nextEnemyBlock, 0);
  assert.equal(secondStart.flags.petSnackCombats, 2);
  assert.equal(restored.completePendingCombatStart(), true);
  assert.equal(restored.pendingCombatStart, null);
  assert.notEqual(restored.prepareNormalCombatReward(), null);
});

test("挑战与怪谈战检查点校验敌人、词缀和事件来源，污染状态会被清理", () => {
  const challenge = new SemesterGame(534, "aries");
  challenge.chooseTarot("chariot");
  let challengeNode;
  for (let week = 3; week <= 15 && !challengeNode; week += 1) {
    const node = challenge.semesterPlan[week].find((candidate) => candidate.challenge);
    if (node) challengeNode = { week, node };
  }
  challenge.week = challengeNode.week;
  const modifiers = {
    challenge: true,
    hpMultiplier: CHALLENGE_RULES.hpMultiplier,
    damageMultiplier: CHALLENGE_RULES.damageMultiplier,
    affix: challengeNode.node.affix
  };
  assert.notEqual(challenge.prepareCombatStart(challengeNode.node.enemy, "challenge", modifiers), null);
  const restoredChallenge = SemesterGame.fromJSON(challenge.toJSON());
  assert.equal(restoredChallenge.pendingCombatStart.outcome, "challenge");
  assert.deepEqual(restoredChallenge.pendingCombatStart.modifiers, modifiers);

  const event = new SemesterGame(535, "gemini");
  event.chooseTarot("hermit");
  event.week = 6;
  event.preparePendingEvent("campusRumor");
  assert.notEqual(event.prepareCombatStart("groupChat", "event", { hpMultiplier: 1.3 }), null);
  const restoredEvent = SemesterGame.fromJSON(event.toJSON());
  assert.equal(restoredEvent.pendingEventId, "campusRumor");
  assert.deepEqual(restoredEvent.pendingCombatStart, {
    enemyId: "groupChat",
    outcome: "event",
    modifiers: { hpMultiplier: 1.3 }
  });

  const corrupted = challenge.toJSON();
  corrupted.pendingCombatStart.modifiers.affix = "unknown";
  const repaired = SemesterGame.fromJSON(corrupted);
  assert.equal(repaired.pendingCombatStart, null);
  assert.equal(repaired.loadRepairs.some((note) => /战斗开局检查点/.test(note)), true);
});

test("校园商店固定一张专属、两张普池与物品库存，刷新恢复不重抽", () => {
  const game = new SemesterGame(536, "cancer");
  game.chooseTarot("strength");
  let shopWeek;
  for (let week = 3; week <= 15 && !shopWeek; week += 1) {
    if (game.semesterPlan[week].some((node) => node.type === "shop")) shopWeek = week;
  }
  game.week = shopWeek;
  const pending = game.prepareShop();
  const rngAfterStock = game.rng.state;

  assert.equal(pending.started, true);
  assert.equal(pending.cards.length, 3);
  assert.equal(pending.cards.filter((stock) => ARCHETYPE_CARD_IDS.cancer.includes(stock.id)).length, 1);
  assert.equal(pending.cards.filter((stock) => PUBLIC_REWARD_CARD_IDS.includes(stock.id)).length, 2);
  assert.equal(pending.items.length, 2);
  assert.equal(pending.removePrice, 75);
  assert.equal(pending.removed, false);
  assert.equal(game.prepareShop().started, false);
  assert.equal(game.rng.state, rngAfterStock);

  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.deepEqual(restored.pendingShop, {
    cards: pending.cards,
    items: pending.items,
    removePrice: 75,
    removed: false
  });
  assert.equal(restored.rng.state, rngAfterStock);
  assert.deepEqual(restored.loadRepairs, []);
});

test("商店买牌、半价物品与删牌交易会逐笔保存，售罄商品不能重复购买", () => {
  const game = new SemesterGame(537, "gemini");
  game.chooseTarot("hermit");
  game.gold = 500;
  game.flags.nextShopHalf = true;
  let shopWeek;
  for (let week = 3; week <= 15 && !shopWeek; week += 1) {
    if (game.semesterPlan[week].some((node) => node.type === "shop")) shopWeek = week;
  }
  game.week = shopWeek;
  game.prepareShop();
  const cardStock = game.pendingShop.cards[0];
  const itemStock = game.pendingShop.items[0];
  const removedUid = game.deck[0].uid;
  const cardPrice = game.shopPrice("card", cardStock.id);
  const itemPrice = game.shopPrice("item", itemStock.id);

  assert.deepEqual(game.buyShopCard(0), { id: cardStock.id, price: cardPrice });
  assert.equal(game.buyShopCard(0), null);
  assert.deepEqual(game.buyShopItem(itemStock.id), { id: itemStock.id, price: itemPrice });
  assert.equal(game.buyShopItem(itemStock.id), null);
  assert.equal(game.flags.nextShopHalf, false);
  assert.deepEqual(game.removeShopCard(removedUid), { uid: removedUid, price: 75 });
  assert.equal(game.removeShopCard(game.deck[0].uid), null);
  assert.equal(game.gold, 500 - cardPrice - itemPrice - 75);

  const restored = SemesterGame.fromJSON(game.toJSON());
  assert.equal(restored.pendingShop.cards[0].sold, true);
  assert.equal(restored.pendingShop.items.find((stock) => stock.id === itemStock.id).sold, true);
  assert.equal(restored.pendingShop.removed, true);
  assert.equal(restored.deck.some((card) => card.uid === removedUid), false);
  assert.equal(restored.deck.some((card) => card.id === cardStock.id), true);
  assert.equal(restored.hasItem(itemStock.id), true);
  assert.equal(restored.gold, game.gold);
  assert.equal(restored.completePendingShop(), true);
  assert.equal(restored.pendingShop, null);
});

test("学生证对商店卡牌、物品和删牌服务统一按九折结算", () => {
  const game = new SemesterGame(572, "gemini");
  game.chooseTarot("hermit");
  game.addItem("studentId");
  game.gold = 500;
  game.week = findRouteWeek(game, "shop");
  game.prepareShop();
  const cardStock = game.pendingShop.cards[0];
  const baseCardPrice = { common: 40, uncommon: 65, rare: 100 }[CARD_DEFS[cardStock.id].rarity];
  assert.equal(game.shopPrice("card", cardStock.id), Math.ceil(baseCardPrice * 0.9));
  assert.equal(game.shopRemovePrice(), 68);

  const removedUid = game.deck[0].uid;
  assert.deepEqual(game.removeShopCard(removedUid), { uid: removedUid, price: 68 });
  assert.equal(game.gold, 432);
});

test("受污染商店库存、跨星座卡牌或错误路线会被安全清理", () => {
  const game = new SemesterGame(538, "cancer");
  game.chooseTarot("strength");
  let shopWeek;
  for (let week = 3; week <= 15 && !shopWeek; week += 1) {
    if (game.semesterPlan[week].some((node) => node.type === "shop")) shopWeek = week;
  }
  game.week = shopWeek;
  game.prepareShop();
  const corrupted = game.toJSON();
  corrupted.pendingShop.cards[0] = { id: "ariesRush", sold: false };
  const repaired = SemesterGame.fromJSON(corrupted);
  assert.equal(repaired.pendingShop, null);
  assert.equal(repaired.loadRepairs.some((note) => /商店状态/.test(note)), true);

  const wrongWeek = game.toJSON();
  wrongWeek.week = 8;
  const repairedWeek = SemesterGame.fromJSON(wrongWeek);
  assert.equal(repairedWeek.pendingShop, null);
  assert.equal(repairedWeek.loadRepairs.some((note) => /商店状态/.test(note)), true);
});

test("新学期尚未选择塔罗时保存构筑并重置本学期主力进度", () => {
  const game = new SemesterGame(515, "gemini");
  game.chooseTarot("hermit");
  const added = game.addCard("catCombo", true);
  game.addItem("autoPencil");
  game.pet.bond = 9;
  game.gold = 137;
  game.cardCombatUses[added.uid] = 4;

  game.startNextSemester();
  const saved = game.toJSON();
  const restored = SemesterGame.fromJSON(saved);

  assert.equal(restored.semester, 2);
  assert.equal(restored.week, 1);
  assert.equal(restored.tarotId, null);
  assert.equal(restored.hp, 52);
  assert.equal(restored.maxHp, 52);
  assert.equal(restored.backpackCapacity, 7);
  assert.equal(restored.gold, 137);
  assert.equal(restored.pet.bond, 9);
  assert.deepEqual(restored.items, ["autoPencil"]);
  assert.deepEqual(restored.deck, game.deck);
  assert.deepEqual(restored.semesterPlan, game.semesterPlan);
  assert.equal(restored.rng.state, game.rng.state);
  assert.deepEqual(restored.cardCombatUses, {});
  assert.deepEqual(restored.loadRepairs, []);
});
