// 「見本の返答」。AIが使えないとき（未設定・無料枠の上限・通信エラー）に使う、ルールベースの返信案。
// 引用は記事本文の文をそのまま使うので、根拠チェックを必ず通る。AIと同じ形（ReplyDraft）を返す。

import { CATEGORY_LABEL } from "../labels";
import { searchArticles, sentences, similarity } from "../text";
import type { Article, Category, GapInsight, Inquiry, ReplyDraft, Sentiment, Urgency } from "../types";

const CATEGORY_RULES: { category: Category; pattern: RegExp }[] = [
  { category: "ban", pattern: /停止|BAN|ＢＡＮ|凍結|垢バン/i },
  { category: "transfer", pattern: /機種変|引き継|引継|新しい(スマホ|端末|iPhone|機種)|データ(移行|が消え)/ },
  { category: "payment", pattern: /課金|購入|買っ|買い|星のかけら|レシート|返金|請求|決済/ },
  { category: "bug", pattern: /落ち|固ま|重い|不具合|バグ|強制終了|フリーズ/ },
  { category: "account", pattern: /ログイン|アカウント|パスワード|入れない|エラー/ },
  { category: "event", pattern: /イベント|報酬|ランキング|プレゼント|ログインボーナス|交換所/ },
];

export function detectCategory(text: string, top: Article | undefined): Category {
  for (const r of CATEGORY_RULES) if (r.pattern.test(text)) return r.category;
  return top?.category ?? "other";
}

export function detectSentiment(text: string): Sentiment {
  if (/ふざけ|ありえない|あり得ない|最悪|返金しろ|訴え|金返せ|どうなって|いい加減|すぐに解除|何も悪いこと|納得でき|！！|!!|怒/.test(text)) return "angry";
  if (/分からない|わからない|どうすれば|困って|教えて|できません|できない/.test(text)) return "confused";
  return "calm";
}

const ESCALATION_RULES: { pattern: RegExp; reason: string }[] = [
  { pattern: /未成年|子ども|子供|息子|娘|小学生|中学生/, reason: "未成年の課金の可能性があるため" },
  { pattern: /返金|返して|金返せ|払い戻/, reason: "返金の判断は担当者ではできないため" },
  { pattern: /消費者センター|弁護士|訴え|法的/, reason: "法的な対応が必要になる可能性があるため" },
  { pattern: /停止|BAN|ＢＡＮ|凍結/i, reason: "利用停止の判断は担当者ではできないため" },
];

export function detectEscalation(text: string): ReplyDraft["escalation"] {
  for (const r of ESCALATION_RULES) if (r.pattern.test(text)) return { needed: true, reason: r.reason };
  return { needed: false, reason: null };
}

export function detectUrgency(text: string, category: Category, sentiment: Sentiment): Urgency {
  // SVの判断が必要なもの（返金・未成年・法的な話・利用停止）は、内容を問わず急ぎ
  if (detectEscalation(text).needed) return "high";
  if (sentiment === "angry" || category === "payment" || category === "ban" || /消え|なくな|失っ|全部/.test(text)) return "high";
  if (category === "event" && sentiment === "calm") return "low";
  return "mid";
}

const MISSING: Record<Category, { label: string; skipIf?: RegExp; onlyIf?: RegExp }[]> = {
  payment: [{ label: "購入した日時", skipIf: /\d+月\d+日|昨日|今日|おととい/ }, { label: "ストアのレシートの注文番号", skipIf: /注文番号|GPA|MKA/ }],
  account: [{ label: "表示されたエラー番号", skipIf: /エラー(番号|コード)?\s*[0-9A-Z-]{3,}/ }],
  transfer: [{ label: "最後に遊んだおおよその日時", onlyIf: /消え|壊れ|なくし|紛失|控えて|メモして/ }, { label: "直近の課金履歴（日付と金額）", onlyIf: /消え|壊れ|なくし|紛失|控えて|メモして/ }],
  bug: [{ label: "機種名" , skipIf: /iPhone|Pixel|Galaxy|Xperia|AQUOS/ }, { label: "OSのバージョン", skipIf: /iOS|Android/ }, { label: "落ちる場面", skipIf: /とき|時に|中に/ }],
  event: [{ label: "受け取れない報酬の名前" }],
  ban: [],
  other: [],
};

// 記事のうち、担当者向けの指示（お客さまに見せる文ではないもの）
const STAFF_ONLY = /担当者|SV|案内して|案内します|伺い|伺います|約束|記録|教えないよう|お伝えしません|確認します|付与します/;

const EMPATHY: Record<Sentiment, string> = {
  angry: "ご不便とご不快な思いをおかけしており、誠に申し訳ございません。",
  confused: "お困りのことと存じます。分かる範囲でご案内いたします。",
  calm: "ご不便をおかけしており、申し訳ございません。",
};

