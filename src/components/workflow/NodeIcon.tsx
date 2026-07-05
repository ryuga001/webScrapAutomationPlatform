"use client";

import {
  Play,
  Square,
  Variable,
  StickyNote,
  Link,
  MousePointerClick,
  MousePointer,
  MoveVertical,
  Clock,
  Eye,
  ArrowLeft,
  TextCursorInput,
  Keyboard,
  CornerDownLeft,
  ChevronDown,
  ScanText,
  Link2,
  Camera,
  Repeat,
  Split,
  Timer,
  Table,
  Download,
  FileText,
  Sparkles,
  Circle,
  type LucideIcon,
} from "lucide-react";

// Maps a node type's `icon` key (see src/lib/nodes.ts) to a Lucide component.
const MAP: Record<string, LucideIcon> = {
  play: Play,
  stop: Square,
  variable: Variable,
  note: StickyNote,
  link: Link,
  click: MousePointerClick,
  hover: MousePointer,
  scroll: MoveVertical,
  clock: Clock,
  eye: Eye,
  back: ArrowLeft,
  input: TextCursorInput,
  keyboard: Keyboard,
  enter: CornerDownLeft,
  dropdown: ChevronDown,
  "scan-text": ScanText,
  link2: Link2,
  camera: Camera,
  repeat: Repeat,
  branch: Split,
  timer: Timer,
  table: Table,
  download: Download,
  "file-text": FileText,
  sparkles: Sparkles,
};

export function NodeIcon({
  name,
  className,
  size = 18,
}: {
  name: string;
  className?: string;
  size?: number;
}) {
  const Cmp = MAP[name] ?? Circle;
  return <Cmp className={className} size={size} strokeWidth={2} aria-hidden />;
}
