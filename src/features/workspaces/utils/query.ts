import type { WorkspaceMeta, WorkspaceSortKey } from '../types/workspace'

/**
 * تطبيع النص للبحث: حذف التشكيل والعلامات (يشمل تشكيل العربية والحروف اللاتينية المعلَّمة)
 * وتوحيد حالة الأحرف، ليجد المستخدم "cafe" عند البحث عن "Café".
 */
export function normalizeForSearch(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase()
}

/** كل كلمة في الاستعلام يجب أن تظهر في الاسم أو الوصف (AND). */
export function filterWorkspaces(
  workspaces: readonly WorkspaceMeta[],
  query: string,
): WorkspaceMeta[] {
  const terms = normalizeForSearch(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return [...workspaces]

  return workspaces.filter((workspace) => {
    const haystack = normalizeForSearch(`${workspace.name} ${workspace.description}`)
    return terms.every((term) => haystack.includes(term))
  })
}

const nameCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

/** ترتيب ثابت: عند التساوي نرجع لتاريخ الإنشاء ثم المعرّف حتى لا تتبدل الأماكن عشوائياً. */
export function sortWorkspaces(
  workspaces: readonly WorkspaceMeta[],
  key: WorkspaceSortKey,
): WorkspaceMeta[] {
  const compare = (a: WorkspaceMeta, b: WorkspaceMeta): number => {
    switch (key) {
      case 'modified':
        return b.updatedAt - a.updatedAt
      case 'created':
        return b.createdAt - a.createdAt
      case 'name':
        return nameCollator.compare(a.name, b.name)
    }
  }
  return [...workspaces].sort(
    (a, b) => compare(a, b) || b.createdAt - a.createdAt || a.id.localeCompare(b.id),
  )
}

/** المساحات التي فُتحت فعلاً، الأحدث فتحاً أولاً. */
export function selectRecentWorkspaces(
  workspaces: readonly WorkspaceMeta[],
  limit = 4,
): WorkspaceMeta[] {
  return workspaces
    .filter((workspace) => workspace.lastOpenedAt !== null)
    .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))
    .slice(0, limit)
}
