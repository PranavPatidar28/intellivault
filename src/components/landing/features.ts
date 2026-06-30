import {
  Wand2,
  FileText,
  Hash,
  Search,
  Image,
  type LucideIcon,
} from "lucide-react";

export interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Tailwind grid spans for the bento layout. */
  className: string;
  /** Small accent label rendered in the card. */
  tag: string;
  large?: boolean;
}

// Single source of truth for the feature bento. Every item maps to a real,
// shipping feature in the app (see src/app/(app)/*).
export const FEATURES: Feature[] = [
  {
    icon: Wand2,
    title: "AI Dump",
    description:
      "Drop in raw documents, PDFs, images or a wall of text. IntelliVault turns the mess into a clean, structured note — with a title, smart tags, headings and action items pulled out for you.",
    tag: "Flagship",
    className: "md:col-span-2 md:row-span-2",
    large: true,
  },
  {
    icon: FileText,
    title: "Rich Notes",
    description:
      "A full-featured editor with formatting, code blocks, lists and more. Pin what matters, switch between grid and list, and keep momentum with keyboard shortcuts.",
    tag: "Editor",
    className: "md:col-span-1",
  },
  {
    icon: Hash,
    title: "Smart Tags",
    description:
      "Organize with a hierarchical tag system. Merge, recolor and archive in bulk, and see real usage analytics for every tag.",
    tag: "Organize",
    className: "md:col-span-1",
  },
  {
    icon: Search,
    title: "Semantic Search",
    description:
      "Find notes by meaning, not just keywords. Vector search surfaces the right note even when you don't remember the exact words you used.",
    tag: "AI search",
    className: "md:col-span-1",
  },
  {
    icon: Image,
    title: "Media Library",
    description:
      "Upload and manage images, audio, video and documents in one place, with usage tracking so nothing important gets deleted by accident.",
    tag: "Files",
    className: "md:col-span-1",
  },
];
