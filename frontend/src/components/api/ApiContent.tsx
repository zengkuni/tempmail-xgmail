import { useRef } from "react";
import { BookOpen, Terminal } from "lucide-react";
import { BRAND_DOMAIN, BRAND_NAME } from "@/lib/brand";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BlurFade } from "@/components/ui/blur-fade";
import { ShineBorder } from "@/components/ui/shine-border";
import {
  Alert,
  AlertAction,
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
import { Scrollspy } from "@/components/reui/scrollspy";
import {
  Timeline,
  TimelineContent,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "@/components/reui/timeline";
import {
  CodeBlock,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockLanguage,
  CodeBlockTitle,
} from "@/components/reui/code-block/code-block";
import { CopyMarkdownButton } from "./CopyMarkdownButton";

interface Endpoint {
  methods: string;
  path: string;
  description: string;
}

interface ApiStep {
  title: string;
  note?: string;
  curl: string;
  response: string;
}

const BASE_URL = `https://${BRAND_DOMAIN}`;

const NAV_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "quick-start", label: "Quick Start" },
  { id: "endpoints", label: "Core Endpoints" },
  { id: "example-flow", label: "Example Flow" },
  { id: "response-shape", label: "Response Shape" },
  { id: "extended-stats", label: "Extended Statistics" },
] as const;

const METHOD_VARIANTS: Record<
  string,
  "success-light" | "info-light" | "destructive-light"
> = {
  GET: "success-light",
  POST: "info-light",
  DELETE: "destructive-light",
};

const ENDPOINTS: Endpoint[] = [
  {
    methods: "POST / GET",
    path: "/api/generate-email",
    description:
      "Generate a temporary inbox. Use GET for the simplest random inbox flow, or POST with prefix and domain when you want explicit control. The response includes full_name, a ready-to-use identity name matching the address.",
  },
  {
    methods: "GET",
    path: "/api/emails?email=...",
    description: "Fetch emails for a mailbox.",
  },
  {
    methods: "GET",
    path: "/api/email/{id}",
    description:
      "Fetch a single email, including text, HTML, raw headers, and metadata.",
  },
  {
    methods: "DELETE",
    path: "/api/email/{id}",
    description: "Delete one email by ID.",
  },
  {
    methods: "DELETE",
    path: "/api/emails/clear?email=...",
    description: "Delete all emails in a mailbox.",
  },
  {
    methods: "GET",
    path: "/api/stats",
    description: "Read site-wide statistics.",
  },
];

const STEPS: ApiStep[] = [
  {
    title: "Generate a random temporary email address",
    curl: `curl '${BASE_URL}/api/generate-email' \\
  -H 'X-API-Key: PUBLIC_API_KEY'`,
    response: `{
  "success": true,
  "data": {
    "email": "ajuicas9@raeuu.com",
    "full_name": "Ajudin Icklas",
    "created_at": "2026-08-31T10:24:11.000Z"
  }
}`,
  },
  {
    title: "Generate with a fixed prefix and optional domain (random if omitted)",
    note: 'Two modes: include "domain" to pin the address to that specific domain, e.g. {"prefix":"demo","domain":"yopmail.com"} returns demo@yopmail.com. Omit "domain" (or send no body) and the address lands on a random domain from the supported list.',
    curl: `curl -X POST '${BASE_URL}/api/generate-email' \\
  -H 'Content-Type: application/json' \\
  -H 'X-API-Key: PUBLIC_API_KEY' \\
  -d '{"prefix":"demo","domain":"yopmail.com"}'`,
    response: `{
  "success": true,
  "data": {
    "email": "demo@yopmail.com",
    "full_name": "Budi Santoso",
    "created_at": "2026-08-31T10:24:19.000Z"
  }
}`,
  },
  {
    title: "List emails in an inbox",
    note: "If you already know a supported domain, skip step 1 and query directly.",
    curl: `curl '${BASE_URL}/api/emails?email=demo@example.com' \\
  -H 'X-API-Key: PUBLIC_API_KEY'`,
    response: `{
  "success": true,
  "data": {
    "email": "demo@example.com",
    "count": 1,
    "emails": [
      {
        "id": "01J8ZKX3M4WQ0B7T2N6R9H5VCD",
        "from": "noreply@example-service.com",
        "subject": "Your verification code",
        "received_at": "2026-08-31T10:25:02.000Z"
      }
    ]
  }
}`,
  },
  {
    title: "Read a single email with plain text, HTML body, and metadata",
    note: "Replace EMAIL_ID with an id returned from step 3.",
    curl: `curl '${BASE_URL}/api/email/EMAIL_ID' \\
  -H 'X-API-Key: PUBLIC_API_KEY'`,
    response: `{
  "success": true,
  "data": {
    "id": "01J8ZKX3M4WQ0B7T2N6R9H5VCD",
    "from": "noreply@example-service.com",
    "to": "demo@example.com",
    "subject": "Your verification code",
    "received_at": "2026-08-31T10:25:02.000Z",
    "text": "Your verification code is 483920. It expires in 10 minutes.",
    "html": "<p>Your verification code is <strong>483920</strong>.</p>",
    "headers": {
      "message-id": "<20260831102501.abc123@example-service.com>"
    }
  }
}`,
  },
  {
    title: "Delete a single email by ID",
    curl: `curl -X DELETE '${BASE_URL}/api/email/EMAIL_ID' \\
  -H 'X-API-Key: PUBLIC_API_KEY'`,
    response: `{
  "success": true,
  "data": {
    "deleted": true,
    "id": "01J8ZKX3M4WQ0B7T2N6R9H5VCD"
  }
}`,
  },
  {
    title: "Clear an entire inbox for an address",
    curl: `curl -X DELETE '${BASE_URL}/api/emails/clear?email=demo@example.com' \\
  -H 'X-API-Key: PUBLIC_API_KEY'`,
    response: `{
  "success": true,
  "data": {
    "cleared": true,
    "email": "demo@example.com",
    "deleted_count": 3
  }
}`,
  },
];

