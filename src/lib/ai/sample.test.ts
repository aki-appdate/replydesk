import { describe, expect, it } from "vitest";
import { ARTICLES } from "../knowledge";
import { replyDraftSchema } from "../schemas";
import { createSeedData } from "../seed";
import { checkCitations, findRiskyPhrases } from "../text";
import type { Inquiry } from "../types";
import { detectCategory, detectEscalation, detectUrgency, sampleGapInsight, sampleReplyDraft } from "./sample";

function inquiry(subject: string, body: string, id = "q-1"): Inquiry {
  return {
    id,
    receivedAt: new Date(2026, 10, 11, 10).toISOString(),
    playerName: "そらまめ",
    playerId: "1234567890",
    device: "Pixel 9 / Android 16",
    subject,
    body,
    status: "new",
  };
}

describe("sampleReplyDraft", () => {
  const cases = [
    inquiry("星のかけらが反映されません", "昨日購入しましたが反映されていません。お金だけ引かれています。"),
    inquiry("機種変更", "来週機種変更します。どうすればいいですか？"),
    inquiry("返金してください", "間違えて買ったので返金してほしいです。"),
    inquiry("フレンド", "フレンドの上限を増やしたいです。"),
  ];

  it.each(cases)("AIと同じ形を返す：$subject", (q) => {
    expect(replyDraftSchema.safeParse(sampleReplyDraft(q, ARTICLES)).success).toBe(true);
  });

  it.each(cases)("引用はすべて記事に実在する：$subject", (q) => {
    const d = sampleReplyDraft(q, ARTICLES);
    expect(checkCitations(d.citations, ARTICLES).every((c) => c.valid)).toBe(true);
  });

  it.each(cases)("言ってはいけない表現を含まない：$subject", (q) => {
    expect(findRiskyPhrases(sampleReplyDraft(q, ARTICLES).reply)).toEqual([]);
  });

  it("返金の要望はSVに相談する", () => {
    const d = sampleReplyDraft(cases[2], ARTICLES);
    expect(d.escalation.needed).toBe(true);
    expect(d.citations).toEqual([]);
  });

  it("怒っているお客さまにはお詫びから入り、急ぎにする", () => {
    const d = sampleReplyDraft(inquiry("データが消えた！！", "機種変更したらデータが全部消えました！！ありえないです。"), ARTICLES);
    expect(d.sentiment).toBe("angry");
    expect(d.urgency).toBe("high");
    expect(d.reply).toContain("申し訳ございません");
  });

  it("質問だけのときはお詫びを入れない", () => {
    const d = sampleReplyDraft(inquiry("ログインボーナス", "ログインボーナスは何時に切り替わりますか？"), ARTICLES);
    expect(d.reply).not.toContain("申し訳");
  });
});

describe("sampleGapInsight", () => {
  it("同じ話題をまとめ、件数の多い順に提案する", () => {
    const gaps = [
      inquiry("名前を変えたい", "プレイヤー名を変更したい", "q-1"),
      inquiry("ニックネーム", "名前の変更はできますか", "q-2"),
      inquiry("退会", "退会したいです", "q-3"),
    ];
    const r = sampleGapInsight(gaps);
    expect(r.suggestions[0].title).toContain("プレイヤー名の変更");
    expect(r.suggestions[0].evidenceInquiryIds).toEqual(["q-1", "q-2"]);
  });
});

describe("SV相談が必要なものは急ぎ", () => {
  it("消費者センターの話は、分類にかかわらず急ぎ", () => {
    expect(detectUrgency("きちんと説明がなければ消費者センターに相談します", "bug", "calm")).toBe("high");
  });
});

describe("SV相談の判定（抜けと誤検知）", () => {
  it.each([
    "訴訟を考えています",
    "警察に相談します",
    "購入をキャンセルしたい",
    "高校生の子が親のカードで課金しました",
    "チャージバックします",
    "払ったお金を戻してほしい",
    "うちの子が課金しました",
    "孫が勝手に課金していました",
    "クレジットカードの不正利用です",
    "小学生の息子が、私のスマホで勝手に課金していました。",
    "返金してほしいです",
  ])("相談が必要：%s", (s) => {
    expect(detectEscalation(s).needed).toBe(true);
  });

  it.each(["息子と協力プレイしたいです", "子供の頃から好きなゲームです", "返金はいりません、ログインできません", "アプリが停止して落ちます", "データを戻してください"])(
    "相談は不要：%s",
    (s) => {
      expect(detectEscalation(s).needed).toBe(false);
    },
  );

  it("アプリが停止して落ちるのは、利用停止ではなく不具合", () => {
    expect(detectCategory("アプリが停止して落ちます", undefined)).toBe("bug");
  });

  it("ログインボーナスはイベント、ガチャの確率は課金", () => {
    expect(detectCategory("ログインボーナスは何時に切り替わりますか？", undefined)).toBe("event");
    expect(detectCategory("ガチャの確率がおかしいと思います", undefined)).toBe("payment");
  });
});

describe("デモデータと見本の返答は、言い回しの確認で止まらない", () => {
  const data = createSeedData(new Date(2026, 10, 11, 17, 0));
  it("送信済みの返信はすべて通る", () => {
    const sent = data.replies.filter((r) => r.kind === "sent");
    expect(sent.length).toBeGreaterThan(100);
    expect(sent.filter((r) => findRiskyPhrases(r.body).length > 0).map((r) => r.id)).toEqual([]);
  });
  it("どの問い合わせでも、見本の返答は通る", () => {
    const stopped = data.inquiries.filter((q) => findRiskyPhrases(sampleReplyDraft(q, ARTICLES).reply).length > 0);
    expect(stopped.map((q) => q.id)).toEqual([]);
  });
});
