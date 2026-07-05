import type { NodeCategory } from "./nodes";

// Static class strings per category (Tailwind can't see dynamically-built class
// names, so every class used must appear literally somewhere in the source).
export interface CatClasses {
  text: string;
  dot: string;
  leftBar: string;
  paletteHover: string;
  ring: string;
  chipBg: string;
}

export const CAT_CLASSES: Record<NodeCategory, CatClasses> = {
  core: {
    text: "text-slate-500",
    dot: "bg-slate-400",
    leftBar: "border-l-slate-400",
    paletteHover: "hover:border-slate-400",
    ring: "ring-slate-400/50",
    chipBg: "bg-slate-100 text-slate-600",
  },
  navigation: {
    text: "text-cyan-500",
    dot: "bg-cyan-400",
    leftBar: "border-l-cyan-400",
    paletteHover: "hover:border-cyan-400",
    ring: "ring-cyan-400/50",
    chipBg: "bg-cyan-50 text-cyan-700",
  },
  interaction: {
    text: "text-blue-500",
    dot: "bg-blue-400",
    leftBar: "border-l-blue-400",
    paletteHover: "hover:border-blue-400",
    ring: "ring-blue-400/50",
    chipBg: "bg-blue-50 text-blue-700",
  },
  extract: {
    text: "text-emerald-500",
    dot: "bg-emerald-400",
    leftBar: "border-l-emerald-400",
    paletteHover: "hover:border-emerald-400",
    ring: "ring-emerald-400/50",
    chipBg: "bg-emerald-50 text-emerald-700",
  },
  logic: {
    text: "text-violet-500",
    dot: "bg-violet-400",
    leftBar: "border-l-violet-400",
    paletteHover: "hover:border-violet-400",
    ring: "ring-violet-400/50",
    chipBg: "bg-violet-50 text-violet-700",
  },
  data: {
    text: "text-amber-500",
    dot: "bg-amber-400",
    leftBar: "border-l-amber-400",
    paletteHover: "hover:border-amber-400",
    ring: "ring-amber-400/50",
    chipBg: "bg-amber-50 text-amber-700",
  },
  ai: {
    text: "text-fuchsia-500",
    dot: "bg-fuchsia-400",
    leftBar: "border-l-fuchsia-400",
    paletteHover: "hover:border-fuchsia-400",
    ring: "ring-fuchsia-400/50",
    chipBg: "bg-fuchsia-50 text-fuchsia-700",
  },
};
