export interface SearchableCommand {
  id: string
  title: string
  /** كلمات إضافية تُطابق دون أن تظهر (مرادفات: picture لـ image) */
  keywords?: readonly string[]
}

/** أقل الدرجات أفضل: 0 العنوان يبدأ بالاستعلام، 1 كلمة فيه تبدأ به، 2 يحويه، 3 كلمات إضافية. null لا مطابقة. */
function scoreToken(command: SearchableCommand, token: string): number | null {
  const title = command.title.toLowerCase()
  if (title.startsWith(token)) return 0
  if (title.split(/[\s/·\-–—:]+/).some((word) => word.startsWith(token))) return 1
  if (title.includes(token)) return 2
  if (command.keywords?.some((keyword) => keyword.toLowerCase().includes(token))) return 3
  return null
}

/**
 * يرتب الأوامر حسب الاستعلام: كل كلمة فيه يجب أن تطابق (حرف أولي أو جزء أو مرادف)، وتُرتَّب النتائج بأسوأ كلمة مطابقة
 * ثم بترتيب الأصل (فلا يقفز أمر مألوف مكانه). استعلام فارغ يعيد كل الأوامر كما هي.
 */
export function filterCommands<T extends SearchableCommand>(commands: readonly T[], query: string): T[] {
  const tokens = query.toLowerCase().split(/\s+/).filter((token) => token !== '')
  if (tokens.length === 0) return [...commands]
  const scored: { command: T; score: number; order: number }[] = []
  commands.forEach((command, order) => {
    let worst = 0
    for (const token of tokens) {
      const score = scoreToken(command, token)
      if (score === null) return
      worst = Math.max(worst, score)
    }
    scored.push({ command, score: worst, order })
  })
  scored.sort((a, b) => a.score - b.score || a.order - b.order)
  return scored.map((entry) => entry.command)
}
