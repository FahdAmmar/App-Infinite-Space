import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { installMatchMedia } from '@/test-utils/match-media'
import { renderNode, type Rendered } from '@/test-utils/render'
import { useMediaQuery } from './useMediaQuery'

function Probe({ query }: { query: string }) {
  return <p>{String(useMediaQuery(query))}</p>
}

let rendered: Rendered | null = null

afterEach(async () => {
  await rendered?.unmount()
  rendered = null
  Reflect.deleteProperty(window, 'matchMedia')
})

describe('useMediaQuery', () => {
  it('reports whether the query matches right now', async () => {
    installMatchMedia({ '(min-width: 768px)': true })
    rendered = await renderNode(<Probe query="(min-width: 768px)" />)
    expect(rendered.container.textContent).toBe('true')
  })

  it('re-renders when the query result changes', async () => {
    const media = installMatchMedia({ '(min-width: 768px)': false })
    rendered = await renderNode(<Probe query="(min-width: 768px)" />)
    expect(rendered.container.textContent).toBe('false')
    await act(async () => media.set('(min-width: 768px)', true))
    expect(rendered.container.textContent).toBe('true')
  })

  it('stops listening once the component unmounts', async () => {
    const media = installMatchMedia({ '(min-width: 768px)': true })
    rendered = await renderNode(<Probe query="(min-width: 768px)" />)
    expect(media.listenerCount('(min-width: 768px)')).toBe(1)
    await rendered.unmount()
    rendered = null
    expect(media.listenerCount('(min-width: 768px)')).toBe(0)
  })
})
