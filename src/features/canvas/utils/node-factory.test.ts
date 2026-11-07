import { describe, expect, it } from 'vitest'
import { NODE_SIZES } from './constants'
import { createEdge } from './edge-utils'
import { withLocked, withStatus } from './card-flags'
import { createChecklist, createShape, createVideo, createGroup, createImageCard, createLinkCard, createNode, createStickyNote, createTextCard, duplicateNodes } from './node-factory'

describe('createStickyNote', () => {
  it('centers the note on the requested point and uses default dimensions', () => {
    const note = createStickyNote({ x: 500, y: 300 }, 1000)
    const { width, height } = NODE_SIZES.sticky
    expect(note).toMatchObject({ type: 'sticky', width, height })
    expect(note.position).toEqual({ x: Math.round(500 - width / 2), y: Math.round(300 - height / 2) })
  })

  it('starts empty, yellow, with matching timestamps and a unique id', () => {
    const a = createStickyNote({ x: 0, y: 0 }, 42)
    const b = createStickyNote({ x: 0, y: 0 }, 42)
    expect(a.data).toEqual({ title: '', content: '', color: 'yellow', textColor: null, tags: [], createdAt: 42, updatedAt: 42 })
    expect(a.id).not.toBe(b.id)
  })

  it('accepts a custom color', () => {
    expect(createStickyNote({ x: 0, y: 0 }, 1, 'purple').data.color).toBe('purple')
  })
})

describe('createTextCard / createNode', () => {
  it('creates a larger text card', () => {
    const card = createTextCard({ x: 0, y: 0 }, 5)
    expect(card).toMatchObject({ type: 'text', width: NODE_SIZES.text.width, height: NODE_SIZES.text.height })
    expect(card.width).toBeGreaterThan(NODE_SIZES.sticky.width)
  })

  it('createNode dispatches by kind', () => {
    expect(createNode('sticky', { x: 0, y: 0 }, 1).type).toBe('sticky')
    expect(createNode('text', { x: 0, y: 0 }, 1).type).toBe('text')
    expect(createNode('link', { x: 0, y: 0 }, 1).type).toBe('link')
    expect(createNode('group', { x: 0, y: 0 }, 1).type).toBe('group')
  })
})

describe('createLinkCard / createGroup / createImageCard', () => {
  it('creates an empty link card', () => {
    const card = createLinkCard({ x: 0, y: 0 }, 7)
    expect(card.data).toEqual({ url: '', title: '', description: '', tags: [], createdAt: 7, updatedAt: 7 })
  })

  it('creates a group that can only be dragged by its title bar', () => {
    const group = createGroup({ x: 0, y: 0 }, 7)
    expect(group.dragHandle).toBe('.group-drag-handle')
    expect(group.data.label).toBe('')
    expect(group.width).toBe(NODE_SIZES.group.width)
  })

  it('stores no height for images (the height follows the aspect ratio)', () => {
    const image = createImageCard({ x: 100, y: 100 }, 1, {
      imageId: 'img-1',
      fileName: 'a.png',
      naturalWidth: 800,
      naturalHeight: 400,
      width: 280,
    })
    expect(image.width).toBe(280)
    expect(image.height).toBeUndefined()
    // مركز البطاقة عند النقطة المطلوبة: الارتفاع المقدَّر = 280 * 400 / 800 = 140
    expect(image.position).toEqual({ x: 100 - 140, y: 100 - 70 })
    expect(image.data).toMatchObject({ imageId: 'img-1', naturalWidth: 800, naturalHeight: 400 })
  })
})

describe('duplicateNodes', () => {
  const sticky = { ...createStickyNote({ x: 100, y: 100 }, 1, 'green'), selected: false, dragging: true }
  const text = createTextCard({ x: 400, y: 100 }, 1)

  it('creates new ids, offsets position, selects copies, and keeps content', () => {
    sticky.data.tags = ['a']
    const { nodes: copies } = duplicateNodes([sticky, text], [sticky, text], [], 999, 20)
    expect(copies).toHaveLength(2)
    expect(copies.map((c) => c.id)).not.toContain(sticky.id)
    expect(copies[0]?.position).toEqual({ x: sticky.position.x + 20, y: sticky.position.y + 20 })
    expect(copies.every((c) => c.selected)).toBe(true)
    expect(copies[0]?.type === 'sticky' && copies[0].data.color).toBe('green')
  })

  it('stamps fresh timestamps and does not carry over transient React Flow state', () => {
    const [copy] = duplicateNodes([sticky], [sticky], [], 999).nodes
    expect(copy?.data.createdAt).toBe(999)
    expect(copy?.data.updatedAt).toBe(999)
    expect(copy).not.toHaveProperty('dragging')
  })

  it('does not share the tags array with the original', () => {
    const [copy] = duplicateNodes([sticky], [sticky], [], 1).nodes
    copy?.data.tags.push('b')
    expect(sticky.data.tags).toEqual(['a'])
  })

  it('copies the edges whose two ends are both duplicated, and only those', () => {
    const a = createStickyNote({ x: 0, y: 0 }, 1)
    const b = createStickyNote({ x: 300, y: 0 }, 1)
    const outside = createStickyNote({ x: 600, y: 0 }, 1)
    const inner = createEdge(a.id, b.id, 'right', 'left', { label: 'x' })
    const crossing = createEdge(b.id, outside.id, 'right', 'left')
    const { nodes, edges } = duplicateNodes([a, b], [a, b, outside], [inner, crossing], 1)
    expect(edges).toHaveLength(1)
    expect(edges[0]?.id).not.toBe(inner.id)
    expect(edges[0]?.data?.label).toBe('x')
    expect(edges[0]?.source).toBe(nodes[0]?.id)
    expect(edges[0]?.target).toBe(nodes[1]?.id)
  })

  it('duplicating a group also duplicates its members and attaches them to the new group', () => {
    const group = { ...createGroup({ x: 0, y: 0 }, 1), id: 'g' }
    const member = { ...createStickyNote({ x: 0, y: 0 }, 1), id: 'm', parentId: 'g', position: { x: 30, y: 50 } }
    const { nodes } = duplicateNodes([group], [group, member], [], 1, 20)
    expect(nodes).toHaveLength(2)
    const [newGroup, newMember] = nodes
    expect(newGroup?.type).toBe('group') // المجموعات أولاً
    expect(newMember?.parentId).toBe(newGroup?.id)
    expect(newMember?.position).toEqual({ x: 30, y: 50 }) // نسبي: لا يتغير
    expect(newGroup?.position).toEqual({ x: group.position.x + 20, y: group.position.y + 20 })
  })

  it('a member duplicated without its group stays in the same group', () => {
    const group = { ...createGroup({ x: 0, y: 0 }, 1), id: 'g' }
    const member = { ...createStickyNote({ x: 0, y: 0 }, 1), id: 'm', parentId: 'g', position: { x: 30, y: 50 } }
    const { nodes } = duplicateNodes([member], [group, member], [], 1, 20)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.parentId).toBe('g')
    expect(nodes[0]?.position).toEqual({ x: 50, y: 70 })
  })
})


