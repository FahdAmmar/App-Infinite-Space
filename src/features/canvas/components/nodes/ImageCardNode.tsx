import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { ImageIcon, ImageOff, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useCanvasStoreApi } from '@/stores/canvas-store-context'
import { useImageUrl } from '../../hooks/useImageUrl'
import type { ImageCard } from '../../types/nodes'
import { NodeFrame } from './NodeFrame'
import { TagChips } from './TagChips'

/**
 * بطاقة صورة. ارتفاعها لا يُخزَّن: aspect-ratio في CSS يشتقه من العرض والأبعاد الأصلية،
 * فيبقى تناسب الصورة محفوظاً مهما غيّر المستخدم العرض، ويقيس React Flow الارتفاع الناتج تلقائياً.
 * النقر المزدوج (أو زر التكبير) يفتح معاينة كبيرة؛ العنوان والوصف والوسوم تُحرَّر من لوحة الخصائص.
 */
function ImageCardNodeImpl({ id, data, selected }: NodeProps<ImageCard>) {
  const api = useCanvasStoreApi()
  const image = useImageUrl(data.imageId)
  const label = data.title !== '' ? data.title : 'Image'
  const hasFooter = data.description !== '' || data.tags.length > 0
  const appearance = data.appearance ?? 'card'

  const openPreview = () => {
    if (api.getState().tool !== 'hand') api.getState().setPreviewNode(id)
  }

  const picture = (
    <>
      {image.status === 'ready' && (
        <img
          src={image.url}
          alt={data.description !== '' ? data.description : label}
          draggable={false}
          className={cn('size-full select-none', appearance === 'frameless' ? 'object-contain' : 'object-cover')}
        />
      )}
      {image.status === 'loading' && <div aria-hidden="true" className="size-full animate-pulse bg-raised" />}
      {image.status === 'missing' && (
        <div role="img" aria-label="Image unavailable" className="grid size-full place-items-center p-3 text-center text-xs text-muted">
          <span>
            <ImageOff className="mx-auto mb-1.5 size-5" aria-hidden="true" />
            Image unavailable. Select it and use Replace image.
          </span>
        </div>
      )}
    </>
  )

  // «ملصق»: الصورة وحدها بلا إطار ولا نص (تظهر شفافية PNG كما هي، مع ظل يتبع حدود الصورة)
  if (appearance === 'frameless') {
    return (
      <NodeFrame id={id} type="image" selected={selected} status={data.status ?? 'none'} locked={data.locked === true}>
        <div
          onDoubleClick={openPreview}
          style={{ aspectRatio: `${data.naturalWidth} / ${data.naturalHeight}` }}
          className={cn('image-frameless relative w-full', selected && 'image-frameless-selected')}
        >
          {picture}
        </div>
      </NodeFrame>
    )
  }

  // «غلاف»: الصورة تملأ البطاقة والعنوان والوصف فوقها على تدرج داكن يضمن قراءة النص
  if (appearance === 'cover') {
    return (
      <NodeFrame id={id} type="image" selected={selected} status={data.status ?? 'none'} locked={data.locked === true}>
        <div
          onDoubleClick={openPreview}
          style={{ aspectRatio: `${data.naturalWidth} / ${data.naturalHeight}` }}
          className={cn('card-node relative w-full overflow-hidden', selected && 'card-node-selected')}
        >
          {picture}
          {(data.title !== '' || data.description !== '') && (
            <div className="image-cover-caption pointer-events-none absolute inset-x-0 bottom-0 space-y-0.5 px-3.5 pt-8 pb-3 text-white">
              {data.title !== '' && (
                <p dir="auto" className="text-[0.95rem] leading-snug font-semibold break-words">
                  {data.title}
                </p>
              )}
              {data.description !== '' && (
                <p dir="auto" className="line-clamp-2 text-[0.8rem] leading-snug break-words text-white/85">
                  {data.description}
                </p>
              )}
            </div>
          )}
        </div>
      </NodeFrame>
    )
  }

  return (
    <NodeFrame id={id} type="image" selected={selected} status={data.status ?? 'none'} locked={data.locked === true}>
      <div
        onDoubleClick={openPreview}
        className={cn('card-node flex w-full flex-col overflow-hidden text-ink', selected && 'card-node-selected')}
      >
        <div className="flex items-center gap-2 px-3.5 pt-3 pb-2 text-xs font-medium text-muted">
          <ImageIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span dir="auto" className="min-w-0 flex-1 truncate">
            {label}
          </span>
          <button
            type="button"
            data-compact
            aria-label="Open larger preview"
            title="Open larger preview"
            onClick={openPreview}
            className="nodrag nopan grid size-6 shrink-0 place-items-center rounded-md transition-colors hover:bg-raised hover:text-ink"
          >
            <Maximize2 className="size-3.5" aria-hidden="true" />
          </button>
        </div>

        <div
          style={{ aspectRatio: `${data.naturalWidth} / ${data.naturalHeight}` }}
          className="relative mx-2.5 mb-2.5 overflow-hidden rounded-xl bg-bg"
        >
          {picture}
        </div>

        {hasFooter && (
          <div className="space-y-2 px-3.5 pb-3">
            {data.description !== '' && (
              <p dir="auto" className="line-clamp-3 text-[0.85rem] leading-relaxed break-words text-ink/80">
                {data.description}
              </p>
            )}
            <TagChips tags={data.tags} />
          </div>
        )}
      </div>
    </NodeFrame>
  )
}

export const ImageCardNode = memo(ImageCardNodeImpl)
