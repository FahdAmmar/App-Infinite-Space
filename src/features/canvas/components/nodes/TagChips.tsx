import { cn } from '@/lib/cn'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'

/**
 * وسوم العقدة كحبوب صغيرة (مرجعا 2 و3). اللون يرث لون النص فيناسب كل أنواع البطاقات والسمتين.
 * النقر على وسم يعرض البطاقات الحاملة له فقط (ويخفّت الباقي)، والنقر عليه ثانية يُلغي التصفية.
 * stopPropagation كي لا يغيّر النقر تحديد البطاقة، وnodrag/nopan كي لا يبدأ سحباً أو تحريكاً للوحة.
 */
export function TagChips({ tags, className }: { tags: readonly string[]; className?: string }) {
  const api = useCanvasStoreApi()
  const active = useCanvasStore((state) => state.tagFilter?.toLowerCase() ?? null)
  if (tags.length === 0) return null
  return (
    <ul aria-label="Tags" className={cn('flex flex-wrap gap-1.5', className)}>
      {tags.map((tag) => {
        const isActive = active === tag.toLowerCase()
        return (
          <li key={tag} dir="auto" className="max-w-full">
            <button
              type="button"
              aria-pressed={isActive}
              title={isActive ? 'Show all cards' : `Show only cards tagged #${tag}`}
              onClick={(event) => {
                event.stopPropagation()
                api.getState().setTagFilter(isActive ? null : tag)
              }}
              className={cn('tag-chip nodrag nopan block max-w-full cursor-pointer truncate', isActive && 'tag-chip-active')}
            >
              #{tag}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
