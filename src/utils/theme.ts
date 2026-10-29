import type { AppSettings } from "./timezoneUtils";
import { DEFAULT_SETTINGS, parseAppSettings, readPersistentValue } from "./persistence";

type ThemeSettings = Pick<AppSettings, "theme" | "designTheme">;
// Hex values intentionally match the CSS fallbacks for platform browser chrome.
const COLORS = {
  gamut: { light: "#ffffff", dark: "#292929" },
  "te-1": { light: "#ececec", dark: "#333333" },
  dos: { light: "#f4f9f4", dark: "#022c22" },
};

/** Shared by synchronous startup and subsequent settings/system changes. */
export function applyTheme({ theme, designTheme }: ThemeSettings, systemDark: boolean) {
  const dark = theme === "dark" || (theme === "system" && systemDark);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.setAttribute("data-design-theme", designTheme);
  const color = COLORS[designTheme][dark ? "dark" : "light"];
  // Retain replacement semantics for Safari and remove any duplicate tags.
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.remove());
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = color;
  document.head.prepend(meta);
  root.style.backgroundColor = color;
  document.body.style.backgroundColor = color;
}

export function initializeTheme() {
  try {
    const { value } = readPersistentValue("app_settings", DEFAULT_SETTINGS, parseAppSettings);
    applyTheme(value, window.matchMedia("(prefers-color-scheme: dark)").matches);
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport && !viewport.getAttribute("content")?.includes("viewport-fit=cover")) {
      viewport.setAttribute("content", (viewport.getAttribute("content") || "") + ", viewport-fit=cover");
    }
    for (const [name, content] of [
      ["apple-mobile-web-app-capable", "yes"],
      ["apple-mobile-web-app-status-bar-style", "black-translucent"],
    ]) {
      let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!meta) { meta = document.createElement("meta"); meta.name = name; document.head.append(meta); }
      meta.content = content;
    }
  } catch {
    // A blocked/partial browser environment must not prevent React startup.
  }
}
