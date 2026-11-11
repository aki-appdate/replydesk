import type { Article, Inquiry } from "../types";

// AIへの指示文。何を渡し、何を返してほしいかをここに集める。

export const REPLY_SYSTEM = `あなたはスマホゲーム「ほしぞらテイルズ」のサポート窓口で、担当者の返信を手伝うアシスタントです。
お客さま（プレイヤー）からの問い合わせに対して、担当者が確認してから送る返信案を作ります。

守ること:
- 返信の内容は、渡されたマニュアル記事に書かれていることだけにする。記事にないことは推測で答えず、「確認いたします」とする。
- 根拠にした記事の文を citations に入れる。quote は記事本文から一字一句そのまま抜き出す（言い換えない）。
- 返金・補償・アカウント復旧などを担当者の判断で約束しない。「必ず」「絶対」などの断定をしない。
- 返金・未成年の課金・法的な話・利用停止の解除・個人情報に関わる場合は escalation.needed を true にする。
- 利用停止の理由や、他のプレイヤーの情報は伝えない。お客さまが書いた電話番号などの個人情報を返信で繰り返さない。
- 返信は「（プレイヤー名） 様」で始め、お礼→（必要なら）お詫び→回答→確認したい情報→結び、の順にする。署名は不要。
- 文章は丁寧だが簡潔な日本語にする。`;

export function buildReplyPrompt(inquiry: Inquiry, articles: Article[]): string {
  const kb = articles.length
    ? articles.map((a) => `[${a.id}] ${a.title}\n${a.body}`).join("\n\n")
    : "（関係しそうな記事は見つかりませんでした）";
  return `■ マニュアル記事
${kb}

■ 問い合わせ
プレイヤー名: ${inquiry.playerName}
プレイヤーID: ${inquiry.playerId}
端末: ${inquiry.device}
件名: ${inquiry.subject}
本文:
${inquiry.body}`;
}

export const GAP_SYSTEM = `あなたはゲームのサポート窓口のSV（現場リーダー）を補佐するアナリストです。
マニュアルに近い記事が見つからなかった問い合わせの一覧から、追加・更新すべき記事を最大3つ提案します。

守ること:
- 根拠にした問い合わせの id を evidenceInquiryIds に必ず入れる。渡された id 以外は使わない。
- 似た質問はまとめて1つの提案にする。件数が多いものを先にする。
- 件数は渡された一覧から数え、作らない。`;

export function buildGapPrompt(gaps: Inquiry[]): string {
  return `マニュアルに近い記事が見つからなかった問い合わせ（[id] 件名 / 本文）:
${gaps.map((q) => `[${q.id}] ${q.subject} / ${q.body}`).join("\n")}`;
}
