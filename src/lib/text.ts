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
 *
 * 返金・補償は「約束の言い方」を並べて探すのではなく、逆に考える：
 * 返金・補償に触れた文は、話題の言葉から文末までを「、」「が」「ので」などで区切り、
 * 区切りのどれか1つでも言い切っていれば止める。区切りが言い切っていないと認めるのは、
 *   ・断り（いたしかねます・できません・対象外です）
 *   ・お客さまへのお願い（〜ください）
 *   ・先送り（確認いたします・検討いたします・ご案内します）
 *   ・お礼やお詫び、お客さまの依頼を受けたことの返事（「ご希望とのこと、承知しました」）
 * で終わる場合だけ。「承知いたしました」「対応しておきます」「返金しました」のような言い方は
 * どれも言い切りなので、言い方をいくら変えても止まる。
 * 「つきましては」「についてですが」のような前置きは、判定の前に外す。
 */
type RiskRule = {
  topic: RegExp;
  /**
   * "clauses"：話題の言葉から文末までの区切りを1つずつ見て、言い切りが1つでもあれば止める（返金・補償）。
   * "topic"：話題の言葉そのものが危ない言い方（「必ず直ります」など）。文の残りに打ち消しが無ければ止める。
   */
  mode: "clauses" | "topic";
  unless?: RegExp;
  reason: string;
  /** SVが判断したうえでなら書いてよいもの（返金・補償）。SVには「要確認」として出す */
  svMayDecide?: string;
};

export type RiskyPhrase = { match: string; reason: string; severity: "stop" | "caution" };

// 区切りの終わり（句読点・感嘆符・空白は無視する）
const END = String.raw`[、，,。．！!？?\s]*$`;
// 断り・分からないことを言う区切り（区切りのどこにあってもよい）
const REFUSAL =
  /いたしかね|致しかね|できかね|しかね|つきかね|わかりかね|かねます|でき(ない|ません)(?!.{0,4}(ということは|わけでは))|(いた|致)?しません|して(お|い)りません|(承|受け付け|行)って(お|い)りません|(お受け|お約束|お応え)でき(ません|ない|かね)|お受けして(お|い)りません|(?<!ない(という|わけ)(こと|では)?は?)ございません|対象外|難し|承れ(ません|ない)|(し)?てはいけ|てはなりません|とは限りません|限らない|かどうか|可否|有無/;
// お客さまにお願いする終わり方
const REQUEST_END = new RegExp(String.raw`(ください|くださいませ|くださいますよう.{0,10}|お願い(いた)?します|お願い申し上げます|いただけますでしょうか|いただけますか|いただけますと幸いです|いただければ(幸いです|と存じます)|と存じます|お待ちください)${END}`);
// 先送り・案内の終わり方（まだ何も決めていない）
const DEFER_END = new RegExp(
  String.raw`((確認|検討|調査|お調べ|判断)(を)?(いた|させていただ|し)?(します|きます|しました|きました)|(確認|検討|調査)(の上|のうえ|後|いたしまして|して|した上で|したうえで).{0,12}(ご連絡|ご案内|お知らせ|ご報告)(を)?(いた)?(します|させていただきます)|(改めて|追って|後ほど|のちほど).{0,8}(ご連絡|ご案内|お知らせ|ご報告)(を)?(いた)?(します|させていただきます)|(ご案内|ご説明)(を)?(いた)?(します|させていただきます))${END}`,
);
// お礼・お詫び（約束ではない）
const COURTESY_END = new RegExp(String.raw`(ありがとうございます|ありがとうございました|申し訳(ございません|ありません)|お詫び申し上げます|恐れ入ります(が)?|お手数(ですが|をおかけしますが))${END}`);
// お客さまの依頼を指す言葉と、それを受け取った返事（「返金をご希望とのこと、承知しました」）
const CUSTOMER_REQUEST = /希望|ご要望|ご依頼|お問い合わせ|お申し出|ご相談|お求め/;
const ACK_END = new RegExp(String.raw`(承知(いた)?しました|承りました|かしこまりました|拝見(いた)?しました)${END}`);
// ストアの窓口へ案内する区切り（「ストアではなく、当社で」は除く）
const STORE = /(各)?ストア|App ?Store|Google ?Play|Apple|Google|リクエスト(ページ|画面)/;
// 区切りが何かを言い切っているか（述語があるか）。「返金は、」のような話題だけの区切りは言い切っていない
const PREDICATE =
  /ます|ました|まし|です|でした|済|完了|承|受け?付け|いたし|(?<!関)する|した|(?<!関)して|しとき|しておき|ており|可能|られ|れる|お戻し|お返し|返却|払い?戻|お付け|配布|付与(?!状況|の有無|履歴|状態)|復元|お送り|お渡し|差し上げ|プレゼント|追加|補充|進め|実施|対応|とく|おく|やって|やる|やります|OK|ok|オーケー|了解/;

