import type { WorkspaceColorId, WorkspaceIconId } from '../types/workspace'

/** «blank» هو السلوك القديم: لوحة فارغة. البقية قوالب جاهزة تُبنى في build-template.ts. */
export const TEMPLATE_IDS = ['blank', 'mind-map', 'kanban', 'swot', 'retrospective', 'roadmap'] as const
export type TemplateId = (typeof TEMPLATE_IDS)[number]

export interface TemplateInfo {
  id: TemplateId
  label: string
  /** سطر يشرح لمن يصلح القالب */
  blurb: string
  /** اسم مقترح للمساحة، يملأ الحقل إن لم يكتب المستخدم شيئاً */
  suggestedName: string
  color: WorkspaceColorId
  icon: WorkspaceIconId
}

/**
 * وصف القوالب فقط (بلا بطاقات): الحوار يستورد هذا الملف الخفيف، أما بناء البطاقات فلا يُحمَّل إلا عند الإنشاء.
 * ألوان وأيقونات المساحة مقترحة لا مفروضة: يغيّرها المستخدم قبل الإنشاء.
 */
export const TEMPLATES: readonly TemplateInfo[] = [
  { id: 'blank', label: 'Blank', blurb: 'An empty canvas.', suggestedName: '', color: 'lapis', icon: 'sparkles' },
  { id: 'mind-map', label: 'Mind map', blurb: 'One idea branching into four.', suggestedName: 'Mind map', color: 'violet', icon: 'network' },
  { id: 'kanban', label: 'Kanban', blurb: 'To do, doing, done.', suggestedName: 'Project board', color: 'lapis', icon: 'folder-kanban' },
  { id: 'swot', label: 'SWOT', blurb: 'Strengths, weaknesses, opportunities, threats.', suggestedName: 'SWOT analysis', color: 'moss', icon: 'compass' },
  { id: 'retrospective', label: 'Retrospective', blurb: 'What went well, what to improve, next actions.', suggestedName: 'Retrospective', color: 'rose', icon: 'lightbulb' },
  { id: 'roadmap', label: 'Roadmap', blurb: 'Now, next, later, and a parking lot for ideas.', suggestedName: 'Roadmap', color: 'saffron', icon: 'rocket' },
]

export function getTemplate(id: TemplateId): TemplateInfo {
  return TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[0]!
}
