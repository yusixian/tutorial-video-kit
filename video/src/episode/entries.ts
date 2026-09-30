import { type EpisodeTiming, timeEpisode } from '../lib/timeline'
import { ep1Scenes } from '../scenes/ep1'
import { ep2Scenes } from '../scenes/ep2'
import { episodes } from '../script/episodes'
import type { EpisodeScript } from '../script/types'
import type { MusicCue, SceneDef } from './Episode'

/** Scene components per episode id; add the registry of every new episode here. */
const registries: Record<string, Record<string, SceneDef>> = {
  ep1: ep1Scenes,
  ep2: ep2Scenes,
}

export type EpisodeEntry = {
  script: EpisodeScript
  registry: Record<string, SceneDef>
  timing: EpisodeTiming
  music: MusicCue[]
}

const withTiming = (script: EpisodeScript): EpisodeEntry => {
  const registry = registries[script.id]
  if (!registry) throw new Error(`no scene registry for ${script.id}`)
  const timing = timeEpisode(script)
  const music = (script.music ?? []).map(({ track, scene }) => {
    const start = timing.scenes.find(s => s.scene.id === scene)
    if (!start) throw new Error(`unknown music scene: ${scene}`)
    return { track, from: start.from }
  })
  return { script, registry, timing, music }
}

/** Every episode in series order with its voiced timing and scene components; one composition each. */
export const entries: EpisodeEntry[] = episodes.map(withTiming)
