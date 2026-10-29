import { utcOffsetLabel } from "../../utils/formatOffset";
import React, { useState, useMemo, useRef, useLayoutEffect, useId, useCallback } from "react";
import { formatCalendarDate, getZonedFields } from "../../utils/calendarDate";
import { formatClock, dayPeriod } from "../../utils/timeline";
import { X, Home, ArrowUp, ArrowDown } from "lucide-react";
import {
  TimezoneConfig,
  getCityName,
  getRegionName,
  getCountryFromTimezone,
} from "../../utils/timezoneUtils";
import { Timeline } from "./Timeline";
import { motion, AnimatePresence } from "motion/react";
import { MorphingTime } from "./MorphingTime";
import { MAX_TEXT_LENGTH, validateLabelEdit } from "../../utils/labels";
import { EASE_OUT, EASE_IN } from "../../utils/animation";

interface TimezoneRowProps {
  config: TimezoneConfig;
  now: Date;
  timelineTime: Date;
  onRemove: (id: string, keyboard: boolean) => void;
  onRename: (id: string, newName: string) => void;
  onRenameTrigger?: (id: string, node: HTMLButtonElement | null, previous: HTMLButtonElement | null) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onSetHome: (id: string) => void;
  isHome?: boolean;
  homeTimezone?: string;
  isFirst?: boolean;
  isLast?: boolean;
  use24Hour: boolean;
  showBadge: boolean;
  showWeekends: boolean;
  hoveredHourIndex: number | null;
  onHoverHour: (index: number | null) => void;
  panHours?: number;
  onPan?: (hours: number) => void;
  onResetTimeline?: () => void;
  selectedTime?: number;
  onSelectTime?: (instant: number) => void;
  onShowClockChange?: (instant: number) => void;
  isLive: boolean;
  selectedDateOffset: number;
}

