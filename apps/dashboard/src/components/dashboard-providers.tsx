"use client";

import type { ReactNode } from "react";
import { DiscoverMonitorProvider } from "@/components/discover-monitor";

export function DashboardProviders({ children }: { children: ReactNode }) {
  return <DiscoverMonitorProvider>{children}</DiscoverMonitorProvider>;
}
