/** FLIP 列表重排動畫（Slido 風格平滑位移）。 */

import { useLayoutEffect, useRef, type RefObject } from "react";

const FLIP_MS = 320;
const FLIP_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function readItemTops(root: HTMLElement): Map<string, number> {
  const tops = new Map<string, number>();
  root.querySelectorAll<HTMLElement>("[data-flip-id]").forEach((el) => {
    const id = el.dataset.flipId;
    if (id) tops.set(id, el.getBoundingClientRect().top);
  });
  return tops;
}

export function useAutoFlipList(
  listRef: RefObject<HTMLUListElement | null>,
  orderSignature: string
): void {
  const prevTopsRef = useRef<Map<string, number>>(new Map());
  const isFirstRef = useRef(true);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const nextTops = readItemTops(list);

    if (isFirstRef.current) {
      isFirstRef.current = false;
      prevTopsRef.current = nextTops;
      return;
    }

    const prevTops = prevTopsRef.current;
    if (prefersReducedMotion()) {
      prevTopsRef.current = nextTops;
      return;
    }

    list.querySelectorAll<HTMLElement>("[data-flip-id]").forEach((el) => {
      const id = el.dataset.flipId;
      if (!id) return;
      const prevTop = prevTops.get(id);
      const nextTop = nextTops.get(id);
      if (prevTop === undefined || nextTop === undefined) return;

      const deltaY = prevTop - nextTop;
      if (Math.abs(deltaY) < 2) return;

      el.style.transform = `translateY(${deltaY}px)`;
      el.style.transition = "none";
      el.style.willChange = "transform";

      requestAnimationFrame(() => {
        el.style.transition = `transform ${FLIP_MS}ms ${FLIP_EASING}`;
        el.style.transform = "";

        const onEnd = (ev: TransitionEvent) => {
          if (ev.propertyName !== "transform") return;
          el.style.transition = "";
          el.style.willChange = "";
          el.removeEventListener("transitionend", onEnd);
        };
        el.addEventListener("transitionend", onEnd);
      });
    });

    prevTopsRef.current = nextTops;
  }, [listRef, orderSignature]);
}
