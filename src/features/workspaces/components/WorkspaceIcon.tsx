import {
  BookOpen,
  Blocks,
  Code,
  Compass,
  FolderKanban,
  GraduationCap,
  Languages,
  Lightbulb,
  Network,
  Palette,
  Rocket,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import type { WorkspaceIconId } from '../types/workspace'

const ICONS: Record<WorkspaceIconId, LucideIcon> = {
  'folder-kanban': FolderKanban,
  'graduation-cap': GraduationCap,
  languages: Languages,
  blocks: Blocks,
  lightbulb: Lightbulb,
  rocket: Rocket,
  'book-open': BookOpen,
  compass: Compass,
  palette: Palette,
  code: Code,
  network: Network,
  sparkles: Sparkles,
}

export function WorkspaceIcon({ id, className }: { id: WorkspaceIconId; className?: string }) {
  const Icon = ICONS[id]
  return <Icon className={className} aria-hidden="true" />
}
