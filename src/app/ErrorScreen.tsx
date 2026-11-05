import { useState } from 'react'
import { buttonStyles } from '@/components/ui/button-styles'
import { useUiStore } from '@/stores/ui-store'
import { buildDiagnostics } from './diagnostics'
import type { ErrorSummary } from './error-info'

interface ErrorScreenProps extends Pick<ErrorSummary, 'title' | 'message' | 'detail'> {
  /** قابل للاستبدال في الاختبارات؛ الافتراضي إعادة تحميل الصفحة */
  onReload?: () => void
}

/**
 * شاشة الخطأ المشتركة بين حدّ التطبيق وحدّ المسارات. لا تستعمل أي خطاف من react-router عمداً:
 * يجب أن تعمل حتى لو كان الخلل في الموجّه نفسه. نستخدم <a href> (تحميل كامل) لأن حالة التطبيق قد تكون تالفة.
 */
export function ErrorScreen({ title, message, detail, onReload }: ErrorScreenProps) {
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle')

  // محلي بالكامل: ننسخ نصاً إلى الحافظة ولا نرسل شيئاً. الخطأ قد يكون في أي مكان، فنحمي كل قراءة هنا
  const copyDiagnostics = () => {
    let text: string
    try {
      text = buildDiagnostics(
        {
          detail,
          appVersion: __APP_VERSION__,
          userAgent: navigator.userAgent,
          language: navigator.language,
          viewport: { width: window.innerWidth, height: window.innerHeight },
          online: navigator.onLine,
          theme: useUiStore.getState().theme,
          now: new Date(),
        },
        window.location.pathname,
      )
    } catch {
      setCopied('failed')
      return
    }
    void (navigator.clipboard?.writeText(text) ?? Promise.reject(new Error('no clipboard'))).then(
      () => setCopied('done'),
      () => setCopied('failed'),
    )
  }

  return (
    <main role="alert" className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-3 leading-relaxed text-muted">{message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onReload ?? (() => window.location.reload())}
            className={buttonStyles({ variant: 'primary' })}
          >
            Reload
          </button>
          <a href="/" className={buttonStyles({ variant: 'secondary' })}>
            Back to workspaces
          </a>
        </div>
        <button type="button" onClick={copyDiagnostics} className="mt-4 text-sm text-muted underline underline-offset-4 hover:text-ink">
          Copy diagnostics for a bug report
        </button>
        <p role="status" className="mt-1 min-h-5 text-xs text-muted">
          {copied === 'done' && 'Copied. It holds no workspace content or names.'}
          {copied === 'failed' && 'The browser did not allow copying.'}
        </p>
        <details className="mt-6 text-left text-sm text-muted">
          <summary className="cursor-pointer text-center">Technical details</summary>
          <pre className="mt-2 overflow-x-auto rounded-xl border border-line bg-surface p-3 font-mono text-xs break-words whitespace-pre-wrap">
            {detail}
          </pre>
        </details>
      </div>
    </main>
  )
}
