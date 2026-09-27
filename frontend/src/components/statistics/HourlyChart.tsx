import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/reui/badge";
import { Button } from "@/components/ui/button";
import {
  Frame,
  FrameHeader,
  FramePanel,
} from "@/components/reui/frame";
import { formatStat } from "@/lib/utils";
import type { HourlyPoint } from "./types";

// Chart geometry derived from live extract (extract/chart.json): 864x312 svg,
// gridlines x 74->842 at 5 levels, plot points x 90->826, max -> y21, 0 -> y266.
const VB_W = 864;
const VB_H = 312;
const PLOT_LEFT = 90;
const PLOT_RIGHT = 826;
const PLOT_TOP = 21;
const PLOT_BOTTOM = 266;
const GRID_LEFT = 74;
const GRID_RIGHT = 842;
const Y_LABEL_X = 62;
const GRID_FRACTIONS = [1, 0.75, 0.5, 0.25, 0] as const;

interface Point {
  x: number;
  y: number;
}

const rnd = (n: number) => Math.round(n * 100) / 100;

/** Catmull-Rom -> cubic bezier smoothing through all points. */
function buildLinePath(pts: Point[]): string {
  if (pts.length === 0) return "";
  let d = `M ${rnd(pts[0].x)} ${rnd(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${rnd(c1x)} ${rnd(c1y)}, ${rnd(c2x)} ${rnd(c2y)}, ${rnd(p2.x)} ${rnd(p2.y)}`;
  }
  return d;
}

export function HourlyChart({
  hourly,
  total,
}: {
  hourly: HourlyPoint[];
  total: number;
}) {
  const max = Math.max(1, ...hourly.map((p) => p.value));
  const step =
    hourly.length > 1 ? (PLOT_RIGHT - PLOT_LEFT) / (hourly.length - 1) : 0;
  const points: Point[] = hourly.map((p, i) => ({
    x: PLOT_LEFT + step * i,
    y: PLOT_BOTTOM - (p.value / max) * (PLOT_BOTTOM - PLOT_TOP),
  }));

  const linePath = buildLinePath(points);
  const areaPath =
    points.length > 0
      ? `${linePath} L ${rnd(points[points.length - 1].x)} ${PLOT_BOTTOM} L ${rnd(points[0].x)} ${PLOT_BOTTOM} Z`
      : "";

  return (
    <Frame className="w-full">
      <FramePanel className="flex flex-col gap-4">
        <FrameHeader className="mb-4 flex-row flex-wrap items-center justify-between gap-3 border-b border-border">
          <div>
            <h2 className="text-[22px] font-bold leading-[30.8px]">
              Hourly Email Distribution
            </h2>
            <p className="text-sm leading-[20.3px] text-muted-foreground">
              Emails per Hour
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="icon-sm"
              disabled
              aria-label="Previous 24 hours"
            >
              <ChevronLeft />
            </Button>
            <Badge variant="success-light" radius="full" className="uppercase">
              Last 24 hours
            </Badge>
            <Button
              variant="secondary"
              size="icon-sm"
              disabled
              aria-label="Next 24 hours"
            >
              <ChevronRight />
            </Button>
            <Badge variant="invert" radius="full" className="tabular-nums">
              {formatStat(total)}
            </Badge>
          </div>
        </FrameHeader>
        <div className="w-full">
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="xMidYMid meet"
            className="block h-auto w-full"
            role="img"
            aria-label="Hourly email distribution chart"
          >
            <defs>
              <linearGradient id="stats-area" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--info)"
                  stopOpacity="0.36"
                />
                <stop
                  offset="62%"
                  stopColor="var(--success)"
                  stopOpacity="0.12"
                />
                <stop
                  offset="100%"
                  stopColor="var(--success)"
                  stopOpacity="0.02"
                />
              </linearGradient>
              <linearGradient id="stats-line" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--info)" />
                <stop offset="55%" stopColor="var(--success)" />
                <stop offset="100%" stopColor="var(--warning)" />
              </linearGradient>
            </defs>
            {GRID_FRACTIONS.map((f) => {
              const y = rnd(PLOT_BOTTOM - f * (PLOT_BOTTOM - PLOT_TOP));
              return (
                <g key={f}>
                  <line
                    x1={GRID_LEFT}
                    x2={GRID_RIGHT}
                    y1={y}
                    y2={y}
                    strokeWidth={1}
                    className="stroke-border"
                  />
                  <text
                    x={Y_LABEL_X}
                    y={y}
                    dy="4"
                    textAnchor="end"
                    fontSize={12}
                    fontWeight={700}
                    className="fill-muted-foreground"
                  >
                    {formatStat(Math.round(max * f))}
                  </text>
                </g>
              );
            })}
            {areaPath !== "" && <path d={areaPath} fill="url(#stats-area)" />}
            {linePath !== "" && (
              <path
                d={linePath}
                fill="none"
                stroke="url(#stats-line)"
                strokeWidth={4}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {points.map((p, i) => (
              <circle
                key={hourly[i].label + String(i)}
                cx={rnd(p.x)}
                cy={rnd(p.y)}
                r={4}
                strokeWidth={3}
                className="fill-card stroke-primary"
              >
                <title>{`${hourly[i].label}: ${formatStat(hourly[i].value)}`}</title>
              </circle>
            ))}
          </svg>
          <div
            className="grid h-[18px] gap-1"
            style={{
              gridTemplateColumns: `repeat(${hourly.length}, minmax(0, 1fr))`,
              paddingLeft: "8.606%",
              paddingRight: "2.498%",
            }}
          >
            {hourly.map((p, i) => (
              <div key={p.label + String(i)}>
                {i % 3 === 0 && (
                  <span className="hidden whitespace-nowrap text-xs leading-[18px] text-muted-foreground min-[1100px]:inline">
                    {p.label}
                  </span>
                )}
                {i % 6 === 0 && (
                  <span className="inline whitespace-nowrap text-xs leading-[18px] text-muted-foreground min-[1100px]:hidden">
                    {p.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </FramePanel>
    </Frame>
  );
}
