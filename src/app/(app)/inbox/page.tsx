"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { InquiryList, type InboxTab } from "@/components/inbox/InquiryList";
import { InquiryDetail } from "@/components/inbox/InquiryDetail";
import { Stat } from "@/components/ui";
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
      <div>
        <h1 className="text-xl font-bold">受信箱</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {me?.name}さん、未対応の問い合わせは急ぎのものから並んでいます。AIの返信案は、根拠を確かめてから送ってください。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="未対応" value={lists.new.length} sub="件" />
        <Stat label="うち急ぎ" value={urgent} sub="件（課金・強い怒りなど）" />
        <Stat label="受信から24時間以上" value={<span className={over24h ? "text-bad" : undefined}>{over24h}</span>} sub="件（目標は24時間以内）" />
        <Stat label="SVに相談中" value={lists.escalated.length} sub="件" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
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
        <div id="inquiry-detail" className="scroll-mt-28">
          {selected ? (
            <InquiryDetail
              key={selected.inquiry.id}
              inquiry={selected.inquiry}
              onSending={() => setSelectedId(selected.inquiry.id)}
              onNext={() => {
                setTab("new");
                setSelectedId(null);
              }}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-ink-muted">この一覧に問い合わせはありません。</p>
          )}
        </div>
      </div>
    </div>
  );
}
