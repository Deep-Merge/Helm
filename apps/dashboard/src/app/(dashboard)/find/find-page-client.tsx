"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { PageHeader } from "@/components/layout";
import { useDiscoverMonitor } from "@/components/discover-monitor";
import { ProjectFilters } from "@/components/project-filters";
import { ProjectListCards } from "@/components/project-list-cards";
import { ProjectFindTable } from "@/components/project-find-table";
import {
  DiscoverLoadingIndicator,
  ProjectListSkeleton,
} from "@/components/project-list-skeleton";
import { FindPageToolbar } from "@/components/find-page-toolbar";
import { FindStatusFilters } from "@/components/find-status-filters";
import { filterValuesToDiscoverQuery } from "@/lib/find-discover-query";
import {
  isDefaultFindUrl,
  resolveFindSearchParams,
} from "@/lib/find-last-preset";
import { FIND_TABLE_PAGE_SIZE } from "@/lib/discover-client";
import { consumeFindScrollRestore, restoreFindScroll } from "@/lib/find-scroll-restore";
import {
  readFindListView,
  writeFindListView,
  type FindListViewMode,
} from "@/lib/find-list-view";
import {
  readFindFiltersCollapsed,
  writeFindFiltersCollapsed,
} from "@/lib/find-filters-sidebar";
import {
  parseFilterSearchParams,
  parseFindPage,
  parseFindStatus,
  toSearchParams,
  findDateRange,
  withFindDateRange,
  type FindPriceSort,
  type FindStatusFilter,
} from "@/lib/project-filters";
import { getBrowserTimezoneOffset, type DateRange } from "@/lib/date-range";

function filtersToQuery(
  filters: ReturnType<typeof parseFilterSearchParams>,
  page: number,
  status: FindStatusFilter,
  listView: FindListViewMode,
) {
  return {
    ...filterValuesToDiscoverQuery(filters, page, status),
    list_limit: listView === "table" ? FIND_TABLE_PAGE_SIZE : undefined,
  };
}

function loadingMessage() {
  return "Checking for new projects…";
}

export function FindPageSkeleton() {
  return (
    <FindPageLayout
      pageHeader={
        <div className="-mx-6 mb-4 border-b border-white/[0.08] px-6 pb-4 pt-2">
          <PageHeader
            title="Find projects"
            titleClassName="text-3xl"
            className="!mb-0"
          />
        </div>
      }
      filters={<FilterSidebarSkeleton />}
      main={
        <>
          <DiscoverLoadingIndicator />
          <ProjectListSkeleton />
        </>
      }
    />
  );
}

function FilterSidebarSkeleton() {
  return (
    <div className="glass animate-pulse rounded-2xl px-4 py-2">
      <div className="border-b border-white/[0.08] py-3">
        <div className="h-5 w-16 rounded bg-white/[0.06]" />
      </div>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="space-y-3 border-b border-white/[0.08] py-4">
          <div className="flex justify-between">
            <div className="h-4 w-24 rounded bg-white/[0.06]" />
            <div className="h-3 w-10 rounded bg-white/[0.06]" />
          </div>
          <div className="h-10 rounded-full bg-white/[0.06]" />
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, j) => (
              <div key={j} className="h-4 rounded bg-white/[0.06]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function useElementHeight(ref: RefObject<HTMLElement | null>) {
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => setHeight(el.getBoundingClientRect().height);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [ref]);

  return height;
}

