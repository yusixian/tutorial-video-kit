import type { FC } from 'react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { config } from '../config'
import { easeInOut, progress } from '../lib/anim'
import { timeEpisode } from '../lib/timeline'
import { episodes, episodeTag } from '../script/episodes'
import type { EpisodeScript } from '../script/types'
import { fonts, theme } from '../theme'
import { TrackStrip } from './TrackStrip'

/** Full-screen opening card: the episode's title beside its own timeline, which a playhead sweeps once. */
export const EpisodeTitle: FC<{ episode: EpisodeScript }> = ({ episode }) => {
  const frame = useCurrentFrame()
  const open = progress(frame, 0, 16)
  const label = progress(frame, 8, 18)
  const sweep = progress(frame, 12, 72, easeInOut)
  const index = episodes.findIndex(e => e.id === episode.id)
  const previous = index > 0 ? episodes[index - 1] : undefined
  const next = index >= 0 ? episodes[index + 1] : undefined
  return (
    <AbsoluteFill style={{ background: theme.ink, fontFamily: fonts.sans, color: theme.text, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 120, top: 64, fontSize: 24, letterSpacing: 2, color: theme.dim, opacity: open }}>
        {config.series} · {config.version}
      </div>
      <div style={{ position: 'absolute', left: 120, top: 300, width: 720, opacity: label, transform: `translateY(${(1 - label) * 18}px)` }}>
        {previous ? <div style={{ fontSize: 23, color: theme.faint }}>{episodeTag(previous)} · {previous.title}</div> : null}
        <div style={{ width: 44, height: 4, background: theme.accent, margin: '32px 0' }} />
        <div style={{ fontFamily: fonts.mono, fontSize: 36, fontWeight: 800, color: theme.accent }}>{episodeTag(episode)}</div>
        <div style={{ fontSize: 96, fontWeight: 900, lineHeight: 1.2, margin: '18px 0 22px', textWrap: 'balance' }}>{episode.title}</div>
        <div style={{ fontSize: 32, lineHeight: 1.6, color: theme.dim, textWrap: 'balance' }}>{episode.subtitle}</div>
        {next ? <div style={{ marginTop: 48, fontSize: 22, color: theme.faint }}>之后 · {episodeTag(next)} {next.title}</div> : null}
      </div>
      <div style={{ position: 'absolute', left: 960, top: 490, opacity: open, transform: `translateX(${(1 - open) * 40}px)` }}>
        <TrackStrip timing={timeEpisode(episode)} width={840} sweep={sweep} />
      </div>
      <div style={{ position: 'absolute', left: 72, right: 72, bottom: 72, height: 2, background: theme.line }}>
        <div style={{ height: '100%', width: `${progress(frame, 0, 104) * 100}%`, background: theme.brandLight }} />
      </div>
    </AbsoluteFill>
  )
}
