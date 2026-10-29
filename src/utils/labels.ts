/** UTF-16 code units, matching native maxLength and persisted optional text. */
export const MAX_TEXT_LENGTH = 1024;
export function validateLabelEdit(value: string):
  { kind: "valid"; value: string } | { kind: "empty" } | { kind: "invalid"; error: string } {
  if (value.length > MAX_TEXT_LENGTH) return { kind: "invalid", error: `Use ${MAX_TEXT_LENGTH} characters or fewer.` };
  const label = value.trim();
  return label ? { kind: "valid", value: label } : { kind: "empty" };
}
