import { DESCRIPTION_MAX_LENGTH, NAME_MAX_LENGTH } from './constants'

export interface WorkspaceTextErrors {
  name?: string
  description?: string
}

export interface WorkspaceTextValidation {
  ok: boolean
  errors: WorkspaceTextErrors
  /** القيم بعد التنظيف (مسافات موحّدة وبدون محارف تحكم) */
  value: { name: string; description: string }
}

// محارف التحكم (C0/C1) لا تُعرض ويمكن أن تُربك الواجهة؛ نحذفها دائماً.
// eslint-disable-next-line no-control-regex -- النطاق مقصود: إزالة محارف التحكم
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g

/** يزيل محارف التحكم ويوحّد المسافات المتتالية ويقصّ الأطراف. */
export function normalizeText(input: string): string {
  return input.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * يتحقق من اسم المساحة ووصفها.
 * الرسائل موجّهة للمستخدم: تشرح المشكلة وكيف تُحل.
 */
export function validateWorkspaceText(name: string, description: string): WorkspaceTextValidation {
  const cleanName = normalizeText(name)
  const cleanDescription = normalizeText(description)
  const errors: WorkspaceTextErrors = {}

  if (cleanName.length === 0) {
    errors.name = 'Give your workspace a name.'
  } else if (cleanName.length > NAME_MAX_LENGTH) {
    errors.name = `Use ${NAME_MAX_LENGTH} characters or fewer (currently ${cleanName.length}).`
  }

  if (cleanDescription.length > DESCRIPTION_MAX_LENGTH) {
    errors.description = `Use ${DESCRIPTION_MAX_LENGTH} characters or fewer (currently ${cleanDescription.length}).`
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { name: cleanName, description: cleanDescription },
  }
}
