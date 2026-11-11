"use client";

// 単一系列のグラフだけなので、色はブランド色1つ。値の文字は文字色で書く。

/** 横棒：分類の内訳など。値は棒の先に書く */
export function BarList({ rows, unit = "件", labelWidth = "8.5rem" }: { rows: { label: string; value: number }[]; unit?: string; labelWidth?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li
          key={r.label}
          className="grid items-center gap-3 text-sm"
          style={{ gridTemplateColumns: `minmax(0, ${labelWidth}) 1fr` }}
          title={`${r.label}：${r.value}${unit}（${total ? Math.round((r.value / total) * 100) : 0}%）`}
        >
          <span className="truncate text-ink-soft">{r.label}</span>
          <div className="flex items-center gap-2">
            <div className="h-4 rounded-r bg-brand" style={{ width: `${(r.value / max) * 85}%`, minWidth: r.value ? 4 : 0 }} />
            <span className="tabular-nums text-xs text-ink">
              {r.value}
              {unit}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
