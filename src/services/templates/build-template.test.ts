import { describe, expect, it } from 'vitest'
import { TEMPLATES, TEMPLATE_IDS, getTemplate, type TemplateId } from '@/features/workspaces/templates/template-catalog'
import { WORKSPACE_COLOR_IDS, WORKSPACE_ICON_IDS } from '@/features/workspaces/types/workspace'
import { NAME_MAX_LENGTH } from '@/features/workspaces/utils/constants'
import { CANVAS_LIMITS, CONTENT_MAX_LENGTH, GROUP_LABEL_MAX_LENGTH, ZOOM_LIMITS } from '@/features/canvas/utils/constants'
import { getNodeSize } from '@/features/canvas/utils/group-utils'
import { buildPackage, parsePackage } from '../transfer/workspace-package'
import { buildTemplateCanvas, fitViewport } from './build-template'

const NOW = 1_700_000_000_000
const filled = TEMPLATE_IDS.filter((id): id is Exclude<TemplateId, 'blank'> => id !== 'blank')

describe('template catalog', () => {
  it('lists blank first and gives every id one entry', () => {
    expect(TEMPLATES[0]?.id).toBe('blank')
    expect(TEMPLATES.map((template) => template.id)).toEqual([...TEMPLATE_IDS])
    expect(new Set(TEMPLATES.map((template) => template.id)).size).toBe(TEMPLATES.length)
  })

  it('suggests valid names, colors and icons for every template', () => {
    for (const template of TEMPLATES) {
      expect(template.suggestedName.length).toBeLessThanOrEqual(NAME_MAX_LENGTH)
      expect(WORKSPACE_COLOR_IDS).toContain(template.color)
      expect(WORKSPACE_ICON_IDS).toContain(template.icon)
      expect(template.blurb.length).toBeGreaterThan(0)
    }
    expect(getTemplate('blank').suggestedName).toBe('')
    for (const template of TEMPLATES.slice(1)) expect(template.suggestedName).not.toBe('')
  })
})

