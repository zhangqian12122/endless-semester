import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PET_DEFS } from "../game-data.js";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = appSource.indexOf(startMarker);
  const end = appSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `缺少源码片段：${startMarker}`);
  assert.notEqual(end, -1, `缺少源码片段结束标记：${endMarker}`);
  return appSource.slice(start, end);
}

function functionSource(name) {
  const marker = `function ${name}(`;
  const start = appSource.indexOf(marker);
  assert.notEqual(start, -1, `缺少动态文案生成器：${name}`);

  const bodyStart = appSource.indexOf("{", start + marker.length);
  assert.notEqual(bodyStart, -1, `${name} 缺少函数体`);

  let depth = 0;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    if (appSource[index] === "{") depth += 1;
    if (appSource[index] === "}") depth -= 1;
    if (depth === 0) return appSource.slice(start, index + 1);
  }

  assert.fail(`${name} 函数体没有闭合`);
}

test("社团招新确认结果按当前活动宠物动态生成", () => {
  let activePet = PET_DEFS.offlineDuck;
  const outcome = Function(
    "currentPetDefinition",
    `"use strict"; ${functionSource("eventConfirmOutcome")}; return eventConfirmOutcome;`
  )(() => activePet);

  for (const petId of ["offlineDuck", "sleepyBugCub", "milkDragonCub"]) {
    activePet = PET_DEFS[petId];
    const copy = outcome("club-pet");

    assert.equal(typeof copy, "string");
    assert.match(copy, new RegExp(activePet.shortName), `${petId} 必须显示自己的简称`);
    assert.match(copy, /2\s*点/, "结果文案仍需说明实际增加 2 点羁绊");
  }
});

test("事件确认页在渲染时读取结果文案，禁止模块级静态插值宠物名", () => {
  const renderer = sourceBetween("function renderEventConfirm(", "function renderSemesterComplete(");
  assert.match(
    renderer,
    /eventConfirmOutcome\(context\.choice\)/,
    "确认页必须在每次渲染时读取当前宠物对应的结果文案"
  );

  const staticOutcomes = appSource.match(
    /const\s+EVENT_CONFIRM_OUTCOMES\s*=\s*\{[\s\S]*?^\};/m
  )?.[0] || "";
  assert.doesNotMatch(
    staticOutcomes,
    /`[^`]*\$\{\s*currentPetDefinition\(\)\.shortName\s*\}[^`]*`/,
    "模块加载时读取宠物名称会把默认鸭子文案冻结到整局游戏"
  );
});
