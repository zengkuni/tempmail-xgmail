import { useCallback, useRef, useState } from "react";

// Shared copy-to-clipboard with 2s "copied" checkmark feedback.
// Used by AddressCard, InboxPanel code chips, Identity modal.
export function useCopyFeedback(timeoutMs = 2000) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>(0);

  const copy = useCallback(
    (text: string) => {
      void navigator.clipboard?.writeText(text).catch(() => {});
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), timeoutMs);
    },
    [timeoutMs],
  );

  return { copied, copy };
}
