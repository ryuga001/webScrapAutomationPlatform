import Link from "next/link";
import { Plus } from "lucide-react";
import type { PublicUser } from "@/components/AuthProvider";
import { SearchBar } from "./SearchBar";
import { DownloadExtensionButton } from "./DownloadExtensionButton";
import { UserAvatar } from "./UserAvatar";

interface TopbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  downloading: boolean;
  onDownload: () => void;
  user: PublicUser | null;
}

// Page header: search on the left; actions + avatar on the right.
export function Topbar({
  query,
  onQueryChange,
  downloading,
  onDownload,
  user,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-40 flex h-20 items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-8">
      <div className="flex items-center gap-8">
        <SearchBar value={query} onChange={onQueryChange} />
      </div>
      <div className="flex items-center gap-3">
        <DownloadExtensionButton downloading={downloading} onDownload={onDownload} />
        <Link
          href="/workflows/new"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary shadow-sm transition-all hover:brightness-110 active:scale-95"
        >
          <Plus size={16} />
          New Workflow
        </Link>
        <UserAvatar user={user} />
      </div>
    </header>
  );
}
