// 校正の記号。ReplyDesk の「安全のしるし」を、赤ペンの校正のように見せる部品。
// 根拠＝緑の ✓／言い回し＝赤の丸囲みと「トル」／判断＝「SVへ」の札。
// 判定そのものはしない（lib の checkCitations / findRiskyPhrases / detectEscalation の結果を受け取って描くだけ）。

import { cx, Icon } from "./ui";

/**
 * 赤ペンの丸囲み。手で引いたように、線の始まりと終わりを少しずらす。
 * block：2行以上になる文は、余白をとって段落ごと囲む（文字に線がかからない）
 */
export function RedCircle({ children, className, block = false }: { children: React.ReactNode; className?: string; block?: boolean }) {
  return (
    <span className={cx("relative", block ? "block w-fit max-w-full px-3 py-1.5" : "inline-block", className)}>
      {children}
      <svg
        aria-hidden="true"
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="pointer-events-none absolute overflow-visible"
        style={block ? { inset: 0, width: "100%", height: "100%" } : { left: -10, top: -5, width: "calc(100% + 20px)", height: "calc(100% + 10px)" }}
      >
        <path
          d={block ? "M9 1.5C40 0 88 0 97 4c3 6 3 26-1 33-25 3-70 3-92 1C1 31 0 10 2 5c2-3 10-4 22-4" : "M12 6C36 0 84 1 96 12c6 10-8 25-46 26C15 39 0 30 3 19 5 11 18 5 36 3"}
          fill="none"
          strokeWidth={1.75}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="stroke-bad"
        />
      </svg>
    </span>
  );
}

/** 赤ペンのメモ。「トル」は校正で「この部分を削る」の記号 */
export function ToruNote({ reason, className }: { reason: string; className?: string }) {
  return (
    <span className={cx("inline-flex items-start gap-1.5 text-bad", className)}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 19C11 19 6 15 5 6" />
        <path d="m2 9 3-3.5L8.5 8" />
      </svg>
      <span>
        <b className="mr-1.5 font-serif font-bold tracking-widest">トル</b>
        <span className="font-medium">{reason}</span>
      </span>
    </span>
  );
}

/** 根拠の ✓ と、どの記事と一致したか */
export function MatchNote({ title, className }: { title: string; className?: string }) {
  return (
    <span className={cx("inline-flex items-start gap-1 text-good", className)}>
      <Icon name="check" className="mt-[3px] size-3.5" />
      <span>
        マニュアル「<span className="font-medium">{title}</span>」と一字一句一致
      </span>
    </span>
  );
}

/** 「SVへ」の札。担当者が判断してはいけない内容に貼る。上の帯はのり代 */
export function SvTag({ reason, children, className }: { reason: string | null; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-[3px] border-t-[5px] border-warn bg-warn-soft px-3.5 py-3 text-warn", className)}>
      <p className="flex items-center gap-1.5 font-serif text-base font-bold">
        <Icon name="user" className="size-4" />
        SVへ
      </p>
      {reason && <p className="mt-1 text-sm font-medium">{reason}</p>}
      {children && <div className="mt-1 text-sm leading-relaxed">{children}</div>}
    </div>
  );
}