function FiltersSidebarToggle({
  expanded,
  onClick,
  className = "",
}: {
  expanded: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-lg p-1.5 text-zinc-500 ring-1 ring-white/10 transition hover:bg-white/5 hover:text-zinc-200 ${className}`}
      aria-label={expanded ? "Collapse filters" : "Expand filters"}
      title={expanded ? "Collapse filters" : "Expand filters"}
    >
      {expanded ? (
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M11 5 6 10l5 5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 5v10" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M9 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 5v10" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}

function FindPageLayout({
  pageHeader,
  filters,
  main,
  stickyHeaderHeight = 0,
  filtersCollapsed = false,
  fullWidth = false,
}: {
  pageHeader: React.ReactNode;
  filters: React.ReactNode;
  main: React.ReactNode;
  stickyHeaderHeight?: number;
  filtersCollapsed?: boolean;
  fullWidth?: boolean;
}) {
  const sidebarStickyTop = stickyHeaderHeight > 0 ? stickyHeaderHeight + 12 : 24;

  return (
    <div className={fullWidth ? "w-full max-w-none -mx-6 px-6" : "mx-auto w-full max-w-7xl"}>
      {pageHeader}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {!filtersCollapsed && (
          <aside className="w-full shrink-0 lg:w-80 xl:w-[22rem]">
            <div
              className="lg:sticky lg:self-start"
              style={{ top: sidebarStickyTop }}
            >
              {filters}
            </div>
          </aside>
        )}
        <section className="min-w-0 flex-1">{main}</section>
      </div>
    </div>
  );
}

export function FindPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const spObj = useMemo(
    () => Object.fromEntries(searchParams.entries()) as Record<string, string | undefined>,
    [searchParams],
  );
  const restoredPresetRef = useRef(false);

  useLayoutEffect(() => {
    if (restoredPresetRef.current) return;
    if (!isDefaultFindUrl(spObj)) return;
    const resolved = resolveFindSearchParams(spObj);
    if (resolved === spObj) return;
    restoredPresetRef.current = true;
    const qs = new URLSearchParams(
      Object.entries(resolved).filter((entry): entry is [string, string] => entry[1] != null),
    ).toString();
    router.replace(qs ? `/find?${qs}` : "/find", { scroll: false });
  }, [spObj, router]);

  const effectiveSpObj = useMemo(() => resolveFindSearchParams(spObj), [spObj]);
  const { state, refresh, refreshForList, setActiveFilters, recentPollNew, dismissRecentPollNew } =
    useDiscoverMonitor();

  const filters = useMemo(() => parseFilterSearchParams(effectiveSpObj), [effectiveSpObj]);
  const status = useMemo(() => parseFindStatus(effectiveSpObj), [effectiveSpObj]);
  const page = useMemo(() => parseFindPage(effectiveSpObj), [effectiveSpObj]);
  const [liveQ, setLiveQ] = useState(filters.q);
  const [listView, setListView] = useState<FindListViewMode>("long");
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

  useEffect(() => {
    setLiveQ(filters.q);
  }, [filters.q]);

  const activeFilters = useMemo(
    () => ({ ...filters, q: liveQ }),
    [filters, liveQ],
  );
  const searchPage = liveQ.trim() !== filters.q.trim() ? 1 : page;
  const query = useMemo(
    () => filtersToQuery(activeFilters, searchPage, status, listView),
    [activeFilters, searchPage, status, listView],
  );
  const listKey = useMemo(
    () => JSON.stringify({ filters: activeFilters, status, page: searchPage, listView }),
    [activeFilters, status, searchPage, listView],
  );
  const skipListRefreshRef = useRef(true);
  const pendingScrollRestoreRef = useRef<number | null>(null);
  const prefsHydratedRef = useRef(false);
  const initialFetchDoneRef = useRef(false);
  const stickyPageHeaderRef = useRef<HTMLDivElement>(null);
  const stickyHeaderHeight = useElementHeight(stickyPageHeaderRef);

  const returnTo = `/find?${toSearchParams(filters, false, page, status).toString()}`;

  useLayoutEffect(() => {
    setListView(readFindListView());
    setFiltersCollapsed(readFindFiltersCollapsed());
    const scrollY = consumeFindScrollRestore(returnTo);
    if (scrollY != null) pendingScrollRestoreRef.current = scrollY;
    prefsHydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once when landing on Find
  }, []);

  useEffect(() => {
    setActiveFilters(query);
  }, [query, setActiveFilters]);

  // Discover from Freelancer — wait until list view is loaded so table mode uses 50 items
  useEffect(() => {
    if (!prefsHydratedRef.current || initialFetchDoneRef.current) return;
    initialFetchDoneRef.current = true;
    if (pendingScrollRestoreRef.current != null) {
      void refreshForList(listKey, { filters: query, silent: true });
      return;
    }
    void refresh({ filters: query, silent: false });
  }, [query, listKey, refresh, refreshForList]);

  // Filter / page / status / search changes re-list saved projects immediately
  useLayoutEffect(() => {
    if (skipListRefreshRef.current) {
      skipListRefreshRef.current = false;
      if (pendingScrollRestoreRef.current != null) {
        void refreshForList(listKey, { filters: query, silent: true });
      }
      return;
    }
    void refreshForList(listKey, { filters: query, silent: true });
  }, [listKey, query, refreshForList]);

  function pushFindUrl(
    nextFilters: ReturnType<typeof parseFilterSearchParams>,
    nextStatus: FindStatusFilter,
    nextPage = 1,
  ) {
    const params = toSearchParams(nextFilters, false, nextPage, nextStatus);
    if (
      nextFilters.range !== "all" &&
      (nextFilters.date_from || nextFilters.date_to)
    ) {
      params.set("tz_offset", String(getBrowserTimezoneOffset()));
    }
    router.replace(`/find?${params.toString()}`, { scroll: false });
  }

  function buildHref(nextStatus: FindStatusFilter, nextPage = page) {
    return `/find?${toSearchParams(filters, false, nextPage, nextStatus).toString()}`;
  }

  function handleStatusChange(nextStatus: FindStatusFilter) {
    pushFindUrl(filters, nextStatus, 1);
  }

  function handleDateRangeChange(range: DateRange) {
    pushFindUrl(withFindDateRange(filters, range), status, 1);
  }

  function handleSortChange(nextSort: FindPriceSort) {
    pushFindUrl({ ...filters, sort: nextSort }, status, 1);
  }

  function handleSearchChange(q: string) {
    setLiveQ(q);
    pushFindUrl({ ...filters, q }, status, 1);
  }

  const hasResults = state.projects.length > 0;
  const loading = state.loading;
  const isInitialLoad = loading && !hasResults;

  function handleRefreshNow() {
    void refresh({ filters: query, silent: false, forceFull: true });
  }

  useEffect(() => {
    if (isInitialLoad || pendingScrollRestoreRef.current == null) return;
    if (state.page !== page) return;
    const scrollY = pendingScrollRestoreRef.current;
    pendingScrollRestoreRef.current = null;
    restoreFindScroll(scrollY);
  }, [isInitialLoad, state.projects.length, state.page, page]);

  function collapseFilters() {
    setFiltersCollapsed(writeFindFiltersCollapsed(true));
  }

  function expandFilters() {
    setFiltersCollapsed(writeFindFiltersCollapsed(false));
  }

  function handleListViewChange(mode: FindListViewMode) {
    setListView(writeFindListView(mode));
  }

  const isTableView = listView === "table";

  return (
    <FindPageLayout
      stickyHeaderHeight={stickyHeaderHeight}
      filtersCollapsed={filtersCollapsed}
      fullWidth={isTableView}
      pageHeader={
        <div
          ref={stickyPageHeaderRef}
          className="sticky top-0 z-30 -mx-6 mb-4 border-b border-white/[0.08] bg-[#09090b]/95 px-6 pb-3 pt-2 backdrop-blur-md supports-[backdrop-filter]:bg-[#09090b]/85"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Find projects</h1>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {filtersCollapsed && (
                <FiltersSidebarToggle expanded={false} onClick={expandFilters} />
              )}
              <FindPageToolbar
                onRefresh={handleRefreshNow}
                loading={loading}
                listView={listView}
                onListViewChange={handleListViewChange}
              />
            </div>
          </div>

          {!isInitialLoad && (
            <div className="mt-2">
              <FindStatusFilters
                active={status}
                buildHref={buildHref}
                page={state.page}
                totalPages={state.totalPages}
                total={state.total}
                pageSize={state.pageSize}
                pipelineCounts={state.pipelineCounts}
                showPagination={true}
                searchQuery={liveQ}
                onSearchChange={handleSearchChange}
                refreshNewFound={recentPollNew}
                onDismissRefreshNewFound={dismissRecentPollNew}
                dateRange={findDateRange(filters)}
                onDateRangeChange={handleDateRangeChange}
                sort={filters.sort}
                onSortChange={handleSortChange}
                onStatusChange={handleStatusChange}
              />
            </div>
          )}
        </div>
      }
      filters={
        <ProjectFilters
          initial={filters}
          comfortable
          layout="sidebar"
          onCollapse={() => collapseFilters()}
          collapseToggle={
            <FiltersSidebarToggle expanded={true} onClick={collapseFilters} />
          }
        />
      }
      main={
        <>
          {state.error && (
            <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-base text-amber-200">
              {state.error}
            </p>
          )}
          {isInitialLoad && (
            <DiscoverLoadingIndicator message={loadingMessage()} />
          )}
          {isInitialLoad ? (
            <ProjectListSkeleton />
          ) : isTableView ? (
            <ProjectFindTable projects={state.projects} returnTo={returnTo} />
          ) : (
            <ProjectListCards
              projects={state.projects}
              returnTo={returnTo}
              compact={listView === "short"}
            />
          )}
        </>
      }
    />
  );
}
