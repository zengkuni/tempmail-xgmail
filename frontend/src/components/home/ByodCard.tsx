import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Copy, Globe, ListPlus, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { MX_TARGET } from "@/lib/brand";
import { ApiError, registerDomain, verifyDomain } from "@/lib/api";
import { useCopyFeedback } from "@/hooks/use-copy-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert";
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { IconTile } from "@/components/reui/icon-tile";

const STEP_TINTS = [
  "text-blue-600 dark:text-blue-400",
  "text-teal-600 dark:text-teal-400",
] as const;

const STEPS = [
  {
    title: "Point your MX record",
    description: "Set your root domain's MX to the public target above.",
  },
  {
    title: "Submit your domain",
    description: "Add the root domain below; we verify the MX record.",
  },
] as const;

const DOMAIN_RE = /^([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/i;

interface AddOutcome {
  verified: string[];
  pending: string[];
  failed: { domain: string; reason: string }[];
}

// Register, then immediately verify MX. A 409 "already registered" is fine:
// the domain may be pending, so we still verify it (verify upserts/activates).
// The backend sweeper re-checks pending domains every minute and activates
// them once the MX record appears.
async function addDomains(domains: string[]): Promise<AddOutcome> {
  const out: AddOutcome = { verified: [], pending: [], failed: [] };
  for (const domain of domains) {
    try {
      try {
        await registerDomain(domain);
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 409)) throw e;
      }
      const v = await verifyDomain(domain);
      (v.mx_verified ? out.verified : out.pending).push(domain);
    } catch (e) {
      out.failed.push({
        domain,
        reason: e instanceof Error ? e.message : "request failed",
      });
    }
  }
  return out;
}

