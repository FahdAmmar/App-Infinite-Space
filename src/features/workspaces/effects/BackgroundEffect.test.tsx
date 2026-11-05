import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installMatchMedia } from '@/test-utils/match-media'
import { renderNode, type Rendered } from '@/test-utils/render'
import { BackgroundEffect } from './BackgroundEffect'

const { createScene } = vi.hoisted(() => ({ createScene: vi.fn() }))
vi.mock('./createBackgroundScene', () => ({ createBackgroundScene: createScene }))

const REDUCED = '(prefers-reduced-motion: reduce)'
const WIDE = '(min-width: 768px)'

/** يمنح الاستيراد الديناميكي فرصة الاكتمال قبل الفحص. */
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
}

let rendered: Rendered | null = null

beforeEach(() => {
  createScene.mockReset()
  createScene.mockImplementation(() => ({ dispose: () => undefined, setColors: () => undefined }))
})

afterEach(async () => {
  await rendered?.unmount()
  rendered = null
  Reflect.deleteProperty(window, 'matchMedia')
})

describe('BackgroundEffect', () => {
  it('loads and starts the 3D scene when the element is visible (md and wider)', async () => {
    installMatchMedia({ [REDUCED]: false, [WIDE]: true, '(pointer: fine)': true })
    rendered = await renderNode(<BackgroundEffect />)
    await flush()
    expect(createScene).toHaveBeenCalledTimes(1)
  })

  it('never loads the 3D scene on a phone-width screen where the element is hidden', async () => {
    installMatchMedia({ [REDUCED]: false, [WIDE]: false, '(pointer: fine)': false })
    rendered = await renderNode(<BackgroundEffect />)
    await flush()
    expect(createScene).not.toHaveBeenCalled()
  })

  it('never loads the 3D scene when reduced motion is requested', async () => {
    installMatchMedia({ [REDUCED]: true, [WIDE]: true, '(pointer: fine)': true })
    rendered = await renderNode(<BackgroundEffect />)
    await flush()
    expect(createScene).not.toHaveBeenCalled()
  })

  it('starts the scene after the window grows past the breakpoint', async () => {
    const media = installMatchMedia({ [REDUCED]: false, [WIDE]: false, '(pointer: fine)': true })
    rendered = await renderNode(<BackgroundEffect />)
    await flush()
    expect(createScene).not.toHaveBeenCalled()
    await act(async () => media.set(WIDE, true))
    await flush()
    expect(createScene).toHaveBeenCalledTimes(1)
  })
})
