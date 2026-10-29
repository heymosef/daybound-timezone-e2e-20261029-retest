import { useState, useCallback, useEffect, useLayoutEffect, useRef, type SetStateAction } from "react";
import {
  readPersistentValue, readExternalValue,
  type ExternalDecoder, type ExternalStorageValue, type PersistenceParser,
} from "../utils/persistence";

export type StorageConflict<T> =
  | { kind: "valid" | "absent"; value: T }
  | { kind: "invalid"; reason: string }
  | { kind: "unavailable" };

type Snapshot<T> = ReturnType<typeof readPersistentValue<T>> & {
  external: ExternalStorageValue<T> | null;
  externalRevision: number;
};

const sameExternal = <T,>(a: ExternalStorageValue<T> | null, b: ExternalStorageValue<T>): boolean =>
  a !== null && (a.kind === "unavailable" ? b.kind === "unavailable" : b.kind !== "unavailable" && a.raw === b.raw);

function observe<T>(current: Snapshot<T>, external: ExternalStorageValue<T>): Snapshot<T> {
  if (sameExternal(current.external, external)) return current;
  if (external.kind === "unavailable") {
    return { ...current, external, status: "unavailable", canPersist: false };
  }
  if (!current.external && current.acknowledgedRaw === external.raw) return current;
  return { ...current, external, canPersist: true, externalRevision: current.externalRevision + 1 };
}

export function usePersistentState<T>(
  key: string,
  initialValue: T,
  parse: PersistenceParser<T>,
  decodeExternal: ExternalDecoder<T>,
) {
  const [snapshot, setSnapshot] = useState<Snapshot<T>>(() => ({
    ...readPersistentValue(key, initialValue, parse), external: null, externalRevision: 0,
  }));
  const committed = useRef(snapshot);
  const lastWrite = useRef<Snapshot<T> | null>(null);
  useLayoutEffect(() => { committed.current = snapshot; }, [snapshot]);

  const retryExternalRead = useCallback(() => {
    const external = readExternalValue(key, decodeExternal);
    setSnapshot((current) => observe(current, external));
  }, [key, decodeExternal]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== key) return;
      try {
        if (event.storageArea !== null && event.storageArea !== window.localStorage) return;
      } catch {
        // Re-reading below records access failure without discarding the candidate.
      }
      retryExternalRead();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key, retryExternalRead]);

  useEffect(() => {
    // Updaters stay pure; only committed effects/explicit actions perform I/O.
    if (!snapshot.canPersist || snapshot.external || !snapshot.needsWrite || lastWrite.current === snapshot) return;
    lastWrite.current = snapshot;
    const external = readExternalValue(key, decodeExternal);
    if (external.kind === "unavailable" || external.raw !== snapshot.acknowledgedRaw) {
      setSnapshot((current) => observe(current, external));
      return;
    }
    const raw = JSON.stringify(snapshot.value);
    try {
      window.localStorage.setItem(key, raw);
      setSnapshot((current) => current === snapshot ? {
        ...current, status: "saved", needsWrite: false, acknowledgedRaw: raw,
      } : current);
    } catch {
      setSnapshot((current) => current === snapshot ? { ...current, status: "unavailable", needsWrite: false } : current);
    }
  }, [key, snapshot, decodeExternal]);

  const setValue = useCallback((next: SetStateAction<T>) => {
    setSnapshot((current) => ({
      ...current,
      value: typeof next === "function" ? (next as (previous: T) => T)(current.value) : next,
      needsWrite: true,
    }));
  }, []);

  const preview = snapshot.external;
  const resolve = useCallback((replace: boolean): boolean => {
    // This closure is a preview token: even an old button callback must reconfirm its own preview.
    if (!preview || preview.kind === "unavailable" || committed.current.external !== preview) return false;
    const external = readExternalValue(key, decodeExternal);
    if (!sameExternal(preview, external)) {
      setSnapshot((current) => observe(current, external));
      return false;
    }
    if (external.kind === "unavailable" || (!replace && external.kind === "invalid")) return false;
    const current = committed.current;
    if (!replace && (external.kind === "valid" || external.kind === "absent")) {
      setSnapshot((latest) => ({
        ...latest, value: external.value, acknowledgedRaw: external.raw, external: null,
        status: "saved", canPersist: true, needsWrite: false, externalRevision: latest.externalRevision + 1,
      }));
      return true;
    }
    const raw = JSON.stringify(current.value);
    try {
      if (raw !== external.raw) window.localStorage.setItem(key, raw);
    } catch {
      setSnapshot((latest) => ({ ...latest, status: "unavailable" }));
      return false;
    }
    setSnapshot((latest) => ({
      ...latest, acknowledgedRaw: raw, external: null, status: "saved", canPersist: true,
      needsWrite: latest.value !== current.value,
    }));
    return true;
  }, [preview, key, decodeExternal]);
  const resolveFromStorage = useCallback(() => resolve(false), [resolve]);
  const replaceFromDraft = useCallback(() => resolve(true), [resolve]);

  let conflict: StorageConflict<T> | null = null;
  if (preview?.kind === "valid" || preview?.kind === "absent") conflict = { kind: preview.kind, value: preview.value };
  else if (preview?.kind === "invalid") conflict = { kind: "invalid", reason: preview.reason };
  else if (preview?.kind === "unavailable") conflict = { kind: "unavailable" };

  return [snapshot.value, setValue, snapshot.status, {
    conflict, resolveFromStorage, replaceFromDraft, retryExternalRead, externalRevision: snapshot.externalRevision,
  }] as const;
}
