const STORAGE_KEY = "bidautomation:find-filters-collapsed";

export function readFindFiltersCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeFindFiltersCollapsed(collapsed: boolean): boolean {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }
  return collapsed;
}
