import type { ToastKind } from '@/stores/ui-store'

/**
 * مهلة اختفاء كل نوع رسالة (بالمللي ثانية). في ملف مستقل لأن ملف المكوّن لا يصدّر إلا مكوّنات (قاعدة fast refresh).
 * الأخطاء أطول لأنها تحتاج قراءة، لكنها ليست دائمة: هي رفض مؤقت لا فشل حفظ.
 */
export const TOAST_DURATION_MS: Record<ToastKind, number> = { success: 5000, info: 5000, error: 8000 }
