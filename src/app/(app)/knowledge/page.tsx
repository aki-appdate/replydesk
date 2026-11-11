"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Badge, Card, cx, Icon } from "@/components/ui";
import { CATEGORY_LABEL } from "@/lib/labels";
import { formatDateJa } from "@/lib/dates";

export default function KnowledgePage() {
  const { articles, replies } = useApp();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(articles[0]?.id ?? null);

  const cited = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of replies) for (const id of new Set(r.citedArticleIds)) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [replies]);

  const list = articles.filter((a) => !q || `${a.title}${a.body}${a.keywords.join("")}`.includes(q));
  const open = articles.find((a) => a.id === openId) ?? null;

  return (
    <div className="space-y-5">
      <div className="max-w-2xl">
        <h1 className="font-serif text-2xl font-bold">マニュアル</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          返信案の根拠になる記事です。AIはここに書かれていることだけを材料にし、引用した文がここにあるかをコードで照合します。
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <Card className="self-start overflow-hidden">
          <div className="relative border-b border-line px-3 py-2">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-5.5 -translate-y-1/2 text-ink-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="記事を探す"
              aria-label="記事を探す"
              className="h-9 w-full rounded-lg border border-line bg-paper pr-3 pl-8 text-sm placeholder:text-ink-muted focus:border-brand focus:bg-surface"
            />
          </div>
          <ul className="max-lg:max-h-[24rem] max-lg:overflow-y-auto">
            {list.map((a) => {
              const on = openId === a.id;
              const n = cited.get(a.id) ?? 0;
              return (
                <li key={a.id} className="border-b border-line last:border-b-0">
                  <button
                    onClick={() => {
                      setOpenId(a.id);
                      if (window.innerWidth < 1024) requestAnimationFrame(() => document.getElementById("article-detail")?.scrollIntoView({ behavior: "smooth" }));
                    }}
                    aria-current={on ? "true" : undefined}
                    className={cx("relative block w-full py-3 pr-4 pl-5 text-left", on ? "bg-brand-soft" : "hover:bg-paper")}
                  >
                    {on && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-brand" />}
                    <span className={cx("font-serif text-[15px] leading-snug", on ? "font-bold text-brand" : "text-ink")}>{a.title}</span>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-muted">
                      <span>{CATEGORY_LABEL[a.category]}</span>
                      <span className="ml-auto tabular-nums">{n > 0 ? `根拠に ${n}回` : a.keywords.length ? "根拠に 0回" : "毎回AIに渡す"}</span>
                    </div>
                  </button>
                </li>
              );
            })}
            {list.length === 0 && <li className="px-6 py-10 text-center text-sm text-ink-muted">該当する記事はありません。言葉を変えてみてください。</li>}
          </ul>
        </Card>
        {open && (
          <Card className="scroll-mt-28" id="article-detail">
            <article className="px-6 py-6 sm:px-10 sm:py-8">
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                <Badge>{CATEGORY_LABEL[open.category]}</Badge>
                <span className="tabular-nums">最終更新 {formatDateJa(open.updatedAt)}</span>
                <span className="ml-auto flex items-center gap-1">
                  <Icon name="check" className="size-3.5 text-good" />
                  返信の根拠に {cited.get(open.id) ?? 0}回
                </span>
              </div>
              <h2 className="mt-4 font-serif text-2xl leading-snug font-bold">{open.title}</h2>
              <p className="mt-5 max-w-[40em] font-serif text-[15px] leading-[2] whitespace-pre-wrap text-ink">{open.body}</p>
              {open.keywords.length > 0 ? (
                <div className="mt-8 border-t border-line pt-4">
                  <p className="text-xs text-ink-muted">この記事を探す手がかりにする言葉</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {open.keywords.map((k) => (
                      <Badge key={k}>{k}</Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-8 flex items-center gap-1.5 border-t border-line pt-4 text-xs text-ink-muted">
                  <Icon name="book" className="size-3.5" />
                  すべての返信で守るルールとして、毎回AIに渡しています。
                </p>
              )}
            </article>
          </Card>
        )}
      </div>
    </div>
  );
}
