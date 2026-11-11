import type { Category, InquiryStatus, Sentiment, Urgency } from "./types";

export const CATEGORY_LABEL: Record<Category, string> = {
  payment: "課金・購入",
  account: "ログイン・アカウント",
  transfer: "機種変更・引き継ぎ",
  bug: "不具合",
  event: "イベント・報酬",
  ban: "利用停止",
  other: "その他",
};

export const URGENCY_LABEL: Record<Urgency, string> = {
  high: "急ぎ",
  mid: "通常",
  low: "低",
};

export const SENTIMENT_LABEL: Record<Sentiment, string> = {
  angry: "怒っている",
  confused: "困っている",
  calm: "落ち着いている",
};

export const STATUS_LABEL: Record<InquiryStatus, string> = {
  new: "未対応",
  sent: "返信済み",
  escalated: "SVに相談中",
};
