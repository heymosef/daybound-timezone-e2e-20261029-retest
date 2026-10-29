import { useLayoutEffect, type RefObject } from "react";

/** Update CSS masks directly: scrolling never causes a React render. */
export function useScrollFade(ref: RefObject<HTMLElement>, axis: "x" | "y", enabled = true) {
  useLayoutEffect(() => {
    const viewport = ref.current;
    if (!viewport || !enabled) return;

    const setEdge = (edge: string, more: boolean) => {
      const key = `--scroll-fade-${edge}`;
      const value = more ? "16px" : "0px";
      if (viewport.style.getPropertyValue(key) !== value) viewport.style.setProperty(key, value);
    };
    const measure = () => {
      if (axis === "x") {
        const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
        const rtl = getComputedStyle(viewport).direction === "rtl";
        const left = Math.min(max, Math.max(0, rtl ? max + viewport.scrollLeft : viewport.scrollLeft));
        setEdge("left", left > 1);
        setEdge("right", max - left > 1);
      } else {
        const max = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
        const top = Math.min(max, Math.max(0, viewport.scrollTop));
        setEdge("top", top > 1);
        setEdge("bottom", max - top > 1);
      }
    };
    const resize = new ResizeObserver(measure);
    const observeContent = () => {
      resize.disconnect();
      resize.observe(viewport);
      for (const child of viewport.children) resize.observe(child);
      measure();
    };
    // Results may shrink, grow or replace the empty-state element without resizing the viewport.
    const mutations = new MutationObserver(observeContent);
    mutations.observe(viewport, { childList: true, subtree: true, characterData: true });
    viewport.addEventListener("scroll", measure, { passive: true });
    observeContent();
    return () => {
      viewport.removeEventListener("scroll", measure);
      resize.disconnect();
      mutations.disconnect();
    };
  }, [ref, axis, enabled]);
}
