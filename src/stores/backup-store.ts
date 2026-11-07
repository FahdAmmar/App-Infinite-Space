import { create } from 'zustand'

/**
 * حالة النسخ الاحتياطي الصغيرة: آخر نسخة ناجحة، تأجيل التذكير، اسم المجلد المتصل وهل النسخ التلقائي مفعّل.
 * تُحفظ في localStorage مباشرة (نص صغير) وأي تلف في القيم يعود إلى الافتراضي بصمت.
 * المقبض نفسه ليس هنا (لا يُسلسل إلى JSON): انظر folder-handle-store.
 */
const KEY = 'infinitespace:v1:backup'

export type FolderStatus = 'none' | 'ready' | 'needs-permission'

interface Persisted {
  lastBackupAt: number | null
  snoozedUntil: number
  folderName: string | null
  autoBackup: boolean
}

interface BackupState extends Persisted {
  /** حالة المجلد في هذه الجلسة (لا تُحفظ: الإذن يتبدل بين الجلسات) */
  folderStatus: FolderStatus
  recordBackup: (at: number) => void
  snooze: (until: number) => void
  setFolder: (name: string | null) => void
  setAutoBackup: (enabled: boolean) => void
  setFolderStatus: (status: FolderStatus) => void
}

const DEFAULTS: Persisted = { lastBackupAt: null, snoozedUntil: 0, folderName: null, autoBackup: false }

function read(): Persisted {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (typeof raw !== 'object' || raw === null) return DEFAULTS
    const value = raw as Record<string, unknown>
    return {
      lastBackupAt: typeof value.lastBackupAt === 'number' ? value.lastBackupAt : null,
      snoozedUntil: typeof value.snoozedUntil === 'number' ? value.snoozedUntil : 0,
      folderName: typeof value.folderName === 'string' ? value.folderName : null,
      autoBackup: value.autoBackup === true,
    }
  } catch {
    return DEFAULTS
  }
}

function write(state: Persisted): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* تخزين ممتلئ أو معطّل: الحالة تبقى في الذاكرة لهذه الجلسة */
  }
}

const pick = (state: BackupState): Persisted => ({
  lastBackupAt: state.lastBackupAt,
  snoozedUntil: state.snoozedUntil,
  folderName: state.folderName,
  autoBackup: state.autoBackup,
})

export const useBackupStore = create<BackupState>()((set, get) => {
  const update = (patch: Partial<BackupState>) => {
    set(patch)
    write(pick(get()))
  }
  return {
    ...read(),
    folderStatus: 'none',
    recordBackup: (lastBackupAt) => update({ lastBackupAt }),
    snooze: (snoozedUntil) => update({ snoozedUntil }),
    setFolder: (folderName) => update(folderName === null ? { folderName, autoBackup: false, folderStatus: 'none' } : { folderName }),
    setAutoBackup: (autoBackup) => update({ autoBackup }),
    setFolderStatus: (folderStatus) => set({ folderStatus }),
  }
})
