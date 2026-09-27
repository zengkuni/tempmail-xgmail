export type DomainStats = {
  total: number;
  active: number;
  validMx: number;
};

export type DomainRow = {
  name: string;
  active: boolean;
  mxValid: boolean | null; // null = Unknown
  added: string; // en-US locale string, e.g. "7/31/2026, 11:47:20 PM"
  expiresAt?: string | null; // registry expiry (RDAP), ISO/RFC3339
};
