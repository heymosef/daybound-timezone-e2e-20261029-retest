import React, { useRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useScrollFade } from "./useScrollFade";

let contentWidth: number;
let contentHeight: number;
let viewportWidth: number;
let viewportHeight: number;
let resize: () => void;
const disconnect = vi.fn();
beforeEach(() => {
  contentWidth = 300; viewportWidth = 100;
  contentHeight = 240; viewportHeight = 80;
  disconnect.mockReset();
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(() => contentWidth);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => viewportWidth);
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(() => contentHeight);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(() => viewportHeight);
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { resize = callback; }
    observe() {}
    disconnect = disconnect;
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function Harness({ axis = "x", text = "content", rtl = false }: { axis?: "x" | "y"; text?: string; rtl?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollFade(ref, axis);
  return <div ref={ref} data-testid="viewport" style={{ direction: rtl ? "rtl" : "ltr" }}><div>{text}</div></div>;
}
const edge = (name: string) => screen.getByTestId("viewport").style.getPropertyValue(`--scroll-fade-${name}`);

it("shows only the overflowing horizontal edges at the start, middle, and end", () => {
  render(<Harness />);
  const viewport = screen.getByTestId("viewport");
  expect([edge("left"), edge("right")]).toEqual(["0px", "16px"]);
  fireEvent.scroll(viewport, { target: { scrollLeft: 90 } });
  expect([edge("left"), edge("right")]).toEqual(["16px", "16px"]);
  fireEvent.scroll(viewport, { target: { scrollLeft: 200 } });
  expect([edge("left"), edge("right")]).toEqual(["16px", "0px"]);
  fireEvent.scroll(viewport, { target: { scrollLeft: 0 } });
  expect([edge("left"), edge("right")]).toEqual(["0px", "16px"]);
});

it("handles vertical lists and clamps rubber-band overscroll at either end", () => {
  render(<Harness axis="y" />);
  const viewport = screen.getByTestId("viewport");
  expect([edge("top"), edge("bottom")]).toEqual(["0px", "16px"]);
  fireEvent.scroll(viewport, { target: { scrollTop: 40 } });
  expect([edge("top"), edge("bottom")]).toEqual(["16px", "16px"]);
  fireEvent.scroll(viewport, { target: { scrollTop: 200 } });
  expect([edge("top"), edge("bottom")]).toEqual(["16px", "0px"]);
  fireEvent.scroll(viewport, { target: { scrollTop: -10 } });
  expect([edge("top"), edge("bottom")]).toEqual(["0px", "16px"]);
});

it("removes fades when resizing eliminates overflow and restores them when narrowed", () => {
  render(<Harness />);
  viewportWidth = 300; resize();
  expect([edge("left"), edge("right")]).toEqual(["0px", "0px"]);
  viewportWidth = 100; resize();
  expect(edge("right")).toBe("16px");
});

it("remeasures shrinking/replaced search content without a viewport resize", async () => {
  const { rerender } = render(<Harness axis="y" />);
  contentHeight = 40;
  rerender(<Harness axis="y" text="No results found" />);
  await waitFor(() => expect([edge("top"), edge("bottom")]).toEqual(["0px", "0px"]));
  contentHeight = 240;
  rerender(<Harness axis="y" text="Many results" />);
  await waitFor(() => expect(edge("bottom")).toBe("16px"));
});

it("uses physical edges for right-to-left scrolling", () => {
  render(<Harness rtl />);
  expect([edge("left"), edge("right")]).toEqual(["16px", "0px"]);
  fireEvent.scroll(screen.getByTestId("viewport"), { target: { scrollLeft: -200 } });
  expect([edge("left"), edge("right")]).toEqual(["0px", "16px"]);
});

it("removes scroll observation on unmount", () => {
  const { unmount } = render(<Harness />);
  const viewport = screen.getByTestId("viewport");
  const remove = vi.spyOn(viewport, "removeEventListener");
  unmount();
  expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
  expect(disconnect).toHaveBeenCalled();
  fireEvent.scroll(viewport, { target: { scrollLeft: 200 } });
  expect(viewport.style.getPropertyValue("--scroll-fade-left")).toBe("0px");
});
