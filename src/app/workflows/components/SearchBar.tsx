import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// Reusable controlled search input.
export function SearchBar({ value, onChange, placeholder = "Search" }: SearchBarProps) {
  return (
    <div className="flex w-full items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2 md:w-96">
      <Search size={18} className="text-on-surface-variant" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm outline-none placeholder:text-outline"
      />
    </div>
  );
}
