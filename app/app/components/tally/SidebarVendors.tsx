import { useActionQuery } from "@agent-native/core/client/hooks";
import { Link, useLocation } from "react-router";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Overview } from "@/lib/tally";
import { cn } from "@/lib/utils";
import { pathForLocation } from "@shared/routes";

import { Money } from "./primitives";

/** Vendors in the sidebar, each with what it owes you. */
export function SidebarVendors({ collapsed }: { collapsed: boolean }) {
  const { data } = useActionQuery<Overview>("get-overview", {});
  const location = useLocation();
  const vendors = data?.vendors ?? [];
  if (vendors.length === 0) return null;

  return (
    <div className={cn(collapsed ? "flex flex-col items-center gap-1" : "px-2 pt-4")}>
      {!collapsed && <p className="px-3 pb-1 text-xs font-medium text-sidebar-foreground/60">Vendors</p>}
      {vendors.map((vendor) => {
        const path = pathForLocation({ view: "vendor", vendorId: vendor.id });
        const active = location.pathname.startsWith(path);
        const initials = vendor.name.slice(0, 2).toUpperCase();
        const link = (
          <Link
            key={vendor.id}
            to={path}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? vendor.name : undefined}
            className={cn(
              "flex items-center text-sidebar-accent-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              active && "bg-sidebar-accent",
              collapsed ? "size-8 justify-center rounded-md font-figure text-[10px]" : "h-8 w-full gap-2 rounded-lg px-3 text-sm",
            )}
          >
            {collapsed ? (
              initials
            ) : (
              <>
                <span className={cn("size-1.5 shrink-0 rounded-full", vendor.totals.recoverableCents > 0 ? "bg-notch" : "bg-verified")} />
                <span className="min-w-0 flex-1 truncate">{vendor.name}</span>
                <Money cents={vendor.totals.recoverableCents} className="text-xs text-muted-foreground" />
              </>
            )}
          </Link>
        );
        return collapsed ? (
          <Tooltip key={vendor.id}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">{vendor.name}</TooltipContent>
          </Tooltip>
        ) : (
          link
        );
      })}
    </div>
  );
}
