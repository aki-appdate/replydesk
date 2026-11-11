"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "./AppProvider";
import { AiSourceBadge, btn, cx } from "./ui";

export function Header() {
  const { staff, me, setMe, aiSource, storeKind, resetDemo } = useApp();
  const path = usePathname();
  const router = useRouter();
  const [resetting, setResetting] = useState(false);

  const nav = [
    { href: "/inbox", label: "受信箱", show: true },
    { href: "/knowledge", label: "マニュアル", show: true },
    { href: "/insights", label: "SVダッシュボード", show: true },
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2 font-bold text-ink">
          <span className="grid size-7 place-items-center rounded-lg bg-brand text-sm text-white">R</span>
          ReplyDesk
        </Link>
        <nav className="flex gap-1">
          {nav
            .filter((n) => n.show)
            .map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cx(
                  "rounded-md px-3 py-1.5 text-sm",
                  path.startsWith(n.href) ? "bg-brand-soft font-medium text-brand-strong" : "text-ink-soft hover:bg-canvas",
                )}
              >
                {n.label}
              </Link>
            ))}
        </nav>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <AiSourceBadge source={aiSource} />
          <label className="flex items-center gap-1.5 text-xs text-ink-muted">
            利用者
            <select
              className="rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink"
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
            className={btn.ghost}
            disabled={resetting}
            title={storeKind === "firestore" ? "あなた専用のお試しデータを初期状態に戻します" : "このブラウザのお試しデータを初期状態に戻します"}
            onClick={async () => {
              if (!confirm("送った返信を消して、お試しデータを最初の状態に戻しますか？")) return;
              setResetting(true);
              await resetDemo();
              setResetting(false);
            }}
          >
            {resetting ? "戻しています…" : "データを初期化"}
          </button>
        </div>
      </div>
      <div className="border-t border-line bg-warn-soft/60 px-4 py-1 text-center text-xs text-warn">
        デモ版です。ゲーム・プレイヤー・問い合わせなどのデータはすべて架空のものです。
      </div>
    </header>
  );
}
