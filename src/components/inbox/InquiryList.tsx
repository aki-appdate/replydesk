"use client";

import { useMemo, useState } from "react";
import { CATEGORY_LABEL, URGENCY_LABEL } from "@/lib/labels";
import { formatDateTimeJa } from "@/lib/dates";
import { detectEscalation } from "@/lib/ai/sample";
import type { Category, Inquiry, Sentiment, Urgency } from "@/lib/types";
import { Card, cx, Icon } from "../ui";

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
    <Card className="flex max-h-[calc(100vh-12rem)] min-h-80 flex-col overflow-hidden max-lg:max-h-[30rem]">
      <div className="flex gap-1 border-b border-line px-2 pt-2" role="tablist" aria-label="問い合わせの一覧">
        {TABS.map((t) => {
          const on = props.tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => props.onTab(t.id)}
              className={cx(
                "relative flex flex-1 items-center justify-center gap-1.5 rounded-t-lg px-2 py-2 text-sm whitespace-nowrap",
                on ? "font-bold text-brand" : "text-ink-soft hover:text-ink",
              )}
            >
              {t.label}
              <span className={cx("rounded-full px-1.5 text-[11px] tabular-nums", on ? "bg-brand text-white" : "bg-canvas text-ink-muted")}>{props.counts[t.id]}</span>
              {on && <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand" />}
            </button>
          );
        })}
      </div>
      <div className="relative border-b border-line px-3 py-2">
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-5.5 -translate-y-1/2 text-ink-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="件名・本文・プレイヤー名で絞り込み"
          aria-label="件名・本文・プレイヤー名で絞り込み"
          className="h-9 w-full rounded-lg border border-line bg-paper pr-3 pl-8 text-sm placeholder:text-ink-muted focus:border-brand focus:bg-surface"
        />
      </div>
      <ul className="flex-1 overflow-y-auto overscroll-contain">
        {filtered.map((t) => {
          const selected = props.selectedId === t.inquiry.id;
          const urgent = props.tab === "new" && t.urgency === "high";
          const needsSv = props.tab === "new" && detectEscalation(`${t.inquiry.subject}\n${t.inquiry.body}`).needed;
          return (
            <li key={t.inquiry.id} className="border-b border-line last:border-b-0">
              <button
                onClick={() => props.onSelect(t.inquiry.id)}
                aria-current={selected ? "true" : undefined}
                className={cx("relative block w-full py-3 pr-4 pl-5 text-left", selected ? "bg-brand-soft" : "hover:bg-paper")}
              >
                {(selected || urgent) && (
                  <span aria-hidden="true" className={cx("absolute inset-y-0 left-0 w-[3px]", selected ? "bg-brand" : "bg-bad")} />
                )}
                <div className="flex items-start justify-between gap-2">
                  <span className="font-serif text-[15px] leading-snug font-bold text-ink">{t.inquiry.subject}</span>
                  <span className="flex shrink-0 gap-1">
                    {urgent && (
                      <span className="rounded-md bg-bad-soft px-1.5 text-[11px] leading-5 font-bold text-bad">{URGENCY_LABEL.high}</span>
                    )}
                    {needsSv && (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-warn-soft px-1.5 text-[11px] leading-5 font-bold text-warn" title="SVへの相談が必要な内容です">
                        <Icon name="user" className="size-3" />
                        SV
                      </span>
                    )}
                    {props.tab === "new" && t.urgency === "low" && (
                      <span className="rounded-md bg-canvas px-1.5 text-[11px] leading-5 text-ink-muted">{URGENCY_LABEL.low}</span>
                    )}
                  </span>
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-ink-soft">{t.inquiry.body}</p>
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-ink-muted">
                  <span className="truncate">
                    {CATEGORY_LABEL[t.category]}・{t.inquiry.playerName}
                  </span>
                  <span className="ml-auto shrink-0 tabular-nums">{formatDateTimeJa(t.inquiry.receivedAt)}</span>
                </div>
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="px-6 py-10 text-center text-sm text-ink-muted">
            {q ? "条件に合う問い合わせはありません。言葉を変えてみてください。" : "この一覧に問い合わせはありません。"}
          </li>
        )}
      </ul>
    </Card>
  );
}
