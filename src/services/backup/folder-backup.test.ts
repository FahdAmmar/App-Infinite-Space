import { describe, expect, it, vi } from 'vitest'
import type { WorkspaceMeta } from '@/features/workspaces/types/workspace'
import { backupWorkspacesToFolder, hasWritePermission, requestWritePermission, type DirectoryHandleLike } from './folder-backup'

const workspace = (id: string, name: string) => ({ id, name }) as WorkspaceMeta

function fakeDirectory(options: { failOn?: string } = {}) {
  const files = new Map<string, string>()
  const directory: DirectoryHandleLike = {
    name: 'Backups',
    async getFileHandle(name) {
      return {
        async createWritable() {
          return {
            async write(data: Blob) {
              if (options.failOn && name.startsWith(options.failOn)) throw new Error('disk full')
              files.set(name, await data.text())
            },
            async close() {},
          }
        },
      }
    },
  }
  return { directory, files }
}

describe('backupWorkspacesToFolder', () => {
  it('writes one stable file per workspace, overwriting on the next run', async () => {
    const { directory, files } = fakeDirectory()
    const list = [workspace('aaaaaaaa1', 'Plan'), workspace('bbbbbbbb2', 'Notes')]
    const first = await backupWorkspacesToFolder(directory, list, async (w) => new Blob([`v1:${w.name}`]))
    expect(first).toEqual({ written: ['Plan', 'Notes'], failed: [] })
    await backupWorkspacesToFolder(directory, list, async (w) => new Blob([`v2:${w.name}`]))
    expect(files.size).toBe(2)
    expect([...files.values()].sort()).toEqual(['v2:Notes', 'v2:Plan'])
  })

  it('keeps going when one workspace fails and names the failure', async () => {
    const { directory, files } = fakeDirectory({ failOn: 'broken' })
    const result = await backupWorkspacesToFolder(
      directory,
      [workspace('aaaaaaaa1', 'Broken'), workspace('bbbbbbbb2', 'Fine')],
      async (w) => new Blob([w.name]),
    )
    expect(result).toEqual({ written: ['Fine'], failed: ['Broken'] })
    expect(files.size).toBe(1)
  })

  it('counts an export failure as that workspace failing, not the whole run', async () => {
    const { directory } = fakeDirectory()
    const exportBlob = vi.fn(async (w: WorkspaceMeta) => {
      if (w.name === 'Bad') throw new Error('unreadable')
      return new Blob(['ok'])
    })
    const result = await backupWorkspacesToFolder(directory, [workspace('aaaaaaaa1', 'Bad'), workspace('bbbbbbbb2', 'Good')], exportBlob)
    expect(result).toEqual({ written: ['Good'], failed: ['Bad'] })
  })
})

describe('permissions', () => {
  const withPermission = (state: PermissionState | 'throw') =>
    ({
      name: 'x',
      getFileHandle: vi.fn(),
      queryPermission: async () => {
        if (state === 'throw') throw new Error('revoked')
        return state
      },
      requestPermission: async () => {
        if (state === 'throw') throw new Error('revoked')
        return state
      },
    }) as unknown as DirectoryHandleLike

  it('reports granted only when the browser says so', async () => {
    expect(await hasWritePermission(withPermission('granted'))).toBe(true)
    expect(await hasWritePermission(withPermission('prompt'))).toBe(false)
    expect(await requestWritePermission(withPermission('denied'))).toBe(false)
  })

  it('treats a thrown error (revoked handle) as no permission', async () => {
    expect(await hasWritePermission(withPermission('throw'))).toBe(false)
    expect(await requestWritePermission(withPermission('throw'))).toBe(false)
  })
})
