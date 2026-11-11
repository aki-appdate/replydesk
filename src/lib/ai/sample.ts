// 「見本の返答」。AIが使えないとき（未設定・無料枠の上限・通信エラー）に使う、ルールベースの返信案。
// 引用は記事本文の文をそのまま使うので、根拠チェックを必ず通る。AIと同じ形（ReplyDraft）を返す。

import { CATEGORY_LABEL } from "../labels";
import { searchArticles, sentences, similarity } from "../text";
import type { Article, Category, GapInsight, Inquiry, ReplyDraft, Sentiment, Urgency } from "../types";

const CATEGORY_RULES: { category: Category; pattern: RegExp }[] = [
  { category: "ban", pattern: /(アカウント|利用|垢).{0,6}停止|停止(され|処分)|BAN|ＢＡＮ|凍結|垢バン/i },
  // 「ログイン」を含むがイベントの話
  { category: "event", pattern: /ログインボーナス|ログボ/ },
  // ガチャの確率など、お金に関わる苦情
  { category: "payment", pattern: /確率|ガチャ.{0,10}(おかしい|詐欺)/ },
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

// 文・節に分ける（「返金はいりません、ログインできません」の打ち消しを、後ろの節に広げないため）
const splitSentences = (text: string) => text.split(/[。！？!?\n]/).filter((x) => x.trim());
const splitClauses = (text: string) => text.split(/[。！？!?\n、，,]|けど|ですが|ますが/).filter((x) => x.trim());

// お金の話（未成年の判定で、「息子と協力プレイ」「子供の頃から好き」を外すため）
const MONEY = /課金|購入|買|決済|請求|カード|かけら|円|お金|支払|ガチャ/;
const MINOR = /子ども|子供|息子|娘|うちの子|孫|小学生|中学生|高校生|甥|姪/;
// 返金を求めていない言い方
const NO_REFUND = /いりません|いらない|不要|わけでは(ない|ありません|なく)|はいいので|はいいです|は大丈夫|結構です|求めて(い)?ません|望んで(い)?ません|しなくて(大丈夫|いい)/;

const ESCALATION_RULES: { test: (text: string) => boolean; reason: string }[] = [
  {
    test: (t) => /未成年|親の(カード|クレジット)/.test(t) || splitSentences(t).some((s) => MINOR.test(s) && MONEY.test(s)),
    reason: "未成年の課金の可能性があるため",
  },
  {
    test: (t) =>
      /不正(利用|請求|使用|ログイン|アクセス)|身に覚えのない(課金|請求|購入|決済|ログイン)|(勝手に|無断で).{0,4}(課金|購入|決済|使われ|使用され|ログイン)|(カード|クレジット).{0,8}(勝手に|無断で)|乗っ取/.test(t),
    reason: "身に覚えのない課金・不正利用の可能性があるため",
  },
  {
    test: (t) =>
      splitClauses(t).some(
        (c) =>
          /返金|払い?戻|金返せ|(お金|代金|料金|課金(した)?分|購入分|かけら代).{0,6}(返して|戻して)|(購入|課金|決済).{0,10}(キャンセル|取り消)|(キャンセル|取り消).{0,10}(購入|課金|決済)|チャージバック/.test(c) &&
          !NO_REFUND.test(c),
      ),
    reason: "返金の判断は担当者ではできないため",
  },
  { test: (t) => /(補償|補填|埋め合わせ).{0,8}(ほしい|して|ください|求め|お願い|すべき)/.test(t), reason: "補償の判断は担当者ではできないため" },
  { test: (t) => /消費者センター|弁護士|訴え|訴訟|法的|警察/.test(t), reason: "法的な対応が必要になる可能性があるため" },
  { test: (t) => /(アカウント|利用|垢).{0,6}停止|停止(され|処分)|BAN|ＢＡＮ|凍結/i.test(t), reason: "利用停止の判断は担当者ではできないため" },
];

export function detectEscalation(text: string): ReplyDraft["escalation"] {
  for (const r of ESCALATION_RULES) if (r.test(text)) return { needed: true, reason: r.reason };
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
const TOPICS: { label: string; pattern: RegExp; benefit: string }[] = [
  { label: "フレンド機能", pattern: /フレンド/, benefit: "申請の届き方・上限・解除など、フレンドの仕様を1つの記事にまとめておけば、担当者がその都度開発チームに確認する手間がなくなります" },
  { label: "プレイヤー名の変更", pattern: /名前|ニックネーム|名前の変更/, benefit: "変更できるか・何回までかを担当者ごとに違う答え方をしている恐れがあります。回数や条件を決めて記事にすると答えがそろいます" },
  { label: "退会・データ削除", pattern: /退会|削除|消したい/, benefit: "データを消すと元に戻せないため、手順と注意点をはっきり書いた記事が必要です。誤って案内すると取り返しがつきません" },
  { label: "領収書の発行", pattern: /領収書|インボイス/, benefit: "購入はストア経由のため、ストアの購入履歴の出し方を案内する記事があれば、担当者がすぐ答えられます" },
  { label: "コラボ・今後の予定", pattern: /コラボ|予定|いつ/, benefit: "未発表の予定は答えられないため、「お知らせをお待ちください」という決まった答え方を記事にしておくと迷いません" },
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
    why: `マニュアルに近い記事がない問い合わせが${qs.length}件ありました（例：${[...new Set(qs.map((q) => `「${q.subject}」`))].slice(0, 2).join("、")}）。${TOPICS.find((x) => x.label === topic)?.benefit ?? ""}。`,
    // 根拠は同じ文面を1つにまとめ、違う言い方の問い合わせを見せる
    evidenceInquiryIds: [...new Map(qs.map((q) => [q.body, q.id])).values()].slice(0, 5),
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
