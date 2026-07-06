import type { ComponentType } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";

type IconType = ComponentType<{ size?: number; className?: string }>;

export interface NavItem {
  label: string;
  icon: IconType;
  href?: string;
  active?: boolean;
}

interface SidebarProps {
  navigation: NavItem[];
  onLogout: () => void;
}

// App navigation rail: brand, nav items and logout. Aspirational (inactive)
// items render inert so they never route to a missing page.
export function Sidebar({ navigation, onLogout }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-60 flex-col border-r border-outline-variant bg-surface-container-lowest p-4">
      <div className="mb-8 flex items-center gap-3 px-2 py-4">
        <Logo size={40} className="shadow rounded-lg" />
        <div>
          <h1 className="font-display text-lg font-bold text-primary">WebBot</h1>
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
            Automation Platform
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {navigation.map(({ label, icon: Icon, href, active }) =>
          active ? (
            <Link
              key={label}
              href={href ?? "#"}
              className="flex items-center gap-3 rounded-lg bg-primary-container px-4 py-2.5 font-semibold text-on-primary-container"
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ) : (
            <span
              key={label}
              title="Coming soon"
              className="flex cursor-default items-center gap-3 rounded-lg px-4 py-2.5 text-on-surface-variant opacity-70"
            >
              <Icon size={18} />
              <span>{label}</span>
            </span>
          ),
        )}
      </nav>

      <div className="mt-auto space-y-1 border-t border-outline-variant pt-4">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-error transition-colors hover:bg-error/10"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
