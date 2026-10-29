import { useEffect } from "react";
import type { AppSettings } from "../utils/timezoneUtils";
import { applyTheme } from "../utils/theme";

export function useTheme({ theme, designTheme }: Pick<AppSettings, "theme" | "designTheme">) {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => applyTheme({ theme, designTheme }, media.matches);
    update();
    if (theme !== "system") return;
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme, designTheme]);
}
