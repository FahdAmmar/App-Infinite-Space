import { useCallback, useEffect, useState } from 'react'
import { storage } from '@/services/persistence'
import type { BackupInfo } from '@/services/persistence/storage-adapter'

export type BackupsState = { status: 'loading' } | { status: 'ready'; items: BackupInfo[] } | { status: 'error' }

/** الأحدث أولاً؛ النسخ بلا تاريخ (نسخ اللوحات) في النهاية بترتيب ثابت. */
export function sortBackups(items: readonly BackupInfo[]): BackupInfo[] {
  return [...items].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0) || a.key.localeCompare(b.key))
}

export function useBackups() {
  const [state, setState] = useState<BackupsState>({ status: 'loading' })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    storage
      .listBackups()
      .then((items) => {
        if (!cancelled) setState({ status: 'ready', items: sortBackups(items) })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [version])

  const reload = useCallback(() => setVersion((value) => value + 1), [])
  return { state, reload }
}
