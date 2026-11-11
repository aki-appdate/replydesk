"use client";

import { useMemo, useState } from "react";
import { useApp } from "../AppProvider";
import { AiSourceBadge, Badge, btn, Card, CardTitle, cx } from "../ui";
import { draftReply } from "@/lib/ai";
import { detectEscalation } from "@/lib/ai/sample";
import { CATEGORY_LABEL, SENTIMENT_LABEL, URGENCY_LABEL } from "@/lib/labels";
import { checkCitations, findRiskyPhrases } from "@/lib/text";
import type { AiSource, Article, Inquiry, Reply, ReplyDraft } from "@/lib/types";

type Phase = "idle" | "drafting" | "review" | "sending";

export function ReplyComposer({ inquiry, matches, onSending, onNext }: { inquiry: Inquiry; matches: Article[]; onSending: () => void; onNext: () => void }) {
  const { me, articles, saveReply } = useApp();
  const [phase, setPhase] = useState<Phase>("idle");
  const [draft, setDraft] = useState<ReplyDraft | null>(null);
  const [body, setBody] = useState("");
  const [source, setSource] = useState<AiSource>("sample");
  const [note, setNote] = useState<string | undefined>();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const citations = useMemo(() => (draft ? checkCitations(draft.citations, articles) : []), [draft, articles]);
  const risky = useMemo(() => findRiskyPhrases(body), [body]);
  const invalidCount = citations.filter((c) => !c.valid).length;
  // SVは相談を受ける側なので、相談が必要な内容でも最終判断して送れる
  const isSv = me?.role === "sv";
  // 「自分で書く」を選んでも、問い合わせの本文からSV相談が必要かを必ず判定する（AIの案の有無に左右されない）
  const ruleEscalation = useMemo(() => detectEscalation(`${inquiry.subject}\n${inquiry.body}`), [inquiry]);
  const escalation = draft?.escalation.needed ? draft.escalation : ruleEscalation;
  const blockedByEscalation = escalation.needed && !isSv;

  async function runAi() {
    setPhase("drafting");
    setError(null);
    const r = await draftReply(inquiry, articles);
    setDraft(r.value);
    setBody(r.value.reply);
    setSource(r.source);
    setNote(r.note);
    setPhase("review");
  }

  function writeManually() {
    setDraft(null);
    setBody(`${inquiry.playerName} 様\n\nほしぞらテイルズ サポート窓口です。お問い合わせいただき、ありがとうございます。\n\n\n\n引き続き、ほしぞらテイルズをよろしくお願いいたします。`);
    setPhase("review");
  }

  async function submit(kind: Reply["kind"]) {
    if (!me) return;
    onSending();
    setPhase("sending");
    setError(null);
    const reply: Reply = {
      id: `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      inquiryId: inquiry.id,
      staffId: me.id,
      at: new Date().toISOString(),
      kind,
      body: body.trim(),
      aiDraft: draft?.reply ?? null,
      aiSource: draft ? source : null,
      category: draft?.category ?? "other",
      citedArticleIds: [...new Set(citations.filter((c) => c.valid).map((c) => c.articleId))],
      noArticleMatched: matches.length === 0,
    };
    try {
      await saveReply(reply);
      setDone(kind === "sent" ? "返信を送信しました（デモのため実際には送られません）" : "SVに相談しました");
    } catch {
      setError("保存できませんでした。通信状況を確認して、もう一度お試しください。");
      setPhase("review");
    }
  }

  if (done) {
    return (
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <p className="text-sm text-good">✓ {done}</p>
          <button className={btn.primary} onClick={onNext}>
            次の問い合わせへ →
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle aside={draft && <AiSourceBadge source={source} />}>返信を作る</CardTitle>
      <div className="space-y-4 px-5 py-4">
        <div>
          <p className="text-xs font-medium text-ink-soft">参考になりそうなマニュアル</p>
          {matches.length ? (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {matches.map((a) => (
                <li key={a.id}>
                  <Badge>{a.title}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
              近い記事が見つかりません。マニュアルにない質問の可能性があります。推測で答えず、必要ならSVに相談してください。
            </p>
          )}
        </div>

        {(phase === "idle" || phase === "drafting") && (
          <div className="flex flex-wrap gap-2">
            <button className={btn.primary} onClick={runAi} disabled={phase === "drafting"}>
              {phase === "drafting" ? "AIが返信案を作っています…" : "✦ AIで返信案を作る"}
            </button>
            <button className={btn.secondary} onClick={writeManually} disabled={phase === "drafting"}>
              自分で書く
            </button>
          </div>
        )}

        {(phase === "review" || phase === "sending") && (
          <>
            {note && <p className="text-xs text-ink-soft">{note}</p>}

            {escalation.needed && (
              <div className="rounded-lg border border-warn/40 bg-warn-soft p-3 text-sm text-warn">
                <p className="font-medium">⚠ {isSv ? "SVの判断が必要な内容です" : "SVへの相談が必要な内容です"}</p>
                <p className="mt-0.5">{escalation.reason ?? "担当者だけで判断してはいけない内容です。"}</p>
              </div>
            )}

            {draft && (
              <div className="space-y-3 rounded-xl border border-brand/30 bg-brand-soft/40 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium text-ink">AIの見立て</span>
                  <Badge>{CATEGORY_LABEL[draft.category]}</Badge>
                  <Badge tone={draft.urgency === "high" ? "bad" : "neutral"}>{URGENCY_LABEL[draft.urgency]}</Badge>
                  <Badge tone={draft.sentiment === "angry" ? "bad" : "neutral"}>{SENTIMENT_LABEL[draft.sentiment]}</Badge>
                </div>
                <p className="text-sm text-ink">{draft.summary}</p>


                <div>
                  <p className="text-xs font-medium text-ink-soft">
                    根拠にした記事の文
                    {invalidCount > 0 && <span className="ml-2 text-bad">（{invalidCount}件はマニュアルで確認できません）</span>}
                  </p>
                  {citations.length ? (
                    <ul className="mt-1.5 space-y-1.5">
                      {citations.map((c, i) => (
                        <li key={i} className={cx("rounded-lg border px-3 py-2 text-sm", c.valid ? "border-line bg-surface" : "border-bad/40 bg-bad-soft")}>
                          <p className={c.valid ? "text-ink" : "text-bad"}>「{c.quote}」</p>
                          <p className="mt-0.5 text-xs text-ink-muted">
                            {c.valid ? `✓ ${c.articleTitle}` : "✗ この文はマニュアルにありません。返信から外すか、内容を確かめてください"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1.5 text-sm text-ink-muted">根拠にした文はありません（回答ではなく、確認・相談の返信です）。</p>
                  )}
                </div>

                {draft.missingInfo.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-ink-soft">お客さまに確認したいこと</p>
                    <ul className="mt-1 list-inside list-disc text-sm text-ink">
                      {draft.missingInfo.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div>
              <label htmlFor="reply-body" className="text-xs font-medium text-ink-soft">
                返信文（自由に直せます）
              </label>
              <textarea
                id="reply-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                maxLength={2000}
                disabled={phase === "sending"}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm leading-relaxed disabled:bg-canvas"
              />
              {risky.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {risky.map((r) => (
                    <li key={r.match} className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
                      ⚠「{r.match}」— {r.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className={btn.primary}
                disabled={phase === "sending" || !body.trim() || risky.length > 0 || blockedByEscalation}
                onClick={() => submit("sent")}
                title={risky.length ? "注意が必要な表現を直すと送信できます" : blockedByEscalation ? "SVに相談してください" : undefined}
              >
                {phase === "sending" ? "送信しています…" : "確認したので送信する"}
              </button>
              {!isSv && (
                <button className={btn.secondary} disabled={phase === "sending" || !body.trim()} onClick={() => submit("escalated")}>
                  SVに相談する
                </button>
              )}
              <button className={btn.ghost} disabled={phase === "sending"} onClick={() => setPhase("idle")}>
                やり直す
              </button>
            </div>
            {(risky.length > 0 || blockedByEscalation) && (
              <p className="text-xs text-ink-muted">
                {blockedByEscalation ? "担当者の判断で送れない内容のため、SVへの相談だけができます。" : "注意が必要な表現があるため、直すまで送信できません。"}
              </p>
            )}
            {isSv && escalation.needed && <p className="text-xs text-ink-muted">SVとして内容を判断したうえで送信してください。</p>}
          </>
        )}
        {error && <p className="text-sm text-bad">{error}</p>}
      </div>
    </Card>
  );
}
