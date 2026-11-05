import { afterEach, describe, expect, it } from 'vitest'
import { renderNode, type Rendered } from '@/test-utils/render'
import { TruncatedText } from './TruncatedText'

let rendered: Rendered | null = null

afterEach(async () => {
  await rendered?.unmount()
  rendered = null
})

describe('TruncatedText', () => {
  it('derives its direction from the text so a long Arabic name keeps its beginning', async () => {
    rendered = await renderNode(<TruncatedText>مساحة عمل لتخطيط المشروع الكبير</TruncatedText>)
    const span = rendered.container.querySelector('span')
    expect(span?.getAttribute('dir')).toBe('auto')
    expect(span?.textContent).toBe('مساحة عمل لتخطيط المشروع الكبير')
  })

  it('truncates with an ellipsis and never grows past its container', async () => {
    rendered = await renderNode(<TruncatedText>Quarterly planning</TruncatedText>)
    const classes = rendered.container.querySelector('span')?.className ?? ''
    expect(classes).toContain('truncate')
    expect(classes).toContain('max-w-full')
  })

  it('merges extra classes without dropping the truncation ones', async () => {
    rendered = await renderNode(<TruncatedText className="text-sm font-semibold">Roadmap</TruncatedText>)
    const classes = rendered.container.querySelector('span')?.className ?? ''
    expect(classes).toContain('text-sm')
    expect(classes).toContain('truncate')
  })

  it('does not wrap the text in bdi, which clipped the wrong end of Arabic names', async () => {
    rendered = await renderNode(<TruncatedText>اسم</TruncatedText>)
    expect(rendered.container.querySelector('bdi')).toBeNull()
  })
})
