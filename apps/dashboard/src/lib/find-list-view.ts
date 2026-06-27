export type FindListViewMode = "long" | "short" | "table";

const STORAGE_KEY = "bidautomation_find_list_view";
const LEGACY_COMPACT_KEY = "bidautomation_find_compact_list";

export function readFindListView(): FindListViewMode {
  if (typeof window === "undefined") return "long";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "long" || stored === "short" || stored === "table") {
      return stored;
    }
    if (localStorage.getItem(LEGACY_COMPACT_KEY) === "1") {
      return "short";
    }
  } catch {
    /* ignore */
  }
  return "long";
}

export function writeFindListView(mode: FindListViewMode): FindListViewMode {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }
  return mode;
}

/** @deprecated use readFindListView */
export function readCompactListView(): boolean {
  return readFindListView() === "short";
}

/** @deprecated use writeFindListView */
export function writeCompactListView(compact: boolean): boolean {
  writeFindListView(compact ? "short" : "long");
  return compact;
}
