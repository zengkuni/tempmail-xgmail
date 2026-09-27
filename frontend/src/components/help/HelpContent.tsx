import { useRef, useState } from "react";
import {
  Code2,
  Globe,
  Inbox,
  Lock,
  Mail,
  OctagonAlert,
  Send,
  ShieldAlert,
  ShieldCheck,
  Rocket,
  TriangleAlert,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { BRAND_DOMAIN, BRAND_NAME } from "@/lib/brand";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/reui/alert";
import { Badge } from "@/components/reui/badge";
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { IconTile } from "@/components/reui/icon-tile";
import { Scrollspy } from "@/components/reui/scrollspy";
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@/components/reui/stepper";
import { BlurFade } from "@/components/ui/blur-fade";

interface HelpStep {
  title: string;
  body: string;
}

interface HelpAlert {
  variant: "warning" | "destructive";
  icon: LucideIcon;
  title: string;
  description: string;
}

interface HelpSection {
  id: string;
  title: string;
  navLabel: string;
  paragraphs: string[];
  list?: string[];
  listFirst?: boolean;
  alert?: HelpAlert;
}

const STEPS: HelpStep[] = [
  {
    title: "Create an address",
    body: "Use the generated address, select another domain, or save a custom prefix when you need a predictable inbox.",
  },
  {
    title: "Receive messages",
    body: "Incoming mail appears in the inbox automatically. You can also refresh manually if a sender is delayed.",
  },
  {
    title: "Read and manage",
    body: "Open a message to view sender, subject, HTML or text content, then delete individual messages or clear the inbox.",
  },
  {
    title: "Connect workflows",
    body: "Use custom domains, Telegram monitoring, or the API when you need more control than a one-off inbox.",
  },
];

const INTRO_PARAGRAPHS: string[] = [
  `${BRAND_NAME} provides temporary inboxes for testing sign-ups, receiving verification codes, protecting your primary address, and building automated email workflows. You can use the public domains immediately without creating an account.`,
  "Anyone who knows the full public email address may be able to open that inbox, so do not use public temporary addresses for banking, identity documents, account recovery, private conversations, or other sensitive information.",
];

const INTRO_SECTION: HelpSection = {
  id: "getting-started",
  title: "Getting Started",
  navLabel: "Getting Started",
  paragraphs: [INTRO_PARAGRAPHS[0]],
  alert: {
    variant: "warning",
    icon: TriangleAlert,
    title: "Public inboxes are address-based",
    description: INTRO_PARAGRAPHS[1],
  },
};

const SECTIONS: HelpSection[] = [
  {
    id: "section-1",
    title: "1. Creating and choosing an inbox",
    navLabel: "Creating an inbox",
    paragraphs: [
      `When the site opens, ${BRAND_NAME} assigns a temporary email address automatically. You can generate a new random prefix, edit the prefix manually, or choose a different public domain from the domain selector.`,
      "Custom prefixes are useful when a website requires a stable address. After editing the prefix, confirm it with the check button in the input; the random generation button remains available for creating a fresh address.",
      `Quick access: open https://${BRAND_DOMAIN}/user@domain.com to go directly to a specific inbox.`,
    ],
  },
  {
    id: "section-2",
    title: "2. Receiving and managing messages",
    navLabel: "Managing messages",
    paragraphs: [
      "Most messages arrive within seconds, but external sender queues, greylisting, DNS propagation, and provider throttling can cause delays.",
    ],
    list: [
      "Copy the current address from the address area or the inbox toolbar.",
      "Copy an inbox link when you need to reopen the same address later.",
      "Refresh manually if the sender says the email was sent but it has not appeared yet.",
      "Delete a single message from the message view when it is no longer needed.",
      "Clear the inbox when you want to remove all messages for the current address.",
    ],
    listFirst: true,
  },
  {
    id: "section-3",
    title: "3. Reading email content safely",
    navLabel: "Reading safely",
    paragraphs: [
      `Click a message to open the reader. ${BRAND_NAME} displays the sender, recipient, subject, received time, and the available HTML or plain-text body. Remote images and tracking elements may be limited or sanitized by the rendering layer, but you should still avoid clicking suspicious links or downloading unexpected files.`,
      "If the same inbox is opened on multiple devices, each device reads the same temporary mailbox state. Deleted messages are removed for that inbox, not only for the current browser.",
    ],
  },
  {
    id: "section-4",
    title: "4. Public custom domains",
    navLabel: "Public domains",
    paragraphs: [
      `You can add your own root domain to ${BRAND_NAME} when you want temporary addresses under a domain you control. Point the domain MX record to the public MX target shown on the page, then submit the root domain for verification.`,
      `Self-service public domain requests are intended for root domains, not arbitrary subdomains. After the MX record is verified, ${BRAND_NAME} can issue an API key for that domain and make the domain available for public temporary inboxes. If later checks show that the MX record no longer points to the required target, the domain may be disabled automatically.`,
    ],
  },
  {
    id: "section-5",
    title: "5. Private inbox domains",
    navLabel: "Private domains",
    paragraphs: [
      "Private domains are designed for personal or team-only inboxes. They use a dedicated private MX target and can require a password before messages are visible. This is different from a public catch-all domain, where anyone who knows an address can check that public inbox.",
      `Keep the private domain password secure. ${BRAND_NAME} cannot make a public inbox private retroactively if the address has already been shared widely.`,
    ],
  },
  {
    id: "section-6",
    title: "6. Telegram email monitoring",
    navLabel: "Telegram monitoring",
    paragraphs: [
      "Telegram monitoring can send new-email alerts for the current inbox. The alert may include sender, subject, and a short preview so you can react without keeping the web page open.",
      "For private inboxes, the private password may be required before monitoring can start. You can remove the monitor later from Telegram or by changing the inbox/domain configuration.",
    ],
  },
  {
    id: "section-7",
    title: "7. Developer API",
    navLabel: "Developer API",
    paragraphs: [
      "The API lets developers generate inbox addresses, fetch message lists, read message details, and integrate temporary email into tests or automation. Use API keys for production workflows and respect the published rate limits.",
      "The public testing key is only for lightweight evaluation. For reliable automation, create or request a dedicated key and handle rate-limit, empty-inbox, and delayed-delivery responses in your client.",
    ],
  },
  {
    id: "section-8",
    title: "8. Privacy, retention, and security",
    navLabel: "Privacy & retention",
    paragraphs: [
      `Temporary email is convenient, but it should not be treated as secure long-term storage. ${BRAND_NAME} stores message indexes and bodies for the configured retention period, then scheduled cleanup removes expired data.`,
    ],
    alert: {
      variant: "destructive",
      icon: OctagonAlert,
      title: "Not for sensitive data",
      description:
        "Do not receive passwords, recovery links, payment records, government documents, medical data, or confidential business information in a public temporary inbox. For sensitive workflows, use a private mailbox that you control.",
    },
  },
  {
    id: "section-9",
    title: "9. Troubleshooting",
    navLabel: "Troubleshooting",
    paragraphs: [],
    list: [
      "If no email arrives, confirm the address spelling and wait a few minutes for the sender retry queue.",
      "If a custom domain does not validate, check that the MX record points to the exact required target and that DNS propagation has completed.",
      "If a public domain becomes disabled, its MX record likely failed repeated checks or no longer points to the configured target.",
      "If the inbox count or domain list looks stale, refresh the page; public pages and API summaries may use short cache windows for speed.",
      "If an API call fails, verify the key, quota, base URL, and whether the endpoint requires a domain-specific key.",
    ],
    listFirst: true,
  },
];

const SECTION_META: Record<string, { icon: LucideIcon; tone: string }> = {
  "getting-started": { icon: Rocket, tone: "text-primary" },
  "section-1": { icon: Mail, tone: "text-info" },
  "section-2": { icon: Inbox, tone: "text-success" },
  "section-3": { icon: ShieldAlert, tone: "text-warning" },
  "section-4": { icon: Globe, tone: "text-primary" },
  "section-5": { icon: Lock, tone: "text-info" },
  "section-6": { icon: Send, tone: "text-success" },
  "section-7": { icon: Code2, tone: "text-primary" },
  "section-8": { icon: ShieldCheck, tone: "text-destructive" },
  "section-9": { icon: Wrench, tone: "text-warning" },
};

const NAV_ITEMS = [INTRO_SECTION, ...SECTIONS].map((s) => ({
  id: s.id,
  label: s.navLabel,
}));

function HelpHero() {
  return (
    <section className="flex flex-col gap-1.5">
      <Badge
        variant="primary-light"
        radius="full"
        className="w-fit uppercase tracking-[0.25px]"
      >
        Help
      </Badge>
      <h1 className="text-[34px] font-bold leading-[44.2px]">
        Help &amp; Documentation
      </h1>
      <p className="max-w-[780px] text-lg leading-[28.8px] text-muted-foreground">
        Practical guidance for inboxes, custom domains, private addresses,
        Telegram monitoring, and the developer API.
      </p>
    </section>
  );
}

function HelpSteps() {
  const [step, setStep] = useState(1);

  return (
    <Frame>
      <FramePanel>
        <FrameHeader className="mb-4 border-b border-border">
          <FrameTitle className="text-lg font-bold">How it works</FrameTitle>
        </FrameHeader>
        <Stepper
          value={step}
          onValueChange={setStep}
          className="flex flex-col gap-6"
        >
          <StepperNav>
            {STEPS.map((item, index) => (
              <StepperItem key={item.title} step={index + 1}>
                <StepperTrigger className="flex flex-col items-start gap-2 text-left sm:flex-row sm:items-center">
                  <StepperIndicator>{index + 1}</StepperIndicator>
                  <div className="hidden flex-col md:flex">
                    <StepperTitle>{item.title}</StepperTitle>
                  </div>
                </StepperTrigger>
                {index < STEPS.length - 1 && (
                  <StepperSeparator className="hidden sm:block" />
                )}
              </StepperItem>
            ))}
          </StepperNav>
          <StepperPanel>
            {STEPS.map((item, index) => (
              <StepperContent key={item.title} value={index + 1}>
                <div className="flex flex-col gap-2">
                  <p className="text-base font-extrabold leading-[24.8px] md:hidden">
                    {item.title}
                  </p>
                  <p className="text-base leading-[24.8px] text-muted-foreground break-words">
                    {item.body}
                  </p>
                </div>
              </StepperContent>
            ))}
          </StepperPanel>
        </Stepper>
      </FramePanel>
    </Frame>
  );
}

function HelpSection({
  id,
  title,
  paragraphs,
  list,
  listFirst,
  alert,
}: HelpSection) {
  const meta = SECTION_META[id];
  const SectionIcon = meta?.icon;

  const listBlock = list ? (
    <ul className="list-disc space-y-2.5 pl-5 text-base leading-[24.8px] break-words">
      {list.map((item) => (
        <li key={item.slice(0, 24)}>{item}</li>
      ))}
    </ul>
  ) : null;

  const alertBlock = alert ? (
    <Alert variant={alert.variant}>
      <alert.icon />
      <AlertTitle>{alert.title}</AlertTitle>
      <AlertDescription className="text-muted-foreground">
        {alert.description}
      </AlertDescription>
    </Alert>
  ) : null;

  return (
    <BlurFade inView offset={8} duration={0.45}>
      <Frame id={id} className="scroll-mt-[124px] lg:scroll-mt-20">
        <FramePanel>
          <FrameHeader className="mb-4 border-b border-border">
            <div className="flex items-center gap-3">
              {SectionIcon && (
                <IconTile variant="soft" size="sm" className={meta.tone}>
                  <SectionIcon />
                </IconTile>
              )}
              <FrameTitle className="text-lg font-bold">{title}</FrameTitle>
            </div>
          </FrameHeader>
          <div className="flex flex-col gap-5">
            {listFirst && listBlock}
            {paragraphs.map((p) => (
              <p key={p.slice(0, 24)} className="text-base leading-[28.8px] break-words">
                {p}
              </p>
            ))}
            {!listFirst && listBlock}
            {alertBlock}
          </div>
        </FramePanel>
      </Frame>
    </BlurFade>
  );
}

export function HelpContent() {
  const scrollTargetRef = useRef<Document>(document);

  return (
    <div className="flex flex-col gap-8">
      <BlurFade offset={10} duration={0.5}>
        <HelpHero />
      </BlurFade>
      <BlurFade offset={10} duration={0.5} delay={0.08}>
        <HelpSteps />
      </BlurFade>
      <Scrollspy
        targetRef={scrollTargetRef}
        offset={74}
        history={false}
        className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10"
      >
        <nav
          aria-label="On this page"
          className="hidden w-[228px] shrink-0 flex-col gap-4 lg:sticky lg:top-20 lg:flex"
        >
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            On this page
          </p>
          <div className="flex flex-col border-l border-border">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                data-scrollspy-anchor={item.id}
                className="-ml-px border-l-2 border-transparent py-[7px] pl-4 pr-3 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground data-[active=true]:border-primary data-[active=true]:font-medium data-[active=true]:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        <div className="sticky top-14 z-40 -mx-4 border-b border-border bg-background/85 px-4 py-2.5 backdrop-blur lg:hidden">
          <nav
            aria-label="On this page"
            className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                data-scrollspy-anchor={item.id}
                data-scrollspy-offset={124}
                className="shrink-0 rounded-full border border-transparent px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:border-primary/20 data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <HelpSection {...INTRO_SECTION} />
          {SECTIONS.map((section) => (
            <HelpSection key={section.id} {...section} />
          ))}
        </div>
      </Scrollspy>
    </div>
  );
}
