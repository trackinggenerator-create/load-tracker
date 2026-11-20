"use client";

import { useState } from "react";
import { ui } from "@/components/ui";

export function CopyLink({ url, label = "Copy customer link" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`${ui.secondary} border-accent text-accent`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          window.prompt("Copy this link:", url);
          return;
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}
