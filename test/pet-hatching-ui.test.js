import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("宠物只能在新游戏开始界面选择，休息点只展示本局锁定伙伴", () => {
  assert.match(appSource, /class="starting-pet-picker"/);
  assert.match(appSource, /data-action="select-starting-pet"/);
  assert.match(appSource, /开始后锁定，直到下一局才能更换/);
  assert.match(appSource, /开局后已锁定，下局可重新选择/);
  assert.match(appSource, /new SemesterGame\(Date\.now\(\), archetypeId, startingPetId, availablePets\)/);
  assert.doesNotMatch(appSource, /switchPetAtRest|rest-switch|data-action="switch-pet"/);
});

test("孵化流程在挑战奖励、地图、休息点与战后结算中都有明确反馈", () => {
  assert.match(appSource, /pending\?\.rewardVariant === "egg"/);
  assert.match(appSource, /宠物蛋进入独立孵化位，不占书包/);
  assert.match(appSource, /incubatorStatusHtml\("map"\)/);
  assert.match(appSource, /incubatorStatusHtml\("rest"\)/);
  assert.match(appSource, /下一局可在开始界面选择；本局伙伴不变/);
  assert.match(styles, /\.pet-egg\s*\{/);
  assert.match(styles, /\.incubator-status\s*\{/);
  assert.match(styles, /\.incubation-recap\s*\{/);
});

test("孵化与开局选择样式包含移动端布局，入口缓存版本保持同步", () => {
  assert.match(styles, /@media\s*\(max-width:\s*700px\)[\s\S]*?\.starting-pet-picker\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(styles, /@media\s*\(max-width:\s*700px\)[\s\S]*?\.incubator-status\s*\{/);
  assert.match(index, /styles\.css\?v=1\.8\.38/);
  assert.match(index, /app\.js\?v=1\.8\.38/);
});
