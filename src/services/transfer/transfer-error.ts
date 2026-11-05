export type TransferErrorKind = 'unreadable' | 'invalid' | 'too-large' | 'storage' | 'nothing'

/** خطأ يحمل رسالة جاهزة لعرضها للمستخدم (إنجليزية) وسبباً مصنّفاً لاختبار السلوك. */
export class TransferError extends Error {
  readonly kind: TransferErrorKind

  constructor(kind: TransferErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'TransferError'
    this.kind = kind
  }
}
