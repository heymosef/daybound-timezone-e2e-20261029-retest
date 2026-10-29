import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Timeline } from "./Timeline";
import { TimezoneRow } from "./TimezoneRow";
import * as calendarFields from "../../utils/calendarDate";
import { getAbbreviation } from "../../utils/timezoneUtils";

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(2500);
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(2500);
});
afterEach(() => vi.restoreAllMocks());

function renderRail(overrides: Partial<React.ComponentProps<typeof Timeline>> = {}) {
  return render(<Timeline now={new Date("2026-03-07T18:15:00Z")} timezone="Asia/Kathmandu" isLive={false} selectedDateOffset={1} use24Hour {...overrides} />);
}

it("renders all 25 exact Kathmandu day cells without rounding", () => {
  const { container } = renderRail();
  const cells = container.querySelectorAll("[data-timeline-cell]");
  expect(cells).toHaveLength(25);
  expect(cells[0]).toHaveAttribute("data-instant", "2026-03-07T18:15:00.000Z");
  expect(cells[0]).toHaveTextContent("0");
  expect(screen.getByTestId("timeline-rail")).toHaveAttribute("data-start", "2026-03-07T18:15:00.000Z");
  expect(cells[24]).toHaveAttribute("data-instant", "2026-03-08T18:15:00.000Z");
  expect(container.querySelector('[data-date-boundary="2026-03-08"]')).toHaveClass("hidden");
});

it("positions actual fractional midnight and label instead of treating 00:45 as midnight", () => {
  const { container } = renderRail({ timezone: "Asia/Kolkata" });
  const midnight = container.querySelector('[data-date-boundary="2026-03-08"]');
  expect(midnight).toHaveAttribute("data-boundary-index", "0.25");
  expect(midnight).toHaveStyle({ left: "1%" });
  expect(midnight).not.toHaveClass("hidden");
  expect(container.querySelector('[data-date-label="2026-03-08"]')).toHaveStyle({ left: "25px" });
  expect(container.querySelector('[data-timeline-cell="1"]')).toHaveTextContent("0:45");
  expect(container.querySelector('[data-date-boundary][data-boundary-index="1"]')).toBeNull();
});

it("positions date boundaries inside the final cell and excludes the right endpoint", () => {
  const { container, rerender } = renderRail({ now: new Date("2026-03-07T23:30:00Z"), timezone: "UTC" });
  const final = container.querySelector('[data-date-boundary="2026-03-09"]');
  expect(final).toHaveAttribute("data-boundary-index", "24.5");
  expect(final).toHaveStyle({ left: "98%" });
  expect(container.querySelector('[data-date-label="2026-03-09"]')).toHaveStyle({ left: "2450px" });
  rerender(<Timeline now={new Date("2026-03-07T23:00:00Z")} timezone="UTC" isLive={false} selectedDateOffset={1} use24Hour />);
  expect(container.querySelector('[data-date-boundary="2026-03-09"]')).toBeNull();
});

it("keeps an initial date-segment label separate from a real midnight divider", () => {
  const { container } = renderRail({ now: new Date("2026-03-08T12:00:00Z"), timezone: "UTC" });
  expect(container.querySelector('[data-date-label="2026-03-08"]')).toHaveStyle({ left: "0px" });
  expect(container.querySelector('[data-date-boundary="2026-03-08"]')).toBeNull();
  expect(container.querySelector('[data-date-boundary="2026-03-09"]')).toHaveAttribute("data-boundary-index", "12");
});

it("renders Kolkata 02:30 correctly in the real row, marker and rail during the Vancouver DST gap", () => {
  const now = new Date("2026-03-07T21:00:00Z");
  const { container } = render(<TimezoneRow config={{ id: "india", timezone: "Asia/Kolkata", isHome: true }} now={now} timelineTime={now}
    onRemove={vi.fn()} onRename={vi.fn()} onMove={vi.fn()} onSetHome={vi.fn()} use24Hour showBadge showWeekends
    hoveredHourIndex={null} onHoverHour={vi.fn()} isLive selectedDateOffset={0} />);
  expect(screen.getByTestId("row-clock")).toHaveTextContent("02:30");
  expect(screen.getByTestId("row-clock").parentElement).toHaveTextContent("Sun, Mar 8");
  expect(screen.getByTestId("current-marker")).toHaveTextContent("2:30");
  expect(screen.getByTestId("current-marker")).toHaveStyle({ left: "1250px" });
  expect(container.querySelector('[data-timeline-cell="12"]')).toHaveTextContent("2:30");
  expect(container.querySelector('[data-timeline-cell="12"]')).toHaveAttribute("title", expect.stringContaining("UTC+05:30"));
  expect(getAbbreviation(now, "Asia/Kolkata")).toBe("IST");
});

