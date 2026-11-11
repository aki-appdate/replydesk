// デモ用のデータ。ゲーム名・プレイヤー名・IDなどはすべて架空。
// 乱数の種を固定しているので、誰が開いても同じ傾向のデータになる（日付だけは「今日」基準でずらす）。

import { sampleReplyDraft } from "./ai/sample";
import { addDays, startOfDay } from "./dates";
import { ARTICLES } from "./knowledge";
import { checkCitations, searchArticles } from "./text";
import type { Article, Inquiry, Reply, Staff } from "./types";

export const STAFF: Staff[] = [
  { id: "sv-1", name: "村上 由美", role: "sv" },
  { id: "a-1", name: "小川 さくら", role: "agent" },
  { id: "a-2", name: "森 拓也", role: "agent" },
  { id: "a-3", name: "石井 直人", role: "agent" },
];

/** 問い合わせのひな形。gap=true はマニュアルに答えがない質問（SV画面の「マニュアルの穴」に出る） */
const TEMPLATES: { subject: string; body: string; gap?: boolean }[] = [
  { subject: "星のかけらが反映されません", body: "昨日の夜に星のかけらを3000個購入しましたが、ゲームに反映されていません。お金だけ引かれています。どうなっているんですか。" },
  { subject: "課金したのに届かない", body: "さっき星のかけらを買ったのに増えていません。もう一回買ったほうがいいですか？" },
  { subject: "返金してください", body: "間違えて高いパックを買ってしまいました。まだ使っていないので返金してほしいです。" },
  { subject: "子どもが勝手に課金しました", body: "小学生の息子が私のスマホで勝手に課金していました。2万円ほどです。どうすればいいでしょうか。" },
  { subject: "ログインできません", body: "今朝からログインできません。エラー番号 E-1042 と表示されます。アプリは最新です。" },
  { subject: "タイトル画面から進まない", body: "タイトル画面でタップしても進みません。何かのメンテナンスでしょうか。" },
  { subject: "機種変更のやり方を教えてください", body: "来週iPhoneからPixelに機種変更します。データを引き継ぐにはどうすればいいですか？星のかけらも引き継げますか？" },
  { subject: "引き継ぎコードをメモしていなかった", body: "スマホが壊れて新しい機種にしましたが、引き継ぎコードを控えていませんでした。3年遊んでいたデータです。なんとかなりませんか。" },
  { subject: "データが消えた！！", body: "機種変更したらデータが全部消えました！！3年分のデータです。ありえないです。すぐに戻してください。" },
  { subject: "ガチャの途中で落ちる", body: "ガチャを引くとアプリが落ちます。Galaxyを使っていてAndroid 16です。かけらが消えていないか心配です。" },
  { subject: "動作が重いです", body: "最近バトル中に動作がとても重く、たまに固まります。iPhone 13です。" },
  { subject: "イベント報酬が届かない", body: "秋の星まつりのランキング報酬がまだ届いていません。いつ届きますか？" },
  { subject: "プレゼントの報酬が消えた", body: "プレゼントボックスに入れておいた報酬がなくなっていました。先月のイベントのものです。" },
  { subject: "ログインボーナスの時間", body: "ログインボーナスは何時に切り替わりますか？" },
  { subject: "アカウントが停止されました", body: "急にアカウントが停止されました。何も悪いことはしていません。理由を教えてください。すぐに解除してください。" },
  { subject: "交換所はいつまで？", body: "星まつりの交換所はイベントが終わったら使えなくなりますか？" },
  { subject: "フレンドの上限を増やしたい", body: "フレンドが上限の50人になってしまいました。上限を増やす方法はありますか？", gap: true },
  { subject: "フレンド申請が届かない", body: "友達にフレンド申請を送ってもらったのですが、こちらに表示されません。", gap: true },
  { subject: "名前を変えたい", body: "プレイヤー名を変更したいです。どこから変えられますか？何回でも変えられますか？", gap: true },
  { subject: "ニックネームの変更", body: "間違えた名前で登録してしまいました。名前の変更はできますか？", gap: true },
  { subject: "退会したい", body: "ゲームをやめるので、アカウントとデータを削除したいです。退会の方法を教えてください。", gap: true },
  { subject: "データを消したい", body: "最初からやり直したいので、今のデータを消したいです。", gap: true },
  { subject: "領収書がほしい", body: "仕事の経費にしたいので、領収書を発行してもらえますか。", gap: true },
  { subject: "コラボの予定について", body: "前にやっていたコラボイベントはまた開催されますか？いつ頃の予定ですか？", gap: true },
  { subject: "消費者センターに相談します", body: "ガチャの確率がおかしいと思います。きちんと説明がなければ消費者センターに相談します。" },
  { subject: "プレイヤーIDが分からない", body: "問い合わせにプレイヤーIDが必要と書いてありますが、どこで見られますか？" },
];

