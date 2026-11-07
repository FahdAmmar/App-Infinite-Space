/**
 * منطق بناء خدمة العمل (دوال نقية بلا Node ولا DOM كي تُختبر وتُستورد من vite.config.ts).
 * القالب في sw.template.js، والمعرّف يُحسب في الإضافة من محتوى القائمة.
 */

/** ما لا يُخزَّن مسبقاً: مشهد Three.js الزخرفي (يُخزَّن عند أول استخدام فقط)، خرائط المصدر، خط woff القديم، وخدمة العمل نفسها. */
const EXCLUDED = [/createBackgroundScene-[^/]*\.js$/, /\.map$/, /\.woff$/, /(^|\/)sw\.js$/]

/** يحوّل مسارات ملفات البناء النسبية إلى روابط مطلقة مرتبة بلا مكرر ولا مستثنى. */
export function selectPrecache(files: readonly string[]): string[] {
  const urls = files
    .map((file) => file.replace(/\\/g, '/'))
    .filter((file) => !EXCLUDED.some((pattern) => pattern.test(file)))
    .map((file) => `/${file.replace(/^\/+/, '')}`)
  return [...new Set(urls)].sort()
}

/** يحقن المعرّف والقائمة في القالب؛ القائمة تُمرَّر كنص JSON داخل سلسلة JS فتُهرَّب الشرطة والاقتباس. */
export function renderServiceWorker(template: string, precache: readonly string[], buildId: string): string {
  if (!template.includes('__BUILD_ID__') || !template.includes('__PRECACHE__')) {
    throw new Error('sw.template.js lost its __BUILD_ID__ / __PRECACHE__ placeholders')
  }
  const json = JSON.stringify(precache).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return template.replace('__BUILD_ID__', () => buildId).replace('__PRECACHE__', () => json)
}
