import type { TrackId } from './music'

export type Line = {
  /** Unique within the whole series, e.g. `ep1-panel-03`. */
  id: string
  /** Subtitle text. */
  text: string
  /** What the voice actually says when it differs from the subtitle (pronunciation). */
  tts?: string
  /** Substrings of `text` rendered as emphasized keywords. */
  em?: string[]
  /** Silence after the line, in seconds. */
  pause?: number
}

export type SceneScript = {
  id: string
  /** Section code shown in the top bar, e.g. `1-2`; the opening title uses `<n>-0`. */
  section: string
  title: string
  lines: Line[]
  /** Silence before the first line, in seconds. */
  lead?: number
  /** Extra hold after the last line, in seconds. */
  tail?: number
  /** Lower bound for scenes carried by visuals rather than narration. */
  minSeconds?: number
}

export type EpisodeScript = {
  id: string
  /** Episode number shown on title cards and covers; also orders the series. */
  number: number
  /** Replaces `EP<number>` wherever the episode is labelled, e.g. 番外. */
  badge?: string
  title: string
  subtitle: string
  /** Titles for the section codes its scenes use. */
  sections: Record<string, string>
  /** Background tracks, each starting with a scene so they follow narration timing changes. */
  music?: { track: TrackId; scene: string }[]
  scenes: SceneScript[]
}
