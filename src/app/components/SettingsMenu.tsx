import React, { useRef, useEffect, useState, useCallback, useId } from "react";
import {
  Settings,
  Check,
} from "lucide-react";
import { AppSettings, TimezoneConfig, getCityName } from "../../utils/timezoneUtils";
import { motion, AnimatePresence } from "motion/react";
import { useAnalytics } from "../../analytics/AnalyticsProvider";
import { EASE_OUT, EASE_IN } from "../../utils/animation";
import { Credits } from "./Credits";

interface SettingsMenuProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  timezones: TimezoneConfig[];
  onSetHome: (id: string) => void;
}

export const SettingsMenu: React.FC<SettingsMenuProps> = ({
  settings,
  onSettingsChange,
  timezones,
  onSetHome,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const analytics = useAnalytics();
  const analyticsDescriptionId = useId();
  const homeSelectId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // AnimatePresence keeps the dropdown mounted during exit animation.
  // Mark it inert so exiting content can't capture keyboard focus.
  const makeDropdownInert = useCallback(() => {
    const panel = menuRef.current?.querySelector('[role="menu"]');
    if (panel) (panel as HTMLElement).inert = true;
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        makeDropdownInert();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );
  }, [isOpen, makeDropdownInert]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        makeDropdownInert();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () =>
        document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, makeDropdownInert]);

  const update = (patch: Partial<AppSettings>) => {
    onSettingsChange({ ...settings, ...patch });
  };

  const designTheme = settings.designTheme || "te-1";
  const theme = settings.theme || "system";
  const showBadge = settings.showBadge ?? true;
  const showWeekends = settings.showWeekends ?? false;

  return (
    <div className="relative h-full" ref={menuRef}>
      <button
        ref={triggerRef}
        onClick={() => {
          if (isOpen) makeDropdownInert();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center justify-center gap-[0.375em] p-[0.5em] lg:px-[0.75em] lg:py-[0.375em] bg-[var(--dt-control-bg)] text-[var(--dt-text-secondary)] hover:text-[var(--dt-text)] rounded-md transition-colors duration-200 h-full min-w-[2.5em] ${
          isOpen
            ? "lg:bg-[var(--dt-control-active)] lg:text-[var(--dt-text)] lg:drop-shadow-sm"
            : "lg:bg-transparent lg:hover:bg-[var(--dt-control-bg)]"
        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dt-accent)]`}
        title="Settings"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Settings
          size={18}
          className="transition-transform duration-200 flex-shrink-0"
          style={{
            transform: isOpen
              ? "rotate(60deg)"
              : "rotate(0deg)",
          }}
        />
        <span className="hidden lg:inline text-[clamp(12px,0.72vw+4.62px,15px)] font-medium">
          Settings
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              transition: { duration: 0.2, ease: EASE_OUT },
            }}
            exit={{
              opacity: 0,
              scale: 0.96,
              y: -4,
              transition: { duration: 0.12, ease: EASE_IN },
            }}
            className="absolute right-0 top-full mt-[0.5em] w-[16em] bg-[var(--dt-search-dropdown)] rounded-lg [filter:drop-shadow(0px_16px_40px_rgba(0,0,0,0.2))_drop-shadow(0px_8px_16px_rgba(0,0,0,0.1))] border border-[var(--dt-border-strong)] overflow-hidden z-50 ring-1 ring-black/5"
            style={{ transformOrigin: "top right" }}
            role="menu"
          >
            {/* Home City (Mobile Only) */}
            <div className="md:hidden p-[0.75em] border-b border-[var(--dt-border)]">
              <label htmlFor={homeSelectId} className="block text-[clamp(10px,0.6vw+3.85px,12.5px)] font-semibold text-[var(--dt-text-muted)] uppercase tracking-wider mb-[0.5em]">
                Home City
              </label>
              <div className="relative">
                <select
                  id={homeSelectId}
                  value={timezones.find((t) => t.isHome)?.id || ""}
                  onChange={(e) => {
                    onSetHome(e.target.value);
                  }}
                  className="w-full appearance-none bg-[var(--dt-control-bg)] text-[var(--dt-text)] pl-[0.75em] pr-[2em] py-[0.375em] rounded-md text-[clamp(12px,0.72vw+4.62px,15px)] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dt-accent)] cursor-pointer hover:bg-[var(--dt-surface-raised)] transition-colors truncate"
                >
                  {timezones.map((tz) => (
                    <option key={tz.id} value={tz.id}>
                      {tz.label || getCityName(tz.timezone)}
                    </option>
                  ))}
                </select>
                <div className="absolute right-[0.75em] top-1/2 -translate-y-1/2 pointer-events-none text-[var(--dt-text-secondary)]">
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Time Format */}
            <div className="p-[0.75em] border-b border-[var(--dt-border)]">
              <div className="text-[clamp(10px,0.6vw+3.85px,12.5px)] font-semibold text-[var(--dt-text-muted)] uppercase tracking-wider mb-[0.5em]">
                Time Format
              </div>
              <div className="flex bg-[var(--dt-control-bg)] p-[0.125em] rounded-md">
                {[false, true].map((is24h) => (
                  <button
                    key={is24h ? "24h" : "12h"}
                    onClick={() => update({ use24Hour: is24h })}
                    className={`flex-1 px-[0.5em] py-[0.25em] font-medium rounded-sm transition-all duration-200 text-[clamp(11px,0.66vw+4.23px,13.75px)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dt-accent)] ${
                      settings.use24Hour === is24h
                        ? "bg-[var(--dt-control-active)] text-[var(--dt-text)] drop-shadow-sm"
                        : "text-[var(--dt-text-secondary)] hover:text-[var(--dt-text)]"
                    }`}
                    role="menuitemradio"
                    aria-checked={settings.use24Hour === is24h}
                  >
                    {is24h ? "24H" : "12H"}
                  </button>
                ))}
              </div>
            </div>

            {/* Appearance */}
            <div className="p-[0.75em] border-b border-[var(--dt-border)]">
              <div className="text-[clamp(10px,0.6vw+3.85px,12.5px)] font-semibold text-[var(--dt-text-muted)] uppercase tracking-wider mb-[0.5em]">
                Appearance
              </div>
              <div className="flex bg-[var(--dt-control-bg)] p-[0.125em] rounded-md mb-[0.5em]">
                {(["light", "dark", "system"] as const).map(
                  (t) => {
                    const isSelected = theme === t;
                    return (
                      <button
                        key={t}
                        onClick={() => update({ theme: t })}
                        className={`flex-1 flex items-center justify-center px-[0.375em] py-[0.25em] font-medium rounded-sm transition-all duration-200 text-[clamp(11px,0.66vw+4.23px,13.75px)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dt-accent)] ${
                          isSelected
                            ? "bg-[var(--dt-control-active)] text-[var(--dt-text)] drop-shadow-sm"
                            : "text-[var(--dt-text-secondary)] hover:text-[var(--dt-text)]"
                        }`}
                        role="menuitemradio"
                        aria-checked={isSelected}
                      >
                        <span>
                          {t.charAt(0).toUpperCase() +
                            t.slice(1)}
                        </span>
                      </button>
                    );
                  },
                )}
              </div>

              {/* Design Theme */}
              <div className="flex bg-[var(--dt-control-bg)] p-[0.125em] rounded-md">
                {(["te-1", "gamut", "dos"] as const).map((dt) => {
                  const isActive = designTheme === dt;
                  let label = "TE-1";
                  if (dt === "gamut") label = "Gamut";
                  if (dt === "dos") label = "DOS";

                  return (
                    <button
                      key={dt}
                      onClick={() =>
                        update({ designTheme: dt })
                      }
                      className={`flex-1 flex items-center justify-center px-[0.375em] py-[0.25em] font-medium rounded-sm transition-all duration-200 text-[clamp(11px,0.66vw+4.23px,13.75px)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dt-accent)] ${
                        isActive
                          ? "bg-[var(--dt-control-active)] text-[var(--dt-text)] drop-shadow-sm"
                          : "text-[var(--dt-text-secondary)] hover:text-[var(--dt-text)]"
                      }`}
                      role="menuitemradio"
                      aria-checked={isActive}
                      title={
                        dt === "gamut"
                          ? "Gamut theme"
                          : dt === "te-1"
                          ? "TE-1 theme"
                          : "DOS theme"
                      }
                    >
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Display Options */}
            <div className="p-[0.75em]">
              <div className="text-[clamp(10px,0.6vw+3.85px,12.5px)] font-semibold text-[var(--dt-text-muted)] uppercase tracking-wider mb-[0.5em]">
                Display
              </div>
              <div className="space-y-[0.125em]">
                {/* Show Badge Toggle */}
                <button
                  onClick={() =>
                    update({ showBadge: !showBadge })
                  }
                  className="w-full flex items-center justify-between px-[0.5em] py-[0.375em] rounded-md text-[clamp(12px,0.72vw+4.62px,15px)] text-[var(--dt-text-secondary)] hover:text-[var(--dt-text)] hover:bg-[var(--dt-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dt-accent)] transition-colors"
                  role="menuitemcheckbox"
                  aria-checked={showBadge}
                >
                  <span>Timezone badge</span>
                  <span
                    className={`flex items-center justify-center w-[1.25em] h-[1.25em] rounded border transition-all ${
                      showBadge
                        ? "bg-[var(--dt-accent)] border-[var(--dt-accent)]"
                        : "border-[var(--dt-border-strong)] bg-transparent"
                    }`}
                  >
                    {showBadge && (
                      <Check
                        size={10}
                        className="text-[var(--dt-text-inverse)]"
                      />
                    )}
                  </span>
                </button>

                {/* Show Weekends Toggle */}
                <button
                  onClick={() =>
                    update({ showWeekends: !showWeekends })
                  }
                  className="w-full flex items-center justify-between px-[0.5em] py-[0.375em] rounded-md text-[clamp(12px,0.72vw+4.62px,15px)] text-[var(--dt-text-secondary)] hover:text-[var(--dt-text)] hover:bg-[var(--dt-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dt-accent)] transition-colors"
                  role="menuitemcheckbox"
                  aria-checked={showWeekends}
                >
                  <span>Indicate weekends</span>
                  <span
                    className={`flex items-center justify-center w-[1.25em] h-[1.25em] rounded border transition-all ${
                      showWeekends
                        ? "bg-[var(--dt-accent)] border-[var(--dt-accent)]"
                        : "border-[var(--dt-border-strong)] bg-transparent"
                    }`}
                  >
                    {showWeekends && (
                      <Check
                        size={10}
                        className="text-[var(--dt-text-inverse)]"
                      />
                    )}
                  </span>
                </button>
              </div>
            </div>
            <div className="p-[0.75em] border-t border-[var(--dt-border)]">
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={analytics.enabled}
                aria-describedby={analyticsDescriptionId}
                disabled={!analytics.available}
                onClick={() => analytics.setEnabled(!analytics.enabled)}
                className="w-full flex items-center justify-between gap-2 px-[0.5em] py-[0.375em] rounded-md text-[clamp(12px,0.66vw+4.62px,15px)] text-[var(--dt-text-secondary)] hover:bg-[var(--dt-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dt-accent)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                <span>Allow usage analytics</span>
                <span aria-hidden="true" className={`flex items-center justify-center w-[1.25em] h-[1.25em] shrink-0 rounded border ${analytics.enabled ? "bg-[var(--dt-accent)] border-[var(--dt-accent)]" : "border-[var(--dt-border-strong)]"}`}>
                  {analytics.enabled && <Check size={10} className="text-[var(--dt-text-inverse)]" />}
                </span>
              </button>
              <p id={analyticsDescriptionId} className="px-[0.5em] mt-1 text-xs leading-normal text-[var(--dt-text-muted)]">
                Help improve Daybound by sharing usage and city search data.
              </p>
              <p role="status" aria-label="Usage analytics status" className="px-[0.5em] mt-1 text-xs leading-normal text-[var(--dt-text-secondary)]">
                {!analytics.available ? "Usage analytics is unavailable here." :
                  analytics.preferenceStatus === "unavailable" ? "Off for this visit; preference could not be saved." :
                  analytics.enabled ? "On" : "Off"}
              </p>
            </div>
            <div className="px-[0.75em] py-[0.25em] border-t border-[var(--dt-border)]">
              <button type="button" role="menuitem" aria-haspopup="dialog"
                onClick={() => {
                  makeDropdownInert();
                  setIsOpen(false);
                  setCreditsOpen(true);
                }}
                className="credits-menu-item w-full min-h-6 px-[0.5em] py-[0.375em] text-left text-xs text-[var(--dt-text-secondary)] underline underline-offset-4 rounded-md hover:text-[var(--dt-text)] hover:bg-[var(--dt-surface-raised)] focus-visible:outline-offset-2 transition-colors">
                City data credits
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Credits isOpen={creditsOpen} onClose={() => {
        setCreditsOpen(false);
        triggerRef.current?.focus({ preventScroll: true });
      }} />
    </div>
  );
};
