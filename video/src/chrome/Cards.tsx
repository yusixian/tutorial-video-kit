import type { CSSProperties, FC, ReactNode } from 'react'
import { useCurrentFrame } from 'remotion'
import { progress } from '../lib/anim'
import { FRAME, fonts, theme } from '../theme'

/** Rises and fades in from `at`; leaves at `out` when given. */
export const Appear: FC<{ at: number; out?: number; y?: number; children: ReactNode; style?: CSSProperties }> = ({ at, out, y = 24, children, style }) => {
  const frame = useCurrentFrame()
  const p = progress(frame, at, 16)
  const q = out === undefined ? 0 : progress(frame, out, 10)
  return <div style={{ opacity: p * (1 - q), transform: `translateY(${(1 - p) * y}px)`, ...style }}>{children}</div>
}

/** Content area rectangle below the top bar, for screen-space layouts. */
export const ContentArea: FC<{ children: ReactNode; style?: CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      top: FRAME.top,
      width: FRAME.width,
      height: FRAME.contentHeight,
      overflow: 'hidden',
      fontFamily: fonts.sans,
      color: theme.text,
      ...style,
    }}
  >
    {children}
  </div>
)

/** `dark` is translucent and only reads on the dark stage; use `ink` over a light page. */
export const Pill: FC<{ children: ReactNode; tone?: 'dark' | 'ink' | 'light' | 'accent' | 'brand'; size?: number }> = ({ children, tone = 'dark', size = 22 }) => {
  const palette = {
    dark: { background: 'rgba(255,255,255,0.08)', color: theme.text, border: `1px solid ${theme.line}` },
    ink: { background: theme.paperInk, color: theme.text, border: 'none' },
    light: { background: '#fff', color: theme.paperInk, border: `1px solid ${theme.paperLine}` },
    accent: { background: theme.accent, color: theme.ink, border: 'none' },
    brand: { background: theme.brand, color: '#fff', border: 'none' },
  }[tone]
  return (
    <span
      style={{
        ...palette,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: `${size * 0.28}px ${size * 0.7}px`,
        borderRadius: 999,
        fontFamily: fonts.sans,
        fontWeight: 600,
        fontSize: size,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

/** Big heading for the point a scene makes, with its section code above. */
export const PointHeader: FC<{ kicker: string; title: string; at?: number }> = ({ kicker, title, at = 0 }) => {
  const frame = useCurrentFrame()
  const p = progress(frame, at, 18)
  return (
    <div style={{ fontFamily: fonts.sans, color: theme.text, opacity: p, transform: `translateX(${(1 - p) * -30}px)` }}>
      <div style={{ fontFamily: fonts.mono, fontSize: 28, fontWeight: 700, color: theme.accent, letterSpacing: 2 }}>{kicker}</div>
      <div style={{ fontSize: 84, fontWeight: 900, lineHeight: 1.12, marginTop: 8 }}>{title}</div>
    </div>
  )
}

/** Raised panel on the dark stage. */
export const Card: FC<{ children: ReactNode; style?: CSSProperties; active?: boolean }> = ({ children, style, active }) => (
  <div
    style={{
      padding: '28px 32px',
      borderRadius: 22,
      background: theme.inkRaise,
      border: `1.5px solid ${active ? theme.accent : theme.line}`,
      boxShadow: active ? '0 20px 60px rgba(0,0,0,0.35)' : 'none',
      ...style,
    }}
  >
    {children}
  </div>
)
