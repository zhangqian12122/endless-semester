import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `missing CSS rule: ${selector}`);
  return match[1];
}

test("special enemy progress stays in the enemy fighter overlay layer", () => {
  const base = rule(".enemy-mechanic-progress");
  assert.match(base, /position:\s*absolute/);
  assert.match(base, /top:\s*0/);
  assert.match(base, /right:\s*-48px/);
  assert.match(base, /width:\s*112px/);
  assert.match(base, /pointer-events:\s*none/);
  assert.doesNotMatch(base, /(?:margin|inset|left):/);

  const intent = rule(".enemy-intent-token");
  assert.match(intent, /left:\s*31%/);
  assert.match(intent, /z-index:\s*8/);
  assert.match(base, /z-index:\s*7/);
});

test("configured mechanic meters use distinct translucent themes", () => {
  const alarm = rule(".enemy-mechanic-progress.kind-alarmClock");
  const rival = rule(".enemy-mechanic-progress.kind-rivalShadow");
  const finalExam = rule(".enemy-mechanic-progress.kind-finalExam");

  assert.match(alarm, /--mechanic-accent:\s*#d97862/);
  assert.match(alarm, /rgba\(86,48,39,\.84\)/);
  assert.match(rival, /--mechanic-accent:\s*#b79be7/);
  assert.match(rival, /rgba\(54,40,75,\.82\)/);
  assert.match(finalExam, /--mechanic-accent:\s*#df7768/);
  assert.match(finalExam, /rgba\(88,43,39,\.84\)/);
  assert.notEqual(alarm, rival);
  assert.notEqual(rival, finalExam);
});

test("default four-cell track and alarm three-cell track preserve states", () => {
  const track = rule(".mechanic-progress-track");
  const alarmTrack = rule(".enemy-mechanic-progress.kind-alarmClock .mechanic-progress-track");
  const complete = rule(".mechanic-progress-track > b.is-complete");
  const current = rule(".mechanic-progress-track > b.is-current");

  assert.match(track, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(alarmTrack, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(complete, /background:\s*var\(--mechanic-accent\)/);
  assert.match(current, /background:\s*var\(--mechanic-current\)/);
});

test("mobile progress remains compact while keeping its label and configured track", () => {
  const mobile = styles.match(/@media \(max-width: 700px\)\s*\{([\s\S]*)\n\}/);
  assert.ok(mobile, "missing mobile breakpoint");
  assert.match(mobile[1], /\.enemy-fighter:has\(\.enemy-mechanic-progress\) \.fighter-label\s*\{[^}]*transform:\s*translateX\(-58px\)[^}]*\}/);
  assert.match(mobile[1], /\.enemy-mechanic-progress\s*\{[^}]*top:\s*0[^}]*right:\s*0[^}]*width:\s*96px[^}]*\}/);
  assert.match(mobile[1], /\.enemy-mechanic-progress > span b\s*\{[^}]*font-size:\s*9px[^}]*\}/);
  assert.match(mobile[1], /\.enemy-mechanic-progress > span em\s*\{[^}]*font-size:\s*8px[^}]*\}/);
  assert.doesNotMatch(mobile[1], /\.enemy-mechanic-progress > span em\s*\{[^}]*display:\s*none/);
  assert.match(rule(".mechanic-progress-track"), /repeat\(4,/);
});

test("mechanic progress reserves compositor hints only during enemy resolution", () => {
  const base = rule(".enemy-mechanic-progress");
  const resolving = rule(".combat-board.enemy-resolving .enemy-mechanic-progress");

  assert.doesNotMatch(base, /will-change/);
  assert.match(resolving, /will-change:\s*transform/);
  assert.doesNotMatch(styles, /\.enemy-mechanic-progress[^{}]*\{[^}]*animation\s*:/);
  assert.doesNotMatch(styles, /\.enemy-mechanic-progress[^{}]*\{[^}]*transition\s*:\s*(?:top|right|bottom|left|width|height|margin|padding)/);
});
