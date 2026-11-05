import { createBrowserRouter } from 'react-router'
import { DashboardPage } from '@/features/workspaces/pages/DashboardPage'
import { NotFoundPage } from './NotFoundPage'
import { RouteErrorPage } from './RouteErrorPage'

export const router = createBrowserRouter([
  {
    // مسار بلا نمط يحمل حدّ الخطأ لكل ما تحته: خطأ في أي صفحة (أو في تحميل المحرر الكسول) لا يُسقط التطبيق كله
    ErrorBoundary: RouteErrorPage,
    children: [
      { path: '/', Component: DashboardPage },
      {
        path: '/w/:workspaceId',
        // تحميل كسول: كود المحرر (وReact Flow لاحقاً) لا يُحمَّل إلا عند فتح مساحة،
        // فتبقى لوحة التحكم خفيفة وسريعة.
        lazy: async () => {
          const { WorkspaceEditorPage } = await import('@/features/canvas/pages/WorkspaceEditorPage')
          return { Component: WorkspaceEditorPage }
        },
      },
      { path: '*', Component: NotFoundPage },
    ],
  },
])
