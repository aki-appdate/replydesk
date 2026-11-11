import { describe, expect, it } from "vitest";
import { addDays, startOfDay } from "./dates";
import { computeDeskStats, formatMinutes } from "./kpi";
import { createSeedData } from "./seed";
import { mergeWorkspace } from "./store/types";
import type { Reply } from "./types";

const NOW = new Date(2026, 10, 11, 17, 0);

describe("createSeedData", () => {
  it("同じ日付なら同じデータになる", () => {
    expect(createSeedData(NOW)).toEqual(createSeedData(NOW));
  });

  it("未来の問い合わせ・返信は作らない", () => {
    const morning = new Date(2026, 10, 11, 8, 30);
    const d = createSeedData(morning);
    expect(d.inquiries.every((q) => new Date(q.receivedAt) <= morning)).toBe(true);
    expect(d.replies.every((r) => new Date(r.at) <= morning)).toBe(true);
  });

  it("未対応・SV相談・マニュアルの穴がそれぞれ含まれる", () => {
    const d = createSeedData(NOW);
    expect(d.inquiries.some((q) => q.status === "new")).toBe(true);
    expect(d.inquiries.some((q) => q.status === "escalated")).toBe(true);
    expect(d.replies.some((r) => r.noArticleMatched)).toBe(true);
  });
});

describe("computeDeskStats", () => {
  it("期間内の件数と対応時間を数える", () => {
    const d = createSeedData(NOW);
    const s = computeDeskStats({ ...d, from: addDays(startOfDay(NOW), -14), to: addDays(startOfDay(NOW), 1) });
    expect(s.received).toBe(d.inquiries.length);
    expect(s.answered + s.escalated + s.open).toBe(s.received);
    expect(s.avgFirstResponseMin).toBeGreaterThan(0);
    expect(s.gaps.length).toBeGreaterThan(0);
  });

  it("AIの返信案をそのまま送れば採用率は1", () => {
    const d = createSeedData(NOW);
    const q = d.inquiries.find((x) => x.status === "new")!;
    const reply: Reply = {
      id: "r-x",
      inquiryId: q.id,
      staffId: "a-1",
      at: NOW.toISOString(),
      kind: "sent",
      body: "同じ文章です",
      aiDraft: "同じ文章です",
      aiSource: "sample",
      category: "other",
      citedArticleIds: [],
      noArticleMatched: false,
    };
    const merged = mergeWorkspace({ ...d, replies: [] }, [reply], [{ id: q.id, status: "sent" }]);
    const s = computeDeskStats({ ...merged, from: addDays(startOfDay(NOW), -14), to: addDays(startOfDay(NOW), 1) });
    expect(s.aiAdoption).toBe(1);
    expect(s.answered).toBe(merged.inquiries.filter((x) => x.status === "sent").length);
  });
});

describe("formatMinutes", () => {
  it.each([
    [null, "—"],
    [45, "45分"],
    [120, "2時間"],
    [135, "2時間15分"],
  ])("%s → %s", (m, s) => expect(formatMinutes(m)).toBe(s));
});

describe("24時間以内の対応率", () => {
  it("24時間以上放置された未対応は、対応できなかった件として分母に入る", () => {
    const d = createSeedData(NOW);
    const range = { from: addDays(startOfDay(NOW), -14), to: addDays(startOfDay(NOW), 1) };
    const now = computeDeskStats({ ...d, ...range, now: NOW });
    const later = computeDeskStats({ ...d, ...range, now: addDays(NOW, 3) });
    expect(later.within24hRate!).toBeLessThan(now.within24hRate!);
  });

  it("数えられる問い合わせがない期間は 0% ではなく null（画面では「—」）", () => {
    const d = createSeedData(NOW);
    const future = { from: addDays(startOfDay(NOW), 5), to: addDays(startOfDay(NOW), 6) };
    const s = computeDeskStats({ ...d, ...future, now: NOW });
    expect(s.received).toBe(0);
    expect(s.within24hRate).toBeNull();
  });
});

describe("デモデータの「今日」", () => {
  it.each([
    ["昼", new Date(2026, 10, 11, 14, 22)],
    ["夕方", new Date(2026, 10, 11, 19, 0)],
  ])("%s に開くと、今日届いた問い合わせと今日の対応がある", (_, now) => {
    const d = createSeedData(now);
    const s = computeDeskStats({ ...d, from: startOfDay(now), to: addDays(startOfDay(now), 1), now });
    expect(s.received).toBeGreaterThanOrEqual(8);
    expect(s.open).toBeGreaterThan(0);
    expect(s.within24hRate).not.toBeNull();
  });

  it.each([new Date(2026, 10, 11, 0, 5), new Date(2026, 10, 11, 6, 0), new Date(2026, 10, 11, 23, 59)])("%s でも未来の時刻を作らない", (now) => {
    const d = createSeedData(now);
    expect(d.inquiries.every((q) => new Date(q.receivedAt) <= now)).toBe(true);
    expect(d.replies.every((r) => new Date(r.at) <= now)).toBe(true);
  });

  it("未対応のうち2件は24時間以上たっている（受信箱の「24時間以上」に出る）", () => {
    const d = createSeedData(NOW);
    const over = d.inquiries.filter((q) => q.status === "new" && NOW.getTime() - new Date(q.receivedAt).getTime() > 24 * 3600 * 1000);
    expect(over.length).toBeGreaterThanOrEqual(2);
  });
});
