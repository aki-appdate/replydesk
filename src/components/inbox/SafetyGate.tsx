// 送信前の3つの関門（根拠・言い回し・判断）を、記号と文章で見せる部品。
// 判定そのものは lib（checkCitations / findRiskyPhrases / detectEscalation）の結果をそのまま使い、ここでは表示だけを担う。

import type { CheckedCitation } from "@/lib/text";
import { cx, Icon } from "../ui";

type State = "pass" | "stop" | "caution" | "none";

const STYLE: Record<State, { icon: "check" | "stop" | "alert" | "cross" | "user" | "minus"; mark: string; text: string; word: string }> = {
  pass: { icon: "check", mark: "bg-good text-white", text: "text-ink", word: "OK" },
  stop: { icon: "stop", mark: "bg-bad text-white", text: "text-bad", word: "止まる" },
  caution: { icon: "alert", mark: "bg-warn text-white", text: "text-warn", word: "要確認" },
  none: { icon: "minus", mark: "border border-line-strong bg-surface text-ink-muted", text: "text-ink-soft", word: "対象外" },
};

export type GateInput = {
  /** AIの案がないとき（自分で書く）は null */
  citations: CheckedCitation[] | null;
  risky: { match: string; reason: string; severity: "stop" | "caution" }[];
  escalation: { needed: boolean; reason: string | null };
  isSv: boolean;
};

export function gateStates({ citations, risky, escalation, isSv }: GateInput) {
  const invalid = citations?.filter((c) => !c.valid).length ?? 0;
  const evidence: { state: State; detail: string } =
    citations === null
      ? { state: "none", detail: "AIを使わずに書いています。内容はマニュアルで確かめてください。" }
      : citations.length === 0
        ? { state: "none", detail: "引用はありません（回答ではなく、確認・相談の返信です）。" }
        : invalid > 0
          ? { state: "caution", detail: `${citations.length}件中${invalid}件がマニュアルで確認できません。返信から外すか、確かめてください。` }
          : { state: "pass", detail: `${citations.length}件すべて、マニュアルにある文と一致しました。` };
  const stops = risky.filter((r) => r.severity === "stop").length;
  const wording: { state: State; detail: string } = stops
    ? { state: "stop", detail: `約束してはいけない言い回しが${stops}件あります。直すまで送信できません。` }
    : risky.length
      ? { state: "caution", detail: `返金・補償を約束する文が${risky.length}件あります。SVとして判断した内容か確かめてから送ってください。` }
      : { state: "pass", detail: "返金・補償・「必ず」などの約束する言い回しはありません。" };
  const judge: { state: State; detail: string } = escalation.needed
    ? isSv
      ? { state: "caution", detail: "SVの判断が必要な内容です。判断したうえで送信してください。" }
      : { state: "stop", detail: "担当者だけで判断してはいけない内容です。SVに相談してください。" }
    : { state: "pass", detail: "担当者が返信してよい内容です。" };
  return { evidence, wording, judge };
}

export function SafetyGate(props: GateInput & { className?: string; compact?: boolean }) {
  const g = gateStates(props);
  const rows = [
    { key: "根拠", ...g.evidence },
    { key: "言い回し", ...g.wording },
    { key: "判断", ...g.judge },
  ];
  const blocked = rows.some((r) => r.state === "stop");
  return (
    <div className={cx("rounded-[10px] border", blocked ? "border-bad/40" : "border-line", props.className)}>
      <p className={cx("flex items-center justify-between gap-2 rounded-t-[10px] px-4 py-2 text-xs font-bold", blocked ? "bg-bad-soft text-bad" : "bg-paper text-ink-soft")}>
        <span>送信前の確認</span>
        <span className="font-medium">{blocked ? "止まっている項目があります" : rows.some((r) => r.state === "caution") ? "確かめてから送ってください" : rows.some((r) => r.state === "none") ? "止まっている項目はありません" : "3つの確認を通過しています"}</span>
      </p>
      <ul className="divide-y divide-line">
        {rows.map((r) => {
          const s = STYLE[r.state];
          return (
            <li key={r.key} className={cx("grid grid-cols-[auto_1fr] items-start gap-x-3 px-4", props.compact ? "py-2" : "py-2.5")}>
              <span className={cx("mt-0.5 grid size-5 place-items-center rounded-full", s.mark)}>
                <Icon name={s.icon} className="size-3" />
              </span>
              <div className="min-w-0 text-sm">
                <span className="mr-2 font-bold">{r.key}</span>
                <span className={cx("mr-2 text-xs font-bold", s.text)}>{s.word}</span>
                <span className={cx("block leading-relaxed sm:inline", r.state === "pass" || r.state === "none" ? "text-ink-soft" : s.text)}>{r.detail}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
