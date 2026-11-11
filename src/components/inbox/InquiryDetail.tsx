"use client";

import { useMemo, useState } from "react";
import { useApp } from "../AppProvider";
import { AiSourceBadge, Badge, Card, CardTitle } from "../ui";
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
      <Card>
        <div className="px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold">{inquiry.subject}</h2>
            <Badge tone={inquiry.status === "new" ? "brand" : inquiry.status === "escalated" ? "warn" : "good"}>{STATUS_LABEL[inquiry.status]}</Badge>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            {formatDateTimeJa(inquiry.receivedAt)} 受信
            {inquiry.status === "new" && (
              <span className={waitedH > 24 ? "ml-2 font-medium text-bad" : "ml-2"}>（{waitedH < 1 ? "1時間以内" : `${Math.floor(waitedH)}時間経過`}）</span>
            )}
          </p>
          <p className="mt-4 whitespace-pre-wrap leading-relaxed text-ink">{inquiry.body}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-line px-5 py-3 text-sm sm:grid-cols-3">
          <Item label="プレイヤー名" value={inquiry.playerName} />
          <Item label="プレイヤーID" value={inquiry.playerId} />
          <Item label="端末" value={inquiry.device} />
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

      {thread.length > 0 && (
        <Card>
          <CardTitle>対応の記録</CardTitle>
          <ol className="divide-y divide-line">
            {thread.map((r) => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  <span className="tabular-nums">{formatDateTimeJa(r.at)}</span>
                  <span>{staff.find((s) => s.id === r.staffId)?.name}</span>
                  <Badge tone={r.kind === "sent" ? "good" : "warn"}>{r.kind === "sent" ? "返信を送信" : "SVに相談"}</Badge>
                  {r.aiSource && <AiSourceBadge source={r.aiSource} />}
                </div>
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-canvas p-3 text-sm leading-relaxed">{r.body}</p>
                {r.citedArticleIds.length > 0 && (
                  <p className="mt-2 text-xs text-ink-soft">
                    根拠：{r.citedArticleIds.map((id) => articles.find((a) => a.id === id)?.title).filter(Boolean).join("、")}
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

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 break-all text-ink">{value}</dd>
    </div>
  );
}
