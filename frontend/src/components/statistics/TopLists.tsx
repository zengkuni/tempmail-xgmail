import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/reui/badge";
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Progress } from "@/components/ui/progress";
import { formatStat } from "@/lib/utils";
import type { TopListData } from "./types";

// Per-list accent hues (static strings: Tailwind needs the literals).
const ACCENTS = [
  {
    solid: "default",
    light: "primary-light",
    bar: "[&_[data-slot=progress-indicator]]:bg-primary",
  },
  {
    solid: "success",
    light: "success-light",
    bar: "[&_[data-slot=progress-indicator]]:bg-success",
  },
  {
    solid: "warning",
    light: "warning-light",
    bar: "[&_[data-slot=progress-indicator]]:bg-warning",
  },
] as const;

export function TopLists({
  lists,
}: {
  lists: [TopListData, TopListData, TopListData];
}): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-4 min-[992px]:grid-cols-3">
      {lists.map((list, listIndex) => {
        const accent = ACCENTS[listIndex] ?? ACCENTS[0];
        const max = list.rows[0]?.count ?? 0;
        return (
          <Frame key={list.title}>
            <FramePanel className="flex flex-col gap-4">
              <FrameHeader className="mb-4 flex-row items-center justify-between gap-4 border-b border-border">
                <FrameTitle className="text-lg font-bold">
                  {list.title}
                </FrameTitle>
                <Badge variant={accent.light} radius="full">
                  {list.rows.length}
                </Badge>
              </FrameHeader>
              {list.rows.map((row, i) => (
                <div key={row.label} className="grid grid-cols-[minmax(0,1fr)] gap-[7px]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Badge
                        variant={i < 3 ? accent.solid : accent.light}
                        radius="full"
                        className="min-w-[32px] justify-center tabular-nums"
                      >
                        {i + 1}
                      </Badge>
                      <p
                        title={row.label}
                        className="min-w-0 truncate text-sm leading-[20.3px]"
                      >
                        {row.label}
                      </p>
                    </div>
                    <p className="shrink-0 text-right text-sm font-extrabold tabular-nums leading-[20.3px]">
                      {formatStat(row.count)}
                    </p>
                  </div>
                  <Progress
                    value={max > 0 ? (row.count / max) * 100 : 0}
                    className={cn("h-[3px]", accent.bar)}
                  />
                </div>
              ))}
            </FramePanel>
          </Frame>
        );
      })}
    </div>
  );
}