// 条件を言うだけの区切り（「返金を求められた場合は、」）
const CONDITION_END = new RegExp(String.raw`(場合(は|には|でも)?|際(は|には)?|とき(は|には)?|であれば|なら(ば)?)${END}`);
// 担当部署・SVへ引き継ぐ（判断はしていない）
const FORWARD = /(担当部署|専門の部署|SV|上長|責任者|担当者)(へ|に|で|まで)?.{0,8}(引き継|お伝え|共有|申し送|確認|相談|報告)/;
// ヘルプや規約に書いてあると伝える
const POINT_TO_DOC = /(記載|掲載|定めて)(して(お|い)ります|があります|されています|おります)/;

// 区切りの中にこれがあれば、通す言葉（確認・ご案内・ストア…）が一緒にあっても言い切りとみなす。
// 「担当部署に確認し実施しました」「返金済みの明細をご確認ください」のように、1つの区切りに両方入れた文を通さないため
const STRONG =
  /ない(という|わけ)(こと|では)?は?(ございません|ありません)|^■(まで|の(完了|反映|お手続き)まで|が(完了|反映)(する|される)まで)|手配(いた)?し|進め(ます|させていただ|てまいります)|反映(され|いた)(ます|る予定)|お振込|済|完了|実施|決定|(処理|対応|手続き|お手続き|お戻し|お返し|返却|払い戻し|キャンセル|取り消し|付与|追加|補充|配布|お送り|送付)(を)?(いた)?(し|させていただ)(ます|ました|ておき|とき)|(お戻し|お返し)(いた)?します|戻(ります|しました)/;
// 区切りが断りで終わっている（「返金処理はいたしかねます」）
const REFUSAL_END = new RegExp(String.raw`(かね(ます|ません)|でき(ません|ない)|(いた)?しません|して(お|い)りません|難しい(です)?|対象外です)${END}`);
// ストアの手順を説明しているだけ（「手続きが完了すると、ストアから通知が届きます」）
const STORE_DESCRIPTION = /(すると|した場合|されると|されたら|された場合)/;

function isCommitted(clause: string, afterRequest = false, nextDefers = false): boolean {
  if (!PREDICATE.test(clause) && !STRONG.test(clause)) return false;
  if (STRONG.test(clause) && !REFUSAL_END.test(clause) && !(STORE.test(clause) && STORE_DESCRIPTION.test(clause))) return true;
  if (CONDITION_END.test(clause) || FORWARD.test(clause) || POINT_TO_DOC.test(clause)) return false;
  if (/いただいて(お|い)ります|お時間を(いただ|頂)|お待たせ/.test(clause) && !STRONG.test(clause)) return false;
  if (nextDefers && ACK_END.test(clause)) return false;
  if (REFUSAL.test(clause)) return false;
  if (REQUEST_END.test(clause) || DEFER_END.test(clause) || COURTESY_END.test(clause)) return false;
  if (afterRequest && ACK_END.test(clause)) return false;
  if (CUSTOMER_REQUEST.test(clause) && (ACK_END.test(clause) || !/(いたし|し)ま(す|した)|ておき|ており/.test(clause.replace(CUSTOMER_REQUEST, "")))) return false;
  if (STORE.test(clause) && !/ではなく|でなく|当社|弊社|こちら(で|から)|いたし|ました/.test(clause)) return false;
  return true;
}

