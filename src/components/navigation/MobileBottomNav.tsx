"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Kanban, FileText } from "lucide-react";

export function MobileBottomNav() {
  const pathname = usePathname();
  const isPlannerActive = pathname === "/";
  const isKanbanActive = pathname.startsWith("/kanban");
  const isDocsActive = pathname.startsWith("/docs");

  const navItems = [
    {
      href: "/",
      label: "Planner",
      icon: CalendarDays,
      isActive: isPlannerActive,
    },
    {
      href: "/kanban",
      label: "Kanban",
      icon: Kanban,
      isActive: isKanbanActive,
    },
    {
      href: "/docs",
      label: "Docs",
      icon: FileText,
      isActive: isDocsActive,
    },
  ];

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white dark:bg-neutral-900 border-t border-slate-200/90 dark:border-neutral-800 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)] px-3 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.isActive ? "page" : undefined}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-200 select-none ${
                item.isActive
                  ? "text-amber-600 dark:text-amber-400 font-semibold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
              }`}
            >
              <div
                className={`p-1 rounded-lg transition-colors ${
                  item.isActive
                    ? "bg-amber-50 dark:bg-amber-950/60"
                    : "bg-transparent"
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[11px] leading-tight tracking-tight mt-0.5">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
