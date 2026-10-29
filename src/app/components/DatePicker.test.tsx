import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatePicker } from "./DatePicker";
import { addCalendarDays, getZonedFields } from "../../utils/calendarDate";

vi.mock("motion/react", () => ({
  motion: {
    div: React.forwardRef(
      (
        { children, ...props }: React.PropsWithChildren<MotionMockProps>,
        ref: React.Ref<HTMLDivElement>,
      ) => (
        <div ref={ref} {...stripMotionProps(props)}>
          {children}
        </div>
      ),
    ),
    span: React.forwardRef(
      (
        { children, ...props }: React.PropsWithChildren<MotionMockProps>,
        ref: React.Ref<HTMLSpanElement>,
      ) => (
        <span ref={ref} {...stripMotionProps(props)}>
          {children}
        </span>
      ),
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

type MotionMockProps = React.HTMLAttributes<HTMLElement> & {
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
  transition?: unknown;
};

function stripMotionProps(props: MotionMockProps) {
  const domProps = { ...props };
  delete domProps.initial;
  delete domProps.animate;
  delete domProps.exit;
  delete domProps.transition;
  return domProps;
}

const NOW = new Date("2026-03-02T14:30:00Z");

function renderDatePicker(
  overrides: Partial<React.ComponentProps<typeof DatePicker>> & { selectedDateOffset?: number } = {},
) {
  const onSelectDate = vi.fn();
  const { selectedDateOffset = 0, ...props } = overrides;
  const today = getZonedFields(props.now ?? NOW, props.homeTimezone ?? "UTC").date;
  const result = render(
    <DatePicker
      selection={selectedDateOffset === 0 ? { mode: "live" } : { mode: "date", date: addCalendarDays(today, selectedDateOffset) }}
      onSelectDate={onSelectDate}
      now={NOW}
      homeTimezone="UTC"
      {...props}
    />,
  );
  return { onSelectDate, ...result };
}

describe("DatePicker strip", () => {
  it("renders 7 day buttons", () => {
    renderDatePicker();
    expect(within(screen.getByRole("group", { name: "Next seven days" })).getAllByRole("button")).toHaveLength(7);
  });

  it("shows TODAY pill when today is selected", () => {
    renderDatePicker({ selectedDateOffset: 0 });
    const indicator = screen.getByTestId("today-indicator");
    expect(indicator).toBeInTheDocument();
    expect(indicator.textContent).toBe("Today");
  });

  it("marks the first button with aria-current='date'", () => {
    renderDatePicker();
    const todayButton = screen.getByRole("button", { current: "date" });
    expect(todayButton).toBeInTheDocument();
  });

  it("shows dot when another date is selected", () => {
    renderDatePicker({ selectedDateOffset: 3 });
    const indicator = screen.getByTestId("today-indicator");
    expect(indicator).toBeInTheDocument();
    expect(indicator.textContent).not.toBe("Today");
  });

  it("keeps one mounted Today indicator through date selection and return to live", () => {
    const { rerender } = renderDatePicker();
    const indicator = screen.getByTestId("today-indicator");
    for (const selection of [
      { mode: "date", date: "2026-03-03" },
      { mode: "date", date: "2026-03-05" },
      { mode: "live" },
    ] as const) {
      rerender(<DatePicker selection={selection} onSelectDate={vi.fn()} now={NOW} homeTimezone="UTC" />);
      expect(screen.getByTestId("today-indicator")).toBe(indicator);
      expect(indicator.textContent).toBe(selection.mode === "live" ? "Today" : "");
    }
  });

  it("today indicator and today button both render within the strip wrapper", () => {
    renderDatePicker({ selectedDateOffset: 0 });
    const indicator = screen.getByTestId("today-indicator");
    const todayButton = screen.getByRole("button", { current: "date" });
    expect(indicator).toBeInTheDocument();
    expect(todayButton).toBeInTheDocument();
    const wrapper = screen.getByTestId("strip-wrapper");
    expect(wrapper.contains(indicator)).toBe(true);
    expect(wrapper.contains(todayButton)).toBe(true);
  });

  it("indicator uses --indicator-left CSS variable", () => {
    renderDatePicker({ selectedDateOffset: 0 });
    const indicator = screen.getByTestId("today-indicator");
    expect(indicator.style.left).toBe("var(--indicator-left, 1.625em)");
  });

  it("dot indicator uses --indicator-left CSS variable", () => {
    renderDatePicker({ selectedDateOffset: 3 });
    const indicator = screen.getByTestId("today-indicator");
    expect(indicator.style.left).toBe("var(--indicator-left, 1.625em)");
  });

  it("calls onSelectDate with correct offset when a day is clicked", async () => {
    const user = userEvent.setup();
    const { onSelectDate } = renderDatePicker();

    await user.click(screen.getByRole("button", { name: "3 Mar" }));
    expect(onSelectDate).toHaveBeenCalledExactlyOnceWith({ mode: "date", date: "2026-03-03" });
  });

  it("applies selected styling to the active offset", () => {
    renderDatePicker({ selectedDateOffset: 0 });
    const todayButton = screen.getByRole("button", { current: "date" });
    expect(todayButton.className).toContain("bg-[var(--dt-control-active)]");
  });
});

describe("Calendar dropdown", () => {
  it("opens when the calendar icon button is clicked", async () => {
    const user = userEvent.setup();
    renderDatePicker();

    const calendarButton = screen.getByRole("button", {
      name: /open calendar/i,
    });
    expect(calendarButton).toHaveAttribute("aria-expanded", "false");

    await user.click(calendarButton);
    expect(calendarButton).toHaveAttribute("aria-expanded", "true");

    expect(screen.getByText("March 2026")).toBeInTheDocument();
  });

  it("shows current month with navigation arrows", async () => {
    const user = userEvent.setup();
    renderDatePicker();

    await user.click(
      screen.getByRole("button", { name: /open calendar/i }),
    );

    expect(
      screen.getByRole("button", { name: /previous month/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /next month/i }),
    ).toBeEnabled();
  });

  it("highlights today in the calendar grid", async () => {
    const user = userEvent.setup();
    renderDatePicker();

    await user.click(
      screen.getByRole("button", { name: /open calendar/i }),
    );

    const todayLabel = "Monday, March 2, 2026";
    const todayCell = screen.getByRole("button", {
      name: todayLabel,
    });
    expect(todayCell.className).toContain("bg-[var(--dt-accent)]");
  });

  it("disables past dates", async () => {
    const user = userEvent.setup();
    const { onSelectDate } = renderDatePicker();

    await user.click(
      screen.getByRole("button", { name: /open calendar/i }),
    );

    const yesterdayCell = screen.getByRole("button", { name: "Sunday, March 1, 2026" });
    expect(yesterdayCell).toHaveAttribute("aria-disabled", "true");
    await user.click(yesterdayCell);
    expect(onSelectDate).not.toHaveBeenCalled();
  });

  it("selects a future date and closes the dropdown", async () => {
    const user = userEvent.setup();
    const { onSelectDate } = renderDatePicker();

    await user.click(
      screen.getByRole("button", { name: /open calendar/i }),
    );

    const futureLabel = "Saturday, March 7, 2026";
    const futureCell = screen.getByRole("button", {
      name: futureLabel,
    });

    await user.click(futureCell);
    expect(onSelectDate).toHaveBeenCalledWith({ mode: "date", date: "2026-03-07" });

    const calendarButton = screen.getByRole("button", {
      name: /open calendar/i,
    });
    expect(calendarButton).toHaveAttribute("aria-expanded", "false");
  });

  it("navigates to the next month", async () => {
    const user = userEvent.setup();
    renderDatePicker();

    await user.click(
      screen.getByRole("button", { name: /open calendar/i }),
    );

    const nextMonthButton = screen.getByRole("button", {
      name: /next month/i,
    });
    await user.click(nextMonthButton);

    expect(
      screen.getByText("April 2026"),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /previous month/i }),
    ).toBeEnabled();
  });

  it("closes on Escape key", async () => {
    const user = userEvent.setup();
    renderDatePicker();

    await user.click(
      screen.getByRole("button", { name: /open calendar/i }),
    );
    expect(
      screen.getByRole("button", { name: /open calendar/i }),
    ).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("button", { name: /open calendar/i }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("'Today' footer button selects today and closes", async () => {
    const user = userEvent.setup();
    const { onSelectDate } = renderDatePicker({ selectedDateOffset: 5 });

    await user.click(
      screen.getByRole("button", { name: /open calendar/i }),
    );

    const footerTodayButton = screen.getByRole("button", {
      name: (_, el) =>
        el?.textContent === "Today" &&
        !el?.getAttribute("aria-current"),
    });

    await user.click(footerTodayButton);
    expect(onSelectDate).toHaveBeenCalledWith({ mode: "live" });
    expect(
      screen.getByRole("button", { name: /open calendar/i }),
    ).toHaveAttribute("aria-expanded", "false");
  });
});

describe("Date controls outside the strip", () => {
  it.each([-1, 14])("keeps the date-and-X button and hides the calendar at offset %s", (selectedDateOffset) => {
    renderDatePicker({ selectedDateOffset });
    expect(screen.getByRole("button", { name: /back to today/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open calendar/i })).not.toBeInTheDocument();
  });

  it("hides viewing label when selectedDateOffset <= 6", () => {
    renderDatePicker({ selectedDateOffset: 3 });
    expect(
      screen.queryByRole("button", { name: /back to today/i }),
    ).not.toBeInTheDocument();
  });

  it("today in the strip still resets a far-future view", async () => {
    const user = userEvent.setup();
    const { onSelectDate } = renderDatePicker({ selectedDateOffset: 14 });

    await user.click(
      screen.getByRole("button", { current: "date" }),
    );
    expect(onSelectDate).toHaveBeenCalledWith({ mode: "live" });
  });

  it("swaps the calendar for the selected-date button, preserving focus and restoring the closed calendar on X", async () => {
    const user = userEvent.setup();
    function Picker() {
      const [selection, setSelection] = React.useState<React.ComponentProps<typeof DatePicker>["selection"]>({ mode: "live" });
      return <DatePicker selection={selection} onSelectDate={setSelection} now={NOW} homeTimezone="UTC" />;
    }
    render(<Picker />);
    await user.click(screen.getByRole("button", { name: /open calendar/i }));
    await user.click(screen.getByRole("button", { name: "Monday, March 16, 2026" }));
    const selectedDate = screen.getByRole("button", { name: /back to today/i });
    expect(selectedDate).toHaveTextContent("16Mar");
    expect(selectedDate).toHaveFocus();
    expect(screen.queryByRole("button", { name: /open calendar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(selectedDate);
    const calendar = screen.getByRole("button", { name: /open calendar/i });
    expect(calendar).toHaveAttribute("aria-expanded", "false");
    expect(calendar).toHaveFocus();
    expect(screen.queryByRole("button", { name: /back to today/i })).not.toBeInTheDocument();
  });
});

describe("Timezone-aware date handling", () => {
  // March 2 14:30 UTC — still March 2 in UTC, but already March 3 in Sydney (UTC+11)
  const TZ_NOW = new Date(Date.UTC(2026, 2, 2, 14, 30, 0));

  it("strip shows dates in home timezone, not browser timezone", () => {
    renderDatePicker({ now: TZ_NOW, homeTimezone: "Australia/Sydney" });
    const todayButton = screen.getByRole("button", { current: "date" });
    expect(todayButton.textContent).toContain("3");
  });

  it("calendar highlights today per home timezone", async () => {
    const user = userEvent.setup();
    renderDatePicker({ now: TZ_NOW, homeTimezone: "Australia/Sydney" });

    await user.click(
      screen.getByRole("button", { name: /open calendar/i }),
    );

    const todayLabel = "Tuesday, March 3, 2026";
    const todayCell = screen.getByRole("button", { name: todayLabel });
    expect(todayCell.className).toContain("bg-[var(--dt-accent)]");
  });

  it("calendar disables dates before home-timezone today", async () => {
    const user = userEvent.setup();
    const { onSelectDate } = renderDatePicker({
      now: TZ_NOW,
      homeTimezone: "Australia/Sydney",
    });

    await user.click(
      screen.getByRole("button", { name: /open calendar/i }),
    );

    const yesterdayCell = screen.getByRole("button", { name: "Monday, March 2, 2026" });
    expect(yesterdayCell).toHaveAttribute("aria-disabled", "true");
    await user.click(yesterdayCell);
    expect(onSelectDate).not.toHaveBeenCalled();
  });

  it("date-and-X button keeps the correct selected date in the home timezone", () => {
    renderDatePicker({
      now: TZ_NOW,
      homeTimezone: "Australia/Sydney",
      selectedDateOffset: 14,
    });
    const selectedDate = screen.getByRole("button", { name: /back to today/i });
    expect(selectedDate).toHaveTextContent("17Mar");
  });
});


it("keeps selected-today preview distinct from live and lets Today return live", async () => {
  const user = userEvent.setup();
  const { onSelectDate } = renderDatePicker({ selection: { mode: "date", date: "2026-03-02" } });
  expect(screen.getByTestId("today-indicator")).not.toHaveTextContent("Today");
  await user.click(screen.getByRole("button", { current: "date" }));
  expect(onSelectDate).toHaveBeenCalledWith({ mode: "live" });
});

it("disables a skipped date in the strip with an explanation", () => {
  renderDatePicker({ now: new Date("2011-12-29T12:00:00Z"), homeTimezone: "Pacific/Apia" });
  const skipped = screen.getByRole("button", { name: "30 Dec" });
  expect(skipped).toBeDisabled();
  expect(skipped).toHaveAttribute("title", "This date does not exist in Pacific/Apia.");
});
