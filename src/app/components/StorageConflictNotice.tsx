import React from "react";
import type { StorageConflict } from "../../hooks/useStorage";
interface Props<T> {
  group: string;
  conflict: StorageConflict<T>;
  preview: (value: T) => string;
  clearedAction: string;
  onUseSaved: () => void;
  onReplace: () => void;
  onRetry: () => void;
}
export function StorageConflictNotice<T>({ group, conflict, preview, clearedAction, onUseSaved, onReplace, onRetry }: Props<T>) {
  const unavailable = conflict.kind === "unavailable";
  const canAdopt = conflict.kind === "valid" || conflict.kind === "absent";
  const actionClass = "cursor-pointer rounded-md border border-[var(--dt-border-strong)] px-3 py-2 hover:bg-[var(--dt-bg-hover)] focus-visible:outline-2 focus-visible:outline-[var(--dt-accent)] disabled:cursor-not-allowed disabled:opacity-50";
  return <section role="status" aria-label={`${group} changed in another tab`}
    className="rounded-md border border-[var(--dt-border-strong)] bg-[var(--dt-surface)] p-3 text-sm text-[var(--dt-text)]">
    <p className="font-medium">{unavailable ? `${group}: saved data is unavailable.` : `${group} changed in another tab.`}</p>
    <p className="mt-1 text-[var(--dt-text-secondary)]">Your version stays in this tab until you choose. Closing or reloading before resolving this difference discards this tab's version.</p>
    <p className="mt-1 break-words">{conflict.kind === "valid" ? `Saved version: ${preview(conflict.value)}` :
      conflict.kind === "absent" ? `Saved data was cleared. Accepting it will use: ${preview(conflict.value)}` :
      conflict.kind === "invalid" ? conflict.reason : "Try again before replacing anything."}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" className={actionClass} disabled={!canAdopt} onClick={onUseSaved}>
        {conflict.kind === "absent" ? clearedAction : "Use saved setup"}
      </button>
      <button type="button" className={actionClass} disabled={unavailable} onClick={onReplace}>Replace saved setup with this tab</button>
      {unavailable && <button type="button" className={actionClass} onClick={onRetry}>Try again</button>}
    </div>
  </section>;
}
