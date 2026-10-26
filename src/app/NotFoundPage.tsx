import { Link } from 'react-router'
import { buttonStyles } from '@/components/ui/button-styles'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function NotFoundPage() {
  useDocumentTitle('Page not found · InfiniteSpace')
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight">Page not found</h1>
        <p className="mt-3 leading-relaxed text-muted">That address doesn&apos;t lead anywhere in InfiniteSpace.</p>
        <Link to="/" className={buttonStyles({ variant: 'primary', className: 'mt-6' })}>
          Back to workspaces
        </Link>
      </div>
    </main>
  )
}
