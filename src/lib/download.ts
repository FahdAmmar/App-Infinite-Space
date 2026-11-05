/**
 * يبدأ تنزيل ملف من الذاكرة. نُبقي رابط الكائن حياً لحظة بعد النقر ثم نحرّره: إلغاؤه فوراً
 * يُفشل التنزيل في بعض المتصفحات لأن بدء التنزيل غير متزامن.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
