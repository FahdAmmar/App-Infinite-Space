import { useEffect, useMemo, useRef, useState } from 'react'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'
import type { CanvasCommands } from '../hooks/useCanvasCommands'
import { findMatches } from '../utils/find'
import { FindBarView } from './FindBarView'

function FindBarOpen({ commands }: { commands: CanvasCommands }) {
  const api = useCanvasStoreApi()
  const nodes = useCanvasStore((state) => state.nodes)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)

  const matches = useMemo(() => findMatches(nodes, query), [nodes, query])
  // قد تتقلص النتائج (حذف بطاقة أثناء البحث) فيجب ألا يشير المؤشر خارجها
  const current = matches.length === 0 ? 0 : Math.min(index, matches.length - 1)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const goTo = (next: number) => {
    if (matches.length === 0) return
    const wrapped = (next + matches.length) % matches.length
    setIndex(wrapped)
    const id = matches[wrapped]
    if (id) commands.focusNode(id)
  }

  const handleQueryChange = (value: string) => {
    setQuery(value)
    setIndex(0)
    // نقفز إلى أول نتيجة أثناء الكتابة كي يرى المستخدم أثر بحثه فوراً
    const first = findMatches(nodes, value)[0]
    if (first) commands.focusNode(first)
  }

  return (
    <FindBarView
      query={query}
      position={matches.length === 0 ? 0 : current + 1}
      total={matches.length}
      inputRef={inputRef}
      onQueryChange={handleQueryChange}
      onNext={() => goTo(current + 1)}
      onPrevious={() => goTo(current - 1)}
      onClose={() => api.getState().setFindOpen(false)}
    />
  )
}

/** شريط البحث على اللوحة: لا يُركَّب (ولا يحسب شيئاً) إلا وهو مفتوح. */
export function FindBar({ commands }: { commands: CanvasCommands }) {
  const open = useCanvasStore((state) => state.findOpen)
  return open ? <FindBarOpen commands={commands} /> : null
}
