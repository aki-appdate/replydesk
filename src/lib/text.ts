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

/**
 * 送信前に止める言い回し。マニュアルの「返信の基本ルール」「返金」の記事にもとづく。
 * 言い方を少し変えても見逃さないよう、文ごとに「話題の言葉」＋「約束・実行の言い方」を探す。
 * 「できません・確認します」などの打ち消しは、文全体ではなく、話題の言葉から後ろを
 * 「、」「が」「けど」で区切った節の中だけで見る（前の節の「確認したところ、」や、
 * 別の話題の「返金はできませんが、」で、後ろの約束が見逃されないようにするため）。
 */
type RiskRule = {
  topic: RegExp;
  /** 話題の言葉のあとに、これがあれば約束とみなす。なければ話題の言葉だけで止める */
  commit?: RegExp;
  /** 話題の言葉のあとの節に、約束より先にこれがあれば止めない */
  unless?: RegExp;
  reason: string;
  /** SVが判断したうえでなら書いてよいもの（返金・補償）。SVには「要確認」として出す */
  svMayDecide?: string;
};

export type RiskyPhrase = { match: string; reason: string; severity: "stop" | "caution" };

// 「確認します」「ストアにお問い合わせください」のような、約束ではない言い方
const NOT_A_PROMISE =
  /いたしかね|致しかね|できかね|でき(ない|ません)|お受けでき|行って(い|お)りません|お約束でき|とは限りません|限らない|かどうか|可否|確認(いた)?し|確認させ|確認の|担当部署|ストア|App Store|Google Play|お問い合わせ(ください|いただ)|ご案内でき|判断|検討/;

// 約束・実行を言い切る言い方
const PROMISE = /いたします|します|させていただ|対応|手続き|進め|約束|応じ|お戻し|お返し|できます|可能|となります|になります|されます|行います|処理/;

const RISKY: RiskRule[] = [
  {
    topic: /返金|払い?戻し|(代金|料金|金額|全額|お金|ご?購入分|課金分).{0,6}(お戻し|お返し)/g,
    commit: PROMISE,
    unless: NOT_A_PROMISE,
    reason: "返金は担当者が約束できません（SVに相談）",
    svMayDecide: "返金を約束する文です。SVとして判断した内容か確かめてから送ってください",
  },
  {
    topic: /補償|補填|お詫び(の品|として|に)|代わりに.{0,10}(かけら|アイテム)|(かけら|アイテム|石).{0,10}(お送り|お渡し|差し上げ|プレゼント|付与(いた|し|させ))/g,
    commit: /いたします|します|させていただ|お送り|お渡し|差し上げ|付与|プレゼント|となります|になります|できます/,
    unless: NOT_A_PROMISE,
    reason: "補償・お詫びの品の約束は担当者だけで決められません",
    svMayDecide: "補償・お詫びの品を約束する文です。SVとして判断した内容か確かめてから送ってください",
  },
  { topic: /必ず(?!しも).{0,8}(復旧|直|解決|反映|戻|届)/g, unless: /とは限りません|限らない|約束(でき|しない|いたしかね)/, reason: "できるか分からないことを「必ず」と約束しています" },
  {
    topic: /絶対に?(大丈夫|問題ありません|直ります|戻ります)|間違いなく(直|戻|届)|確実に.{0,8}(復旧|直|解決|反映|戻|届)|すぐ(に)?(直ります|治ります|戻ります|復旧します|解決します)/g,
    unless: /とは限りません|限らない|約束(でき|しない|いたしかね)|かどうか/,
    reason: "断定しすぎの表現です",
  },
  { topic: /停止の?理由は|違反(の内容|行為)は.{0,10}(です|でした)|(不正|チート).{0,10}(が確認された|を使用された)ため/g, reason: "利用停止の理由はお伝えしない決まりです" },
  // 日本の電話番号の形（0から始まる10〜11桁）。引き継ぎコードなどの数字は対象にしない
  { topic: /(?<![\d-])0\d{1,4}-\d{1,4}-\d{3,4}(?![\d-])/g, reason: "電話番号のような情報が含まれています（個人情報を繰り返さない）" },
];

/** 話題の言葉から後ろを、節（「、」「が」「けど」などの区切り）に分ける */
function clausesAfter(sentence: string, from: number): string[] {
  return sentence
    .slice(from)
    .split(/(?<=[、，,])|(?<=けれど|けど|ものの|ですが|ますが|でしたが)/)
    .filter(Boolean);
}

function isHit(rule: RiskRule, sentence: string, at: number): boolean {
  const clauses = clausesAfter(sentence, at);
  // 話題の言葉だけで止めるもの（「必ず復旧」など）は、話題の節だけで決める
  if (!rule.commit) return !rule.unless?.test(clauses[0]);
  // 節を前から順に見て、打ち消しと約束のどちらが先に出るかで決める
  for (const clause of clauses) {
    if (rule.unless?.test(clause)) return false;
    if (rule.commit.test(clause)) return true;
  }
  return false;
}

export function findRiskyPhrases(text: string, opts: { isSv?: boolean } = {}): RiskyPhrase[] {
  const out: RiskyPhrase[] = [];
  const parts = text.split(/(?<=[。！？!?\n])/).map((x) => x.trim()).filter(Boolean);
  for (const r of RISKY) {
    const hit = parts.find((sen) => [...sen.matchAll(r.topic)].some((m) => isHit(r, sen, m.index)));
    if (!hit) continue;
    const match = hit.length > 40 ? `${hit.slice(0, 40)}…` : hit;
    if (opts.isSv && r.svMayDecide) out.push({ match, reason: r.svMayDecide, severity: "caution" });
    else out.push({ match, reason: r.reason, severity: "stop" });
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
