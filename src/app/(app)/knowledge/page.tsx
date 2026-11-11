"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Badge, Card, cx } from "@/components/ui";
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
      <div>
        <h1 className="text-xl font-bold">マニュアル</h1>
        <p className="mt-1 text-sm text-ink-soft">返信案の根拠になる記事です。AIはここに書かれていることだけを材料に返信案を作ります。</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-line p-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="記事を探す"
              className="w-full rounded-md border border-line px-3 py-1.5 text-sm placeholder:text-ink-muted"
            />
          </div>
          <ul>
            {list.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => {
                    setOpenId(a.id);
                    if (window.innerWidth < 1024) requestAnimationFrame(() => document.getElementById("article-detail")?.scrollIntoView({ behavior: "smooth" }));
                  }}
                  className={cx("w-full border-b border-line px-4 py-3 text-left hover:bg-canvas", openId === a.id && "bg-brand-soft hover:bg-brand-soft")}
                >
                  <span className="font-medium">{a.title}</span>
                  <div className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
                    <span>{CATEGORY_LABEL[a.category]}</span>
                    <span className="ml-auto">返信の根拠 {cited.get(a.id) ?? 0}回</span>
                  </div>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="p-6 text-center text-sm text-ink-muted">該当する記事はありません</li>}
          </ul>
        </Card>
        {open && (
          <Card className="scroll-mt-28" id="article-detail">
            <div className="px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">{open.title}</h2>
                <Badge>{CATEGORY_LABEL[open.category]}</Badge>
              </div>
              <p className="mt-1 text-xs text-ink-muted">最終更新 {formatDateJa(open.updatedAt)}</p>
              <p className="mt-4 whitespace-pre-wrap leading-loose text-ink">{open.body}</p>
              {open.keywords.length > 0 ? (
                <div className="mt-5 border-t border-line pt-4">
                  <p className="text-xs text-ink-muted">この記事を探す手がかりにする言葉</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {open.keywords.map((k) => (
                      <Badge key={k}>{k}</Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-5 border-t border-line pt-4 text-xs text-ink-muted">すべての返信で守るルールとして、毎回AIに渡しています。</p>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
