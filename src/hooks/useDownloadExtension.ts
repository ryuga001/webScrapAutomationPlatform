"use client";

import { useCallback, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export function useDownloadExtension() {
  const { user, authFetch } = useAuth();
  const [downloading, setDownloading] = useState(false);

  const downloadExtension = useCallback(async () => {
    setDownloading(true);
    try {
      const res = await authFetch("/api/extension/download");
      if (!res.ok) {
        alert("Could not build your extension. Please try again.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `webbot-extension-${user?.username ?? "you"}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, [authFetch, user]);

  return { downloading, downloadExtension };
}