it("exposes repeated-hour offsets and exact instants in rendered accessible cell names", () => {
  renderRail({ now: new Date("2026-11-01T12:00:00Z"), timezone: "America/New_York", isLive: true });
  expect(screen.getByRole("button", { name: "2026-11-01 1:00 UTC-04:00 (2026-11-01T05:00:00.000Z)" })).toHaveTextContent("1");
  expect(screen.getByRole("button", { name: "2026-11-01 1:00 UTC-05:00 (2026-11-01T06:00:00.000Z)" })).toHaveTextContent("1");
  expect(screen.getAllByRole("button")).toHaveLength(25);
});

it("shares hover indices and live anchor/marker geometry between rows", () => {
  function Pair() {
    const [hovered, setHovered] = useState<number | null>(null);
    return <>{["UTC", "Asia/Kathmandu"].map((timezone) => <Timeline key={timezone} now={new Date("2026-03-07T21:15:00Z")} timezone={timezone}
      isLive selectedDateOffset={0} use24Hour hoveredHourIndex={hovered} onHoverHour={setHovered} onSelectTime={vi.fn()} />)}</>;
  }
  const { container } = render(<Pair />);
  const cells = container.querySelectorAll('[data-timeline-cell="5"]');
  fireEvent.mouseEnter(cells[0]);
  for (const cell of cells) expect(cell).toHaveStyle({ background: "var(--dt-surface-highlight)" });
  for (const marker of screen.getAllByTestId("current-marker")) expect(marker).toHaveStyle({ left: "1250px" });
  for (const rail of screen.getAllByTestId("timeline-rail")) {
    expect(rail).toHaveAttribute("data-start", "2026-03-07T09:00:00.000Z");
    expect(rail.style.transform).toBe("translateX(-49%)");
  }
  fireEvent.mouseLeave(cells[0]);
  for (const cell of cells) expect(cell).not.toHaveStyle({ background: "var(--dt-surface-highlight)" });
});

it.each([false, true])("reserves the same fractional-label width across aligned rows in 24-hour mode=%s", (use24Hour) => {
  render(<>{["UTC", "Asia/Kolkata", "Asia/Kathmandu"].map((timezone) => <Timeline key={timezone}
    now={new Date("2026-03-07T12:00:00Z")} timezone={timezone} isLive selectedDateOffset={0} use24Hour={use24Hour} />)}</>);
  const rails = screen.getAllByTestId("timeline-rail");
  const instants = [...rails[0].querySelectorAll("[data-instant]")].map((cell) => cell.getAttribute("data-instant"));
  for (const rail of rails) {
    const cells = [...rail.querySelectorAll("[data-timeline-cell]")];
    expect(cells).toHaveLength(25);
    expect(cells.map((cell) => cell.getAttribute("data-instant"))).toEqual(instants);
    // jsdom has no text layout: enforce the shared width floor here; CUA verifies label bounds.
    for (const cell of cells) {
      expect(cell).toHaveClass("min-w-[3.25em]");
      expect(cell.className.split(" ").filter((name) => name.includes(":min-w-"))).toEqual([]);
    }
  }
  if (use24Hour) expect(rails[2]).toHaveTextContent("13:45");
});


