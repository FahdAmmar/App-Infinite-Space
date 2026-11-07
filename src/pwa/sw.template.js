// خدمة العمل (service worker). هذا قالب: يحقن vite.config.ts عند البناء معرّف الإصدار وقائمة الملفات المخزّنة مسبقاً
// ويكتب النتيجة في dist/sw.js. لا يُسجَّل في وضع التطوير.
const BUILD_ID = '__BUILD_ID__'
const PRECACHE = JSON.parse('__PRECACHE__')
const CACHE = `infinitespace-${BUILD_ID}`
const SHELL = '/index.html'
/** مهلة الشبكة للصفحة قبل الاعتماد على النسخة المخزّنة (اتصال ضعيف لا يجوز أن يعلّق تطبيقاً محلياً) */
const NAVIGATION_TIMEOUT_MS = 4000

self.addEventListener('install', (event) => {
  // لا skipWaiting هنا: الإصدار الجديد ينتظر موافقة المستخدم (رسالة SKIP_WAITING) كي لا يتبدل الكود تحت يده
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('infinitespace-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== self.location.origin) return
  event.respondWith(request.mode === 'navigate' ? navigate(request) : cacheFirst(request))
})

/** الصفحات: الشبكة أولاً (إصدار حديث)، ثم الهيكل المخزّن حين تفشل أو تتأخر، فيعمل أي مسار (/w/:id) دون اتصال. */
async function navigate(request) {
  try {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NAVIGATION_TIMEOUT_MS))
    return await Promise.race([fetch(request), timeout])
  } catch {
    return (await caches.match(SHELL)) || Response.error()
  }
}

/** بقية الملفات: المخزّن أولاً. ملفات /assets/ المجزأة (hash) غير المخزّنة مسبقاً تُخزَّن عند أول تحميل ناجح. */
async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok && new URL(request.url).pathname.startsWith('/assets/')) {
    const cache = await caches.open(CACHE)
    await cache.put(request, response.clone())
  }
  return response
}
