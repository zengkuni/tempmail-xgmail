export interface MockEmail {
  id: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  preview: string;
  html: string; // full message body as email-style HTML for the detail dialog
  receivedAt: string; // relative label, e.g. "2m ago"
  code?: string; // verification code chip
}

export interface RecentAddress {
  address: string;
}

export interface AddressState {
  address: string;
  fullName: string;
  domain: string | null;
  recents: string[];
  setAddress: (next: string) => void;
  usePrefix: (prefix: string) => void;
  randomize: () => void;
  /** True while a generate/claim request is in flight (spinner on Random). */
  claiming: boolean;
  setDomain: (domain: string | null) => void;
  removeRecent: (address: string) => void;
}
