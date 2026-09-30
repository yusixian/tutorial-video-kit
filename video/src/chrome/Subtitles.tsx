import type { FC, ReactNode } from 'react'
import { useCurrentFrame } from 'remotion'
import type { SubtitleCue } from '../lib/captions'
import { FRAME, fonts, theme } from '../theme'

const emphasize = (text: string, em: string[] = []): ReactNode[] => {
  if (!em.length) return [text]
  const pattern = new RegExp(`(${em.map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
  return text.split(pattern).map((part, i) =>
    em.includes(part) ? (
      <span key={i} style={{ color: theme.accent }}>
        {part}
      </span>
    ) : (
      part
    ),
  )
}

/** Bottom-centred subtitle for whichever cue is active; full-screen scenes lower it into the free space. */
export const Subtitles: FC<{ cues: SubtitleCue[]; fullscreenRanges: [number, number][]; locale?: 'zh' | 'en' }> = ({ cues, fullscreenRanges, locale = 'zh' }) => {
  const frame = useCurrentFrame()
  const cue = cues.find(c => frame >= c.from && frame < c.from + c.duration)
  if (!cue) return null
  const fullscreen = fullscreenRanges.some(([a, b]) => frame >= a && frame < b)
  const bottom = fullscreen ? 64 : FRAME.bottom + 34
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div
        style={{
          maxWidth: 1480,
          padding: '10px 26px 12px',
          borderRadius: 14,
          background: 'rgba(12, 14, 18, 0.84)',
          color: '#fff',
          fontFamily: fonts.sans,
          fontWeight: 600,
          fontSize: 40,
          lineHeight: 1.4,
          letterSpacing: locale === 'en' ? 0 : 0.6,
          textAlign: 'center',
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
        }}
      >
        {emphasize(cue.text, cue.em)}
      </div>
    </div>
  )
}
