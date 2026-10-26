import { Dialog } from '@/components/ui/Dialog'
import { useCanvasStore, useCanvasStoreApi } from '@/stores/canvas-store-context'
import { useImageUrl } from '../hooks/useImageUrl'
import type { ImageCard } from '../types/nodes'

function PreviewBody({ node }: { node: ImageCard }) {
  const image = useImageUrl(node.data.imageId)
  const { naturalWidth, naturalHeight, description } = node.data
  return (
    <div className="space-y-3">
      <div className="grid max-h-[68dvh] place-items-center overflow-hidden rounded-2xl bg-bg">
        {image.status === 'ready' && (
          <img
            src={image.url}
            alt={description !== '' ? description : (node.data.title || node.data.fileName)}
            className="max-h-[68dvh] max-w-full object-contain"
          />
        )}
        {image.status === 'loading' && <div aria-hidden="true" className="h-64 w-full animate-pulse bg-raised" />}
        {image.status === 'missing' && <p className="p-10 text-sm text-muted">This image is no longer stored in this browser.</p>}
      </div>
      {description !== '' && (
        <p dir="auto" className="text-sm leading-relaxed text-muted">
          {description}
        </p>
      )}
      <p className="font-mono text-xs text-muted">
        {node.data.fileName} · {naturalWidth}×{naturalHeight} px
      </p>
    </div>
  )
}

/** معاينة كبيرة للصورة (مواصفات 4.2). تُفتح بالنقر المزدوج على البطاقة أو زر التكبير، وتُغلق بـ Esc. */
export function ImagePreviewDialog() {
  const api = useCanvasStoreApi()
  const node = useCanvasStore((state) => state.nodes.find((n) => n.id === state.previewNodeId))
  const image = node?.type === 'image' ? node : undefined

  return (
    <Dialog
      open={image !== undefined}
      onClose={() => api.getState().setPreviewNode(null)}
      title={image ? (image.data.title !== '' ? image.data.title : 'Image preview') : 'Image preview'}
      size="lg"
    >
      {image && <PreviewBody node={image} />}
    </Dialog>
  )
}
