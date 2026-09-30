import { ep1 } from './ep1'
import { ep2 } from './ep2'

/** The series in playback order; the compilation, transcript and upload kits all follow it. */
export const episodes = [ep1, ep2]

/** How an episode is labelled on screen and in upload kits: `EP3`, or its badge such as 番外. */
export const episodeTag = (episode: { number: number; badge?: string }) => episode.badge ?? `EP${episode.number}`
