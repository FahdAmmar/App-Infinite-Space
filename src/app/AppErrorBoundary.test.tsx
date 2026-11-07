// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// RouterProvider من الحزمة الرئيسية لا من react-router/dom: في Vitest تُحمَّل نسخة ثانية من السياق فيفشل useRouteError
import { createMemoryRouter, RouterProvider } from 'react-router'
import { click, renderNode, type Rendered } from '@/test-utils/render'
import { AppErrorBoundary } from './AppErrorBoundary'
import { ErrorScreen } from './ErrorScreen'
import { RouteErrorPage } from './RouteErrorPage'

function Boom({ message = 'kaboom' }: { message?: string }): never {
  throw new Error(message)
}

let rendered: Rendered | null = null

beforeEach(() => {
  // React يسجّل الأخطاء الملتقطة في console.error؛ نكتمها كي لا تُغرق مخرجات الاختبار
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(async () => {
  await rendered?.unmount()
  rendered = null
})

describe('AppErrorBoundary', () => {
  it('renders its children when nothing fails', async () => {
    rendered = await renderNode(
      <AppErrorBoundary>
        <p>all good</p>
      </AppErrorBoundary>,
    )
    expect(rendered.container.textContent).toContain('all good')
    expect(rendered.container.querySelector('[role="alert"]')).toBeNull()
  })

  it('replaces a crashed tree with an alert that offers a way out', async () => {
    rendered = await renderNode(
      <AppErrorBoundary>
        <Boom message="render exploded" />
      </AppErrorBoundary>,
    )
    const alert = rendered.container.querySelector('[role="alert"]')
    expect(alert?.textContent).toContain('Something went wrong')
    expect(alert?.textContent).toContain('render exploded')
    expect(alert?.querySelector('a[href="/"]')?.textContent).toBe('Back to workspaces')
  })

  it('shows the lazy-load wording when a chunk fails to download', async () => {
    rendered = await renderNode(
      <AppErrorBoundary>
        <Boom message="Failed to fetch dynamically imported module: /assets/x.js" />
      </AppErrorBoundary>,
    )
    expect(rendered.container.textContent).toContain("This page couldn't load")
  })
})

describe('ErrorScreen', () => {
  it('calls onReload when the Reload button is pressed', async () => {
    const onReload = vi.fn()
    rendered = await renderNode(<ErrorScreen title="t" message="m" detail="d" onReload={onReload} />)
    const reload = [...rendered.container.querySelectorAll('button')].find((b) => b.textContent === 'Reload')
    await click(reload ?? null)
    expect(onReload).toHaveBeenCalledOnce()
  })
})

describe('RouteErrorPage', () => {
  it('catches an error thrown by a route and keeps the rest of the app alive', async () => {
    const router = createMemoryRouter([{ path: '/', Component: Boom, ErrorBoundary: RouteErrorPage }])
    rendered = await renderNode(<RouterProvider router={router} />)
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toContain('Something went wrong')
  })

  it('reports a route error response (for example a 404) by its status', async () => {
    const router = createMemoryRouter([{ path: '/', Component: () => null, ErrorBoundary: RouteErrorPage }], {
      initialEntries: ['/missing'],
    })
    rendered = await renderNode(<RouterProvider router={router} />)
    expect(rendered.container.textContent).toContain('404')
  })
})
