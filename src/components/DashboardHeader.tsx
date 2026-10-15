import { Building2 } from "lucide-react";
import { Brand } from "@/components/Brand";
import { Link } from "@tanstack/react-router";
import { UserButton } from "@clerk/tanstack-react-start";
import { ThemeToggleButton } from "@/components/theme/ThemeToggle";
import React from "react";
import { useConvex } from "convex/react";
import { useRoutePrewarmIntent } from "@/lib/useRoutePrewarmIntent";
import { prewarmDashboardIndex } from "../../app/routes/dashboard/-index.data";

export type PathSegment = {
  label: React.ReactNode;
  href?: string;
  prewarmIntentHandlers?: ReturnType<typeof useRoutePrewarmIntent>;
};

export function DashboardHeader({
  children,
  paths = [],
}: {
  children?: React.ReactNode;
  paths?: PathSegment[];
}) {
  const convex = useConvex();
  const prewarmHomeIntentHandlers = useRoutePrewarmIntent(() =>
    prewarmDashboardIndex(convex),
  );

  return (
    <header className="flex-shrink-0 border-b border-line bg-[var(--surface)] grid grid-cols-[1fr_auto] sm:grid-cols-[auto_1fr_auto] items-center px-4 sm:px-6">
      {/* Breadcrumb */}
      <div className="flex items-center text-xl font-semibold tracking-tight text-[#1a1a1a] min-w-0 h-11 sm:h-14">
        <Link
          to="/dashboard"
          preload="intent"
          className="hover:text-[#2d5a2d] transition-colors mr-2 flex-shrink-0"
          {...prewarmHomeIntentHandlers}
        >
          <Brand />
        </Link>
        {paths.map((path, index) => {
          const isIntermediate = paths.length >= 2 && index < paths.length - 1;
          return (
            <div
              key={index}
              className={`${isIntermediate ? "hidden sm:flex" : "flex"} items-center min-w-0 flex-shrink`}
            >
              <span className="text-[#888] mr-2 flex-shrink-0">/</span>
              {path.href ? (
                <Link
                  to={path.href}
                  preload="intent"
                  className="hover:text-[#2d5a2d] transition-colors truncate mr-2"
                  {...path.prewarmIntentHandlers}
                >
                  {path.label}
                </Link>
              ) : (
                <div className="truncate flex items-center gap-3">
                  {path.label}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* User controls — pinned top-right */}
      <div className="row-start-1 col-start-2 sm:col-start-3 flex items-center gap-4 pl-4 border-l border-line h-8">
        <Link
          to="/dashboard"
          // TanStack infers search as never with this project's legacy strictNullChecks=false.
          // Dashboard validates this fixed value; keep the runtime navigation contract.
          search={{ manage: "workspaces" } as never}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-surface hover:text-foreground"
          aria-label="Manage workspaces"
          title="Manage workspaces"
        >
          <Building2 size={18} />
        </Link>
        <ThemeToggleButton />
        <UserButton
          appearance={{
            variables: {
              colorText: "var(--foreground)",
              colorTextSecondary: "var(--foreground-muted)",
              colorBackground: "var(--surface)",
            },
            elements: {
              avatarBox: "w-8 h-8 rounded-full border border-line",
              userButtonPopoverCard:
                "bg-[var(--surface)] border border-line rounded-xl shadow-xl",
              userButtonPopoverActionButton:
                "!text-[#1a1a1a] hover:!bg-[#e8e8e0] rounded-lg",
              userButtonPopoverActionButtonText:
                "!text-[#1a1a1a] hover:!text-[#1a1a1a] font-sans font-medium",
              userButtonPopoverActionButtonIcon:
                "!text-[#1a1a1a] hover:!text-[#1a1a1a]",
              userButtonPopoverFooter: "hidden",
            },
          }}
        />
      </div>

      {/* Children — second row on mobile, middle column on desktop */}
      {children && (
        <div className="col-span-full pb-2 sm:pb-0 sm:col-span-1 sm:col-start-2 sm:row-start-1 flex items-center gap-2 sm:gap-3 sm:justify-end sm:h-14 sm:pl-4 min-w-0">
          {children}
        </div>
      )}
    </header>
  );
}
