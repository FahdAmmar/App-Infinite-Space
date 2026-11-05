import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorScreen } from './ErrorScreen'
import { describeError } from './error-info'

interface State {
  failed: boolean
  error: unknown
}

/**
 * الحدّ الأخير: يلتقط أي خطأ رسم خارج الموجّه (مثل Toaster أو App نفسه) فلا تبقى شاشة بيضاء.
 * أخطاء المسارات تلتقطها RouteErrorPage أولاً. الحدود لا تعمل إلا بمكوّن صنف (class) في React.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false, error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, error }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('Unhandled UI error', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <ErrorScreen {...describeError(this.state.error)} />
  }
}
