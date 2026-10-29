import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { StorageConflictNotice } from "./StorageConflictNotice";
import type { StorageConflict } from "../../hooks/useStorage";
function mount(conflict: StorageConflict<string[]>) {
  const useSaved = vi.fn(), replace = vi.fn(), retry = vi.fn();
  render(<StorageConflictNotice group="Cities" conflict={conflict} preview={rows => rows.join(", ") || "an empty city list"}
    clearedAction="Use cleared city list" onUseSaved={useSaved} onReplace={replace} onRetry={retry} />);
  return { useSaved, replace, retry };
}
it("previews only validated text and offers explicit actions", () => {
  const { useSaved } = mount({ kind: "valid", value: ["<script>private</script>"] });
  expect(screen.getByRole("status", { name: "Cities changed in another tab" })).toHaveTextContent("<script>private</script>");
  expect(document.querySelector("script")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Use saved setup" })); expect(useSaved).toHaveBeenCalledOnce();
});
it("names the precise cleared-state action", () => {
  const { useSaved } = mount({ kind: "absent", value: [] });
  fireEvent.click(screen.getByRole("button", { name: "Use cleared city list" })); expect(useSaved).toHaveBeenCalledOnce();
});
it("disables adoption of invalid data", () => {
  mount({ kind: "invalid", reason: "Saved data is invalid." });
  expect(screen.getByRole("button", { name: "Use saved setup" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Replace saved setup with this tab" })).toBeEnabled();
});
it("prevents replacing unread data and offers Retry", () => {
  const { retry } = mount({ kind: "unavailable" });
  expect(screen.getByRole("button", { name: "Use saved setup" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Replace saved setup with this tab" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Try again" })); expect(retry).toHaveBeenCalledOnce();
});
