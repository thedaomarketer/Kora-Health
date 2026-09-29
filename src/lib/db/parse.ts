/** Convert a Postgres timestamptz text value to ISO 8601 (UTC). */
export function pgTimestamptzToIso(v: string): string {
  if (v === "infinity" || v === "-infinity") return v;
  // "2026-09-30 13:00:00.123+00" / "+05:30" → ISO 8601
  const iso = v.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00").replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? v : d.toISOString();
}
