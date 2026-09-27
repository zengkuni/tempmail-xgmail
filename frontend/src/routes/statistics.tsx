import { useCallback, useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import { createFileRoute } from "@tanstack/react-router";
import { StatsHero } from "@/components/statistics/StatsHero";
import { StatCards } from "@/components/statistics/StatCards";
import { HourlyChart } from "@/components/statistics/HourlyChart";
import { StatsSummary } from "@/components/statistics/StatsSummary";
import { TopLists } from "@/components/statistics/TopLists";
import type { StatsSnapshot, TopListData } from "@/components/statistics/types";
import {
  BASE_URL,
  getStatistics24h,
  getStats,
  getTopDomains,
  getTopSenders,
  getTopSubjects,
} from "@/lib/api";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { BlurFade } from "@/components/ui/blur-fade";
import { PageBackdrop } from "@/components/page-backdrop";

export const Route = createFileRoute("/statistics")({
  component: StatisticsPage,
});

const EMPTY_STATS: StatsSnapshot = {
  allTime: 0,
  emails24h: 0,
  uniqueSubjects: 0,
  siteDomains: 0,
  hourly: [],
  peakLabel: "—",
  peakValue: 0,
  activeHours: 0,
  avgPerHour: 0,
};

const EMPTY_TOP_LISTS: [TopListData, TopListData, TopListData] = [
  { title: "Top 10 Subjects", rows: [] },
  { title: "Top 10 Domains", rows: [] },
  { title: "Top 10 Senders", rows: [] },
];

function hourLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    hour12: true,
  });
}

async function fetchAll(): Promise<{
  stats: StatsSnapshot;
  topLists: [TopListData, TopListData, TopListData];
}> {
  const [stats, hourly, subjects, domains, senders] = await Promise.all([
    getStats(),
    getStatistics24h(),
    getTopSubjects(),
    getTopDomains(),
    getTopSenders(),
  ]);

  const points = hourly.hours.map((h) => ({
    label: hourLabel(h.hour),
    value: h.count,
  }));
  const peak = points.reduce(
    (best, p) => (p.value > best.value ? p : best),
    { label: "—", value: 0 },
  );
  const activeHours = points.filter((p) => p.value > 0).length;

  return {
    stats: {
      allTime: stats.total_emails,
      emails24h: stats.emails_24h,
      uniqueSubjects: stats.unique_subjects,
      siteDomains: stats.active_domains,
      hourly: points,
      peakLabel: peak.label,
      peakValue: peak.value,
      activeHours,
      avgPerHour: activeHours > 0 ? Math.round(stats.emails_24h / 24) : 0,
    },
    topLists: [
      {
        title: "Top 10 Subjects",
        rows: subjects.items.map((i) => ({ label: i.value, count: i.count })),
      },
      {
        title: "Top 10 Domains",
        rows: domains.items.map((i) => ({ label: i.value, count: i.count })),
      },
      {
        title: "Top 10 Senders",
        rows: senders.items.map((i) => ({ label: i.value, count: i.count })),
      },
    ],
  };
}

function StatisticsPage() {
  useDocumentTitle("Statistics");
  const [stats, setStats] = useState<StatsSnapshot>(EMPTY_STATS);
  const [topLists, setTopLists] =
    useState<[TopListData, TopListData, TopListData]>(EMPTY_TOP_LISTS);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetchAll();
      setStats(res.stats);
      setTopLists(res.topLists);
    } catch {
      // Keep last snapshot; deduped toast (load also fires on socket events).
      toast.error("Failed to load statistics", { id: "stats-load" });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();

    // Live refresh: the hub nudges the "all" room on every new mail (no
    // content, just a refetch signal); debounce bursts into one reload.
    const socket: Socket = io(BASE_URL || undefined, {
      transports: ["websocket", "polling"],
    });
    let timer: number | undefined;
    socket.on("mail:activity", () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => void load(), 1500);
    });
    return () => {
      clearTimeout(timer);
      socket.disconnect();
    };
  }, [load]);

  return (
    <div className="relative">
      <PageBackdrop />
      <div className="relative mx-auto flex max-w-[1320px] flex-col gap-8 px-4 py-12">
      <BlurFade offset={10} duration={0.5}>
        <StatsHero onRefresh={() => void load()} refreshing={refreshing} />
      </BlurFade>
      <BlurFade offset={8} duration={0.45}>
        <StatCards stats={stats} />
      </BlurFade>
      <BlurFade inView offset={8} duration={0.45}>
        <div className="grid grid-cols-1 gap-5 min-[1100px]:grid-cols-[906px_1fr]">
          <HourlyChart hourly={stats.hourly} total={stats.emails24h} />
          <StatsSummary
            total={stats.emails24h}
            peakLabel={stats.peakLabel}
            peakValue={stats.peakValue}
            activeHours={stats.activeHours}
            avgPerHour={stats.avgPerHour}
          />
        </div>
      </BlurFade>
      <BlurFade inView offset={8} duration={0.45}>
        <TopLists lists={topLists} />
      </BlurFade>
      </div>
    </div>
  );
}
