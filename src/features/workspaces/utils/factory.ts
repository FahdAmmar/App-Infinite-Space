import { createId } from '@/lib/id'
import type { WorkspaceInput, WorkspaceMeta } from '../types/workspace'
import { NAME_MAX_LENGTH } from './constants'

export function createWorkspaceMeta(input: WorkspaceInput, now: number): WorkspaceMeta {
  return {
    id: createId(),
    name: input.name,
    description: input.description,
    color: input.color,
    icon: input.icon,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: null,
    nodeCount: 0,
    preview: [],
  }
}

const COPY_SUFFIX_PATTERN = / \(copy(?: \d+)?\)$/i

/**
 * اسم النسخة المكررة: "Name (copy)" ثم "Name (copy 2)" ...
 * نزيل لاحقة النسخة السابقة أولاً حتى لا نحصل على "Name (copy) (copy)",
 * ونقتطع الجذر إن لزم لنبقى ضمن حد طول الاسم.
 */
export function makeCopyName(sourceName: string, existingNames: readonly string[]): string {
  const taken = new Set(existingNames.map((name) => name.toLocaleLowerCase()))
  const root = sourceName.replace(COPY_SUFFIX_PATTERN, '')

  for (let attempt = 1; ; attempt += 1) {
    const suffix = attempt === 1 ? ' (copy)' : ` (copy ${attempt})`
    const candidate = `${root.slice(0, NAME_MAX_LENGTH - suffix.length).trimEnd()}${suffix}`
    if (!taken.has(candidate.toLocaleLowerCase())) return candidate
  }
}

/** نسخة مكررة من المساحة: معرّف جديد، تواريخ جديدة، وتبقى المعاينة وعدد العقد كما هي. */
export function duplicateWorkspaceMeta(
  source: WorkspaceMeta,
  name: string,
  now: number,
): WorkspaceMeta {
  return {
    ...source,
    id: createId(),
    name,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: null,
    preview: source.preview.map((rect) => ({ ...rect })),
  }
}
