import type { FC } from 'react'
import { config } from '../config'
import { chunkCue } from '../lib/captions'
import { type EpisodeTiming, FPS } from '../lib/timeline'
import { fonts, theme } from '../theme'

type Block = { from: number; duration: number; color: string }

const SECTION_TONES = [theme.brand, theme.brandLight]
/** Share of the track over which a block fades in behind the playhead; the head runs one fade past the end so the last blocks finish too. */
const FADE = 1 / 12

/**
 * An episode's own timeline drawn as three tracks (scenes, voiced lines, subtitle chunks), so the title card and
 * cover show the real structure. `sweep` (0→1) reveals it left to right behind a playhead; omit it for a still.
 */
export const TrackStrip: FC<{ timing: EpisodeTiming; width: number; sweep?: number; labels?: boolean; scale?: number }> = ({
  timing,
  width,
  sweep,
  labels = true,
  scale = 1,
}) => {
  const sections = [...new Set(timing.scenes.map(s => s.scene.section))]
  const lines = timing.scenes.flatMap(s => s.lines.map(l => ({ ...l, from: s.from + l.from })))
  const tracks: { label: string; blocks: Block[] }[] = [
    {
      label: '画面',
      blocks: timing.scenes.map(s => ({
        from: s.from,
        duration: s.duration,
        color: s.scene.section.endsWith('-0') ? theme.accent : SECTION_TONES[sections.indexOf(s.scene.section) % 2],
      })),
    },
    { label: '配音', blocks: lines.map(l => ({ from: l.from, duration: l.duration, color: 'rgba(244, 245, 247, 0.78)' })) },
    {
      label: '字幕',
      blocks: lines.flatMap(l => chunkCue(l, FPS, config.locale)).map(c => ({ from: c.from, duration: c.duration, color: 'rgba(244, 245, 247, 0.34)' })),
    },
  ]
  const labelWidth = labels ? 84 * scale : 0
  const trackWidth = width - labelWidth
  const x = (frame: number) => (frame / timing.duration) * trackWidth
  const head = (sweep ?? 1) * (1 + FADE)
  const rowHeight = 40 * scale
  const gap = 16 * scale
  return (
    <div style={{ position: 'relative', width, height: tracks.length * rowHeight + (tracks.length - 1) * gap, fontFamily: fonts.sans }}>
      {tracks.map((track, row) => (
        <div key={track.label} style={{ position: 'absolute', left: 0, top: row * (rowHeight + gap), width, height: rowHeight }}>
          {labels ? (
            <div style={{ position: 'absolute', left: 0, top: 0, height: rowHeight, display: 'flex', alignItems: 'center', fontSize: 22 * scale, fontWeight: 600, color: theme.dim }}>
              {track.label}
            </div>
          ) : null}
          <div style={{ position: 'absolute', left: labelWidth, top: 0, width: trackWidth, height: rowHeight, borderRadius: 8 * scale, background: 'rgba(255,255,255,0.05)' }}>
            {track.blocks.map((block, i) => {
              const visible = Math.min(1, Math.max(0, (head - block.from / timing.duration) / FADE))
              if (visible <= 0) return null
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: x(block.from) + 1.5 * scale,
                    top: row === 0 ? 0 : rowHeight * 0.18,
                    width: Math.max(2, x(block.duration) - 3 * scale),
                    height: row === 0 ? rowHeight : rowHeight * 0.64,
                    borderRadius: 6 * scale,
                    background: block.color,
                    opacity: visible,
                  }}
                />
              )
            })}
          </div>
        </div>
      ))}
      {sweep !== undefined && sweep < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: labelWidth + Math.min(1, head) * trackWidth - 1.5,
            top: -12 * scale,
            bottom: -12 * scale,
            width: 3,
            borderRadius: 2,
            background: theme.accent,
            boxShadow: `0 0 16px ${theme.accent}`,
          }}
        />
      ) : null}
    </div>
  )
}
