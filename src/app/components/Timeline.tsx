import { HOUR_MS } from "../../utils/calendarDate";
import { useTimelineScrub } from "../../hooks/useTimelineScrub";
import React, {
  useRef,
  useState,
  useLayoutEffect,
  useMemo,
} from "react";
import { createTimeline, formatClock, formatZonedClock, TOTAL_HOURS, PAN_LIMIT_HOURS, CLOCK_CHANGE_LOOKAROUND_HOURS } from "../../utils/timeline";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { motion, AnimatePresence } from "motion/react";
import { MorphingTime } from "./MorphingTime";
import { Undo2, Redo2, ChevronLeft, ChevronRight } from "lucide-react";
import { EASE_OUT, EASE_IN } from "../../utils/animation";
import "./Timeline.css";

interface TimelineProps {
  now: Date;
  timezone: string;
  label?: string;
  isHome?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  homeTimezone?: string;
  className?: string;
  use24Hour?: boolean;
  hoveredHourIndex?: number | null;
  onHoverHour?: (index: number | null) => void;
  isLive: boolean;
  selectedDateOffset: number;
  showWeekends?: boolean;
  panHours?: number;
  currentTime?: Date;
  onPan?: (hours: number) => void;
  onReset?: () => void;
  selectedTime?: number;
  onSelectTime?: (instant: number) => void;
  onShowClockChange?: (instant: number) => void;
}

const LABEL_PAD = 0; // px – clamping offset from the container edge

