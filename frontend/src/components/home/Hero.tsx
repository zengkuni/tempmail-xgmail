import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion, useReducedMotion } from "motion/react";
import { Clock, Globe, Mail, ShieldCheck } from "lucide-react";
import { cn, formatStat } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/reui/badge";
import { IconTile } from "@/components/reui/icon-tile";
import { getStats } from "@/lib/api";

export function Hero() {
  const reduceMotion = useReducedMotion();
  const [headlineActive, setHeadlineActive] = useState(false);
  const [stats, setStats] = useState({ activeDomains: "…", processed: "…" });

  useEffect(() => {
    getStats()
      .then((s) =>
        setStats({
          activeDomains: formatStat(s.active_domains),
          processed: formatStat(s.total_emails),
        }),
      )
      .catch(() => {
        setStats({ activeDomains: "—", processed: "—" });
        toast.error("Failed to load site stats", { id: "hero-stats" });
      });
  }, []);

  const statCards = [
    {
      icon: Globe,
      value: stats.activeDomains,
      label: "Active Domains",
      tint: "text-blue-600 dark:text-blue-400",
    },
    {
      icon: Mail,
      value: stats.processed,
      label: "Processed",
      tint: "text-teal-600 dark:text-teal-400",
    },
    {
      icon: Clock,
      value: "24h",
      label: "Email Retention Period (hours)",
      tint: "text-orange-600 dark:text-orange-400",
    },
  ];


  return (
    <div className="flex w-full flex-col justify-center gap-8">
      <div className="flex flex-col gap-3">
        <Badge variant="success-light" radius="full" className="uppercase tracking-[0.25px]">
          <ShieldCheck />
          FREE • NO SIGNUP • INSTANT
        </Badge>
        <motion.h1
          className="text-brand-gradient inline-block max-w-[620px] text-[34.4px] font-extrabold leading-[40px] min-[992px]:text-[50.4px] min-[992px]:leading-[54.4px]"
          initial={false}
          animate={
            !reduceMotion && headlineActive
              ? {
                  rotate: [0, -6, 5, -3, 2, 0],
                  y: [0, -4, 0, -2, 0],
                  scale: 1.04,
                }
              : { rotate: 0, y: 0, scale: 1 }
          }
          transition={{ duration: 0.6, ease: "easeInOut" }}
          onHoverStart={() => setHeadlineActive(true)}
          onHoverEnd={() => setHeadlineActive(false)}
        >
          Burner Inbox, On Demand.
        </motion.h1>
        <p className="max-w-[680px] text-xl leading-[33px] text-muted-foreground">
          Generate a disposable address instantly, pick any of{" "}
          {stats.activeDomains} domains, and catch verification codes while
          your real inbox stays private.
        </p>
      </div>
      <div className="grid w-full max-w-[620px] grid-cols-1 gap-3 min-[576px]:grid-cols-3">
        {statCards.map(({ icon: Icon, value, label, tint }) => (
          <Card key={label}>
            <CardContent className="flex min-h-[118px] flex-col gap-1.5 p-3">
              <IconTile variant="soft" size="sm" className={tint} aria-hidden="true">
                <Icon />
              </IconTile>
              <div className={cn("text-base font-extrabold leading-[24.8px]", tint)}>
                {value}
              </div>
              <div className="text-xs leading-[16.8px] text-muted-foreground">
                {label}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
