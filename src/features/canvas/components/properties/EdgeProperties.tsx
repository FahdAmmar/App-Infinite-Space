import { ArrowLeft, ArrowLeftRight, ArrowRight, CornerDownRight, Minus, Spline, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useCanvasStoreApi } from '@/stores/canvas-store-context'
import type { CanvasEdge } from '../../types/edges'
import { EDGE_COLOR_IDS } from '../../types/edges'
import { EDGE_COLORS, EDGE_LABEL_MAX_LENGTH } from '../../utils/constants'
import { ColorSwatches, CommitField, PanelSection, Segmented } from './controls'

const SWATCHES = EDGE_COLOR_IDS.map((id) => ({
  id,
  label: EDGE_COLORS[id].label,
  background: id === 'gradient' ? `linear-gradient(135deg, ${EDGE_COLORS[id].from}, ${EDGE_COLORS[id].to})` : EDGE_COLORS[id].from,
}))

/** خصائص وصلة محددة (مواصفات 5): الشكل، نمط الخط، الاتجاه، اللون، التسمية. */
export function EdgeProperties({ edge, onDelete }: { edge: CanvasEdge; onDelete: () => void }) {
  const api = useCanvasStoreApi()
  const data = edge.data
  if (!data) return null
  const update = (patch: Partial<typeof data>) => api.getState().updateEdge(edge.id, patch)

  return (
    <>
      <PanelSection title="Label">
        <CommitField label="Connection label" value={data.label} maxLength={EDGE_LABEL_MAX_LENGTH} placeholder="e.g. leads to, depends on" onCommit={(label) => update({ label })} />
      </PanelSection>
      <PanelSection title="Line">
        <p className="text-xs text-muted">Shape</p>
        <Segmented
          label="Line shape"
          value={data.curve}
          onChange={(curve) => update({ curve })}
          options={[
            { id: 'curved', label: 'Curved', icon: Spline },
            { id: 'straight', label: 'Straight', icon: Minus },
            { id: 'step', label: 'Stepped', icon: CornerDownRight },
          ]}
        />
        <p className="pt-1 text-xs text-muted">Style</p>
        <Segmented
          label="Line style"
          value={data.lineStyle}
          onChange={(lineStyle) => update({ lineStyle })}
          options={[
            { id: 'solid', label: 'Solid' },
            { id: 'dashed', label: 'Dashed' },
            { id: 'dotted', label: 'Dotted' },
          ]}
        />
        <p className="pt-1 text-xs text-muted">Arrows</p>
        <Segmented
          label="Arrow direction"
          value={data.arrow}
          onChange={(arrow) => update({ arrow })}
          options={[
            { id: 'none', label: 'No arrows', icon: Minus },
            { id: 'end', label: 'Arrow at the end', icon: ArrowRight },
            { id: 'start', label: 'Arrow at the start', icon: ArrowLeft },
            { id: 'both', label: 'Arrows at both ends', icon: ArrowLeftRight },
          ]}
        />
      </PanelSection>
      <PanelSection title="Color">
        <ColorSwatches label="Line color" options={SWATCHES} value={data.color} onChange={(color) => update({ color })} />
      </PanelSection>
      <PanelSection title="Actions">
        <Button variant="secondary" size="sm" onClick={onDelete} className="hover:text-danger">
          <Trash2 className="size-4" aria-hidden="true" />
          Delete connection
        </Button>
      </PanelSection>
    </>
  )
}
