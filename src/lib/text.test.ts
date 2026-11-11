import { describe, expect, it } from "vitest";
import { ARTICLES } from "./knowledge";
import { checkCitations, findRiskyPhrases, searchArticles, similarity } from "./text";

describe("searchArticles", () => {
  it.each([
    ["星のかけらを買ったのに反映されない", "kb-01"],
    ["機種変更したいです", "kb-06"],
    ["引き継ぎコードをメモしていませんでした", "kb-07"],
    ["ガチャを引くとアプリが落ちます", "kb-09"],
    ["アカウントが停止されました", "kb-12"],
  ])("「%s」→ %s が一番上", (q, id) => {
    expect(searchArticles(q, ARTICLES)[0]?.article.id).toBe(id);
  });

  it("マニュアルにない質問では何も返さない", () => {
    expect(searchArticles("フレンドの上限を増やしたい", ARTICLES)).toEqual([]);
  });

  it("基本ルールの記事（キーワードなし）は検索に出ない", () => {
    expect(searchArticles("返信の基本ルール", ARTICLES).map((r) => r.article.id)).not.toContain("kb-13");
  });
});

describe("checkCitations", () => {
  it("本文にある文は有効、言い換えは無効", () => {
    const r = checkCitations(
      [
        { articleId: "kb-06", quote: "引き継ぎコードの有効期限は発行から30日です。" },
        { articleId: "kb-06", quote: "引き継ぎコードは60日間使えます。" },
        { articleId: "kb-99", quote: "存在しない記事" },
      ],
      ARTICLES,
    );
    expect(r.map((c) => c.valid)).toEqual([true, false, false]);
  });

  it("空白や句読点のゆれは許す", () => {
    const r = checkCitations([{ articleId: "kb-10", quote: "ランキング報酬は イベント終了後72時間以内に配布されます" }], ARTICLES);
    expect(r[0].valid).toBe(true);
  });

  it("短すぎる引用は根拠として認めない", () => {
    expect(checkCitations([{ articleId: "kb-10", quote: "報酬" }], ARTICLES)[0].valid).toBe(false);
  });
});

describe("findRiskyPhrases", () => {
  it("返金の約束を見つける", () => {
    expect(findRiskyPhrases("確認のうえ返金いたします。")[0]?.reason).toContain("返金");
  });
  it("「必ず復旧」を見つける", () => {
    expect(findRiskyPhrases("データは必ず復旧できます。")).toHaveLength(1);
  });
  it("問題のない文では何も出さない", () => {
    expect(findRiskyPhrases("担当部署で確認いたします。")).toEqual([]);
  });
});

describe("similarity", () => {
  it("同じ文は1、まったく違う文は0に近い", () => {
    expect(similarity("ありがとうございます", "ありがとうございます")).toBe(1);
    expect(similarity("ありがとうございます", "機種変更の手順")).toBeLessThan(0.1);
  });
});

describe("返金を約束する言い回し（言い換え）", () => {
  it.each(["確認のうえ全額お戻しいたします", "今回は返金に応じます", "代金をお返しします"])("%s を止める", async (s) => {
    const { findRiskyPhrases } = await import("./text");
    expect(findRiskyPhrases(s).length).toBeGreaterThan(0);
  });
});

describe("危ない言い回しは言い方を変えても止まる", () => {
  it.each([
    "返金対応いたします。",
    "返金の手続きを進めます。",
    "お詫びとして星のかけらを100個お送りします。",
    "補償として付与いたします。",
    "必ず元に戻ります。",
    "間違いなく届きます。",
  ])("止める：%s", (s) => expect(findRiskyPhrases(s).length).toBeGreaterThan(0));

  it.each([
    "返金については、担当部署で確認いたします。",
    "返金はストアにお問い合わせください。",
    "返金はいたしかねます。",
    "補償の有無は運営チームで判断いたします。",
    "購入した星のかけらが反映されない場合は、まずアプリを一度終了して再起動してください。",
  ])("止めない：%s", (s) => expect(findRiskyPhrases(s)).toEqual([]));
});
