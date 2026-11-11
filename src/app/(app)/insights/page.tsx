"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { BarList } from "@/components/Charts";
import { GapPanel } from "@/components/GapPanel";
import { Card, CardTitle, cx, Icon, pct } from "@/components/ui";
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

  const rangeLabel = RANGES.find((r) => r.id === range)!.label;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-xl">
          <h1 className="font-serif text-2xl font-bold">SVダッシュボード</h1>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">対応の速さ、AIの返信案の使われ方、マニュアルの穴を確かめます。</p>
        </div>
        <div className="flex rounded-lg border border-line-strong bg-surface p-0.5" role="tablist" aria-label="集計期間">
          {RANGES.map((r) => (
            <button
              key={r.id}
              role="tab"
              aria-selected={range === r.id}
              onClick={() => setRange(r.id)}
              className={cx("min-h-9 rounded-md px-3.5 text-sm", range === r.id ? "bg-brand font-bold text-white" : "text-ink-soft hover:bg-brand-soft hover:text-brand")}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* 数字の帯：24時間以内の対応率を主役に */}
      <dl className="grid overflow-hidden rounded-[10px] border border-line bg-surface md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="border-b border-line px-5 py-4 md:border-r md:border-b-0">
          <dt className="text-xs font-medium text-ink-soft">24時間以内に対応できた割合（{rangeLabel}）</dt>
          <dd className="mt-1 text-5xl leading-none font-bold tracking-tight">{pct(s.within24hRate)}</dd>
          <dd className="mt-3">
            <span className="block h-2 overflow-hidden rounded-full bg-brand-soft" aria-hidden="true">
              <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.min(100, s.within24hRate * 100)}%` }} />
            </span>
            <span className="mt-1.5 block text-xs text-ink-muted">
              最初の対応まで平均 <b className="font-medium text-ink">{formatMinutes(s.avgFirstResponseMin)}</b>
            </span>
          </dd>
        </div>
        <Figure label="受信" value={s.received} unit="件" sub={`未対応 ${s.open}件・SV相談 ${s.escalated}件`} />
        <Figure label="AI返信案の採用率" value={s.aiAdoption === null ? "—" : pct(s.aiAdoption)} sub={`AI案を使った返信 ${pct(s.aiUsedRate)}`} />
        <Figure
          label="マニュアルにない質問"
          value={s.gaps.length}
          unit="件"
          sub={s.gaps.length ? "記事を足す候補・下で確認" : "この期間はありません"}
          tone={s.gaps.length ? "warn" : undefined}
        />
      </dl>

      <GapPanel key={range} gaps={s.gaps} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>問い合わせの分類</CardTitle>
          <div className="px-5 py-4">
            {s.received ? <BarList rows={categoryRows} labelWidth="10rem" /> : <p className="py-6 text-center text-sm text-ink-muted">この期間の問い合わせはありません。</p>}
          </div>
        </Card>
        <Card>
          <CardTitle aside={<span className="text-xs text-ink-muted">送った返信の根拠</span>}>よく根拠に使われた記事</CardTitle>
          <div className="px-5 py-4">
            {s.topArticles.length ? (
              <BarList rows={s.topArticles.map((t) => ({ label: t.article.title, value: t.count }))} unit="回" labelWidth="14rem" />
            ) : (
              <p className="py-6 text-center text-sm text-ink-muted">この期間の記録はまだありません。</p>
            )}
          </div>
        </Card>
      </div>
      <p className="max-w-3xl text-xs leading-relaxed text-ink-muted">
        AI返信案の採用率は、送った返信とAIの返信案の文字の重なりから計算しています（同じなら100%）。低いときは、返信案の質かマニュアルの内容を見直す合図です。
      </p>
    </div>
  );
}

function Figure({ label, value, unit, sub, tone }: { label: string; value: React.ReactNode; unit?: string; sub?: string; tone?: "warn" }) {
  return (
    <div className="border-b border-line px-5 py-4 last:border-b-0 md:border-b-0 md:[&+&]:border-l">
      <dt className={cx("flex items-center gap-1 text-xs font-medium", tone ? "text-warn" : "text-ink-soft")}>
        {tone && <Icon name="book" className="size-3.5" />}
        {label}
      </dt>
      <dd className={cx("mt-1.5 text-3xl leading-none font-bold tracking-tight", tone && "text-warn")}>
        {value}
        {unit && <span className="ml-0.5 text-sm font-medium">{unit}</span>}
      </dd>
      {sub && <dd className="mt-1.5 text-xs text-ink-muted">{sub}</dd>}
    </div>
  );
}
