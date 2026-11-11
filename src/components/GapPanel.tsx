"use client";

import { useEffect, useRef, useState } from "react";
import { AiSourceBadge, btn, cx, Icon } from "./ui";
import { analyzeGaps } from "@/lib/ai";
import { formatDateTimeJa } from "@/lib/dates";
import type { AiSource, GapInsight, Inquiry } from "@/lib/types";

/** 問い合わせ本文の書き出し（根拠として見せる抜き書き） */
function excerpt(body: string, n = 34): string {
  const one = body.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n)}…` : one;
}

/**
 * マニュアルに足す記事の下書き。
 * 左：マニュアルにない質問（問い合わせの文面そのもの）。右：AIが書いた「記事の下書き」を付箋で貼る。
 * 付箋にふれると、その根拠になった問い合わせが左の束で光る。
 */
export function GapPanel({ gaps }: { gaps: Inquiry[] }) {
  const [state, setState] = useState<{ value: GapInsight; source: AiSource; note?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Inquiry | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const byId = new Map(gaps.map((q) => [q.id, q]));
  // 根拠は同じ文面を1件にまとめて返ってくるので、左の束では「同じ文面」の問い合わせをすべて対応づける
  const bodyOf = (id: string) => byId.get(id)?.body ?? id;
  const evidenceOf = new Map<string, number>();
  state?.value.suggestions.forEach((s, i) => s.evidenceInquiryIds.forEach((id) => !evidenceOf.has(bodyOf(id)) && evidenceOf.set(bodyOf(id), i)));
  const activeBodies = new Set(active !== null ? (state?.value.suggestions[active]?.evidenceInquiryIds ?? []).map(bodyOf) : []);

  async function run() {
    setLoading(true);
    setState(await analyzeGaps(gaps));
    setLoading(false);
  }

  // 付箋にふれたら、光った行が左の束のスクロールの外にあれば見える位置まで送る。
  // scrollIntoView({ block: "nearest" }) と同じ動きを、束の中だけで行う（ページ全体は動かさない）
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>("[data-lit=true]");
    if (!list || !row) return;
    const top = row.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
    const bottom = top + row.offsetHeight;
    if (top < list.scrollTop) list.scrollTo({ top, behavior: "smooth" });
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTo({ top: bottom - list.clientHeight, behavior: "smooth" });
  }, [active]);

  // 根拠のダイアログは Esc でも閉じる
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <section aria-labelledby="gap-heading" className="rounded-[10px] border border-line bg-surface">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-line px-5 pt-4 pb-3">
        <div>
          <h2 id="gap-heading" className="flex items-center gap-2 font-serif text-lg font-bold">
            <Icon name="note" className="size-4.5 text-ink-soft" />
            マニュアルに足す記事の下書き
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">近い記事が見つからなかった問い合わせから、AIが記事の下書きを書きます。</p>
        </div>
        {state && <AiSourceBadge source={state.source} />}
      </div>

      {gaps.length === 0 ? (
        <p className="flex items-center gap-2 px-5 py-6 text-sm text-good">
          <Icon name="check" />
          この期間、マニュアルにない質問はありませんでした。
        </p>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,21rem)_1fr]">
          {/* 付箋の面（スマホでは先に見せる） */}
          <div className="border-line bg-paper px-5 py-5 lg:order-2 lg:border-l">
            {!state ? (
              <div className="flex flex-col items-start gap-4">
                <div className="grid w-full gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={cx(
                        "h-36 rounded-[2px] border border-dashed border-line-strong max-sm:[&:nth-child(n+2)]:hidden sm:max-xl:[&:nth-child(3)]:hidden",
                        loading && "animate-pulse bg-note/60",
                      )}
                    >
                      {i === 0 && !loading && <p className="p-4 text-xs leading-relaxed text-ink-muted">ここに、記事の下書きが付箋で貼られます。</p>}
                    </div>
                  ))}
                </div>
                <button className={btn.primary} onClick={run} disabled={loading} aria-busy={loading}>
                  <Icon name="nib" className={loading ? "animate-pulse" : undefined} />
                  {loading ? "問い合わせを読んで、下書きを書いています…" : `${gaps.length}件の質問を読んで、記事の下書きを書く`}
                </button>
                <p className="text-xs leading-relaxed text-ink-muted">下書きごとに、根拠にした問い合わせの文面を確かめられます。</p>
              </div>
            ) : (
              <div className={cx("transition-opacity", loading && "opacity-50")} aria-busy={loading}>
                {state.note && <p className="mb-3 text-xs text-ink-soft">{state.note}</p>}
                <p className="font-serif text-[17px] leading-snug font-bold [word-break:auto-phrase] [text-wrap:balance]">{state.value.headline}</p>
                <ol className="mt-5 grid gap-x-5 gap-y-6 md:grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]">
                  {state.value.suggestions.map((s, i) => (
                    <li
                      key={s.title}
                      className={cx("sticky-note px-4 pt-3.5 pb-6 text-ink", i % 2 ? "rotate-[0.6deg]" : "-rotate-[0.5deg]")}
                      onMouseEnter={() => setActive(i)}
                      onMouseLeave={() => setActive(null)}
                      onFocus={() => setActive(i)}
                      onBlur={() => setActive(null)}
                    >
                      <p className="text-[11px] font-bold tracking-wider text-ink-soft">下書き {i + 1}</p>
                      <h3 className="mt-1 font-serif text-[15px] leading-snug font-bold">{s.title}</h3>
                      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{s.why}</p>
                      <p className="mt-3 text-[11px] font-bold text-ink-soft">根拠にした問い合わせ（{s.evidenceInquiryIds.length}件）</p>
                      <ul className="mt-1 space-y-1">
                        {s.evidenceInquiryIds.map((id) => {
                          const q = byId.get(id);
                          if (!q) return null;
                          return (
                            <li key={id}>
                              <button
                                className="w-full rounded-[3px] px-1.5 py-1 text-left font-serif text-[13px] leading-snug text-ink underline decoration-note-edge decoration-1 underline-offset-4 hover:bg-surface/70 hover:decoration-ink-soft"
                                onClick={() => setOpen(q)}
                              >
                                「{excerpt(q.body, 26)}」
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </ol>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                  <p className="max-w-md text-xs leading-relaxed text-ink-muted">下書きは参考です。記事にする前に、運営チームに事実を確かめてください。</p>
                  <button className={btn.ghost} onClick={run} disabled={loading}>
                    <Icon name="nib" className="size-3.5" />
                    {loading ? "書き直しています…" : "下書きを書き直す"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* マニュアルにない質問の束 */}
          <div className="border-t border-line lg:order-1 lg:border-t-0">
            <p className="flex items-baseline justify-between px-5 pt-4 pb-2 text-xs text-ink-muted">
              <span className="font-bold text-ink-soft">マニュアルにない質問</span>
              <span className="tabular-nums">{gaps.length}件</span>
            </p>
            <ul ref={listRef} className="max-h-[30rem] overflow-y-auto overscroll-contain border-t border-line max-lg:max-h-[20rem]">
              {gaps.map((q) => {
                const n = evidenceOf.get(q.body);
                const lit = activeBodies.has(q.body);
                return (
                  <li key={q.id} data-lit={lit} className="border-b border-line last:border-b-0">
                    <button className={cx("block w-full px-5 py-3 text-left transition-colors", lit ? "bg-note" : "hover:bg-paper")} onClick={() => setOpen(q)}>
                      <span className="line-clamp-2 font-serif text-sm leading-relaxed text-ink">「{excerpt(q.body, 60)}」</span>
                      {/* 付箋の黄色の上では ink-muted だと文字が薄いので、光っている間は濃くする */}
                      <span className={cx("mt-1 flex items-center gap-2 text-[11px]", lit ? "text-ink-soft" : "text-ink-muted")}>
                        <span className="truncate">{q.subject}</span>
                        <span className="ml-auto shrink-0 tabular-nums">{formatDateTimeJa(q.receivedAt)}</span>
                      </span>
                      {n !== undefined && (
                        <span className={cx("mt-1.5 inline-flex items-center gap-1 text-[11px]", lit ? "font-bold text-ink" : "text-ink-muted")}>
                          <Icon name="note" className="size-3" />
                          下書き {n + 1} の根拠
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-ink/50 p-4" onClick={() => setOpen(null)} role="dialog" aria-modal="true" aria-labelledby="gap-title">
          <div className="w-full max-w-md rounded-[10px] bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-line px-5 py-4">
              <p className="text-[11px] font-bold tracking-wider text-ink-muted">マニュアルにない質問</p>
              <p id="gap-title" className="mt-0.5 font-serif text-lg font-bold">
                {open.subject}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                <span className="tabular-nums">{formatDateTimeJa(open.receivedAt)}</span>・{open.playerName} さん
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="ruled font-serif text-[15px] whitespace-pre-wrap">{open.body}</p>
              <button autoFocus className={`${btn.secondary} mt-5 w-full`} onClick={() => setOpen(null)}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
