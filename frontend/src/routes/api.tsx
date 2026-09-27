import { createFileRoute } from "@tanstack/react-router";
import { ApiContent } from "@/components/api/ApiContent";
import { PageBackdrop } from "@/components/page-backdrop";
import { useDocumentTitle } from "@/hooks/use-document-title";

export const Route = createFileRoute("/api")({
  component: ApiPage,
});

function ApiPage() {
  useDocumentTitle("API Documentation");
  return (
    <div className="relative">
      <PageBackdrop />
      <div className="relative mx-auto flex max-w-[1140px] flex-col gap-8 px-4 py-12">
        <ApiContent />
      </div>
    </div>
  );
}
