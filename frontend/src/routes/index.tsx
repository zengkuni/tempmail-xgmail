import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AddressCard } from "@/components/home/AddressCard";
import { ArticleSection } from "@/components/home/ArticleSection";
import { ByodCard } from "@/components/home/ByodCard";
import { CompareTable } from "@/components/home/CompareTable";
import { FaqSection } from "@/components/home/FaqSection";
import { Hero } from "@/components/home/Hero";
import { InboxPanel } from "@/components/home/InboxPanel";
import { WhyChoose } from "@/components/home/WhyChoose";
import { listDomains } from "@/lib/api";
import { useAddressState } from "@/hooks/use-address-state";
import { useInbox } from "@/hooks/use-inbox";
import { BlurFade } from "@/components/ui/blur-fade";
import { PageBackdrop } from "@/components/page-backdrop";
import { useDocumentTitle } from "@/hooks/use-document-title";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { address?: string } => ({
    address: typeof search.address === "string" ? search.address : undefined,
  }),
  component: HomePage,
});

function HomePage() {
  useDocumentTitle("Free Temporary Email");
  const { address: requested } = Route.useSearch();
  const addressState = useAddressState(requested);
  const inbox = useInbox(addressState.address);
  const [domains, setDomains] = useState<string[]>([]);
  const navigate = useNavigate({ from: "/" });

  // Keep the URL carrying the active address (?address=...), so a refresh or
  // a shared link reopens the same inbox instead of claiming a new random one.
  // replace: true avoids piling entries into browser history.
  useEffect(() => {
    if (addressState.address && addressState.address !== requested) {
      void navigate({
        search: { address: addressState.address },
        replace: true,
      });
    }
  }, [addressState.address, requested, navigate]);

  useEffect(() => {
    listDomains()
      .then((res) => setDomains(res.domains.map((d) => d.name)))
      .catch(() => {
        setDomains([]);
        toast.error("Failed to load available domains", { id: "public-domains" });
      });
  }, []);

  return (
    <>
      {/* Workspace: mobile = flex column, tool first (address → inbox) then
          marketing; desktop = 2-col grid placing byod left / inbox right */}
      <section className="relative border-b">
        <PageBackdrop />
        <BlurFade offset={10} duration={0.5} className="relative">
    <div className="mx-auto flex max-w-[1320px] flex-col gap-6 px-4 pt-[64px] pb-12 min-[992px]:grid min-[992px]:grid-cols-[505px_727px] min-[992px]:justify-between min-[992px]:gap-x-14 min-[992px]:gap-y-8 min-[992px]:pt-[72px] min-[992px]:pb-16">
            {/* Mobile order: hero (Burner Inbox) first, then the address
                card + inbox stack, then byod. Desktop: the right column is
                one stack (address over inbox, 32px apart) spanning both grid
                rows, so the left column's row heights can no longer wedge a
                gap between the current card and the inbox; the inbox takes
                leftover stack height so the right column stays flush. */}
            <div className="order-2 flex flex-col gap-8 min-[992px]:col-start-2 min-[992px]:row-span-2">
              <AddressCard state={addressState} domains={domains} />
              <div className="min-[992px]:min-h-0 min-[992px]:flex-1">
                <InboxPanel
                  emails={inbox.emails}
                  refreshing={inbox.refreshing}
                  onRefresh={inbox.refresh}
                  onClear={inbox.clear}
                  onOpenEmail={inbox.openEmail}
                  onDeleteEmail={(e) => void inbox.remove(e)}
                />
              </div>
            </div>
            <div className="order-1 min-[992px]:col-start-1 min-[992px]:row-start-1">
              <Hero />
            </div>
            <div className="order-3 min-[992px]:col-start-1 min-[992px]:row-start-2">
              <ByodCard />
            </div>
          </div>
        </BlurFade>
      </section>
      <div className="border-b bg-[linear-gradient(180deg,color-mix(in_oklab,var(--primary)_6%,transparent),color-mix(in_oklab,var(--primary)_3%,transparent))]">
        <div className="mx-auto max-w-[1320px] px-4 py-10 min-[992px]:py-16">
          <BlurFade inView offset={8} duration={0.45}>
            <ArticleSection />
          </BlurFade>
        </div>
      </div>
      <div className="mx-auto max-w-[1320px] px-4 py-10 min-[992px]:py-16">
        <BlurFade inView offset={8} duration={0.45}>
          <WhyChoose />
        </BlurFade>
      </div>
      <div className="border-y bg-[linear-gradient(180deg,color-mix(in_oklab,var(--primary)_6%,transparent),color-mix(in_oklab,var(--primary)_3%,transparent))]">
        <div className="mx-auto max-w-[1320px] px-4 py-10 min-[992px]:py-16">
          <BlurFade inView offset={8} duration={0.45}>
            <CompareTable />
          </BlurFade>
        </div>
      </div>
      <div className="mx-auto max-w-[1320px] px-4 py-10 min-[992px]:py-16">
        <BlurFade inView offset={8} duration={0.45}>
          <FaqSection />
        </BlurFade>
      </div>
    </>
  );
}