it.each([
  ["America/Santiago", "2026-09-06T04:00:00Z", "1", 23],
  ["America/Havana", "2026-11-01T04:00:00Z", "0", 24],
  ["America/Havana", "2027-11-07T04:00:00Z", "0", 25],
  ["Australia/Lord_Howe", "2026-10-03T13:30:00Z", "0", 23.5],
  ["Australia/Lord_Howe", "2026-04-04T13:00:00Z", "0", 24.5],
])("renders exact date starts and boundaries in %s at %s", (timezone, instant, firstLabel, nextIndex) => {
  const { container } = renderRail({ now: new Date(instant), timezone });
  expect(screen.getByTestId("timeline-rail")).toHaveAttribute("data-start", new Date(instant).toISOString());
  expect(container.querySelector('[data-timeline-cell="0"]')).toHaveTextContent(firstLabel);
  const boundaries = container.querySelectorAll("[data-date-boundary]");
  if (nextIndex < 25) {
    expect(boundaries[1]).toHaveAttribute("data-boundary-index", String(nextIndex));
    expect(boundaries[1]).toHaveStyle({ left: `${nextIndex / 25 * 100}%` });
  } else {
    expect(boundaries).toHaveLength(1);
    const first = container.querySelector('[data-timeline-cell="0"]')!;
    const second = container.querySelector('[data-timeline-cell="1"]')!;
    expect(first).toHaveAttribute("title", expect.stringContaining("UTC-04:00"));
    expect(second).toHaveAttribute("title", expect.stringContaining("UTC-05:00"));
  }
});

it("renders the missing New York spring hour as an instant jump from 1 to 3", () => {
  renderRail({ now: new Date("2026-03-08T12:00:00Z"), timezone: "America/New_York", isLive: true });
  expect(screen.getByRole("button", { name: "2026-03-08 1:00 UTC-05:00 (2026-03-08T06:00:00.000Z)" })).toHaveTextContent("1");
  expect(screen.getByRole("button", { name: "2026-03-08 3:00 UTC-04:00 (2026-03-08T07:00:00.000Z)" })).toHaveTextContent("3");
  expect(screen.queryByRole("button", { name: /^2026-03-08 2:00/ })).not.toBeInTheDocument();
});

