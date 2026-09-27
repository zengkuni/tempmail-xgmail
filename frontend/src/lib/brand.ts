// Runtime config injected by the container entrypoint into /config.js before
// the SPA bundle loads, so a pushed image can be rebranded via environment
// variables without a rebuild. Falls back to build-time Vite env for `vite dev`.
interface TempmailRuntimeConfig {
  TEMPMAIL_BRAND?: string;
  TEMPMAIL_MX?: string;
  BRAND_DOMAIN?: string;
}

declare global {
  interface Window {
    __TEMPMAIL_CONFIG__?: TempmailRuntimeConfig;
  }
}

const rc: TempmailRuntimeConfig = window.__TEMPMAIL_CONFIG__ ?? {};

const raw: string =
  rc.TEMPMAIL_BRAND ??
  import.meta.env.TEMPMAIL_BRAND ??
  import.meta.env.BRAND_TEMPMAIL ??
  "xgmail";

export const BRAND_NAME = raw.charAt(0).toUpperCase() + raw.slice(1);
export const BRAND_DOMAIN: string =
  rc.BRAND_DOMAIN ?? import.meta.env.BRAND_DOMAIN ?? "tempmail.dev";
export const MAIL_DOMAIN = `mail.${BRAND_DOMAIN}`;
export const MX_TARGET: string =
  rc.TEMPMAIL_MX ??
  import.meta.env.TEMPMAIL_MX ??
  import.meta.env.BRAND_MX_TARGET ??
  `email.${BRAND_DOMAIN}`;
