import React, { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { useTheme } from "./useTheme";
import { initializeTheme } from "../utils/theme";
import type { AppSettings } from "../utils/timezoneUtils";

type ThemeSettings = Pick<AppSettings, "theme" | "designTheme">;
let media: { matches: boolean; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
let listeners: Set<() => void>;
beforeEach(() => {
  localStorage.clear();
  listeners = new Set();
  media = { matches: false,
    addEventListener: vi.fn((_type: string, listener: () => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: () => void) => listeners.delete(listener)),
  };
  vi.spyOn(window, "matchMedia").mockReturnValue(media as unknown as MediaQueryList);
  document.querySelectorAll('meta[name="theme-color"],meta[name="viewport"],meta[name^="apple-mobile-web-app"]').forEach(e => e.remove());
});
afterEach(() => vi.restoreAllMocks());

const assertTheme = (design: string, dark: boolean, color: string) => {
  expect(document.documentElement).toHaveAttribute("data-design-theme", design);
  expect(document.documentElement.classList.contains("dark")).toBe(dark);
  expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
  expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute("content", color);
  expect(document.documentElement).toHaveStyle({ backgroundColor: color });
  expect(document.body).toHaveStyle({ backgroundColor: color });
};

it.each([
  ["gamut", "light", "#ffffff"], ["gamut", "dark", "#292929"],
  ["te-1", "light", "#ececec"], ["te-1", "dark", "#333333"],
  ["dos", "light", "#f4f9f4"], ["dos", "dark", "#022c22"],
] as const)("paints %s %s and does not subscribe to system changes", (designTheme, theme, color) => {
  media.matches = theme !== "dark";
  renderHook(() => useTheme({ designTheme, theme }));
  assertTheme(designTheme, theme === "dark", color);
  expect(listeners.size).toBe(0);
});

it("keeps one system listener through StrictMode and design changes, and cleans up on explicit mode/unmount", () => {
  const { rerender, unmount } = renderHook((settings: ThemeSettings) => useTheme(settings), {
    initialProps: { theme: "system", designTheme: "te-1" } as ThemeSettings,
    wrapper: ({ children }: React.PropsWithChildren) => <StrictMode>{children}</StrictMode>,
  });
  assertTheme("te-1", false, "#ececec");
  expect(listeners.size).toBe(1);
  act(() => { media.matches = true; listeners.forEach(listener => listener()); });
  assertTheme("te-1", true, "#333333");
  rerender({ theme: "system", designTheme: "dos" });
  assertTheme("dos", true, "#022c22");
  expect(listeners.size).toBe(1);
  rerender({ theme: "light", designTheme: "dos" });
  assertTheme("dos", false, "#f4f9f4");
  expect(listeners.size).toBe(0);
  rerender({ theme: "system", designTheme: "gamut" });
  expect(listeners.size).toBe(1);
  unmount();
  expect(listeners.size).toBe(0);
});

it("paints saved system settings synchronously and repairs platform metadata without writing storage", () => {
  media.matches = true;
  localStorage.setItem("app_settings", JSON.stringify({ theme: "system", designTheme: "dos" }));
  document.head.insertAdjacentHTML("beforeend", '<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="red"><meta name="theme-color" content="blue">');
  const write = vi.spyOn(Storage.prototype, "setItem");
  initializeTheme();
  assertTheme("dos", true, "#022c22");
  initializeTheme();
  expect(document.querySelector('meta[name="viewport"]')).toHaveAttribute("content", "width=device-width, initial-scale=1, viewport-fit=cover");
  expect(document.querySelectorAll('meta[name="apple-mobile-web-app-capable"]')).toHaveLength(1);
  expect(document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute("content", "black-translucent");
  expect(write).not.toHaveBeenCalled();
  expect(listeners.size).toBe(0);
});