const TimelineInner: React.FC<TimelineProps> = ({
  now,
  timezone,
  label,
  isHome,
  isFirst,
  isLast,
  className,
  use24Hour,
  hoveredHourIndex,
  onHoverHour,
  isLive,
  selectedDateOffset,
  showWeekends,
  panHours = 0,
  currentTime,
  onPan,
  onReset,
  selectedTime,
  onSelectTime,
  onShowClockChange,
}) => {
  // ── Refs & measurement ──
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ outer: 0, inner: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      if (outerRef.current && innerRef.current) {
        setDims({
          outer: outerRef.current.offsetWidth,
          inner: innerRef.current.scrollWidth,
        });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (outerRef.current) ro.observe(outerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Glide animation: track date changes for motion wrapper ──
  const viewIdentity = isLive ? "live" : now.toISOString();
  const prevViewRef = useRef(viewIdentity);
  const prevOffsetRef = useRef(selectedDateOffset);
  const slideDirectionRef = useRef(0);
  const [glideCount, setGlideCount] = useState(0);
  const changeTypeRef = useRef<"date" | "format">("date");

  useLayoutEffect(() => {
    if (prevViewRef.current !== viewIdentity) {
      prevViewRef.current = viewIdentity;
      changeTypeRef.current = "date";
      slideDirectionRef.current =
        selectedDateOffset > prevOffsetRef.current ? 1 : -1;
      setGlideCount((c) => c + 1);
    }
    // A fixed view keeps its identity at home midnight, but its relative
    // offset still changes and must be current for the next date selection.
    prevOffsetRef.current = selectedDateOffset;
  }, [selectedDateOffset, viewIdentity]);

  // ── Format animation: track 12H/24H changes ──
  const prevFormatRef = useRef(use24Hour);
  const [formatCount, setFormatCount] = useState(0);
  const formatDirRef = useRef(1); // 1 = down (to 24hr), -1 = up (to 12hr)

  useLayoutEffect(() => {
    if (prevFormatRef.current !== use24Hour) {
      changeTypeRef.current = "format";
      formatDirRef.current = use24Hour ? 1 : -1;
      prevFormatRef.current = use24Hour;
      setFormatCount((c) => c + 1);
    }
  }, [use24Hour]);

  const nowTime = now.getTime();
  const viewTime = nowTime + panHours * HOUR_MS;
  const realNow = currentTime?.getTime() ?? nowTime;
  const anchorTime = isLive ? Math.floor(viewTime / HOUR_MS) * HOUR_MS : nowTime + Math.floor(panHours) * HOUR_MS;
  // A row retains one exact frame; hover, minute progress and formatting do not reconvert its 25 cells.
  const model = useMemo(() => createTimeline(new Date(anchorTime), timezone, isLive), [anchorTime, timezone, isLive]);
  const progress = (viewTime - model.start) / HOUR_MS;
  const nowFractionPercent = progress / TOTAL_HOURS * 100;
  const railLeft = isLive ? "50%" : "0%";
  const railTransform = `translateX(${-nowFractionPercent}%)`;
  // AnimatePresence retains the last mounted marker's children during exit.
  const markerTimeDisplay = useMemo(() => formatZonedClock(new Date(realNow), timezone, !!use24Hour, false), [realNow, timezone, use24Hour]);
  const dateBoundaries = model.segments;

  const cellWidth =
    dims.inner > 0 ? dims.inner / TOTAL_HOURS : 0;

  const railOffset = (isLive ? dims.outer / 2 : 0) - progress * cellWidth;
  const markerLeftPx = railOffset + (realNow - model.start) / HOUR_MS * cellWidth;
  const keyboardCell = model.cells[Math.max(0, Math.min(TOTAL_HOURS - 1, Math.floor(progress)))];
  useTimelineScrub(outerRef, cellWidth, onPan, onReset);

  // One compact hint per edge, measured against the visible viewport rather than
  // the full rail. Nearby transitions can also sit just outside the rail itself.
  const edgeChanges = (["earlier", "later"] as const).map(direction => {
    const candidates = model.nearbyClockChanges.filter(change => {
      const x = railOffset + change.index * cellWidth;
      const distance = direction === "earlier" ? -x : x - dims.outer;
      return (direction === "earlier" ? x < 0 : x >= dims.outer) &&
        distance <= CLOCK_CHANGE_LOOKAROUND_HOURS * cellWidth;
    });
    const change = direction === "earlier" ? candidates.at(-1) : candidates[0];
    return change ? { change, direction } : null;
  });

  const LABEL_WIDTH_ESTIMATE = 80;

  const floatingLabels = dateBoundaries.map((b, idx) => {
    const nextIdx =
      idx + 1 < dateBoundaries.length
        ? dateBoundaries[idx + 1].index
        : TOTAL_HOURS;

    const naturalX = railOffset + b.index * cellWidth;
    const lastCellRight = railOffset + nextIdx * cellWidth;

    const isVisible =
      lastCellRight > 0 && naturalX < dims.outer;
    const x = Math.max(LABEL_PAD, naturalX);

    return { ...b, x, isVisible };
  });

  for (let i = 0; i < floatingLabels.length - 1; i++) {
    const curr = floatingLabels[i];
    const next = floatingLabels[i + 1];
    if (
      curr.isVisible &&
      next.isVisible &&
      next.x - curr.x < LABEL_WIDTH_ESTIMATE
    ) {
      curr.isVisible = false;
    }
  }

  return (
    <div
      ref={outerRef}
      data-date-mode={isLive ? "live" : "date"}
      data-first-row={isFirst || undefined}
      data-last-row={isLast || undefined}
      data-preview-instant={new Date(viewTime).toISOString()}
      role={onPan ? "region" : undefined}
      aria-label={onPan ? `${label ?? timezone.split("/").pop()?.replace(/_/g, " ")} timeline. Drag horizontally or use arrow keys to browse; Enter selects or clears a time; Home returns to now.` : undefined}
      aria-description={onSelectTime ? selectedTime !== undefined && selectedTime >= keyboardCell.time && selectedTime < keyboardCell.time + HOUR_MS
        ? "Enter clears the selected time and keeps this timeline view." : `Enter selects ${keyboardCell.description}` : undefined}
      tabIndex={onPan ? 0 : undefined}
      onKeyDown={event => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ") && onSelectTime) {
          event.preventDefault();
          onSelectTime(keyboardCell.time);
        }
      }}
      style={{ touchAction: onPan ? "pan-y pinch-zoom" : undefined }}
      className={twMerge(
        "timeline-viewport overflow-hidden w-full h-full relative select-none",
        onPan ? "cursor-grab data-[scrubbing=true]:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--dt-accent)]" : "cursor-default",
        className,
      )}
    >
      {/* ── Floating date labels (overlay layer) ── */}
      {dims.outer > 0 &&
        floatingLabels.map(
          (fl) =>
            fl.isVisible && (
              <motion.div
                key={`${fl.key}-${glideCount}`}
                initial={
                  glideCount > 0
                    ? {
                        opacity: 0,
                        x: slideDirectionRef.current * 15,
                      }
                    : false
                }
                animate={{
                  opacity:
                    isLive && selectedTime === undefined &&
                    fl.x > markerLeftPx - 120 &&
                    fl.x < markerLeftPx + 50
                      ? 0
                      : 1,
                  x: 0,
                }}
                transition={{
                  duration: 0.45,
                  ease: [0.4, 0, 0.2, 1],
                }}
                className="absolute top-[0.5em] z-30 text-[clamp(10px,0.5vw+8px,12px)] tracking-wider whitespace-nowrap text-[var(--dt-text)] pointer-events-none px-[0.5em] py-[0.125em] rounded-full bg-[var(--dt-bg)]/90 backdrop-blur-sm drop-shadow-sm border border-[var(--dt-border)] ml-[8px] mr-[0px] my-[0px]"
                data-date-label={fl.date}
                data-boundary-index={fl.index}
                style={{ left: fl.x }}
              >
                {fl.label}
              </motion.div>
            ),
        )}

      {/* ── Current-time marker (overlay, fades in/out) ── */}
      {/* Tip 2: exit faster than enter; Tip 4: ease-out enter, ease-in exit */}
      {selectedTime === undefined && <AnimatePresence>
        {isLive && dims.outer > 0 && (
          <motion.div
            key="current-marker"
            data-testid="current-marker"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { duration: 0.35, ease: EASE_OUT },
            }}
            exit={{
              opacity: 0,
              transition: { duration: 0.2, ease: EASE_IN },
            }}
            className="absolute top-0 bottom-0 z-20 pointer-events-none"
            style={{ left: markerLeftPx }}
          >
            {/* Vertical line */}
            <div className="absolute top-0 bottom-0 w-px bg-[var(--dt-accent)]" />
            {/* Time pill */}
            <div className="absolute top-0 -translate-x-1/2 flex flex-col items-center z-30 pointer-events-none mt-[0.25em]">
              <div className="relative">
                {/* Invisible sizer: always renders the CURRENT format to hold width */}
                <div
                  aria-hidden
                  className="bg-[var(--dt-accent)] text-[var(--dt-text-inverse)] text-[clamp(10px,0.5vw+8px,12px)] font-medium px-[0.375em] py-[0.125em] rounded drop-shadow-sm whitespace-nowrap leading-none invisible"
                >
                  {markerTimeDisplay}
                </div>
                {/* Crossfade layer — Tip 2: faster exit; Tip 4: asymmetric easing */}
                <AnimatePresence initial={false}>
                  <motion.div
                    key={use24Hour ? "24h" : "12h"}
                    initial={{
                      opacity: 0,
                      y: formatDirRef.current * -6,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      transition: {
                        duration: 0.3,
                        ease: EASE_OUT,
                      },
                    }}
                    exit={{
                      opacity: 0,
                      y: formatDirRef.current * 6,
                      transition: {
                        duration: 0.18,
                        ease: EASE_IN,
                      },
                    }}
                    className="absolute inset-0 flex items-center justify-center bg-[var(--dt-accent)] dark:bg-[color-mix(in_oklch,var(--dt-accent),black_30%)] text-[var(--dt-text-inverse)] text-[clamp(10px,0.5vw+8px,12px)] font-medium px-[0.375em] py-[0.125em] rounded drop-shadow-sm whitespace-nowrap leading-none"
                  >
                    <MorphingTime>{markerTimeDisplay}</MorphingTime>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>}

      {/* Fade only the movable cells; the real-time marker, date labels and focus outline stay crisp. */}
      <div className={`absolute inset-0 ${onPan ? "scroll-fade-x" : ""}`}
        style={onPan ? { "--scroll-fade-left": panHours > -PAN_LIMIT_HOURS ? "16px" : "0px",
          "--scroll-fade-right": panHours < PAN_LIMIT_HOURS ? "16px" : "0px" } as React.CSSProperties : undefined}>
      {/* ── Inner rail ── */}
      <div
        ref={innerRef}
        data-testid="timeline-rail"
        data-start={new Date(model.start).toISOString()}
        className="flex h-full absolute top-0"
        style={{
          left: railLeft,
          transform: railTransform,
          minWidth: "105%",
        }}
      >
        {/* Motion wrapper: re-mounts on date or format change */}
        <motion.div
          key={`${glideCount}-${formatCount}`}
          initial={
            glideCount > 0 || formatCount > 0
              ? changeTypeRef.current === "date"
                ? {
                    opacity: 0.3,
                    x: slideDirectionRef.current * 25,
                    filter: "blur(0px)",
                  }
                : {
                    opacity: 0,
                    y: formatDirRef.current * -6,
                    filter: "blur(4px)",
                  }
              : false
          }
          animate={{
            opacity: 1,
            x: 0,
            y: 0,
            filter: "blur(0px)",
          }}
          transition={
            changeTypeRef.current === "date"
              ? { duration: 0.45, ease: [0.4, 0, 0.2, 1] }
              : { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }
          }
          className="relative flex h-full w-full"
        >
          {model.cells.map((cell) => {
            const { index } = cell;
            const isSelected = selectedTime !== undefined && selectedTime >= cell.time && selectedTime < cell.time + HOUR_MS;
            const isCurrentHour = isSelected || (selectedTime === undefined && isLive && Math.floor((realNow - model.start) / HOUR_MS) === index);
            const isHovered = hoveredHourIndex === index;
            const isNight = cell.isNight;
            const isMidnight = model.boundaries.some((boundary) => boundary.time === cell.time);
            const isWeekend = showWeekends && cell.isWeekend;

            return (
              <button
                type="button"
                key={cell.time}
                aria-label={cell.description}
                aria-pressed={isSelected}
                tabIndex={-1}
                disabled={!onSelectTime}
                onClick={() => {
                  onSelectTime?.(cell.time);
                  outerRef.current?.focus({ preventScroll: true });
                }}
                title={cell.description}
                data-timeline-cell={index}
                data-instant={new Date(cell.time).toISOString()}
                data-selected={isSelected || undefined}
                onMouseEnter={() => onHoverHour?.(index)}
                onMouseLeave={() => onHoverHour?.(null)}
                style={{
                  background: isSelected
                    ? "var(--dt-timeline-selection-bg)"
                    : isHovered ? "var(--dt-surface-highlight)"
                    : isNight
                      ? "var(--dt-night)"
                      : "var(--dt-bg)",
                }}
                className={clsx(
                  "relative grow shrink-0 basis-0 min-w-[3.25em]",
                  "flex flex-col items-center justify-center",
                  "pb-[0.25em] pt-[0.5em] group/hour",
                  "border-l border-transparent transition-colors duration-75",
                  onSelectTime && "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--dt-accent)]",
                )}
              >
                {isSelected && <span aria-hidden="true"
                  className={clsx("absolute top-[2px] h-[5px] w-[5px] rounded-full bg-[var(--dt-timeline-selection-text)]", !isHome && "md:hidden")} />}
                {/* Top Tick */}
                <div
                  className={clsx(
                    "absolute top-0 left-0 right-0 h-[0.25em] border-l",
                    isMidnight && !(!isLive && index === 0)
                      ? "border-[var(--dt-midnight-border)] h-[0.5em]"
                      : isMidnight && !isLive && index === 0
                        ? "border-transparent h-[0.5em]"
                        : "border-[var(--dt-tick)]",
                  )}
                />

                {/* Hour Label */}
                <div className="flex flex-col items-center z-0 gap-[0.125em]">
                  <span
                    className={clsx(
                      "text-[clamp(13px,0.78vw+5px,16.25px)] font-medium leading-none",
                      isSelected
                        ? "text-[var(--dt-timeline-selection-text)] font-bold"
                        : isCurrentHour
                        ? "text-[var(--dt-accent)] font-bold"
                        : "text-[var(--dt-hour-text)]",
                      isMidnight &&
                        !isCurrentHour &&
                        "text-[var(--dt-hour-midnight)]",
                    )}
                  >
                    {formatClock(cell.fields, !!use24Hour, false)}
                  </span>
                  {!use24Hour && (
                    <span
                      className={clsx(
                        "text-[clamp(10px,0.5vw+8px,12px)] leading-none",
                        isSelected
                          ? "text-[var(--dt-timeline-selection-text)]"
                          : isCurrentHour
                          ? "text-[var(--dt-accent-80)]"
                          : "text-[var(--dt-text-secondary)]",
                      )}
                    >
                      {cell.period}
                    </span>
                  )}
                </div>

                {/* Weekend indicator — thin bottom stripe */}
                {isWeekend && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--dt-accent)] opacity-40" />
                )}
              </button>
            );
          })}
          {model.boundaries.map((boundary) => (
            <div
              key={boundary.key}
              data-date-boundary={boundary.date}
              data-boundary-index={boundary.index}
              title={new Date(boundary.time).toISOString()}
              className={clsx(
                "absolute top-0 bottom-0 w-px bg-[var(--dt-midnight-line)] z-10 pointer-events-none",
                !isLive && boundary.index === 0 && "hidden",
              )}
              style={{ left: `${boundary.index / TOTAL_HOURS * 100}%` }}
            >
              <div className="absolute top-0 left-0 h-[0.5em] border-l border-[var(--dt-midnight-border)]" />
            </div>
          ))}
        </motion.div>
      </div>
      </div>

      {dims.outer > 0 && model.clockChanges.map(change => {
        const x = railOffset + change.index * cellWidth;
        if (x < 0 || x >= dims.outer) return null;
        const Icon = change.delta < 0 ? Undo2 : Redo2;
        return (
          <div key={change.time} className="timeline-clock-change"
            data-clock-change={new Date(change.time).toISOString()}
            data-change-seconds={change.delta}
            role="img" aria-label={change.description} style={{ left: x }}>
            <span className="timeline-clock-change-label" aria-hidden="true"
              style={x > dims.outer / 2 ? { right: 4 } : { left: 4 }}>
              <Icon size={12} aria-hidden="true" />{change.label}
            </span>
          </div>
        );
      })}
      {dims.outer > 0 && onShowClockChange && edgeChanges.map(edge => {
        if (!edge) return null;
        const { change, direction } = edge;
        const Icon = direction === "earlier" ? ChevronLeft : ChevronRight;
        const description = `${label ?? timezone}. ${change.description} ${direction === "earlier" ? "Before" : "After"} the visible timeline. Show clock change.`;
        return <button key={direction} type="button"
          className="timeline-clock-change-hint focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--dt-accent)]"
          data-clock-change={new Date(change.time).toISOString()}
          data-clock-change-edge={direction}
          aria-label={description} title={description}
          style={direction === "earlier" ? { left: 0 } : { right: 0 }}
          onClick={() => {
            onShowClockChange(change.time);
            outerRef.current?.focus({ preventScroll: true });
          }}>
          <span className="timeline-clock-change-label" aria-hidden="true">
            {direction === "earlier" && <Icon size={12} aria-hidden="true" />}
            {change.label}
            {direction === "later" && <Icon size={12} aria-hidden="true" />}
          </span>
        </button>;
      })}
    </div>
  );
};

export const Timeline = React.memo(TimelineInner);
