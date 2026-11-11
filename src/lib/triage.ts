// 一覧に並べるための自動判定（AIを使わない）。返信案を作る前でも、急ぎのものを上に出すために使う。

import { detectCategory, detectSentiment, detectUrgency } from "./ai/sample";
import { searchArticles } from "./text";
import type { Article, Category, Inquiry, Sentiment, Urgency } from "./types";

export function triage(inquiry: Inquiry, articles: Article[]): { category: Category; sentiment: Sentiment; urgency: Urgency } {
  const text = `${inquiry.subject}\n${inquiry.body}`;
  const category = detectCategory(text, searchArticles(text, articles)[0]?.article);
  const sentiment = detectSentiment(text);
  return { category, sentiment, urgency: detectUrgency(text, category, sentiment) };
}
