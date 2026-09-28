import { useEffect, useState } from "react";
import { Check, ChevronDown, Copy, Dices, IdCard, Link as LinkIcon, Loader2, Mail, X } from "lucide-react";
import { useCopyFeedback } from "@/hooks/use-copy-feedback";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Frame,
  FrameHeader,
  FramePanel,
} from "@/components/reui/frame";
import { IconTile } from "@/components/reui/icon-tile";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/reui/badge";
import type { AddressState } from "./types";


function randomPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 12; i += 1) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${out}!`;
}

function RecentChip({
  address,
  onSelect,
  onRemove,
}: {
  address: string;
  onSelect: (address: string) => void;
  onRemove: (address: string) => void;
}) {
  return (
    <span className="inline-flex max-w-full shrink-0 snap-start items-center gap-1 rounded-full border border-primary/25 bg-primary/5 py-1 pl-3 pr-1.5 text-xs">
      <button
        type="button"
        onClick={() => onSelect(address)}
        title={`Use ${address}`}
        className="min-w-0 cursor-pointer truncate text-left font-medium"
      >
        {address}
      </button>
      <button
        type="button"
        onClick={() => onRemove(address)}
        aria-label={`Remove ${address}`}
        className="shrink-0 cursor-pointer rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function IdentityRow({ label, value }: { label: string; value: string }) {
  const { copied, copy } = useCopyFeedback();
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate font-mono text-sm">{value}</div>
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => copy(value)}
        aria-label={`Copy ${label}`}
        className="text-muted-foreground"
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}

const AUTO_DOMAIN = "Auto";

export function AddressCard({ state, domains }: { state: AddressState; domains: string[] }) {
  const addressCopy = useCopyFeedback();
  const linkCopy = useCopyFeedback();
  const [recentsOpen, setRecentsOpen] = useState(true);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [identityPassword, setIdentityPassword] = useState(randomPassword);
  const [domainQuery, setDomainQuery] = useState("");
  const visibleDomains = domains.filter((domain) =>
    domain.toLowerCase().includes(domainQuery.trim().toLowerCase()),
  );

  const prefix = state.address.split("@")[0] ?? "";
  // Typed prefix stays local until the user confirms with Use (or Enter);
  // re-syncs whenever the active address changes (randomize, recents, URL).
  const [prefixInput, setPrefixInput] = useState(prefix);
  useEffect(() => setPrefixInput(prefix), [prefix]);
  // Password follows the address: every new claimed inbox gets a fresh one.
  useEffect(() => setIdentityPassword(randomPassword()), [state.address]);
  const prefixDirty = prefixInput.length > 0 && prefixInput !== prefix;
  const prefixValid = /^[a-z0-9._-]+$/.test(prefixInput);
  const applyPrefix = () => {
    if (prefixDirty && prefixValid) state.usePrefix(prefixInput);
  };

  return (
    <Frame>
      <FramePanel className="flex flex-col gap-4 p-4 min-[576px]:gap-5 min-[576px]:p-5 min-[992px]:p-8">
        <FrameHeader className="flex-row items-start justify-between gap-3 border-b border-border pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <IconTile
              variant="soft"
              size="default"
              className="shrink-0 text-info"
              aria-hidden="true"
            >
              <Mail />
            </IconTile>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-[11px] font-extrabold tracking-[0.08em] text-muted-foreground">
                CURRENT ADDRESS
              </p>
              <h2 className="max-w-full break-all text-[19px] font-bold leading-[23px] min-[576px]:text-[22px] min-[576px]:leading-[26px]">
                {state.address}
              </h2>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => addressCopy.copy(state.address)}
                  aria-label={addressCopy.copied ? "Copied" : "Copy address"}
                  className="size-11 bg-primary/10 text-primary hover:bg-primary/20 active:scale-[0.97] min-[576px]:size-8"
                />
              }
            >
              {addressCopy.copied ? <Check /> : <Copy />}
            </TooltipTrigger>
            <TooltipContent>
              {addressCopy.copied ? "Copied" : "Copy address"}
            </TooltipContent>
          </Tooltip>
        </FrameHeader>

        <div className="flex flex-col gap-4 min-[576px]:flex-row min-[576px]:items-end">
          <div className="w-full min-[576px]:max-w-[calc(50%_-_8px)] min-[576px]:flex-1">
            <Label htmlFor="address-prefix" className="mb-0.5">
              Custom prefix
            </Label>
            <Input
              id="address-prefix"
              value={prefixInput}
              className="h-11 min-[576px]:h-8"
              placeholder="Enter prefix"
              onChange={(event) =>
                setPrefixInput(event.target.value.toLowerCase())
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") applyPrefix();
              }}
            />
          </div>
          <div className="relative w-full min-[576px]:max-w-[calc(50%_-_8px)] min-[576px]:flex-1">
            <Label htmlFor="address-domain" className="mb-0.5">
              Domains
            </Label>
            <Select
              value={state.domain ?? AUTO_DOMAIN}
              onValueChange={(value) =>
                state.setDomain(value === AUTO_DOMAIN ? null : value)
              }
            >
              <SelectTrigger id="address-domain" className="h-11 w-full min-[576px]:h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                side="bottom"
                alignItemWithTrigger={false}
                collisionAvoidance={{
                  side: "none",
                  align: "shift",
                  fallbackAxisSide: "none",
                }}
              >
                <div className="sticky top-0 z-10 bg-popover p-1">
                  <Input
                    value={domainQuery}
                    onChange={(event) => setDomainQuery(event.target.value)}
                    onKeyDown={(event) => event.stopPropagation()}
                    placeholder="Search domain"
                    className="h-8"
                  />
                </div>
                <SelectItem value={AUTO_DOMAIN}>Auto</SelectItem>
                {visibleDomains.map((domain) => (
                  <SelectItem key={domain} value={domain}>
                    {domain}
                  </SelectItem>
                ))}
                {visibleDomains.length === 0 && (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    No domains found
                  </p>
                )}
              </SelectContent>
            </Select>
            {state.domain !== null && (
              <button
                type="button"
                aria-label="Clear domain selection"
                onClick={() => state.setDomain(null)}
                className="absolute right-8 bottom-2 z-10 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 min-[576px]:grid-cols-4">
          <Button onClick={state.randomize} className="h-11 w-full active:scale-[0.97] min-[576px]:h-8" disabled={state.claiming}>
            {state.claiming ? <Loader2 className="animate-spin" /> : <Dices />}
            Random
          </Button>
          <Button
            variant="secondary"
            className="h-11 w-full bg-primary/10 text-primary hover:bg-primary/20 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 active:scale-[0.97] min-[576px]:h-8"
            disabled={!prefixDirty || !prefixValid}
            onClick={applyPrefix}
          >
            <Check />
            Use Email
          </Button>
          <Button
            variant="secondary"
            className="h-11 w-full bg-success/10 text-success hover:bg-success/20 active:scale-[0.97] min-[576px]:h-8"
            onClick={() =>
              linkCopy.copy(`${window.location.origin}/${state.address}`)
            }
          >
            {linkCopy.copied ? <Check /> : <LinkIcon />}
            Link
          </Button>
          <Button
            variant="secondary"
            className="h-11 w-full bg-violet-500/10 text-violet-600 hover:bg-violet-500/20 dark:text-violet-400 active:scale-[0.97] min-[576px]:h-8"
            onClick={() => setIdentityOpen(true)}
          >
            <IdCard />
            Identity
          </Button>
        </div>

        <Collapsible
          open={recentsOpen}
          onOpenChange={setRecentsOpen}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-extrabold tracking-[0.08em] text-muted-foreground">
              RECENT ADDRESSES
            </p>
            <Badge radius="full">{state.recents.length}</Badge>
            <CollapsibleTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="ml-auto text-muted-foreground"
                  aria-label="Toggle recent addresses"
                />
              }
            >
              <ChevronDown
                className={cn("transition-transform", recentsOpen && "rotate-180")}
              />
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div
              role="region"
              aria-label="Recent addresses"
              className="flex snap-x gap-2 overflow-x-auto pb-0.5 min-[576px]:flex-wrap min-[576px]:overflow-visible"
            >
              {state.recents.map((address) => (
                <RecentChip
                  key={address}
                  address={address}
                  onSelect={state.setAddress}
                  onRemove={state.removeRecent}
                />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </FramePanel>

      <Dialog open={identityOpen} onOpenChange={setIdentityOpen}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Identity</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <IdentityRow label="Full Name" value={state.fullName || "—"} />
            <IdentityRow label="Username" value={prefix} />
            <IdentityRow label="Password" value={identityPassword} />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={state.randomize}>
              Generate New
            </Button>
            <Button variant="outline" onClick={() => setIdentityOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Frame>
  );
}
