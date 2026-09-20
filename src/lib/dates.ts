// Site-wide date display. Every page renders dates through these so the
// format is one decision, not one per screen: dd/mm/yyyy (plus HH:mm for
// timestamps). Never use toLocaleDateString() directly in a page.

const pad = (n: number) => String(n).padStart(2, '0');

/** Parse anything the API hands back (ISO string, Date, epoch) or null if invalid. */
export function toDate(v: unknown): Date | null {
  if (v == null || v === '') return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

/** dd/mm/yyyy, or `fallback` when the value isn't a valid date. */
export function fmtDate(v: unknown, fallback = '-'): string {
  const d = toDate(v);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : fallback;
}

/** dd/mm/yyyy HH:mm, for audit trails and sent/filled timestamps. */
export function fmtDateTime(v: unknown, fallback = '-'): string {
  const d = toDate(v);
  return d ? `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : fallback;
}
