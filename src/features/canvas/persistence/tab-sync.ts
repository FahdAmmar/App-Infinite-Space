import { createId } from '@/lib/id'

/**
 * إعلام التبويبات ببعضها عند حفظ المساحة. السبب: الحفظ التلقائي يكتب «اللوحة كلها»، فتبويبان مفتوحان على
 * المساحة نفسها يمحو أحدهما تعديلات الآخر بصمت (آخر كاتب يفوز). لا نُغيّر شكل البيانات المخزَّنة (لا رقم مراجعة):
 * يكفي أن يعرف كل تبويب أن غيره حفظ تغييراً في المحتوى بعد أن حمّل هو.
 * القناة BroadcastChannel؛ إن لم تتوفر (متصفح قديم) يعمل المحرر كما كان دون كشف.
 */

export const SYNC_CHANNEL_NAME = 'infinitespace:v1:canvas-sync'

export interface ChannelLike {
  postMessage(message: unknown): void
  close(): void
  /** يضبط معالج الرسائل الواردة (null لإزالته). واجهة مبسّطة كي لا يتعلق الاختبار بكائن MessageEvent */
  listen(handler: ((data: unknown) => void) | null): void
}

export interface TabSync {
  /** يُعلم التبويبات الأخرى بأن محتوى المساحة تغيّر وحُفظ */
  announceSaved: () => void
  dispose: () => void
}

export interface TabSyncOptions {
  workspaceId: string
  /** يُستدعى حين يحفظ تبويب آخر محتوى هذه المساحة */
  onExternalSave: () => void
  /** قابل للاستبدال في الاختبارات */
  createChannel?: () => ChannelLike | null
  tabId?: string
}

function defaultChannel(): ChannelLike | null {
  if (typeof BroadcastChannel === 'undefined') return null
  const native = new BroadcastChannel(SYNC_CHANNEL_NAME)
  return {
    postMessage: (message) => native.postMessage(message),
    close: () => native.close(),
    listen: (handler) => {
      native.onmessage = handler ? (event: MessageEvent) => handler(event.data) : null
    },
  }
}

function isSavedMessage(data: unknown): data is { type: 'saved'; workspaceId: string; tabId: string } {
  if (typeof data !== 'object' || data === null) return false
  const message = data as Record<string, unknown>
  return message.type === 'saved' && typeof message.workspaceId === 'string' && typeof message.tabId === 'string'
}

const INERT: TabSync = { announceSaved: () => undefined, dispose: () => undefined }

export function createTabSync(options: TabSyncOptions): TabSync {
  const tabId = options.tabId ?? createId()
  let channel: ChannelLike | null
  try {
    channel = (options.createChannel ?? defaultChannel)()
  } catch {
    return INERT // سياق يمنع القنوات: نكمل دون كشف
  }
  if (!channel) return INERT

  channel.listen((data) => {
    // رسائل غريبة أو من مساحة أخرى أو من هذا التبويب نفسه لا تعنينا
    if (!isSavedMessage(data)) return
    if (data.workspaceId !== options.workspaceId || data.tabId === tabId) return
    options.onExternalSave()
  })

  const active = channel
  return {
    announceSaved: () => {
      try {
        active.postMessage({ type: 'saved', workspaceId: options.workspaceId, tabId })
      } catch {
        /* القناة أُغلقت: لا شيء نفعله */
      }
    },
    dispose: () => {
      active.listen(null)
      active.close()
    },
  }
}
