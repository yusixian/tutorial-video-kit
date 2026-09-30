import type { FC } from 'react'
import { AbsoluteFill, useVideoConfig } from 'remotion'
import { TrackStrip } from '../chrome/TrackStrip'
import { config } from '../config'
import { type EpisodeTiming, timeEpisode } from '../lib/timeline'
import { episodes, episodeTag } from '../script/episodes'
import { fonts, theme } from '../theme'

/** `episode` is an episode id, or `all` for the compilation. */
export type CoverProps = { episode: string }

/** The whole series as one timeline, for the compilation cover. */
const seriesTiming = (): EpisodeTiming => {
  let offset = 0
  const scenes = episodes.flatMap(episode => {
    const timing = timeEpisode(episode)
    const shifted = timing.scenes.map(s => ({ ...s, from: s.from + offset }))
    offset += timing.duration
    return shifted
  })
  return { episode: episodes[0], duration: offset, scenes }
}

/** Upload cover: series name, episode tag, title, and the episode's real timeline across the bottom. */
export const Cover: FC<CoverProps> = ({ episode: id }) => {
  const { width } = useVideoConfig()
  const narrow = width < 1600
  const episode = episodes.find(e => e.id === id)
  if (!episode && id !== 'all') throw new Error(`no episode ${id}`)
  const tag = episode ? episodeTag(episode) : `全 ${episodes.length} 集`
  const title = episode ? episode.title : config.series
  const subtitle = episode ? episode.subtitle : episodes.map(e => e.title).join(' · ')
  const margin = narrow ? 90 : 110
  return (
    <AbsoluteFill style={{ background: theme.ink, color: theme.text, fontFamily: fonts.sans, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: -260, top: -320, width: 900, height: 900, borderRadius: '50%', background: 'radial-gradient(circle, rgba(76, 125, 255, 0.32), rgba(76, 125, 255, 0) 68%)' }} />
      <div style={{ position: 'absolute', left: margin, top: 86, display: 'flex', alignItems: 'center', gap: 18 }}>
        <span style={{ fontSize: 40, fontWeight: 800 }}>{config.series}</span>
        <span style={{ fontFamily: fonts.mono, fontSize: 26, fontWeight: 700, color: theme.ink, background: theme.accent, padding: '4px 14px', borderRadius: 8 }}>{config.version}</span>
      </div>
      <div style={{ position: 'absolute', left: margin, right: margin, top: narrow ? 250 : 270 }}>
        <div style={{ fontFamily: episode ? fonts.mono : fonts.sans, fontSize: narrow ? 60 : 68, fontWeight: 800, color: theme.accent }}>{tag}</div>
        <div style={{ fontSize: narrow ? 128 : 150, fontWeight: 900, lineHeight: 1.15, marginTop: 14, textWrap: 'balance' }}>{title}</div>
        <div style={{ fontSize: narrow ? 42 : 48, color: theme.dim, marginTop: 26, lineHeight: 1.4, textWrap: 'balance' }}>{subtitle}</div>
      </div>
      <div style={{ position: 'absolute', left: margin, bottom: 100 }}>
        <TrackStrip timing={episode ? timeEpisode(episode) : seriesTiming()} width={width - margin * 2} labels={false} scale={1.3} />
      </div>
    </AbsoluteFill>
  )
}