const RISKY: RiskRule[] = [
  {
    topic:
      /返金|へんきん|ヘンキン|払い?戻|還付|返還|(請求|課金|購入|決済|注文)(を|は)?(お)?(取り?消|キャンセル)|(代金|料金|金額|全額|差額|お金|ご?購入分|課金(した)?分|支払い?分|お支払い(いただいた)?分|引き落とされた分|請求された分).{0,8}(お戻し|お返し|返却|戻させ|返させ|戻し|返し|戻り)/g,
    mode: "clauses",
    reason: "返金は担当者が約束できません（SVに相談）",
    svMayDecide: "返金を約束する文です。SVとして判断した内容か確かめてから送ってください",
  },
  {
    topic:
      /補償|補填|お詫び(の品|の印|のしるし|の証|の気持ち|として|に)|(こちら|当方|弊社)で.{0,6}(付与|補填|復元|追加)|代わりに.{0,10}(かけら|アイテム)|(かけら|アイテム|石|チケット|消えた分|失った|なくなった|ガチャ分|特典).{0,12}(お送り|送り|お?届け|お渡し|渡し|差し上げ|プレゼント|付与|お付け|配布|復元|お戻し|お返し|戻し|返し|再送|追加|補充)/g,
    mode: "clauses",
    // 「イベント報酬は自動で配布」「運営で購入記録を調べて付与（マニュアルの文）」は約束ではない。
    // 担当者が「こちらで付与しておきました」と言うのは止める
    unless: /自動(で|的に)(配布|付与|反映|届)|ショップで|購入でき|(運営|担当部署)で.{0,12}(調べ|確認)/,
    reason: "補償・お詫びの品の約束は担当者だけで決められません",
    svMayDecide: "補償・お詫びの品を約束する文です。SVとして判断した内容か確かめてから送ってください",
  },
  {
    topic: /必ず(?!しも)[^、。]{0,10}(直り|直し|治り|戻り|戻し|戻せ|届き|届け|復旧|解決|反映|修正|改善|元に戻)[^、。]{0,6}(ます|ました)(?!か)/g,
    mode: "topic",
    unless: /とは限りません|限らない/,
    reason: "できるか分からないことを「必ず」と約束しています",
  },
  {
    topic:
      /(絶対(に)?|100%|間違いなく|まちがいなく|確実に|きっと)[^、。]{0,10}(大丈夫です|問題ありません|直り|治り|戻り|届き|復旧(し|いた|でき)|解決(し|いた|でき)|反映され|元に戻)(ます|ました)?(?!か)|すぐ(に)?(直り|治り|戻り|復旧(し|いた)|解決(し|いた))ます(?!か)/g,
    mode: "topic",
    unless: /とは限りません|限らない|かどうか|場合(が|も)あ|ことがあ/,
    reason: "断定しすぎの表現です",
  },
  {
    topic: /停止の?理由は|違反(の内容|行為)は.{0,10}(です|でした)|(不正|チート).{0,10}(が確認された|を使用された)ため/g,
    mode: "topic",
    unless: /お伝え(でき|して(お|い)りません|いたしかね|しかね)|お答え(でき|いたしかね|しかね)|開示(でき|して(お|い)りません|いたしかね)|いたしかね|できかね|でき(ません|ない)/,
    reason: "利用停止の理由はお伝えしない決まりです",
  },
  // 日本の電話番号の形（0から始まる10〜11桁、ハイフンあり・なし）。引き継ぎコードなどの数字は対象にしない
  {
    topic: /(?<![\d-])0\d{1,4}-\d{1,4}-\d{3,4}(?![\d-])|(?<![\d-])0\d{9,10}(?![\d-])/g,
    mode: "topic",
    reason: "電話番号のような情報が含まれています（個人情報を繰り返さない）",
  },
];

// 話題を出すだけの前置き。判定の前に「は」に置き換える
const PREFACE = /(につきましては|に関しましては|につきまして|に関しまして|についてですが|に関してですが|に関しては|に関して|の件ですが|の件につきましては|の件につきまして)/g;

/** 表記の揺れをならす：半角カナ・全角英数をそろえ、文の途中の空白と改行を詰める */
function normalizeForRisk(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/([^。！？!?\n])\n(?=\S)/g, "$1")
    .replace(/(?<=[^\x00-\x7F])[ 　]+|[ 　]+(?=[^\x00-\x7F])/g, "");
}