function reportOutcome(out: AddOutcome) {
  const okCount = out.verified.length + out.pending.length;
  if (okCount > 1) {
    toast.success(`${okCount} domains added`, {
      description: [
        out.verified.length ? `${out.verified.length} active` : null,
        out.pending.length ? `${out.pending.length} pending MX` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }
  if (out.failed.length > 0) {
    toast.error(
      `${out.failed.length} domain${out.failed.length > 1 ? "s" : ""} failed`,
      {
        description: out.failed
          .slice(0, 3)
          .map((f) => `${f.domain}: ${f.reason}`)
          .join(", "),
      },
    );
  }
}

function parseBulk(raw: string) {
  const lines = raw
    .split(/\n+/)
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(lines)];
  const invalid = unique.filter((d) => !DOMAIN_RE.test(d));
  return { unique, invalid };
}

export function ByodCard({
  showDomainsLink = true,
}: {
  showDomainsLink?: boolean;
}) {
  const [rootDomain, setRootDomain] = useState("");
  const [singleError, setSingleError] = useState<string | null>(null);
  const [bulkDomains, setBulkDomains] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { copied, copy } = useCopyFeedback();

  const bulk = parseBulk(bulkDomains);

  const handleAddSingle = async () => {
    const domain = rootDomain.trim().toLowerCase();
    if (!DOMAIN_RE.test(domain)) {
      setSingleError("Enter a valid root domain, e.g. example.com");
      return;
    }
    setSingleError(null);
    setSubmitting(true);
    try {
      const out = await addDomains([domain]);
      if (out.failed.length > 0) {
        toast.error(`Failed to add ${domain}`, {
          description: out.failed[0].reason,
        });
        return;
      }
      setRootDomain("");
      if (out.verified.length > 0) {
        toast.success(`${domain} added and verified`, {
          description: "MX points here. The domain is active.",
        });
      } else {
        toast.info(`${domain} registered`, {
          description: `MX not detected yet. Point it to ${MX_TARGET}; it activates automatically once detected.`,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddBulk = async () => {
    if (bulk.unique.length === 0) {
      toast.error("Enter at least one domain, one per line.");
      return;
    }
    if (bulk.invalid.length > 0) {
      // The live counter under the textarea already flags the bad lines.
      return;
    }
    setSubmitting(true);
    try {
      const out = await addDomains(bulk.unique);
      reportOutcome(out);
      // Keep only the failed lines so they can be retried.
      setBulkDomains(out.failed.map((f) => f.domain).join("\n"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Frame className="h-full">
      <FramePanel className="p-5">
        <FrameHeader className="mb-4 flex-row items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <IconTile
              variant="soft"
              size="sm"
              className="shrink-0 text-teal-600 dark:text-teal-400"
              aria-hidden="true"
            >
              <Globe />
            </IconTile>
            <FrameTitle className="min-w-0 truncate text-xl font-bold">
              Bring Your Own Domain
            </FrameTitle>
          </div>
          {showDomainsLink && (
            <Button
              variant="link"
              className="shrink-0"
              render={<Link to="/domains" />}
            >
              Domains
            </Button>
          )}
        </FrameHeader>

        <div className="flex flex-col gap-4">
          <Alert variant="info">
            <AlertTitle>Public domain MX target</AlertTitle>
            <AlertDescription>
              <div className="flex items-center justify-between gap-2">
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[13px]">
                  {MX_TARGET}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copy(MX_TARGET)}
                  aria-label={copied ? "Copied" : "Copy MX target"}
                  className="h-7 w-7 shrink-0 text-muted-foreground"
                >
                  {copied ? <Check /> : <Copy />}
                </Button>
              </div>
            </AlertDescription>
          </Alert>

          <div className="flex flex-col gap-3">
            <p className="text-sm font-extrabold text-muted-foreground">
              HOW IT WORKS
            </p>
            {STEPS.map((step, index) => (
              <div key={step.title} className="flex items-start gap-3">
                <IconTile
                  variant="soft"
                  size="sm"
                  className={STEP_TINTS[index]}
                  aria-hidden="true"
                >
                  <span className="text-xs font-extrabold">{index + 1}</span>
                </IconTile>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{step.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <Tabs defaultValue="single">
            <TabsList className="grid h-9 w-full grid-cols-2">
              <TabsTrigger value="single" className="gap-1.5">
                <Globe className="size-3.5" aria-hidden="true" />
                Add Domain
              </TabsTrigger>
              <TabsTrigger value="bulk" className="gap-1.5">
                <ListPlus className="size-3.5" aria-hidden="true" />
                Bulk
              </TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="flex flex-col gap-1.5 pt-3">
              <Label htmlFor="byod-root-domain">Root domain</Label>
              <div className="flex">
                <div className="relative min-w-0 flex-1">
                  <Globe
                    className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="byod-root-domain"
                    type="text"
                    placeholder="example.com"
                    autoComplete="off"
                    spellCheck={false}
                    value={rootDomain}
                    onChange={(e) => {
                      setRootDomain(e.target.value);
                      setSingleError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleAddSingle();
                    }}
                    aria-invalid={singleError ? true : undefined}
                    className="h-9 rounded-r-none pl-8 font-mono"
                  />
                </div>
                <Button
                  onClick={() => void handleAddSingle()}
                  disabled={submitting}
                  className="h-9 shrink-0 rounded-l-none"
                >
                  {submitting ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Plus aria-hidden="true" />
                  )}
                  Add
                </Button>
              </div>
              {singleError ? (
                <p className="text-xs text-destructive">{singleError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Use the root domain only; subdomains are not needed.
                </p>
              )}
            </TabsContent>

            <TabsContent value="bulk" className="flex flex-col gap-1.5 pt-3">
              <Label htmlFor="byod-bulk-domains">Domains, one per line</Label>
              <Textarea
                id="byod-bulk-domains"
                rows={5}
                placeholder={"example.com\nexample.org"}
                autoComplete="off"
                spellCheck={false}
                value={bulkDomains}
                onChange={(e) => setBulkDomains(e.target.value)}
                aria-invalid={bulk.invalid.length > 0 ? true : undefined}
                className="min-h-28 font-mono"
              />
              <p className="min-h-4 text-xs text-muted-foreground">
                {bulk.unique.length === 0
                  ? "Paste one domain per line."
                  : `${bulk.unique.length} domain${bulk.unique.length > 1 ? "s" : ""}`}
                {bulk.invalid.length > 0 && (
                  <span className="text-destructive">
                    {` · ${bulk.invalid.length} invalid (${bulk.invalid[0]})`}
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void handleAddBulk()}
                  disabled={submitting || bulk.unique.length === 0 || bulk.invalid.length > 0}
                >
                  {submitting ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <ListPlus aria-hidden="true" />
                  )}
                  Add Domains
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </FramePanel>
    </Frame>
  );
}
