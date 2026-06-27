"use client";

import Link from "next/link";
import { buildPaginationItems } from "@/lib/pagination-pages";

export function FindPagination({
  page,
  totalPages,
  total,
  pageSize,
  buildHref,
  className = "",
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  buildHref: (page: number) => string;
  className?: string;
}) {
  if (total === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const pageBtnClass =
    "inline-flex min-w-[2rem] items-center justify-center rounded-lg px-2 py-1 text-xs font-medium transition";
  const items = buildPaginationItems(page, totalPages);

  return (
    <nav
      className={`flex flex-wrap items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.04] px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${className}`}
      aria-label="Project pages"
    >
      <span className="px-1 text-xs text-zinc-500">
        {start}–{end} of {total}
      </span>
      {totalPages > 1 && (
        <>
          {page > 1 ? (
            <Link
              href={buildHref(page - 1)}
              className={`${pageBtnClass} bg-white/5 text-zinc-300 hover:bg-white/10`}
              aria-label="Previous page"
            >
              ‹
            </Link>
          ) : (
            <span className={`${pageBtnClass} text-zinc-600`} aria-hidden>
              ‹
            </span>
          )}
          {items.map((item, index) =>
            item === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className={`${pageBtnClass} text-zinc-600`} aria-hidden>
                …
              </span>
            ) : (
              <Link
                key={item}
                href={buildHref(item)}
                aria-current={item === page ? "page" : undefined}
                className={`${pageBtnClass} ${item === page ? "bg-indigo-500 text-white" : "bg-white/5 text-zinc-400 hover:bg-white/10"}`}
              >
                {item}
              </Link>
            ),
          )}
          {page < totalPages ? (
            <Link
              href={buildHref(page + 1)}
              className={`${pageBtnClass} bg-white/5 text-zinc-300 hover:bg-white/10`}
              aria-label="Next page"
            >
              ›
            </Link>
          ) : (
            <span className={`${pageBtnClass} text-zinc-600`} aria-hidden>
              ›
            </span>
          )}
        </>
      )}
    </nav>
  );
}
