import { Globe } from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";
import { Badge } from "@/components/reui/badge";

export function DomainsHero() {
  return (
    <section className="flex flex-col gap-1.5">
      <Badge
        variant="primary-light"
        radius="full"
        className="w-fit uppercase tracking-[0.25px]"
      >
        <Globe />
        Public Domain Status
      </Badge>
      <h1 className="text-[34px] font-bold leading-[44.2px]">
        All {BRAND_NAME} Domains
      </h1>
      <p className="max-w-[780px] text-lg leading-[28.8px] text-muted-foreground">
        Browse every configured domain, check whether it is active, and verify
        its MX health before generating addresses or connecting your own root
        domain.
      </p>
    </section>
  );
}
