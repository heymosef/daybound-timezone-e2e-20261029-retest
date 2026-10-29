import React, { useState, useRef, useCallback, useLayoutEffect, useMemo } from "react";
import { CalendarDays, X } from "lucide-react";
import { useAnalytics } from "../../analytics/AnalyticsProvider";
import { addCalendarDays, calendarDifference, formatCalendarDate, getZonedFields, LIVE_SELECTION, startOfCalendarDate, type DateSelection } from "../../utils/calendarDate";
import { CalendarDropdown } from "./CalendarDropdown";
import { useScrollFade } from "../../hooks/useScrollFade";

interface DatePickerProps {
  selection: DateSelection;
  onSelectDate: (selection: DateSelection) => void;
  now: Date;
  homeTimezone: string;
}

const DatePickerInner: React.FC<DatePickerProps> = ({
  selection,
  onSelectDate,
  now,
  homeTimezone,
}) => {
  const { capture } = useAnalytics();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const calendarButtonRef = useRef<HTMLButtonElement>(null);
  const selectedDateButtonRef = useRef<HTMLButtonElement>(null);
  const focusDateControlRef = useRef(false);
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  useScrollFade(stripRef, "x");

  const homeToday = getZonedFields(now, homeTimezone).date;
  const isLive = selection.mode === "live";
  const selectedDate = selection.mode === "date" ? selection.date : homeToday;
  const selectedDateOffset = calendarDifference(selectedDate, homeToday);
  const showSelectedDateButton = selectedDateOffset < 0 || selectedDateOffset > 6;
  const stripDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const date = addCalendarDays(homeToday, i);
    return { date, unavailable: startOfCalendarDate(date, homeTimezone) === null,
      month: formatCalendarDate(date, { month: "short" }) };
  }), [homeToday, homeTimezone]);

  useLayoutEffect(() => {
    if (showSelectedDateButton) setIsCalendarOpen(false);
    if (focusDateControlRef.current) {
      (showSelectedDateButton ? selectedDateButtonRef : calendarButtonRef).current?.focus();
      focusDateControlRef.current = false;
    }
  }, [showSelectedDateButton]);

  useLayoutEffect(() => {
    const wrap = wrapperRef.current;
    const btn = firstButtonRef.current;
    if (!wrap || !btn) return;

    const measure = () => {
      const wrapRect = wrap.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      const centerX = btnRect.left - wrapRect.left + btnRect.width / 2;
      wrap.style.setProperty("--indicator-left", `${centerX}px`);
      wrap.style.setProperty("--indicator-visibility", btnRect.left >= wrapRect.left - 1 && btnRect.right <= wrapRect.right + 1 ? "visible" : "hidden");
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    const strip = stripRef.current;
    strip?.addEventListener("scroll", measure, { passive: true });
    return () => { ro.disconnect(); strip?.removeEventListener("scroll", measure); };
  }, []);

  const handleStripSelect = (offset: number) => {
    onSelectDate(offset === 0 ? LIVE_SELECTION : { mode: "date", date: addCalendarDays(homeToday, offset) });
    capture("date_selected_strip", { date_offset: offset });
  };

  const handleCalendarSelect = useCallback(
    (next: DateSelection) => {
      const pickedDate = next.mode === "date" ? next.date : homeToday;
      const offset = calendarDifference(pickedDate, homeToday);
      focusDateControlRef.current = offset < 0 || offset > 6;
      const monthDistance = (Number(pickedDate.slice(0, 4)) - Number(homeToday.slice(0, 4))) * 12 +
        Number(pickedDate.slice(5, 7)) - Number(homeToday.slice(5, 7));
      onSelectDate(next);
      capture("date_selected_calendar", { date_offset: offset, month_distance: monthDistance });
    },
    [onSelectDate, capture, homeToday],
  );

  const handleCalendarClose = useCallback(
    (
      method:
        | "outside_click"
        | "escape"
        | "date_selected"
        | "today_button",
    ) => {
      setIsCalendarOpen(false);
      if (method !== "outside_click") calendarButtonRef.current?.focus();
      capture("calendar_closed", { method });
    },
    [capture],
  );

  const toggleCalendar = () => {
    if (isCalendarOpen) {
      setIsCalendarOpen(false);
    } else {
      setIsCalendarOpen(true);
      capture("calendar_opened");
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex items-center gap-[0.25em] flex-grow md:flex-grow-0 min-w-0"
    >
      <div ref={wrapperRef} className="relative min-w-0" data-testid="strip-wrapper">
        <span
          className={`absolute top-0 -translate-x-1/2 z-10 pointer-events-none [visibility:var(--indicator-visibility,visible)] ${isLive
            ? "-translate-y-[55%]"
            : "-translate-y-1/2 w-[0.35em] h-[0.35em] rounded-full bg-[var(--dt-accent)] dark:bg-[color-mix(in_oklch,var(--dt-accent),black_30%)]"}`}
          style={{ left: "var(--indicator-left, 1.625em)" }}
          data-testid="today-indicator"
        >
          {isLive && <span className="bg-[var(--dt-accent)] dark:bg-[color-mix(in_oklch,var(--dt-accent),black_30%)] text-[var(--dt-text-inverse)] text-[clamp(7px,0.35vw+5px,9px)] font-semibold uppercase tracking-wider px-[0.4em] py-[0.2em] rounded drop-shadow-sm leading-none whitespace-nowrap inline-block">
            Today
          </span>}
        </span>

        <div className="bg-[var(--dt-control-bg)] rounded-md">
          <div ref={stripRef} className="scroll-fade-x flex items-center p-[0.125em] overflow-x-auto [&::-webkit-scrollbar]:hidden" role="group" aria-label="Next seven days">
            <div className="flex items-center min-w-max">
              {stripDays.map(({ date, unavailable, month }, i) => {
                const isSelected = i === selectedDateOffset;

                return (
                  <button
                    key={i}
                    ref={i === 0 ? firstButtonRef : undefined}
                    onClick={() => handleStripSelect(i)}
                    disabled={unavailable}
                    title={unavailable ? `This date does not exist in ${homeTimezone}.` : undefined}
                    aria-current={i === 0 ? "date" : undefined}
                    aria-pressed={isSelected}
                    className={`
                      flex flex-col items-center justify-center gap-[0.125em] px-[0.6em] py-[0.375em] rounded-sm transition-none min-w-[3em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dt-accent)]
                      ${
                        isSelected
                          ? "bg-[var(--dt-control-active)] text-[var(--dt-text)] shadow-[0_1px_2px_rgb(0_0_0/0.15)]"
                          : "text-[var(--dt-text-secondary)] hover:text-[var(--dt-text)]"
                      }
                    `}
                  >
                    <span className="text-[clamp(13px,0.78vw+5px,16.25px)] font-medium leading-none">
                      {Number(date.slice(8))}
                    </span>
                    <span className="text-[clamp(10px,0.5vw+8px,12px)] leading-none font-medium opacity-90">
                      {month}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {!showSelectedDateButton && <div className="relative h-full">
        <button
          ref={calendarButtonRef}
          onClick={toggleCalendar}
          className="flex items-center justify-center p-[0.5em] bg-[var(--dt-control-bg)] rounded-md transition-all duration-200 text-[var(--dt-text-secondary)] hover:text-[var(--dt-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dt-accent)] h-full min-w-[2.5em]"
          aria-label="Open calendar"
          aria-expanded={isCalendarOpen}
        >
          <CalendarDays size="1.125em" />
        </button>

        <CalendarDropdown
          isOpen={isCalendarOpen}
          onClose={handleCalendarClose}
          onSelectDate={handleCalendarSelect}
          selection={selection}
          containerRef={containerRef}
          anchorRef={calendarButtonRef}
          homeTimezone={homeTimezone}
          now={now}
        />
      </div>}

      {showSelectedDateButton && (() => {
        const viewingDate = selectedDate;
        return (
        <button
          ref={selectedDateButtonRef}
          type="button"
          onClick={() => {
            focusDateControlRef.current = true;
            onSelectDate(LIVE_SELECTION);
            capture("date_selected_strip", { date_offset: 0 });
          }}
          aria-label="Back to today"
          className="flex items-center gap-[0.25em] px-[0.5em] py-[0.25em] bg-[var(--dt-accent-wash)] border border-[var(--dt-accent-70)] rounded-md flex-shrink-0 h-full transition-all duration-200 text-[var(--dt-accent)] hover:bg-[var(--dt-accent-70)] hover:text-[var(--dt-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dt-accent)]"
        >
          <div className="flex flex-col items-center justify-center gap-[0.125em] min-w-[2em]">
            <span className="text-[clamp(13px,0.78vw+5px,16.25px)] font-medium leading-none">
              {Number(viewingDate.slice(8))}
            </span>
            <span className="text-[clamp(10px,0.5vw+8px,12px)] leading-none font-medium opacity-90">
              {formatCalendarDate(viewingDate, { month: "short" })}
            </span>
          </div>
          <X size="1.125em" />
        </button>
        );
      })()}

    </div>
  );
};

export const DatePicker = React.memo(DatePickerInner);
