"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { InquiryList, type InboxTab } from "@/components/inbox/InquiryList";
import { InquiryDetail } from "@/components/inbox/InquiryDetail";
import { cx, Icon } from "@/components/ui";
import { useNow } from "@/components/useNow";
import { triage } from "@/lib/triage";

export default function InboxPage() {
  const { inquiries, articles, me } = useApp();
  const now = useNow();
  const [tab, setTab] = useState<InboxTab>("new");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const triaged = useMemo(() => inquiries.map((q) => ({ inquiry: q, ...triage(q, articles) })), [inquiries, articles]);
  const lists = useMemo(() => {
    const rank = { high: 0, mid: 1, low: 2 } as const;
    const byStatus = (s: string) => triaged.filter((t) => t.inquiry.status === s);
    return {
      new: byStatus("new").sort((a, b) => rank[a.urgency] - rank[b.urgency] || a.inquiry.receivedAt.localeCompare(b.inquiry.receivedAt)),
      escalated: byStatus("escalated").sort((a, b) => b.inquiry.receivedAt.localeCompare(a.inquiry.receivedAt)),
      sent: byStatus("sent").sort((a, b) => b.inquiry.receivedAt.localeCompare(a.inquiry.receivedAt)),
    };
  }, [triaged]);

  const current = lists[tab];
  const selected = triaged.find((t) => t.inquiry.id === selectedId) ?? current[0] ?? null;
  const urgent = lists.new.filter((t) => t.urgency === "high").length;
  const over24h = lists.new.filter((t) => now - new Date(t.inquiry.receivedAt).getTime() > 24 * 3600 * 1000).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="max-w-xl">
          <h1 className="font-serif text-2xl font-bold">受信箱</h1>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            {me?.name}さん、未対応は急ぎのものから並んでいます。返信案は、根拠を確かめてから送ってください。
          </p>
        </div>
        <dl className="grid w-full grid-cols-2 rounded-[10px] border border-line bg-surface sm:w-auto sm:grid-cols-4">
          <Count label="未対応" value={lists.new.length} />
          <Count label="うち急ぎ" value={urgent} tone={urgent ? "bad" : undefined} note="課金・強い怒りなど" />
          <Count label="24時間以上" value={over24h} tone={over24h ? "bad" : undefined} icon={over24h > 0} note="目標は24時間以内" />
          <Count label="SVに相談中" value={lists.escalated.length} />
        </dl>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,23rem)_1fr]">
        <InquiryList
          tab={tab}
          onTab={(t) => {
            setTab(t);
            setSelectedId(null);
          }}
          counts={{ new: lists.new.length, escalated: lists.escalated.length, sent: lists.sent.length }}
          items={current}
          selectedId={selected?.inquiry.id ?? null}
          onSelect={(id) => {
            setSelectedId(id);
            if (window.innerWidth < 1024) requestAnimationFrame(() => document.getElementById("inquiry-detail")?.scrollIntoView({ behavior: "smooth" }));
          }}
        />
        <div id="inquiry-detail" className="min-w-0 scroll-mt-28">
          {selected ? (
            <InquiryDetail
              // 利用者を切り替えたら作り直す（担当者の「SVに相談しました」をSVの画面に残さない）
              key={`${selected.inquiry.id}:${me?.id ?? ""}`}
              inquiry={selected.inquiry}
              onSending={() => setSelectedId(selected.inquiry.id)}
              onNext={() => {
                setTab("new");
                setSelectedId(null);
              }}
            />
          ) : (
            <div className="rounded-[10px] border border-dashed border-line-strong p-12 text-center">
              <Icon name="mail" className="mx-auto size-6 text-ink-muted" />
              <p className="mt-2 font-serif font-bold">この一覧に問い合わせはありません</p>
              <p className="mt-1 text-sm text-ink-muted">ほかのタブも見てみてください。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Count({ label, value, tone, note, icon }: { label: string; value: number; tone?: "bad"; note?: string; icon?: boolean }) {
  return (
    <div className="border-line px-4 py-2.5 max-sm:[&:nth-child(-n+2)]:border-b max-sm:[&:nth-child(even)]:border-l sm:[&+&]:border-l" title={note}>
      <dt className={cx("flex items-center gap-1 text-xs whitespace-nowrap", tone ? "font-medium text-bad" : "text-ink-muted")}>
        {icon && <Icon name="clock" className="size-3.5" />}
        {label}
      </dt>
      <dd className={cx("mt-0.5 text-2xl leading-tight font-bold", tone && "text-bad")}>
        {value}
        <span className="ml-0.5 text-xs font-medium">件</span>
      </dd>
    </div>
  );
}
