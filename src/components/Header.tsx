"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "./AppProvider";
import { AiSourceBadge, cx, Icon } from "./ui";

/**
 * ロゴの印：夜空の紺の封筒を、星の金の封蝋で閉じたもの（返信の手紙に、確かめたしるし）。
 * 角丸の箱に星を入れただけの形にはしない。
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cx("shrink-0", className)}>
      <rect x="2.5" y="7" width="27" height="19" rx="2" className="fill-brand" />
      <path d="M3.5 8.2 16 18.2l12.5-10" fill="none" strokeWidth="1.75" strokeLinejoin="round" className="stroke-canvas" />
      <circle cx="16" cy="18.2" r="5.2" className="fill-star stroke-brand" strokeWidth="1.5" />
      <path d="m16 15.1.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3Z" className="fill-brand" />
    </svg>
  );
}

export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark className={size === "lg" ? "size-9" : "size-7"} />
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

  // 利用者の切り替え。スマホ用（透明で重ねる）とPC用で同じものを使う
  const userSelect = (className: string, label?: string) => (
    <select
      className={className}
      aria-label={label}
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
  );

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
            {/*
              スマホでは「小川 さくら（担当…」と切れるので、選択欄の上に「役割の札＋名前」を重ねて見せる。
              押すのは下の本物の select（透明）なので、端末の選択画面と読み上げはそのまま使える。
            */}
            <span className="relative inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface pr-6 pl-1.5 text-ink focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand sm:hidden">
              <span
                aria-hidden="true"
                className={cx(
                  "rounded-[3px] px-1 text-[10px] leading-4 font-bold",
                  me?.role === "sv" ? "border-t-2 border-warn bg-warn-soft text-warn" : "bg-brand-soft text-brand",
                )}
              >
                {me?.role === "sv" ? "SV" : "担当者"}
              </span>
              <span aria-hidden="true" className="max-w-[6.5em] truncate text-[13px] font-medium">
                {me?.name ?? "選ぶ"}
              </span>
              <svg aria-hidden="true" viewBox="0 0 12 12" className="absolute right-2 size-3 text-ink-muted" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 4.5 3 3 3-3" />
              </svg>
              {userSelect("absolute inset-0 size-full cursor-pointer opacity-0", "利用者を切り替える")}
            </span>
            {userSelect("hidden h-8 max-w-44 rounded-lg border border-line-strong bg-surface px-2 text-sm text-ink sm:block", "利用者")}
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
