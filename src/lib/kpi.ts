// SV画面の数字はすべてここで計算する。画面からは計算式を追い出し、テストで確かめられるようにする。

import { searchArticles, similarity } from "./text";
import type { Article, Category, Inquiry, Reply } from "./types";

export type DeskStats = {
  received: number;
  answered: number;
  escalated: number;
  open: number;
  /** 受信から最初の対応までの平均（分）。対応が0件ならnull */
  avgFirstResponseMin: number | null;
  /** 24時間以内に対応できた割合（マニュアルの「返信の基本ルール」）。
   *  分母＝対応済み＋受信から24時間以上たった未対応。まだ24時間たっていない未対応は数えない */
  within24hRate: number;
  /** AIの返信案がどれだけそのまま使われたか（0〜1）。AIを使った返信が0件ならnull */
  aiAdoption: number | null;
  aiUsedRate: number;
  byCategory: Record<Category, number>;
  topArticles: { article: Article; count: number }[];
  /** マニュアルに近い記事がない問い合わせ */
  gaps: Inquiry[];
};

const CATEGORIES: Category[] = ["payment", "account", "transfer", "bug", "event", "ban", "other"];

export function computeDeskStats(params: {
  inquiries: Inquiry[];
  replies: Reply[];
  articles: Article[];
  from: Date;
  to: Date;
  /** 「24時間以上たった未対応」を判定する基準の時刻 */
  now?: Date;
}): DeskStats {
  const { articles, from, to } = params;
  const now = params.now ?? new Date();
  const inRange = (iso: string) => {
    const t = new Date(iso);
    return t >= from && t < to;
  };
  const inquiries = params.inquiries.filter((q) => inRange(q.receivedAt));
  const ids = new Set(inquiries.map((q) => q.id));
  const replies = params.replies.filter((r) => ids.has(r.inquiryId));

  const firstReply = new Map<string, Reply>();
  for (const r of [...replies].sort((a, b) => a.at.localeCompare(b.at))) {
    if (!firstReply.has(r.inquiryId)) firstReply.set(r.inquiryId, r);
  }

  const waits = inquiries
    .filter((q) => firstReply.has(q.id))
    .map((q) => (new Date(firstReply.get(q.id)!.at).getTime() - new Date(q.receivedAt).getTime()) / 60000);

  const withAi = replies.filter((r) => r.kind === "sent" && r.aiDraft);
  const sentCount = replies.filter((r) => r.kind === "sent").length;

  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  for (const q of inquiries) {
    const r = firstReply.get(q.id);
    const cat = r?.category ?? (searchArticles(`${q.subject}\n${q.body}`, articles)[0]?.article.category ?? "other");
    byCategory[cat]++;
  }

  const citeCount = new Map<string, number>();
  for (const r of replies) for (const id of new Set(r.citedArticleIds)) citeCount.set(id, (citeCount.get(id) ?? 0) + 1);
  const topArticles = [...citeCount.entries()]
    .map(([id, count]) => ({ article: articles.find((a) => a.id === id)!, count }))
    .filter((x) => x.article)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const gaps = inquiries.filter((q) => {
    const r = firstReply.get(q.id);
    return r ? r.noArticleMatched : searchArticles(`${q.subject}\n${q.body}`, articles).length === 0;
  });

  return {
    received: inquiries.length,
    answered: inquiries.filter((q) => q.status === "sent").length,
    escalated: inquiries.filter((q) => q.status === "escalated").length,
    open: inquiries.filter((q) => q.status === "new").length,
    avgFirstResponseMin: waits.length ? waits.reduce((s, x) => s + x, 0) / waits.length : null,
    within24hRate: (() => {
      const overdueOpen = inquiries.filter((q) => !firstReply.has(q.id) && now.getTime() - new Date(q.receivedAt).getTime() > 24 * 3600 * 1000).length;
      const denom = waits.length + overdueOpen;
      return denom ? waits.filter((w) => w <= 24 * 60).length / denom : 0;
    })(),
    aiAdoption: withAi.length ? withAi.reduce((s, r) => s + similarity(r.aiDraft!, r.body), 0) / withAi.length : null,
    aiUsedRate: sentCount ? withAi.length / sentCount : 0,
    byCategory,
    topArticles,
    gaps,
  };
}

export function formatMinutes(min: number | null): string {
  if (min === null) return "—";
  if (min < 60) return `${Math.round(min)}分`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}時間${m}分` : `${h}時間`;
}
