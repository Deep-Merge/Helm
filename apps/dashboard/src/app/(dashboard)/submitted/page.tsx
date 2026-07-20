import { PageHeader } from "@/components/layout";
import { SubmittedFilters } from "@/components/submitted-filters";
import { SubmittedPagination } from "@/components/submitted-pagination";
import { SubmittedProjectCards } from "@/components/submitted-project-cards";
import { getProjectsWithFilters } from "@/lib/api";
import {
  buildSubmittedRedirectQuery,
  needsDefaultDateRedirect,
  parseSubmittedFilterSearchParams,
  toSubmittedSearchParams,
} from "@/lib/submitted-filters";
import { redirect } from "next/navigation";

const SUBMITTED_PAGE_SIZE = 50;

export default async function SubmittedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  if (needsDefaultDateRedirect(sp)) {
    redirect(`/submitted?${buildSubmittedRedirectQuery(sp)}`);
  }
  const filters = parseSubmittedFilterSearchParams(sp);
  const parsedPage = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const baseQuery = toSubmittedSearchParams(filters).toString();
  const returnTo =
    page > 1 ? `/submitted?${baseQuery}&page=${page}` : `/submitted?${baseQuery}`;

  let projects: Awaited<ReturnType<typeof getProjectsWithFilters>>["projects"] = [];
  let total = 0;
  let dayCounts: Record<string, number> = {};
  let error: string | null = null;

  try {
    let dc: Record<string, number> | undefined;
    ({ projects, total, day_counts: dc } = await getProjectsWithFilters({
      status: "submitted",
      q: filters.q.trim() || undefined,
      budget_type: filters.budget_type !== "any" ? filters.budget_type : undefined,
      bid_min: filters.min_budget ? Number(filters.min_budget) : undefined,
      bid_max: filters.max_budget ? Number(filters.max_budget) : undefined,
      date_from: filters.range === "all" ? undefined : filters.date_from || undefined,
      date_to: filters.range === "all" ? undefined : filters.date_to || undefined,
      tz_offset: filters.range === "all" ? undefined : filters.tz_offset,
      date_field: "submitted",
      limit: SUBMITTED_PAGE_SIZE,
      offset: (page - 1) * SUBMITTED_PAGE_SIZE,
      include_day_counts: true,
    }));
    dayCounts = dc ?? {};
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not reach API";
  }

  const totalPages = Math.max(1, Math.ceil(total / SUBMITTED_PAGE_SIZE));

  return (
    <>
      <PageHeader title="Submitted" description="Projects you have placed bids on." />
      {error && (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          API error: {error}. Is the backend running on port 8000?
        </p>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <SubmittedFilters initial={filters} />
        </div>
        <SubmittedPagination
          className="ml-auto shrink-0"
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={SUBMITTED_PAGE_SIZE}
          baseQuery={baseQuery}
        />
      </div>
      <SubmittedProjectCards
        projects={projects}
        returnTo={returnTo}
        searchQuery={filters.q.trim()}
        dayCounts={dayCounts}
      />
    </>
  );
}
