/**
 * معلومات تشخيص يمكن نسخها وإرفاقها ببلاغ عن خلل. محلية بالكامل: لا شبكة ولا إرسال.
 * لا تتضمن محتوى المساحات ولا أسماءها ولا بيانات شخصية، ولا مسارات داخلية (stack).
 */
export interface DiagnosticsInput {
  detail: string
  appVersion: string
  userAgent: string
  language: string
  viewport: { width: number; height: number }
  online: boolean
  /** سمة العرض الحالية (وليست محتوى المستخدم) */
  theme: string
  now: Date
}

/** مسار المتصفح فقط دون النطاق والاستعلام: كي لا يتسرب معرّف مساحة أو بطاقة في الرابط. */
export function describePath(pathname: string): string {
  return pathname.replace(/\/w\/[^/]+/, '/w/<workspace>')
}

export function buildDiagnostics(input: DiagnosticsInput, pathname: string): string {
  return [
    'InfiniteSpace diagnostics',
    `Time: ${input.now.toISOString()}`,
    `Version: ${input.appVersion}`,
    `Page: ${describePath(pathname)}`,
    `Error: ${input.detail}`,
    `Browser: ${input.userAgent}`,
    `Language: ${input.language}`,
    `Viewport: ${input.viewport.width}x${input.viewport.height}`,
    `Online: ${input.online ? 'yes' : 'no'}`,
    `Theme: ${input.theme}`,
  ].join('\n')
}
