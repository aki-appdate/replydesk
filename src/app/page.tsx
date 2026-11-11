"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { Logo } from "@/components/Header";
import { gateStates } from "@/components/inbox/SafetyGate";
import { MatchNote, RedCircle, SvTag, ToruNote } from "@/components/proof";
import { btn, cx, Icon } from "@/components/ui";
import { detectEscalation, sampleReplyDraft } from "@/lib/ai/sample";
import { formatDateTimeJa } from "@/lib/dates";
import { ARTICLES } from "@/lib/knowledge";
import { checkCitations, findRiskyPhrases } from "@/lib/text";
import type { Inquiry } from "@/lib/types";

/** 紹介ページの見本に使う問い合わせ（架空） */
const DEMO_INQUIRY: Inquiry = {
  id: "demo",
  receivedAt: "2026-11-10T09:12:00+09:00",
  playerName: "ほしの",
  playerId: "4518788348",
  device: "Pixel 9 / Android 16",
  subject: "課金したのに届かない",
  body: "さっき星のかけらを買ったのに増えていません。もう一回買ったほうがいいですか？",
  status: "new",
};
/** 担当者が書き足してしまった、と想定する一文 */
const DEMO_ADDED = "必ず反映しますので、ご安心ください。";

/** 「よくある返信を、こう直す」の見本（文面はすべて架空）。赤の理由と ✓ は、画面で lib の判定を実際に通して出す */
const CASES = [
  {
    pain: "毎回ゼロから書いて、返信が遅れる",
    inquiry: "さっき星のかけらを買ったのに増えていません。",
    before: "お問い合わせの件、確認いたします。少々お待ちください。",
    beforeNote: "答えが入っていない。調べて書き直すあいだに、お客さまを待たせる",
    after: { kind: "quote", quote: "購入した星のかけらが反映されない場合は、まずアプリを一度終了して再起動してください。", note: "記事の文から案を作るので、担当者は確かめて直すだけ" },
  },
  {
    pain: "担当者によって、間違った約束をしてしまう",
    inquiry: "ガチャの演出中にアプリが落ちました。使った星のかけらはどうなりますか？",
    before: "ご迷惑をおかけしたお詫びとして、星のかけらをお送りします。",
    after: { kind: "quote", quote: "この不具合で引けなかったガチャの星のかけらは消費されず、手元に残っています。", note: "約束ではなく、マニュアルにある事実だけを伝える" },
  },
  {
    pain: "担当者が判断してはいけない話がまぎれる",
    inquiry: "小学生の息子が、私のスマホで勝手に課金していました。",
    before: "今回に限り、返金いたします。",
    after: { kind: "sv" },
  },
  {
    pain: "マニュアルにない質問に、人それぞれ違う答えを返す",
    inquiry: "ニックネームを変えたいです。",
    before: "（Aさん）1回だけ変更できます。／（Bさん）変更はできません。",
    beforeNote: "マニュアルにないので、担当者ごとに推測で答えている",
    after: { kind: "draft" },
  },
] as const;

