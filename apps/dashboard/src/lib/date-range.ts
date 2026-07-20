export type DateRange = {
  from: string;
  to: string;
};

export function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getTodayRange(): DateRange {
  const today = toIsoDate(new Date());
  return { from: today, to: today };
}

export function getLast7DaysRange(): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

export function iterDaysInRange(range: DateRange): string[] {
  const start = parseIsoDate(range.from);
  const end = parseIsoDate(range.to || range.from);
  if (!start || !end) return [];
  const days: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    days.push(toIsoDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export function localDayFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : null;
  }
  return toIsoDate(d);
}

export function formatShortDay(iso: string): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function formatDotDayDate(iso: string): string {
  const d = parseIsoDate(iso);
  if (!d) return iso;
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

export function formatSubmittedDayHeading(iso: string): { title: string; date: string } {
  const date = formatDotDayDate(iso);
  const today = toIsoDate(new Date());
  if (iso === today) return { title: "Today", date };
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === toIsoDate(yesterday)) return { title: "Yesterday", date };
  return { title: formatShortDay(iso), date };
}

export function formatSubmittedDayLabel(iso: string): string {
  const { title, date } = formatSubmittedDayHeading(iso);
  return `${title} · ${date}`;
}

/** Minutes to add to local time to get UTC — matches JS Date.getTimezoneOffset(). */
export function getBrowserTimezoneOffset(): number {
  return new Date().getTimezoneOffset();
}

export function isTodayRange(range: DateRange): boolean {
  const today = toIsoDate(new Date());
  return range.from === today && (!range.to || range.to === today);
}

export function formatDateRangeLabel(range: DateRange): string {
  if (!range.from && !range.to) return "All time";
  if (isTodayRange(range)) return "Today";
  const fmt = (iso: string) => {
    const d = parseIsoDate(iso);
    if (!d) return iso;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };
  if (range.from && range.to) {
    if (range.from === range.to) return fmt(range.from);
    return `${fmt(range.from)} – ${fmt(range.to)}`;
  }
  if (range.from) return `From ${fmt(range.from)}`;
  return `Until ${fmt(range.to)}`;
}

export function isDateInRange(iso: string, from: string, to: string): boolean {
  const d = parseIsoDate(iso);
  if (!d) return false;
  const start = from ? parseIsoDate(from) : null;
  const end = to ? parseIsoDate(to) : null;
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
}

export function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export const RANGE_PRESETS: { label: string; getRange: () => DateRange }[] = [
  {
    label: "Today",
    getRange: getTodayRange,
  },
  {
    label: "Last 7 days",
    getRange: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 6);
      return { from: toIsoDate(from), to: toIsoDate(to) };
    },
  },
  {
    label: "Last 30 days",
    getRange: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 29);
      return { from: toIsoDate(from), to: toIsoDate(to) };
    },
  },
  {
    label: "This month",
    getRange: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toIsoDate(from), to: toIsoDate(now) };
    },
  },
  {
    label: "Last month",
    getRange: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toIsoDate(from), to: toIsoDate(to) };
    },
  },
];
