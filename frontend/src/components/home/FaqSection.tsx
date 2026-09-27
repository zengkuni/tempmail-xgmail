import { BRAND_NAME } from "@/lib/brand";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type FaqItem = {
  question: string;
  answer: string;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What is a temporary email?",
    answer:
      "A temporary email, also known as disposable email or throwaway mail, is a high-security email address designed to protect your primary inbox from spam, phishing, and data leaks. It allows you to receive verification codes and sign up for services anonymously without revealing your real identity.",
  },
  {
    question: "How long do emails last?",
    answer:
      "To ensure maximum privacy, our system enforces a strict data retention policy. All received emails are securely stored for exactly 24 hours before being permanently and irreversibly deleted from our servers. Cleanup is automatic.",
  },
  {
    question: "Can I use my own domain?",
    answer: `Absolutely! ${BRAND_NAME} offers advanced custom domain support. Simply configure your domain's MX records to point to our secure servers, and you can instantly generate unlimited disposable email addresses using your own branded domain name.`,
  },
  {
    question: "Is it free?",
    answer: `Yes, ${BRAND_NAME} is a 100% free temporary email service committed to internet privacy. We provide unlimited email generation and receiving capabilities at no cost, supported by non-intrusive advertising.`,
  },
  {
    question: "Common Use Cases?",
    answer:
      "Perfect for QA software testing, verifying social media accounts (Twitter, Facebook, Instagram), signing up for temporary services, and protecting your primary inbox from spam lists. Developers can also use our API for automated testing workflows.",
  },
  {
    question: "What is a temporary email generator?",
    answer: `A temporary email generator creates a short-lived inbox you can use without exposing your primary address. ${BRAND_NAME} creates the address immediately and keeps received messages for 24 hours.`,
  },
  {
    question: "Can a temp email receive verification codes?",
    answer:
      "Often, yes. Delivery depends on whether the sender accepts the selected domain. Use a public temporary inbox only for low-risk verification and testing, never for banking, purchases, or account recovery.",
  },
  {
    question: `Is ${BRAND_NAME} affiliated with any AI company?`,
    answer: `No. ${BRAND_NAME} is an independent, free temporary email service. It provides disposable inboxes for low-risk verification and software testing; it is not an AI product and is not affiliated with any AI company or chatbot.`,
  },
];

export function FaqSection() {
  return (
    <section className="mx-auto w-full max-w-[1320px]">
      <div className="flex flex-col gap-5">
        <h2 className="text-[26px] font-bold leading-[35.1px]">
          Frequently Asked Questions
        </h2>
        <Accordion className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {FAQ_ITEMS.map((item, index) => (
            <AccordionItem
              key={item.question}
              value={`faq-${index}`}
              className="rounded-lg border bg-card px-5"
            >
              <AccordionTrigger className="text-base font-extrabold">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-[20.3px] text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
