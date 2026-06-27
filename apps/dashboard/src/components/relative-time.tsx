"use client";

import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/relative-time";

export function RelativeTime({
  value,
  className,
  titlePrefix = "Captured",
}: {
  value: string | null | undefined;
  className?: string;
  titlePrefix?: string;
}) {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (!value) {
    return <span className={className}>—</span>;
  }

  const absolute = new Date(value);
  const title = Number.isNaN(absolute.getTime())
    ? undefined
    : `${titlePrefix} ${absolute.toLocaleString()}`;

  return (
    <span className={className} title={title}>
      {formatRelativeTime(value)}
    </span>
  );
}
