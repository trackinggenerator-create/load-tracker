/** "2026-11-22" → "Sun, Nov 22". Treats the date as a calendar day, so it never shifts with time zones. */
export function formatDay(day: string | null | undefined): string | null {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
