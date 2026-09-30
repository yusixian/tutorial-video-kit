import type { FC } from 'react'
import { useCurrentFrame } from 'remotion'
import { config } from '../config'
import { progress } from '../lib/anim'
import { FRAME, fonts, theme } from '../theme'

export type SectionMark = { code: string; title: string; from: number; duration: number }

export const PROGRESS_FILL = `linear-gradient(90deg, ${theme.brand}, ${theme.brandLight})`

/** Top bar: series title and version, section progress dots, current section label. */
export const TopBar: FC<{ episodeLabel: string; sections: SectionMark[]; opacity: number }> = ({ episodeLabel, sections, opacity }) => {
  const frame = useCurrentFrame()
  const currentIndex = Math.max(0, sections.findLastIndex(s => frame >= s.from))
  const current = sections[currentIndex]
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: FRAME.width,
        height: FRAME.top,
        display: 'flex',
        alignItems: 'center',
        padding: '0 36px',
        gap: 28,
        opacity,
        color: theme.text,
        fontFamily: fonts.sans,
        borderBottom: `1px solid ${theme.line}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, minWidth: 460 }}>
        <span style={{ fontWeight: 800, fontSize: 21 }}>{config.series}</span>
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 14,
            fontWeight: 700,
            color: theme.ink,
            background: theme.accent,
            padding: '2px 8px',
            borderRadius: 6,
            transform: 'translateY(-2px)',
          }}
        >
          {config.version}
        </span>
        <span style={{ fontSize: 17, color: theme.dim }}>{episodeLabel}</span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        {sections.map((s, i) => {
          const done = i < currentIndex
          const active = i === currentIndex
          return (
            <div key={s.code + s.from} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <div
                style={{
                  width: active ? 12 : 8,
                  height: active ? 12 : 8,
                  borderRadius: '50%',
                  background: active ? theme.accent : done ? theme.text : 'transparent',
                  border: active || done ? 'none' : `1.5px solid ${theme.faint}`,
                  flexShrink: 0,
                }}
              />
              {i < sections.length - 1 ? (
                <div style={{ flex: 1, height: 1.5, background: done ? theme.text : theme.faint, opacity: done ? 0.8 : 0.5 }} />
              ) : null}
            </div>
          )
        })}
      </div>
      <div style={{ minWidth: 300, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: fonts.mono, fontSize: 17, fontWeight: 700, padding: '3px 10px', borderRadius: 6, border: `1.5px solid ${theme.faint}` }}>
          {current?.code}
        </span>
        <span style={{ fontSize: 22, fontWeight: 700 }}>{current?.title}</span>
      </div>
    </div>
  )
}

/** Bottom timeline with one segment per section and a gradient progress fill. */
export const Timeline: FC<{ sections: SectionMark[]; total: number; opacity: number }> = ({ sections, total, opacity }) => {
  const frame = useCurrentFrame()
  const usable = FRAME.width - 72
  const gap = 6
  return (
    <div style={{ position: 'absolute', left: 36, bottom: 0, width: usable, height: FRAME.bottom, opacity, fontFamily: fonts.sans }}>
      {sections.map(s => {
        const left = (s.from / total) * usable
        const width = Math.max(4, (s.duration / total) * usable - gap)
        const fill = Math.min(1, Math.max(0, (frame - s.from) / s.duration))
        const active = frame >= s.from && frame < s.from + s.duration
        return (
          <div key={s.code + s.from} style={{ position: 'absolute', left, width, top: 6, height: 38 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: active ? 700 : 500,
                color: active ? theme.text : theme.faint,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'clip',
              }}
            >
              <span style={{ fontFamily: fonts.mono, marginRight: 6 }}>{s.code}</span>
              {s.title}
            </div>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 10, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
              <div style={{ width: `${fill * 100}%`, height: '100%', background: PROGRESS_FILL }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Fades the frame chrome for full-screen scenes. */
export const chromeOpacity = (frame: number, fullscreenRanges: [number, number][]) => {
  let o = 1
  for (const [from, to] of fullscreenRanges) {
    const hide = Math.min(progress(frame, from - 6, 8), 1 - progress(frame, to - 2, 10))
    o = Math.min(o, 1 - hide)
  }
  return o
}