export default function Home() {
  const { staff, setMe } = useApp();
  const router = useRouter();
  const start = (id: string, to: string) => {
    setMe(id);
    router.push(to);
  };
  const sv = staff.find((s) => s.role === "sv");
  const agent = staff.find((s) => s.role === "agent");

  // 見本：ルールベースの「見本の返答」が実際に作る案と、照合・検知の結果
  const demo = useMemo(() => {
    const draft = sampleReplyDraft(DEMO_INQUIRY, ARTICLES);
    const citations = checkCitations(draft.citations, ARTICLES);
    const quotes = new Set(citations.filter((c) => c.valid).map((c) => c.quote));
    const lines = draft.reply.split("\n");
    const closing = lines.findLastIndex((l) => l.startsWith("引き続き"));
    const body = [...lines.slice(0, closing), DEMO_ADDED, "", ...lines.slice(closing)];
    const quoted = body.filter((l) => quotes.has(l));
    const risky = findRiskyPhrases(body.join("\n"));
    const gates = gateStates({ citations, risky, escalation: draft.escalation, isSv: false });
    return { greeting: lines[0], citations, quoted, risky, gates };
  }, []);

  // 見本の「直す前／直した後」も、実際の判定を通す
  const cases = useMemo(
    () =>
      CASES.map((c) => {
        const risky = findRiskyPhrases(c.before);
        const escalation = detectEscalation(c.inquiry);
        const match =
          c.after.kind === "quote"
            ? (() => {
                const q = c.after.quote;
                const art = ARTICLES.find((a) => a.body.includes(q));
                return art ? checkCitations([{ articleId: art.id, quote: q }], ARTICLES)[0] : null;
              })()
            : null;
        return { ...c, risky, escalation, match };
      }),
    [],
  );
  const firstValid = demo.citations.find((c) => c.valid);

  return (
    <div className="bg-canvas">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo size="lg" />
        <Link href="https://github.com/aki-appdate/replydesk" className="text-xs text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-brand">
          ソースコード（GitHub）
        </Link>
      </div>

      {/* 1. 一枚の校正紙：問い合わせ → AIの下書き → 赤ペン → 送れない */}
      <section className="mx-auto grid max-w-6xl gap-12 px-5 pt-4 pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:gap-14 lg:pt-10 lg:pb-24">
        <div className="lg:pt-6">
          <p className="flex items-center gap-2 text-xs font-medium tracking-wider text-brand">
            <Icon name="nib" className="size-3.5" />
            問い合わせ対応のAI返信アシスタント
          </p>
          <h1 className="mt-5 font-serif text-[1.875rem] leading-[1.45] font-bold tracking-tight sm:text-[2.75rem]">
            <span className="inline-block">AIが下書きした</span>
            <span className="inline-block">返信に、</span>
            <br className="max-sm:hidden" />
            <span className="inline-block">
              送る前に
              <span className="relative inline-block">
                赤を入れる
                <svg aria-hidden="true" viewBox="0 0 100 8" preserveAspectRatio="none" className="absolute -bottom-1 left-0 h-2 w-full overflow-visible">
                  <path d="M1 5C25 2 60 2 99 4" fill="none" strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" className="stroke-bad" />
                </svg>
              </span>
              。
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            根拠の文はマニュアルと一字一句で照合し、約束してはいけない言い回しは止め、担当者が判断してはいけない話はSVへ回します。スマホゲーム（架空の「ほしぞらテイルズ」）のサポート窓口を想定したデモです。
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <button className={cx(btn.primary, "min-h-12 px-6 text-base")} disabled={!agent} onClick={() => agent && start(agent.id, "/inbox")}>
              担当者として返信してみる
              <Icon name="arrow-right" />
            </button>
            <button className={cx(btn.secondary, "min-h-12 px-6 text-base")} disabled={!sv} onClick={() => sv && start(sv.id, "/insights")}>
              SV（現場リーダー）の画面を見る
            </button>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-ink-muted">ログイン不要。データはすべて架空で、いつでも初期化できます。返信は実際には送られません。</p>
        </div>

        <figure className="min-w-0 self-start" aria-label="AIの返信案に、送信前の確認で赤が入った例">
          <div className="rounded-[4px] border border-line-strong bg-surface">
            <p className="flex items-center justify-between gap-3 border-b border-line px-5 py-2 text-[11px] text-ink-muted">
              <span>返信の下書き</span>
              <span className="tabular-nums">{formatDateTimeJa(DEMO_INQUIRY.receivedAt)} 受信</span>
            </p>
            {/* 届いた手紙 */}
            <div className="px-5 pt-4 pb-3">
              <p className="text-[11px] text-ink-muted">{DEMO_INQUIRY.playerName} さんからの問い合わせ</p>
              <p className="mt-0.5 font-serif font-bold">{DEMO_INQUIRY.subject}</p>
              <p className="mt-1.5 border-l-2 border-line-strong pl-3 font-serif text-sm leading-relaxed text-ink-soft">{DEMO_INQUIRY.body}</p>
            </div>
            {/* AIの下書き（便箋）。左の余白に ✓、危ない一文は赤ペンで丸 */}
            <div className="border-t border-dashed border-line-strong px-5 pt-3 pb-1">
              <p className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                <Icon name="nib" className="size-3.5 text-brand" />
                AIの返信案（担当者が一文を書き足したところ）
              </p>
              <div className="ruled mt-1 font-serif text-[15px]">
                <p className="pl-7">{demo.greeting}</p>
                <p className="pl-7 text-xs text-ink-muted">（あいさつは省略）</p>
                {demo.quoted.map((l) => (
                  <p key={l} className="relative pl-7">
                    <Icon name="check" className="absolute top-2 left-0 size-4.5 text-good" />
                    {l}
                  </p>
                ))}
                {firstValid?.articleTitle && (
                  <p className="pl-7 text-xs">
                    <MatchNote title={firstValid.articleTitle} />
                  </p>
                )}
                <div className="relative my-1 pl-4">
                  <span className="absolute top-1.5 left-0.5 font-sans text-[13px] font-bold text-bad" aria-hidden="true">
                    止
                  </span>
                  <RedCircle block className="text-bad">
                    {DEMO_ADDED}
                  </RedCircle>
                </div>
                {demo.risky[0] && (
                  <p className="pl-7 text-[13px] leading-6">
                    <ToruNote reason={demo.risky[0].reason} />
                  </p>
                )}
              </div>
            </div>
            {/* 送信前の確認：3つの記号と、押せない送信ボタン */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line bg-paper px-5 py-3 text-xs">
              <GateMark state={demo.gates.evidence.state} label="根拠" />
              <GateMark state={demo.gates.wording.state} label="言い回し" />
              <GateMark state={demo.gates.judge.state} label="判断" />
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-canvas px-3 py-1.5 font-medium text-ink-muted">
                <Icon name="send" className="size-3.5" />
                直すまで送れません
              </span>
            </div>
          </div>
          <figcaption className="mt-3 text-[11px] leading-relaxed text-ink-muted">
            AIが使えないときの「見本の返答」（ルールベース）が作った案と、コードによる照合・検知の実際の結果です。
          </figcaption>
        </figure>
      </section>

      <main className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          {/* 2. 赤の入れ方（校正記号の凡例） */}
          <section aria-labelledby="marks">
            <h2 id="marks" className="font-serif text-2xl font-bold sm:text-[1.75rem]">
              赤の入れ方は、3つだけ。
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">判定はAIに任せきりにせず、コードでも行います。止まる印がひとつでもあれば、担当者は送信できません。</p>
            <table className="mt-8 w-full border-t-2 border-ink text-left text-sm">
              <thead className="max-md:sr-only">
                <tr className="border-b border-line text-xs text-ink-muted">
                  <th className="w-40 py-2.5 font-medium">印</th>
                  <th className="py-2.5 font-medium">確かめること</th>
                  <th className="py-2.5 font-medium">印がついたら</th>
                </tr>
              </thead>
              <tbody>
                <MarkRow
                  mark={
                    <span className="inline-flex items-center gap-2 font-serif text-base font-bold">
                      <Icon name="check" className="size-5 text-good" />
                      根拠
                    </span>
                  }
                  what="AIが根拠に挙げた文が、マニュアルの本文に一字一句あるか"
                  then="一致すれば ✓、なければ ✗。✗ の文は、人が確かめてから送ります。"
                />
                <MarkRow
                  mark={
                    <span className="inline-flex items-center gap-2 font-serif text-base font-bold">
                      <RedCircle className="px-1 text-bad">トル</RedCircle>
                      <span className="ml-1">言い回し</span>
                    </span>
                  }
                  what="「返金します」「補償します」「必ず直ります」など、担当者が約束してはいけない言葉がないか"
                  then="入力中に見つけて理由を出します。直すまで送信ボタンは押せません。"
                />
                <MarkRow
                  mark={
                    <span className="inline-flex items-center gap-2 font-serif text-base font-bold">
                      <span className="inline-flex items-center gap-1 rounded-[3px] border-t-4 border-warn bg-warn-soft px-2 py-0.5 text-sm text-warn">
                        <Icon name="user" className="size-3.5" />
                        SVへ
                      </span>
                      判断
                    </span>
                  }
                  what="返金・未成年の課金・利用停止・法的な話など、担当者が判断してはいけない内容か"
                  then="担当者は「SVに相談する」しか押せません。SVが判断して返信します。"
                />
              </tbody>
            </table>
          </section>

          {/* 3. 直す前と後の返信 */}
          <section aria-labelledby="cases" className="mt-24">
            <h2 id="cases" className="font-serif text-2xl font-bold sm:text-[1.75rem]">
              よくある返信を、こう直します。
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
              問い合わせ対応のSVをしていたころに困っていたことを、返信の文面で並べました（文面はすべて架空です）。
            </p>
            <ol className="mt-10 space-y-14">
              {cases.map((c, i) => (
                <li key={c.pain} className="grid gap-x-10 gap-y-4 lg:grid-cols-[15rem_1fr]">
                  <div>
                    <p className="font-serif text-sm text-ink-muted tabular-nums">その{i + 1}</p>
                    <h3 className="mt-1 font-serif text-lg leading-snug font-bold">
                      {c.pain.split(/(?<=、)/).map((part) => (
                        <span key={part} className="inline-block">
                          {part}
                        </span>
                      ))}
                    </h3>
                    <p className="mt-3 text-xs text-ink-muted">届いた問い合わせ</p>
                    <p className="mt-1 border-l-2 border-line-strong pl-3 font-serif text-sm leading-relaxed text-ink-soft">{c.inquiry}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[4px] border border-line bg-paper px-5 py-4">
                      <p className="text-[11px] font-bold tracking-wider text-ink-muted">直す前の返信</p>
                      <p className="mt-3 font-serif text-[15px] leading-loose">
                        {c.risky.length ? <RedCircle block className="-mx-3 text-bad">{c.before}</RedCircle> : <span className="text-ink-soft line-through decoration-bad decoration-[1.5px]">{c.before}</span>}
                      </p>
                      <p className="mt-3 text-[13px] leading-relaxed">
                        {c.risky.length ? (
                          <ToruNote reason={c.risky[0].reason} />
                        ) : (
                          "beforeNote" in c && <span className="text-bad">{c.beforeNote}</span>
                        )}
                      </p>
                    </div>
                    <div className="rounded-[4px] border border-line-strong bg-surface px-5 py-4">
                      <p className="text-[11px] font-bold tracking-wider text-brand">ReplyDesk を通すと</p>
                      {c.after.kind === "quote" && c.match && (
                        <>
                          <p className="mt-3 font-serif text-[15px] leading-loose">
                            <span className="underline decoration-good decoration-2 underline-offset-[6px]">{c.after.quote}</span>
                          </p>
                          <p className="mt-3 text-[13px] leading-relaxed">
                            {c.match.valid && c.match.articleTitle && <MatchNote title={c.match.articleTitle} />}
                            <span className="mt-1 block text-ink-soft">{c.after.note}</span>
                          </p>
                        </>
                      )}
                      {c.after.kind === "sv" && (
                        <SvTag reason={c.escalation.reason} className="mt-3 -rotate-[0.6deg]">
                          担当者からは送信できません。SVが内容を判断して返信します。
                        </SvTag>
                      )}
                      {c.after.kind === "draft" && (
                        <div className="sticky-note mt-3 rotate-[0.5deg] px-4 pt-3 pb-5 text-ink">
                          <p className="flex items-center gap-1.5 text-[11px] font-bold text-ink-soft">
                            <Icon name="note" className="size-3.5" />
                            SVの画面に貼られる、記事の下書き
                          </p>
                          <p className="mt-1.5 font-serif font-bold">「プレイヤー名の変更」の記事を追加</p>
                          <p className="mt-1 text-sm leading-relaxed text-ink-soft">近い記事がなかった問い合わせを集め、根拠の問い合わせつきで提案します。</p>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* 4. 奥付 */}
          <section aria-labelledby="colophon" className="mx-auto mt-28 max-w-xl">
            <h2 id="colophon" className="text-center font-serif text-sm tracking-[0.4em] text-ink-muted">
              奥付
            </h2>
            <div className="mt-4 border-y-[3px] border-double border-ink/70 py-6">
              <p className="font-serif text-xl font-bold">ReplyDesk</p>
              <p className="mt-0.5 text-sm text-ink-soft">問い合わせ対応のAI返信アシスタント（デモ版）</p>
              <dl className="mt-5 divide-y divide-line border-t border-line text-sm">
                <Colophon label="作った人">ゲームアプリのメール問い合わせ対応でSVをしていた筆者</Colophon>
                <Colophon label="分担">設計・仕様決め・動作確認は筆者、実装は Claude Code（AIコーディングツール）</Colophon>
                <Colophon label="技術">Next.js / React / TypeScript / Tailwind CSS / Firebase（Firestore・匿名認証・AI Logic）/ Gemini</Colophon>
                <Colophon label="AIが止まったら">記事の文を組み合わせる「見本の返答」に自動で切り替わり、画面は止まりません</Colophon>
                <Colophon label="ソース">
                  <Link className="font-medium text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand" href="https://github.com/aki-appdate/replydesk">
                    GitHubで公開しています
                  </Link>
                </Colophon>
              </dl>
              <p className="mt-5 text-xs leading-relaxed text-ink-muted">※ 登場するゲーム・プレイヤー・問い合わせ・マニュアルは、すべて架空のものです。</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function GateMark({ state, label }: { state: "pass" | "stop" | "caution" | "none"; label: string }) {
  const s = {
    pass: { icon: "check" as const, cls: "text-good", word: "OK" },
    stop: { icon: "stop" as const, cls: "text-bad", word: "止まる" },
    caution: { icon: "alert" as const, cls: "text-warn", word: "要確認" },
    none: { icon: "minus" as const, cls: "text-ink-muted", word: "対象外" },
  }[state];
  return (
    <span className={cx("inline-flex items-center gap-1 font-medium", s.cls)}>
      <Icon name={s.icon} className="size-3.5" />
      <span className="text-ink">{label}</span>
      {s.word}
    </span>
  );
}

function MarkRow({ mark, what, then }: { mark: React.ReactNode; what: string; then: string }) {
  return (
    <tr className="grid gap-2 border-b border-line py-5 md:table-row md:py-0">
      <th scope="row" className="font-normal md:py-6 md:pr-6 md:align-top">
        {mark}
      </th>
      <td className="leading-relaxed text-ink md:py-6 md:pr-8 md:align-top">{what}</td>
      <td className="leading-relaxed text-ink-soft md:py-6 md:align-top">{then}</td>
    </tr>
  );
}

function Colophon({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-3 py-2.5">
      <dt className="text-xs leading-6 text-ink-muted">{label}</dt>
      <dd className="leading-relaxed text-ink-soft">{children}</dd>
    </div>
  );
}
