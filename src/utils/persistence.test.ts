import { DEFAULT_SETTINGS, parseAppSettings, parseNoticeDismissed, parseTimezoneConfig, decodeExternalTimezoneConfig, decodeExternalAppSettings, decodeExternalNoticeDismissed } from "./persistence";

describe("stored settings", () => {
  it.each([null, undefined, 42, "dark", true, [], [null]])("rejects a wrong settings shape: %j", (value) => {
    expect(parseAppSettings(value)).toEqual(DEFAULT_SETTINGS);
  });
  it("merges partial legacy settings without discarding valid false values", () => {
    expect(parseAppSettings({ theme: "dark", use24Hour: true, showBadge: false })).toEqual({
      ...DEFAULT_SETTINGS, theme: "dark", use24Hour: true, showBadge: false,
    });
  });
  it("validates each enum and boolean independently", () => {
    expect(parseAppSettings({ theme: "unknown", designTheme: "dos", showWeekends: true, showBadge: "false", use24Hour: 1 })).toEqual({
      ...DEFAULT_SETTINGS, designTheme: "dos", showWeekends: true,
    });
  });
  it("preserves every valid setting", () => {
    const settings = { theme: "light", designTheme: "gamut", use24Hour: true, showWeekends: true, showBadge: false };
    expect(parseAppSettings(settings)).toEqual(settings);
  });
});

describe("stored timezones", () => {
  it.each([null, undefined, 3, "UTC", {}, true])("rejects a wrong rows shape: %j", (value) => {
    expect(parseTimezoneConfig(value)).toEqual([]);
  });
  it("filters malformed entries and invalid identifiers, accepting UTC and backward aliases", () => {
    expect(parseTimezoneConfig([
      null, 1, [], {}, { id: "", timezone: "UTC" }, { id: "  ", timezone: "UTC" },
      { id: "bad", timezone: "Not/A_Zone" }, { id: "offset", timezone: "+01:00" },
      { id: "utc", timezone: "UTC" }, { id: "alias", timezone: "US/Pacific" },
    ])).toEqual([
      { id: "utc", timezone: "UTC", isHome: true },
      { id: "alias", timezone: "US/Pacific", isHome: false },
    ]);
  });
  it("keeps stable IDs, custom text, order and the first explicitly selected home", () => {
    const first = { id: "stable-1", timezone: "Europe/London", label: "  Team α  ", city: "Custom city", country: "Custom country", isHome: false };
    const second = { id: "stable-2", timezone: "Asia/Tokyo", label: "Tokyo team", isHome: true };
    expect(parseTimezoneConfig([first, second])).toEqual([first, second]);
  });
  it("keeps the first valid record for duplicate IDs and identical timezone strings", () => {
    expect(parseTimezoneConfig([
      { id: "same", timezone: "Invalid" }, { id: "same", timezone: "UTC", label: "First valid" },
      { id: "same", timezone: "Europe/London" }, { id: "different", timezone: "UTC", label: "Duplicate zone" },
      { id: "alias", timezone: "Etc/UTC", label: "Distinct identifier" },
    ])).toEqual([
      { id: "same", timezone: "UTC", label: "First valid", isHome: true },
      { id: "alias", timezone: "Etc/UTC", label: "Distinct identifier", isHome: false },
    ]);
  });
  it("retains the first explicit home when several are marked", () => {
    const parsed = parseTimezoneConfig([
      { id: "a", timezone: "UTC", isHome: false },
      { id: "b", timezone: "Europe/London", isHome: true },
      { id: "c", timezone: "Asia/Tokyo", isHome: true },
    ]);
    expect(parsed.map((row) => row.isHome)).toEqual([false, true, false]);
  });
  it("chooses the first valid row if no boolean home is stored", () => {
    expect(parseTimezoneConfig([{ id: "a", timezone: "UTC", isHome: "yes" }, { id: "b", timezone: "Asia/Tokyo" }]).map((row) => row.isHome)).toEqual([true, false]);
  });
  it("discards invalid optional fields without losing the valid row or valid text", () => {
    expect(parseTimezoneConfig([{ id: "a", timezone: "UTC", label: 5, country: "x".repeat(1025), city: "", other: "unknown" }])).toEqual([
      { id: "a", timezone: "UTC", city: "", isHome: true },
    ]);
  });
});

