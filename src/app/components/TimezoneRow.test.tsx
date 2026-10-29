import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimezoneRow } from "./TimezoneRow";

function mount() {
  const onRename = vi.fn();
  const now = new Date("2026-10-23T12:00:00Z");
  render(<><button>Before row</button><TimezoneRow config={{ id: "toronto", timezone: "America/Toronto" }}
    now={now} timelineTime={now} onRemove={vi.fn()} onRename={onRename} onMove={vi.fn()} onSetHome={vi.fn()}
    use24Hour showBadge showWeekends={false} hoveredHourIndex={null} onHoverHour={vi.fn()}
    isLive selectedDateOffset={0} /><button>After row</button></>);
  return { onRename, user: userEvent.setup() };
}
const rename = () => screen.getByRole("button", { name: "Rename Toronto" });
const editor = () => screen.getByRole("textbox", { name: "Edit Toronto label" });

it.each(["{Enter}", " "])("starts rename from the keyboard with %s and commits once", async key => {
  const { user, onRename } = mount();
  rename().focus();
  await user.keyboard(key);
  await user.clear(editor());
  await user.type(editor(), "Team");
  await user.keyboard("{Enter}");
  expect(onRename).toHaveBeenCalledExactlyOnceWith("toronto", "Team");
  expect(rename()).toHaveFocus();
});
it("cancels with Escape without saving during the subsequent blur", async () => {
  const { user, onRename } = mount();
  await user.click(rename());
  await user.clear(editor());
  await user.type(editor(), "Unwanted");
  await user.keyboard("{Escape}");
  expect(onRename).not.toHaveBeenCalled();
  expect(rename()).toHaveFocus();
});
it.each([false, true])("does not steal focus on Tab blur: backwards=%s", async backwards => {
  const { user, onRename } = mount();
  await user.click(rename());
  await user.clear(editor());
  await user.type(editor(), "Team");
  await user.tab({ shift: backwards });
  expect(onRename).toHaveBeenCalledExactlyOnceWith("toronto", "Team");
  expect(rename()).not.toHaveFocus();
  expect(document.activeElement).not.toBe(document.body);
});
it("preserves a clicked destination on blur and reverts empty edits", async () => {
  const { user, onRename } = mount();
  await user.click(rename());
  await user.clear(editor());
  await user.click(screen.getByRole("button", { name: "After row" }));
  expect(onRename).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "After row" })).toHaveFocus();
});
it("names row controls by city", () => {
  mount();
  expect(screen.getAllByRole("button", { name: "Remove Toronto" })).toHaveLength(2);
  expect(screen.getAllByRole("button", { name: "Move Toronto up" })).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Set Toronto as home timezone" })).toBeInTheDocument();
});
it("rejects an oversized programmatic edit without losing the previous label", async () => {
  const { user, onRename } = mount();
  await user.click(rename());
  fireEvent.change(editor(), { target: { value: "x".repeat(1025) } });
  await user.keyboard("{Enter}");
  expect(onRename).not.toHaveBeenCalled();
  expect(editor()).toHaveAttribute("aria-invalid", "true");
  expect(editor()).toHaveAccessibleDescription("Use 1024 characters or fewer.");
  await user.keyboard("{Escape}");
  expect(rename()).toHaveFocus();
});
