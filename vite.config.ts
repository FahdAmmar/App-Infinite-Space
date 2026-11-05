/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// رقم الإصدار يُقرأ مرة عند البناء من package.json فيظهر في معلومات التشخيص
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // اختصار "@/..." يشير إلى مجلد src ليتجنب المسارات النسبية الطويلة
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // مشهد Three.js الزخرفي حزمة كسولة منفصلة (~530KB قبل الضغط) لا تُحمَّل إلا في لوحة التحكم عند تفعيله.
    // نرفع حد التحذير فوقها مباشرة (لا أكثر) كي يبقى أي تضخم آخر في الحزم ظاهراً.
    chunkSizeWarningLimit: 560,
  },
  test: {
    // jsdom يوفر localStorage و DOM لاختبار طبقة التخزين والمخازن
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
})
