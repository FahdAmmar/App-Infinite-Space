import { cn } from '@/lib/cn'

/** وسوم العقدة كحبوب صغيرة (مرجعا 2 و3). اللون يرث لون النص فيناسب كل أنواع البطاقات والسمتين. */
export function TagChips({ tags, className }: { tags: readonly string[]; className?: string }) {
  if (tags.length === 0) return null
  return (
    <ul aria-label="Tags" className={cn('flex flex-wrap gap-1.5', className)}>
      {tags.map((tag) => (
        <li key={tag} dir="auto" className="tag-chip max-w-full truncate">
          #{tag}
        </li>
      ))}
    </ul>
  )
}
