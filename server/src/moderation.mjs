import { moderationRules } from "./config.mjs";

export function moderateText(text) {
  const value = String(text || "").trim();
  if (!value) {
    return { allowed: false, reason: "empty" };
  }
  if (value.length > 280) {
    return { allowed: false, reason: "too_long" };
  }
  for (const rule of moderationRules) {
    if (rule.patterns.some((pattern) => pattern.test(value))) {
      return { allowed: false, reason: rule.reason };
    }
  }
  return { allowed: true, text: value };
}
