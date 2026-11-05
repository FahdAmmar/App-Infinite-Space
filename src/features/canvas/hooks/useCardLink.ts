import { useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { useReactFlow } from '@xyflow/react'
import { useCanvasStoreApi } from '@/stores/canvas-store-context'
import { useUiStore } from '@/stores/ui-store'
import { CARD_PARAM, parseCardParam } from '../utils/card-link'
import type { CanvasCommands } from './useCanvasCommands'

/**
 * يفتح المساحة عند بطاقة محددة إن كان في الرابط `?card=`: يحدد البطاقة ويحرّك العرض إليها،
 * أو يخبر المستخدم أنها لم تعد موجودة. ثم يمسح المعامل من العنوان كي لا يتكرر القفز عند إعادة التحميل.
 * يُنفَّذ مرة واحدة لكل فتح، بعد أن يصبح العرض جاهزاً (قبلها لا يعرف React Flow أين يذهب).
 */
export function useCardLink(commands: CanvasCommands): void {
  const api = useCanvasStoreApi()
  const { viewportInitialized } = useReactFlow()
  const [params, setParams] = useSearchParams()
  const raw = params.get(CARD_PARAM)
  const wanted = parseCardParam(raw)
  const handled = useRef(false)

  const stripParam = useCallback(() => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.delete(CARD_PARAM)
        return next
      },
      { replace: true },
    )
  }, [setParams])

  // معامل غير صالح (رابط معدَّل يدوياً): نمسحه بصمت دون أي رسالة ولا حركة
  useEffect(() => {
    if (raw !== null && wanted === null) stripParam()
  }, [raw, wanted, stripParam])

  useEffect(() => {
    if (wanted === null || handled.current || !viewportInitialized) return
    handled.current = true
    // دورة واحدة بعد أن صار العرض جاهزاً: يقيس React Flow البطاقات قبل أن نطلب منه التمركز عليها
    const timer = window.setTimeout(() => {
      if (api.getState().nodes.some((node) => node.id === wanted)) commands.focusNode(wanted)
      else useUiStore.getState().pushToast('info', 'That card is no longer in this workspace.')
      stripParam()
    }, 60)
    return () => {
      window.clearTimeout(timer)
      handled.current = false
    }
  }, [wanted, viewportInitialized, api, commands, stripParam])
}
