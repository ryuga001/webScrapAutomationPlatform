import { Download } from "lucide-react";

interface DownloadExtensionButtonProps {
  downloading: boolean;
  onDownload: () => void;
}

export function DownloadExtensionButton({
  downloading,
  onDownload,
}: DownloadExtensionButtonProps) {
  return (
    <button
      onClick={onDownload}
      disabled={downloading}
      title="Download a ready-to-use browser extension with your login configured"
      className="flex items-center gap-2 rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
    >
      <Download size={16} />
      {downloading ? "Building…" : "Download extension"}
    </button>
  );
}
