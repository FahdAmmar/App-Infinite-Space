/// <reference types="vitest/config" />
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import { renderServiceWorker, selectPrecache } from './src/pwa/build-sw'

// رقم الإصدار يُقرأ مرة عند البناء من package.json فيظهر في معلومات التشخيص
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

/** كل ملفات مجلد (بمسارات نسبية له) */
function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? listFiles(full).map((f) => join(name, f)) : [name]
  })
}

/**
 * يكتب dist/sw.js بعد البناء: قالب src/pwa/sw.template.js بقائمة الملفات الفعلية ومعرّف إصدار يتغير بتغيّر أي ملف.
 * ملفات الحزمة تحمل hash في اسمها، فيكفي معرّفاً من أسماء الملفات ومحتوى index.html.
 */
function serviceWorkerPlugin(): Plugin {
  let outDir = 'dist'
  return {
    name: 'infinitespace-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    writeBundle() {
      const files = listFiles(outDir)
      const precache = selectPrecache(files)
      const html = readFileSync(join(outDir, 'index.html'), 'utf-8')
      const buildId = createHash('sha256').update(precache.join('\n')).update(html).digest('hex').slice(0, 12)
      const template = readFileSync(new URL('./src/pwa/sw.template.js', import.meta.url), 'utf-8')
      writeFileSync(join(outDir, 'sw.js'), renderServiceWorker(template, precache, buildId))
    },
  }
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react(), tailwindcss(), serviceWorkerPlugin()],
  resolve: {
    alias: {
      // اختصار "@/..." يشير إلى مجلد src ليتجنب المسارات النسبية الطويلة
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // مشهد Three.js الزخرفي حزمة كسولة منفصلة (~530KB قبل الضغط) لا تُحمَّل إلا في لوحة التحكم عند تفعيله.
    // الحد الافتراضي 500KB، نرفعه فوق تلك الحزمة مباشرة (لا أكثر) كي يظهر تحذير لأي حزمة أخرى تتضخم.
    // الميزانيات الدقيقة بالحجم المضغوط لكل حزمة في scripts/check-bundle-size.mjs (npm run size:check).
    chunkSizeWarningLimit: 530,
  },
  test: {
    // الافتراضي node: إنشاء jsdom لكل ملف كان نحو 80% من زمن التشغيل (73 مرة). الملفات التي تحتاج DOM
    // (localStorage وdocument وتصيير React) تعلن ذلك بسطر `// @vitest-environment jsdom` في أولها.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
})