describe('buildTemplateCanvas', () => {
  it('builds nothing for the blank template', () => {
    expect(buildTemplateCanvas('blank', NOW)).toEqual({ nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } })
  })

  describe.each(filled)('%s', (id) => {
    const canvas = buildTemplateCanvas(id, NOW)

    it('has cards with unique ids, within the canvas limits', () => {
      expect(canvas.nodes.length).toBeGreaterThan(0)
      expect(new Set(canvas.nodes.map((node) => node.id)).size).toBe(canvas.nodes.length)
      expect(canvas.nodes.length).toBeLessThanOrEqual(CANVAS_LIMITS.maxNodes)
      expect(canvas.edges.length).toBeLessThanOrEqual(CANVAS_LIMITS.maxEdges)
    })

    it('connects only existing, different cards', () => {
      const ids = new Set(canvas.nodes.map((node) => node.id))
      for (const edge of canvas.edges) {
        expect(ids.has(edge.source)).toBe(true)
        expect(ids.has(edge.target)).toBe(true)
        expect(edge.source).not.toBe(edge.target)
      }
    })

    it('writes readable text that fits the card limits', () => {
      for (const node of canvas.nodes) {
        if (node.type === 'group') {
          expect(node.data.label.trim()).not.toBe('')
          expect(node.data.label.length).toBeLessThanOrEqual(GROUP_LABEL_MAX_LENGTH)
        } else if (node.type === 'sticky') {
          expect(node.data.content.trim()).not.toBe('')
          expect(node.data.content.length).toBeLessThanOrEqual(CONTENT_MAX_LENGTH)
        }
      }
    })

    it('passes the same validation as an imported file, losing nothing', () => {
      const text = JSON.stringify(
        buildPackage({
          workspace: { name: 'T', description: '', color: 'lapis', icon: 'sparkles' },
          nodes: canvas.nodes,
          edges: canvas.edges,
          viewport: canvas.viewport,
          images: {},
          exportedAt: NOW,
        }),
      )
      const parsed = parsePackage(text, NOW)
      expect(parsed.ok).toBe(true)
      if (!parsed.ok) return
      expect(parsed.value.canvas.discardedCount).toBe(0)
      expect(parsed.value.canvas.nodes).toHaveLength(canvas.nodes.length)
      expect(parsed.value.canvas.edges).toHaveLength(canvas.edges.length)
    })

    it('lays cards out without overlaps, with a visible gap between neighbours', () => {
      const byId = new Map(canvas.nodes.map((node) => [node.id, node]))
      const rects = canvas.nodes
        .filter((node) => node.type !== 'group')
        .map((node) => {
          const parent = node.parentId ? byId.get(node.parentId) : undefined
          const { width, height } = getNodeSize(node)
          const x = node.position.x + (parent?.position.x ?? 0)
          const y = node.position.y + (parent?.position.y ?? 0)
          return { x, y, right: x + width, bottom: y + height }
        })
      const gap = 12
      for (let i = 0; i < rects.length; i += 1) {
        for (let j = i + 1; j < rects.length; j += 1) {
          const a = rects[i]!
          const b = rects[j]!
          const apart = a.right + gap <= b.x || b.right + gap <= a.x || a.bottom + gap <= b.y || b.bottom + gap <= a.y
          expect(apart, `${id}: cards ${i} and ${j} are too close`).toBe(true)
        }
      }
    })

    it('opens with the whole template in view at a sensible zoom', () => {
      expect(canvas.viewport.zoom).toBeGreaterThanOrEqual(ZOOM_LIMITS.min)
      expect(canvas.viewport.zoom).toBeLessThanOrEqual(1)
      const { x, y, zoom } = canvas.viewport
      for (const node of canvas.nodes) {
        // الموضع المطلق: أبناء الإطارات نسبيون لأبيهم
        const parent = canvas.nodes.find((candidate) => candidate.id === node.parentId)
        const abs = { x: node.position.x + (parent?.position.x ?? 0), y: node.position.y + (parent?.position.y ?? 0) }
        const size = getNodeSize(node)
        expect(abs.x * zoom + x).toBeGreaterThanOrEqual(0)
        expect(abs.y * zoom + y).toBeGreaterThanOrEqual(0)
        expect((abs.x + size.width) * zoom + x).toBeLessThanOrEqual(1200)
        expect((abs.y + size.height) * zoom + y).toBeLessThanOrEqual(720)
      }
    })
  })

  it.each(['kanban', 'swot', 'retrospective', 'roadmap'] as const)('%s places every note inside one of its frames', (id) => {
    const { nodes } = buildTemplateCanvas(id, NOW)
    const groups = new Map(nodes.filter((node) => node.type === 'group').map((node) => [node.id, node]))
    expect(groups.size).toBeGreaterThan(1)
    for (const note of nodes.filter((node) => node.type === 'sticky')) {
      const parent = note.parentId ? groups.get(note.parentId) : undefined
      expect(parent, `${id}: a note has no frame`).toBeDefined()
      if (!parent) continue
      const frame = getNodeSize(parent)
      const size = getNodeSize(note)
      expect(note.position.x).toBeGreaterThanOrEqual(0)
      expect(note.position.y).toBeGreaterThanOrEqual(0)
      expect(note.position.x + size.width).toBeLessThanOrEqual(frame.width)
      expect(note.position.y + size.height).toBeLessThanOrEqual(frame.height)
    }
  })

  it('centers the content on the screen size it is given', () => {
    const screen = { width: 1600, height: 1000 }
    const { nodes, viewport } = buildTemplateCanvas('kanban', NOW, screen)
    const frames = nodes.filter((node) => node.type === 'group')
    const left = Math.min(...frames.map((node) => node.position.x))
    const right = Math.max(...frames.map((node) => node.position.x + getNodeSize(node).width))
    expect(((left + right) / 2) * viewport.zoom + viewport.x).toBeCloseTo(screen.width / 2, 0)
  })

  it('lists frames before the notes inside them (a parent must come first)', () => {
    const { nodes } = buildTemplateCanvas('kanban', NOW)
    const firstNote = nodes.findIndex((node) => node.type === 'sticky')
    const lastGroup = nodes.map((node) => node.type).lastIndexOf('group')
    expect(lastGroup).toBeLessThan(firstNote)
  })

  it('draws the mind map as a tree: one connection per non-center card', () => {
    const { nodes, edges } = buildTemplateCanvas('mind-map', NOW)
    expect(nodes.every((node) => node.type === 'sticky')).toBe(true)
    expect(edges).toHaveLength(nodes.length - 1)
    expect(new Set(edges.map((edge) => edge.target)).size).toBe(edges.length)
  })

  it('chains the roadmap steps left to right', () => {
    expect(buildTemplateCanvas('roadmap', NOW).edges).toHaveLength(2)
  })

  it('uses the given time for every card and different ids on every call', () => {
    const first = buildTemplateCanvas('swot', NOW)
    const second = buildTemplateCanvas('swot', NOW)
    expect(first.nodes[0]?.data.createdAt).toBe(NOW)
    expect(first.nodes[0]?.id).not.toBe(second.nodes[0]?.id)
  })
})

describe('fitViewport', () => {
  it('returns the default view for nothing', () => {
    expect(fitViewport([])).toEqual({ x: 0, y: 0, zoom: 1 })
  })

  it('never zooms in past 100% for a small layout', () => {
    expect(fitViewport(buildTemplateCanvas('swot', NOW).nodes.slice(0, 2)).zoom).toBeLessThanOrEqual(1)
  })

  it('zooms out for a wide layout so everything fits', () => {
    const wide = buildTemplateCanvas('roadmap', NOW).nodes
    expect(fitViewport(wide).zoom).toBeLessThan(1)
  })
})
