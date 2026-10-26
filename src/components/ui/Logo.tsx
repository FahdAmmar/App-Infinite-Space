/** رمز اللانهاية بتدرج بنفسجي ← وردي (نفس تدرج الروابط في المراجع). */
export function LogoMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="logo-gradient" x1="4" y1="16" x2="28" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--edge-from)" />
          <stop offset="1" stopColor="var(--edge-to)" />
        </linearGradient>
      </defs>
      <path
        d="M16 16c-2-3-4-5-6.5-5S5 13 5 16s2 5 4.5 5 4.5-2 6.5-5zm0 0c2 3 4 5 6.5 5s4.5-2 4.5-5-2-5-4.5-5S18 13 16 16z"
        stroke="url(#logo-gradient)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className="font-display text-xl font-bold tracking-tight">InfiniteSpace</span>
    </span>
  )
}
