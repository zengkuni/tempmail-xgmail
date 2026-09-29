import { useCallback, useEffect, useRef, useState } from "react";
import { get as pslGet, parse as pslParse } from "psl";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import { BASE_URL, clearEmails, deleteEmail, getEmail, listEmails, type EmailSummary } from "@/lib/api";
import { extractOTPFromEmail } from "@/lib/otp-detector";
import type { MockEmail } from "@/components/home/types";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function senderName(from: string): string {
  // Display name asli ("Ahmad <a@gmail.com>") → tampilkan apa adanya.
  const m = from.match(/^\s*"?([^"<]+?)"?\s*</);
  if (m) return m[1].trim();
  // Tanpa display name: brand dari root domain via PSL — local-part mesin
  // (deals, noreply, ...) bukan identitas yang informatif.
  return brandName(senderDomain(from)) || from;
}

function senderEmail(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return m ? m[1] : from.trim();
}

// Registrable root + nama brand memakai Public Suffix List (psl) supaya
// lengkap (co.id, com.au, ...): account.tokopedia.com → tokopedia.com →
// "Tokopedia"; fallback ke host apa adanya kalau psl tidak mengenali.

function brandName(host: string): string {
  // psl.get memberi registrable root; psl.parse memisahkan sld+tld.
  const root = pslGet(host) ?? host;
  const parsed = pslParse(root);
  const sld = parsed && "sld" in parsed ? parsed.sld : root.split(".")[0];
  if (!sld) return host;
  return sld.charAt(0).toUpperCase() + sld.slice(1);
}

function senderDomain(from: string): string {
  // Root domain via PSL (co.id/com.vn benar) — URL ikon selalu root:
  // account.tokopedia.com → tokopedia.com.
  const at = senderEmail(from).lastIndexOf("@");
  return at > 0 ? (pslGet(senderEmail(from).slice(at + 1).toLowerCase()) ?? "") : "";
}

function toMock(e: EmailSummary): MockEmail {
  return {
    id: e.id,
    senderName: senderName(e.from),
    senderEmail: senderEmail(e.from),
    senderDomain: senderDomain(e.from),
    subject: e.subject || "(no subject)",
    preview: "",
    html: "",
    receivedAt: relativeTime(e.received_at),
    code: extractOTPFromEmail({ subject: e.subject }) ?? undefined,
  };
}

export function useInbox(address: string) {
  const [emails, setEmails] = useState<MockEmail[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const addressRef = useRef(address);
  addressRef.current = address;

  const refresh = useCallback(async (showSpinner: boolean) => {
    const addr = addressRef.current;
    if (!addr || !addr.includes("@")) return;
    if (showSpinner) setRefreshing(true);
    try {
      const list = await listEmails(addr);
      if (addressRef.current !== addr) return; // address changed mid-flight
      setEmails(list.emails.map(toMock));
    } catch {
      // Backend down: keep previous list; only user-triggered refreshes toast.
      if (showSpinner) {
        toast.error("Failed to refresh inbox", { id: "inbox-refresh" });
      }
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  }, []);

  // Reset, load history, then stream new mail over Socket.IO on address change.
  useEffect(() => {
    setEmails([]);
    void refresh(true);

    if (!address || !address.includes("@")) return;
    // Empty BASE_URL = same origin; io(undefined) connects to window.location.
    const socket: Socket = io(BASE_URL || undefined, {
      query: { email: address },
      transports: ["websocket", "polling"],
    });
    socket.on("email:new", (p: EmailSummary) => {
      // The hub scopes this event to the inbox room, but verify the
      // recipient anyway so a stray broadcast can never leak cross-inbox.
      if (p.to && p.to !== address) return;
      if (addressRef.current !== address) return;
      setEmails((es) => (es.some((e) => e.id === p.id) ? es : [toMock(p), ...es]));
    });
    return () => {
      socket.disconnect();
    };
  }, [address, refresh]);

  // Lazy-load full body when a row is opened; also enriches preview/code.
  const openEmail = useCallback(async (email: MockEmail): Promise<MockEmail> => {
    try {
      const d = await getEmail(email.id);
      const full: MockEmail = {
        ...email,
        preview: d.text.trim().slice(0, 160),
        html: d.html || `<pre>${d.text}</pre>`,
        code: extractOTPFromEmail({ subject: d.subject, text: d.text, html: d.html }) ?? undefined,
      };
      setEmails((es) => es.map((e) => (e.id === email.id ? { ...e, preview: full.preview, code: full.code } : e)));
      return full;
    } catch {
      toast.error("Failed to load the email", { id: `email-open-${email.id}` });
      return email;
    }
  }, []);

  const clear = useCallback(async () => {
    const addr = addressRef.current;
    setEmails([]);
    if (addr) {
      try {
        await clearEmails(addr);
        toast.success("Inbox cleared");
      } catch (e) {
        // UI already cleared; surface the server-side failure.
        toast.error("Failed to clear the inbox on the server", {
          description: e instanceof Error ? e.message : undefined,
        });
      }
    }
  }, []);

  // Delete a single email by id; the row is removed optimistically, a failed
  // delete triggers a silent refresh to restore the true list.
  const remove = useCallback(
    async (email: MockEmail) => {
      setEmails((es) => es.filter((e) => e.id !== email.id));
      try {
        await deleteEmail(email.id);
        toast.success("Email deleted");
      } catch (e) {
        toast.error("Failed to delete the email", {
          id: `email-delete-${email.id}`,
          description: e instanceof Error ? e.message : undefined,
        });
        void refresh(false);
      }
    },
    [refresh],
  );

  return { emails, refreshing, refresh: () => void refresh(true), openEmail, clear, remove };
}
