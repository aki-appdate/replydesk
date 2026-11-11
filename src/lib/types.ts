// アプリ全体で使うデータの形。画面・保存・AIのすべてがこの型を共有する。

export type Role = "agent" | "sv";

export type Staff = {
  id: string;
  name: string;
  role: Role;
};

export type Category = "payment" | "account" | "transfer" | "bug" | "event" | "ban" | "other";
export type Urgency = "high" | "mid" | "low";
export type Sentiment = "angry" | "confused" | "calm";

/** マニュアル・FAQの1記事 */
export type Article = {
  id: string;
  title: string;
  category: Category;
  body: string;
  /** この記事を探すための言葉（問い合わせにこの言葉があれば候補にする） */
  keywords: string[];
  updatedAt: string;
};

export type InquiryStatus = "new" | "sent" | "escalated";

/** お客さま（プレイヤー）からの問い合わせ */
export type Inquiry = {
  id: string;
  receivedAt: string;
  playerName: string;
  playerId: string;
  device: string;
  subject: string;
  body: string;
  status: InquiryStatus;
};

/** AIの根拠：どの記事のどの文をもとにしたか */
export type Citation = { articleId: string; quote: string };

/** AIが作る返信案。人が確認・修正してから送る */
export type ReplyDraft = {
  category: Category;
  urgency: Urgency;
  sentiment: Sentiment;
  /** 問い合わせの要点（1文） */
  summary: string;
  reply: string;
  citations: Citation[];
  /** 回答に足りない情報。お客さまに確認したいこと */
  missingInfo: string[];
  escalation: { needed: boolean; reason: string | null };
};

export type AiSource = "gemini" | "sample";

/** 送った返信（またはSVへの相談）の記録 */
export type Reply = {
  id: string;
  inquiryId: string;
  staffId: string;
  at: string;
  kind: "sent" | "escalated";
  body: string;
  /** AIの返信案（AIを使わなかった場合はnull） */
  aiDraft: string | null;
  aiSource: AiSource | null;
  category: Category;
  /** 根拠として確認できた記事のID */
  citedArticleIds: string[];
  /** 参考にできる記事が見つからなかった（マニュアルの穴の候補） */
  noArticleMatched: boolean;
};

/** SV向け：マニュアルに足りない記事の提案 */
export type GapInsight = {
  headline: string;
  suggestions: {
    title: string;
    why: string;
    evidenceInquiryIds: string[];
  }[];
};
