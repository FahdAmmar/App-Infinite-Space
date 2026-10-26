import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/index.css'
import { App } from '@/app/App'
import { useWorkspaceStore } from '@/stores/workspace-store'

// نبدأ قراءة المساحات المحفوظة فوراً (قبل أول رسم) لتقليل زمن ظهور المحتوى
void useWorkspaceStore.getState().hydrate()

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root was not found in index.html')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
