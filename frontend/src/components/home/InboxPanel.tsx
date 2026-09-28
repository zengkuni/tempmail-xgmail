import { useRef, useState } from "react";
import { Check, Copy, Inbox, MailOpen, RefreshCw, Trash2 } from "lucide-react";
import { useCopyFeedback } from "@/hooks/use-copy-feedback";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Badge } from "@/components/reui/badge";
import { IconTile } from "@/components/reui/icon-tile";
import type { MockEmail } from "./types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface InboxPanelProps {
  emails: MockEmail[];
  refreshing: boolean;
  onRefresh: () => void;
  onClear: () => void;
  // Fetches the full message body (html/preview/code) for a summary row.
  onOpenEmail: (email: MockEmail) => Promise<MockEmail>;
  // Deletes one email by id.
  onDeleteEmail: (email: MockEmail) => void;
}

// Monospace verification-code chip with copy feedback. Rendered as a
// span[role=button] because it nests inside the row <button>.
function CodeChip({ code }: { code: string }) {
  const { copied, copy } = useCopyFeedback();

  return (
    <Badge
      render={
        <span
          role="button"
          tabIndex={0}
          title="Copy code"
          onClick={(event) => {
            event.stopPropagation();
            copy(code);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.stopPropagation();
              event.preventDefault();
              copy(code);
            }
          }}
        />
      }
      variant="primary-light"
      className="cursor-pointer font-mono"
    >
      {code}
      {copied ? <Check /> : <Copy />}
    </Badge>
  );
}

function EmailRow({
  email,
  onOpen,
  onDelete,
}: {
  email: MockEmail;
  onOpen: (email: MockEmail) => void;
  onDelete: (email: MockEmail) => void;
}) {
  // Row content is a <button>; the delete action sits NEXT to it (a button
  // cannot nest inside a button), aligned with the whole row.
  return (
    <div className="flex items-stretch">
      <button
        type="button"
        className="block min-w-0 flex-1 cursor-pointer rounded-l-md px-3 py-3.5 text-left hover:bg-muted active:bg-muted min-[576px]:px-2"
        onClick={() => onOpen(email)}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-bold">
            {email.senderName}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {email.receivedAt}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="min-w-0 truncate text-sm font-semibold">
            {email.subject}
          </span>
          {email.code ? <CodeChip code={email.code} /> : null}
        </div>
        <div className="mt-0.5 truncate text-[13px] text-muted-foreground">
          {email.preview}
        </div>
      </button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Delete email from ${email.senderName}`}
        title="Delete this email"
        className="my-auto mr-1 h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive min-[576px]:h-8 min-[576px]:w-8"
        onClick={() => onDelete(email)}
      >
        <Trash2 />
      </Button>
    </div>
  );
}
// Upgrade insecure subresource URLs so the srcdoc iframe inside an HTTPS page
// does not trigger Mixed Content warnings. Covers src/href attributes, CSS
// url(), and srcset entries. Link text like "http://..." in the visible body
// is left untouched: only attribute contexts are rewritten.
function upgradeInsecureUrls(html: string): string {
  return html
    .replace(/(\s(?:src|href|action|poster|background)\s*=\s*")http:\/\//gi, '$1https://')
    .replace(/(\s(?:src|href|action|poster|background)\s*=\s*')http:\/\//gi, "$1https://")
    .replace(/(url\(\s*["']?)http:\/\//gi, "$1https://")
    .replace(/(srcset\s*=\s*"[^"]*?)http:\/\//gi, "$1https://");
}

// Thin scrollbar injected into the email document so long messages scroll
// with the same modern look as the app (the page's global scrollbar styles
// do not reach inside srcdoc).
const EMAIL_SCROLLBAR_CSS =
  "<style>html{scrollbar-width:thin;scrollbar-color:#c4c4c8 transparent}" +
  "::-webkit-scrollbar{width:8px;height:8px}" +
  "::-webkit-scrollbar-track{background:transparent}" +
  "::-webkit-scrollbar-thumb{background:#c4c4c8;border-radius:9999px}</style>";

// Real email HTML is untrusted markup with its own <style> blocks and inline
// styles, so it renders in a sandboxed iframe (like a mail client) instead of
// being injected into the page. Height auto-fits the message, capped at 55vh
// so the dialog always fits the viewport and long bodies scroll inside.
function EmailHtml({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-same-origin"
      srcDoc={EMAIL_SCROLLBAR_CSS + upgradeInsecureUrls(html)}
      className="w-full rounded-md border border-border bg-white"
      style={{ height: 120 }}
      onLoad={() => {
        const doc = iframeRef.current?.contentDocument;
        if (doc && iframeRef.current) {
          const maxH = Math.round(window.innerHeight * 0.55);
          const height = Math.max(120, Math.min(doc.documentElement.scrollHeight + 16, maxH));
          iframeRef.current.style.height = `${height}px`;
        }
      }}
    />
  );
}
export function InboxPanel({
  emails,
  refreshing,
  onRefresh,
  onClear,
  onOpenEmail,
  onDeleteEmail,
}: InboxPanelProps) {
  const [selected, setSelected] = useState<MockEmail | null>(null);

  return (
    <Frame className="h-full">
      <FramePanel className="p-5">
        <FrameHeader className="mb-4 flex-row flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <IconTile
              variant="soft"
              size="default"
              className="text-violet-600 dark:text-violet-400"
              aria-hidden="true"
            >
              <Inbox />
            </IconTile>
            <FrameTitle className="text-xl font-bold">Inbox</FrameTitle>
            <Badge radius="full">{emails.length}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="destructive"
              size="sm"
              className="h-9 w-full press-scale min-[576px]:h-7"
              onClick={onClear}
            >
              <Trash2 />
              Clear Inbox
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-9 w-full press-scale min-[576px]:h-7"
              onClick={onRefresh}
            >
              <RefreshCw className={refreshing ? "animate-spin" : undefined} />
              Refresh
            </Button>
          </div>
        </FrameHeader>

        {refreshing ? (
          <div className="flex flex-col gap-3 py-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center min-[576px]:p-10">
            <IconTile variant="soft" size="lg" className="text-muted-foreground" aria-hidden="true">
              <MailOpen />
            </IconTile>
            <p className="text-base font-bold text-muted-foreground">
              Your inbox is empty
            </p>
            <p className="text-sm text-muted-foreground">
              Waiting for incoming emails...
            </p>
          </div>
        ) : (
          <ul className="max-h-[355px] overflow-y-auto">
            {emails.map((email) => (
              <li key={email.id} className="border-b last:border-b-0">
                <EmailRow
                  email={email}
                  onOpen={(e) => void onOpenEmail(e).then(setSelected)}
                  onDelete={(e) => {
                    // If the open dialog shows this email, close it first.
                    setSelected((sel) => (sel?.id === e.id ? null : sel));
                    onDeleteEmail(e);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </FramePanel>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-[720px]">
          {selected && (
            <>
              <DialogHeader className="shrink-0 min-w-0 overflow-hidden">
                <div className="flex items-center gap-3">
                  <IconTile
                    variant="soft"
                    size="sm"
                    className="shrink-0 text-primary"
                    aria-hidden="true"
                  >
                    <MailOpen />
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="truncate text-base">
                      {selected.subject}
                    </DialogTitle>
                    <DialogDescription className="truncate">
                      {selected.senderName} &lt;{selected.senderEmail}&gt; ·{" "}
                      {selected.receivedAt}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <EmailHtml html={selected.html} />
              </div>
              <DialogFooter className="shrink-0">
                <Button variant="secondary" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Frame>
  );
}
