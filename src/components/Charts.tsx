"use client";

import { cx } from "./ui";

// グラフの決まり（docs/design.md）：1系列は1色。一番大きい棒だけ紺、残りは薄い紺で「どれが一番か」を見せる。
// 棒は24px以下で先端だけ4px丸め。値の文字は文字色で書く。「表で見る」で同じ数字を表でも読める。

/** 横棒：分類の内訳など。値は棒の先に書く */
export function BarList({ rows, unit = "件", labelWidth = "8.5rem" }: { rows: { label: string; value: number }[]; unit?: string; labelWidth?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0);
  const share = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  return (
    <figure>
      <ul className="space-y-2">
        {rows.map((r, i) => {
          const top = i === 0 && r.value > 0;
          return (
            <li
              key={r.label}
              className="grid items-center gap-3 text-sm"
              style={{ gridTemplateColumns: `minmax(0, ${labelWidth}) 1fr` }}
              title={`${r.label}：${r.value}${unit}（${share(r.value)}%）`}
            >
              <span className={cx("line-clamp-2 leading-snug", top ? "font-bold text-ink" : "text-ink-soft")}>{r.label}</span>
              <div className="flex items-center gap-2">
                <div
                  className={cx("h-3.5 rounded-r-[4px]", top ? "bg-chart" : "bg-chart-muted")}
                  style={{ width: `${(r.value / max) * 80}%`, minWidth: r.value ? 3 : 0 }}
                />
                <span className="text-xs whitespace-nowrap text-ink tabular-nums">
                  {r.value}
                  {unit}
                  {unit === "件" && <span className="ml-1 text-ink-muted">{share(r.value)}%</span>}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <details className="mt-4 text-xs">
        <summary className="cursor-pointer text-ink-muted select-none hover:text-ink">表で見る</summary>
        <table className="mt-2 w-full">
          <thead>
            <tr className="border-b border-line text-left text-ink-muted">
              <th className="py-1 font-medium">項目</th>
              <th className="py-1 text-right font-medium">数</th>
              {unit === "件" && <th className="py-1 text-right font-medium">割合</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-line last:border-0">
                <td className="py-1">{r.label}</td>
                <td className="py-1 text-right tabular-nums">
                  {r.value}
                  {unit}
                </td>
                {unit === "件" && <td className="py-1 text-right tabular-nums">{share(r.value)}%</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
