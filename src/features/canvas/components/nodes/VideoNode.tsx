import { memo, useRef, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Play, Video } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useCanvasStoreApi } from '@/stores/canvas-store-context'
import type { VideoCard } from '../../types/nodes'
import { parseYouTubeUrl, youtubeEmbedUrl } from '../../utils/video-url'
import { NodeFrame } from './NodeFrame'
import { TagChips } from './TagChips'
import { useEditingFocus } from './useEditingFocus'

/**
 * بطاقة فيديو YouTube (مراجع Kinopio وScrintal). الخصوصية أولاً: لا يُرسَل أي طلب إلى YouTube حتى ينقر المستخدم «تشغيل»؛
 * قبلها لافتة محلية بلا صورة مصغّرة خارجية. بعد النقر يُحمَّل مشغّل youtube-nocookie داخل iframe معزول (sandbox بلا
 * تنقّل أعلى أو نوافذ منبثقة). حالة «يعمل» محلية لا تُحفظ، فتُفتح اللوحة دائماً بلا اتصالات خارجية.
 */
function VideoNodeImpl({ id, data, selected }: NodeProps<VideoCard>) {
  const api = useCanvasStoreApi()
  const input = useRef<HTMLInputElement>(null)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')
  const video = parseYouTubeUrl(data.url)
  // بطاقة فيها فيديو لا حقل فيها ليُركَّز عليه: «تحرير» (F2 أو الإنشاء) يُحرَّر فوراً
  const { isEditing, onBlur } = useEditingFocus(id, input, video === null)
  const embed = video && playing ? youtubeEmbedUrl(video.videoId) : null
  const label = data.title !== '' ? data.title : 'YouTube video'

  const commitUrl = () => {
    const value = input.current?.value ?? ''
    if (value.trim() === '') return setError('')
    const parsed = parseYouTubeUrl(value)
    if (!parsed) return setError('Enter a YouTube link (youtube.com or youtu.be).')
    setError('')
    api.getState().updateNodeData(id, 'video', { url: parsed.url })
  }

  return (
    <NodeFrame id={id} type="video" selected={selected} editing={isEditing} status={data.status ?? 'none'} locked={data.locked === true}>
      <div onBlur={onBlur} className={cn('card-node flex h-full w-full flex-col overflow-hidden text-ink', selected && 'card-node-selected')}>
        <div className="flex shrink-0 items-center gap-2 px-3.5 pt-3 pb-2 pe-9 text-xs font-medium text-muted">
          <Video className="size-3.5 shrink-0" aria-hidden="true" />
          <span dir="auto" className="min-w-0 flex-1 truncate">{label}</span>
        </div>

        <div className="relative mx-2.5 mb-2.5 min-h-0 flex-1 overflow-hidden rounded-xl bg-black/80">
          {embed ? (
            <iframe
              src={embed}
              title={label}
              className="nodrag nopan absolute inset-0 size-full border-0"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-presentation"
            />
          ) : video ? (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label={`Play ${label} (loads from YouTube)`}
              className="nodrag nopan group absolute inset-0 grid place-items-center text-white"
            >
              <span className="grid size-14 place-items-center rounded-full bg-white/15 ring-1 ring-white/40 backdrop-blur transition-transform group-hover:scale-105 group-focus-visible:scale-105">
                <Play className="size-6 translate-x-0.5" fill="currentColor" aria-hidden="true" />
              </span>
              <span className="absolute inset-x-0 bottom-2 px-3 text-center text-[0.7rem] text-white/75">Loads from youtube.com when you press play</span>
            </button>
          ) : (
            <div className="grid size-full place-items-center p-4">
              <div className="w-full max-w-72 space-y-1.5 text-center">
                <input
                  ref={input}
                  dir="ltr"
                  inputMode="url"
                  placeholder="Paste a YouTube link"
                  aria-label="YouTube link"
                  onBlur={commitUrl}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur()
                  }}
                  className="nodrag nopan w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus-visible:border-accent"
                />
                {error !== '' && (
                  <p role="alert" className="text-xs text-danger">
                    {error}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        <TagChips tags={data.tags} className="mx-3.5 mb-2.5 shrink-0" />
      </div>
    </NodeFrame>
  )
}

export const VideoNode = memo(VideoNodeImpl)
