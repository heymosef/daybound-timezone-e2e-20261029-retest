import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import "./Credits.css";

export function Credits({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    else if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
      <dialog ref={dialogRef} aria-labelledby={titleId}
        onClose={onClose}
        onKeyDown={event => {
          event.stopPropagation();
          if (event.key !== "Tab") return;
          const controls = event.currentTarget.querySelectorAll<HTMLElement>("button, a[href]");
          const first = controls[0], last = controls[controls.length - 1];
          if (event.shiftKey && event.target === first) {
            event.preventDefault(); last.focus();
          } else if (!event.shiftKey && event.target === last) {
            event.preventDefault(); first.focus();
          }
        }}
        onClick={event => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
            event.currentTarget.close();
          }
        }}
        className="credits-dialog m-auto w-[calc(100%-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-lg border border-[var(--dt-border)] bg-[var(--dt-bg)] p-5 text-[var(--dt-text)] shadow-xl backdrop:bg-black/40 md:p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 id={titleId} className="text-lg font-medium">City data credits</h2>
          <button type="button" aria-label="Close credits" onClick={() => dialogRef.current?.close()}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-[var(--dt-bg-hover)] focus-visible:outline-offset-2 transition-colors">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-4 text-sm leading-relaxed text-[var(--dt-text-secondary)]">
          <p>Daybound’s city lookup catalogue uses{" "}
            <a href="https://www.geonames.org/" target="_blank" rel="noreferrer" aria-label="GeoNames (opens in a new tab)" className="underline underline-offset-2">GeoNames</a>{" "}
            cities15000 data, licensed under{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" aria-label="Creative Commons Attribution 4.0 (opens in a new tab)" className="underline underline-offset-2">Creative Commons Attribution 4.0</a>.
          </p>
          <p>Adapted for local lookup: split into smaller files, with coordinates and population data removed.</p>
          <p><a href="https://download.geonames.org/export/dump/readme.txt" target="_blank" rel="noreferrer" aria-label="Source data and documentation (opens in a new tab)" className="underline underline-offset-2">Source data and documentation</a></p>
        </div>
      </dialog>
  );
}
