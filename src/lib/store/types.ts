import type { Inquiry, Reply } from "../types";
import type { SeedData } from "../seed";

/**
 * 保存先の共通の窓口。
 * デモデータ（架空の問い合わせ・過去の返信）は毎回同じ規則で作り直せるので保存しない。
 * 保存するのは「お試しを始めた日」と「利用者が送った返信・問い合わせの状態の変更」だけにして、書き込み回数を抑える。
 * 日付が変わったら、お試しの記録は作り直す（デモデータが常に「今日」基準になるように）。
 */
export interface DataStore {
  readonly kind: "local" | "firestore";
  load(): Promise<SeedData>;
  saveReply(reply: Reply, inquiry: Inquiry): Promise<void>;
  reset(): Promise<void>;
}

export type StatusPatch = Pick<Inquiry, "id" | "status">;

export function mergeWorkspace(seed: SeedData, added: Reply[], patches: StatusPatch[]): SeedData {
  const inquiries = seed.inquiries.map((q) => {
    const p = patches.find((x) => x.id === q.id);
    return p ? { ...q, status: p.status } : q;
  });
  const replies = [...seed.replies, ...added].sort((a, b) => a.at.localeCompare(b.at));
  return { ...seed, inquiries, replies };
}
