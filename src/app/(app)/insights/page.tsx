"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { BarList } from "@/components/Charts";
import { GapPanel } from "@/components/GapPanel";
import { Card, CardTitle, cx, pct } from "@/components/ui";
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
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">対応の速さと返信案の使われ方を読み、マニュアルに足す記事を決めます。</p>
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

      {/* 主役の数字は1つ（24時間以内の対応率）。ほかの数字は申し送りの文に入れて読ませる */}
      <section aria-label={`${rangeLabel}の申し送り`} className="grid overflow-hidden rounded-[10px] border border-line bg-surface lg:grid-cols-[22rem_1fr]">
        <div className="border-b border-line px-6 py-5 lg:border-r lg:border-b-0">
          <p className="text-xs font-medium text-ink-soft">24時間以内に対応できた割合</p>
          <p className={cx("mt-2 text-[3.5rem] leading-none font-bold tracking-tight", s.within24hRate === null && "text-ink-muted")}>{pct(s.within24hRate)}</p>
          <div className="mt-4 h-2 rounded-full bg-brand-soft" role="img" aria-label={`目標の24時間以内に対応できた割合 ${s.within24hRate === null ? "まだ数えられません" : pct(s.within24hRate)}`}>
            <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (s.within24hRate ?? 0) * 100)}%` }} />
          </div>
          {s.within24hRate === null && <p className="mt-2 text-xs text-ink-soft">{s.received ? "この期間に対応した問い合わせがまだないため、数えられません。" : "この期間に届いた問い合わせはありません。"}</p>}
          <p className="mt-2 text-xs text-ink-muted">
            最初の対応まで平均 <b className="font-medium text-ink">{formatMinutes(s.avgFirstResponseMin)}</b>
          </p>
        </div>
        <div className="px-6 py-5">
          <p className="flex items-baseline justify-between gap-3 text-xs text-ink-muted">
            <span className="font-bold tracking-wider text-ink-soft">申し送り</span>
            <span>{rangeLabel}の集計</span>
          </p>
          <div className="ruled mt-1 max-w-[42em] font-serif text-[15px] text-ink">
            <p>
              届いた問い合わせは<Num>{s.received}件</Num>。未対応が<Num tone={s.open ? "bad" : undefined}>{s.open}件</Num>、SVに相談中が<Num>{s.escalated}件</Num>あります。
            </p>
            <p>
              {s.aiAdoption === null ? (
                <>この期間、AIの返信案を使った返信はまだありません。</>
              ) : (
                <>
                  送った返信のうち<Num>{pct(s.aiUsedRate)}</Num>がAIの返信案を使い、送った文はAIの案と平均<Num>{pct(s.aiAdoption)}</Num>同じでした（採用率）。
                </>
              )}
            </p>
            <p>
              {s.gaps.length ? (
                <>
                  マニュアルに近い記事がない質問が<Num tone="warn">{s.gaps.length}件</Num>。下で記事の下書きにまとめます。
                </>
              ) : (
                <>マニュアルで答えられない質問はありませんでした。</>
              )}
            </p>
          </div>
        </div>
      </section>

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

/** 申し送りの文の中の数字。太字・等幅で、文から浮かせる */
function Num({ children, tone }: { children: React.ReactNode; tone?: "bad" | "warn" }) {
  return <b className={cx("mx-0.5 font-sans whitespace-nowrap font-bold tabular-nums", tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-ink")}>{children}</b>;
}
