import type { PreviewRect, WorkspaceIconId } from '../types/workspace'
import { PREVIEW_AREA } from '../utils/constants'
import { WorkspaceIcon } from './WorkspaceIcon'

interface WorkspacePreviewProps {
  preview: readonly PreviewRect[]
  icon: WorkspaceIconId
}

// مساحة الرسم داخل الإطار (viewBox 100×60) مع هامش حتى لا تلتصق العناصر بالحواف
const AREA_W = PREVIEW_AREA.width
const AREA_H = PREVIEW_AREA.height
const PAD_X = (100 - AREA_W) / 2
const PAD_Y = (60 - AREA_H) / 2

function PreviewShape({ rect }: { rect: PreviewRect }) {
  const x = PAD_X + rect.x * AREA_W
  const y = PAD_Y + rect.y * AREA_H
  // حد أدنى للأبعاد كي لا تختفي العقد الصغيرة جداً
  const w = Math.max(rect.w * AREA_W, 4)
  const h = Math.max(rect.h * AREA_H, 3)

  switch (rect.kind) {
    case 'group':
      return (
        <rect x={x} y={y} width={w} height={h} rx={2.5} fill="none" stroke="var(--ws)" strokeOpacity={0.7} strokeDasharray="2 1.6" strokeWidth={0.7} />
      )
    case 'image':
      return <rect x={x} y={y} width={w} height={h} rx={1.2} fill="var(--ws)" fillOpacity={0.3} stroke="var(--ws)" strokeOpacity={0.55} strokeWidth={0.5} />
    case 'link':
      return <rect x={x} y={y} width={w} height={Math.min(h, 4)} rx={2} fill="var(--ws)" fillOpacity={0.5} />
    case 'text':
      return <rect x={x} y={y} width={w} height={h} rx={1} fill="var(--c-text)" fillOpacity={0.16} />
    case 'sticky':
      return <rect x={x} y={y} width={w} height={h} rx={1.2} fill="var(--ws)" fillOpacity={0.62} />
  }
}

/**
 * معاينة مصغّرة للمساحة. تُرسم من مستطيلات مطبّعة محفوظة مع بيانات التعريف،
 * فلا نحتاج تحميل اللوحة كاملة لعرض لوحة التحكم.
 * عندما تكون المساحة فارغة نعرض أيقونتها بدل رسم فارغ.
 */
export function WorkspacePreview({ preview, icon }: WorkspacePreviewProps) {
  return (
    <div className="dot-grid absolute inset-0" aria-hidden="true">
      {preview.length === 0 ? (
        <div className="absolute inset-0 grid place-items-center">
          <WorkspaceIcon id={icon} className="ws-ink size-10 opacity-45" />
        </div>
      ) : (
        <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 size-full">
          {preview.map((rect, index) => (
            <PreviewShape key={index} rect={rect} />
          ))}
        </svg>
      )}
    </div>
  )
}
