"use client";

import { useState } from "react";
import { AiSourceBadge, btn, Card, CardTitle } from "./ui";
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

  return (
    <Card>
      <CardTitle aside={state && <AiSourceBadge source={state.source} />}>✦ マニュアルの穴とFAQ追加の提案</CardTitle>
      <div className="space-y-4 px-5 py-4">
        {gaps.length === 0 ? (
          <p className="text-sm text-ink-muted">この期間、マニュアルにない質問はありませんでした。</p>
        ) : !state ? (
          <div className="flex flex-wrap items-center gap-3">
            <button className={btn.primary} onClick={run} disabled={loading}>
              {loading ? "分析しています…" : `${gaps.length}件の質問から、足すべき記事を考える`}
            </button>
            <p className="text-sm text-ink-soft">近い記事が見つからなかった問い合わせをまとめ、マニュアルに足す記事の案を出します。</p>
          </div>
        ) : (
          <div className="space-y-4">
            {state.note && <p className="text-xs text-ink-soft">{state.note}</p>}
            <p className="text-base font-bold">{state.value.headline}</p>
            <div className="grid gap-3 md:grid-cols-3">
              {state.value.suggestions.map((s) => (
                <div key={s.title} className="rounded-lg border border-line p-3">
                  <p className="font-medium">{s.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{s.why}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-ink-muted">根拠：</span>
                    {s.evidenceInquiryIds.map((id, i) => (
                      <button key={id} className="rounded border border-line px-1.5 text-xs text-brand hover:bg-brand-soft" onClick={() => setOpen(byId.get(id) ?? null)}>
                        問い合わせ{i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-ink-muted">AIの提案は参考情報です。記事にする内容は、運営チームに事実を確かめてから書いてください。</p>
            <button className={btn.ghost} onClick={run} disabled={loading}>
              {loading ? "分析しています…" : "もう一度分析する"}
            </button>
          </div>
        )}

        {gaps.length > 0 && (
          <details className="rounded-lg border border-line">
            <summary className="cursor-pointer px-3 py-2 text-sm text-ink-soft">対象の問い合わせ（{gaps.length}件）を見る</summary>
            <ul className="divide-y divide-line border-t border-line">
              {gaps.map((q) => (
                <li key={q.id}>
                  <button className="w-full px-3 py-2 text-left text-sm hover:bg-canvas" onClick={() => setOpen(q)}>
                    <span className="text-ink">{q.subject}</span>
                    <span className="ml-2 text-xs tabular-nums text-ink-muted">{formatDateTimeJa(q.receivedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-ink/40 p-4" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-surface p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold">{open.subject}</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              {formatDateTimeJa(open.receivedAt)}・{open.playerName}
            </p>
            <p className="mt-3 whitespace-pre-wrap rounded-lg bg-canvas p-3 text-sm">{open.body}</p>
            <button className={`${btn.secondary} mt-4 w-full`} onClick={() => setOpen(null)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
