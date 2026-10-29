import { MAX_TEXT_LENGTH, validateLabelEdit } from "./labels";
it.each(["", "   "])("reverts empty label edits: %j", value => expect(validateLabelEdit(value)).toEqual({ kind: "empty" }));
it.each([1023, 1024])("accepts %s code units and trims only new edits", length => {
  expect(validateLabelEdit("x".repeat(length))).toEqual({ kind: "valid", value: "x".repeat(length) });
  expect(validateLabelEdit(" Team ")).toEqual({ kind: "valid", value: "Team" });
});
it("uses the same UTF-16 boundary for emoji and oversized raw edits", () => {
  expect(MAX_TEXT_LENGTH).toBe(1024);
  expect(validateLabelEdit("🌍".repeat(512)).kind).toBe("valid");
  expect(validateLabelEdit("🌍".repeat(512) + "x").kind).toBe("invalid");
  expect(validateLabelEdit("x".repeat(1024) + " ").kind).toBe("invalid");
});
