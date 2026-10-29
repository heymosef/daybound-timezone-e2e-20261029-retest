import React, { useRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { usePopupPosition } from "./usePopupPosition";
let viewportWidth: number;
let viewportHeight: number;
let anchorTop: number;
beforeEach(() => {
  viewportWidth = 320; viewportHeight = 600; anchorTop = 120;
  vi.spyOn(document.documentElement, "clientWidth", "get").mockImplementation(() => viewportWidth);
  vi.spyOn(window, "innerHeight", "get").mockImplementation(() => viewportHeight);
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(360);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ x: 220, y: anchorTop, left: 220, right: 256, top: anchorTop, bottom: anchorTop + 34, width: 36, height: 34, toJSON() {} }));
});
afterEach(() => vi.restoreAllMocks());
function Popup() {
  const popup = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLButtonElement>(null);
  const position = usePopupPosition(true, popup, anchor);
  return <><button ref={anchor}>Calendar</button><div ref={popup} data-testid="popup" style={{ fontSize: 16, ...position }}>Dates</div></>;
}
it("clamps the left edge on narrow screens and follows a resized viewport", () => {
  render(<Popup />);
  const popup = screen.getByTestId("popup");
  expect(popup).toHaveStyle({ left: "8px", width: "288px", top: "162px" });
  viewportWidth = 240; fireEvent.resize(window);
  expect(popup).toHaveStyle({ left: "8px", width: "224px" });
});
it("opens above a trigger when the popup fits there", () => {
  anchorTop = 550;
  render(<Popup />);
  expect(screen.getByTestId("popup")).toHaveStyle({ top: "180px" });
});
it("limits height and clamps within short screens instead of cutting off dates", () => {
  viewportHeight = 240;
  render(<Popup />);
  expect(screen.getByTestId("popup")).toHaveStyle({ top: "8px", maxHeight: "224px" });
});
