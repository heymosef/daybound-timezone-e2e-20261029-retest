import React, { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { usePersistentState } from "./useStorage";
import { DEFAULT_SETTINGS, parseAppSettings, decodeExternalAppSettings, type ExternalDecoder } from "../utils/persistence";

const parseCount = (value: unknown): number => typeof value === "number" && Number.isFinite(value) ? value : 0;
const decodeCount: ExternalDecoder<number> = (raw) => {
  if (raw === null) return { kind: "absent", raw, value: 0 };
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "number" && Number.isFinite(value)
      ? { kind: "valid", raw, value } : { kind: "invalid", raw, reason: "Expected a number." };
  } catch { return { kind: "invalid", raw, reason: "Invalid JSON." }; }
};
const invalidate = (key: string | null = "count", newValue: string | null = null) =>
  window.dispatchEvent(new StorageEvent("storage", { key, newValue, storageArea: localStorage }));
const renderCount = () => renderHook(() => usePersistentState("count", 0, parseCount, decodeCount));

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

it("reports successful persistence explicitly", () => {
  const { result } = renderCount();
  expect(result.current.slice(0, 3)).toEqual([0, expect.any(Function), "saved"]);
  expect(localStorage.getItem("count")).toBe("0");
});

it("survives a blocked localStorage property getter", () => {
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
  const { result } = renderCount();
  expect(result.current[0]).toBe(0);
  expect(result.current[2]).toBe("unavailable");
  act(() => result.current[1]((value) => value + 1));
  expect(result.current[0]).toBe(1);
  expect(result.current[2]).toBe("unavailable");
});

it("does not overwrite unread saved data when getItem fails", () => {
  localStorage.setItem("count", "7");
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Read denied"); });
  const write = vi.spyOn(Storage.prototype, "setItem");
  const { result } = renderCount();
  expect(result.current[0]).toBe(0);
  expect(result.current[2]).toBe("unavailable");
  expect(write).not.toHaveBeenCalled();
  act(() => result.current[1]((value) => value + 1));
  expect(result.current[0]).toBe(1);
  expect(result.current[2]).toBe("unavailable");
  expect(write).not.toHaveBeenCalled();
});

it("recovers corrupt JSON without relying on a removeItem that may throw", () => {
  localStorage.setItem("count", "not JSON");
  const remove = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("Remove denied"); });
  const { result } = renderCount();
  expect(result.current[0]).toBe(0);
  expect(result.current[2]).toBe("saved");
  expect(localStorage.getItem("count")).toBe("0");
  expect(remove).not.toHaveBeenCalled();
});

it("keeps migrated legacy values and writes their normalized shape", () => {
  localStorage.setItem("app_settings", JSON.stringify({ theme: "dark", showBadge: false }));
  const { result } = renderHook(() => usePersistentState("app_settings", DEFAULT_SETTINGS, parseAppSettings, decodeExternalAppSettings));
  expect(result.current[0]).toEqual({ ...DEFAULT_SETTINGS, theme: "dark", showBadge: false });
  expect(JSON.parse(localStorage.getItem("app_settings")!)).toEqual(result.current[0]);
});

it("keeps memory state on quota failure and supports later successful edits", () => {
  const { result } = renderCount();
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
  act(() => result.current[1](10));
  expect(result.current[0]).toBe(10);
  expect(result.current[2]).toBe("unavailable");
  act(() => result.current[1]((value) => value + 5));
  expect(result.current[0]).toBe(15);
  write.mockRestore();
  act(() => result.current[1]((value) => value + 1));
  expect(result.current[0]).toBe(16);
  expect(result.current[2]).toBe("saved");
  expect(localStorage.getItem("count")).toBe("16");
});

it("catches a property getter that becomes blocked after initial rendering", () => {
  const { result } = renderCount();
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new Error("Access revoked"); });
  act(() => result.current[1](4));
  expect(result.current[0]).toBe(4);
  expect(result.current[2]).toBe("unavailable");
});

