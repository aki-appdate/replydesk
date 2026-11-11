import { z } from "zod";

// AIの返答は必ずこの形で受け取り、形が合わなければ使わない（見本の返答に切り替える）。
// 同じ定義から「AIに渡す返答形式（JSON Schema）」も作るので、ずれが起きない。

const category = z.enum(["payment", "account", "transfer", "bug", "event", "ban", "other"]);

export const replyDraftSchema = z.object({
  category: category.describe("問い合わせの分類"),
  urgency: z.enum(["high", "mid", "low"]).describe("対応の急ぎ度。課金・アカウント喪失・強い怒りは high"),
  sentiment: z.enum(["angry", "confused", "calm"]).describe("お客さまの気持ち"),
  summary: z.string().min(1).max(80).describe("問い合わせの要点を1文で"),
  reply: z.string().min(1).max(1200).describe("お客さまへの返信文。丁寧な日本語。署名は不要"),
  citations: z
    .array(
      z.object({
        articleId: z.string().describe("根拠にした記事のid。渡された記事のidだけを使う"),
        quote: z.string().max(200).describe("記事本文からそのまま抜き出した一文。言い換えない"),
      }),
    )
    .max(4)
    .describe("返信の根拠。記事に書かれていない約束はしない"),
  missingInfo: z.array(z.string().max(60)).max(4).describe("回答に足りず、お客さまに確認したい情報"),
  escalation: z.object({
    needed: z.boolean().describe("返金・法的な話・未成年の課金・個人情報・規約違反の判断など、担当者だけで決めてはいけない場合 true"),
    reason: z.string().max(100).nullable(),
  }),
});

export const gapInsightSchema = z.object({
  headline: z.string().max(80).describe("マニュアルの状態を一言で"),
  suggestions: z
    .array(
      z.object({
        title: z.string().max(40).describe("追加・更新したほうがよい記事の題名"),
        why: z.string().max(200).describe("そう考える理由"),
        evidenceInquiryIds: z.array(z.string()).min(1).max(5).describe("根拠にした問い合わせのid。渡されたidだけを使う"),
      }),
    )
    .min(1)
    .max(3),
});

export const replyDraftJsonSchema = z.toJSONSchema(replyDraftSchema);
export const gapInsightJsonSchema = z.toJSONSchema(gapInsightSchema);