const NAMES = ["そらまめ", "ミカン星人", "くろねこ", "ほしの", "たいやき", "ルナ", "はるかぜ", "コテツ", "ゆずぽん", "ナナ", "だいふく", "あおい", "リク", "もちもち", "シロ", "ひなた"];
const DEVICES = ["iPhone 15 / iOS 19", "iPhone 13 / iOS 18", "Pixel 9 / Android 16", "Galaxy S24 / Android 16", "AQUOS sense / Android 15", "Xperia 10 / Android 15"];

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 担当者が返信案を直すときの、よくある手直し */
const EDITS: ((s: string) => string)[] = [
  (s) => s,
  (s) => s,
  (s) => s.replace("ありがとうございます。", "ありがとうございます。\nご連絡が遅くなり申し訳ございません。"),
  (s) => s.replace("引き続き、ほしぞらテイルズをよろしくお願いいたします。", "ご不明な点があれば、お気軽にお問い合わせください。\n引き続き、ほしぞらテイルズをよろしくお願いいたします。"),
  (s) => s.split("\n").filter((l) => !l.startsWith("・")).join("\n"),
  // 説明部分を自分の言葉で短く言い直す（AI案から大きく変わるケース）
  (s) => {
    const lines = s.split("\n");
    const head = lines.slice(0, 3);
    const tail = lines.slice(-1);
    return [...head, "", "お問い合わせの件、こちらで状況を確認しました。", "お手数ですが、下記の点をあらためてお試しいただけますでしょうか。", "解決しない場合は、このメールにそのままご返信ください。", "", ...tail].join("\n");
  },
  (s) => s.replace(/お困りのことと存じます。分かる範囲でご案内いたします。\n?/, "").replace("ありがとうございます。", "ありがとうございます。担当の者がご案内いたします。"),
];

export type SeedData = { staff: Staff[]; articles: Article[]; inquiries: Inquiry[]; replies: Reply[] };

export function createSeedData(now: Date = new Date()): SeedData {
  const rand = mulberry32(20261112);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const agents = STAFF.filter((s) => s.role === "agent");

  const inquiries: Inquiry[] = [];
  const replies: Reply[] = [];
  const today = startOfDay(now);
  // 5〜6人のチームで1日10〜15件ほど届く想定。直近2週間ぶん
  const TOTAL = 168;

  for (let i = 0; i < TOTAL; i++) {
    // 古いものから順に、直近14日間へ散らす。最後の12件は今日〜昨日の未対応
    const unanswered = i >= TOTAL - 12;
    const dayOffset = unanswered ? -Math.floor(rand() * 2) : -(14 - Math.floor((i / (TOTAL - 12)) * 13));
    const received = addDays(today, dayOffset);
    received.setHours(8 + Math.floor(rand() * 14), Math.floor(rand() * 60), 0, 0);
    if (received > now) received.setTime(now.getTime() - (i + 1) * 7 * 60 * 1000);

    const t = TEMPLATES[(i * 7 + 3) % TEMPLATES.length];
    const inquiry: Inquiry = {
      id: `q-${String(i + 1).padStart(3, "0")}`,
      receivedAt: received.toISOString(),
      playerName: pick(NAMES),
      playerId: String(1000000000 + Math.floor(rand() * 8999999999)),
      device: pick(DEVICES),
      subject: t.subject,
      body: t.body,
      status: "new",
    };
    inquiries.push(inquiry);
    if (unanswered) continue;

    const draft = sampleReplyDraft(inquiry, ARTICLES);
    const at = new Date(received.getTime() + (30 + Math.floor(rand() * 600)) * 60 * 1000);
    if (at > now) continue;
    const escalated = draft.escalation.needed;
    // 慣れた担当者は、短い質問ならAIを使わずに自分で書くこともある
    const selfWritten = !escalated && rand() < 0.15;
    const body = escalated ? draft.reply : pick(EDITS)(draft.reply);
    inquiry.status = escalated ? "escalated" : "sent";
    replies.push({
      id: `r-${String(i + 1).padStart(3, "0")}`,
      inquiryId: inquiry.id,
      staffId: pick(agents).id,
      at: at.toISOString(),
      kind: escalated ? "escalated" : "sent",
      body,
      aiDraft: selfWritten ? null : draft.reply,
      aiSource: selfWritten ? null : "sample",
      category: draft.category,
      citedArticleIds: checkCitations(draft.citations, ARTICLES).filter((c) => c.valid).map((c) => c.articleId),
      noArticleMatched: searchArticles(`${inquiry.subject}\n${inquiry.body}`, ARTICLES).length === 0,
    });
  }

  return { staff: STAFF, articles: ARTICLES, inquiries, replies };
}