it("reports an initialization write failure without leaking stored values in warnings", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Private error text"); });
  const warn = vi.spyOn(console, "warn");
  const { result } = renderCount();
  expect(result.current[2]).toBe("unavailable");
  expect(warn).not.toHaveBeenCalled();
});

it("runs pure functional updates and persists only the committed result under StrictMode", () => {
  localStorage.setItem("count", "0");
  const write = vi.spyOn(Storage.prototype, "setItem");
  const remove = vi.spyOn(Storage.prototype, "removeItem");
  const { result } = renderHook(() => usePersistentState("count", 0, parseCount, decodeCount), {
    wrapper: ({ children }: React.PropsWithChildren) => <StrictMode>{children}</StrictMode>,
  });
  const setter = result.current[1];
  expect(write).not.toHaveBeenCalled();
  act(() => {
    result.current[1]((value) => value + 1);
    result.current[1]((value) => value + 2);
  });
  expect(result.current[0]).toBe(3);
  expect(result.current[1]).toBe(setter);
  expect(write.mock.calls).toEqual([["count", "3"]]);
  expect(remove).not.toHaveBeenCalled();
});

it("writes a StrictMode recovery once without deleting saved data", () => {
  localStorage.setItem("app_settings", '{"theme":"dark"}');
  const write = vi.spyOn(Storage.prototype, "setItem");
  const remove = vi.spyOn(Storage.prototype, "removeItem");
  renderHook(() => usePersistentState("app_settings", DEFAULT_SETTINGS, parseAppSettings, decodeExternalAppSettings), {
    wrapper: ({ children }: React.PropsWithChildren) => <StrictMode>{children}</StrictMode>,
  });
  expect(write).toHaveBeenCalledTimes(1);
  expect(JSON.parse(localStorage.getItem("app_settings")!).theme).toBe("dark");
  expect(remove).not.toHaveBeenCalled();
});

