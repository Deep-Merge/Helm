"use client";

import { FindPagination } from "@/components/find-pagination";

export function SubmittedPagination({
  page,
  totalPages,
  total,
  pageSize,
  baseQuery,
  className,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  baseQuery: string;
  className?: string;
}) {
  const buildHref = (nextPage: number) => {
    const params = new URLSearchParams(baseQuery);
    params.delete("page");
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    return qs ? `/submitted?${qs}` : "/submitted";
  };

  return (
    <FindPagination
      className={className}
      page={page}
      totalPages={totalPages}
      total={total}
      pageSize={pageSize}
      buildHref={buildHref}
    />
  );
}
