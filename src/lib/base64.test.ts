import { describe, expect, it } from 'vitest'
import { base64DecodedLength, base64ToBlob, blobToBase64, isBase64 } from './base64'

describe('base64 helpers', () => {
  it('round-trips binary data, including bytes above 127', async () => {
    const bytes = new Uint8Array([0, 1, 2, 127, 128, 200, 255])
    const encoded = await blobToBase64(new Blob([bytes], { type: 'image/png' }))
    const decoded = base64ToBlob(encoded, 'image/png')
    expect(decoded.type).toBe('image/png')
    expect(new Uint8Array(await decoded.arrayBuffer())).toEqual(bytes)
  })

  it('encodes an empty blob as an empty string', async () => {
    expect(await blobToBase64(new Blob([]))).toBe('')
  })

  it.each(['', 'QUJD', 'QUI=', 'QQ=='])('accepts the well-formed value "%s"', (value) => {
    expect(isBase64(value)).toBe(true)
  })

  it.each(['QUJ', 'QU=B', 'QUJD!', 'data:image/png;base64,QUJD', 'QU JD', '=QUJ', 'QQ==='])('rejects the malformed value "%s"', (value) => {
    expect(isBase64(value)).toBe(false)
  })

  it('computes the decoded size without decoding', () => {
    expect(base64DecodedLength('')).toBe(0)
    expect(base64DecodedLength('QUJD')).toBe(3)
    expect(base64DecodedLength('QUI=')).toBe(2)
    expect(base64DecodedLength('QQ==')).toBe(1)
  })
})
