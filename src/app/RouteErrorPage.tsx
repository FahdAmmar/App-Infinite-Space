import { useEffect } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ErrorScreen } from './ErrorScreen'
import { describeError } from './error-info'

/**
 * حدّ الخطأ لمسارات التطبيق: يشمل أخطاء الرسم وفشل تحميل المحرر الكسول (انقطاع الشبكة بعد نشر إصدار جديد).
 * عند إزالة المحرر بسبب الخطأ يُنفَّذ تنظيف الحفظ التلقائي فيحفظ ما لم يُحفظ بعد قدر الإمكان.
 */
export function RouteErrorPage() {
  const error = useRouteError()
  useDocumentTitle('Something went wrong · InfiniteSpace')

  useEffect(() => {
    console.error('Route error', error)
  }, [error])

  const reason = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}`.trim() : error
  return <ErrorScreen {...describeError(reason)} />
}
