import { useState, useEffect } from "react";

export const useTime = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    };
    const schedule = () => {
      clear();
      if (document.visibilityState === "hidden") return;
      timer = setTimeout(refresh, 60_000 - Date.now() % 60_000);
    };
    const refresh = () => {
      clear();
      if (document.visibilityState === "hidden") return;
      const current = new Date();
      setNow((previous) => previous.getTime() === current.getTime() ? previous : current);
      schedule();
    };
    schedule();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      clear();
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, []);

  return now;
};