export function sampleReplyDraft(inquiry: Inquiry, articles: Article[]): ReplyDraft {
  const text = `${inquiry.subject}\n${inquiry.body}`;
  const matches = searchArticles(text, articles);
  const category = detectCategory(text, matches[0]?.article);
  const sentiment = detectSentiment(text);
  const escalation = detectEscalation(text);

  // 問い合わせに一番近い文を、関係の深い記事から最大3つ選ぶ
  const candidates = matches
    .filter((m) => m.article.category === category || m === matches[0])
    .slice(0, 2)
    .flatMap((m) => sentences(m.article.body).map((s) => ({ s, id: m.article.id, score: similarity(s, text) })))
    .filter((c) => !STAFF_ONLY.test(c.s));
  const picked = escalation.needed ? [] : [...candidates].sort((a, b) => b.score - a.score).slice(0, 3);
  // 記事の順番どおりに並べ直すと、読みやすい文章になる
  picked.sort((a, b) => candidates.indexOf(a) - candidates.indexOf(b));

  const missingInfo = MISSING[category]
    .filter((m) => (!m.skipIf || !m.skipIf.test(text)) && (!m.onlyIf || m.onlyIf.test(text)))
    .map((m) => m.label);
  // 「〜ですか？」のような質問だけなら、お詫びは入れない
  const isQuestionOnly = sentiment === "calm" && /[?？]|ますか|ですか/.test(inquiry.body) && !/できない|届かない|消え|落ち|重い/.test(text);

  const lines = [
    `${inquiry.playerName} 様`,
    "",
    "ほしぞらテイルズ サポート窓口です。お問い合わせいただき、ありがとうございます。",
    ...(isQuestionOnly ? [] : [EMPATHY[sentiment]]),
    "",
  ];
  if (escalation.needed) {
    lines.push("いただいた内容は、担当部署で詳しく確認いたします。", "確認ができ次第、あらためてご連絡いたしますので、今しばらくお待ちください。");
  } else if (picked.length) {
    lines.push(...picked.map((p) => p.s));
  } else {
    lines.push("いただいた内容について、詳しく確認いたします。");
  }
  if (missingInfo.length) {
    lines.push("", "恐れ入りますが、確認のため次の情報をお知らせいただけますでしょうか。", ...missingInfo.map((m) => `・${m}`));
  }
  lines.push("", "引き続き、ほしぞらテイルズをよろしくお願いいたします。");

  const first = inquiry.body.split(/[。\n！？!?]/).find((s) => s.trim())?.trim() ?? inquiry.subject;
  return {
    category,
    urgency: detectUrgency(text, category, sentiment),
    sentiment,
    summary: `${CATEGORY_LABEL[category]}：${first.slice(0, 60)}`,
    reply: lines.join("\n"),
    citations: picked.map((p) => ({ articleId: p.id, quote: p.s })),
    missingInfo,
    escalation,
  };
}

/** マニュアルに載っていない質問を、話題ごとにまとめる */
const TOPICS: { label: string; pattern: RegExp }[] = [
  { label: "フレンド機能", pattern: /フレンド/ },
  { label: "プレイヤー名の変更", pattern: /名前|ニックネーム|名前の変更/ },
  { label: "退会・データ削除", pattern: /退会|削除|消したい/ },
  { label: "領収書の発行", pattern: /領収書|インボイス/ },
  { label: "コラボ・今後の予定", pattern: /コラボ|予定|いつ/ },
];

export function sampleGapInsight(gaps: Inquiry[]): GapInsight {
  const groups = new Map<string, Inquiry[]>();
  for (const q of gaps) {
    const t = TOPICS.find((x) => x.pattern.test(`${q.subject}${q.body}`))?.label ?? "その他";
    groups.set(t, [...(groups.get(t) ?? []), q]);
  }
  const ranked = [...groups.entries()].filter(([t]) => t !== "その他").sort((a, b) => b[1].length - a[1].length);
  const suggestions = ranked.slice(0, 3).map(([topic, qs]) => ({
    title: `「${topic}」の記事を追加`,
    why: `マニュアルに近い記事がない問い合わせが${qs.length}件ありました。例：「${qs[0].subject}」。記事があれば、担当者が毎回調べる手間と回答のばらつきを減らせます。`,
    evidenceInquiryIds: qs.slice(0, 5).map((q) => q.id),
  }));
  if (!suggestions.length && gaps[0]) {
    suggestions.push({
      title: "マニュアルにない質問を確認",
      why: "近い記事が見つからない問い合わせがありました。内容を確認し、必要なら記事を追加してください。",
      evidenceInquiryIds: [gaps[0].id],
    });
  }
  return {
    headline: suggestions.length ? `マニュアルにない質問が${gaps.length}件。まず${suggestions[0].title.replace("の記事を追加", "")}から` : "マニュアルで答えられない質問は見つかりませんでした",
    suggestions,
  };
}
