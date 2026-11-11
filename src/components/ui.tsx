// 小さな見た目の部品。ボタン・バッジ・面・アイコンの見た目をここで統一する。
// 方針は docs/design.md（生成りの紙に夜空の紺・手紙は明朝・安全のしるしは記号と文章つき）。

import type { AiSource } from "@/lib/types";

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(" ");
}

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed";

export const btn = {
  primary: `${base} min-h-10 bg-brand px-4 py-2 text-white hover:bg-brand-strong disabled:bg-line-strong disabled:text-surface`,
  secondary: `${base} min-h-10 border border-line-strong bg-surface px-4 py-2 text-ink hover:border-brand hover:text-brand disabled:text-ink-muted disabled:hover:border-line-strong`,
  ghost: `${base} px-2.5 py-1.5 text-ink-soft hover:bg-brand-soft hover:text-brand disabled:text-ink-muted`,
};

export function Card({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cx("rounded-[10px] border border-line bg-surface", className)}>
      {children}
    </section>
  );
}

export function CardTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-5 py-3">
      <h2 className="font-serif text-[15px] font-bold text-ink">{children}</h2>
      {aside}
    </div>
  );
}

type Tone = "neutral" | "brand" | "good" | "warn" | "bad";
const TONE: Record<Tone, string> = {
  neutral: "bg-canvas text-ink-soft",
  brand: "bg-brand-soft text-brand",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
};

export function Badge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-px text-xs leading-5 font-medium", TONE[tone], className)}>
      {children}
    </span>
  );
}

export function AiSourceBadge({ source, onDark = false }: { source: AiSource; onDark?: boolean }) {
  return (
    <span
      title={source === "gemini" ? "Gemini が返答しています" : "AIが使えないため、ルールベースの見本の返答で動いています"}
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-px text-xs leading-5",
        onDark ? "border-white/20 text-white/80" : "border-line-strong text-ink-soft",
      )}
    >
      <Icon name="sparkle" className="size-3.5" />
      {source === "gemini" ? "AI：Gemini" : "AI：見本の返答"}
    </span>
  );
}

export function pct(n: number): string {
  return `${(Math.round(n * 1000) / 10).toFixed(1)}%`;
}

// ---- アイコン（インラインSVG・線の太さ 1.75 で統一） ----

type IconName =
  | "sparkle"
  | "check"
  | "cross"
  | "stop"
  | "user"
  | "alert"
  | "book"
  | "send"
  | "search"
  | "reset"
  | "arrow-right"
  | "clock"
  | "star"
  | "mail";

const PATHS: Record<IconName, React.ReactNode> = {
  sparkle: <path d="M12 4c.6 3.8 2.2 5.4 6 6-3.8.6-5.4 2.2-6 6-.6-3.8-2.2-5.4-6-6 3.8-.6 5.4-2.2 6-6Z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  cross: <path d="M7 7l10 10M17 7 7 17" />,
  stop: (
    <>
      <path d="M8.5 3h7L21 8.5v7L15.5 21h-7L3 15.5v-7Z" />
      <path d="M8.5 12h7" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5 2.5 20h19L12 3.5Z" />
      <path d="M12 10v4.5M12 17.5v.01" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5Z" />
      <path d="M12 6v13.5" />
    </>
  ),
  send: <path d="M4 12 20 4l-5 16-3-7-8-1Z" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  reset: <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" />,
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  star: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" />,
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cx("size-4 shrink-0", className)}
    >
      {PATHS[name]}
    </svg>
  );
}
