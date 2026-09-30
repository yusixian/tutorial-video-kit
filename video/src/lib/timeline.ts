import { config } from '../config'
import manifest from '../script/tts-manifest.json'
import type { EpisodeScript, Line, SceneScript } from '../script/types'
import type { SpeechTiming } from './captions'

export const FPS = 30
const DEFAULT_PAUSE = 0.28
const DEFAULT_LEAD = 0.4
const DEFAULT_TAIL = 0.6

type ManifestEntry = { file: string; seconds: number; speech?: SpeechTiming }
export type NarrationManifest = Record<string, ManifestEntry>
const clips = manifest as NarrationManifest

export type LineTiming = Line & {
  /** Frame offsets relative to the scene start. */
  from: number
  duration: number
  audio?: string
  speech?: SpeechTiming
}

export type SceneTiming = {
  scene: SceneScript
  /** Frame offset relative to the episode start. */
  from: number
  duration: number
  lines: LineTiming[]
}

export type EpisodeTiming = {
  episode: EpisodeScript
  duration: number
  scenes: SceneTiming[]
}

const seconds = (s: number) => Math.round(s * FPS)

/** Line lengths come from the voiced clips; a line without a clip gets a reading-speed estimate, so an empty manifest still renders. */
const lineSeconds = (line: Line, narration: NarrationManifest) =>
  narration[line.id]?.seconds ?? Math.max(1.6, config.locale === 'en' ? line.text.trim().split(/\s+/).length / 2.5 : line.text.length / 5.2)

const timeScene = (scene: SceneScript, narration: NarrationManifest): Omit<SceneTiming, 'from'> => {
  let cursor = seconds(scene.lead ?? DEFAULT_LEAD)
  const lines = scene.lines.map(line => {
    const duration = seconds(lineSeconds(line, narration))
    const timing: LineTiming = { ...line, from: cursor, duration, audio: narration[line.id]?.file, speech: narration[line.id]?.speech }
    cursor += duration + seconds(line.pause ?? DEFAULT_PAUSE)
    return timing
  })
  cursor += seconds(scene.tail ?? DEFAULT_TAIL)
  return { scene, duration: Math.max(cursor, seconds(scene.minSeconds ?? 0)), lines }
}

/** Explicit narration input, for tests and for timing a script against another manifest. */
export const timeEpisodeWithNarration = (episode: EpisodeScript, narration: NarrationManifest): EpisodeTiming => {
  let cursor = 0
  const scenes = episode.scenes.map(scene => {
    const timed = timeScene(scene, narration)
    const result = { ...timed, from: cursor }
    cursor += timed.duration
    return result
  })
  return { episode, duration: cursor, scenes }
}

export const timeEpisode = (episode: EpisodeScript) => timeEpisodeWithNarration(episode, clips)
