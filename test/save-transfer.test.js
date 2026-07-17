import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  FEEDBACK_REPORT_KIND,
  FEEDBACK_REPORT_SCHEMA,
  SAVE_BACKUP_KIND,
  SAVE_BACKUP_SCHEMA,
  STORAGE_RECORD_STATUS,
  createFeedbackReport,
  createSaveBackup,
  inspectStorageRecord,
  normalizeFeedbackErrors,
  parseSaveBackup
} from "../save-transfer.js";

const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const packageLock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const serverSource = readFileSync(new URL("../server.mjs", import.meta.url), "utf8");

test("试玩备份完整往返当前对局与生涯档案", () => {
  const save = { version: 2, archetypeId: "cancer", deck: [{ id: "textbookStrike" }] };
  const career = { version: 1, combatsWon: 7 };
  const exportedAt = "2026-07-17T06:00:00.000Z";
  const code = createSaveBackup({ save, career, exportedAt });
  const raw = JSON.parse(code);

  assert.equal(raw.kind, SAVE_BACKUP_KIND);
  assert.equal(raw.schema, SAVE_BACKUP_SCHEMA);
  assert.deepEqual(parseSaveBackup(code), { save, career, exportedAt });
});

test("无进行中对局的备份保留生涯档案并拒绝污染格式", () => {
  const career = { version: 1, unlockedAchievements: [] };
  assert.equal(parseSaveBackup(createSaveBackup({ career })).save, null);

  for (const invalid of [
    "",
    "not-json",
    JSON.stringify({ kind: SAVE_BACKUP_KIND, schema: 99, save: null, career }),
    JSON.stringify({ kind: SAVE_BACKUP_KIND, schema: SAVE_BACKUP_SCHEMA, save: [], career }),
    JSON.stringify({ kind: SAVE_BACKUP_KIND, schema: SAVE_BACKUP_SCHEMA, save: null, career: null })
  ]) assert.throws(() => parseSaveBackup(invalid));

  assert.throws(() => parseSaveBackup(JSON.stringify({
    kind: SAVE_BACKUP_KIND,
    schema: SAVE_BACKUP_SCHEMA,
    save: null,
    career: { version: 2 }
  })));
});

test("本地存档检查区分缺失、有效与损坏并保留原始内容", () => {
  const validator = (value) => value?.version === 2 && Array.isArray(value.deck);
  assert.deepEqual(inspectStorageRecord(null, validator), {
    status: STORAGE_RECORD_STATUS.empty,
    value: null,
    raw: null,
    reason: null
  });

  const validRaw = JSON.stringify({ version: 2, deck: [] });
  assert.deepEqual(inspectStorageRecord(validRaw, validator), {
    status: STORAGE_RECORD_STATUS.valid,
    value: { version: 2, deck: [] },
    raw: validRaw,
    reason: null
  });

  const invalidJson = "{broken";
  assert.deepEqual(inspectStorageRecord(invalidJson, validator), {
    status: STORAGE_RECORD_STATUS.corrupt,
    value: null,
    raw: invalidJson,
    reason: "invalid-json"
  });
  assert.equal(inspectStorageRecord(JSON.stringify({ version: 1 }), validator).reason, "invalid-save-shape");
});

