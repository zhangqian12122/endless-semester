import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { EVENT_DEFS, SHOP_SCENE } from "../game-data.js";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

const CJK_TEXT = /[\u3400-\u9fff]/;
const EXPECTED_EVENT_SCENES = Object.freeze({
  hallwayBox: "assets/scenes/event-hallway-box-v1.webp",
  popQuiz: "assets/scenes/event-pop-quiz-v1.webp",
  clubRecruitment: "assets/scenes/event-club-recruitment-v1.webp",
  mealCard: "assets/scenes/event-meal-card-v1.webp",
  campusRumor: "assets/scenes/event-campus-rumor-v1.webp",
  oldLocker: "assets/scenes/event-old-locker-v1.webp"
});
const VALID_EVENT_TONES = new Set(["safe", "risk"]);

function sourceBetween(startMarker, endMarker) {
  const start = appSource.indexOf(startMarker);
  const end = appSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `缺少源码片段：${startMarker}`);
  assert.notEqual(end, -1, `缺少源码片段结束标记：${endMarker}`);
  return appSource.slice(start, end);
}

function webpDimensions(bytes) {
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF", "素材不是 RIFF 容器");
  assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP", "素材缺少 WEBP 标识");

  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = bytes.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = bytes.readUInt32LE(offset + 4);
    const data = offset + 8;

    if (kind === "VP8X" && data + 10 <= bytes.length) {
      return {
        width: 1 + bytes.readUIntLE(data + 4, 3),
        height: 1 + bytes.readUIntLE(data + 7, 3)
      };
    }
    if (kind === "VP8 " && data + 10 <= bytes.length) {
      assert.equal(bytes.subarray(data + 3, data + 6).toString("hex"), "9d012a", "VP8 关键帧头无效");
      return {
        width: bytes.readUInt16LE(data + 6) & 0x3fff,
        height: bytes.readUInt16LE(data + 8) & 0x3fff
      };
    }
    if (kind === "VP8L" && data + 5 <= bytes.length) {
      assert.equal(bytes[data], 0x2f, "VP8L 签名字节无效");
      const b1 = bytes[data + 1];
      const b2 = bytes[data + 2];
      const b3 = bytes[data + 3];
      const b4 = bytes[data + 4];
      return {
        width: 1 + b1 + ((b2 & 0x3f) << 8),
        height: 1 + ((b2 & 0xc0) >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10)
      };
    }

    offset = data + chunkSize + (chunkSize % 2);
  }

  assert.fail("无法从 WebP 素材读取画布尺寸");
}

test("六个事件与校园商店声明独立正式场景、中文替代文本和合法语义氛围", () => {
  assert.equal(Object.keys(EVENT_DEFS).length, 6, "事件场景契约应覆盖六个正式事件");
  assert.deepEqual(
    Object.keys(EVENT_DEFS).sort(),
    Object.keys(EXPECTED_EVENT_SCENES).sort(),
    "事件定义集合应与场景契约完全一致"
  );

  for (const [id, event] of Object.entries(EVENT_DEFS)) {
    assert.equal(event.id, id, `${id} 的事件 id 必须与定义键一致`);
    assert.equal(event.scene, EXPECTED_EVENT_SCENES[id], `${event.name} 应绑定指定的独立场景图`);
    assert.equal(typeof event.scene, "string", `${event.name} 的场景路径必须是字符串`);
    assert.ok(event.scene.trim().length > 0, `${event.name} 的场景路径不能为空`);
    assert.equal(typeof event.sceneAlt, "string", `${event.name} 的场景 alt 必须是字符串`);
    assert.ok(event.sceneAlt.trim().length > 0, `${event.name} 的场景 alt 不能为空`);
    assert.match(event.sceneAlt, CJK_TEXT, `${event.name} 场景必须提供中文 alt`);
    assert.ok(VALID_EVENT_TONES.has(event.tone), `${event.name} 必须使用 safe 或 risk 语义氛围`);
    assert.equal(event.tone, event.safe ? "safe" : "risk", `${event.name} 的场景氛围必须与事件风险一致`);
  }

  assert.equal(SHOP_SCENE.scene, "assets/scenes/campus-shop-v1.webp");
  assert.ok(SHOP_SCENE.scene.trim().length > 0, "校园商店场景路径不能为空");
  assert.equal(typeof SHOP_SCENE.sceneAlt, "string", "校园商店场景 alt 必须是字符串");
  assert.ok(SHOP_SCENE.sceneAlt.trim().length > 0, "校园商店场景 alt 不能为空");
  assert.match(SHOP_SCENE.sceneAlt, CJK_TEXT, "校园商店场景必须提供中文 alt");
  assert.equal(SHOP_SCENE.tone, "shop", "校园商店应使用商店场景语义");
});

