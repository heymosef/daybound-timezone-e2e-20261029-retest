import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { createAnalytics, type AnalyticsController, type AnalyticsOptions, type AnalyticsSnapshot } from "./analytics";

const disabledSnapshot: AnalyticsSnapshot = { enabled: false, available: false, preferenceStatus: "saved" };
const disabledController: AnalyticsController = {
  capture: () => {}, setEnabled: () => {}, start: () => {}, dispose: () => {},
  getSnapshot: () => disabledSnapshot,
  subscribe: () => () => {},
};
const AnalyticsContext = createContext<AnalyticsController>(disabledController);

export function AnalyticsProvider({ children, controller, options }: React.PropsWithChildren<{
  /** Injection is for offline fixtures/tests; configuration belongs to this provider lifetime. */
  controller?: AnalyticsController;
  options?: AnalyticsOptions;
}>) {
  // Normal rerenders must retain the controller's current-visit denial latch.
  const [stableController] = useState(() => controller ?? createAnalytics(options));
  useEffect(() => {
    stableController.start();
    return () => stableController.dispose();
  }, [stableController]);
  return <AnalyticsContext.Provider value={stableController}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics() {
  const controller = useContext(AnalyticsContext);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return { ...snapshot, capture: controller.capture, setEnabled: controller.setEnabled };
}

/** Internal synchronous policy subscription for cancellable search classification. */
export function useAnalyticsController() { return useContext(AnalyticsContext); }
