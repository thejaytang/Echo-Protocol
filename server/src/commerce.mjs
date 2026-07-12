const commerceCatalog = {
  version: "phase2-preview-v1",
  paymentsEnabled: false,
  purchaseProvider: "app_store_iap_required",
  headline: "权益预告",
  summary: "只规划外观、复盘和好友房便利，不出售胜率、身份信息或投票优势。",
  fairnessGuards: [
    "不出售身份、阵营、AI 位置或投票提示。",
    "不提高匹配胜率、发言权重、结算分或排行榜分。",
    "不绕过内容审核、举报、拉黑、封禁和年龄确认。",
    "真实支付上线前必须走 Apple IAP，并重新核对隐私清单。",
  ],
  offers: [
    {
      id: "cosmetic_theme_pack",
      title: "装扮主题包",
      category: "cosmetic",
      phase: "Phase 2",
      status: "preview",
      priceLabel: "未开放",
      value: "头像框、桌面色、结算卡样式。",
      fairness: "只改变展示，不影响身份、投票、匹配或结算。",
    },
    {
      id: "replay_archive_plus",
      title: "复盘库扩展",
      category: "replay",
      phase: "Phase 2",
      status: "preview",
      priceLabel: "未开放",
      value: "保留更多历史复盘和分享卡模板。",
      fairness: "只延长回看和整理能力，不提前泄露局内信息。",
    },
    {
      id: "friend_room_plus",
      title: "好友房便利包",
      category: "room",
      phase: "Phase 3",
      status: "preview",
      priceLabel: "未开放",
      value: "更多房间主题、房主装饰和房间记录整理。",
      fairness: "不降低最低真人数，不改变角色分配和胜负条件。",
    },
  ],
};

export function publicCommerceCatalog() {
  return structuredClone(commerceCatalog);
}
