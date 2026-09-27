import { Check, Database, Globe, ShieldCheck } from "lucide-react";
import { MX_TARGET } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { IconTile } from "@/components/reui/icon-tile";
import type { DomainStats as DomainStatsData } from "./types";

const CELLS = [
  {
    key: "total",
    label: "Total",
    Icon: Database,
    tone: "text-info",
    value: (s: DomainStatsData) => s.total,
  },
  {
    key: "active",
    label: "Active",
    Icon: Check,
    tone: "text-success",
    value: (s: DomainStatsData) => s.active,
  },
  {
    key: "validMx",
    label: "Valid MX",
    Icon: ShieldCheck,
    tone: "text-violet-600 dark:text-violet-400",
    value: (s: DomainStatsData) => s.validMx,
  },
] as const;

export function DomainStats({ stats }: { stats: DomainStatsData }) {
  return (
    <section className="grid grid-cols-1 gap-4 min-[768px]:grid-cols-2 min-[992px]:grid-cols-4">
      {CELLS.map(({ key, label, Icon, tone, value }) => (
        <Card key={key}>
          <CardContent className="flex items-center gap-3 p-4">
            <IconTile
              variant="soft"
              size="sm"
              className={cn("shrink-0", tone)}
              aria-hidden="true"
            >
              <Icon />
            </IconTile>
            <div className="flex flex-col">
              <span className={cn("text-lg font-extrabold leading-[28.8px]", tone)}>
                {value(stats)}
              </span>
              <span className="text-xs leading-[16.8px] text-muted-foreground">
                {label}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <IconTile
            variant="soft"
            size="sm"
            className="shrink-0 text-warning"
            aria-hidden="true"
          >
            <Globe />
          </IconTile>
          <div className="flex min-w-0 flex-col">
            <code className="w-fit rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
              {MX_TARGET}
            </code>
            <span className="text-xs leading-[16.8px] text-muted-foreground">
              Public domain MX target
            </span>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
