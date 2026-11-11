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

/**
 * 問い合わせのひな形。gap=true はマニュアルに答えがない質問（SV画面の「マニュアルの穴」に出る）。
 * weight は届きやすさ（実際の窓口と同じく、課金・引き継ぎ・ログインが多く、退会や領収書は少ない）。
 * bodies は同じ用件の言い方の違い。同じ文面が何度も並ばないようにする。
 */
type Template = { subject: string[]; bodies: string[]; weight: number; gap?: boolean };
const TEMPLATES: Template[] = [
  { weight: 9, subject: ["星のかけらが反映されません", "課金したのに届かない", "購入したかけらが増えていない"], bodies: [
    "昨日の夜に星のかけらを3000個購入しましたが、ゲームに反映されていません。お金だけ引かれています。どうなっているんですか。",
    "さっき星のかけらを買ったのに増えていません。もう一回買ったほうがいいですか？",
    "今朝、星のかけら1200個のパックを購入しました。ストアからは購入完了のメールが来ていますが、ゲーム内の数が変わっていません。",
    "地下鉄の中で星のかけらを買ったら、反映されていないみたいです。通信が切れたせいでしょうか。",
  ] },
  { weight: 3, subject: ["返金してください", "間違えて購入しました"], bodies: [
    "間違えて高いパックを買ってしまいました。まだ使っていないので返金してほしいです。",
    "同じパックを2回続けて買ってしまいました。1回分を返金してもらえませんか。",
  ] },
  { weight: 2, subject: ["子どもが勝手に課金しました", "家族が無断で課金していました"], bodies: [
    "小学生の息子が私のスマホで勝手に課金していました。2万円ほどです。どうすればいいでしょうか。",
    "中学生の娘が私のカードで星のかけらを購入していたことが分かりました。合計で4万円ほどです。",
  ] },
  { weight: 7, subject: ["ログインできません", "エラーでゲームに入れない"], bodies: [
    "今朝からログインできません。エラー番号 E-1042 と表示されます。アプリは最新です。",
    "ログインしようとすると「通信エラー」と出て先に進めません。Wi-Fiでもモバイル通信でも同じです。",
    "昨日の夜からゲームに入れません。エラー番号 E-2001 が出ます。",
  ] },
  { weight: 3, subject: ["タイトル画面から進まない"], bodies: [
    "タイトル画面でタップしても進みません。何かのメンテナンスでしょうか。",
    "起動はするのですが、タイトル画面のまま固まってしまいます。",
  ] },
  { weight: 6, subject: ["機種変更のやり方を教えてください", "新しいスマホへの引き継ぎ"], bodies: [
    "来週iPhoneからPixelに機種変更します。データを引き継ぐにはどうすればいいですか？星のかけらも引き継げますか？",
    "スマホを買い替える予定です。今のデータを新しいスマホに移す手順を教えてください。",
    "AndroidからiPhoneに替えても、データはそのまま使えますか？",
  ] },
  { weight: 3, subject: ["引き継ぎコードをメモしていなかった", "スマホをなくしてしまいました"], bodies: [
    "スマホが壊れて新しい機種にしましたが、引き継ぎコードを控えていませんでした。3年遊んでいたデータです。なんとかなりませんか。",
    "スマホを落としてなくしてしまいました。引き継ぎの設定はしていません。データは戻せますか。",
  ] },
  { weight: 2, subject: ["データが消えた！！"], bodies: [
    "機種変更したらデータが全部消えました！！3年分のデータです。ありえないです。すぐに戻してください。",
  ] },
  { weight: 4, subject: ["ガチャの途中で落ちる", "アプリが落ちます"], bodies: [
    "ガチャを引くとアプリが落ちます。Galaxyを使っていてAndroid 16です。かけらが消えていないか心配です。",
    "ストーリーを進めている途中で、毎回同じ場面でアプリが落ちます。",
  ] },
  { weight: 4, subject: ["動作が重いです", "バトル中に固まる"], bodies: [
    "最近バトル中に動作がとても重く、たまに固まります。iPhone 13です。",
    "アップデートしてから、バトルの演出で数秒止まるようになりました。",
  ] },
  { weight: 6, subject: ["イベント報酬が届かない", "ランキング報酬について"], bodies: [
    "秋の星まつりのランキング報酬がまだ届いていません。いつ届きますか？",
    "星まつりで300位以内に入ったのですが、報酬が見当たりません。",
    "イベントのミッション報酬を受け取ったはずなのに、アイテムが増えていません。",
  ] },
  { weight: 2, subject: ["プレゼントの報酬が消えた"], bodies: [
    "プレゼントボックスに入れておいた報酬がなくなっていました。先月のイベントのものです。",
  ] },
  { weight: 3, subject: ["ログインボーナスの時間", "交換所はいつまで？"], bodies: [
    "ログインボーナスは何時に切り替わりますか？",
    "星まつりの交換所はイベントが終わったら使えなくなりますか？",
  ] },
  { weight: 2, subject: ["アカウントが停止されました"], bodies: [
    "急にアカウントが停止されました。何も悪いことはしていません。理由を教えてください。すぐに解除してください。",
    "ログインしたら「利用停止」と表示されました。心当たりがありません。",
  ] },
  { weight: 2, subject: ["プレイヤーIDが分からない"], bodies: [
    "問い合わせにプレイヤーIDが必要と書いてありますが、どこで見られますか？",
  ] },
  { weight: 1, subject: ["消費者センターに相談します"], bodies: [
    "ガチャの確率がおかしいと思います。きちんと説明がなければ消費者センターに相談します。",
  ] },
  // ここから下はマニュアルにない質問。話題ごとに届きやすさを変えている
  { weight: 4, gap: true, subject: ["フレンド申請が届かない", "フレンドの上限を増やしたい", "フレンドを解除したい"], bodies: [
    "友達にフレンド申請を送ってもらったのですが、こちらに表示されません。",
    "フレンドが上限の50人になってしまいました。上限を増やす方法はありますか？",
    "フレンドを一人解除したいのですが、やり方が分かりません。",
  ] },
  { weight: 2.5, gap: true, subject: ["名前を変えたい", "ニックネームの変更"], bodies: [
    "プレイヤー名を変更したいです。どこから変えられますか？何回でも変えられますか？",
    "間違えた名前で登録してしまいました。名前の変更はできますか？",
  ] },
  { weight: 1.5, gap: true, subject: ["退会したい", "データを消したい"], bodies: [
    "ゲームをやめるので、アカウントとデータを削除したいです。退会の方法を教えてください。",
    "最初からやり直したいので、今のデータを消したいです。",
  ] },
  { weight: 1, gap: true, subject: ["領収書がほしい"], bodies: [
    "仕事の経費にしたいので、領収書を発行してもらえますか。",
  ] },
  { weight: 0.6, gap: true, subject: ["コラボの予定について"], bodies: [
    "前にやっていたコラボイベントはまた開催されますか？いつ頃の予定ですか？",
  ] },
];

