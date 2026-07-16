import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

function declarations(selector, source = styles) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `missing CSS rule: ${selector}`);
  return Object.fromEntries(match[1]
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf(":");
      return [entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()];
    }));
}

function mediaBlock(marker) {
  const start = styles.indexOf(marker);
  assert.notEqual(start, -1, `missing media query: ${marker}`);
  const next = styles.indexOf("\n@media ", start + marker.length);
  return styles.slice(start, next === -1 ? styles.length : next);
}

function px(value) {
  const match = String(value).match(/^-?(\d+(?:\.\d+)?)px$/);
  assert.ok(match, `expected a pixel value, got ${value}`);
  return Number(match[1]);
}

function horizontalGap(value) {
  const parts = String(value).trim().split(/\s+/);
  return px(parts.at(-1));
}

function assertThreeChipsFit(chip, chips, gap) {
  const required = (px(chip["min-width"]) * 3) + (gap * 2);
  assert.ok(px(chips["max-width"]) >= required, `three chips need ${required}px but only have ${chips["max-width"]}`);
  assert.equal(chips["flex-wrap"], "nowrap");
}

test("enemy intent makes the number primary without restoring a heavy panel", () => {
  const token = declarations(".enemy-intent-token");
  const chips = declarations(".enemy-intent-chips");
  const chip = declarations(".intent-chip");
  const symbol = declarations(".intent-chip em");
  const value = declarations(".intent-chip b");

  assert.equal(token.border, "0");
  assert.equal(token.background, "transparent");
  assert.equal(token["box-shadow"], "none");
  assert.equal(chips["flex-wrap"], "wrap");
  assert.equal(chip.flex, "0 0 auto");
  assert.equal(chip.border.startsWith("1px solid"), true);
  assert.equal(chip["border-radius"], "999px");
  assert.ok(px(value["font-size"]) > px(symbol["font-size"]));
});

test("attack block debuff and inserted-status intents keep distinct high-contrast palettes", () => {
  const variants = [
    declarations(".intent-chip.intent-attack"),
    declarations(".intent-chip.intent-block"),
    declarations(".intent-chip.intent-debuff"),
    declarations(".intent-chip.intent-status")
  ];

  for (const variant of variants) {
    assert.equal(variant["border-color"].startsWith("rgba("), true);
    assert.equal(variant.background.startsWith("linear-gradient("), true);
  }
  assert.equal(new Set(variants.map((variant) => `${variant.color}|${variant.background}`)).size, 4);
  assert.deepEqual(variants.map((variant) => variant.color), ["#ffd4ca", "#d9f5ff", "#f0dcff", "#fff0bd"]);
});

test("three-effect intents use a dedicated single-row slot instead of growing toward the portrait", () => {
  const chip = declarations(".intent-chip");
  const regularChips = declarations(".enemy-intent-chips");
  const tripleToken = declarations(".enemy-fighter .enemy-intent-token:has(.intent-chip:nth-child(3))");
  const tripleChips = declarations(".enemy-fighter .enemy-intent-token:has(.intent-chip:nth-child(3)) .enemy-intent-chips");

  assert.equal(tripleToken.top, "-56px");
  assertThreeChipsFit(chip, tripleChips, horizontalGap(regularChips.gap));
  assert.ok(px(tripleToken["max-width"]) >= px(tripleChips["max-width"]));
});

