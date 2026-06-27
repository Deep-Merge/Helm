import type { ReactNode } from "react";

export function PageHeader({
  title,
  titleHref,
  titleElement,
  description,
  meta,
  summary,
  action,
  className = "",
  titleClassName = "text-2xl",
  descriptionClassName = "text-sm",
}: {
  title: string;
  titleHref?: string;
  titleElement?: ReactNode;
  description?: string;
  meta?: string;
  summary?: ReactNode;
  action?: ReactNode;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}) {
  return (
    <div className={`mb-8 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className={`font-semibold tracking-tight ${titleClassName}`}>
          {titleElement ?? (titleHref ? (
            <a
              href={titleHref}
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-indigo-300"
            >
              {title}
            </a>
          ) : (
            title
          ))}
        </h1>
        {action}
      </div>
      {description && (
        <p className={`mt-2 w-full text-[var(--muted)] ${descriptionClassName}`}>{description}</p>
      )}
      {summary && <div className="mt-2 w-full">{summary}</div>}
      {meta && (
        <p className="mt-1 w-full text-sm text-zinc-500">{meta}</p>
      )}
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen pl-56">
      <main className="w-full px-6 py-8">{children}</main>
    </div>
  );
}
