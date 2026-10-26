import { describe, expect, it } from 'vitest'
import { MemoryImageStorage } from '@/services/persistence/image-storage'
import { IMAGE_LIMITS, MAX_FILES_PER_DROP } from '../utils/constants'
import { addImageFiles, intakeImageFile } from './add-image-files'

const png = (name = 'a.png', size = 100): File => new File([new Uint8Array(size)], name, { type: 'image/png' })
const readDimensions = () => Promise.resolve({ width: 800, height: 400 })

describe('intakeImageFile', () => {
  it('stores the file and returns its id and natural size', async () => {
    const storage = new MemoryImageStorage()
    const file = png('photo.png')
    const result = await intakeImageFile(file, { storage, readDimensions })
    expect(result).toMatchObject({ fileName: 'photo.png', naturalWidth: 800, naturalHeight: 400 })
    expect(await storage.load(result.imageId)).toBe(file)
  })

  it('rejects unsupported files before touching storage', async () => {
    const storage = new MemoryImageStorage()
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' })
    await expect(intakeImageFile(file, { storage, readDimensions })).rejects.toThrow(/not a supported image/)
  })

  it('reports an undecodable image with a readable message and stores nothing', async () => {
    const storage = new MemoryImageStorage()
    const failing = () => Promise.reject(new Error('decode'))
    await expect(intakeImageFile(png('broken.png'), { storage, readDimensions: failing })).rejects.toThrow(/broken\.png.*damaged/)
  })

  it('rejects images with too many pixels', async () => {
    const huge = () => Promise.resolve({ width: 30000, height: 30000 })
    await expect(intakeImageFile(png(), { storage: new MemoryImageStorage(), readDimensions: huge })).rejects.toThrow(/too large/)
  })

  it('turns a storage failure into a readable error', async () => {
    const storage = { save: () => Promise.reject(new Error('quota')), load: () => Promise.resolve(null), remove: () => Promise.resolve(), list: () => Promise.resolve([]) }
    await expect(intakeImageFile(png('a.png'), { storage, readDimensions })).rejects.toThrow(/could not be stored/)
  })
})

describe('addImageFiles', () => {
  it('creates one image card per valid file, cascading their positions', async () => {
    const deps = { storage: new MemoryImageStorage(), readDimensions }
    const { nodes, errors } = await addImageFiles([png('a.png'), png('b.png')], { x: 500, y: 500 }, 1, deps)
    expect(errors).toEqual([])
    expect(nodes).toHaveLength(2)
    expect(nodes[0]?.width).toBe(IMAGE_LIMITS.defaultWidth)
    expect(nodes[1]?.position.x).toBeGreaterThan(nodes[0]?.position.x ?? 0)
    expect(nodes[0]?.data.imageId).not.toBe(nodes[1]?.data.imageId)
  })

  it('keeps the valid files when others fail, and reports each failure', async () => {
    const deps = { storage: new MemoryImageStorage(), readDimensions }
    const bad = new File(['x'], 'notes.txt', { type: 'text/plain' })
    const { nodes, errors } = await addImageFiles([png('ok.png'), bad], { x: 0, y: 0 }, 1, deps)
    expect(nodes).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('notes.txt')
  })

  it('caps the number of files added at once and says so', async () => {
    const deps = { storage: new MemoryImageStorage(), readDimensions }
    const files = Array.from({ length: MAX_FILES_PER_DROP + 3 }, (_, i) => png(`${i}.png`))
    const { nodes, errors } = await addImageFiles(files, { x: 0, y: 0 }, 1, deps)
    expect(nodes).toHaveLength(MAX_FILES_PER_DROP)
    expect(errors.some((message) => message.includes(String(MAX_FILES_PER_DROP)))).toBe(true)
  })
})
