"use client";

import { useEffect, useState } from "react";
import { AiSourceBadge, btn, Card, cx, Icon } from "./ui";
import { analyzeGaps } from "@/lib/ai";
import { formatDateTimeJa } from "@/lib/dates";
import type { AiSource, GapInsight, Inquiry } from "@/lib/types";

/** マニュアルにない質問の一覧と、AIによる「記事を足すならこれ」の提案 */
export function GapPanel({ gaps }: { gaps: Inquiry[] }) {
  const [state, setState] = useState<{ value: GapInsight; source: AiSource; note?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Inquiry | null>(null);
  const byId = new Map(gaps.map((q) => [q.id, q]));

  async function run() {
    setLoading(true);
    setState(await analyzeGaps(gaps));
    setLoading(false);
  }

  // 根拠のダイアログは Esc でも閉じる
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <Card className="overflow-hidden">
      <div className="on-night flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-brand px-5 py-3 text-white">
        <h2 className="flex items-center gap-2 font-serif text-[15px] font-bold">
          <Icon name="sparkle" className="size-4 text-star" />
          マニュアルの穴と、FAQ追加の提案
        </h2>
        {state && <AiSourceBadge source={state.source} onDark />}
      </div>
      <div className={cx("space-y-5 px-5 py-5 transition-opacity", loading && state && "opacity-50")} aria-busy={loading}>
        {gaps.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-good">
            <Icon name="check" />
            この期間、マニュアルにない質問はありませんでした。
          </p>
        ) : !state ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <button className={btn.primary} onClick={run} disabled={loading}>
              <Icon name="sparkle" className={loading ? "animate-pulse" : undefined} />
              {loading ? "分析しています…" : `${gaps.length}件の質問から、足すべき記事を考える`}
            </button>
            <p className="max-w-xl text-sm leading-relaxed text-ink-soft">近い記事が見つからなかった問い合わせをまとめ、マニュアルに足す記事の案を出します。提案ごとに根拠の問い合わせを開けます。</p>
          </div>
        ) : (
          <div className="space-y-5">
            {state.note && <p className="text-xs text-ink-soft">{state.note}</p>}
            <p className="font-serif text-lg leading-snug font-bold">{state.value.headline}</p>
            <ol className="grid gap-x-6 gap-y-4 md:grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]">
              {state.value.suggestions.map((s, i) => (
                <li key={s.title} className="rounded-lg border border-line bg-paper p-4">
                  <p className="text-[11px] font-bold tracking-wider text-ink-muted">記事の案 {i + 1}</p>
                  <p className="mt-1 font-serif font-bold">{s.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{s.why}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-ink-muted">根拠の問い合わせ</span>
                    {s.evidenceInquiryIds.map((id, j) => (
                      <button
                        key={id}
                        className="inline-flex h-6 items-center gap-1 rounded-md border border-line-strong bg-surface px-1.5 text-[11px] font-medium text-brand hover:border-brand"
                        onClick={() => setOpen(byId.get(id) ?? null)}
                      >
                        <Icon name="mail" className="size-3" />
                        {j + 1}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-ink-muted">AIの提案は参考情報です。記事にする内容は、運営チームに事実を確かめてから書いてください。</p>
              <button className={btn.ghost} onClick={run} disabled={loading}>
                <Icon name="reset" className="size-3.5" />
                {loading ? "分析しています…" : "もう一度分析する"}
              </button>
            </div>
          </div>
        )}

        {gaps.length > 0 && (
          <details className="rounded-lg border border-line">
            <summary className="cursor-pointer px-4 py-2.5 text-sm text-ink-soft select-none hover:text-ink">対象の問い合わせ（{gaps.length}件）を見る</summary>
            <ul className="divide-y divide-line border-t border-line">
              {gaps.map((q) => (
                <li key={q.id}>
                  <button className="flex w-full flex-wrap items-baseline gap-x-3 px-4 py-2 text-left text-sm hover:bg-paper" onClick={() => setOpen(q)}>
                    <span className="font-serif text-ink">{q.subject}</span>
                    <span className="text-xs text-ink-muted tabular-nums">{formatDateTimeJa(q.receivedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-ink/50 p-4" onClick={() => setOpen(null)} role="dialog" aria-modal="true" aria-labelledby="gap-title">
          <div className="w-full max-w-md rounded-[10px] bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-line px-5 py-4">
              <p className="text-[11px] font-bold tracking-wider text-ink-muted">根拠の問い合わせ</p>
              <p id="gap-title" className="mt-0.5 font-serif text-lg font-bold">
                {open.subject}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                <span className="tabular-nums">{formatDateTimeJa(open.receivedAt)}</span>・{open.playerName}
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="rounded-lg bg-paper p-4 font-serif text-[15px] leading-[1.9] whitespace-pre-wrap">{open.body}</p>
              <button autoFocus className={`${btn.secondary} mt-5 w-full`} onClick={() => setOpen(null)}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
