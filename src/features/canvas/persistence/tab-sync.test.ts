import { describe, expect, it, vi } from 'vitest'
import { createTabSync, type ChannelLike } from './tab-sync'

/** ناقل بالذاكرة يحاكي BroadcastChannel: الرسالة تصل لكل القنوات الأخرى لا لمرسلتها. */
function createBus() {
  const channels = new Set<FakeChannel>()
  class FakeChannel implements ChannelLike {
    handler: ((data: unknown) => void) | null = null
    closed = false
    constructor() {
      channels.add(this)
    }
    postMessage(message: unknown): void {
      if (this.closed) throw new Error('closed')
      for (const other of channels) if (other !== this && !other.closed) other.handler?.(message)
    }
    listen(handler: ((data: unknown) => void) | null): void {
      this.handler = handler
    }
    close(): void {
      this.closed = true
      channels.delete(this)
    }
  }
  return { create: () => new FakeChannel(), channels }
}

describe('createTabSync', () => {
  it('tells other tabs on the same workspace, but not itself', () => {
    const bus = createBus()
    const onA = vi.fn()
    const onB = vi.fn()
    const a = createTabSync({ workspaceId: 'w', onExternalSave: onA, createChannel: bus.create })
    createTabSync({ workspaceId: 'w', onExternalSave: onB, createChannel: bus.create })

    a.announceSaved()
    expect(onB).toHaveBeenCalledOnce()
    expect(onA).not.toHaveBeenCalled()
  })

  it('ignores saves of other workspaces', () => {
    const bus = createBus()
    const onB = vi.fn()
    const a = createTabSync({ workspaceId: 'one', onExternalSave: vi.fn(), createChannel: bus.create })
    createTabSync({ workspaceId: 'two', onExternalSave: onB, createChannel: bus.create })
    a.announceSaved()
    expect(onB).not.toHaveBeenCalled()
  })

  it('ignores a message that came from a tab with the same id (its own echo)', () => {
    const bus = createBus()
    const onB = vi.fn()
    const a = createTabSync({ workspaceId: 'w', tabId: 'same', onExternalSave: vi.fn(), createChannel: bus.create })
    createTabSync({ workspaceId: 'w', tabId: 'same', onExternalSave: onB, createChannel: bus.create })
    a.announceSaved()
    expect(onB).not.toHaveBeenCalled()
  })

  it.each([null, 'saved', 42, {}, { type: 'saved' }, { type: 'saved', workspaceId: 'w' }, { type: 'other', workspaceId: 'w', tabId: 'x' }])(
    'ignores the malformed message %j',
    (data) => {
      const bus = createBus()
      const onB = vi.fn()
      const sender = bus.create()
      createTabSync({ workspaceId: 'w', onExternalSave: onB, createChannel: () => bus.create() })
      sender.postMessage(data)
      expect(onB).not.toHaveBeenCalled()
    },
  )

  it('stops listening and closes the channel on dispose, and a late announce is harmless', () => {
    const bus = createBus()
    const onB = vi.fn()
    const a = createTabSync({ workspaceId: 'w', onExternalSave: vi.fn(), createChannel: bus.create })
    const b = createTabSync({ workspaceId: 'w', onExternalSave: onB, createChannel: bus.create })
    b.dispose()
    a.announceSaved()
    expect(onB).not.toHaveBeenCalled()
    expect(bus.channels.size).toBe(1)
    a.dispose()
    expect(() => a.announceSaved()).not.toThrow()
  })

  it('is inert when channels are unsupported or creating one throws', () => {
    const none = createTabSync({ workspaceId: 'w', onExternalSave: vi.fn(), createChannel: () => null })
    expect(() => {
      none.announceSaved()
      none.dispose()
    }).not.toThrow()
    const broken = createTabSync({
      workspaceId: 'w',
      onExternalSave: vi.fn(),
      createChannel: () => {
        throw new Error('SecurityError')
      },
    })
    expect(() => broken.announceSaved()).not.toThrow()
  })
})
