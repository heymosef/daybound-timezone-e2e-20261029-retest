import { AnimatePresence } from "motion/react";
import React, { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { UndoCityRemoval } from "./UndoCityRemoval";
let monotonic = 0;
beforeEach(() => {
  monotonic = 0;
  vi.useFakeTimers();
  vi.spyOn(performance, "now").mockImplementation(() => monotonic);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
function advance(ms: number) { act(() => { monotonic += ms; vi.advanceTimersByTime(ms); }); }
function mount() {
  const onExpire = vi.fn(); const onUndo = vi.fn();
  const view = render(<StrictMode><UndoCityRemoval token="one" city="Toronto" onUndo={onUndo} onExpire={onExpire} /></StrictMode>);
  return { ...view, onExpire, onUndo };
}
it("expires after five seconds and cleans up on unmount", () => {
  const { onExpire, unmount } = mount();
  expect(screen.getByRole("status", { name: "Removed city" })).toHaveTextContent("Toronto removed");
  advance(4999); expect(onExpire).not.toHaveBeenCalled();
  advance(1); expect(onExpire).toHaveBeenCalledOnce(); unmount(); expect(vi.getTimerCount()).toBe(0);
});
it("keeps overlapping hover/focus pauses and resumes only remaining time", () => {
  const { onExpire } = mount(); advance(2000);
  const notice = screen.getByRole("status"); const undo = screen.getByRole("button");
  fireEvent.pointerEnter(notice); fireEvent.focus(undo); advance(20000);
  fireEvent.pointerLeave(notice); advance(20000); expect(onExpire).not.toHaveBeenCalled();
  fireEvent.blur(undo, { relatedTarget: document.body }); advance(2999); expect(onExpire).not.toHaveBeenCalled();
  advance(1); expect(onExpire).toHaveBeenCalledOnce();
});
it("preserves hidden pause and resets the budget for a replacement", () => {
  const { onExpire, onUndo, rerender } = mount(); advance(2000);
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  fireEvent(document, new Event("visibilitychange"));
  rerender(<StrictMode><UndoCityRemoval token="two" city="Tokyo" onUndo={onUndo} onExpire={onExpire} /></StrictMode>);
  advance(15000); expect(onExpire).not.toHaveBeenCalled();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  fireEvent(document, new Event("visibilitychange")); advance(4999); expect(onExpire).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Undo removal of Tokyo" })); expect(onUndo).toHaveBeenCalledOnce();
  advance(1); expect(onExpire).toHaveBeenCalledOnce();
});

it("keeps an inert toast for its exit, then removes it", () => {
  const media = window.matchMedia("(prefers-reduced-motion: no-preference)");
  vi.spyOn(window, "matchMedia").mockReturnValue({ ...media, matches: true });
  const onExpire = vi.fn(); const onUndo = vi.fn();
  const toast = <UndoCityRemoval token="one" city="Toronto" onUndo={onUndo} onExpire={onExpire} />;
  const view = render(<AnimatePresence>{toast}</AnimatePresence>);
  const notice = screen.getByRole("status");
  view.rerender(<AnimatePresence>{null}</AnimatePresence>);
  expect(notice).toHaveAttribute("data-exiting", "true");
  expect(notice.inert).toBe(true);
  expect(notice.querySelector("button")).toBeDisabled();
  advance(149); expect(notice).toBeInTheDocument();
  advance(1); expect(notice).not.toBeInTheDocument();
  expect(onExpire).not.toHaveBeenCalled();
});

it("cancels an old exit when another removal arrives and gives it five seconds", () => {
  const media = window.matchMedia("(prefers-reduced-motion: no-preference)");
  vi.spyOn(window, "matchMedia").mockReturnValue({ ...media, matches: true });
  const onExpire = vi.fn(); const onUndo = vi.fn();
  const view = render(<AnimatePresence><UndoCityRemoval token="one" city="Toronto" onUndo={onUndo} onExpire={onExpire} /></AnimatePresence>);
  act(() => screen.getByRole("button").focus());
  fireEvent.pointerEnter(screen.getByRole("status"));
  view.rerender(<AnimatePresence>{null}</AnimatePresence>);
  advance(100);
  act(() => (document.activeElement as HTMLElement).blur());
  view.rerender(<AnimatePresence><UndoCityRemoval token="two" city="Tokyo" onUndo={onUndo} onExpire={onExpire} /></AnimatePresence>);
  advance(4999);
  expect(screen.getByRole("status")).toHaveTextContent("Tokyo removed");
  expect(screen.getByRole("button")).toBeEnabled();
  expect(onExpire).not.toHaveBeenCalled();
  advance(1); expect(onExpire).toHaveBeenCalledOnce();
  view.unmount(); expect(vi.getTimerCount()).toBe(0);
});

it("removes immediately without an exit delay under reduced motion", () => {
  const view = render(<AnimatePresence><UndoCityRemoval token="one" city="Toronto" onUndo={vi.fn()} onExpire={vi.fn()} /></AnimatePresence>);
  view.rerender(<AnimatePresence>{null}</AnimatePresence>);
  expect(screen.queryByText("Toronto removed")).not.toBeInTheDocument();
  expect(vi.getTimerCount()).toBe(0);
});