it.each([null, undefined, "true", 1, {}, [], false])("does not dismiss a notice for invalid flag %j", (value) => {
  expect(parseNoticeDismissed(value)).toBe(false);
});
it("preserves a true notice dismissal", () => expect(parseNoticeDismissed(true)).toBe(true));

describe("strict external adoption", () => {
  it.each(["null", "{}", "true", "1", '"UTC"', "bad JSON"])("rejects invalid external city roots: %s", (raw) => {
    expect(decodeExternalTimezoneConfig(raw).kind).toBe("invalid");
  });
  it("accepts empty lists and normalizes recognized legacy aliases and home flags", () => {
    expect(decodeExternalTimezoneConfig("[]")).toEqual({ kind: "valid", raw: "[]", value: [] });
    const raw = JSON.stringify([{ id: "a", timezone: "US/Pacific" }, { id: "b", timezone: "UTC", isHome: true }]);
    expect(decodeExternalTimezoneConfig(raw)).toEqual({ kind: "valid", raw, value: [
      { id: "a", timezone: "US/Pacific", isHome: false }, { id: "b", timezone: "UTC", isHome: true },
    ] });
  });
  it.each([
    [null], [{ id: "", timezone: "UTC" }], [{ id: "a", timezone: "Invalid" }],
    [{ id: "a", timezone: "UTC", isHome: "yes" }], [{ id: "a", timezone: "UTC", label: null }],
    [{ id: "a", timezone: "UTC", city: 1 }], [{ id: "a", timezone: "UTC", country: "x".repeat(1025) }],
    [{ id: "a", timezone: "UTC" }, { id: "a", timezone: "Asia/Tokyo" }],
    [{ id: "a", timezone: "UTC" }, { id: "b", timezone: "UTC" }],
  ].map((rows) => ({ rows })))("rejects the entire external list with an unusable field or row: $rows", ({ rows }) => {
    expect(decodeExternalTimezoneConfig(JSON.stringify(rows)).kind).toBe("invalid");
  });
  it("shares the existing optional text boundary without altering valid text", () => {
    const raw = JSON.stringify([{ id: "a", timezone: "UTC", label: "x".repeat(1024), city: "", country: "  α  " }]);
    expect(decodeExternalTimezoneConfig(raw)).toEqual({ kind: "valid", raw, value: parseTimezoneConfig(JSON.parse(raw)) });
  });
  it.each([{}, { theme: "dark" }, { showBadge: false, unknown: "ignored" }])("accepts recognized legacy partial settings: %j", (value) => {
    const raw = JSON.stringify(value);
    expect(decodeExternalAppSettings(raw)).toEqual({ kind: "valid", raw, value: parseAppSettings(value) });
  });
  it.each([null, [], { unknown: true }, { theme: "unknown" }, { theme: "dark", showBadge: "false" }, { designTheme: 1 }, { use24Hour: 1 }, { showWeekends: null }])("rejects wrong external settings instead of adopting defaults: %j", (value) => {
    expect(decodeExternalAppSettings(JSON.stringify(value)).kind).toBe("invalid");
  });
  it.each([true, false])("accepts only external boolean notice preferences: %j", (value) => {
    const raw = JSON.stringify(value);
    expect(decodeExternalNoticeDismissed(raw)).toEqual({ kind: "valid", raw, value });
  });
  it.each([null, 1, "true", {}, []])("rejects an invalid external notice preference: %j", (value) => {
    expect(decodeExternalNoticeDismissed(JSON.stringify(value)).kind).toBe("invalid");
  });
  it("previews each explicitly cleared group", () => {
    expect(decodeExternalTimezoneConfig(null)).toEqual({ kind: "absent", raw: null, value: [] });
    expect(decodeExternalAppSettings(null)).toEqual({ kind: "absent", raw: null, value: DEFAULT_SETTINGS });
    expect(decodeExternalNoticeDismissed(null)).toEqual({ kind: "absent", raw: null, value: false });
  });
});
