import { createBrowserRouter } from 'react-router'
import { DashboardPage } from '@/features/workspaces/pages/DashboardPage'
import { NotFoundPage } from './NotFoundPage'

export const router = createBrowserRouter([
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
])
