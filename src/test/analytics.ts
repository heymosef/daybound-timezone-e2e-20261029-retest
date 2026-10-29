import { vi } from "vitest";
import type { AnalyticsOptions } from "../analytics/analytics";

export function offlineAnalyticsOptions(overrides: AnalyticsOptions = {}) {
  return {
    token: "phc_offline_fixture",
    host: "https://analytics.example.invalid",
    production: true,
    hostname: "daybound.example.invalid",
    doNotTrack: () => false,
    ...overrides,
  };
}

export const createFetchMock = () => vi.fn<typeof fetch>()
  .mockImplementation(async () => new Response(null, { status: 200 }));
