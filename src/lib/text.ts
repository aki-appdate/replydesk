// 文章を扱う小さな道具：記事探し・引用の確認・言ってはいけない表現の検出・文章の近さ。
// どれもAIを使わない普通の計算なので、テストで動きを確かめられる。

import type { Article, Citation } from "./types";

/** 空白や記号のゆれをならす（引用の照合用） */
export function normalize(s: string): string {
  return s.replace(/[\s　]/g, "").replace(/[「」『』（）()、,。．.！!？?]/g, "");
}

function bigrams(s: string): Set<string> {
  const t = normalize(s);
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

/** 2つの文章がどれくらい近いか（0〜1）。AIの返信案がどれだけそのまま使われたかを測る */
export function similarity(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return (2 * inter) / (A.size + B.size);
}

/**
 * 問い合わせに関係しそうな記事を探す。
 * 記事ごとに決めた言葉（keywords）が問い合わせに含まれるかで選び、同点なら文字の重なりで並べる。
 * 1語も当たらなければ「マニュアルに載っていない質問」とみなす。
 */
export function searchArticles(query: string, articles: Article[], limit = 4): { article: Article; score: number; hits: string[] }[] {
  const q = normalize(query).toLowerCase();
  return articles
    .map((article) => {
      const hits = article.keywords.filter((k) => q.includes(normalize(k).toLowerCase()));
      return { article, hits, score: hits.length + similarity(query, article.title + article.body) };
    })
    .filter((r) => r.hits.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export type CheckedCitation = Citation & { valid: boolean; articleTitle: string | null };

/** AIが挙げた引用が、その記事の本文に本当にあるかを確かめる */
export function checkCitations(citations: Citation[], articles: Article[]): CheckedCitation[] {
  return citations.map((c) => {
    const a = articles.find((x) => x.id === c.articleId);
    const valid = !!a && normalize(c.quote).length >= 6 && normalize(a.body).includes(normalize(c.quote));
    return { ...c, valid, articleTitle: a?.title ?? null };
  });
}

/** 担当者が勝手に約束してはいけない表現。マニュアルの「返信の基本ルール」「返金」の記事にもとづく */
const RISKY: { pattern: RegExp; reason: string }[] = [
  { pattern: /返金(いた)?します|返金させていただきます|返金を?お約束|返金に応じ|(代金|料金|金額|全額|ご購入分)を?(お)?(戻し|返し)(いた)?します|お戻しいたします|払い戻(し|しいた)します/, reason: "返金は担当者が約束できません（SVに相談）" },
  { pattern: /補償(いた)?します|補填(いた)?します|お詫びの?(品|アイテム|石|かけら)を?(お送り|付与|配布)/, reason: "補償の約束は担当者だけで決められません" },
  { pattern: /必ず(復旧|直り|直し|解決|反映)/, reason: "できるか分からないことを「必ず」と約束しています" },
  { pattern: /絶対に?(大丈夫|問題ありません|直ります)/, reason: "断定しすぎの表現です" },
  { pattern: /停止の?理由は|違反(の内容|行為)は.{0,10}(です|でした)/, reason: "利用停止の理由はお伝えしない決まりです" },
  { pattern: /\d{2,4}-\d{2,4}-\d{3,4}/, reason: "電話番号のような情報が含まれています（個人情報を繰り返さない）" },
];

export function findRiskyPhrases(text: string): { match: string; reason: string }[] {
  const out: { match: string; reason: string }[] = [];
  for (const r of RISKY) {
    const m = text.match(r.pattern);
    if (m) out.push({ match: m[0], reason: r.reason });
  }
  return out;
}

/** 記事本文を文に分ける（見本の返答で引用を作るとき用） */
export function sentences(body: string): string[] {
  return body
    .split("。")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `${s}。`);
}