const TimezoneRowInner: React.FC<TimezoneRowProps> = ({
  config,
  now,
  timelineTime,
  onRemove,
  onRename,
  onRenameTrigger,
  onMove,
  onSetHome,
  isHome,
  homeTimezone,
  isFirst,
  isLast,
  use24Hour,
  showBadge,
  showWeekends,
  hoveredHourIndex,
  onHoverHour,
  panHours,
  onPan,
  onResetTimeline,
  selectedTime,
  onSelectTime,
  onShowClockChange,
  isLive,
  selectedDateOffset,
}) => {
  const { timezone, label } = config;
  const [isEditing, setIsEditing] = useState(false);
  const editing = useRef(false);
  const renameTrigger = useRef<HTMLButtonElement | null>(null);
  const registerRenameTrigger = useCallback((node: HTMLButtonElement | null) => {
    const previous = renameTrigger.current;
    renameTrigger.current = node;
    onRenameTrigger?.(config.id, node, previous);
  }, [config.id, onRenameTrigger]);
  const restoreFocus = useRef(false);
  const [editError, setEditError] = useState("");
  const errorId = useId();
  useLayoutEffect(() => {
    if (!isEditing && restoreFocus.current) {
      restoreFocus.current = false;
      renameTrigger.current?.focus();
    }
  }, [isEditing]);
  const [editName, setEditName] = useState(
    label || getCityName(timezone),
  );

  const [formatState, setFormatState] = useState({ use24Hour, direction: 1 });
  if (formatState.use24Hour !== use24Hour) {
    setFormatState({ use24Hour, direction: use24Hour ? 1 : -1 });
  }
  const nowTime = now.getTime();
  const fields = useMemo(() => getZonedFields(nowTime, timezone), [nowTime, timezone]);
  const localDate = fields.date;
  const dateString = useMemo(() => formatCalendarDate(localDate, { weekday: "short", month: "short", day: "numeric" }), [localDate]);
  const abbreviation = fields.abbreviation;
  const clock = `${formatClock(fields, use24Hour, true, true)}${use24Hour ? "" : ` ${dayPeriod(fields)}`}`;

  const cityName = label || getCityName(timezone);
  const regionName = getRegionName(timezone);
  const countryName = getCountryFromTimezone(timezone);

  const finishRename = (reason: "enter" | "blur" | "escape") => {
    if (!editing.current) return;
    if (reason !== "escape") {
      const result = validateLabelEdit(editName);
      if (result.kind === "invalid") { setEditError(result.error); return; }
      if (result.kind === "valid") onRename(config.id, result.value);
    }
    editing.current = false;
    restoreFocus.current = reason !== "blur";
    setEditName(cityName);
    setEditError("");
    setIsEditing(false);
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      finishRename(e.key === "Enter" ? "enter" : "escape");
    }
  };

  return (
    <div data-row-id={config.id} className="group relative grid grid-cols-[minmax(0,1fr)_auto_auto] md:grid-cols-[18em_8em_1fr] items-center bg-[var(--dt-bg)] hover:bg-[var(--dt-bg-hover)] transition-colors border-b border-[var(--dt-border)] last:border-0 py-4 md:py-0 md:h-[clamp(4.5em,8vh,6em)]">
      
      {/* ── 1. Left Info Section (City, Country, Controls) ── */}
      <div className="col-span-1 md:col-span-1 min-w-0 flex items-center pl-2 pr-2 gap-[0.75em]">
        {/* Controls */}
        <div className="flex flex-col gap-[0.125em] w-[1.25em] items-center justify-center">
          {isHome ? (
            <Home
              className="text-[var(--dt-text-muted)] w-[1em] h-[1em]"
            />
          ) : (
            <>
              <button
                onClick={event => onRemove(config.id, event.detail === 0)}
                className="md:hidden text-[var(--dt-text-muted)] hover:text-red-600 transition-colors p-0.5 rounded focus-visible:outline-2 focus-visible:outline-[var(--dt-accent)]"
                title="Remove timezone"
                aria-label={`Remove ${cityName}`}
              >
                <X className="w-[1em] h-[1em]" />
              </button>
              <div className="hidden md:flex opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 flex-col gap-[0.125em] transition-opacity">
                {!isFirst && (
                  <button
                    onClick={() => onMove(config.id, "up")}
                    className="text-[var(--dt-text-muted)] hover:text-[var(--dt-text-secondary)] p-0.5 rounded hover:bg-[var(--dt-surface-raised)] focus-visible:outline-2 focus-visible:outline-[var(--dt-accent)]"
                    aria-label={`Move ${cityName} up`}
                  >
                    <ArrowUp className="w-[1em] h-[1em]" />
                  </button>
                )}
                {!isLast && (
                  <button
                    onClick={() => onMove(config.id, "down")}
                    className="text-[var(--dt-text-muted)] hover:text-[var(--dt-text-secondary)] p-0.5 rounded hover:bg-[var(--dt-surface-raised)] focus-visible:outline-2 focus-visible:outline-[var(--dt-accent)]"
                    aria-label={`Move ${cityName} down`}
                  >
                    <ArrowDown className="w-[1em] h-[1em]" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[0.5em] h-[1.5em]">
            {isEditing ? (
              <div className="relative flex items-center w-full">
                <input
                  autoFocus
                  className="w-full text-[clamp(15px,0.84vw+6px,18px)] font-medium text-[var(--dt-text)] bg-transparent border-b border-[var(--dt-accent)] focus:outline-none p-0 leading-tight"
                  value={editName}
                  onChange={(e) => { setEditName(e.target.value); setEditError(""); }}
                  maxLength={MAX_TEXT_LENGTH}
                  aria-invalid={editError ? true : undefined}
                  aria-describedby={editError ? errorId : undefined}
                  onBlur={() => finishRename("blur")}
                  onKeyDown={handleKeyDown}
                  aria-label={`Edit ${cityName} label`}
                />
                {editError && <span id={errorId} role="status" className="absolute top-full left-0 z-20 rounded bg-[var(--dt-bg)] text-[var(--dt-text)] text-xs p-1">{editError}</span>}
              </div>
            ) : (
              <button
                type="button"
                ref={registerRenameTrigger}
                data-row-action="rename"
                aria-label={`Rename ${cityName}`}
                className="flex min-w-0 max-w-full items-center gap-[0.5em] cursor-pointer group/name rounded-sm text-left focus-visible:outline-2 focus-visible:outline-[var(--dt-accent)]"
                onClick={() => {
                  setEditName(cityName);
                  setEditError("");
                  editing.current = true;
                  setIsEditing(true);
                }}
              >
                <span
                  className={`text-[clamp(15px,0.84vw+6px,18px)] font-medium truncate transition-colors ${isHome ? "text-[var(--dt-accent)]" : "text-[var(--dt-text)] group-hover/name:text-[var(--dt-accent)]"}`}
                >
                  {cityName}
                </span>
                {showBadge && (
                  <span title={`${abbreviation} · ${utcOffsetLabel(fields.offsetSeconds)}`}
                  className="text-[clamp(10px,0.5vw+8px,12px)] font-medium text-[var(--dt-text-secondary)] border border-[var(--dt-border-strong)] px-[0.25em] rounded bg-[var(--dt-surface)]">
                    {abbreviation}
                  </span>
                )}
              </button>
            )}
          </div>
          <div className="text-[clamp(10px,0.5vw+8px,12px)] text-[var(--dt-text-secondary)] truncate flex items-center gap-[0.375em]">
            <span
              className="truncate w-full text-[clamp(13px,0.84vw+5.39px,16px)]"
              title={config.country}
            >
              {config.country || countryName || regionName}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. Current Time Section ── */}
      <div className="col-span-1 md:col-span-1 flex flex-col items-end justify-center pr-0 md:px-0 md:pr-[1.5em] md:border-r border-[var(--dt-border)] md:h-full overflow-hidden">
        <div className="flex flex-col items-end">
          <AnimatePresence mode="popLayout">
            <motion.time
              key={use24Hour ? "24h" : "12h"}
              data-testid="row-clock"
              dateTime={now.toISOString()}
              aria-label={clock}
              initial={{
                opacity: 0,
                y: formatState.direction * -6,
                filter: "blur(4px)",
              }}
              animate={{
                opacity: 1,
                y: 0,
                filter: "blur(0px)",
                transition: { duration: 0.25, ease: EASE_OUT },
              }}
              exit={{
                opacity: 0,
                y: formatState.direction * 6,
                filter: "blur(4px)",
                transition: { duration: 0.15, ease: EASE_IN },
              }}
              className="font-medium text-[var(--dt-text)] whitespace-nowrap text-[clamp(15px,0.84vw+6px,18px)]"
            >
              <MorphingTime>
                {clock}
              </MorphingTime>
            </motion.time>
          </AnimatePresence>
          <div
            className={`text-[clamp(13px,0.84vw+5.39px,16px)] whitespace-nowrap ${isHome ? "text-[var(--dt-accent)]" : "text-[var(--dt-text-secondary)]"}`}
          >
            {dateString}
          </div>
        </div>
      </div>

      {/* ── 3. Delete Button (Mobile Only: Column 3) ── */}
      <div className="md:hidden col-span-1 flex flex-col items-center justify-center gap-[0.125em] pl-[0.75em] pr-2">
        {!isHome && (
          <>
            {!isFirst && (
              <button
                onClick={() => onMove(config.id, "up")}
                className="text-[var(--dt-text-muted)] hover:text-[var(--dt-text-secondary)] p-0.5 rounded hover:bg-[var(--dt-surface-raised)] focus-visible:outline-2 focus-visible:outline-[var(--dt-accent)]"
                aria-label={`Move ${cityName} up`}
              >
                <ArrowUp className="w-[1em] h-[1em]" />
              </button>
            )}
            {!isLast && (
              <button
                onClick={() => onMove(config.id, "down")}
                className="text-[var(--dt-text-muted)] hover:text-[var(--dt-text-secondary)] p-0.5 rounded hover:bg-[var(--dt-surface-raised)] focus-visible:outline-2 focus-visible:outline-[var(--dt-accent)]"
                aria-label={`Move ${cityName} down`}
              >
                <ArrowDown className="w-[1em] h-[1em]" />
              </button>
            )}
          </>
        )}
      </div>

      {/* ── 4. Desktop Hover Actions (Absolute) ── */}
      {!isHome && (
        <div
          className="hidden md:flex absolute right-0 top-0 bottom-0 md:left-[18em] md:right-auto md:w-[8em] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 items-center justify-end pr-[1.5em] transition-opacity z-10 pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto"
          style={{
            background: `linear-gradient(to left, var(--dt-bg) 30%, transparent)`,
          }}
        >
          <button
            onClick={() => onSetHome(config.id)}
            className="p-[0.375em] text-[var(--dt-text-muted)] hover:text-[var(--dt-accent)] hover:bg-[var(--dt-surface-raised)] rounded-md transition-all mr-1 focus-visible:outline-2 focus-visible:outline-[var(--dt-accent)]"
            title="Set as home"
            aria-label={`Set ${cityName} as home timezone`}
          >
            <Home className="w-[1.25em] h-[1.25em]" />
          </button>
          <button
            onClick={event => onRemove(config.id, event.detail === 0)}
            className="p-[0.375em] text-[var(--dt-text-muted)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all focus-visible:outline-2 focus-visible:outline-[var(--dt-accent)]"
            title="Remove timezone"
            aria-label={`Remove ${cityName}`}
          >
            <X className="w-[1.25em] h-[1.25em]" />
          </button>
        </div>
      )}

      {/* ── 5. Timeline ── */}
      <div className="col-span-3 md:col-span-1 w-full h-[4.5em] md:h-full overflow-hidden relative border-t-0 border-transparent mt-3 md:mt-0 pt-0">
        <Timeline
          now={timelineTime}
          currentTime={now}
          panHours={panHours}
          onPan={onPan}
          onReset={onResetTimeline}
          selectedTime={selectedTime}
          onSelectTime={onSelectTime}
          onShowClockChange={onShowClockChange}
          timezone={timezone}
          label={cityName}
          isHome={isHome}
          isFirst={isFirst}
          isLast={isLast}
          homeTimezone={homeTimezone}
          use24Hour={use24Hour}
          className="h-full w-full border-0 rounded-none"
          hoveredHourIndex={hoveredHourIndex}
          onHoverHour={onHoverHour}
          isLive={isLive}
          selectedDateOffset={selectedDateOffset}
          showWeekends={showWeekends}
        />
      </div>
    </div>
  );
};

export const TimezoneRow = React.memo(TimezoneRowInner);
