import { useEffect, useRef, useState } from "react";

/** 偵測各長條票數是否剛增加，供標籤彈跳動畫使用。 */
export function useCountBumps(counts: number[]): boolean[] {
  const prevRef = useRef<number[]>([]);
  const [bumps, setBumps] = useState<boolean[]>(() => counts.map(() => false));

  useEffect(() => {
    const prev = prevRef.current;
    const increased = counts.map((c, i) => c > (prev[i] ?? 0) && c > 0);
    prevRef.current = [...counts];

    if (!increased.some(Boolean)) {
      setBumps(counts.map(() => false));
      return;
    }

    setBumps(increased);
    const timer = window.setTimeout(() => {
      setBumps(counts.map(() => false));
    }, 750);
    return () => window.clearTimeout(timer);
  }, [counts.join("|")]);

  return bumps;
}
