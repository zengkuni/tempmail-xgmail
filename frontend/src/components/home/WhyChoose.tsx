import { Globe, Key, ShieldLock, Terminal, Zap } from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";
import { Card, CardContent } from "@/components/ui/card";
import { IconTile } from "@/components/reui/icon-tile";
import type { LucideIcon } from "lucide-react";

type Feature = {
  icon: LucideIcon;
  title: string;
  body: string;
  tint: string;
};

const FEATURES: Feature[] = [
  {
    icon: Globe,
    title: "Massive Domain Pool",
    body: "Access an extensive network of 1558+ premium, constantly updated domains. Unlike other services with blacklisted domains, our massive pool ensures high deliverability and bypasses strict filters.",
    tint: "text-blue-600 dark:text-blue-400",
  },
  {
    icon: ShieldLock,
    title: "Anonymous & Secure",
    body: "Experience true anonymity. No personal information is ever required. Your digital footprint is protected as all emails are securely encrypted and automatically wiped after 24 hours.",
    tint: "text-teal-600 dark:text-teal-400",
  },
  {
    icon: Zap,
    title: "Real-Time Inbox Push",
    body: "Never miss a verification code. New emails are pushed into your inbox the moment they arrive, so codes and action links appear instantly without manual refresh.",
    tint: "text-orange-600 dark:text-orange-400",
  },
  {
    icon: Globe,
    title: "Global Accessibility",
    body: "Optimized for global performance, ensuring lightning-fast access from any location. Whether on mobile or desktop, access your temporary inbox instantly without restrictions.",
    tint: "text-indigo-600 dark:text-indigo-400",
  },
  {
    icon: Key,
    title: "Code & Link Extraction",
    body: `${BRAND_NAME} automatically pulls verification codes and the most likely action link from each email, so you can copy them directly from the inbox list with one click.`,
    tint: "text-violet-600 dark:text-violet-400",
  },
  {
    icon: Terminal,
    title: "Open API Automation",
    body: "Use the public API to generate inboxes, read emails, and integrate temporary mail flows into scripts, CI pipelines, and testing tools.",
    tint: "text-cyan-600 dark:text-cyan-400",
  },
];

export function WhyChoose() {
  return (
    <section className="w-full">
      <div className="flex flex-col gap-5">
        <h2 className="text-[26px] font-bold leading-[35.1px]">
          Why Choose {BRAND_NAME}?
        </h2>
        <div className="grid grid-cols-1 gap-4 min-[576px]:grid-cols-2 min-[992px]:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title}>
                <CardContent className="flex flex-col gap-3 p-5">
                  <IconTile
                    variant="soft"
                    className={feature.tint}
                    aria-hidden="true"
                  >
                    <Icon />
                  </IconTile>
                  <p className="text-lg font-extrabold leading-[28.8px]">
                    {feature.title}
                  </p>
                  <p className="text-sm leading-[20.3px] text-muted-foreground">
                    {feature.body}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
