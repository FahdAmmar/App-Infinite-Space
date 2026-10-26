import { Moon, Sun } from 'lucide-react'
import { useUiStore } from '@/stores/ui-store'
import { IconButton } from './Button'

export function ThemeToggle() {
  const theme = useUiStore((state) => state.theme)
  const toggleTheme = useUiStore((state) => state.toggleTheme)
  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <IconButton label={`Switch to ${next} theme`} onClick={toggleTheme} className="rounded-full">
      {/* نعرض أيقونة الوضع الذي سننتقل إليه، فهي توضح ما سيحدث عند الضغط */}
      {theme === 'dark' ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />}
    </IconButton>
  )
}