test("1366 by 768 reserves separate vertical slots and keeps two-chip intents on one row", () => {
  const desktop = mediaBlock("@media (min-width: 701px) and (max-width: 1366px) and (max-height: 768px)");
  const token = declarations(".enemy-intent-token", desktop);
  const chips = declarations(".enemy-intent-chips", desktop);
  const chip = declarations(".intent-chip", desktop);
  const value = declarations(".intent-chip b", desktop);
  const tripleToken = declarations(".enemy-fighter .enemy-intent-token:has(.intent-chip:nth-child(3))", desktop);
  const tripleChips = declarations(".enemy-fighter .enemy-intent-token:has(.intent-chip:nth-child(3)) .enemy-intent-chips", desktop);
  const baseLabel = declarations(".fighter-label");

  assert.equal(token.top, "-56px");
  assert.ok(Math.abs(px(token.top)) > px(chip["min-height"]));
  assert.ok(px(chips["max-width"]) >= (px(chip["min-width"]) * 2) + 5, "phone spirit's two chips must share one row");
  assert.equal(tripleToken.top, token.top);
  assertThreeChipsFit(chip, { ...tripleChips, "flex-wrap": declarations(".enemy-fighter .enemy-intent-token:has(.intent-chip:nth-child(3)) .enemy-intent-chips")["flex-wrap"] }, horizontalGap(chips.gap));
  assert.ok(px(value["font-size"]) >= 19);
  assert.ok(px(baseLabel["margin-bottom"]) >= 4, "enemy nameplate must retain a gap before the portrait");
});

test("390 by 844 keeps the intent above the nameplate and away from mechanic progress", () => {
  const mobile = mediaBlock("@media (max-width: 700px)");
  const token = declarations(".enemy-intent-token", mobile);
  const chips = declarations(".enemy-intent-chips", mobile);
  const chip = declarations(".intent-chip", mobile);
  const value = declarations(".intent-chip b", mobile);
  const mechanicToken = declarations(".enemy-fighter:has(.enemy-mechanic-progress) .enemy-intent-token", mobile);
  const mechanicChips = declarations(".enemy-fighter:has(.enemy-mechanic-progress) .enemy-intent-chips", mobile);
  const tripleToken = declarations(".enemy-fighter .enemy-intent-token:has(.intent-chip:nth-child(3))", mobile);
  const tripleChips = declarations(".enemy-fighter .enemy-intent-token:has(.intent-chip:nth-child(3)) .enemy-intent-chips", mobile);

  assert.equal(token.top, "-44px");
  assert.ok(Math.abs(px(token.top)) > px(chip["min-height"]));
  assert.ok(px(chips["max-width"]) >= (px(chip["min-width"]) * 2) + 4, "phone spirit's two chips must share one row on mobile");
  assert.ok(px(value["font-size"]) >= 17);
  assert.equal(mechanicToken.left, "4px");
  assert.equal(mechanicToken.transform, "none");
  assert.equal(mechanicToken["max-width"], mechanicChips["max-width"]);
  assert.equal(tripleToken.top, token.top);
  assertThreeChipsFit(chip, tripleChips, horizontalGap(chips.gap));
});

test("390 by 650 uses an exact compact header stack without shrinking the capsule", () => {
  const compact = mediaBlock("@media (max-width: 700px) and (max-height: 650px)");
  const label = declarations(".combat-page .enemy-fighter > .fighter-label", compact);
  const token = declarations(".combat-page .enemy-intent-token", compact);
  const intentName = declarations(".combat-page .enemy-intent-token > small", compact);
  const tripleToken = declarations(".combat-page .enemy-fighter .enemy-intent-token:has(.intent-chip:nth-child(3))", compact);
  const tripleChips = declarations(".combat-page .enemy-fighter .enemy-intent-token:has(.intent-chip:nth-child(3)) .enemy-intent-chips", compact);
  const mobile = mediaBlock("@media (max-width: 700px)");
  const chip = declarations(".intent-chip", mobile);
  const chips = declarations(".enemy-intent-chips", mobile);

  assert.equal(label.height, "24px");
  assert.equal(label["margin-bottom"], "6px");
  assert.equal(token.top, `-${chip["min-height"]}`);
  assert.equal(intentName.display, "none");
  assert.ok(px(chip["min-height"]) >= 30, "compact mode must keep the intent capsule readable");
  assert.equal(tripleToken.top, token.top);
  assertThreeChipsFit(chip, tripleChips, horizontalGap(chips.gap));
});