describe('createChecklist', () => {
  it('starts empty and centered, and createNode builds one', () => {
    const list = createChecklist({ x: 500, y: 300 }, 7)
    const { width, height } = NODE_SIZES.checklist
    expect(list).toMatchObject({ type: 'checklist', width, height, data: { title: '', items: [], tags: [], createdAt: 7, updatedAt: 7 } })
    expect(list.position).toEqual({ x: Math.round(500 - width / 2), y: Math.round(300 - height / 2) })
    expect(createNode('checklist', { x: 0, y: 0 }, 1).type).toBe('checklist')
  })
})

describe('duplicateNodes with the new card features', () => {
  it('copies checklist items deeply so editing the copy never touches the original', () => {
    const original = { ...createChecklist({ x: 0, y: 0 }, 1), id: 'c' }
    original.data = { ...original.data, items: [{ id: 'a', text: 'one', done: true }] }
    const { nodes } = duplicateNodes([original], [original], [], 5)
    const copy = nodes[0]
    expect(copy?.type === 'checklist' && copy.data.items).toEqual([{ id: 'a', text: 'one', done: true }])
    expect(copy?.type === 'checklist' && copy.data.items[0]).not.toBe(original.data.items[0])
  })

  it('a duplicate of a locked card is locked in data and in behavior (not draggable or deletable)', () => {
    const locked = withLocked({ ...createStickyNote({ x: 0, y: 0 }, 1), id: 'l' }, true, 2)
    const { nodes } = duplicateNodes([locked], [locked], [], 5)
    expect(nodes[0]?.data.locked).toBe(true)
    expect(nodes[0]?.draggable).toBe(false)
    expect(nodes[0]?.deletable).toBe(false)
  })

  it('keeps the status of the card but gives the copy fresh timestamps', () => {
    const done = withStatus({ ...createStickyNote({ x: 0, y: 0 }, 1), id: 's' }, 'done', 2)
    const { nodes } = duplicateNodes([done], [done], [], 99)
    expect(nodes[0]?.data.status).toBe('done')
    expect(nodes[0]?.data.createdAt).toBe(99)
  })
})

describe('createShape', () => {
  it('creates a centered neutral rectangle by default, and createNode builds one', () => {
    const shape = createShape({ x: 400, y: 200 }, 3)
    const { width, height } = NODE_SIZES.shape
    expect(shape).toMatchObject({ type: 'shape', width, height, data: { shape: 'rectangle', label: '', color: 'neutral', tags: [] } })
    expect(shape.position).toEqual({ x: Math.round(400 - width / 2), y: Math.round(200 - height / 2) })
    expect(createNode('shape', { x: 0, y: 0 }, 1).type).toBe('shape')
  })

  it('duplicates keep the kind and text', () => {
    const original = { ...createShape({ x: 0, y: 0 }, 1, 'ellipse', 'red'), id: 's' }
    original.data = { ...original.data, label: 'Hi' }
    const { nodes } = duplicateNodes([original], [original], [], 9)
    expect(nodes[0]?.type === 'shape' && nodes[0].data).toMatchObject({ shape: 'ellipse', label: 'Hi', color: 'red' })
  })
})

describe('createVideo', () => {
  it('starts empty and centered, and createNode builds one', () => {
    const video = createVideo({ x: 400, y: 300 }, 4)
    const { width, height } = NODE_SIZES.video
    expect(video).toMatchObject({ type: 'video', width, height, data: { url: '', title: '', tags: [], createdAt: 4, updatedAt: 4 } })
    expect(video.position).toEqual({ x: Math.round(400 - width / 2), y: Math.round(300 - height / 2) })
    expect(createNode('video', { x: 0, y: 0 }, 1).type).toBe('video')
  })
})
