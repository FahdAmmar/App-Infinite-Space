/** matchMedia وهمي قابل للتحكم: jsdom لا يوفّره، ونحتاج إطلاق حدث change يدوياً. */
export function installMatchMedia(initial: Record<string, boolean>) {
  const state = { ...initial }
  const listeners = new Map<string, Set<() => void>>()
  window.matchMedia = ((query: string) => ({
    get matches() {
      return state[query] ?? false
    },
    media: query,
    addEventListener: (_type: string, callback: () => void) => {
      const set = listeners.get(query) ?? new Set<() => void>()
      set.add(callback)
      listeners.set(query, set)
    },
    removeEventListener: (_type: string, callback: () => void) => {
      listeners.get(query)?.delete(callback)
    },
  })) as unknown as typeof window.matchMedia
  return {
    set(query: string, value: boolean) {
      state[query] = value
      listeners.get(query)?.forEach((callback) => callback())
    },
    listenerCount: (query: string) => listeners.get(query)?.size ?? 0,
  }
}
