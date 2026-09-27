// Thin client for the tempmail backend. Envelope: { success, data | error }.
// Requests are same-origin: the Vite dev proxy (dev) and the Go backend
// (single image, prod) serve /api on the same origin, and the API key is
// handled server-side, so it never ships in the browser bundle.

export const BASE_URL: string = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  let body: { success?: boolean; data?: T; error?: string } = {};
  try {
    body = await res.json();
  } catch {
    throw new ApiError(res.status, `HTTP ${res.status}`);
  }
  if (!res.ok || body.success === false) {
    throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
  }
  return body.data as T;
}

// ── types mirroring backend responses ──────────────────────────────

export interface GeneratedAddress {
  email: string;
  full_name: string;
  created_at: string;
}

export interface EmailSummary {
  id: string;
  from: string;
  /** Set by the realtime "email:new" payload; absent in REST list responses. */
  to?: string;
  subject: string;
  received_at: string;
}

export interface EmailDetail {
  id: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
  received_at: string;
}

export interface EmailList {
  email: string;
  count: number;
  emails: EmailSummary[];
}

export interface DomainInfo {
  name: string;
  is_default: boolean;
  is_active: boolean;
  mx_verified: boolean;
  usage_count: number;
  created_at: string;
  registry_status?: string[];
  registry_expires_at?: string | null;
}

export interface DomainRegisterResult {
  domain: string;
  registered: boolean;
  mx_target: string;
}

export interface DomainVerifyResult {
  domain: string;
  mx_verified: boolean;
  records: string[];
  mx_target: string;
}

export interface Stats {
  total_emails: number;
  total_inboxes: number;
  active_domains: number;
  emails_24h: number;
  unique_subjects: number;
}

export interface HourlyBucket {
  hour: string;
  count: number;
}

export interface TopItem {
  value: string;
  count: number;
}

// ── endpoints ──────────────────────────────────────────────────────

export function generateEmail(prefix?: string, domain?: string) {
  return request<GeneratedAddress>("/api/generate-email", {
    method: "POST",
    body: JSON.stringify({
      ...(prefix ? { prefix } : {}),
      ...(domain ? { domain } : {}),
    }),
  });
}

export function listEmails(address: string) {
  return request<EmailList>(`/api/emails?email=${encodeURIComponent(address)}`);
}

export function getEmail(id: string) {
  return request<EmailDetail>(`/api/email/${encodeURIComponent(id)}`);
}

export function deleteEmail(id: string) {
  return request<{ deleted: boolean; id: string }>(`/api/email/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function clearEmails(address: string) {
  return request<{ deleted: number }>(`/api/emails/clear?email=${encodeURIComponent(address)}`, {
    method: "DELETE",
  });
}

export function listDomains(all = false) {
  return request<{ domains: DomainInfo[] }>(`/api/domains${all ? "?all=1" : ""}`);
}

export function registerDomain(domain: string) {
  return request<DomainRegisterResult>("/api/domains/register", {
    method: "POST",
    body: JSON.stringify({ domain }),
  });
}

export function verifyDomain(domain: string) {
  return request<DomainVerifyResult>("/api/domains/verify", {
    method: "POST",
    body: JSON.stringify({ domain }),
  });
}

export function getStats() {
  return request<Stats>("/api/stats");
}

export function getStatistics24h() {
  return request<{ hours: HourlyBucket[] }>("/api/statistics/24h");
}

export function getTopSubjects() {
  return request<{ items: TopItem[] }>("/api/statistics/top-subjects");
}

export function getTopDomains() {
  return request<{ items: TopItem[] }>("/api/statistics/top-domains");
}

export function getTopSenders() {
  return request<{ items: TopItem[] }>("/api/statistics/top-senders");
}
