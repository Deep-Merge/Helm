import {
  EMPTY_FILTER_VALUES,
  parseFilterSearchParams,
  parseFindPage,
  parseFindStatus,
  toSearchParams,
  type FindStatusFilter,
  type ProjectFilterValues,
} from "@/lib/project-filters";

const STORAGE_KEY = "bidautomation:find-last-preset";

export type LastFindPresetState = {
  presetId?: string;
  values: ProjectFilterValues;
  status: FindStatusFilter;
};

function filtersEqual(a: ProjectFilterValues, b: ProjectFilterValues): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function isDefaultFindUrl(sp: Record<string, string | undefined>): boolean {
  const filters = parseFilterSearchParams(sp);
  const status = parseFindStatus(sp);
  const page = parseFindPage(sp);
  return page === 1 && status === "all" && filtersEqual(filters, EMPTY_FILTER_VALUES);
}

export function readLastFindPreset(): LastFindPresetState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastFindPresetState;
    if (!parsed?.values || typeof parsed.values !== "object") return null;
    return {
      presetId: parsed.presetId,
      values: { ...EMPTY_FILTER_VALUES, ...parsed.values },
      status: parsed.status ?? "all",
    };
  } catch {
    return null;
  }
}

export function writeLastFindPreset(state: LastFindPresetState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function clearLastFindPreset(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function resolveFindSearchParams(
  sp: Record<string, string | undefined>,
): Record<string, string | undefined> {
  if (!isDefaultFindUrl(sp)) return sp;
  const last = readLastFindPreset();
  if (!last) return sp;
  return Object.fromEntries(
    toSearchParams(last.values, false, 1, last.status).entries(),
  );
}

export function findPathFromLastPreset(): string | null {
  const last = readLastFindPreset();
  if (!last) return null;
  const qs = toSearchParams(last.values, false, 1, last.status).toString();
  return qs ? `/find?${qs}` : "/find";
}
