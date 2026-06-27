export type FilterSectionId =
  | "presets"
  | "project-type"
  | "fixed-price"
  | "hourly-rate"
  | "skills"
  | "exclude-countries";

const STORAGE_KEY = "bidautomation:find-filter-sections";

function readAll(): Partial<Record<FilterSectionId, boolean>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Record<FilterSectionId, boolean>>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function readFilterSectionOpen(
  sectionId: FilterSectionId,
  defaultOpen = true,
): boolean {
  const stored = readAll()[sectionId];
  return typeof stored === "boolean" ? stored : defaultOpen;
}

export function writeFilterSectionOpen(sectionId: FilterSectionId, open: boolean): boolean {
  if (typeof window !== "undefined") {
    try {
      const all = readAll();
      all[sectionId] = open;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      /* ignore */
    }
  }
  return open;
}
