import { HybridStorageAdapter } from '@/services/persistence/hybrid-storage-adapter'
import { MemoryCanvasStore } from '@/services/persistence/indexed-db-canvas-store'
import { MemoryImageStorage } from '@/services/persistence/image-storage'
import { LocalStorageAdapter } from '@/services/persistence/local-storage-adapter'
import type { KeyValueStore } from '@/services/persistence/storage-adapter'

/** أدوات مشتركة لاختبارات النقل: بيانات صغيرة صالحة بالشكل المخزَّن، ومخازن بالذاكرة. */

class Kv implements KeyValueStore {
  data = new Map<string, string>()
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
  removeItem(key: string): void {
    this.data.delete(key)
  }
}

export const baseData = { tags: ['a'], createdAt: 1, updatedAt: 1 }

export const stickyNode = (id: string, content = 'Hello') => ({
  id,
  type: 'sticky',
  position: { x: 10, y: 20 },
  width: 240,
  height: 160,
  data: { ...baseData, title: 'T', content, color: 'yellow', textColor: null },
})

export const imageNode = (id: string, imageId: string) => ({
  id,
  type: 'image',
  position: { x: 300, y: 20 },
  width: 280,
  data: { ...baseData, imageId, title: '', description: '', fileName: 'pic.png', naturalWidth: 100, naturalHeight: 50 },
})

export const linkNode = (id: string, url: string) => ({
  id,
  type: 'link',
  position: { x: 0, y: 300 },
  width: 260,
  height: 120,
  data: { ...baseData, url, title: 'L', description: '' },
})

export const edge = (id: string, source: string, target: string) => ({
  id,
  source,
  target,
  sourceHandle: 'right',
  targetHandle: 'left',
  data: { curve: 'curved', lineStyle: 'solid', arrow: 'end', color: 'gradient', label: '' },
})

export const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3])
export const pngBlob = (): Blob => new Blob([PNG_BYTES], { type: 'image/png' })

export function createMemoryBackend() {
  const kv = new Kv()
  const canvases = new MemoryCanvasStore()
  const images = new MemoryImageStorage()
  const storage = new HybridStorageAdapter(new LocalStorageAdapter(kv), canvases)
  return { kv, canvases, images, storage }
}