test("档案页提供显式导出与带确认的导入入口，失败不会先写本地存储", () => {
  assert.match(appSource, /data-action="open-save-export"/);
  assert.match(appSource, /data-action="open-save-import"/);
  assert.match(appSource, /id="save-backup-output"[\s\S]*?readonly/);
  assert.match(appSource, /id="save-backup-input"/);
  assert.match(appSource, /确认导入并覆盖当前浏览器存档/);

  const restoreStart = appSource.indexOf("function restoreSaveBackup(");
  const restoreEnd = appSource.indexOf("\nfunction ", restoreStart + 1);
  const restore = appSource.slice(restoreStart, restoreEnd);
  assert.ok(restoreStart >= 0);
  assert.ok(restore.indexOf("parseSaveBackup") < restore.indexOf("restoreStorageValue(SAVE_KEY"));
  assert.ok(restore.indexOf("SemesterGame.fromJSON") < restore.indexOf("restoreStorageValue(SAVE_KEY"));
  assert.match(restore, /previousSave[\s\S]*?previousCareer[\s\S]*?catch[\s\S]*?restoreStorageValue/);

  assert.match(styles, /\.save-transfer-panel\s*\{/);
  assert.match(styles, /\.save-transfer-editor textarea\s*\{/);
}
);

test("试玩反馈包固定版本、问题现场、错误与存档，且限制自由文本长度", () => {
  const save = { version: 2, week: 8 };
  const career = { version: 1, combatsWon: 3 };
  const text = createFeedbackReport({
    appVersion: "1.8.62",
    screen: "combat",
    description: `精英结算卡住 ${"x".repeat(1400)}`,
    save,
    career,
    errors: Array.from({ length: 7 }, (_, index) => ({
      type: "window.error",
      message: `错误 ${index}`,
      stack: "s".repeat(2500),
      occurredAt: "2026-07-17T07:00:00.000Z"
    })),
    environment: { viewport: "390x844" },
    createdAt: "2026-07-17T07:05:00.000Z"
  });
  const report = JSON.parse(text);

  assert.equal(report.kind, FEEDBACK_REPORT_KIND);
  assert.equal(report.schema, FEEDBACK_REPORT_SCHEMA);
  assert.equal(report.appVersion, "1.8.62");
  assert.equal(report.issue.screen, "combat");
  assert.equal(report.issue.description.length, 1200);
  assert.equal(report.recentErrors.length, 5);
  assert.equal(report.recentErrors[0].message, "错误 2");
  assert.equal(report.recentErrors[0].stack.length, 2000);
  assert.deepEqual(report.save, save);
  assert.deepEqual(report.career, career);
});

test("反馈包拒绝无效核心数据，错误清洗对污染输入安全降级", () => {
  assert.deepEqual(normalizeFeedbackErrors(null), []);
  assert.deepEqual(normalizeFeedbackErrors([null]), [{
    type: "error",
    message: "未知错误",
    stack: null,
    occurredAt: null
  }]);
  assert.throws(() => createFeedbackReport({ appVersion: "", career: { version: 1 } }));
  assert.throws(() => createFeedbackReport({ appVersion: "1.8.62", career: null }));
  assert.throws(() => createFeedbackReport({ appVersion: "1.8.62", career: { version: 1 }, save: [] }));
});

test("档案页可生成和复制反馈包，并明确不会自动上传", () => {
  assert.match(appSource, /data-action="open-feedback-report"/);
  assert.match(appSource, /id="feedback-description"/);
  assert.match(appSource, /id="feedback-report-output"[\s\S]*?readonly/);
  assert.match(appSource, /data-action="copy-feedback-report"/);
  assert.match(appSource, /window\.addEventListener\("error"/);
  assert.match(appSource, /window\.addEventListener\("unhandledrejection"/);
  assert.match(appSource, /不会自动上传/);
  assert.match(styles, /\.feedback-report-meta\s*\{/);
  assert.match(styles, /\.feedback-report-editor \.feedback-description\s*\{/);
});

test("公开试玩入口与全部一级模块使用同一缓存版本", () => {
  const version = "1.8.62";
  assert.match(indexSource, new RegExp(`styles\\.css\\?v=${version}`));
  assert.match(indexSource, new RegExp(`app\\.js\\?v=${version}`));

  for (const file of ["app.js", "game-engine.js", "build-analysis.js", "career.js"]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const imports = [...source.matchAll(/from\s+"(\.\/[^"?]+\.js(?:\?v=[^"]+)?)"/g)].map((match) => match[1]);
    assert.ok(imports.length > 0, `${file} 应至少包含一个一级模块依赖`);
    for (const specifier of imports) {
      assert.match(specifier, new RegExp(`\\?v=${version}$`), `${file} 的 ${specifier} 未同步缓存版本`);
    }
  }
});

test("试玩版本号与本地素材 MIME 保持发布一致", () => {
  const version = "1.8.62";
  assert.equal(packageJson.version, version);
  assert.equal(packageLock.version, version);
  assert.equal(packageLock.packages[""].version, version);
  assert.match(appSource, new RegExp(`APP_VERSION = "${version.replaceAll(".", "\\.")}"`));
  assert.match(serverSource, /"\.webp": "image\/webp"/);
  assert.match(serverSource, /"\.png": "image\/png"/);
  assert.match(serverSource, /"\.woff2": "font\/woff2"/);
});

test("异常存档与写入失败拥有持续保护入口且导出优先使用内存进度", () => {
  assert.match(appSource, /function readSaveState\(\)[\s\S]*?inspectStorageRecord\(localStorage\.getItem\(SAVE_KEY\), validStoredRun\)/);
  assert.match(appSource, /blockedByStoredSave[\s\S]*?data-action="open-corrupt-save"/);
  assert.match(appSource, /data-action="new-game" \$\{blockedByStoredSave \? "disabled"/);
  assert.match(appSource, /function renderCorruptSave\(\)[\s\S]*?corrupt-save-output[\s\S]*?discard-corrupt-save/);
  assert.match(appSource, /action === "continue-game"[\s\S]*?catch \(error\)[\s\S]*?原始数据仍然保留/);
  assert.doesNotMatch(appSource, /action === "continue-game"[\s\S]*?catch \(error\) \{[\s\S]{0,160}?clearSave\(\)/);
  assert.match(appSource, /storageFailures\.run = \{[\s\S]*?storage\.run\.write/);
  assert.match(appSource, /storageFailures\.career = \{[\s\S]*?storage\.career\.write/);
  assert.match(appSource, /function storageFailureWarning\(\)[\s\S]*?data-action="open-emergency-save"/);
  assert.match(appSource, /save: hasActiveRun && game\.combat\?\.status !== "lost" \? game\.toJSON\(\) : readSave\(\)/);
  assert.match(styles, /\.corrupt-save-warning,[\s\S]*?\.storage-failure-warning/);
  assert.match(styles, /\.corrupt-save-editor textarea\[readonly\]/);
});