test("事件页与商店页复用同一场景横幅并保留图片失败降级", () => {
  const bannerHelper = sourceBetween("function sceneBannerHtml(", "function renderShop(");
  const shopRenderer = sourceBetween("function renderShop(", "function eventChoices(");
  const eventRenderer = sourceBetween("function renderEvent(", "function renderEventConfirm(");

  assert.match(bannerHelper, /class="scene-banner(?:\s|\")/);
  assert.match(bannerHelper, /class="scene-banner-fallback(?:\s|\")/, "横幅需要无图片时仍可理解的占位内容");
  assert.match(bannerHelper, /<img[\s\S]*?alt="\$\{escapeHtml\([^)]*sceneAlt[^)]*\)\}"/, "场景图必须输出经过转义的中文 alt");
  assert.match(bannerHelper, /onerror="[^"]*(?:remove\(\)|asset-failed|hidden)[^"]*"/, "场景图加载失败时必须主动露出降级内容");
  assert.match(shopRenderer, /sceneBannerHtml\(SHOP_SCENE/);
  assert.match(eventRenderer, /sceneBannerHtml\((?:event|scene)/);

  const bannerClassOccurrences = appSource.match(/class="scene-banner(?:\s|\")/g) || [];
  assert.equal(bannerClassOccurrences.length, 1, "事件与商店应复用组件，不应复制两份横幅模板");
});

test("场景横幅在桌面双栏展示、移动端单栏展示且图片保持裁切", () => {
  assert.match(styles, /\.scene-banner\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*(?!1fr\s*;)[^;}]+;/s, "桌面场景横幅应使用双栏网格");
  assert.match(styles, /(?:\.scene-banner(?:-media)?\s+img|\.scene-banner-image)\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*object-fit:\s*cover;/s, "场景图片应铺满并使用 cover 裁切");
  assert.match(styles, /@media\s*\(max-width:\s*700px\)[\s\S]*?\.scene-banner\s*\{[^}]*grid-template-columns:\s*1fr;/, "700px 以下场景横幅应切换为单栏");
});

test("六个事件与校园商店共七张场景图是尺寸与体积合理的有效 WebP", () => {
  const scenes = [
    ...Object.values(EVENT_DEFS).map((event) => [event.name, event.scene]),
    ["校园商店", SHOP_SCENE.scene]
  ];

  assert.equal(scenes.length, 7, "场景素材测试应覆盖六个事件与一个商店");
  assert.equal(new Set(scenes.map(([, asset]) => asset)).size, 7, "六个事件与商店必须使用七张不同场景图");

  for (const [label, asset] of scenes) {
    assert.match(asset, /^assets\/scenes\/.+\.webp$/, `${label} 必须使用 scenes 目录中的 WebP 素材`);
    const assetUrl = new URL(`../${asset}`, import.meta.url);
    assert.ok(existsSync(assetUrl), `${label}场景图不存在`);

    const size = statSync(assetUrl).size;
    assert.ok(size > 0, `${label}场景图不能为空`);
    assert.ok(size < 400 * 1024, `${label}场景图必须小于 400KB`);

    const dimensions = webpDimensions(readFileSync(assetUrl));
    const aspectRatio = dimensions.width / dimensions.height;
    assert.ok(dimensions.width >= 960 && dimensions.height >= 540, `${label}场景图分辨率过低：${dimensions.width}×${dimensions.height}`);
    assert.ok(dimensions.width <= 4096 && dimensions.height <= 4096, `${label}场景图分辨率异常：${dimensions.width}×${dimensions.height}`);
    assert.ok(aspectRatio >= 1.25 && aspectRatio <= 2.5, `${label}场景图宽高比不适合作为横幅：${aspectRatio.toFixed(2)}`);
  }
});

test("场景系统的样式与脚本使用同一 1.8.62 缓存版本", () => {
  const styleVersion = indexSource.match(/styles\.css\?v=([\d.]+)/)?.[1];
  const appVersion = indexSource.match(/app\.js\?v=([\d.]+)/)?.[1];

  assert.equal(styleVersion, "1.8.62");
  assert.equal(appVersion, styleVersion);
});
