import { Check, Copy } from "lucide-react";
import { BRAND_DOMAIN, BRAND_NAME } from "@/lib/brand";
import { useCopyFeedback } from "@/hooks/use-copy-feedback";
import { Button } from "@/components/ui/button";

const BASE_URL = `https://${BRAND_DOMAIN}`;

const MARKDOWN = `# ${BRAND_NAME} API

Base URL: ${BASE_URL}

## Quick Start

- \`X-API-Key: YOUR_KEY\` is the simplest option. For quick testing you can start with the public key \`PUBLIC_API_KEY\`.
- Most mailbox endpoints require an email parameter, for example \`?email=demo@example.com\`.
- All endpoints return JSON with the common \`success\`, \`data\`, and \`error\` fields.
- If you already know a currently supported domain on this site, you do not have to call the email generation endpoint first. You can compose prefix@domain locally and call the mailbox APIs directly, which saves one API request.

## Core Endpoints

- \`POST / GET /api/generate-email\` — Generate a temporary inbox. Use GET for the simplest random inbox flow, or POST with prefix and domain when you want explicit control. The response includes \`full_name\`, a ready-to-use identity name matching the address.
- \`GET /api/emails?email=...\` — Fetch emails for a mailbox.
- \`GET /api/email/{id}\` — Fetch a single email, including text, HTML, raw headers, and metadata.
- \`DELETE /api/email/{id}\` — Delete one email by ID.
- \`DELETE /api/emails/clear?email=...\` — Delete all emails in a mailbox.
- \`GET /api/stats\` — Read site-wide statistics.

## Example Flow

1) Generate a random temporary email address

\`\`\`bash
curl '${BASE_URL}/api/generate-email' \\
  -H 'X-API-Key: PUBLIC_API_KEY'
\`\`\`

2) Generate with a fixed prefix and optional domain (random if omitted)

\`\`\`bash
curl -X POST '${BASE_URL}/api/generate-email' \\
  -H 'Content-Type: application/json' \\
  -H 'X-API-Key: PUBLIC_API_KEY' \\
  -d '{"prefix":"demo","domain":"yopmail.com"}'
\`\`\`

Two modes: include \`domain\` to pin the address to that specific domain. Omit \`domain\` (or send no body) and the address lands on a random domain from the supported list.

3) List emails in an inbox

\`\`\`bash
curl '${BASE_URL}/api/emails?email=demo@example.com' \\
  -H 'X-API-Key: PUBLIC_API_KEY'
\`\`\`

4) Read a single email

\`\`\`bash
curl '${BASE_URL}/api/email/EMAIL_ID' \\
  -H 'X-API-Key: PUBLIC_API_KEY'
\`\`\`

5) Delete a single email by ID

\`\`\`bash
curl -X DELETE '${BASE_URL}/api/email/EMAIL_ID' \\
  -H 'X-API-Key: PUBLIC_API_KEY'
\`\`\`

6) Clear an entire inbox

\`\`\`bash
curl -X DELETE '${BASE_URL}/api/emails/clear?email=demo@example.com' \\
  -H 'X-API-Key: PUBLIC_API_KEY'
\`\`\`

## Response Shape

\`\`\`json
{
  "success": true,
  "data": {
    "email": "demo@example.com"
  }
}
\`\`\`

## Extended Statistics

- \`/api/statistics/24h\` returns one 24-hour hourly distribution window; use offset=1,2,... for older windows.
- \`/api/statistics/top-subjects\` returns top email subjects.
- \`/api/statistics/top-domains\` returns the most active domains.
- \`/api/statistics/top-senders\` returns the most active senders.
`;

export function CopyMarkdownButton() {
  const { copied, copy } = useCopyFeedback();

  return (
    <Button variant="secondary" onClick={() => copy(MARKDOWN)}>
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : "Copy Markdown"}
    </Button>
  );
}
