import { Link } from "@tanstack/react-router";
import { Code, Mail, ShieldCheck } from "lucide-react";
import { BRAND_NAME } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/reui/badge";
import { IconTile } from "@/components/reui/icon-tile";

const TINTS = {
  blue: "text-blue-600 dark:text-blue-400",
  teal: "text-teal-600 dark:text-teal-400",
  orange: "text-orange-600 dark:text-orange-400",
} as const;

const FEATURES = [
  {
    title: "Receive verification codes quickly",
    body: "Create an address, use it for a low-risk signup, and watch the inbox for the code or confirmation link. Delivery still depends on the sender accepting the domain.",
    Icon: Mail,
    tint: TINTS.blue,
  },
  {
    title: "Disposable email, not a permanent mailbox",
    body: `${BRAND_NAME} uses its available public and custom domains; it does not create permanent mail accounts. Keep a permanent address for purchases, banking, and account recovery.`,
    Icon: ShieldCheck,
    tint: TINTS.teal,
  },
  {
    title: "Built for QA and automation",
    body: "Developers can create inboxes through the API, read test messages, and automate verification flows without mixing test data into customer accounts.",
    Icon: Code,
    tint: TINTS.orange,
  },
] as const;

const CTAS = [
  { label: "Read the guide", to: "/help", tint: TINTS.blue },
  { label: "View active domains", to: "/domains", tint: TINTS.teal },
  { label: "Explore the API", to: "/api", tint: TINTS.orange },
] as const;

export function ArticleSection() {
  return (
    <section className="w-full">
      <div className="flex flex-col gap-8 py-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <Badge variant="primary-light" radius="full" className="uppercase tracking-[0.25px]">
            Why {BRAND_NAME}
          </Badge>
          <h2 className="max-w-[640px] text-balance text-3xl font-bold leading-[38px] tracking-[-0.4px]">
            {BRAND_NAME}: a practical{" "}
            <span className="text-brand-gradient">temporary email generator</span>
          </h2>
          <p className="max-w-[680px] text-pretty text-base leading-[26px] text-muted-foreground">
            {BRAND_NAME} gives you a disposable inbox for verification codes
            and low-risk signups. Generate an address in one click, receive
            messages for 24 hours, and keep your primary inbox private.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 min-[576px]:grid-cols-2 min-[992px]:grid-cols-3">
          {FEATURES.map(({ title, body, Icon, tint }) => (
            <Card key={title}>
              <CardContent className="flex flex-col gap-3 p-5">
                <IconTile variant="soft" className={tint} aria-hidden="true">
                  <Icon />
                </IconTile>
                <p className="text-lg font-extrabold leading-[28.8px]">
                  {title}
                </p>
                <p className="text-sm leading-[20.3px] text-muted-foreground">
                  {body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 min-[576px]:grid-cols-3">
          {CTAS.map((cta) => (
            <Button
              key={cta.label}
              variant="secondary"
              className={`h-[38px] font-bold transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md ${cta.tint}`}
              render={<Link to={cta.to} />}
            >
              {cta.label}
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}
