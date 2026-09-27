import type { ReactElement } from "react";
import { Frame, FramePanel } from "@/components/reui/frame";
import { Separator } from "@/components/ui/separator";
import { formatStat } from "@/lib/utils";

export function StatsSummary({
  total,
  peakLabel,
  peakValue,
  activeHours,
  avgPerHour,
}: {
  total: number;
  peakLabel: string;
  peakValue: number;
  activeHours: number;
  avgPerHour: number;
}): ReactElement {
  const pct = Math.max(0, Math.min(100, Math.round((activeHours / 24) * 100)));
  const rows: [string, string][] = [
    ["Peak hour", `${peakLabel} · ${formatStat(peakValue)}`],
    ["Active hours", `${activeHours}/24 hours`],
    ["Avg/hour", formatStat(avgPerHour)],
  ];
  return (
    <Frame>
      <FramePanel className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase leading-[16.8px] text-muted-foreground">
              Window total
            </p>
            <h2 className="text-[26px] font-bold leading-[35.1px]">
              {formatStat(total)}
            </h2>
          </div>
          <div
            className="h-[104px] w-[104px] shrink-0 rounded-full p-[9px]"
            style={{
              background: `conic-gradient(var(--success) ${pct}%, var(--border) 0)`,
            }}
          >
            <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-card">
              <p className="text-base font-extrabold">{pct}%</p>
              <p className="text-[10px] leading-[10px] text-muted-foreground">
                Activity map
              </p>
            </div>
          </div>
        </div>
        <Separator />
        <div className="flex flex-col gap-3">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-4"
            >
              <p className="text-sm leading-[20.3px] text-muted-foreground">
                {label}
              </p>
              <p className="text-base font-extrabold leading-[24.8px]">
                {value}
              </p>
            </div>
          ))}
        </div>
      </FramePanel>
    </Frame>
  );
}
