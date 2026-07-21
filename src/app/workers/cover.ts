import {
  Bot,
  Cpu,
  Sparkles,
  MessageSquare,
  Database,
  Search as SearchIcon,
  Image as ImageIcon,
  FileText,
  Mail,
  BarChart3,
  Globe,
  Wrench,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";

// No worker image field in the manifest yet, so every card gets a
// deterministic generated cover (gradient + icon) instead — same category
// always renders the same look, without needing real artwork.
const COVER_GRADIENTS = [
  "from-violet-500 to-fuchsia-500",
  "from-blue-500 to-cyan-400",
  "from-emerald-500 to-teal-400",
  "from-orange-500 to-amber-400",
  "from-rose-500 to-pink-500",
  "from-indigo-500 to-blue-500",
  "from-fuchsia-500 to-purple-600",
  "from-lime-500 to-green-500",
  "from-cyan-500 to-sky-500",
  "from-red-500 to-orange-500",
] as const;

const COVER_ICONS: LucideIcon[] = [
  Bot,
  Cpu,
  Sparkles,
  MessageSquare,
  Database,
  SearchIcon,
  ImageIcon,
  FileText,
  Mail,
  BarChart3,
  Globe,
  Wrench,
  ShieldCheck,
  Zap,
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function coverStyle(category: string) {
  const hash = hashString(category);
  return {
    gradient: COVER_GRADIENTS[hash % COVER_GRADIENTS.length],
    Icon: COVER_ICONS[hash % COVER_ICONS.length],
  };
}
