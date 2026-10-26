/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
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
