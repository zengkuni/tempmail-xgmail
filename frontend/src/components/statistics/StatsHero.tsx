import { ChartColumn, RefreshCw } from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";
import { Badge } from "@/components/reui/badge";
import { Button } from "@/components/ui/button";

export function StatsHero({
  onRefresh,
  refreshing,
}: {
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <section className="flex flex-col items-stretch gap-8 min-[992px]:flex-row min-[992px]:items-start min-[992px]:justify-between">
      <div className="flex flex-col gap-1.5">
        <Badge
          variant="primary-light"
          radius="full"
          className="w-fit uppercase tracking-[0.25px]"
        >
          <ChartColumn />
          Statistics
        </Badge>
        <h1 className="text-[34px] font-bold leading-[44.2px]">
          {BRAND_NAME} Insights
        </h1>
        <p className="max-w-[780px] text-lg leading-[28.8px] text-muted-foreground">
          Real-time insights into your temporary email ecosystem (24h)
        </p>
      </div>
      <div className="flex items-center gap-2.5">
        <Badge variant="success-light" radius="full" className="uppercase">
          Window: 24h
        </Badge>
        <Button variant="secondary" onClick={onRefresh}>
          <RefreshCw className={refreshing ? "animate-spin" : undefined} />
          Refresh
        </Button>
      </div>
    </section>
  );
}
