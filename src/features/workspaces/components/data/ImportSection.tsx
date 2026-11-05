import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { importWorkspaceFromFile } from '../../actions/transfer-actions'

export function ImportSection() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      await importWorkspaceFromFile(file)
    } finally {
      setBusy(false)
      // نفرّغ الحقل كي يمكن اختيار الملف نفسه مرة ثانية
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <section aria-labelledby="data-import-heading" className="space-y-3 border-t border-line pt-6">
      <h3 id="data-import-heading" className="font-display text-base font-semibold">
        Import a workspace
      </h3>
      <p className="text-sm leading-relaxed text-muted">
        Choose a file exported from InfiniteSpace (<span className="font-mono text-xs">.infinitespace.json</span>). It is
        added as a new workspace; nothing you already have is changed or overwritten.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="import-file-input"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <Button variant="secondary" size="sm" disabled={busy} aria-busy={busy} onClick={() => inputRef.current?.click()}>
        <Upload className="size-4" aria-hidden="true" />
        {busy ? 'Importing…' : 'Choose file…'}
      </Button>
    </section>
  )
}
