"use client";

// データ（localStorage または Firestore）を読み終えるまで画面を出さない外枠
import { Header, LogoMark } from "@/components/Header";
import { useApp } from "@/components/AppProvider";
import { Icon } from "@/components/ui";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, error } = useApp();
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 pt-6 pb-16">
        {error ? (
          <div role="alert" className="flex items-start gap-3 rounded-[10px] border border-bad/30 bg-bad-soft p-4 text-sm text-bad">
            <Icon name="alert" className="mt-0.5" />
            <div>
              <p className="font-bold">{error}</p>
              <button className="mt-2 underline underline-offset-4" onClick={() => location.reload()}>
                再読み込みする
              </button>
            </div>
          </div>
        ) : ready ? (
          children
        ) : (
          <div className="py-24 text-center" role="status" aria-live="polite">
            <LogoMark className="mx-auto size-8 animate-pulse" />
            <p className="mt-3 text-sm text-ink-muted">問い合わせとマニュアルを読み込んでいます…</p>
          </div>
        )}
      </main>
    </>
  );
}
