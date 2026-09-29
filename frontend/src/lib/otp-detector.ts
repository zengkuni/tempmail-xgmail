// OTP detector — context-aware, ported from the otp-detector reference
// (github.com/One-Day-Developers/otp-detector, MIT-style reference logic):
// extracts 4–8 digit codes from subject/body/HTML while filtering false
// positives (dates/times, invoice/reference numbers, addresses, footers).
// Zero runtime dependencies.

export interface OtpEmailData {
  subject?: string;
  text?: string;
  html?: string;
}

export interface OtpOptions {
  positiveKeywords?: string[];
  negativeKeywords?: string[];
  neighborhood?: number;
}

// Block-level HTML tags: text nodes inside them get surrounding spaces so
// "code:</strong>123456" does not merge digits into neighbouring words.
const HTML_BLOCK_TAGS: Record<string, true> = {
  p: true, div: true, br: true, tr: true, li: true, h1: true, h2: true,
  h3: true, h4: true, h5: true, h6: true, blockquote: true,
  article: true, section: true, footer: true, header: true,
};

const OTP_REGEX = /\b(\d{4,8}|\d{3,4}[-\s]\d{3,4})\b/g;

function looksLikeDateOrTime(ctx: string): boolean {
  return (
    /\b\d{1,2}[:/\-]\d{1,2}([:/\-]\d{2,4})?\b|\b(am|pm|gmt|utc)\b/i.test(ctx)
  );
}

function buildOptions(opts: OtpOptions): Required<OtpOptions> {
  return {
    positiveKeywords: opts.positiveKeywords ?? [
      "code", "otp", "one-time", "one time", "pin", "verification",
      "verify", "auth", "authentication", "your code", "verification code",
      "is your", "use code", "enter", "sent", "expires", "reset", "login",
      "security", "confirmation code", "facebook code", "instagram code",
      "security code", "login code",
    ],
    negativeKeywords: opts.negativeKeywords ?? [
      "order", "invoice", "tracking", "tracking number", "amount", "total",
      "balance", "receipt", "transaction", "date", "booking", "reservation",
      "payment", "order id", "ref", "reference", "txn", "flight", "ticket",
      "road", "street", "avenue", "drive", "lane", "boulevard", "way",
      "court", "suite", "unit", "building", "box", "highway", "st", "ave",
      "rd", "blvd",
      "copyright", "rights reserved", "inc", "corp", "ltd", "group",
      "holdings", "all rights reserved", "unsubscribe", "policy", "terms",
      "declined", "denied", "failed",
    ],
    neighborhood: opts.neighborhood ?? 80,
  };
}

function extractFromText(val: string, opts: Required<OtpOptions>): string | null {
  if (!val) return null;
  const otpRegex = new RegExp(OTP_REGEX.source, "g");
  let match: RegExpExecArray | null;
  while ((match = otpRegex.exec(val)) !== null) {
    const rawOtp = match[1];
    const cleanOtp = rawOtp.replace(/[-\s]/g, "");
    if (cleanOtp.length < 4 || cleanOtp.length > 8) continue;

    const idx = match.index;
    const start = Math.max(0, idx - opts.neighborhood);
    const end = Math.min(val.length, idx + rawOtp.length + opts.neighborhood);
    const ctx = val.substring(start, end);
    const ctxLower = ctx.toLowerCase();

    if (looksLikeDateOrTime(ctx)) continue;

    // Strong positives override negative keywords ("security code 123456"
    // next to an invoice id stays a code).
    const strongPositives = [
      "otp", "verification code", "security code", "login code",
      "confirmation code", "one-time", "one time", "auth code",
    ];
    const isStrong =
      strongPositives.some((k) => ctxLower.includes(k)) ||
      /code[:\s]*$/.test(ctxLower.slice(0, idx - start).slice(-12));

    if (!isStrong) {
      const negPattern = new RegExp(
        `\\b(${opts.negativeKeywords.join("|")})\\b`,
        "i",
      );
      if (negPattern.test(ctxLower)) continue;
    }

    // "code: 123456" right before the digits — strongest signal.
    const before = ctxLower.slice(0, idx - start);
    if (/code[:\s]*$/.test(before.slice(-12))) return cleanOtp;

    if (opts.positiveKeywords.some((k) => ctxLower.includes(k))) return cleanOtp;

    // "123456 is your Instagram confirmation code" style sentences.
    const fallbackRegex =
      /(\d{4,8}|\d{3,4}[-\s]\d{3,4})[^\S\r\n]{0,8}(is|is your|is the|is a)\s+(([a-z0-9]+\s+){0,3})?(code|otp|pin|confirmation code)/i;

    if (
      /code[:\s]*(\d{4,8}|\d{3,4}[-\s]\d{3,4})/i.test(ctx) ||
      fallbackRegex.test(ctx)
    ) {
      return cleanOtp;
    }
  }
  return null;
}

// Extracts visible text from HTML: block tags become spaces so digits never
// merge with adjacent tag-less text ("</strong>123456" → " 123456").
function htmlToText(node: Node): string {
  if (node.nodeType === 3) return node.nodeValue ?? "";
  if (node.nodeType !== 1) return "";
  const tagName = (node as Element).tagName ?? "";
  const isBlock = HTML_BLOCK_TAGS[tagName.toLowerCase()] === true;
  let text = "";
  node.childNodes.forEach((child) => {
    text += htmlToText(child);
  });
  return (isBlock ? " " : "") + text + (isBlock ? " " : "");
}

export function extractOTPFromEmail(
  emailData: OtpEmailData,
  options: OtpOptions = {},
): string | null {
  const opts = buildOptions(options);

  // 1. Subject — keyword gate first so "Order shipped" never leaks ids.
  if (emailData.subject) {
    if (
      /\b(otp|pin|verification|code|one[-\s]*time|verify)\b/i.test(
        emailData.subject,
      )
    ) {
      const r = extractFromText(emailData.subject, opts);
      if (r) return r;
    } else {
      const quick = emailData.subject.match(/code[:\s]*(\d{4,8})/i);
      if (quick) return quick[1];
    }
  }

  // 2. Plain-text body.
  const fromText = emailData.text
    ? extractFromText(emailData.text, opts)
    : null;
  if (fromText) return fromText;

  // 3. HTML body — DOMParser in browsers; tag-strip fallback elsewhere.
  if (emailData.html) {
    try {
      if (typeof DOMParser !== "undefined") {
        const doc = new DOMParser().parseFromString(emailData.html, "text/html");
        const plain = htmlToText(doc.body);
        const fromHtml = extractFromText(plain, opts);
        if (fromHtml) return fromHtml;
      } else {
        const plain = emailData.html.replace(/<[^>]+>/g, " ");
        const fromHtml = extractFromText(plain, opts);
        if (fromHtml) return fromHtml;
      }
    } catch {
      // Malformed HTML — treat as no match, never crash a render.
    }
  }

  return null;
}

// Generic extractor for any text or HTML string (e.g. an SMS body).
export function extractOTP(value: string, options: OtpOptions = {}): string | null {
  const opts = buildOptions(options);
  if (!value) return null;
  const plain = /<[^>]+>/.test(value) ? value.replace(/<[^>]+>/g, " ") : value;
  return extractFromText(plain, opts);
}
