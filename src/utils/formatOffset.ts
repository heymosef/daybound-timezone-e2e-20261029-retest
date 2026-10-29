export function utcOffsetLabel(offsetSeconds: number): string {
  const absolute = Math.abs(offsetSeconds);
  const hours = String(Math.floor(absolute / 3600)).padStart(2, "0");
  const minutes = String(Math.floor(absolute % 3600 / 60)).padStart(2, "0");
  const seconds = absolute % 60;
  return `UTC${offsetSeconds < 0 ? "-" : "+"}${hours}:${minutes}${seconds ? `:${String(seconds).padStart(2, "0")}` : ""}`;
}
