import fixtures from "../../tests/fixtures/timezone-regressions.json";
import provenance from "../../docs/timezone-provenance.json";
import { getZonedFields } from "./calendarDate";
import { TIMEZONE_DATA_VERSION } from "./bundledTimezones";

it("matches the reviewed release metadata", () => {
  expect(TIMEZONE_DATA_VERSION).toBe(provenance.version);
  expect(fixtures.version).toBe(provenance.version);
});

it("matches independent IANA TZif expectations at changed boundaries and seasonal samples", () => {
  expect(fixtures.samples.length).toBeGreaterThan(0);
  for (const { instant, zone, ...expected } of fixtures.samples) {
    expect(getZonedFields(new Date(instant), zone), `${zone} at ${instant}`).toMatchObject(expected);
  }
});
