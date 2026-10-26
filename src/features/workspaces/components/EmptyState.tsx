import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { BorderBeam } from '@/components/magic/BorderBeam'

interface EmptyStateProps {
  onCreate: () => void
}

/** حالة البداية: دعوة واضحة للفعل مع رسم يشرح الفكرة (بطاقات متصلة بمنحنى متدرج كما في المرجع الأول). */
export function EmptyState({ onCreate }: EmptyStateProps) {
  return (
    <section
      aria-labelledby="empty-heading"
      className="relative mx-auto grid max-w-3xl items-center gap-8 rounded-[28px] border border-dashed border-line bg-surface/60 p-8 sm:grid-cols-[1fr_auto] sm:p-10"
    >
      {/* شعاع ضوئي واحد هادئ على حدود البطاقة الوحيدة في الشاشة: يوجّه النظر إلى الفعل الأول (Magic UI Border Beam) */}
      <BorderBeam size={120} duration={9} />
      <div>
        <h2 id="empty-heading" className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Start your first workspace
        </h2>
        <p className="mt-3 max-w-md leading-relaxed text-muted">
          A workspace is an unlimited canvas for one topic. Place notes, images, and links anywhere, then connect
          them to see how your ideas fit together.
        </p>
        <Button variant="primary" onClick={onCreate} className="mt-6">
          <Plus className="size-5" aria-hidden="true" />
          Create workspace
        </Button>
      </div>

      <svg viewBox="0 0 240 160" className="mx-auto w-56 text-ink sm:w-64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="empty-edge" x1="70" y1="60" x2="170" y2="110" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--edge-from)" />
            <stop offset="1" stopColor="var(--edge-to)" />
          </linearGradient>
        </defs>
        {/* منحنيات الربط بتدرج بنفسجي ← وردي مع نقاط المقابض */}
        <path d="M74 58C112 58 104 108 142 108" stroke="url(#empty-edge)" strokeWidth="2" strokeLinecap="round" />
        <path d="M74 58C116 40 150 34 176 38" stroke="url(#empty-edge)" strokeWidth="2" strokeLinecap="round" opacity=".55" />
        <circle cx="74" cy="58" r="4" fill="var(--c-bg)" stroke="var(--c-text)" strokeWidth="1.5" />
        <circle cx="142" cy="108" r="4" fill="var(--c-bg)" stroke="var(--c-text)" strokeWidth="1.5" />
        <rect x="14" y="32" width="60" height="52" rx="12" fill="var(--c-surface)" stroke="var(--c-line)" strokeWidth="1.5" />
        <rect x="24" y="44" width="22" height="5" rx="2.5" fill="currentColor" opacity=".28" />
        <rect x="24" y="56" width="40" height="4" rx="2" fill="currentColor" opacity=".16" />
        <rect x="24" y="65" width="32" height="4" rx="2" fill="currentColor" opacity=".16" />
        <rect x="142" y="86" width="76" height="56" rx="12" fill="var(--c-surface)" stroke="var(--c-line)" strokeWidth="1.5" />
        <rect x="152" y="98" width="26" height="5" rx="2.5" fill="currentColor" opacity=".28" />
        <rect x="152" y="110" width="54" height="4" rx="2" fill="currentColor" opacity=".16" />
        <rect x="152" y="119" width="40" height="4" rx="2" fill="currentColor" opacity=".16" />
        <rect x="170" y="14" width="56" height="44" rx="10" fill="var(--sticky-purple-bg)" stroke="var(--sticky-purple-border)" strokeWidth="1.5" />
        <rect x="180" y="26" width="28" height="4" rx="2" fill="var(--sticky-purple-ink)" opacity=".7" />
        <rect x="180" y="35" width="36" height="3.5" rx="1.75" fill="var(--sticky-purple-ink)" opacity=".4" />
      </svg>
    </section>
  )
}
