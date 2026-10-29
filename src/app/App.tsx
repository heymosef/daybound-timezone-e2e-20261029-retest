import { initializeTheme } from "../utils/theme";
import { useTheme } from "../hooks/useTheme";
import { formatZonedClock, PAN_LIMIT_HOURS } from "../utils/timeline";
import { canonicalTimezone } from "../utils/bundledTimezones";
import React, { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from "react";
import { Clock, SquareTerminal, X } from "lucide-react";
import { useAnalytics } from "../analytics/AnalyticsProvider";
import { pickerCity, pickerResultId } from "../utils/cityCatalog";
import { settingsChanges } from "../analytics/structuredEvents";
import { useTime } from "../hooks/useTime";
import { usePersistentState } from "../hooks/useStorage";
import {
  DEFAULT_SETTINGS,
  decodeExternalTimezoneConfig, decodeExternalAppSettings, decodeExternalNoticeDismissed,
  parseAppSettings,
  parseTimezoneConfig,
  parseNoticeDismissed,
} from "../utils/persistence";
import {
  TimezoneConfig,
  AppSettings,
  getCityName,
} from "../utils/timezoneUtils";
import { LIVE_SELECTION, calendarDifference, getZonedFields, HOUR_MS, onCalendarDate, startOfCalendarDate, type DateSelection } from "../utils/calendarDate";
import { TimezoneRow } from "./components/TimezoneRow";
import { StorageConflictNotice } from "./components/StorageConflictNotice";
import { UndoCityRemoval } from "./components/UndoCityRemoval";
import { AddTimezone } from "./components/AddTimezone";
import { DatePicker } from "./components/DatePicker";
import { SettingsMenu } from "./components/SettingsMenu";
import {
  MotionConfig,
  motion,
  AnimatePresence,
  LayoutGroup,
} from "motion/react";
import { validateLabelEdit } from "../utils/labels";
import { registerSquircle } from "../utils/squircle";
import Daybound from "../imports/Daybound";

// Register the squircle paint worklet for smooth corners (idempotent)
registerSquircle();

// Paint the saved theme before React’s first render.
initializeTheme();

function App() {
  const now = useTime();
  const [timezones, setTimezones, timezonePersistence, timezoneStorage] =
    usePersistentState<TimezoneConfig[]>("timezone_config", [], parseTimezoneConfig, decodeExternalTimezoneConfig);
  const [settings, setSettings, settingsPersistence, settingsStorage] =
    usePersistentState<AppSettings>(
      "app_settings",
      DEFAULT_SETTINGS,
      parseAppSettings,
      decodeExternalAppSettings,
    );
  const [localSaveNoticeDismissed, setLocalSaveNoticeDismissed, noticePersistence, noticeStorage] =
    usePersistentState<boolean>(
      "local_save_notice_dismissed",
      false,
      parseNoticeDismissed,
      decodeExternalNoticeDismissed,
    );

  const main = useRef<HTMLElement>(null);
  const renameButtons = useRef(new Map<string, HTMLButtonElement>());
  const undoAction = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const registerRenameTrigger = useCallback((id: string, node: HTMLButtonElement | null, previous: HTMLButtonElement | null) => {
    if (node) renameButtons.current.set(id, node);
    else if (renameButtons.current.get(id) === previous) renameButtons.current.delete(id);
  }, []);
  const [removed, setRemoved] = useState<{
    token: string; row: TimezoneConfig; index: number; before?: string; after?: string; revision: number;
  } | null>(null);
  const [cityFeedback, setCityFeedback] = useState("");
  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const fallback = timezones.find(row => row.isHome) ?? timezones[0];
    const button = target === "undo" ? undoAction.current : renameButtons.current.get(target);
    const current = target === "undo" || timezones.some(row => row.id === target);
    if (current && button?.isConnected) button.focus();
    else if (fallback && renameButtons.current.get(fallback.id)?.isConnected) renameButtons.current.get(fallback.id)?.focus();
    else main.current?.focus();
  });
  const clearUndo = useCallback(() => {
    if (undoAction.current === document.activeElement) pendingFocus.current = "fallback";
    setRemoved(null);
  }, []);
  useLayoutEffect(() => {
    if (!removed) return;
    if (removed.revision !== timezoneStorage.externalRevision || timezoneStorage.conflict) clearUndo();
    else if (timezones.some(row => row.id === removed.row.id || row.timezone === removed.row.timezone)) {
      setCityFeedback("City is already added.");
      clearUndo();
    }
  }, [removed, timezones, timezoneStorage.externalRevision, timezoneStorage.conflict, clearUndo]);

  const savingUnavailable = [timezonePersistence, settingsPersistence, noticePersistence, noticeStorage].includes("unavailable");
  const hasSaveConflict = Boolean(timezoneStorage.conflict || settingsStorage.conflict || noticeStorage.conflict);
  const showSaveNotice = savingUnavailable || (!hasSaveConflict && !localSaveNoticeDismissed);
  useTheme(settings);

  const { capture } = useAnalytics();

  const handleSettingsChange = useCallback((next: AppSettings) => {
    setSettings(next);
    for (const event of settingsChanges(settings, next)) capture("settings_changed", event);
  }, [capture, settings, setSettings]);

  const [initialized, setInitialized] = useState(false);
  // A selected clock instant is independent of the shared rail's browsing position.
  const [view, setView] = useState<{
    base: number; hours: number; centered: boolean; selected: number | null; calendarTime: number;
  } | null>(null);
  const [dateFeedback, setDateFeedback] = useState("");
  const [hoveredHourIndex, setHoveredHourIndex] = useState<
    number | null
  >(null);

  const homeTimezone =
    timezones.find((t) => t.isHome)?.timezone ||
    timezones[0]?.timezone ||
    canonicalTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
  const homeToday = getZonedFields(now, homeTimezone).date;
  const clockTime = view?.selected != null ? new Date(view.selected) : now;
  const timelineTime = view ? new Date(view.base) : now;
  const isLive = view?.centered ?? true;
  const surfacedSelection: DateSelection = view
    ? { mode: "date", date: getZonedFields(view.calendarTime, homeTimezone).date }
    : LIVE_SELECTION;
  const selectedDateOffset = surfacedSelection.mode === "date" ? calendarDifference(surfacedSelection.date, homeToday) : 0;
  const nowTime = now.getTime();
  const handlePanTimeline = useCallback((delta: number) => {
    if (!Number.isFinite(delta)) return;
    setView(previous => {
      const origin = previous ?? { base: nowTime, hours: 0, centered: true, selected: null, calendarTime: nowTime };
      const hours = Math.max(-PAN_LIMIT_HOURS, Math.min(PAN_LIMIT_HOURS, origin.hours + delta));
      return { ...origin, hours, calendarTime: Math.trunc(origin.base + hours * HOUR_MS) };
    });
    setHoveredHourIndex(null);
  }, [nowTime]);
  const handleSelectTime = useCallback((instant: number) => {
    setView(previous => {
      if (previous?.selected != null && previous.selected >= instant && previous.selected < instant + HOUR_MS) {
        return { ...previous, selected: null };
      }
      return {
        ...(previous ?? { base: nowTime, hours: 0, centered: true }),
        selected: instant, calendarTime: instant,
      };
    });
    setHoveredHourIndex(null);
  }, [nowTime]);
  const handleShowClockChange = useCallback((instant: number) => {
    setView(previous => ({ base: instant, hours: 0, centered: true,
      selected: previous?.selected ?? null, calendarTime: instant }));
    setHoveredHourIndex(null);
  }, []);
  const returnToNow = useCallback(() => {
    setView(null);
    setHoveredHourIndex(null);
    document.querySelector<HTMLButtonElement>('[aria-current="date"]')?.focus();
  }, []);

  const timezoneIds = useMemo(() => timezones.map((timezone) => timezone.timezone), [timezones]);

  const handleSelectDate = useCallback((next: DateSelection) => {
    if (next.mode === "live") {
      setView(null);
      setDateFeedback("");
      setHoveredHourIndex(null);
      return;
    }
    const start = startOfCalendarDate(next.date, homeTimezone);
    if (start === null) {
      setDateFeedback("This date does not exist in the home timezone. Choose another date.");
      return;
    }
    setDateFeedback("");
    const selected = onCalendarDate(next.date, view?.selected ?? nowTime, homeTimezone);
    setView({ base: start.getTime(), hours: 0, centered: false, selected, calendarTime: selected });
    setHoveredHourIndex(null);
  }, [homeTimezone, nowTime, view?.selected]);

  // Initialize default timezone if empty
  useEffect(() => {
    if (!initialized) {
      if (timezones.length === 0) {
        try {
          const localZone =
            canonicalTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
          const newTimezone: TimezoneConfig = {
            id: crypto.randomUUID(),
            timezone: localZone,
            isHome: true,
          };
          setTimezones([newTimezone]);
        } catch (e) {
          console.error("Failed to detect timezone", e);
        }
      }
      setInitialized(true);
    }
  }, [
    timezones.length,
    initialized,
    setTimezones,
  ]);

  const handleAddTimezone = useCallback((
    timezone: string,
    label?: string,
  ) => {
    // Avoid duplicates
    if (timezones.some((tz) => tz.timezone === timezone))
      return;

    const standardCity = pickerCity(pickerResultId(timezone, label ?? getCityName(timezone)));
    const newTimezone: TimezoneConfig = {
      id: crypto.randomUUID(),
      timezone,
      isHome: false,
      ...(label ? { label } : {}),
      ...(standardCity ? { city: standardCity.name } : {}),
    };
    const updated = [...timezones, newTimezone];
    setTimezones(previous => previous.some(row => row.timezone === timezone)
      ? previous : [...previous, { ...newTimezone, isHome: previous.length === 0 }]);
    capture("timezone_added", { timezone_count_after: updated.length });
  }, [capture, setTimezones, timezones]);

  const handleRemoveTimezone = useCallback((id: string, keyboard = true) => {
    const index = timezones.findIndex(row => row.id === id);
    const row = timezones[index];
    if (!row || row.isHome) return;
    if (document.activeElement?.closest("[data-row-id]")?.getAttribute("data-row-id") === id) pendingFocus.current = keyboard ? "undo" : "fallback";
    setRemoved({ token: crypto.randomUUID(), row, index, before: timezones[index - 1]?.id,
      after: timezones[index + 1]?.id, revision: timezoneStorage.externalRevision });
    setCityFeedback("");
    setTimezones(previous => previous.filter(item => item.id !== id));
    capture("timezone_removed", { timezone_count_after: timezones.length - 1 });
  }, [capture, setTimezones, timezones, timezoneStorage.externalRevision]);
  const undoRemoval = useCallback(() => {
    if (!removed || timezoneStorage.conflict || removed.revision !== timezoneStorage.externalRevision) { clearUndo(); return; }
    if (timezones.some(row => row.id === removed.row.id || row.timezone === removed.row.timezone)) {
      setCityFeedback("City is already added."); clearUndo(); return;
    }
    pendingFocus.current = removed.row.id;
    setTimezones(previous => {
      if (previous.some(row => row.id === removed.row.id || row.timezone === removed.row.timezone)) return previous;
      const next = [...previous];
      const following = next.findIndex(row => row.id === removed.after);
      const preceding = next.findIndex(row => row.id === removed.before);
      const index = following >= 0 ? following : preceding >= 0 ? preceding + 1 : Math.min(removed.index, next.length);
      next.splice(index, 0, { ...removed.row, isHome: false });
      return next;
    });
    setRemoved(null);
  }, [removed, timezones, timezoneStorage.conflict, timezoneStorage.externalRevision, setTimezones, clearUndo]);

  const handleRename = useCallback((id: string, newLabel: string) => {
    const result = validateLabelEdit(newLabel);
    if (result.kind !== "valid") return;
    setTimezones((previous) =>
      previous.map((tz) =>
        tz.id === id ? { ...tz, label: result.value } : tz,
      ),
    );
    capture("timezone_renamed");
  }, [capture, setTimezones]);

  const moveTimezone = useCallback((
    id: string,
    direction: "up" | "down",
  ) => {
    const index = timezones.findIndex((tz) => tz.id === id);
    if (index === -1) return;

    const newTimezones = [...timezones];
    if (direction === "up" && index > 0) {
      [newTimezones[index], newTimezones[index - 1]] = [
        newTimezones[index - 1],
        newTimezones[index],
      ];
    } else if (
      direction === "down" &&
      index < newTimezones.length - 1
    ) {
      [newTimezones[index], newTimezones[index + 1]] = [
        newTimezones[index + 1],
        newTimezones[index],
      ];
    }
    setTimezones(newTimezones);
    capture("timezone_reordered", { direction });
  }, [capture, setTimezones, timezones]);

  const handleSetHome = useCallback((id: string) => {
    const newTimezones = timezones.map((tz) => ({
      ...tz,
      isHome: tz.id === id,
    }));
    
    // Move new home to top
    const homeTz = newTimezones.find((tz) => tz.id === id);
    const others = newTimezones.filter((tz) => tz.id !== id);
    
    if (homeTz) {
      setTimezones([homeTz, ...others]);
      setView(previous => previous?.selected != null ? { ...previous, calendarTime: previous.selected } : null);
      if (!timezones.find((tz) => tz.id === id)?.isHome) {
        const city = homeTz.city ? pickerCity(pickerResultId(homeTz.timezone, homeTz.city)) : undefined;
        capture("home_timezone_changed", { reference_timezone: homeTz.timezone,
          ...(city ? { reference_result_id: city.id } : {}) });
      }
    }
  }, [capture, setTimezones, timezones]);

  const adoptSavedCities = () => {
    const conflict = timezoneStorage.conflict;
    if (timezoneStorage.resolveFromStorage()) {
      pendingFocus.current = "fallback";
      if (conflict && (conflict.kind === "valid" || conflict.kind === "absent")) {
        const nextHome = conflict.value.find(row => row.isHome)?.timezone ?? conflict.value[0]?.timezone;
        if (nextHome !== homeTimezone) setView(previous => previous?.selected != null ? { ...previous, calendarTime: previous.selected } : null);
      }
    }
  };
  const resolveNotice = (action: () => boolean) => { if (action()) pendingFocus.current = "fallback"; };

  // Render main app
  return (
    <MotionConfig reducedMotion="user">
      {/* Fixed background layer — guarantees the entire viewport
          (including behind iOS safe areas / Android nav bar)
          is painted with the correct theme background color. */}
      <div
        className="fixed inset-0 bg-[var(--dt-bg)] transition-colors duration-200"
        style={{ zIndex: -1 }}
        aria-hidden="true"
      />
      <div className="min-h-dvh bg-[var(--dt-bg)] text-[var(--dt-text)] transition-colors duration-200 text-[clamp(16px,0.96vw+6.15px,18px)] flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }}>
        {/* Main Content */}
        <main ref={main} tabIndex={-1} className="max-w-[1920px] w-full mx-auto px-[clamp(8px,2.5vw,32px)] py-[clamp(16px,5vw,64px)] flex-grow flex flex-col gap-[1em]">
          
          {/* Header */}
          <div className="header-controls flex flex-col gap-6">
            <div className="flex-shrink-0 md:hidden flex justify-center pt-1">
              <Daybound className="h-8 text-[var(--dt-logo)] transition-colors aspect-[347/68]" />
            </div>

            <div className="flex flex-col md:flex-row items-stretch gap-[1em] md:gap-[1.5em]">
              <div className="flex-shrink-0 w-full md:w-auto">
                <AddTimezone
                  onAdd={handleAddTimezone}
                  existingTimezones={timezoneIds}
                />
              </div>

              {/* Group Date Picker and Settings for better mobile layout */}
              <div className="flex flex-row items-stretch gap-[0.5em] flex-grow min-w-0">
                <DatePicker
                  selection={surfacedSelection}
                  onSelectDate={handleSelectDate}
                  now={now}
                  homeTimezone={homeTimezone}
                />

                {/* Right Actions */}
                <div className="flex-shrink-0 flex items-stretch md:ml-auto">
                  <SettingsMenu
                    settings={settings}
                    onSettingsChange={handleSettingsChange}
                    timezones={timezones}
                    onSetHome={handleSetHome}
                  />
                </div>
              </div>
            </div>
          </div>

          <div role="status" aria-label="Local save status" className={showSaveNotice ? undefined : "sr-only"}>
            {showSaveNotice && (
              <div
                className="flex items-center gap-[0.625em] p-[0.75em] bg-[var(--dt-accent-wash)] rounded-sm text-[var(--dt-text-secondary)]"
              >
                <span className="flex-grow text-[clamp(12px,0.6vw+9px,14px)] leading-normal">
                  {savingUnavailable
                    ? "Changes work for this visit, but cannot be saved on this device."
                    : "Your changes are saved locally on this device. You can close this page and come back anytime."}
                </span>
                {!savingUnavailable && <button
                  type="button"
                  aria-label="Dismiss local save notice"
                  onClick={() => setLocalSaveNoticeDismissed(true)}
                  className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md text-[var(--dt-text-muted)] hover:text-[var(--dt-text)] hover:bg-[var(--dt-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dt-accent)] transition-colors"
                >
                  <X size={16} />
                </button>}
              </div>
            )}
          </div>

          {timezoneStorage.conflict && <StorageConflictNotice group="Cities" conflict={timezoneStorage.conflict}
            preview={rows => rows.length ? rows.map(row => row.label || getCityName(row.timezone)).join(", ") : "an empty city list"}
            clearedAction="Use cleared city list" onUseSaved={adoptSavedCities}
            onReplace={() => resolveNotice(timezoneStorage.replaceFromDraft)} onRetry={timezoneStorage.retryExternalRead} />}
          {settingsStorage.conflict && <StorageConflictNotice group="Display settings" conflict={settingsStorage.conflict}
            preview={value => `${value.use24Hour ? "24-hour" : "12-hour"} time, ${value.theme} appearance, ${value.designTheme} design, timezone badges ${value.showBadge ? "on" : "off"}, weekends ${value.showWeekends ? "shown" : "hidden"}`}
            clearedAction="Use default settings" onUseSaved={() => resolveNotice(settingsStorage.resolveFromStorage)}
            onReplace={() => resolveNotice(settingsStorage.replaceFromDraft)} onRetry={settingsStorage.retryExternalRead} />}
          {noticeStorage.conflict && <StorageConflictNotice group="Save notice" conflict={noticeStorage.conflict}
            preview={value => value ? "save notice hidden" : "save notice shown"}
            clearedAction="Show local save notice" onUseSaved={() => resolveNotice(noticeStorage.resolveFromStorage)}
            onReplace={() => resolveNotice(noticeStorage.replaceFromDraft)} onRetry={noticeStorage.retryExternalRead} />}
          <AnimatePresence>
            {removed && <UndoCityRemoval token={removed.token} city={removed.row.label || getCityName(removed.row.timezone)}
              actionRef={undoAction} onUndo={undoRemoval} onExpire={clearUndo} />}
          </AnimatePresence>
          {cityFeedback && <p role="status" className="text-sm">{cityFeedback}</p>}

          {dateFeedback && <p role="status" className="text-sm text-[var(--dt-text-secondary)]">{dateFeedback}</p>}
          <p role="status" aria-label="Selected time" className="sr-only">
            {view?.selected != null ? `${getZonedFields(view.selected, homeTimezone).date}, ${formatZonedClock(clockTime, homeTimezone, settings.use24Hour)} in ${getCityName(homeTimezone)}. All city clocks show this moment.` : "Showing live time."}
          </p>
          <div className="divide-y divide-[var(--dt-border)]">
            {timezones.length === 0 ? (
              <div className="py-20 text-center">
                <div className="w-12 h-12 bg-[var(--dt-surface)] rounded-full flex items-center justify-center mx-auto mb-4 text-[var(--dt-text-muted)]">
                  <Clock size={24} />
                </div>
                <p className="font-medium text-[var(--dt-text)] mb-1 text-[1.1em]">
                  No timezones added
                </p>
                <p className="text-[var(--dt-text-secondary)] text-[0.9em]">
                  Press{" "}
                  <kbd className="border border-[var(--dt-border-strong)] px-1 rounded bg-[var(--dt-kbd-bg)] text-[0.9em]">
                    K
                  </kbd>{" "}
                  or use the search bar to add one.
                </p>
              </div>
            ) : (
            <LayoutGroup>
                <AnimatePresence>
                  {timezones.map((tz, index) => (
                    <motion.div
                      key={tz.id}
                      layout="position"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{
                        opacity: 0,
                        y: 8,
                        transition: {
                          duration: 0.15,
                          ease: [0.4, 0, 1, 1],
                        },
                      }}
                      transition={{
                        layout: {
                          duration: 0.25,
                          ease: [0.4, 0, 0.2, 1],
                        },
                        duration: 0.3,
                        ease: [0, 0, 0.2, 1],
                      }}
                    >
                      <TimezoneRow
                        config={tz}
                        now={clockTime}
                        timelineTime={timelineTime}
                        panHours={view?.hours ?? 0}
                        selectedTime={view?.selected ?? undefined}
                        onSelectTime={handleSelectTime}
                        onShowClockChange={handleShowClockChange}
                        onPan={handlePanTimeline}
                        onResetTimeline={returnToNow}
                        onRemove={handleRemoveTimezone}
                        onRename={handleRename}
                        onRenameTrigger={registerRenameTrigger}
                        onMove={moveTimezone}
                        onSetHome={handleSetHome}
                        isHome={tz.isHome}
                        homeTimezone={
                          timezones.find((t) => t.isHome)
                            ?.timezone || timezones[0]?.timezone
                        }
                        isFirst={index === 0}
                        isLast={index === timezones.length - 1}
                        use24Hour={settings.use24Hour}
                        showBadge={settings.showBadge ?? true}
                        showWeekends={
                          settings.showWeekends ?? false
                        }
                        hoveredHourIndex={hoveredHourIndex}
                        onHoverHour={setHoveredHourIndex}
                        isLive={isLive}
                        selectedDateOffset={selectedDateOffset}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </LayoutGroup>
            )}
          </div>
          <footer className="mt-auto flex items-center justify-center pt-6 md:justify-between">
            <Daybound className="hidden h-8 text-[var(--dt-logo)] transition-colors opacity-50 hover:opacity-100 aspect-[347/68] md:block" />
            <div className="flex items-center gap-1 whitespace-nowrap text-xs text-[var(--dt-text-muted)]">
              {/* Plain corners avoid the global rounded-* paint mask hiding small footer elements. */}
              <span aria-hidden="true" className="mr-1 flex size-6 shrink-0 items-center justify-center [border-radius:5px] bg-[var(--dt-surface)]">
                <SquareTerminal size={16} strokeWidth={1.5} />
              </span>
              <span>Made by</span>
              <a
                href="https://www.heymosef.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="@heymosef — personal website (opens in a new tab)"
                className="inline-flex min-h-11 items-center text-[var(--dt-text-secondary)] underline decoration-[var(--dt-border-strong)] underline-offset-4 transition-colors hover:text-[var(--dt-accent)] hover:decoration-[var(--dt-accent)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--dt-accent)]"
              >
                @heymosef
              </a>
            </div>
          </footer>
        </main>
      </div>
    </MotionConfig>
  );
}

export default App;
