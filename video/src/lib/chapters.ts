import { episodes, episodeTag } from '../script/episodes'
import type { EpisodeScript } from '../script/types'
import { FPS, timeEpisode } from './timeline'

/** `00:00:43`: the form Bilibili turns into a jump link in descriptions and comments. */
export const clock = (frame: number) => {
  const s = Math.floor(frame / FPS)
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':')
}

/**
 * Chapters grouped by section under a 【】 header, groups split by a blank line; a section that is one scene of the
 * same name stays a single line. A wordless scene after the opening starts the next scene's chapter instead of its own.
 */
export const chapters = (episode: EpisodeScript) => {
  const scenes = timeEpisode(episode).scenes
  const entries = scenes.flatMap(({ scene, from }, i) => {
    if (i === 0 || (!scene.lines.length && scenes[i + 1])) return []
    const start = !scenes[i - 1].scene.lines.length && i > 1 ? scenes[i - 1].from : from
    return [{ section: scene.section, title: scene.title, start }]
  })
  const lines = [`${clock(0)} 片头`]
  for (const section of [...new Set(entries.map(e => e.section))]) {
    const group = entries.filter(e => e.section === section)
    const name = episode.sections[section] ?? group[0].title
    lines.push('')
    if (group.length === 1 && group[0].title === name) lines.push(`${clock(group[0].start)} ${name}`)
    else lines.push(`【${section} ${name}】`, ...group.map(e => `${clock(e.start)} ${e.title}`))
  }
  return lines
}

/** Episodes as 【】 groups, one line per section; each group's first line jumps to the episode's own start. */
export const compilationChapters = () => {
  let offset = 0
  return episodes.flatMap((episode, n) => {
    const timing = timeEpisode(episode)
    const lines = [...(n ? [''] : []), `【${episodeTag(episode)} ${episode.title}】`]
    const seen = new Set<string>()
    for (const { scene, from } of timing.scenes) {
      if (scene.section.endsWith('-0') || seen.has(scene.section)) continue
      seen.add(scene.section)
      lines.push(`${clock(seen.size === 1 ? offset : offset + from)} ${episode.sections[scene.section] ?? scene.title}`)
    }
    offset += timing.duration
    return lines
  })
}