/** SVの判断待ちとして残しておく相談（返金・未成年・利用停止） */
const PENDING_SV: [number, number][] = [
  [1, 1], [2, 1], [13, 1],
];

/** 同じ用件でも、数字や書き出しが人によって違うようにする */
function vary(body: string, rand: () => number): string {
  const amounts = ["500", "1200", "3000", "6000"];
  const yen = ["5000", "1万", "2万", "3万"];
  const openers = ["", "", "", "お世話になっております。", "すみません、", "初めて問い合わせます。"];
  return (
    openers[Math.floor(rand() * openers.length)] +
    body.replace(/\d+個/, () => `${amounts[Math.floor(rand() * amounts.length)]}個`).replace(/\d+万?円ほど/, () => `${yen[Math.floor(rand() * yen.length)]}円ほど`)
  );
}

/** 未対応として残しておく問い合わせ（デモで見せたいものを必ず含める）。置く時刻は createSeedData で now から逆算する */
const OPEN_SHOWCASE: [number, number][] = [
  [0, 0], [13, 0], [2, 0], [1, 0], [0, 1], [7, 0], [16, 0], [15, 0], [17, 1], [5, 0], [12, 0], [9, 1],
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

  const totalWeight = TEMPLATES.reduce((a, t) => a + t.weight, 0);
  const pickTemplate = (): number => {
    let r = rand() * totalWeight;
    for (let k = 0; k < TEMPLATES.length; k++) {
      r -= TEMPLATES[k].weight;
      if (r <= 0) return k;
    }
    return TEMPLATES.length - 1;
  };
  // 返信は営業時間（9〜21時）にする。時間外に届いたものは翌朝に対応する
  const workingHours = (d: Date): Date => {
    const x = new Date(d);
    if (x.getHours() >= 21) {
      x.setDate(x.getDate() + 1);
      x.setHours(9, Math.floor(rand() * 50), 0, 0);
    } else if (x.getHours() < 9) {
      x.setHours(9, Math.floor(rand() * 50), 0, 0);
    }
    return x;
  };
  const sv = STAFF.find((s) => s.role === "sv")!;
  const OPEN = OPEN_SHOWCASE.length;
  const TODAY_DONE = 4;

  const minutesAgo = (min: number) => new Date(now.getTime() - Math.round(min) * 60 * 1000);

  for (let i = 0; i < TOTAL; i++) {
    const unanswered = i >= TOTAL - OPEN;
    // 未対応の直前の3件は、担当者がSVに相談して判断待ちになっているもの（SV画面で見せるため）
    const pendingSv = !unanswered && i >= TOTAL - OPEN - PENDING_SV.length;
    // その前の4件は、今日届いて今日のうちに返信したもの（SV画面の「今日」が空にならないように）
    const doneToday = !unanswered && !pendingSv && i >= TOTAL - OPEN - PENDING_SV.length - TODAY_DONE;

    let received: Date;
    if (unanswered) {
      // 最後の12件は未対応。どれも now より前に置く（今日の0時直後に開いても未来の時刻にならない）。
      // 最初の2件は24時間以上たったもの（受信箱の「24時間以上」に出る）、残りはここ数時間に届いたもの
      const k = i - (TOTAL - OPEN);
      received = k < 2 ? minutesAgo((28 - k * 2.5) * 60 + rand() * 40) : minutesAgo((OPEN - k) * (25 + rand() * 15));
    } else if (doneToday) {
      const k = i - (TOTAL - OPEN - PENDING_SV.length - TODAY_DONE);
      received = minutesAgo((9 - k * 1.5) * 60 + rand() * 30);
    } else {
      // 古いものから順に、直近14日〜2日前へ散らす
      received = addDays(today, -(14 - Math.floor((i / (TOTAL - OPEN)) * 13)));
      received.setHours(8 + Math.floor(rand() * 14), Math.floor(rand() * 60), 0, 0);
    }
    received.setSeconds(0, 0);
    const [ti, vi] = unanswered ? OPEN_SHOWCASE[i - (TOTAL - OPEN)] : pendingSv ? PENDING_SV[i - (TOTAL - OPEN - PENDING_SV.length)] : [pickTemplate(), -1];
    const t = TEMPLATES[ti];
    const bi = vi >= 0 ? vi % t.bodies.length : Math.floor(rand() * t.bodies.length);
    const inquiry: Inquiry = {
      id: `q-${String(i + 1).padStart(3, "0")}`,
      receivedAt: received.toISOString(),
      playerName: pick(NAMES),
      playerId: String(1000000000 + Math.floor(rand() * 8999999999)),
      device: pick(DEVICES),
      subject: t.subject[Math.min(bi, t.subject.length - 1)],
      body: vi >= 0 ? t.bodies[bi] : vary(t.bodies[bi], rand),
      status: "new",
    };
    inquiries.push(inquiry);
    if (unanswered) continue;

    const draft = sampleReplyDraft(inquiry, ARTICLES);
    const at = workingHours(new Date(received.getTime() + (doneToday ? 15 + Math.floor(rand() * 60) : 30 + Math.floor(rand() * 600)) * 60 * 1000));
    if (at > now) continue;
    const escalated = draft.escalation.needed;
    // 慣れた担当者は、短い質問ならAIを使わずに自分で書くこともある
    const selfWritten = !escalated && rand() < 0.15;
    const body = escalated ? draft.reply : pick(EDITS)(draft.reply);
    inquiry.status = escalated ? "escalated" : "sent";
    const cited = checkCitations(draft.citations, ARTICLES).filter((c) => c.valid).map((c) => c.articleId);
    const noArticleMatched = searchArticles(`${inquiry.subject}\n${inquiry.body}`, ARTICLES).length === 0;
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
      citedArticleIds: cited,
      noArticleMatched,
    });

    // SVへの相談は、1〜2営業日のうちにSVが判断して返信する（たまりっぱなしにしない）。
    // ここ3日の相談は、まだSVの判断待ちとして残す
    if (escalated && !pendingSv) {
      const svAt = workingHours(new Date(at.getTime() + (20 + Math.floor(rand() * 28)) * 3600 * 1000));
      if (svAt <= now) {
        inquiry.status = "sent";
        replies.push({
          id: `r-${String(i + 1).padStart(3, "0")}-sv`,
          inquiryId: inquiry.id,
          staffId: sv.id,
          at: svAt.toISOString(),
          kind: "sent",
          body: `${inquiry.playerName} 様\n\nほしぞらテイルズ サポート窓口の村上です。お待たせいたしました。\nいただいた内容について、担当部署と確認した結果をご案内いたします。\n\n（SVが状況を確認したうえで、個別にご案内した内容です）\n\n引き続き、ほしぞらテイルズをよろしくお願いいたします。`,
          aiDraft: null,
          aiSource: null,
          category: draft.category,
          citedArticleIds: [],
          noArticleMatched,
        });
      }
    }
  }

  return { staff: STAFF, articles: ARTICLES, inquiries, replies };
}
