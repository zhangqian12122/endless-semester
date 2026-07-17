import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { mobileViewportMode, requestMobileLandscape } from "../mobile-landscape.js";

test("mobileViewportMode distinguishes the 16:9 phone stage from portrait and desktop", () => {
  assert.equal(mobileViewportMode({ width: 844, height: 390, coarsePointer: true }), "landscape");
  assert.equal(mobileViewportMode({ width: 390, height: 844, coarsePointer: true }), "portrait");
  assert.equal(mobileViewportMode({ width: 1280, height: 720, coarsePointer: true }), "desktop");
  assert.equal(mobileViewportMode({ width: 844, height: 390, coarsePointer: false }), "desktop");
});

test("requestMobileLandscape requests fullscreen before locking landscape", async () => {
  const calls = [];
  const root = {
    async requestFullscreen(options) {
      calls.push(["fullscreen", options]);
    }
  };
  const screenObject = {
    orientation: {
      async lock(direction) {
        calls.push(["lock", direction]);
      }
    }
  };

  const result = await requestMobileLandscape({ root, screenObject });

  assert.deepEqual(calls, [
    ["fullscreen", { navigationUI: "hide" }],
    ["lock", "landscape"]
  ]);
  assert.deepEqual(result, { fullscreen: true, orientationLocked: true });
});

test("requestMobileLandscape keeps manual rotation as a safe fallback", async () => {
  const result = await requestMobileLandscape({
    root: { requestFullscreen: async () => { throw new Error("unsupported"); } },
    screenObject: { orientation: { lock: async () => { throw new Error("denied"); } } }
  });

  assert.deepEqual(result, { fullscreen: false, orientationLocked: false });
});

test("phone CSS exposes a portrait gate and a dedicated short-edge landscape layout", () => {
  const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /id="mobile-landscape-enter"/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(css, /orientation:\s*portrait[\s\S]*max-width:\s*700px[\s\S]*mobile-landscape-gate/);
  assert.match(css, /orientation:\s*landscape[\s\S]*max-width:\s*950px[\s\S]*max-height:\s*500px/);
  assert.match(css, /\.combat-page[\s\S]*height:\s*calc\(100dvh - 46px/);
  assert.match(css, /\.combat-page \.hand \.game-card[\s\S]*flex:\s*0 0 94px/);
});
