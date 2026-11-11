"use client";

import { useEffect, useState } from "react";

/** 「何時間経過」の表示用。描画のたびに時刻を読まず、1分ごとに更新する */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
