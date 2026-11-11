"use client";

import { useMemo, useState } from "react";
import { useApp } from "../AppProvider";
import { AiSourceBadge, Badge, Card, CardTitle, cx, Icon } from "../ui";
import { STATUS_LABEL } from "@/lib/labels";
import { formatDateTimeJa } from "@/lib/dates";
import { searchArticles } from "@/lib/text";
import type { Inquiry } from "@/lib/types";
import { ReplyComposer } from "./ReplyComposer";
import { useNow } from "../useNow";

export function InquiryDetail({ inquiry, onSending, onNext }: { inquiry: Inquiry; onSending: () => void; onNext: () => void }) {
  const { replies, staff, articles, me } = useApp();
  const now = useNow();
  // 保存すると状態が変わって返信欄の表示条件から外れるため、送った直後は返信欄（完了表示）を残す
  const [justSaved, setJustSaved] = useState(false);
  const canCompose = inquiry.status === "new" || (inquiry.status === "escalated" && me?.role === "sv");
  const thread = useMemo(() => replies.filter((r) => r.inquiryId === inquiry.id), [replies, inquiry.id]);
  const matches = useMemo(() => searchArticles(`${inquiry.subject}\n${inquiry.body}`, articles), [inquiry, articles]);
  const waitedH = (now - new Date(inquiry.receivedAt).getTime()) / 3600000;

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="px-5 pt-5 pb-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
            <span className="flex items-center gap-1">
              <Icon name="mail" className="size-3.5" />
              <span className="tabular-nums">{formatDateTimeJa(inquiry.receivedAt)}</span> 受信
            </span>
            {inquiry.status === "new" && (
              <span className={cx("flex items-center gap-1", waitedH > 24 ? "font-bold text-bad" : "")}>
                <Icon name="clock" className="size-3.5" />
                {waitedH < 1 ? "1時間以内" : `${Math.floor(waitedH)}時間経過`}
                {waitedH > 24 && "（目標の24時間を超えています）"}
              </span>
            )}
            <Badge tone={inquiry.status === "new" ? "brand" : inquiry.status === "escalated" ? "warn" : "good"} className="ml-auto">
              {STATUS_LABEL[inquiry.status]}
            </Badge>
          </div>
          <h2 className="mt-3 font-serif text-xl leading-snug font-bold">{inquiry.subject}</h2>
          <p className="mt-3 font-serif text-[15px] leading-[1.9] whitespace-pre-wrap text-ink">{inquiry.body}</p>
        </div>
        <dl className="grid grid-cols-2 border-t border-line bg-paper text-sm sm:grid-cols-3">
          <Item label="プレイヤー名" value={inquiry.playerName} />
          <Item label="プレイヤーID" value={inquiry.playerId} mono />
          <Item label="端末" value={inquiry.device} className="max-sm:col-span-2" />
        </dl>
      </Card>

      {(canCompose || justSaved) && (
        <ReplyComposer
          inquiry={inquiry}
          matches={matches.map((m) => m.article)}
          onSending={() => {
            setJustSaved(true);
            onSending();
          }}
          onNext={onNext}
        />
      )}

      {!canCompose && !justSaved && inquiry.status === "escalated" && (
        <p className="flex items-center gap-2 rounded-[10px] border border-warn/30 bg-warn-soft px-5 py-3 text-sm text-warn">
          <Icon name="user" />
          SVが判断して返信します。SVに切り替えると、この問い合わせに返信できます。
        </p>
      )}

      {thread.length > 0 && (
        <Card>
          <CardTitle>対応の記録</CardTitle>
          <ol className="divide-y divide-line">
            {thread.map((r) => (
              <li key={r.id} className="px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  <Badge tone={r.kind === "sent" ? "good" : "warn"}>
                    <Icon name={r.kind === "sent" ? "send" : "user"} className="size-3" />
                    {r.kind === "sent" ? "返信を送信" : "SVに相談"}
                  </Badge>
                  <span className="tabular-nums">{formatDateTimeJa(r.at)}</span>
                  <span>{staff.find((s) => s.id === r.staffId)?.name}</span>
                  {r.aiSource && <AiSourceBadge source={r.aiSource} />}
                </div>
                <p className="mt-2.5 rounded-lg border border-line bg-paper px-4 py-3 font-serif text-sm leading-[1.9] whitespace-pre-wrap">{r.body}</p>
                {r.citedArticleIds.length > 0 && (
                  <p className="mt-2 flex items-start gap-1 text-xs text-good">
                    <Icon name="check" className="mt-px size-3.5" />
                    <span>
                      根拠（マニュアルと一致）：
                      <span className="text-ink-soft">{r.citedArticleIds.map((id) => articles.find((a) => a.id === id)?.title).filter(Boolean).join("、")}</span>
                    </span>
                  </p>
                )}
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

function Item({ label, value, mono, className }: { label: string; value: string; mono?: boolean; className?: string }) {
  return (
    <div className={cx("px-5 py-2.5 sm:px-6 max-sm:[&:nth-child(-n+2)]:border-b max-sm:[&:nth-child(-n+2)]:border-line", className)}>
      <dt className="text-[11px] text-ink-muted">{label}</dt>
      <dd className={cx("mt-0.5 [overflow-wrap:anywhere] text-ink", mono && "tabular-nums")}>{value}</dd>
    </div>
  );
}
