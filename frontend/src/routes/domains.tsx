import { useCallback, useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import { createFileRoute } from "@tanstack/react-router";
import { ByodCard } from "@/components/home/ByodCard";
import { DomainsHero } from "@/components/domains/DomainsHero";
import { DomainStats } from "@/components/domains/DomainStats";
import { DomainInventory } from "@/components/domains/DomainInventory";
import type { DomainRow, DomainStats as DomainStatsData } from "@/components/domains/types";
import { BASE_URL, listDomains } from "@/lib/api";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { BlurFade } from "@/components/ui/blur-fade";
import { PageBackdrop } from "@/components/page-backdrop";

export const Route = createFileRoute("/domains")({
  component: DomainsPage,
});

const EMPTY_STATS: DomainStatsData = { total: 0, active: 0, validMx: 0 };

function DomainsPage() {
  useDocumentTitle("Domains");
  const [stats, setStats] = useState<DomainStatsData>(EMPTY_STATS);
  const [rows, setRows] = useState<DomainRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await listDomains(true);
      const list = res.domains;
      setRows(
        list.map((d) => ({
          name: d.name,
          active: d.is_active,
          mxValid: d.is_active ? d.mx_verified : null,
          added: new Date(d.created_at).toLocaleString("en-US"),
          expiresAt: d.registry_expires_at ?? null,
        })),
      );
      setStats({
        total: list.length,
        active: list.filter((d) => d.is_active).length,
        validMx: list.filter((d) => d.is_active && d.mx_verified).length,
      });
    } catch {
      // Keep last snapshot; deduped toast (load also fires on socket events).
      toast.error("Failed to load domains", { id: "domains-load" });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();

    // Live refresh: hub broadcast "domain:updated"/"domain:removed" ke room "all";
    // debounce agar burst event hanya memicu satu refetch (termasuk saat domain
    // dihapus otomatis karena grace MX habis — row hilang tanpa refresh manual).
    const socket: Socket = io(BASE_URL || undefined, {
      transports: ["websocket", "polling"],
    });
    let timer: number | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => void load(), 1500);
    };
    socket.on("domain:updated", schedule);
    socket.on("domain:removed", schedule);
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
        <DomainsHero />
      </BlurFade>
      <BlurFade inView offset={8} duration={0.45}>
        <DomainStats stats={stats} />
      </BlurFade>
      <BlurFade inView offset={8} duration={0.45}>
        <ByodCard showDomainsLink={false} />
      </BlurFade>
      <BlurFade inView offset={8} duration={0.45}>
        <DomainInventory
          rows={rows}
          onRefresh={() => void load()}
          refreshing={refreshing}
        />
      </BlurFade>
      </div>
    </div>
  );
}
