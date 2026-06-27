"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDiscoverMonitor } from "@/components/discover-monitor";
import { SidebarUser } from "@/components/sidebar-user";
import { useAuthUser } from "@/lib/use-auth-user";

const nav = [
  { href: "/submitted", label: "Submitted", icon: "✓" },
  { href: "/find", label: "Find projects", icon: "⌕", badge: true },
  { href: "/analytics", label: "Analytics", icon: "◫" },
  { href: "/connect-extension", label: "Connect extension", icon: "⎘" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { state, unreadNew } = useDiscoverMonitor();
  const { role, localAuth } = useAuthUser();
  const findBadge = Math.max(state.unseen, unreadNew);
  const items = [
    ...nav,
    ...(localAuth && role === "admin"
      ? [{ href: "/admin", label: "Admin", icon: "⚙" as const, badge: false as const }]
      : []),
  ];

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-[var(--border)] bg-[#0c0c0f]">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white">
          B
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight">BidAutomation</div>
          <div className="text-xs text-[var(--muted)]">Bid workspace</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const badge = item.badge && findBadge > 0 ? findBadge : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-[var(--accent-soft)] text-indigo-300"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              <span className="text-base opacity-80">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {badge > 0 && (
                <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-xs font-medium tabular-nums text-white">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-[var(--border)] p-3">
        <SidebarUser />
        <Link
          href="/settings"
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
            pathname === "/settings"
              ? "bg-[var(--accent-soft)] text-indigo-300"
              : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
          }`}
        >
          <span className="text-base opacity-80">⚙</span>
          Settings
        </Link>
        <a
          href={`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/export/csv`}
          className="block rounded-xl py-2 text-center text-xs text-zinc-500 hover:text-zinc-300"
        >
          Export CSV
        </a>
      </div>
    </aside>
  );
}