it("keeps the clock-change indicator visible during selection without restoring the current-time marker", () => {
  const select = vi.fn();
  const { container, rerender } = renderRail({ now: new Date("2026-11-01T00:00:00Z"), timezone: "America/New_York",
    selectedTime: Date.parse("2026-11-01T06:00:00Z"), onSelectTime: select });
  const marker = screen.getByRole("img", { name: "Clocks go back 1h. UTC-04:00 to UTC-05:00." });
  expect(marker).toHaveAttribute("data-clock-change", "2026-11-01T06:00:00.000Z");
  expect(marker).toHaveStyle({ left: "600px" });
  expect(marker).toHaveTextContent("Back 1h");
  expect(screen.queryByTestId("current-marker")).not.toBeInTheDocument();
  fireEvent.click(container.querySelector('[data-selected]')!);
  expect(select).toHaveBeenCalledExactlyOnceWith(Date.parse("2026-11-01T06:00:00Z"));
  rerender(<Timeline now={new Date("2026-11-01T00:00:00Z")} timezone="America/Vancouver" isLive={false} selectedDateOffset={1} />);
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

it("places a half-hour forward marker between cells and follows scrubbing", () => {
  const { rerender } = renderRail({ now: new Date("2026-10-03T13:00:00Z"), timezone: "Australia/Lord_Howe" });
  expect(screen.getByRole("img", { name: /Clocks go forward 30m/ })).toHaveStyle({ left: "250px" });
  rerender(<Timeline now={new Date("2026-10-03T13:00:00Z")} timezone="Australia/Lord_Howe" isLive={false} selectedDateOffset={1} panHours={3} />);
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

it("offers a compact earlier hint for Toronto's rollback outside Vancouver's November 1 rail", () => {
  const show = vi.fn(), select = vi.fn();
  const { rerender } = renderRail({ now: new Date("2026-11-01T07:00:00Z"), timezone: "America/Toronto", label: "Toronto",
    onShowClockChange: show, onSelectTime: select });
  const hint = screen.getByRole("button", { name: /Toronto\. Clocks go back 1h.*Before the visible timeline/ });
  expect(hint).toHaveTextContent(/^Back 1h$/);
  expect(hint).toHaveAttribute("data-clock-change-edge", "earlier");
  expect(hint).toHaveStyle({ left: "0px" });
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  fireEvent.click(hint);
  expect(show).toHaveBeenCalledExactlyOnceWith(Date.parse("2026-11-01T06:00:00Z"));
  expect(select).not.toHaveBeenCalled();
  rerender(<Timeline now={new Date("2026-11-01T06:00:00Z")} timezone="America/Toronto" label="Toronto"
    isLive selectedDateOffset={1} onShowClockChange={show} onPan={vi.fn()} />);
  expect(screen.queryByRole("button", { name: /Show clock change/ })).not.toBeInTheDocument();
  expect(screen.getByRole("img", { name: /Clocks go back 1h/ })).toBeInTheDocument();
});

it("uses the visible edge for a later hint even when the change already exists in the full rail", () => {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(500);
  const show = vi.fn();
  renderRail({ now: new Date("2026-11-01T00:00:00Z"), timezone: "America/Toronto", onShowClockChange: show });
  const hint = screen.getByRole("button", { name: /After the visible timeline/ });
  expect(hint).toHaveTextContent(/^Back 1h$/);
  expect(hint).toHaveAttribute("data-clock-change-edge", "later");
  expect(hint).toHaveStyle({ right: "0px" });
  fireEvent.click(hint);
  expect(show).toHaveBeenCalledExactlyOnceWith(Date.parse("2026-11-01T06:00:00Z"));
});

it.each([
  ["2026-11-01T12:00:00Z", "America/Toronto", true],
  ["2026-11-01T12:00:00.001Z", "America/Toronto", false],
  ["2026-11-01T07:00:00Z", "America/Vancouver", false],
])("shows only nearby hints on affected rows at %s in %s", (instant, timezone, visible) => {
  renderRail({ now: new Date(instant), timezone, onShowClockChange: vi.fn() });
  expect(screen.queryByRole("button", { name: /Show clock change/ }) !== null).toBe(visible);
});

it("preserves the motion wrapper at midnight then glides forward to the next date", () => {
  const fixed = new Date("2026-12-05T00:00:00Z");
  const { rerender } = renderRail({ now: fixed, timezone: "UTC", selectedDateOffset: 44 });
  const rail = screen.getByTestId("timeline-rail");
  const wrapper = rail.firstElementChild;
  const firstCell = wrapper!.querySelector('[data-timeline-cell="0"]');
  rerender(<Timeline now={fixed} timezone="UTC" isLive={false} selectedDateOffset={43} use24Hour />);
  expect(screen.getByTestId("timeline-rail")).toBe(rail);
  expect(rail.firstElementChild).toBe(wrapper);
  expect(rail.querySelector('[data-timeline-cell="0"]')).toBe(firstCell);
  rerender(<Timeline now={new Date("2026-12-06T00:00:00Z")} timezone="UTC" isLive={false} selectedDateOffset={44} use24Hour />);
  expect(rail.firstElementChild).not.toBe(wrapper);
  expect(rail.firstElementChild).toHaveStyle({ transform: "translateX(25px)" });
  expect(rail.querySelector('[data-timeline-cell="0"]')).toHaveAttribute("data-instant", "2026-12-06T00:00:00.000Z");
});
it("renders fractional dividers on both sides of a brief St Johns date appearance", () => {
  const { container } = renderRail({ now: new Date("2009-11-01T00:05:00Z"), timezone: "America/St_Johns" });
  const boundaries = [...container.querySelectorAll('[data-date-boundary]')];
  expect(boundaries.map((boundary) => boundary.getAttribute("title"))).toEqual([
    "2009-11-01T02:30:00.000Z", "2009-11-01T02:31:00.000Z", "2009-11-01T03:30:00.000Z",
  ]);
  const indices = [2 + 25 / 60, 2 + 26 / 60, 3 + 25 / 60];
  for (const [index, boundary] of boundaries.entries()) {
    expect(Number(boundary.getAttribute("data-boundary-index"))).toBeCloseTo(indices[index], 12);
    expect(parseFloat((boundary as HTMLElement).style.left)).toBeCloseTo(indices[index] / 25 * 100, 12);
    expect(boundary).toHaveAttribute("data-date-boundary", index === 1 ? "2009-10-31" : "2009-11-01");
  }
  expect(container.querySelector('[data-date-label="2009-10-31"][data-boundary-index="0"]')).toHaveTextContent("Sat, Oct 31");
  const nextLabel = container.querySelector('[data-date-label="2009-11-01"]');
  expect(nextLabel).toHaveTextContent("Sun, Nov 1");
  expect(parseFloat((nextLabel as HTMLElement).style.left)).toBeCloseTo(indices[2] * 100, 10);
});


it("retains converted rail fields across hover and minute progress while updating the real marker", () => {
  const conversions = vi.spyOn(calendarFields, "getZonedFields");
  const { rerender } = renderRail({ now: new Date("2026-03-07T21:15:00Z"), timezone: "UTC", isLive: true });
  expect(conversions.mock.calls.length).toBeGreaterThan(25);
  conversions.mockClear();
  rerender(<Timeline now={new Date("2026-03-07T21:15:00Z")} timezone="UTC" isLive selectedDateOffset={0} use24Hour hoveredHourIndex={5} />);
  expect(conversions).not.toHaveBeenCalled();
  rerender(<Timeline now={new Date("2026-03-07T21:16:00Z")} timezone="UTC" isLive selectedDateOffset={0} use24Hour hoveredHourIndex={5} />);
  expect(conversions).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("current-marker")).toHaveTextContent("21:16");
  expect(screen.getByTestId("timeline-rail")).toHaveAttribute("data-start", "2026-03-07T09:00:00.000Z");
});

it.each([false, true])("keeps each hour's cell and fill together across scrub rebases in centered mode=%s", (isLive) => {
  const now = new Date("2026-03-07T21:15:00Z");
  const instant = isLive ? "2026-03-07T22:00:00.000Z" : "2026-03-07T22:15:00.000Z";
  const { container, rerender } = renderRail({ now, timezone: "UTC", isLive });
  const cell = container.querySelector(`[data-instant="${instant}"]`)!;
  const wrapper = screen.getByTestId("timeline-rail").firstElementChild;
  for (const panHours of [0.9, 1.1, -0.1]) {
    rerender(<Timeline now={now} timezone="UTC" isLive={isLive} selectedDateOffset={1} panHours={panHours} use24Hour />);
    expect(container.querySelector(`[data-instant="${instant}"]`)).toBe(cell);
    expect(cell).toHaveTextContent("22");
    expect(screen.getByTestId("timeline-rail").firstElementChild).toBe(wrapper);
  }
});

it("selects the exact repeated-hour instant and exposes a pressed column", () => {
  const select = vi.fn();
  const { rerender } = renderRail({ now: new Date("2026-11-01T12:00:00Z"), timezone: "America/New_York", isLive: true, onSelectTime: select });
  fireEvent.click(screen.getByRole("button", { name: "2026-11-01 1:00 UTC-05:00 (2026-11-01T06:00:00.000Z)" }));
  expect(select).toHaveBeenCalledExactlyOnceWith(Date.parse("2026-11-01T06:00:00Z"));
  rerender(<Timeline now={new Date("2026-11-01T12:00:00Z")} currentTime={new Date("2026-11-01T06:00:00Z")} timezone="America/New_York" isLive selectedDateOffset={0}
    selectedTime={Date.parse("2026-11-01T06:00:00Z")} onSelectTime={select} />);
  expect(screen.getByRole("button", { name: /2026-11-01 1:00 UTC-05:00/, pressed: true })).toHaveAttribute("data-selected", "true");
  expect(screen.getByRole("button", { name: /2026-11-01 1:00 UTC-04:00/ })).toHaveAttribute("aria-pressed", "false");
  expect(screen.queryByTestId("current-marker")).not.toBeInTheDocument();
});

it.each([false, true])("hides the time line and pill while a column is selected in centered mode=%s", (isLive) => {
  const selected = new Date("2026-03-08T06:00:00Z");
  const { rerender } = renderRail({ now: selected, currentTime: selected, timezone: "UTC", isLive, selectedTime: selected.getTime() });
  expect(screen.queryByTestId("current-marker")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { pressed: true })).toHaveAttribute("data-selected", "true");
  rerender(<Timeline now={selected} timezone="UTC" isLive selectedDateOffset={0} />);
  expect(screen.getByTestId("current-marker")).toBeInTheDocument();
});