/** 話題の言葉から文末までを、区切り（「、」「が」「ので」など）に分ける */
function clausesAfter(sentence: string, from: number): string[] {
  return sentence
    .slice(from)
    .replace(PREFACE, "は")
    .split(/(?<=[、，,])|(?<=けれど|けど|ものの|ですが|ますが|でしたが|ましたが|ところ|ので|ため|から、)/)
    .filter(Boolean);
}

/** 次の文が先送り・引き継ぎ・断りか（「返金の件、承知いたしました。担当部署にて確認し、結果をご連絡いたします。」） */
function defers(sentence: string | undefined): boolean {
  if (!sentence || STRONG.test(sentence)) return false;
  return FORWARD.test(sentence) || DEFER_END.test(sentence) || REFUSAL.test(sentence) || /(確認|検討).{0,12}(ご連絡|ご案内|お知らせ)/.test(sentence);
}

function isHit(rule: RiskRule, sentence: string, at: number, length: number, next?: string): boolean {
  if (rule.mode === "topic") return !rule.unless?.test(sentence.slice(at));
  // 話題の言葉そのもの（「払い戻し」「お戻し」）を述語と取り違えないよう、印に置き換えてから見る
  const clauses = clausesAfter(`${sentence.slice(0, at)}■${sentence.slice(at + length)}`, at);
  // 補償の例外（「イベント報酬は自動で配布」「購入した分の付与」）は、話題の言葉の前にも出るので文全体で見る
  // ただし「補償」「お詫び」と書いた文は、例外の言葉があっても約束として見る
  if (rule.unless?.test(sentence) && !/補償|補填|お詫び|こちらで|手動で|ておき|ました/.test(sentence)) return false;
  // ストアの手順を説明しているだけの文（「ストアで返金された場合、かけらは回収されます」）
  if (STORE.test(sentence) && STORE_DESCRIPTION.test(sentence) && !/当社|弊社|こちら(で|から)|いたし/.test(sentence)) return false;
  // 前の区切りにお客さまの依頼（ご希望・ご要望）があれば、「承知しました」はそれを受けた返事
  const nextDefers = defers(next);
  return clauses.some((c, i) => isCommitted(c, clauses.slice(0, i).some((x) => CUSTOMER_REQUEST.test(x)), nextDefers));
}

export function findRiskyPhrases(text: string, opts: { isSv?: boolean } = {}): RiskyPhrase[] {
  const out: RiskyPhrase[] = [];
  const parts = normalizeForRisk(text)
    .split(/(?<=[。！？!?\n])/)
    .map((x) => x.trim())
    .filter(Boolean);
  for (const r of RISKY) {
    // 当たった文はすべて出す（1件直すたびに次が出てくる、を避ける）
    const hits = new Set<number>();
    parts.forEach((sen, i) => {
      const matches = [...sen.matchAll(r.topic)];
      if (!matches.length) return;
      if (matches.some((m) => isHit(r, sen, m.index, m[0].length, parts[i + 1]))) hits.add(i);
      // 返金・補償に触れた文のあとの2文も見る（「返金の件、承知しました。本日中に手続きいたします。」）。
      // 主語が省かれた文は話題の言葉を含まないので、強い約束の言い方（手続きいたします・完了しました…）だけで判定する
      if (r.mode === "clauses") {
        for (const j of [i + 1, i + 2]) {
          const next = parts[j];
          // 後ろの文が返金・補償の言葉を含むなら、その文自身の判定に任せる（同じ文を2回出さない）
          const ownTopic = next && RISKY.some((x) => x.mode === "clauses" && new RegExp(x.topic.source).test(next));
          if (next && !ownTopic && STRONG.test(next) && !REFUSAL_END.test(next.replace(/[。！!？?]+$/, "")) && !(STORE.test(next) && STORE_DESCRIPTION.test(next)) && !(r.unless?.test(next))) hits.add(j);
        }
      }
    });
    for (const i of [...hits].sort((a, b) => a - b)) {
      const sen = parts[i];
      const match = sen.length > 40 ? `${sen.slice(0, 40)}…` : sen;
      if (opts.isSv && r.svMayDecide) out.push({ match, reason: r.svMayDecide, severity: "caution" });
      else out.push({ match, reason: r.reason, severity: "stop" });
    }
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
