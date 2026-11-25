"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { COPY_FEEDBACK_MS } from "@/lib/constants";

async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path (some in-app browsers block the API)
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  textarea.remove();
  return ok;
}

/**
 * Copies text and exposes a short-lived `copied` flag for UI feedback, plus
 * `copyCount` (bumps on every copy) so animations can replay via `key`.
 */
export function useClipboard() {
  const [copied, setCopied] = useState(false);
  const [copyCount, setCopyCount] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(async (text: string) => {
    const ok = await writeToClipboard(text);
    if (ok) {
      setCopied(true);
      setCopyCount((n) => n + 1);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    }
    return ok;
  }, []);

  return { copied, copyCount, copy };
}
