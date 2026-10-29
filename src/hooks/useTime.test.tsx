import React, { StrictMode } from "react";
import { act, fireEvent, renderHook } from "@testing-library/react";
import { useTime } from "./useTime";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-02T12:00:59.900Z"));
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it("preserves the initial real instant and updates exactly at the next minute boundary", () => {
  const { result } = renderHook(useTime);
  expect(result.current.toISOString()).toBe("2026-03-02T12:00:59.900Z");
  const initial = result.current;
  act(() => vi.advanceTimersByTime(99));
  expect(result.current).toBe(initial);
  act(() => vi.advanceTimersByTime(1));
  expect(result.current.toISOString()).toBe("2026-03-02T12:01:00.000Z");
  const boundary = result.current;
  act(() => vi.advanceTimersByTime(59999));
  expect(result.current).toBe(boundary);
  act(() => vi.advanceTimersByTime(1));
  expect(result.current.toISOString()).toBe("2026-03-02T12:02:00.000Z");
});

it("does not rerender during an idle subminute period", () => {
  vi.setSystemTime(new Date("2026-03-02T12:00:10Z"));
  let renders = 0;
  renderHook(() => { renders++; return useTime(); });
  act(() => vi.advanceTimersByTime(49999));
  expect(renders).toBe(1);
});

it("uses actual wall time after a delayed callback and realigns the following update", () => {
  const { result } = renderHook(useTime);
  vi.setSystemTime(new Date("2026-03-02T12:05:10Z"));
  act(() => vi.advanceTimersByTime(100));
  expect(result.current.toISOString()).toBe("2026-03-02T12:05:10.100Z");
  act(() => vi.advanceTimersByTime(49899));
  expect(result.current.toISOString()).toBe("2026-03-02T12:05:10.100Z");
  act(() => vi.advanceTimersByTime(1));
  expect(result.current.toISOString()).toBe("2026-03-02T12:06:00.000Z");
});

it("refreshes immediately on focus/pageshow and schedules the next absolute minute", () => {
  const { result } = renderHook(useTime);
  vi.setSystemTime(new Date("2026-03-02T12:05:30.123Z"));
  act(() => fireEvent.focus(window));
  expect(result.current.toISOString()).toBe("2026-03-02T12:05:30.123Z");
  act(() => vi.advanceTimersByTime(29877));
  expect(result.current.toISOString()).toBe("2026-03-02T12:06:00.000Z");
  vi.setSystemTime(new Date("2026-03-02T12:09:13Z"));
  act(() => window.dispatchEvent(new Event("pageshow")));
  expect(result.current.toISOString()).toBe("2026-03-02T12:09:13.000Z");
});

it("pauses while hidden, refreshes on visibility, and leaves no work after unmount", () => {
  let visibility: DocumentVisibilityState = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
  const { result, unmount } = renderHook(useTime);
  expect(vi.getTimerCount()).toBe(1);
  const initial = result.current;
  visibility = "hidden";
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(vi.getTimerCount()).toBe(0);
  act(() => vi.advanceTimersByTime(120000));
  act(() => fireEvent.focus(window));
  expect(result.current).toBe(initial);
  visibility = "visible";
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(result.current.toISOString()).toBe("2026-03-02T12:02:59.900Z");
  expect(vi.getTimerCount()).toBe(1);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
  act(() => fireEvent.focus(window));
  expect(vi.getTimerCount()).toBe(0);
});

it("has no background timer when initially hidden and one effective timer in StrictMode", () => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  const hidden = renderHook(useTime);
  expect(vi.getTimerCount()).toBe(0);
  hidden.unmount();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const { result, unmount } = renderHook(useTime, { wrapper: ({ children }: React.PropsWithChildren) => <StrictMode>{children}</StrictMode> });
  expect(vi.getTimerCount()).toBe(1);
  act(() => vi.advanceTimersByTime(100));
  expect(result.current.toISOString()).toBe("2026-03-02T12:01:00.000Z");
  expect(vi.getTimerCount()).toBe(1);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
