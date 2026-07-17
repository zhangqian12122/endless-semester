export const SAVE_BACKUP_KIND = "endless-semester-backup";
export const SAVE_BACKUP_SCHEMA = 1;
export const FEEDBACK_REPORT_KIND = "endless-semester-feedback";
export const FEEDBACK_REPORT_SCHEMA = 1;
export const STORAGE_RECORD_STATUS = Object.freeze({
  empty: "empty",
  valid: "valid",
  corrupt: "corrupt"
});

export function inspectStorageRecord(raw, validator = (value) => value && typeof value === "object") {
  if (raw === null || raw === undefined || raw === "") {
    return { status: STORAGE_RECORD_STATUS.empty, value: null, raw: raw ?? null, reason: null };
  }
  if (typeof raw !== "string") {
    return { status: STORAGE_RECORD_STATUS.corrupt, value: null, raw: String(raw), reason: "invalid-storage-value" };
  }
  try {
    const value = JSON.parse(raw);
    if (!validator(value)) {
      return { status: STORAGE_RECORD_STATUS.corrupt, value: null, raw, reason: "invalid-save-shape" };
    }
    return { status: STORAGE_RECORD_STATUS.valid, value, raw, reason: null };
  } catch {
    return { status: STORAGE_RECORD_STATUS.corrupt, value: null, raw, reason: "invalid-json" };
  }
}

function plainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function clippedText(value, limit) {
  return String(value ?? "").trim().slice(0, limit);
}

export function normalizeFeedbackErrors(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.slice(-5).map((entry) => ({
    type: clippedText(entry?.type || "error", 40) || "error",
    message: clippedText(entry?.message || "未知错误", 500) || "未知错误",
    stack: clippedText(entry?.stack, 2000) || null,
    occurredAt: clippedText(entry?.occurredAt, 60) || null
  }));
}

export function createFeedbackReport({
  appVersion,
  screen,
  description = "",
  save = null,
  career,
  errors = [],
  environment = {},
  createdAt = new Date().toISOString()
} = {}) {
  if (!clippedText(appVersion, 40)) throw new Error("反馈包缺少游戏版本");
  if (!career || !plainObject(career)) throw new Error("反馈包缺少有效的生涯档案");
  if (save !== null && !plainObject(save)) throw new Error("反馈包中的当前对局无效");

  return JSON.stringify({
    kind: FEEDBACK_REPORT_KIND,
    schema: FEEDBACK_REPORT_SCHEMA,
    createdAt,
    appVersion: clippedText(appVersion, 40),
    issue: {
      screen: clippedText(screen || "unknown", 80) || "unknown",
      description: clippedText(description, 1200)
    },
    environment: plainObject(environment) ? environment : {},
    recentErrors: normalizeFeedbackErrors(errors),
    save,
    career
  }, null, 2);
}

export function createSaveBackup({ save = null, career, exportedAt = new Date().toISOString() } = {}) {
  if (!career || typeof career !== "object" || Array.isArray(career) || career.version !== 1) {
    throw new Error("生涯档案无效，无法创建备份");
  }
  if (save !== null && (typeof save !== "object" || Array.isArray(save))) {
    throw new Error("当前对局存档无效，无法创建备份");
  }
  return JSON.stringify({
    kind: SAVE_BACKUP_KIND,
    schema: SAVE_BACKUP_SCHEMA,
    exportedAt,
    save,
    career
  });
}

export function parseSaveBackup(text) {
  if (typeof text !== "string" || !text.trim()) throw new Error("请先粘贴存档码");
  if (text.length > 2_000_000) throw new Error("存档码过大，已拒绝导入");

  let payload;
  try {
    payload = JSON.parse(text.trim());
  } catch {
    throw new Error("存档码不是有效的 JSON");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)
    || payload.kind !== SAVE_BACKUP_KIND || payload.schema !== SAVE_BACKUP_SCHEMA) {
    throw new Error("存档码版本或格式不受支持");
  }
  if (!("save" in payload) || !("career" in payload)
    || (payload.save !== null && (typeof payload.save !== "object" || Array.isArray(payload.save)))
    || !payload.career || typeof payload.career !== "object" || Array.isArray(payload.career)
    || payload.career.version !== 1) {
    throw new Error("存档码缺少有效的对局或生涯数据");
  }

  return {
    save: payload.save,
    career: payload.career,
    exportedAt: typeof payload.exportedAt === "string" ? payload.exportedAt : null
  };
}
