import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * نص كتبه المستخدم (اسم مساحة عمل مثلاً) يُقصّ بنقاط عند ضيق المساحة.
 * dir="auto" يأخذ الاتجاه من أول حرف قوي، فيُقصّ الطرف الصحيح: بداية الاسم العربي تبقى ظاهرة ويُقصّ ذيله.
 * كان <bdi> يعزل الاتجاه لكنه يقصّ من الجهة الخاطئة في واجهة LTR فيظهر ذيل الاسم العربي فقط.
 * inline-block بعرض المحتوى يُبقي الصندوق ملاصقاً لبداية السطر، فلا يقفز الاسم القصير إلى الطرف الآخر.
 * align-bottom يمنع فجوة الخط الأساسي التي يسببها overflow:hidden داخل سطر.
 */
export function TruncatedText({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span dir="auto" className={cn('inline-block max-w-full truncate align-bottom', className)}>
      {children}
    </span>
  )
}
