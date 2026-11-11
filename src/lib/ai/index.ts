import { getFirebaseApp } from "../firebase";
import { toDateKey } from "../dates";
import { gapInsightJsonSchema, gapInsightSchema, replyDraftJsonSchema, replyDraftSchema } from "../schemas";
import { searchArticles } from "../text";
import type { AiSource, Article, GapInsight, Inquiry, ReplyDraft } from "../types";
import { generateStructured } from "./gemini";
import { buildGapPrompt, buildReplyPrompt, GAP_SYSTEM, REPLY_SYSTEM } from "./prompts";
import { detectEscalation, sampleGapInsight, sampleReplyDraft } from "./sample";

// 画面から呼ぶのはこのファイルだけ。
// Geminiが使えれば使い、使えなければ（未設定・回数の上限・エラー・返答の形が不正）見本の返答に切り替える。

export type AiResult<T> = { value: T; source: AiSource; note?: string };

/** 無料枠を一人で使い切らないよう、ブラウザごとに1日の回数を区切る */
const DAILY_LIMIT = 30;
const USAGE_KEY = "replydesk:ai-usage";

function takeQuota(): boolean {
  try {
    const today = toDateKey(new Date());
    const raw = localStorage.getItem(USAGE_KEY);
    const u = raw ? (JSON.parse(raw) as { date: string; count: number }) : { date: today, count: 0 };
    const cur = u.date === today ? u : { date: today, count: 0 };
    if (cur.count >= DAILY_LIMIT) return false;
    localStorage.setItem(USAGE_KEY, JSON.stringify({ date: today, count: cur.count + 1 }));
    return true;
  } catch {
    return true;
  }
}

export function aiMode(): AiSource {
  return getFirebaseApp() ? "gemini" : "sample";
}

/** 返信案を作る。AIに渡す記事は、先にキーワードで絞った関係のありそうなものだけ */
export async function draftReply(inquiry: Inquiry, articles: Article[]): Promise<AiResult<ReplyDraft> & { referenced: Article[] }> {
  const referenced = searchArticles(`${inquiry.subject}\n${inquiry.body}`, articles).map((m) => m.article);
  // 「返信の基本ルール」「個人情報の取り扱い」はいつも渡す
  const rules = articles.filter((a) => a.keywords.length === 0);
  const fallback = (note?: string) => ({ value: sampleReplyDraft(inquiry, articles), source: "sample" as const, note, referenced });

  const app = getFirebaseApp();
  if (!app) return fallback();
  if (!takeQuota()) return fallback("今日のAI利用回数の上限に達したため、見本の返答を表示しています");

  try {
    const value = await generateStructured({
      app,
      system: REPLY_SYSTEM,
      prompt: buildReplyPrompt(inquiry, [...referenced, ...rules]),
      schema: replyDraftSchema,
      jsonSchema: replyDraftJsonSchema,
    });
    // SVに回すかどうかはAIだけに任せない。コードの判定で「必要」なら、AIが不要と言っても必要にする
    const rule = detectEscalation(`${inquiry.subject}\n${inquiry.body}`);
    if (rule.needed && !value.escalation.needed) value.escalation = rule;
    if (value.escalation.needed) value.urgency = "high";
    return { value, source: "gemini", referenced };
  } catch (e) {
    console.warn("[ai] draftReply fallback", e);
    return fallback("AIに接続できなかったため、見本の返答を表示しています");
  }
}

export async function analyzeGaps(gaps: Inquiry[]): Promise<AiResult<GapInsight>> {
  const fallback = (note?: string): AiResult<GapInsight> => ({ value: sampleGapInsight(gaps), source: "sample", note });
  const app = getFirebaseApp();
  if (!app || gaps.length === 0) return fallback();
  if (!takeQuota()) return fallback("今日のAI利用回数の上限に達したため、見本の返答を表示しています");

  try {
    const value = await generateStructured({
      app,
      system: GAP_SYSTEM,
      prompt: buildGapPrompt(gaps),
      schema: gapInsightSchema,
      jsonSchema: gapInsightJsonSchema,
    });
    // 根拠のidは実在するものだけ残す。根拠が1つも残らない提案は捨てる
    const ids = new Set(gaps.map((q) => q.id));
    value.suggestions = value.suggestions
      .map((s) => ({ ...s, evidenceInquiryIds: s.evidenceInquiryIds.filter((id) => ids.has(id)) }))
      .filter((s) => s.evidenceInquiryIds.length > 0);
    if (value.suggestions.length === 0) return fallback("AIの返答に根拠が確認できなかったため、見本の返答を表示しています");
    return { value, source: "gemini" };
  } catch (e) {
    console.warn("[ai] analyzeGaps fallback", e);
    return fallback("AIに接続できなかったため、見本の返答を表示しています");
  }
}
