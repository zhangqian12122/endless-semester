import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function namedFunctionSource(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `缺少 ${name}`);
  const next = appSource.indexOf("\nfunction ", start + 1);
  return appSource.slice(start, next === -1 ? appSource.length : next);
}

test("Toast 使用 #app 外的常驻独立 live region", () => {
  const appTag = indexSource.match(/<main\s+id="app"([^>]*)>/);
  const liveRegionTag = indexSource.match(/<div\s+id="toast-live-region"([^>]*)>/);

  assert.ok(appTag, "缺少 #app 主渲染根节点");
  assert.doesNotMatch(appTag[1], /aria-live|role="(?:status|alert)"/, "不能让整个 #app 成为 live region");
  assert.ok(liveRegionTag, "缺少常驻 Toast 播报节点");
  assert.match(liveRegionTag[1], /class="sr-only"/);
  assert.match(liveRegionTag[1], /role="status"/);
  assert.match(liveRegionTag[1], /aria-live="polite"/);
  assert.match(liveRegionTag[1], /aria-atomic="true"/);
  assert.ok(indexSource.indexOf('id="toast-live-region"') > indexSource.indexOf('id="app"'),
    "Toast live region 必须是 #app 外的独立兄弟节点");
  assert.match(appSource, /document\.querySelector\("#toast-live-region"\)/,
    "应用必须复用 HTML 中的常驻播报节点");
});

test("视觉 Toast 保持显示但从无障碍树隐藏，避免与 live region 重复播报", () => {
  const visualToasts = [...appSource.matchAll(/<div class="toast"([^>]*)>/g)];

  assert.equal(visualToasts.length, 2, "普通页面与战斗页面都应保留视觉 Toast");
  for (const [, attributes] of visualToasts) {
    assert.match(attributes, /aria-hidden="true"/);
    assert.doesNotMatch(attributes, /aria-live|role="(?:status|alert)"/);
  }
});

test("当前节点未完成时返回地图会立即重绘视觉 Toast", () => {
  assert.match(appSource,
    /action === "map"[\s\S]*?screen !== "map"[\s\S]*?setToast\("请先完成当前节点"\);[\s\S]*?render\(\);/,
    "战斗中拦截返回地图后必须立即重绘，不能只让读屏收到提示");
});

test("相同 Toast 消息连续出现时先清空再逐帧写入，从而重新触发播报", () => {
  const clearSource = namedFunctionSource("clearToastAnnouncement");
  const announceSource = namedFunctionSource("announceToast");
  const setToastSource = namedFunctionSource("setToast");
  const callbacks = new Map();
  let nextFrameId = 0;
  const fakeWindow = {
    requestAnimationFrame(callback) {
      nextFrameId += 1;
      callbacks.set(nextFrameId, callback);
      return nextFrameId;
    },
    cancelAnimationFrame(frameId) {
      callbacks.delete(frameId);
    }
  };
  const writes = [];
  const liveRegion = {
    value: "",
    get textContent() { return this.value; },
    set textContent(value) {
      this.value = value;
      writes.push(value);
    }
  };
  const harness = new Function("fakeWindow", "liveRegion", `
    const window = fakeWindow;
    const toastLiveRegion = liveRegion;
    let toastAnnouncementFrame = null;
    ${clearSource}
    ${announceSource}
    return { announceToast };
  `)(fakeWindow, liveRegion);
  const flushFrame = () => {
    const pending = [...callbacks.values()];
    callbacks.clear();
    pending.forEach((callback) => callback());
  };

  harness.announceToast("校园币不足");
  flushFrame();
  harness.announceToast("校园币不足");
  flushFrame();

  assert.deepEqual(writes, ["", "校园币不足", "", "校园币不足"]);
  assert.match(setToastSource, /announceToast\(message\)/, "每次视觉提示都必须同步提交读屏播报");
  assert.match(setToastSource, /toast\s*=\s*""[\s\S]*?clearToastAnnouncement\(\)/,
    "视觉提示到期时必须一并清理常驻播报节点");
});
