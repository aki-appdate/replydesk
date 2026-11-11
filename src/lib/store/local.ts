import { toDateKey } from "../dates";
import { createSeedData } from "../seed";
import type { Inquiry, Reply } from "../types";
import { mergeWorkspace, type DataStore, type StatusPatch } from "./types";

// Firebaseが未設定のときの保存先。このブラウザの中だけに保存する。

const KEY = "replydesk:workspace:v1";

type Saved = { seedBase: string; replies: Reply[]; patches: StatusPatch[] };

function read(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function write(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // 保存できない環境（プライベートモード等）でも、画面上の操作は続けられる
  }
}

export class LocalStore implements DataStore {
  readonly kind = "local" as const;
  private state: Saved | null = null;

  async load() {
    // デモデータは「今日」を基準に作る。日付が変わったら、お試しの記録ごと作り直す
    // （古い基準日のままだと、未対応が全部「24時間以上経過」になり、現場らしくなくなるため）
    const saved = read();
    const fresh = !saved || toDateKey(new Date(saved.seedBase)) !== toDateKey(new Date());
    this.state = fresh ? { seedBase: new Date().toISOString(), replies: [], patches: [] } : saved;
    write(this.state);
    return mergeWorkspace(createSeedData(new Date(this.state.seedBase)), this.state.replies, this.state.patches);
  }

  async saveReply(reply: Reply, inquiry: Inquiry) {
    if (!this.state) await this.load();
    const s = this.state!;
    s.replies.push(reply);
    s.patches = [...s.patches.filter((p) => p.id !== inquiry.id), { id: inquiry.id, status: inquiry.status }];
    write(s);
  }

  async reset() {
    try {
      localStorage.removeItem(KEY);
    } catch {}
    this.state = null;
  }
}
