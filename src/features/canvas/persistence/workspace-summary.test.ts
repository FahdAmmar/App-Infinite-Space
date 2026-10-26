import { describe, expect, it } from 'vitest'
import { PREVIEW_MAX_RECTS } from '@/features/workspaces/utils/constants'
import { createGroup, createImageCard, createStickyNote } from '../utils/node-factory'
import { summarizeCanvas } from './workspace-summary'

const sticky = (id: string, x: number, y: number) => ({ ...createStickyNote({ x: 0, y: 0 }, 1), id, position: { x, y } })

describe('summarizeCanvas', () => {
  it('is empty for an empty canvas', () => {
    expect(summarizeCanvas([])).toEqual({ nodeCount: 0, preview: [] })
  })

  it('counts every node and returns one normalized rectangle per node', () => {
    const { nodeCount, preview } = summarizeCanvas([sticky('a', 0, 0), sticky('b', 600, 0)])
    expect(nodeCount).toBe(2)
    expect(preview).toHaveLength(2)
    for (const r of preview) {
      for (const v of [r.x, r.y, r.w, r.h]) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  })

  it('keeps the proportions (same scale on both axes) and centers the content', () => {
    // محتوى أفقي عريض: العرض يملأ المساحة والارتفاع أصغر ومتمركز رأسياً
    const { preview } = summarizeCanvas([sticky('a', 0, 0), sticky('b', 2000, 0)])
    const [first, second] = preview
    expect(first?.x).toBeCloseTo(0, 5)
    expect((second?.x ?? 0) + (second?.w ?? 0)).toBeCloseTo(1, 5)
    expect(first?.y).toBeGreaterThan(0.2)
    // 232×208 على المحورين بنفس المقياس: نسبة w/h الفعلية في وحدات المعاينة = 232/208
    const realRatio = ((first?.w ?? 0) * 88) / ((first?.h ?? 1) * 48)
    expect(realRatio).toBeCloseTo(232 / 208, 3)
  })

  it('uses absolute positions for members of a group', () => {
    const group = { ...createGroup({ x: 0, y: 0 }, 1), id: 'g', position: { x: 1000, y: 0 } }
    const member = { ...sticky('m', 50, 50), parentId: 'g' }
    const alone = sticky('a', 0, 0)
    const { preview } = summarizeCanvas([group, member, alone])
    const memberRect = preview.find((r) => r.kind === 'sticky' && r.x > 0.5)
    expect(memberRect).toBeDefined() // العضو يقع يمين الورقة المنفردة لا قرب الأصل
  })

  it('puts groups first so they draw behind the cards', () => {
    const group = { ...createGroup({ x: 0, y: 0 }, 1), id: 'g' }
    expect(summarizeCanvas([sticky('a', 0, 0), group]).preview[0]?.kind).toBe('group')
  })

  it('estimates image cards from their aspect ratio', () => {
    const image = { ...createImageCard({ x: 0, y: 0 }, 1, { imageId: 'i', fileName: 'a', naturalWidth: 100, naturalHeight: 400, width: 200 }), id: 'img' }
    const { preview } = summarizeCanvas([image])
    expect((preview[0]?.h ?? 0) * 48).toBeGreaterThan((preview[0]?.w ?? 0) * 88) // أطول من عرضها
  })

  it('caps the rectangles for big canvases but still counts every node', () => {
    const many = Array.from({ length: PREVIEW_MAX_RECTS + 25 }, (_, i) => sticky(`n${i}`, (i % 10) * 300, Math.floor(i / 10) * 300))
    const { nodeCount, preview } = summarizeCanvas(many)
    expect(nodeCount).toBe(PREVIEW_MAX_RECTS + 25)
    expect(preview).toHaveLength(PREVIEW_MAX_RECTS)
  })
})
