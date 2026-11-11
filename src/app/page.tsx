"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { Logo } from "@/components/Header";
import { SafetyGate } from "@/components/inbox/SafetyGate";
import { btn, cx, Icon } from "@/components/ui";
import { detectEscalation, sampleReplyDraft } from "@/lib/ai/sample";
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
const DEMO_ESCALATION = "間違えて高いパックを買ってしまいました。まだ使っていないので返金してほしいです。";

const PROBLEMS = [
  { pain: "同じような質問に、毎回ゼロから返信文を書いていて対応が遅れる", answer: "マニュアルの記事を探し、その内容だけを使ってAIが返信案を作ります。担当者は確かめて直すだけです。" },
  { pain: "担当者によって答えがばらつき、返金・補償などの間違った約束をしてしまう", answer: "根拠の文がマニュアルに本当にあるかをコードで照合し、危ない言い回しは送信前に止めます。" },
  { pain: "返金・未成年の課金・利用停止など、担当者が判断してはいけない内容がまぎれる", answer: "該当する問い合わせは「SVに相談」へ回し、担当者からは送信できないようにします。" },
  { pain: "マニュアルにない質問が何か、SVが把握しにくい", answer: "近い記事がなかった問い合わせを集め、AIが「足すべき記事」を根拠の問い合わせつきで提案します。" },
];

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
    // 本文の最後のあいさつの前に、担当者が書き足した一文を入れる
    const closing = lines.findLastIndex((l) => l.startsWith("引き続き"));
    const body = [...lines.slice(0, closing), DEMO_ADDED, "", ...lines.slice(closing)];
    // 見本では、根拠の文から書き足した一文までを見せる（あいさつと確認事項は省く）
    const first = body.findIndex((l) => quotes.has(l));
    const shown = body.slice(Math.max(0, first), body.indexOf(DEMO_ADDED) + 1).filter((l) => quotes.has(l) || l === DEMO_ADDED);
    return { draft, citations, quotes, shown, risky: findRiskyPhrases(body.join("\n")) };
  }, []);
  const escalation = useMemo(() => detectEscalation(DEMO_ESCALATION), []);

  return (
    <div className="bg-canvas">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo size="lg" />
        <Link href="https://github.com/aki-appdate/replydesk" className="text-xs text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-brand">
          ソースコード（GitHub）
        </Link>
      </div>

      <section className="mx-auto grid max-w-6xl gap-12 px-5 pt-6 pb-16 lg:grid-cols-[1fr_30rem] lg:gap-14 lg:pt-12 lg:pb-24">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium tracking-wider text-brand">
            <Icon name="star" className="size-3.5 fill-star text-star" />
            問い合わせ対応のAI返信アシスタント
          </p>
          <h1 className="mt-5 font-serif text-[2rem] leading-[1.35] font-bold tracking-tight sm:text-[2.75rem]">
            <span className="inline-block">AIが書いて、</span>
            <span className="inline-block">人が確かめて、</span>
            <span className="inline-block">送る。</span>
            <br />
            <span className="inline-block text-brand">根拠のある返信だけを。</span>
          </h1>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            スマホゲーム（架空の「ほしぞらテイルズ」）のサポート窓口を想定したデモです。ゲームアプリの問い合わせ対応でSVをしていた筆者が、「返信の質が担当者でばらつく」「間違った約束をしてしまう」という課題に取り組みました。
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <button className={cx(btn.primary, "min-h-12 px-6 text-base")} disabled={!agent} onClick={() => agent && start(agent.id, "/inbox")}>
              担当者として試す
              <Icon name="arrow-right" />
            </button>
            <button className={cx(btn.secondary, "min-h-12 px-6 text-base")} disabled={!sv} onClick={() => sv && start(sv.id, "/insights")}>
              SV（現場リーダー）として試す
            </button>
          </div>
          <p className="mt-4 text-xs text-ink-muted">ログイン不要。データはすべて架空で、いつでも初期化できます。返信は実際には送られません。</p>
        </div>

        {/* 見本：問い合わせ → 返信案 → 送信前の確認 */}
        <figure className="self-start" aria-label="返信案と送信前の確認の例">
          <div className="rounded-[10px] border border-line bg-surface">
            <div className="border-b border-line px-5 py-4">
              <p className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                <Icon name="mail" className="size-3.5" />
                {DEMO_INQUIRY.playerName} さんからの問い合わせ
              </p>
              <p className="mt-1 font-serif font-bold">{DEMO_INQUIRY.subject}</p>
              <p className="mt-1 font-serif text-sm leading-relaxed text-ink-soft">{DEMO_INQUIRY.body}</p>
            </div>
            <div className="px-5 py-4">
              <p className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                <Icon name="sparkle" className="size-3.5 text-brand" />
                AIの返信案（担当者が一文を書き足した状態）
              </p>
              <div className="mt-2 space-y-1 font-serif text-sm leading-[1.85]">
                <p className="text-xs text-ink-muted">（宛名・あいさつ・確認のお願いは省略）</p>
                {demo.shown.map((l, i) =>
                  l === "" ? (
                    <div key={i} className="h-2" />
                  ) : demo.quotes.has(l) ? (
                    <p key={i}>
                      <span className="decoration-good decoration-2 underline-offset-4 underline">{l}</span>
                      <Icon name="check" className="ml-1 inline size-3.5 align-[-2px] text-good" />
                    </p>
                  ) : l === DEMO_ADDED ? (
                    <p key={i}>
                      <span className="bg-bad-soft px-0.5 text-bad decoration-bad decoration-wavy underline-offset-4 underline">{l}</span>
                    </p>
                  ) : (
                    <p key={i} className="text-ink-soft">
                      {l}
                    </p>
                  ),
                )}
              </div>
            </div>
          </div>
          <SafetyGate citations={demo.citations} risky={demo.risky} escalation={demo.draft.escalation} isSv={false} compact className="mt-3 bg-surface" />
          <figcaption className="mt-3 text-[11px] leading-relaxed text-ink-muted">
            AIが使えないときの「見本の返答」（ルールベース）が作った案と、コードによる照合・検知の実際の結果です。
          </figcaption>
        </figure>
      </section>

      <main className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <section aria-labelledby="gates">
            <h2 id="gates" className="font-serif text-2xl font-bold sm:text-[1.75rem]">
              送る前に、3つの確認を通す。
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">AIに任せきりにせず、判定はコードでも行います。どれか1つでも止まれば、担当者は送信できません。</p>
            <ol className="mt-8 grid gap-5 md:grid-cols-3">
              <Gate n={1} icon="check" tone="good" title="根拠" lead="引用した文が、マニュアルに一字一句あるか">
                AIが根拠に挙げた文を記事の本文と照合し、一致すれば ✓、なければ ✗ を付けます。
              </Gate>
              <Gate n={2} icon="stop" tone="bad" title="言い回し" lead="担当者が約束してはいけない言葉がないか">
                「返金します」「補償します」「必ず直ります」などを入力中に検知し、直すまで送信を止めます。
              </Gate>
              <Gate n={3} icon="user" tone="warn" title="判断" lead="担当者が判断してよい内容か">
                {escalation.needed ? (
                  <>
                    例：「{DEMO_ESCALATION.slice(0, 18)}…」→ <b className="font-medium text-warn">{escalation.reason}</b>
                  </>
                ) : (
                  "返金・未成年の課金・利用停止・法的な話は、SVに相談するしか押せません。"
                )}
              </Gate>
            </ol>
          </section>

          <section aria-labelledby="problems" className="mt-20">
            <h2 id="problems" className="font-serif text-2xl font-bold sm:text-[1.75rem]">
              現場の困りごとから、作りました。
            </h2>
            <ol className="mt-8 border-t border-ink/80">
              {PROBLEMS.map((p, i) => (
                <li key={p.pain} className="grid gap-x-8 gap-y-2 border-b border-line py-6 sm:grid-cols-[2.5rem_1fr_1.2fr]">
                  <span className="font-serif text-sm font-bold text-ink-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <p className="text-[15px] leading-relaxed text-ink-soft">{p.pain}</p>
                  <p className="flex gap-3 text-[15px] leading-relaxed font-medium text-ink">
                    <Icon name="arrow-right" className="mt-1 hidden text-brand sm:block" />
                    {p.answer}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="about" className="mt-20 rounded-[10px] border border-line bg-paper">
            <h2 id="about" className="border-b border-line px-6 py-4 font-serif font-bold">
              このアプリについて
            </h2>
            <dl className="grid text-sm sm:grid-cols-2">
              <About label="作った人">ゲームアプリの問い合わせ対応でSVを経験した開発者が、Claude Code（AIコーディングツール）で設計・実装しました。</About>
              <About label="使っている技術">Next.js / React / TypeScript / Tailwind CSS / Firebase（Firestore・匿名認証・AI Logic）/ Gemini / Vercel</About>
              <About label="AIが使えないとき">無料枠の上限や通信エラーのときは、記事の文を組み合わせる「見本の返答」に自動で切り替わり、画面は止まりません。</About>
              <About label="ソースコード">
                <Link className="font-medium text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand" href="https://github.com/aki-appdate/replydesk">
                  GitHubで公開しています
                </Link>
              </About>
            </dl>
          </section>

          <p className="mt-10 text-xs text-ink-muted">デモ版です。ゲーム・プレイヤー・問い合わせなどのデータはすべて架空のものです。</p>
        </div>
      </main>
    </div>
  );
}

function Gate({ n, icon, tone, title, lead, children }: { n: number; icon: "check" | "stop" | "user"; tone: "good" | "bad" | "warn"; title: string; lead: string; children: React.ReactNode }) {
  const mark = { good: "bg-good", bad: "bg-bad", warn: "bg-warn" }[tone];
  return (
    <li className="rounded-[10px] border border-line bg-paper p-5">
      <div className="flex items-center gap-3">
        <span className={cx("grid size-8 place-items-center rounded-full text-white", mark)}>
          <Icon name={icon} className="size-4" />
        </span>
        <p className="font-serif text-lg font-bold">
          <span className="mr-1.5 text-sm text-ink-muted tabular-nums">{n}</span>
          {title}
        </p>
      </div>
      <p className="mt-3 font-medium">{lead}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{children}</p>
    </li>
  );
}

function About({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line px-6 py-4 last:border-b-0 sm:[&:nth-child(odd)]:border-r sm:[&:nth-last-child(-n+2)]:border-b-0">
      <dt className="text-[11px] tracking-wider text-ink-muted">{label}</dt>
      <dd className="mt-1.5 leading-relaxed text-ink-soft">{children}</dd>
    </div>
  );
}
