import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";

const RUNTIME_ASSET_SOURCES = Object.freeze([
  "app.js",
  "game-data.js",
  "styles.css"
]);
const ASSET_PATH_PATTERN = /\bassets\/[A-Za-z0-9._/-]+\.(?:webp|png|jpe?g|svg|gif|avif|mp3|wav|ogg)/g;

function runtimeAssetReferences() {
  const references = new Map();
  for (const sourceFile of RUNTIME_ASSET_SOURCES) {
    const source = readFileSync(new URL(`../${sourceFile}`, import.meta.url), "utf8");
    for (const match of source.matchAll(ASSET_PATH_PATTERN)) {
      const assetPath = match[0];
      const sources = references.get(assetPath) || new Set();
      sources.add(sourceFile);
      references.set(assetPath, sources);
    }
  }
  return references;
}

test("运行代码中所有非空本地 asset 路径都指向实际文件", () => {
  const references = runtimeAssetReferences();
  assert.ok(references.size > 0, "没有扫描到任何运行资产，资源提取规则可能已经失效");

  const missing = [];
  const empty = [];
  for (const [assetPath, sourceFiles] of references) {
    const assetUrl = new URL(`../${assetPath}`, import.meta.url);
    const label = `${assetPath}（${[...sourceFiles].sort().join("、")}）`;
    if (!existsSync(assetUrl)) {
      missing.push(label);
      continue;
    }
    const asset = statSync(assetUrl);
    if (!asset.isFile() || asset.size <= 0) empty.push(label);
  }

  assert.deepEqual(
    missing.sort(),
    [],
    "正式非空 asset 路径不能指向缺失文件；未制作的槽位应置空并使用界面降级"
  );
  assert.deepEqual(empty.sort(), [], "正式 asset 文件必须是非空普通文件");
});
