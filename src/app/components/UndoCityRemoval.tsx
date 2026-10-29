import "./UndoCityRemoval.css";
import { usePresence } from "motion/react";
import React, { useCallback, useEffect, useLayoutEffect, useRef } from "react";

interface Props {
  token: string;
  city: string;
  onUndo: () => void;
  onExpire: () => void;
  actionRef?: React.Ref<HTMLButtonElement>;
}

/** A single recovery action. The monotonic timer pauses while any reason applies. */
export function UndoCityRemoval({ token, city, onUndo, onExpire, actionRef }: Props) {
  const [isPresent, safeToRemove] = usePresence();
  const notice = useRef<HTMLDivElement>(null);
  const reasons = useRef(new Set<string>());
  const remaining = useRef(5_000);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const expire = useRef(onExpire);
  useLayoutEffect(() => { expire.current = onExpire; }, [onExpire]);
  const stop = useCallback(() => {
    if (timer.current !== undefined) {
      clearTimeout(timer.current);
      timer.current = undefined;
      remaining.current = Math.max(0, remaining.current - (performance.now() - started.current));
    }
  }, []);
  const start = useCallback(() => {
    if (!isPresent || timer.current !== undefined || reasons.current.size) return;
    started.current = performance.now();
    timer.current = setTimeout(() => { timer.current = undefined; expire.current(); }, remaining.current);
  }, [isPresent]);
  const pause = useCallback((reason: string, active: boolean) => {
    if (active) { reasons.current.add(reason); stop(); }
    else { reasons.current.delete(reason); start(); }
  }, [start, stop]);
  useEffect(() => {
    stop();
    remaining.current = 5_000;
    if (document.hidden) reasons.current.add("hidden");
    else reasons.current.delete("hidden");
    start();
    return stop;
  }, [token, start, stop]);
  useLayoutEffect(() => {
    if (notice.current) notice.current.inert = !isPresent;
    if (!isPresent) {
      reasons.current.delete("focus");
      reasons.current.delete("hover");
    }
  }, [isPresent]);
  useEffect(() => {
    if (isPresent) return;
    // Match the CSS exit, with immediate removal when motion is disabled.
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
      safeToRemove?.();
      return;
    }
    const exitTimer = setTimeout(() => safeToRemove?.(), 150);
    return () => clearTimeout(exitTimer);
  }, [isPresent, safeToRemove]);
  useEffect(() => {
    const visibility = () => pause("hidden", document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [pause]);
  return <div className="pointer-events-none fixed left-[max(1rem,env(safe-area-inset-left))] right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-[60] flex justify-end">
    <div ref={notice} role="status" aria-label="Removed city" aria-hidden={!isPresent || undefined} data-undo-notice data-exiting={!isPresent || undefined}
    onPointerEnter={() => pause("hover", true)} onPointerLeave={() => pause("hover", false)}
    onFocus={() => pause("focus", true)}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) pause("focus", false); }}
    className="pointer-events-auto flex min-w-0 max-w-md items-center gap-3 rounded-xl border border-[var(--dt-border-strong)] bg-[var(--dt-search-dropdown)] py-2 pl-4 pr-2 text-sm text-[var(--dt-text)] shadow-lg">
    <span className="min-w-0 truncate" title={city}>{city} removed</span>
    <button ref={actionRef} type="button" disabled={!isPresent} aria-label={`Undo removal of ${city}`} onClick={onUndo}
      className="min-h-10 shrink-0 cursor-pointer rounded-md px-3 py-2 font-medium underline underline-offset-2 hover:bg-[var(--dt-bg-hover)] focus-visible:outline-2 focus-visible:outline-[var(--dt-accent)] [@media(pointer:coarse)]:min-h-11">Undo</button>
    </div>
  </div>;
}
