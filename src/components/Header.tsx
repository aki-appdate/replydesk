"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "./AppProvider";
import { AiSourceBadge, cx, Icon } from "./ui";

/** ロゴ：夜空の紺に、星の金 */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className={cx("grid place-items-center rounded-lg bg-brand", size === "lg" ? "size-9" : "size-7")}>
        <Icon name="star" className={cx("fill-star text-star", size === "lg" ? "size-4.5" : "size-3.5")} />
      </span>
      <span className={cx("font-serif font-bold tracking-tight text-ink", size === "lg" ? "text-lg" : "text-base")}>ReplyDesk</span>
    </span>
  );
}

export function Header() {
  const { staff, me, setMe, aiSource, storeKind, resetDemo } = useApp();
  const path = usePathname();
  const router = useRouter();
  const [resetting, setResetting] = useState(false);

  const nav = [
    { href: "/inbox", label: "受信箱" },
    { href: "/knowledge", label: "マニュアル" },
    { href: "/insights", label: "SVダッシュボード" },
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 sm:gap-x-6 pt-2 sm:py-0">
        <Link href="/" className="rounded-lg py-1 sm:py-3" aria-label="ReplyDesk 紹介ページへ">
          <Logo />
        </Link>
        <nav className="order-last -mx-1 flex w-full self-stretch overflow-x-auto sm:order-none sm:mx-0 sm:w-auto" aria-label="画面の切り替え">
          {nav.map((n) => {
            const active = path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "relative flex items-center px-3 py-2.5 text-sm whitespace-nowrap sm:py-0",
                  active ? "font-bold text-brand" : "text-ink-soft hover:text-ink",
                )}
              >
                {n.label}
                {active && <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand" />}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex flex-nowrap items-center justify-end gap-1 sm:gap-2">
          <span className="hidden sm:inline-flex">
            <AiSourceBadge source={aiSource} />
          </span>
          <label className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span className="sr-only sm:not-sr-only">利用者</span>
            <select
              className="h-8 max-w-36 rounded-lg sm:max-w-44 border border-line-strong bg-surface px-2 text-sm text-ink"
              value={me?.id ?? ""}
              onChange={(e) => {
                const next = staff.find((m) => m.id === e.target.value);
                setMe(e.target.value);
                router.push(next?.role === "sv" ? "/insights" : "/inbox");
              }}
            >
              {staff.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}（{m.role === "sv" ? "SV" : "担当者"}）
                </option>
              ))}
            </select>
          </label>
          <button
            className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-ink-soft hover:bg-brand-soft hover:text-brand disabled:opacity-60"
            disabled={resetting}
            title={storeKind === "firestore" ? "あなた専用のお試しデータを初期状態に戻します" : "このブラウザのお試しデータを初期状態に戻します"}
            aria-label="データを初期化"
            onClick={async () => {
              if (!confirm("送った返信を消して、お試しデータを最初の状態に戻しますか？")) return;
              setResetting(true);
              await resetDemo();
              setResetting(false);
            }}
          >
            <Icon name="reset" className="size-3.5" />
            <span className="hidden sm:inline">{resetting ? "戻しています…" : "データを初期化"}</span>
          </button>
        </div>
      </div>
      <p className="border-t border-line bg-paper px-4 py-1 text-center text-[11px] text-ink-muted">
        <span className="sm:hidden">デモ版：データはすべて架空で、返信は送られません</span>
        <span className="hidden sm:inline">デモ版です。ゲーム・プレイヤー・問い合わせなどのデータはすべて架空で、返信も実際には送られません。</span>
      </p>
    </header>
  );
}
