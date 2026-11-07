import { describe, expect, it } from 'vitest'
import { renderServiceWorker, selectPrecache } from './build-sw'

describe('selectPrecache', () => {
  it('turns build files into absolute urls, sorted and without duplicates', () => {
    expect(selectPrecache(['index.html', 'assets/b.js', 'assets/a.js', 'assets/a.js'])).toEqual(['/assets/a.js', '/assets/b.js', '/index.html'])
  })

  it('skips the decorative Three.js chunk, source maps, legacy woff fonts and sw.js itself', () => {
    const files = ['assets/createBackgroundScene-AbC123.js', 'assets/index-1.js.map', 'assets/font.woff', 'assets/font.woff2', 'sw.js', 'assets/index-1.js']
    expect(selectPrecache(files)).toEqual(['/assets/font.woff2', '/assets/index-1.js'])
  })

  it('normalises Windows separators', () => {
    expect(selectPrecache(['assets\\x.js', 'icons\\icon-192.png'])).toEqual(['/assets/x.js', '/icons/icon-192.png'])
  })
})

describe('renderServiceWorker', () => {
  const template = "const BUILD_ID = '__BUILD_ID__'\nconst PRECACHE = JSON.parse('__PRECACHE__')\n"

  it('injects the id and a list that survives JSON.parse', () => {
    const output = renderServiceWorker(template, ['/index.html', "/it's.js"], 'abc123')
    expect(output).toContain("const BUILD_ID = 'abc123'")
    const literal = /JSON\.parse\('(.*)'\)/.exec(output)?.[1] ?? ''
    expect(JSON.parse(new Function(`return '${literal}'`)() as string)).toEqual(['/index.html', "/it's.js"])
  })

  it('refuses a template without its placeholders instead of shipping a broken worker', () => {
    expect(() => renderServiceWorker('self.addEventListener()', [], 'x')).toThrow(/placeholders/)
  })
})