describe("explicit external storage recovery", () => {
  it("preserves a clean candidate and adopts only after confirmation without writing back", () => {
    const { result } = renderCount();
    const write = vi.spyOn(Storage.prototype, "setItem");
    act(() => { localStorage.setItem("count", "7"); invalidate(); });
    write.mockClear();
    expect(result.current[0]).toBe(0);
    expect(result.current[3].conflict).toEqual({ kind: "valid", value: 7 });
    const revision = result.current[3].externalRevision;
    act(() => invalidate());
    expect(result.current[3].externalRevision).toBe(revision);
    act(() => { expect(result.current[3].resolveFromStorage()).toBe(true); });
    expect(result.current[0]).toBe(7);
    expect(result.current[3].conflict).toBeNull();
    expect(result.current[3].externalRevision).toBe(revision + 1);
    expect(write).not.toHaveBeenCalled();
  });

  it("checks actual raw storage before a write even without an event", () => {
    const { result } = renderCount();
    localStorage.setItem("count", "7");
    const write = vi.spyOn(Storage.prototype, "setItem");
    act(() => result.current[1](9));
    expect(result.current[0]).toBe(9);
    expect(result.current[3].conflict).toEqual({ kind: "valid", value: 7 });
    expect(write).not.toHaveBeenCalled();
    act(() => result.current[1]((value) => value + 1));
    expect(result.current[0]).toBe(10);
    expect(localStorage.getItem("count")).toBe("7");
    act(() => { expect(result.current[3].replaceFromDraft()).toBe(true); });
    expect(localStorage.getItem("count")).toBe("10");
    expect(result.current[0]).toBe(10);
    expect(result.current[3].conflict).toBeNull();
  });

  it("preserves a pending candidate when an invalidation arrives before its effect", () => {
    const { result } = renderCount();
    act(() => {
      result.current[1](9);
      localStorage.setItem("count", "7");
      invalidate();
    });
    expect(result.current[0]).toBe(9);
    expect(result.current[3].conflict).toEqual({ kind: "valid", value: 7 });
    expect(localStorage.getItem("count")).toBe("7");
  });

  it.each(["adopt", "replace"])("refreshes a changed preview before %s and requires a new action", (action) => {
    const { result } = renderCount();
    act(() => { localStorage.setItem("count", "7"); invalidate(); });
    const oldAction = action === "adopt" ? result.current[3].resolveFromStorage : result.current[3].replaceFromDraft;
    localStorage.setItem("count", "8");
    act(() => { expect(oldAction()).toBe(false); });
    expect(result.current[0]).toBe(0);
    expect(result.current[3].conflict).toEqual({ kind: "valid", value: 8 });
    expect(localStorage.getItem("count")).toBe("8");
    act(() => { expect(oldAction()).toBe(false); });
    act(() => { expect((action === "adopt" ? result.current[3].resolveFromStorage : result.current[3].replaceFromDraft)()).toBe(true); });
    expect(result.current[0]).toBe(action === "adopt" ? 8 : 0);
  });

  it("ignores stale event payloads, unrelated keys and other storage areas", () => {
    const { result } = renderCount();
    act(() => result.current[1](5));
    act(() => invalidate("count", "2"));
    expect(result.current[0]).toBe(5);
    expect(result.current[3].conflict).toBeNull();
    localStorage.setItem("count", "7");
    act(() => {
      invalidate("other");
      window.dispatchEvent(new StorageEvent("storage", { key: "count", storageArea: sessionStorage }));
    });
    expect(result.current[3].conflict).toBeNull();
  });

  it.each(["bad JSON", "{}", "null"])("cannot adopt malformed or wrong-shape data: %s", (raw) => {
    const { result } = renderCount();
    act(() => { localStorage.setItem("count", raw); invalidate(); });
    expect(result.current[3].conflict?.kind).toBe("invalid");
    act(() => { expect(result.current[3].resolveFromStorage()).toBe(false); });
    expect(result.current[0]).toBe(0);
    act(() => { expect(result.current[3].replaceFromDraft()).toBe(true); });
    expect(localStorage.getItem("count")).toBe("0");
  });

  it.each(["remove", "clear"])("explicitly accepts %s without writing defaults back", (method) => {
    const { result } = renderCount();
    act(() => result.current[1](5));
    act(() => {
      if (method === "clear") localStorage.clear(); else localStorage.removeItem("count");
      invalidate(method === "clear" ? null : "count");
    });
    expect(result.current[0]).toBe(5);
    expect(result.current[3].conflict).toEqual({ kind: "absent", value: 0 });
    const write = vi.spyOn(Storage.prototype, "setItem");
    act(() => { expect(result.current[3].resolveFromStorage()).toBe(true); });
    expect(result.current[0]).toBe(0);
    expect(localStorage.getItem("count")).toBeNull();
    expect(write).not.toHaveBeenCalled();
    act(() => result.current[1](3));
    expect(localStorage.getItem("count")).toBe("3");
  });

  it("blocks both actions after a read failure and refreshes on Retry", () => {
    const { result } = renderCount();
    act(() => { localStorage.setItem("count", "7"); invalidate(); });
    const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
    act(() => { expect(result.current[3].replaceFromDraft()).toBe(false); });
    expect(result.current[3].conflict).toEqual({ kind: "unavailable" });
    expect(result.current[2]).toBe("unavailable");
    act(() => { result.current[1](9); expect(result.current[3].resolveFromStorage()).toBe(false); });
    read.mockRestore();
    act(() => result.current[3].retryExternalRead());
    expect(result.current[0]).toBe(9);
    expect(result.current[3].conflict).toEqual({ kind: "valid", value: 7 });
    act(() => { expect(result.current[3].replaceFromDraft()).toBe(true); });
    expect(result.current[2]).toBe("saved");
    expect(localStorage.getItem("count")).toBe("9");
  });

  it("preserves an unread initial setup until a successful read and explicit recovery", () => {
    localStorage.setItem("count", "7");
    const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
    const { result } = renderCount();
    act(() => result.current[1](9));
    read.mockRestore();
    act(() => result.current[3].retryExternalRead());
    expect(result.current[0]).toBe(9);
    expect(result.current[3].conflict).toEqual({ kind: "valid", value: 7 });
    expect(localStorage.getItem("count")).toBe("7");
  });

  it("keeps quota failure status with a later conflict and retries explicit replacement", () => {
    const { result } = renderCount();
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
    act(() => result.current[1](9));
    write.mockRestore();
    act(() => { localStorage.setItem("count", "7"); invalidate(); });
    expect(result.current[2]).toBe("unavailable");
    expect(result.current[0]).toBe(9);
    const failedWrite = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
    act(() => { expect(result.current[3].replaceFromDraft()).toBe(false); });
    expect(result.current[3].conflict).toEqual({ kind: "valid", value: 7 });
    expect(result.current[0]).toBe(9);
    failedWrite.mockRestore();
    act(() => { expect(result.current[3].replaceFromDraft()).toBe(true); });
    expect(localStorage.getItem("count")).toBe("9");
    expect(result.current[2]).toBe("saved");
  });

  it("retains both candidates when two writers pass the same baseline preflight", () => {
    localStorage.setItem("count", "0");
    const first = renderCount();
    const second = renderCount();
    const nativeWrite = Storage.prototype.setItem;
    const buffered: [string, string][] = [];
    // Buffer disk mutations until both effects have passed their baseline preflights.
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
      buffered.push([key, value]);
      if (buffered.length === 2) {
        for (const [storedKey, storedValue] of buffered) nativeWrite.call(localStorage, storedKey, storedValue);
      }
    });
    act(() => first.result.current[1](11));
    act(() => second.result.current[1](22));
    expect(write.mock.calls).toEqual([["count", "11"], ["count", "22"]]);
    expect(first.result.current[2]).toBe("saved");
    expect(second.result.current[2]).toBe("saved");
    act(() => invalidate());
    expect(first.result.current[0]).toBe(11);
    expect(first.result.current[3].conflict).toEqual({ kind: "valid", value: 22 });
    expect(second.result.current[0]).toBe(22);
    expect(second.result.current[3].conflict).toBeNull();
  });

  it("does not write when a draft already equals the confirmed saved value", () => {
    const { result } = renderCount();
    act(() => { localStorage.setItem("count", "7"); invalidate(); });
    act(() => result.current[1](7));
    const write = vi.spyOn(Storage.prototype, "setItem");
    act(() => { expect(result.current[3].replaceFromDraft()).toBe(true); });
    expect(write).not.toHaveBeenCalled();
    expect(result.current[3].conflict).toBeNull();
  });

  it("rejects an obsolete action after resolution instead of discarding a later edit", () => {
    const { result } = renderCount();
    act(() => { localStorage.setItem("count", "7"); invalidate(); });
    const obsoleteAction = result.current[3].resolveFromStorage;
    act(() => { expect(obsoleteAction()).toBe(true); });
    act(() => {
      result.current[1](9);
      expect(obsoleteAction()).toBe(false);
    });
    expect(result.current[0]).toBe(9);
    expect(localStorage.getItem("count")).toBe("9");
  });

  it("removes every StrictMode listener on unmount", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const hook = renderHook(() => usePersistentState("count", 0, parseCount, decodeCount), {
      wrapper: ({ children }: React.PropsWithChildren) => <StrictMode>{children}</StrictMode>,
    });
    hook.unmount();
    const listeners = add.mock.calls.filter(([name]) => name === "storage").map(([, listener]) => listener);
    for (const listener of listeners) expect(remove).toHaveBeenCalledWith("storage", listener);
  });
});
