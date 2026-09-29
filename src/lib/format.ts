export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function formatDateTime(value: string | Date, timeZone?: string) {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: timeZone ? "short" : undefined,
  }).format(new Date(value));
}

export function formatDate(value: string | Date, timeZone?: string) {
  return new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone }).format(new Date(value));
}

export function formatTime(value: string | Date, timeZone?: string) {
  return new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(value));
}

export function formatRelative(value: string | Date) {
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

/** Local calendar day key (YYYY-MM-DD) of an instant in a time zone. */
export function dayKey(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

export const MODALITY_LABEL: Record<string, string> = {
  virtual: "Virtual",
  in_person: "In person",
  both: "Virtual or in person",
};
