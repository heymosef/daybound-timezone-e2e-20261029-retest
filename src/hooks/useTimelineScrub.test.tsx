import React, { useRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useTimelineScrub } from "./useTimelineScrub";
const pan = vi.fn();
const reset = vi.fn();
const select = vi.fn();
beforeEach(() => { vi.useFakeTimers(); pan.mockReset(); reset.mockReset(); });
afterEach(() => vi.useRealTimers());
function Rail() {
  const ref = useRef<HTMLDivElement>(null);
  useTimelineScrub(ref, 50, pan, reset);
  return <div ref={ref} data-testid="rail"><button onClick={select}>Select time</button></div>;
}
function pointer(type: string, x: number, y: number) {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y });
  Object.defineProperties(event, { isPrimary: { value: true }, pointerId: { value: 1 } });
  fireEvent(screen.getByTestId("rail"), event);
}
it("batches horizontal pointer movement and flushes its final position on release", () => {
  render(<Rail />);
  pointer("pointerdown", 300, 100);
  pointer("pointermove", 250, 102);
  pointer("pointermove", 200, 102);
  expect(pan).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(20));
  expect(pan).toHaveBeenCalledExactlyOnceWith(2);
  pointer("pointermove", 175, 102);
  pointer("pointerup", 175, 102);
  expect(pan).toHaveBeenLastCalledWith(0.5);
  expect(screen.getByTestId("rail")).not.toHaveAttribute("data-scrubbing");
});
it("does not capture small taps or vertical scrolling as horizontal exploration", () => {
  render(<Rail />);
  pointer("pointerdown", 300, 100);
  pointer("pointermove", 298, 103);
  pointer("pointermove", 295, 150);
  pointer("pointerup", 295, 150);
  act(() => vi.advanceTimersByTime(20));
  expect(pan).not.toHaveBeenCalled();
});
it("cancels pending work and removes listeners when unmounted", () => {
  const { unmount } = render(<Rail />);
  pointer("pointerdown", 300, 100);
  pointer("pointermove", 200, 100);
  unmount();
  act(() => vi.advanceTimersByTime(20));
  expect(pan).not.toHaveBeenCalled();
});

it("Home cancels queued wheel movement before returning to now", () => {
  render(<Rail />);
  const rail = screen.getByTestId("rail");
  fireEvent.wheel(rail, { deltaX: 100 });
  fireEvent.keyDown(rail, { key: "Home" });
  act(() => vi.advanceTimersToNextFrame());
  expect(reset).toHaveBeenCalledOnce();
  expect(pan).not.toHaveBeenCalled();
});

it("allows a tap but suppresses the click generated after a swipe", () => {
  select.mockReset();
  render(<Rail />);
  pointer("pointerdown", 300, 100);
  pointer("pointerup", 300, 100);
  fireEvent.click(screen.getByRole("button", { name: "Select time" }));
  expect(select).toHaveBeenCalledOnce();
  pointer("pointerdown", 300, 100);
  pointer("pointermove", 200, 100);
  pointer("pointerup", 200, 100);
  fireEvent.click(screen.getByRole("button", { name: "Select time" }));
  expect(select).toHaveBeenCalledOnce();
});

it("keeps dragging when a touch cell transfers implicit capture to the viewport", () => {
  render(<Rail />);
  pointer("pointerdown", 300, 100);
  pointer("pointermove", 250, 100);
  fireEvent(screen.getByRole("button", { name: "Select time" }), new Event("lostpointercapture", { bubbles: true }));
  pointer("pointermove", 200, 100);
  pointer("pointerup", 200, 100);
  expect(pan).toHaveBeenLastCalledWith(2);
});
