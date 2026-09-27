import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { generateEmail } from "@/lib/api";
import type { AddressState } from "@/components/home/types";

const STORAGE_KEY = "tempmail:address";

export function useAddressState(initialAddress?: string): AddressState {
  const [address, setAddressRaw] = useState("");
  const [fullName, setFullName] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [domain, setDomainRaw] = useState<string | null>(null);
  const [recents, setRecents] = useState<string[]>([]);
  // Serialize claim calls so rapid clicks never race into out-of-order state.
  const pending = useRef(Promise.resolve());
  // Minimum spinner time so the loading feedback is visible even when the
  // local backend answers in a few ms. claimSeq ensures only the last claim
  // in a rapid sequence is allowed to clear the spinner.
  const SPINNER_MIN_MS = 600;
  const claimSeq = useRef(0);
  const claim = useCallback((prefix?: string, targetDomain?: string | null) => {
    const myId = ++claimSeq.current;
    const startedAt = Date.now();
    setClaiming(true);
    const run = pending.current.then(() =>
      generateEmail(prefix, targetDomain ?? undefined).catch((e: unknown) => {
        // Deduped id: one toast no matter how many rapid claims fail.
        toast.error("Failed to generate an address", {
          id: "generate-email",
          description: e instanceof Error ? e.message : undefined,
        });
        return null;
      }),
    );
    pending.current = run.then(() => undefined);
    void pending.current.then(() => {
      const wait = Math.max(0, SPINNER_MIN_MS - (Date.now() - startedAt));
      setTimeout(() => {
        if (claimSeq.current === myId) setClaiming(false);
      }, wait);
    });
    return run;
  }, []);

  // Adopt an address handed in via URL (/<email> redirect); otherwise fall
  // back to the address persisted in localStorage (so in-app navigation from
  // /domains etc. keeps the same inbox, just like a reload); only claim a
  // random inbox when neither exists.
  const claimed = useRef(false);
  useEffect(() => {
    if (initialAddress) {
      claimed.current = true;
      setAddressRaw(initialAddress);
      setRecents((rs) =>
        rs.includes(initialAddress) ? rs : [initialAddress, ...rs].slice(0, 5),
      );
      return;
    }
    if (claimed.current) return;
    claimed.current = true;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.includes("@")) {
      setAddressRaw(saved);
      setRecents((rs) => (rs.includes(saved) ? rs : [saved, ...rs].slice(0, 5)));
      return;
    }
    // No prefix → backend picks a fakerindo identity (username + full name).
    void claim().then((res) => {
      if (res) {
        setAddressRaw(res.email);
        setFullName(res.full_name);
        setRecents([res.email]);
      }
    });
  }, [initialAddress, claim]);

  // Persist every address change so navigating away and back (or a later
  // visit without ?address=) restores the same inbox.
  useEffect(() => {
    if (address) localStorage.setItem(STORAGE_KEY, address);
  }, [address]);

  const setAddress = useCallback((next: string) => {
    setAddressRaw(next);
    setDomainRaw(null);
  }, []);

  // Claim a chosen prefix on the active domain (or the default when "Auto").
  const usePrefix = useCallback(
    (prefix: string) => {
      void claim(prefix, domain).then((res) => {
        if (!res) return;
        setFullName(res.full_name);
        setAddressRaw((prev) => {
          setRecents((rs) =>
            rs.includes(prev) ? rs : [prev, ...rs].filter(Boolean).slice(0, 5),
          );
          return res.email;
        });
      });
    },
    [claim, domain],
  );

  // No prefix → fresh fakerindo identity from the backend.
  const randomize = useCallback(() => {
    void claim(undefined, domain).then((res) => {
      if (!res) return;
      setFullName(res.full_name);
      setAddressRaw((prev) => {
        setRecents((rs) =>
          rs.includes(prev) ? rs : [prev, ...rs].filter(Boolean).slice(0, 5),
        );
        return res.email;
      });
    });
  }, [claim, domain]);

  const setDomain = useCallback(
    (next: string | null) => {
      setDomainRaw(next);
      if (next === null) return;
      setAddressRaw((prev) => {
        const prefix = prev.split("@")[0];
        if (!prefix) return prev;
        void claim(prefix, next).then((res) => {
          if (res) {
            setFullName(res.full_name);
            setAddressRaw(res.email);
          }
        });
        return `${prefix}@${next}`;
      });
    },
    [claim],
  );
  const removeRecent = useCallback((target: string) => {
    setRecents((rs) => rs.filter((r) => r !== target));
  }, []);
  return useMemo(
    () => ({ address, fullName, domain, recents, claiming, setAddress, usePrefix, randomize, setDomain, removeRecent }),
    [address, fullName, domain, recents, claiming, setAddress, usePrefix, randomize, setDomain, removeRecent],
  );
}
