"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { btn } from "@/components/ui";

const FEATURES = [
  {
    title: "マニュアルを根拠に、返信案をつくる",
    body: "問い合わせに関係する記事をキーワードで探し、その記事だけを材料にAIが返信案を作ります。どの記事のどの文をもとにしたかも表示します。",
  },
  {
    title: "根拠と表現を、コードで確かめる",
    body: "AIが挙げた引用が記事に本当にあるかを照合し、ない場合は警告します。「返金します」「必ず復旧します」など、担当者が約束してはいけない表現も検出します。",
  },
  {
    title: "マニュアルの穴を見つける",
    body: "近い記事がない問い合わせを集め、追加すべき記事をAIが提案します。返信案がどれだけそのまま使われたか（AI採用率）も測れます。",
  },
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

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:py-20">
      <p className="text-sm font-medium text-brand">問い合わせ対応のAI返信アシスタント</p>
      <h1 className="mt-3 text-3xl font-bold leading-tight text-ink sm:text-4xl">
        AIが書いて、人が確かめて、送る。
        <br className="hidden sm:block" />
        根拠のある返信だけを。
      </h1>
      <p className="mt-4 max-w-2xl text-ink-soft">
        ReplyDeskは、スマホゲームのサポート窓口（架空の「ほしぞらテイルズ」）を想定したデモアプリです。問い合わせ対応のSVをしていた経験から、「返信の質が担当者によってばらつく」「マニュアルにない質問に毎回時間がかかる」という課題に取り組みました。
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <button className={btn.primary} disabled={!agent} onClick={() => agent && start(agent.id, "/inbox")}>
          担当者として試す
        </button>
        <button className={btn.secondary} disabled={!sv} onClick={() => sv && start(sv.id, "/insights")}>
          SV（現場リーダー）として試す
        </button>
      </div>
      <p className="mt-3 text-xs text-ink-muted">ログインは不要です。データはすべて架空で、いつでも初期化できます。返信は実際には送信されません。</p>

      <div className="mt-14 grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border border-line bg-surface p-5">
            <h2 className="font-bold text-ink">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-14 rounded-xl border border-line bg-surface p-6">
        <h2 className="font-bold text-ink">このアプリについて</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-ink">作った人</dt>
            <dd className="mt-1 text-ink-soft">ゲームアプリの問い合わせ対応でSVを経験した開発者が、Claude Code（AIコーディングツール）で設計・実装しました。</dd>
          </div>
          <div>
            <dt className="font-medium text-ink">使っている技術</dt>
            <dd className="mt-1 text-ink-soft">Next.js / React / TypeScript / Tailwind CSS / Firebase（Firestore・匿名認証・AI Logic）/ Gemini / Vercel</dd>
          </div>
          <div>
            <dt className="font-medium text-ink">AIが使えないとき</dt>
            <dd className="mt-1 text-ink-soft">無料枠の上限や通信エラーのときは、記事の文を組み合わせる「見本の返答」に自動で切り替わり、画面は止まりません。</dd>
          </div>
          <div>
            <dt className="font-medium text-ink">ソースコード</dt>
            <dd className="mt-1 text-ink-soft">
              <Link className="text-brand underline" href="https://github.com/aki-appdate/replydesk">
                GitHubで公開しています
              </Link>
            </dd>
          </div>
        </dl>
      </div>
    </main>
  );
}
