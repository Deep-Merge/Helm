import { hasActiveFindFilters } from "@/lib/freelancer-search";
import type { ProjectFilterValues } from "@/lib/project-filters";

export function buildDiscoverSummary(
  filters: ProjectFilterValues,
  meta: {
    fetched: number;
    newCount: number;
    total: number;
    unseen: number;
    mode: "full" | "incremental" | "local";
  },
): string {
  const { fetched, newCount, total, unseen, mode } = meta;
  const unseenPart = unseen > 0 ? ` · ${unseen} not seen` : "";

  if (mode === "full") {
    return `Saved ${fetched} from Freelancer · showing ${total} match${total !== 1 ? "es" : ""}${unseenPart}`;
  }
  if (newCount > 0) {
    return `Saved ${newCount} new · showing ${total} match${total !== 1 ? "es" : ""}${unseenPart}`;
  }
  if (hasActiveFindFilters(filters)) {
    return `No new projects since last check · showing ${total} match${total !== 1 ? "es" : ""}${unseenPart}`;
  }
  return `Showing ${total} saved project${total !== 1 ? "s" : ""}${unseenPart}`;
}
