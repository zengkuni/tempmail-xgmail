import type { LucideIcon } from "lucide-react";
import { BookOpen, ChartColumn, Globe, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { IconTile } from "@/components/reui/icon-tile";
import { formatStat } from "@/lib/utils";
import type { StatsSnapshot } from "./types";

const CARDS: {
  key: "allTime" | "emails24h" | "uniqueSubjects" | "siteDomains";
  label: string;
  icon: LucideIcon;
  tone: string;
}[] = [
  { key: "allTime", label: "All-time Emails", icon: Inbox, tone: "text-info" },
  {
    key: "emails24h",
    label: "24h Emails",
    icon: ChartColumn,
    tone: "text-success",
  },
  {
    key: "uniqueSubjects",
    label: "Unique Subjects",
    icon: BookOpen,
    tone: "text-violet-600 dark:text-violet-400",
  },
  { key: "siteDomains", label: "Site Domains", icon: Globe, tone: "text-warning" },
];

export function StatCards({ stats }: { stats: StatsSnapshot }) {
  return (
    <div className="grid grid-cols-1 gap-4 min-[768px]:grid-cols-2 min-[992px]:grid-cols-4">
      {CARDS.map(({ key, label, icon: Icon, tone }) => (
        <Card key={key}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={cn("text-xl font-extrabold leading-[33px]", tone)}>
                  {formatStat(stats[key])}
                </p>
                <p className="text-xs font-bold uppercase leading-[16.8px] text-muted-foreground">
                  {label}
                </p>
              </div>
              <IconTile variant="soft" size="sm" className={tone}>
                <Icon />
              </IconTile>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