const RESPONSE_SHAPE = `{
  "success": true,
  "data": {
    "email": "demo@example.com"
  }
}`;

const EXTENDED_STATS: { path: string; text: string }[] = [
  {
    path: "/api/statistics/24h",
    text: "Returns one 24-hour hourly distribution window; use offset=1,2,... for older windows.",
  },
  { path: "/api/statistics/top-subjects", text: "Returns top email subjects." },
  {
    path: "/api/statistics/top-domains",
    text: "Returns the most active domains.",
  },
  {
    path: "/api/statistics/top-senders",
    text: "Returns the most active senders.",
  },
];

function Chip({ children }: { children: string }) {
  return (
    <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
      {children}
    </code>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <BlurFade inView offset={8} duration={0.45}>
      <Frame id={id} className="scroll-mt-[124px] lg:scroll-mt-20">
        <FramePanel>
          <FrameHeader className="mb-4 border-b border-border">
            <FrameTitle className="text-lg font-bold">{title}</FrameTitle>
          </FrameHeader>
          <div className="flex flex-col gap-5">{children}</div>
        </FramePanel>
      </Frame>
    </BlurFade>
  );
}

export function ApiContent() {
  const scrollTargetRef = useRef<Document>(document);

  return (
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
          {NAV_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              data-scrollspy-anchor={section.id}
              className="-ml-px border-l-2 border-transparent py-[7px] pl-4 pr-3 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground data-[active=true]:border-primary data-[active=true]:font-medium data-[active=true]:text-foreground"
            >
              {section.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="sticky top-14 z-40 -mx-4 border-b border-border bg-background/85 px-4 py-2.5 backdrop-blur lg:hidden">
        <nav
          aria-label="On this page"
          className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {NAV_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              data-scrollspy-anchor={section.id}
              data-scrollspy-offset={124}
              className="shrink-0 rounded-full border border-transparent px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:border-primary/20 data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
            >
              {section.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-8">
        <BlurFade offset={10} duration={0.5}>
          <section
            id="overview"
            className="flex scroll-mt-[124px] flex-col gap-1.5 lg:scroll-mt-20"
          >
            <Badge
              variant="primary-light"
              radius="full"
              className="w-fit uppercase tracking-[0.25px]"
            >
              <Terminal />
              API Documentation
            </Badge>
            <h1 className="text-[34px] font-bold leading-[44.2px]">
              {BRAND_NAME} API
            </h1>
            <p className="max-w-[65ch] text-lg leading-[28.8px] text-muted-foreground">
              We provide a public API for global developers to generate temporary
              emails, read emails, delete emails, and more. The API supports
              HTTPS, token authentication, and rate limiting, making it suitable
              for automated testing, CI/CD, crawler debugging, and other
              scenarios.
            </p>
            <Alert variant="info" className="relative mt-6 overflow-hidden">
              <ShineBorder shineColor="var(--primary)" duration={10} />
              <BookOpen />
              <AlertTitle>Copy-ready API reference</AlertTitle>
              <AlertDescription>
                Everything on this page compiles into one Markdown document for
                AI tools, knowledge bases, or a README. Base URL:{" "}
                <Chip>{BASE_URL}</Chip>
              </AlertDescription>
              <AlertAction>
                <CopyMarkdownButton />
              </AlertAction>
            </Alert>
          </section>
        </BlurFade>

        <Section id="quick-start" title="Quick Start">
          <p className="max-w-[65ch] text-base leading-[24.8px] text-muted-foreground">
            <Chip>X-API-Key: YOUR_KEY</Chip> is the simplest option. For quick
            testing you can start with the public key{" "}
            <Chip>PUBLIC_API_KEY</Chip>.
          </p>
          <p className="max-w-[65ch] text-base leading-[24.8px] text-muted-foreground">
            Most mailbox endpoints require an email parameter, for example{" "}
            <Chip>?email=demo@example.com</Chip>.
          </p>
          <p className="max-w-[65ch] text-base leading-[24.8px] text-muted-foreground">
            All endpoints return JSON with the common <Chip>success</Chip>,{" "}
            <Chip>data</Chip>, and <Chip>error</Chip> fields.
          </p>
          <p className="max-w-[65ch] text-base leading-[24.8px] text-muted-foreground">
            If you already know a currently supported domain on this site, you
            do not have to call the email generation endpoint first. You can
            compose prefix@domain locally and call the mailbox APIs directly,
            which saves one API request.
          </p>
        </Section>

        <Section id="endpoints" title="Core Endpoints">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ENDPOINTS.map((ep, index) => (
              <BlurFade
                key={ep.path + ep.methods}
                inView
                offset={6}
                duration={0.4}
                delay={index * 0.06}
              >
                <div className="flex h-full flex-col gap-2.5 rounded-lg border border-border bg-background p-4 transition-colors hover:border-primary/30">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {ep.methods.split(" / ").map((method) => (
                      <Badge
                        key={method}
                        variant={METHOD_VARIANTS[method] ?? "primary-light"}
                        className="font-mono text-[11px] tracking-wide"
                      >
                        {method}
                      </Badge>
                    ))}
                  </div>
                  <code className="break-all font-mono text-[13px] font-semibold text-foreground">
                    {ep.path}
                  </code>
                  <p className="text-sm leading-[22.4px] text-muted-foreground">
                    {ep.description}
                  </p>
                </div>
              </BlurFade>
            ))}
          </div>
        </Section>

        <Section id="example-flow" title="Example Flow">
          <p className="max-w-[65ch] text-base leading-[24.8px] text-muted-foreground">
            Two common patterns: let the service generate an inbox for you, or
            request a fixed prefix. If you already know a currently supported
            domain, you can also compose the mailbox locally and query it
            directly.
          </p>
          <Timeline defaultValue={STEPS.length}>
            {STEPS.map((step, index) => (
              <TimelineItem key={step.title} step={index + 1}>
                <TimelineHeader>
                  <TimelineTitle className="text-base font-bold leading-[24.8px]">
                    {step.title}
                  </TimelineTitle>
                </TimelineHeader>
                <TimelineIndicator className="bg-[linear-gradient(135deg,var(--brand-grad-1),var(--brand-grad-3))] shadow-[0_0_10px_2px_color-mix(in_oklab,var(--primary)_30%,transparent)]" />
                <TimelineSeparator className="bg-[linear-gradient(180deg,var(--brand-grad-1),var(--brand-grad-2)_50%,var(--brand-grad-3))]! opacity-80" />
                <TimelineContent className="mt-2 flex flex-col gap-3">
                  {step.note ? (
                    <p className="text-sm leading-[22.4px] break-words text-muted-foreground">
                      {step.note}
                    </p>
                  ) : null}
                  <CodeBlock code={step.curl} language="bash">
                    <CodeBlockHeader>
                      <CodeBlockTitle>Terminal</CodeBlockTitle>
                      <CodeBlockLanguage />
                      <CodeBlockCopyButton className="ml-auto" />
                    </CodeBlockHeader>
                  </CodeBlock>
                  <Accordion>
                    <AccordionItem
                      value={`response-${index}`}
                      className="border-b-0"
                    >
                      <AccordionTrigger className="text-sm font-semibold">
                        Response example
                      </AccordionTrigger>
                      <AccordionContent>
                        <CodeBlock code={step.response} language="json">
                          <CodeBlockHeader>
                            <CodeBlockTitle>Response</CodeBlockTitle>
                            <CodeBlockLanguage />
                            <CodeBlockCopyButton className="ml-auto" />
                          </CodeBlockHeader>
                        </CodeBlock>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        </Section>

        <Section id="response-shape" title="Response Shape">
          <p className="max-w-[65ch] text-base leading-[24.8px] text-muted-foreground">
            Successful responses typically look like this.
          </p>
          <CodeBlock code={RESPONSE_SHAPE} language="json">
            <CodeBlockHeader>
              <CodeBlockTitle>Success response</CodeBlockTitle>
              <CodeBlockLanguage />
              <CodeBlockCopyButton className="ml-auto" />
            </CodeBlockHeader>
          </CodeBlock>
        </Section>

        <Section id="extended-stats" title="Extended Statistics">
          <ul className="flex flex-col divide-y divide-border">
            {EXTENDED_STATS.map((item) => (
              <li
                key={item.path}
                className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0"
              >
                <code className="w-fit font-mono text-[13px] font-semibold text-foreground">
                  {item.path}
                </code>
                <p className="text-sm leading-[22.4px] text-muted-foreground">
                  {item.text}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </Scrollspy>
  );
}
