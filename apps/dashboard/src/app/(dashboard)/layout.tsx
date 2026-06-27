import { Sidebar } from "@/components/sidebar";
import { DashboardShell } from "@/components/layout";
import { DashboardProviders } from "@/components/dashboard-providers";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardProviders>
      <Sidebar />
      <DashboardShell>{children}</DashboardShell>
    </DashboardProviders>
  );
}
