import { PageHeader } from "@/components/layout";
import { SubmittedFilters } from "@/components/submitted-filters";
import { SubmittedProjectCards } from "@/components/submitted-project-cards";
import { getProjectsWithFilters } from "@/lib/api";
import {
  buildSubmittedRedirectQuery,
  needsDefaultDateRedirect,
  parseSubmittedFilterSearchParams,
  toSubmittedSearchParams,
} from "@/lib/submitted-filters";
import { redirect } from "next/navigation";

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
  const returnTo = `/submitted?${toSubmittedSearchParams(filters).toString()}`;

  let projects: Awaited<ReturnType<typeof getProjectsWithFilters>>["projects"] = [];
  let error: string | null = null;

  try {
    ({ projects } = await getProjectsWithFilters({
      status: "submitted",
      budget_type: filters.budget_type !== "any" ? filters.budget_type : undefined,
      bid_min: filters.min_budget ? Number(filters.min_budget) : undefined,
      bid_max: filters.max_budget ? Number(filters.max_budget) : undefined,
      date_from: filters.range === "all" ? undefined : filters.date_from || undefined,
      date_to: filters.range === "all" ? undefined : filters.date_to || undefined,
      tz_offset: filters.range === "all" ? undefined : filters.tz_offset,
      date_field: "submitted",
    }));
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not reach API";
  }

  return (
    <>
      <PageHeader title="Submitted" description="Projects you have placed bids on." />
      {error && (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          API error: {error}. Is the backend running on port 8000?
        </p>
      )}
      <SubmittedFilters initial={filters} />
      <SubmittedProjectCards projects={projects} returnTo={returnTo} />
    </>
  );
}
