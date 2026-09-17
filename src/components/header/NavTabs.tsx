"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Kanban, FileText } from "lucide-react";

export function NavTabs() {
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
      className="hidden md:flex items-center gap-1 p-1 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 shrink-0"
      aria-label="Workspace views"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm transition-all duration-200 ${
              item.isActive
                ? "font-semibold bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-2xs"
                : "font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Icon
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                item.isActive
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
