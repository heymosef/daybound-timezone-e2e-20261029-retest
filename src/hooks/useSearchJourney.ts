import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAnalytics, useAnalyticsController } from "../analytics/AnalyticsProvider";
import { SearchJourney, type SearchSnapshot } from "../analytics/searchJourney";

export function useSearchJourney(snapshot: SearchSnapshot, isOpen: boolean) {
  const { capture, enabled } = useAnalytics();
  const controller = useAnalyticsController();
  const [journey] = useState(() => new SearchJourney(capture));
  const { query, available, alreadyAdded } = snapshot;
  const latestQuery = useRef(query);
  useLayoutEffect(() => { latestQuery.current = query; }, [query]);
  useEffect(() => {
    // Revoke pending work synchronously, even when React batches off/on into one render.
    const sync = () => journey.setEnabled(controller.getSnapshot().enabled, latestQuery.current);
    sync();
    const unsubscribe = controller.subscribe(sync);
    return () => { unsubscribe(); journey.dispose(); };
  }, [journey, controller]);
  useEffect(() => {
    if (!enabled || !isOpen) return;
    journey.open();
    if (query.trim().length < 3) return;
    const timer = window.setTimeout(() => journey.attempt({ query, available, alreadyAdded }), 700);
    return () => window.clearTimeout(timer);
  }, [journey, enabled, isOpen, query, available, alreadyAdded]);
  return journey;
}
