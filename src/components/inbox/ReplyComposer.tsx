"use client";

import { useMemo, useState } from "react";
import { useApp } from "../AppProvider";
import { AiSourceBadge, Badge, btn, Card, CardTitle, cx, Icon } from "../ui";
import { SafetyGate } from "./SafetyGate";
import { RedCircle, SvTag, ToruNote } from "../proof";
import { draftReply } from "@/lib/ai";
import { detectEscalation } from "@/lib/ai/sample";
import { CATEGORY_LABEL, SENTIMENT_LABEL, URGENCY_LABEL } from "@/lib/labels";
import { checkCitations, findRiskyPhrases } from "@/lib/text";
import type { AiSource, Article, Inquiry, Reply, ReplyDraft } from "@/lib/types";

type Phase = "idle" | "drafting" | "review" | "sending";

/** 「自分で書く」のひな形の行（宛名・あいさつ・結び）。これだけでは送れない */
function templateLines(inquiry: Inquiry): string[] {
  return [`${inquiry.playerName} 様`, "ほしぞらテイルズ サポート窓口です。お問い合わせいただき、ありがとうございます。", "引き続き、ほしぞらテイルズをよろしくお願いいたします。"];
}

export function ReplyComposer({ inquiry, matches, onSending, onNext }: { inquiry: Inquiry; matches: Article[]; onSending: () => void; onNext: () => void }) {
  const { me, articles, saveReply } = useApp();
  const [phase, setPhase] = useState<Phase>("idle");
  const [draft, setDraft] = useState<ReplyDraft | null>(null);
  const [body, setBody] = useState("");
  const [source, setSource] = useState<AiSource>("sample");
  const [note, setNote] = useState<string | undefined>();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // SVは相談を受ける側なので、相談が必要な内容でも最終判断して送れる
  const isSv = me?.role === "sv";
  const citations = useMemo(() => (draft ? checkCitations(draft.citations, articles) : []), [draft, articles]);
  // SVが判断して書く返金・補償は「要確認」、それ以外の危ない言い回しは止める
  const risky = useMemo(() => findRiskyPhrases(body, { isSv }), [body, isSv]);
  const stopped = risky.filter((r) => r.severity === "stop");
  // ひな形（宛名・あいさつ・結び）だけで、本文が書かれていない
  const onlyTemplate = useMemo(() => body.split("\n").every((l) => !l.trim() || templateLines(inquiry).includes(l.trim())), [body, inquiry]);
  const invalidCount = citations.filter((c) => !c.valid).length;
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
    const [greeting, intro, closing] = templateLines(inquiry);
    setBody(`${greeting}\n\n${intro}\n\n\n\n${closing}`);
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
      <Card className="border-good/30">
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <p className="flex items-center gap-2 text-sm font-medium text-good">
            <span className="grid size-6 place-items-center rounded-full bg-good text-white">
              <Icon name="check" className="size-3.5" />
            </span>
            {done}
          </p>
          <button className={btn.primary} onClick={onNext}>
            次の問い合わせへ
            <Icon name="arrow-right" />
          </button>
        </div>
      </Card>
    );
  }

  const sendBlocked = phase === "sending" || onlyTemplate || stopped.length > 0 || blockedByEscalation;

  return (
    <Card>
      <CardTitle aside={draft && <AiSourceBadge source={source} />}>返信を作る</CardTitle>
      <div className="space-y-5 px-5 py-5">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold text-ink-soft">
            <Icon name="book" className="size-3.5" />
            参考になりそうなマニュアル
          </p>
          {matches.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {matches.map((a) => (
                <li key={a.id} className="rounded-md border border-line bg-paper px-2 py-0.5 text-xs text-ink">
                  {a.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 flex gap-2 rounded-lg bg-warn-soft px-3 py-2.5 text-sm leading-relaxed text-warn">
              <Icon name="alert" className="mt-0.5" />
              近い記事が見つかりません。マニュアルにない質問の可能性があります。推測で答えず、必要ならSVに相談してください。
            </p>
          )}
        </div>

        {(phase === "idle" || phase === "drafting") && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
            <button className={btn.primary} onClick={runAi} disabled={phase === "drafting"} aria-busy={phase === "drafting"}>
              <Icon name="nib" className={phase === "drafting" ? "animate-pulse" : undefined} />
              {phase === "drafting" ? "マニュアルを読んで返信案を作っています…" : "AIで返信案を作る"}
            </button>
            <button className={btn.secondary} onClick={writeManually} disabled={phase === "drafting"}>
              自分で書く
            </button>
            <p className="w-full pt-1 text-xs text-ink-muted">どちらの場合も、送る前に「根拠・言い回し・判断」の3つを確かめます。</p>
          </div>
        )}

        {(phase === "review" || phase === "sending") && (
          <>
            {note && <p className="text-xs text-ink-soft">{note}</p>}

            {escalation.needed && (
              <div role="note">
                <SvTag label={isSv ? "SVの判断" : "SVへ"} reason={escalation.reason ?? "担当者だけで判断してはいけない内容です。"}>
                  {isSv ? "SVとして内容を判断したうえで送信してください。" : "担当者からは送信できません。返信の下書きを添えて「SVに相談する」で引き継いでください。"}
                </SvTag>
              </div>
            )}

            {draft && (
              <div className="space-y-4 rounded-[10px] bg-paper p-4">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="mr-1 flex items-center gap-1 font-bold text-ink">
                      <Icon name="nib" className="size-3.5 text-brand" />
                      AIの見立て
                    </span>
                    <Badge>{CATEGORY_LABEL[draft.category]}</Badge>
                    <Badge tone={draft.urgency === "high" ? "bad" : "neutral"}>{URGENCY_LABEL[draft.urgency]}</Badge>
                    <Badge tone={draft.sentiment === "angry" ? "bad" : "neutral"}>{SENTIMENT_LABEL[draft.sentiment]}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink">{draft.summary}</p>
                </div>

                <div>
                  <p className="text-xs font-bold text-ink-soft">
                    根拠にしたマニュアルの文
                    {invalidCount > 0 && <span className="ml-2 text-bad">{invalidCount}件はマニュアルで確認できません</span>}
                  </p>
                  {citations.length ? (
                    <ul className="mt-2 space-y-2">
                      {citations.map((c, i) => (
                        <li key={i} className={cx("rounded-r-lg border-l-[3px] bg-surface py-2 pr-3 pl-3", c.valid ? "border-good" : "border-bad bg-bad-soft")}>
                          <p className={cx("font-serif text-[15px] leading-relaxed", c.valid ? "text-ink" : "text-bad")}>「{c.quote}」</p>
                          <p className={cx("mt-1 flex items-center gap-1 text-xs", c.valid ? "text-good" : "font-bold text-bad")}>
                            <Icon name={c.valid ? "check" : "cross"} className="size-3.5" />
                            {c.valid ? <>マニュアルと一致：{c.articleTitle}</> : "この文はマニュアルにありません。返信から外すか、内容を確かめてください"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-ink-muted">根拠にした文はありません（回答ではなく、確認・相談の返信です）。</p>
                  )}
                </div>

                {draft.missingInfo.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-ink-soft">お客さまに確認したいこと</p>
                    <ul className="mt-1.5 space-y-1 text-sm text-ink">
                      {draft.missingInfo.map((m) => (
                        <li key={m} className="flex gap-2">
                          <span aria-hidden="true" className="mt-2.5 h-px w-2 shrink-0 bg-ink-muted" />
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div>
              <div className="flex items-end justify-between gap-2">
                <label htmlFor="reply-body" className="text-xs font-bold text-ink-soft">
                  返信文<span className="ml-1.5 font-normal text-ink-muted">自由に直せます</span>
                </label>
                <span className="text-[11px] text-ink-muted tabular-nums">{body.length}/2000</span>
              </div>
              <textarea
                id="reply-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                maxLength={2000}
                disabled={phase === "sending"}
                aria-invalid={stopped.length > 0}
                aria-describedby={risky.length ? "risky-list" : undefined}
                className={cx(
                  "mt-1.5 field-sizing-content min-h-72 w-full rounded-lg border bg-surface px-4 py-3 font-serif text-[15px] leading-[1.9] disabled:bg-paper",
                  stopped.length ? "border-bad" : "border-line-strong focus:border-brand",
                )}
              />
              {risky.length > 0 && (
                <div id="risky-list" aria-live="polite" className={cx("mt-2 rounded-lg border", stopped.length ? "border-bad/30" : "border-warn/30")}>
                  {stopped.length > 0 && (
                    <p className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-bad/20 px-3.5 py-1.5 text-xs text-bad">
                      <span className="font-bold">
                        赤が<span className="tabular-nums">{stopped.length}</span>か所あります
                      </span>
                      <span>丸で囲んだ文を直すか消すと、送信できます</span>
                    </p>
                  )}
                  <ol className="divide-y divide-dashed divide-line-strong">
                    {risky.map((r, i) =>
                      r.severity === "stop" ? (
                        <li key={`${i}-${r.match}`} className="grid grid-cols-[1.25rem_1fr] gap-x-2 px-3.5 py-3 text-sm">
                          <span aria-hidden="true" className="pt-1.5 font-serif text-xs font-bold text-bad tabular-nums">
                            {risky.length > 1 ? i + 1 : ""}
                          </span>
                          <div className="min-w-0">
                            <RedCircle block className="font-serif text-bad">「{r.match}」</RedCircle>
                            <ToruNote reason={r.reason} className="mt-1.5 flex text-[13px]" />
                          </div>
                        </li>
                      ) : (
                        <li key={`${i}-${r.match}`} className="grid grid-cols-[1.25rem_1fr] gap-x-2 bg-warn-soft px-3.5 py-3 text-sm text-warn">
                          <span aria-hidden="true" className="pt-0.5 font-serif text-xs font-bold tabular-nums">
                            {risky.length > 1 ? i + 1 : ""}
                          </span>
                          <div className="min-w-0">
                            <p className="font-serif">「{r.match}」</p>
                            <p className="mt-1 flex items-start gap-1.5 text-[13px]">
                              <Icon name="alert" className="mt-0.5 size-3.5 shrink-0" />
                              {r.reason}
                            </p>
                          </div>
                        </li>
                      ),
                    )}
                  </ol>
                </div>
              )}
            </div>

            <SafetyGate citations={draft ? citations : null} risky={risky} escalation={escalation} isSv={isSv} waiting={onlyTemplate ? "本文を書くと送信できます" : undefined} />

            <div className="grid grid-cols-[1fr_auto] items-center gap-2 sm:flex sm:flex-wrap">
              <button
                className={cx(btn.primary, "max-sm:col-span-2")}
                disabled={sendBlocked}
                onClick={() => submit("sent")}
                title={stopped.length ? "注意が必要な表現を直すと送信できます" : blockedByEscalation ? "SVに相談してください" : onlyTemplate ? "本文を書くと送信できます" : undefined}
              >
                <Icon name="send" />
                {phase === "sending" ? "送信しています…" : "確認したので送信する"}
              </button>
              {!isSv && (
                <button
                  className={cx(btn.secondary, blockedByEscalation && "border-warn text-warn hover:border-warn hover:text-warn")}
                  disabled={phase === "sending" || onlyTemplate}
                  title={onlyTemplate ? "本文を書くと相談できます" : undefined}
                  onClick={() => submit("escalated")}
                >
                  <Icon name="user" />
                  SVに相談する
                </button>
              )}
              <button className={btn.ghost} disabled={phase === "sending"} onClick={() => setPhase("idle")}>
                やり直す
              </button>
            </div>
            {(stopped.length > 0 || blockedByEscalation || onlyTemplate) && (
              <p className="text-xs text-ink-muted">
                {onlyTemplate
                  ? blockedByEscalation
                    ? "担当者の判断で送れない内容です。宛名と結びのあいだに状況を書くと、SVに相談できます。"
                    : "宛名と結びのあいだに、お客さまへの本文を書くと送信できます。"
                  : blockedByEscalation
                  ? "担当者の判断で送れない内容のため、SVへの相談だけができます。"
                  : stopped.length > 0
                    ? "注意が必要な表現があるため、直すまで送信できません。"
                    : "宛名と結びのあいだに、お客さまへの本文を書くと送信できます。"}
              </p>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="flex items-center gap-2 text-sm text-bad">
            <Icon name="alert" />
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}
