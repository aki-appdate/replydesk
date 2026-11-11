"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { BarList } from "@/components/Charts";
import { GapPanel } from "@/components/GapPanel";
import { Card, CardTitle, cx, pct, Stat } from "@/components/ui";
import { addDays, startOfDay, startOfWeek } from "@/lib/dates";
import { computeDeskStats, formatMinutes } from "@/lib/kpi";
import { CATEGORY_LABEL } from "@/lib/labels";
import type { Category } from "@/lib/types";

type Range = "today" | "week" | "2weeks";
const RANGES: { id: Range; label: string }[] = [
  { id: "today", label: "今日" },
  { id: "week", label: "今週" },
  { id: "2weeks", label: "直近2週間" },
];

export default function InsightsPage() {
  const { inquiries, replies, articles } = useApp();
  const [range, setRange] = useState<Range>("2weeks");

  const { from, to } = useMemo(() => {
    const now = new Date();
    const end = addDays(startOfDay(now), 1);
    const start = range === "today" ? startOfDay(now) : range === "week" ? startOfWeek(now) : addDays(startOfDay(now), -13);
    return { from: start, to: end };
  }, [range]);

  const s = useMemo(() => computeDeskStats({ inquiries, replies, articles, from, to }), [inquiries, replies, articles, from, to]);
  const categoryRows = (Object.keys(CATEGORY_LABEL) as Category[])
    .map((c) => ({ label: CATEGORY_LABEL[c], value: s.byCategory[c] }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">SVダッシュボード</h1>
          <p className="mt-1 text-sm text-ink-soft">対応の速さ、AIの返信案の使われ方、マニュアルの穴を確認できます。</p>
        </div>
        <div className="flex rounded-lg border border-line bg-surface p-0.5" role="tablist" aria-label="集計期間">
          {RANGES.map((r) => (
            <button
              key={r.id}
              role="tab"
              aria-selected={range === r.id}
              onClick={() => setRange(r.id)}
              className={cx("rounded-md px-3 py-1.5 text-sm", range === r.id ? "bg-brand text-white" : "text-ink-soft hover:bg-canvas")}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="受信" value={s.received} sub={`未対応 ${s.open}件・SV相談 ${s.escalated}件`} />
        <Stat label="最初の対応までの平均" value={formatMinutes(s.avgFirstResponseMin)} sub={`24時間以内 ${pct(s.within24hRate)}`} />
        <Stat
          label="AI返信案の採用率"
          value={s.aiAdoption === null ? "—" : pct(s.aiAdoption)}
          sub={`AI案を使った返信 ${pct(s.aiUsedRate)}`}
        />
        <Stat label="マニュアルにない質問" value={<span className={s.gaps.length ? "text-warn" : undefined}>{s.gaps.length}</span>} sub="件" />
      </div>

      <GapPanel key={range} gaps={s.gaps} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>問い合わせの分類</CardTitle>
          <div className="px-5 py-4">{s.received ? <BarList rows={categoryRows} /> : <p className="text-sm text-ink-muted">この期間の問い合わせはありません。</p>}</div>
        </Card>
        <Card>
          <CardTitle>よく根拠に使われた記事</CardTitle>
          <div className="px-5 py-4">
            {s.topArticles.length ? (
              <BarList rows={s.topArticles.map((t) => ({ label: t.article.title, value: t.count }))} unit="回" labelWidth="12rem" />
            ) : (
              <p className="text-sm text-ink-muted">この期間の記録はまだありません。</p>
            )}
          </div>
        </Card>
      </div>
      <p className="text-xs text-ink-muted">
        AI返信案の採用率は、送った返信とAIの返信案の文字の重なりから計算しています（同じなら100%）。低いときは、返信案の質かマニュアルの内容を見直す合図です。
      </p>
    </div>
  );
}
