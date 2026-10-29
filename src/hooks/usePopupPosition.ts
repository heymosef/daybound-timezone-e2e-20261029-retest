import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

/** Fixed/portalled popup coordinates, clamped to the visible viewport including zoom. */
export function usePopupPosition(open: boolean, popupRef: RefObject<HTMLElement | null>, anchorRef?: RefObject<HTMLElement | null>) {
  const [position, setPosition] = useState<CSSProperties>({ left: 8, top: 8, width: "min(18em, calc(100vw - 16px))", maxHeight: "calc(100dvh - 16px)" });
  useLayoutEffect(() => {
    const popup = popupRef.current;
    const anchor = anchorRef?.current;
    if (!open || !popup || !anchor) return;
    const measure = () => {
      const viewport = window.visualViewport;
      const x = viewport?.offsetLeft ?? 0;
      const y = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? document.documentElement.clientWidth;
      const height = viewport?.height ?? window.innerHeight;
      const gutter = 8;
      const anchorBounds = anchor.getBoundingClientRect();
      const popupWidth = Math.min(18 * parseFloat(getComputedStyle(popup).fontSize), Math.max(0, width - gutter * 2));
      const maxHeight = Math.max(0, height - gutter * 2);
      const popupHeight = Math.min(popup.scrollHeight + 2, maxHeight);
      const left = Math.max(x + gutter, Math.min(anchorBounds.right - popupWidth, x + width - gutter - popupWidth));
      const below = anchorBounds.bottom + 8;
      const above = anchorBounds.top - 8 - popupHeight;
      const preferred = below + popupHeight <= y + height - gutter ? below : above >= y + gutter ? above : below;
      const top = Math.max(y + gutter, Math.min(preferred, y + height - gutter - popupHeight));
      setPosition(previous => previous.left === left && previous.top === top && previous.width === popupWidth && previous.maxHeight === maxHeight
        ? previous : { left, top, width: popupWidth, maxHeight });
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(anchor);
    resize.observe(popup);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { capture: true, passive: true });
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      resize.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, [open, popupRef, anchorRef]);
  return position;
}
