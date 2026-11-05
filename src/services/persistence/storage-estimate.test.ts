import { describe, expect, it } from 'vitest'
import { classifyUsage, describeStorageWarning, readStorageEstimate, requestPersistentStorage } from './storage-estimate'

describe('classifyUsage', () => {
  it.each([
    [0, 'ok'],
    [0.79, 'ok'],
    [0.8, 'warning'],
    [0.94, 'warning'],
    [0.95, 'critical'],
    [1, 'critical'],
  ] as const)('classifies %d as %s', (ratio, level) => {
    expect(classifyUsage(ratio)).toBe(level)
  })
})

describe('readStorageEstimate', () => {
  it('reports usage, quota, level and persistence', async () => {
    const result = await readStorageEstimate({
      estimate: () => Promise.resolve({ usage: 850, quota: 1000 }),
      persisted: () => Promise.resolve(true),
    })
    expect(result).toEqual({ supported: true, usage: 850, quota: 1000, ratio: 0.85, level: 'warning', persisted: true })
  })

  it('is unsupported without a manager or without estimate()', async () => {
    expect(await readStorageEstimate(undefined)).toEqual({ supported: false })
    expect(await readStorageEstimate({})).toEqual({ supported: false })
  })

  it('is unsupported when the numbers are missing or nonsense', async () => {
    expect(await readStorageEstimate({ estimate: () => Promise.resolve({}) })).toEqual({ supported: false })
    expect(await readStorageEstimate({ estimate: () => Promise.resolve({ usage: 5, quota: 0 }) })).toEqual({ supported: false })
    expect(await readStorageEstimate({ estimate: () => Promise.resolve({ usage: Number.NaN, quota: 10 }) })).toEqual({ supported: false })
  })

  it('is unsupported when estimate() rejects, and persisted stays unknown when it rejects', async () => {
    expect(await readStorageEstimate({ estimate: () => Promise.reject(new Error('blocked')) })).toEqual({ supported: false })
    const result = await readStorageEstimate({
      estimate: () => Promise.resolve({ usage: 1, quota: 100 }),
      persisted: () => Promise.reject(new Error('nope')),
    })
    expect(result).toMatchObject({ supported: true, persisted: null })
  })

  it('caps the ratio at 1 when usage exceeds the quota', async () => {
    const result = await readStorageEstimate({ estimate: () => Promise.resolve({ usage: 2000, quota: 1000 }) })
    expect(result).toMatchObject({ ratio: 1, level: 'critical' })
  })
})

describe('requestPersistentStorage', () => {
  it('returns what the browser decided', async () => {
    expect(await requestPersistentStorage({ persist: () => Promise.resolve(true) })).toBe('granted')
    expect(await requestPersistentStorage({ persist: () => Promise.resolve(false) })).toBe('denied')
  })

  it('treats a throwing request as denied and a missing API as unsupported', async () => {
    expect(await requestPersistentStorage({ persist: () => Promise.reject(new Error('x')) })).toBe('denied')
    expect(await requestPersistentStorage({})).toBe('unsupported')
    expect(await requestPersistentStorage(undefined)).toBe('unsupported')
  })
})

describe('describeStorageWarning', () => {
  it('stays silent while there is room', () => {
    expect(describeStorageWarning('ok', 0.3)).toBeNull()
  })

  it('mentions the rounded percentage and a next step', () => {
    expect(describeStorageWarning('warning', 0.854)).toMatch(/85% full.*Export/)
    expect(describeStorageWarning('critical', 0.966)).toMatch(/97% full.*may fail to save/)
  })
})
