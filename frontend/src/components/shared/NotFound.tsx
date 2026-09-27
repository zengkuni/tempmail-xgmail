import { Link } from "@tanstack/react-router";
import { Home, MailWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Badge } from "@/components/reui/badge";
import { IconTile } from "@/components/reui/icon-tile";
import { BlurFade } from "@/components/ui/blur-fade";
import { PageBackdrop } from "@/components/page-backdrop";
import { useDocumentTitle } from "@/hooks/use-document-title";

const STATUS_COPY: Record<number, { title: string; message: string }> = {
  404: {
    title: "Page not found",
    message:
      "The page you're looking for doesn't exist or was moved. Like a temp inbox after retention — it's gone.",
  },
  405: {
    title: "Method not allowed",
    message:
      "This endpoint doesn't accept that request method. Try navigating from the homepage instead.",
  },
};

export function NotFound({ status = 404 }: { status?: number }) {
  useDocumentTitle(`${status} — Page Not Found`);
  const copy = STATUS_COPY[status] ?? {
    title: "Something went wrong",
    message: `The server responded with status ${status}.`,
  };

  return (
    <div className="relative">
      <PageBackdrop />
      <div className="relative mx-auto flex max-w-[1320px] items-center justify-center px-4 py-24">
        <BlurFade offset={10} duration={0.5} className="w-full max-w-[480px]">
          <Frame>
            <FramePanel className="flex flex-col items-center gap-5 p-10 text-center">
              <IconTile
                variant="soft"
                size="lg"
                className="text-orange-600 dark:text-orange-400"
                aria-hidden="true"
              >
                <MailWarning />
              </IconTile>
              <FrameHeader className="flex-col items-center gap-2">
                <Badge variant="destructive-light" radius="full">
                  {status}
                </Badge>
                <FrameTitle className="text-2xl font-extrabold">
                  {copy.title}
                </FrameTitle>
              </FrameHeader>
              <p className="max-w-[380px] text-sm leading-6 text-muted-foreground">
                {copy.message}
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <Button render={<Link to="/" />}>
                  <Home />
                  Back to Homepage
                </Button>
              </div>
            </FramePanel>
          </Frame>
        </BlurFade>
      </div>
    </div>
  );
}
