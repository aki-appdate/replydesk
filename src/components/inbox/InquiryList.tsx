"use client";

import { useMemo, useState } from "react";
import { CATEGORY_LABEL, URGENCY_LABEL } from "@/lib/labels";
import { formatDateTimeJa } from "@/lib/dates";
import type { Category, Inquiry, Sentiment, Urgency } from "@/lib/types";
import { Badge, Card, cx } from "../ui";

export type InboxTab = "new" | "escalated" | "sent";

const TABS: { id: InboxTab; label: string }[] = [
  { id: "new", label: "未対応" },
  { id: "escalated", label: "SVに相談中" },
  { id: "sent", label: "返信済み" },
];

type Item = { inquiry: Inquiry; category: Category; sentiment: Sentiment; urgency: Urgency };

export function InquiryList(props: {
  tab: InboxTab;
  onTab: (t: InboxTab) => void;
  counts: Record<InboxTab, number>;
  items: Item[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () => (q ? props.items.filter((t) => `${t.inquiry.subject}${t.inquiry.body}${t.inquiry.playerName}`.includes(q)) : props.items),
    [props.items, q],
  );

  return (
    <Card className="flex max-h-[calc(100vh-14rem)] min-h-80 flex-col overflow-hidden">
      <div className="flex border-b border-line" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={props.tab === t.id}
            onClick={() => props.onTab(t.id)}
            className={cx(
              "flex-1 border-b-2 px-2 py-2.5 text-sm",
              props.tab === t.id ? "border-brand font-medium text-brand-strong" : "border-transparent text-ink-soft hover:text-ink",
            )}
          >
            {t.label}
            <span className="ml-1 text-xs tabular-nums text-ink-muted">{props.counts[t.id]}</span>
          </button>
        ))}
      </div>
      <div className="border-b border-line p-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="件名・本文・プレイヤー名で絞り込み"
          className="w-full rounded-md border border-line px-3 py-1.5 text-sm placeholder:text-ink-muted"
        />
      </div>
      <ul className="flex-1 overflow-y-auto">
        {filtered.map((t) => (
          <li key={t.inquiry.id}>
            <button
              onClick={() => props.onSelect(t.inquiry.id)}
              className={cx("w-full border-b border-line px-4 py-3 text-left hover:bg-canvas", props.selectedId === t.inquiry.id && "bg-brand-soft hover:bg-brand-soft")}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-ink">{t.inquiry.subject}</span>
                {props.tab === "new" && t.urgency !== "mid" && <Badge tone={t.urgency === "high" ? "bad" : "neutral"}>{URGENCY_LABEL[t.urgency]}</Badge>}
              </div>
              <p className="mt-1 line-clamp-1 text-xs text-ink-soft">{t.inquiry.body}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
                <span>{CATEGORY_LABEL[t.category]}</span>
                <span>・{t.inquiry.playerName}</span>
                <span className="ml-auto tabular-nums">{formatDateTimeJa(t.inquiry.receivedAt)}</span>
              </div>
            </button>
          </li>
        ))}
        {filtered.length === 0 && <li className="p-6 text-center text-sm text-ink-muted">該当する問い合わせはありません</li>}
      </ul>
    </Card>
  );
}
