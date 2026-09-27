import { createFileRoute } from "@tanstack/react-router";
import { HelpContent } from "@/components/help/HelpContent";
import { PageBackdrop } from "@/components/page-backdrop";
import { useDocumentTitle } from "@/hooks/use-document-title";

export const Route = createFileRoute("/help")({
  component: HelpPage,
});

function HelpPage() {
  useDocumentTitle("Help");
  return (
    <div className="relative">
      <PageBackdrop />
      <div className="relative mx-auto flex max-w-[1140px] flex-col gap-8 px-4 py-12">
        <HelpContent />
      </div>
    </div>
  );
}
