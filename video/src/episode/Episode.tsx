import { Audio } from '@remotion/media'
import { createContext, type FC, useContext, useMemo } from 'react'
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion'
import { chromeOpacity, type SectionMark, Timeline, TopBar } from '../chrome/Frame'
import { Subtitles } from '../chrome/Subtitles'
import { config } from '../config'
import { clamp, easeInOut, progress } from '../lib/anim'
import { chunkCue, type SubtitleCue } from '../lib/captions'
import { type EpisodeTiming, FPS, type SceneTiming } from '../lib/timeline'
import { episodeTag } from '../script/episodes'
import { TRACKS, type TrackId } from '../script/music'
import { theme } from '../theme'

export type SceneDef = {
  component: FC
  /** Hide the top bar and timeline while this scene is on screen. */
  fullscreen?: boolean
  /** Come in only after the previous scene has cleared, for scenes whose text lands where the previous one's sits. */
  dip?: boolean
}

export type MusicCue = { track: TrackId; from: number; volume?: number }

const SceneContext = createContext<SceneTiming | null>(null)

/** Timing of the scene being rendered; `L(i)` / `E(i)` are the start / end frames of line `i`. */
export const useScene = () => {
  const scene = useContext(SceneContext)
  if (!scene) throw new Error('useScene outside of a scene')
  const L = (i: number) => scene.lines[Math.min(i, scene.lines.length - 1)]?.from ?? 0
  const E = (i: number) => {
    const line = scene.lines[Math.min(i, scene.lines.length - 1)]
    return line ? line.from + line.duration : scene.duration
  }
  return { ...scene, L, E }
}

/**
 * Opacity that clears a scene's own content in the first frames after its end, while the next
 * scene of the same section dissolves in over it; for layouts whose text sits where the next one's does.
 */
export const useExitFade = (frames = 8) => {
  const { duration } = useScene()
  return 1 - progress(useCurrentFrame(), duration, frames, easeInOut)
}

/** Frames a scene stays mounted past its end so the next one can come in over it. */
const OVERLAP = 14
const FADE = 10
const DIP = 6

/**
 * Scenes within a section dissolve; a new section slides in from the right
 * while the old one drifts left and fades, so the change of topic reads as a page turn.
 */
const SceneLayer: FC<{ timing: SceneTiming; def: SceneDef; first: boolean; turnIn: boolean; turnOut: boolean; dipOut: boolean }> = ({
  timing,
  def,
  first,
  turnIn,
  turnOut,
  dipOut,
}) => {
  const frame = useCurrentFrame()
  const enter = first ? 1 : def.dip ? progress(frame, DIP, FADE, easeInOut) : turnIn ? progress(frame, 0, OVERLAP, easeInOut) : progress(frame, 0, FADE)
  const leave = dipOut ? progress(frame, timing.duration, DIP, easeInOut) : turnOut ? progress(frame, timing.duration, OVERLAP, easeInOut) : 0
  const shift = turnIn ? (1 - enter) * 48 : 0
  const Component = def.component
  return (
    <AbsoluteFill style={{ opacity: enter * (1 - leave), transform: shift || leave ? `translateX(${shift - leave * 36}px)` : undefined }}>
      <SceneContext.Provider value={timing}>
        <Component />
      </SceneContext.Provider>
    </AbsoluteFill>
  )
}

export const sectionMarks = (timing: EpisodeTiming, registry: Record<string, SceneDef>, titles: Record<string, string>) => {
  const marks: SectionMark[] = []
  for (const s of timing.scenes) {
    if (registry[s.scene.id]?.fullscreen) continue
    const last = marks.at(-1)
    if (last && last.code === s.scene.section) {
      last.duration = s.from + s.duration - last.from
    } else {
      marks.push({ code: s.scene.section, title: titles[s.scene.section] ?? s.scene.title, from: s.from, duration: s.duration })
    }
  }
  return marks
}

/** Frame ranges of the scenes that hide the chrome. */
export const fullscreenRangesOf = (timing: EpisodeTiming, registry: Record<string, SceneDef>) =>
  timing.scenes.filter(s => registry[s.scene.id]?.fullscreen).map(s => [s.from, s.from + s.duration] as [number, number])

/** Per-frame music gain: lowered while narration is speaking, with short ramps. */
const duckingCurve = (timing: EpisodeTiming, base: number, ducked: number) => {
  const speaking = new Uint8Array(timing.duration + 1)
  for (const scene of timing.scenes) {
    for (const line of scene.lines) {
      const a = Math.max(0, scene.from + line.from - 6)
      const b = Math.min(timing.duration, scene.from + line.from + line.duration + 8)
      speaking.fill(1, a, b)
    }
  }
  const gain = new Float32Array(timing.duration + 1)
  let level = base
  for (let f = 0; f <= timing.duration; f++) {
    const target = speaking[f] ? ducked : base
    level += (target - level) * 0.12
    gain[f] = level
  }
  return gain
}

/** Looping tracks that cross-fade at each cue and duck under the narration. */
const MusicBed: FC<{ timing: EpisodeTiming; cues: MusicCue[] }> = ({ timing, cues }) => {
  const gain = useMemo(() => duckingCurve(timing, 0.3, 0.13), [timing])
  return (
    <>
      {cues.map((cue, i) => {
        const end = cues[i + 1]?.from ?? timing.duration
        const fade = 2 * FPS
        const last = i === cues.length - 1
        const duration = Math.min(end + (last ? 0 : fade), timing.duration) - cue.from
        return (
          <Sequence key={cue.track + cue.from} from={cue.from} durationInFrames={duration} layout="none">
            <Audio
              src={staticFile(TRACKS[cue.track].file)}
              loop
              loopVolumeCurveBehavior="extend"
              volume={f => {
                const g = gain[Math.min(gain.length - 1, cue.from + f)] * (cue.volume ?? 1)
                const fadeIn = interpolate(f, [0, fade], [0, 1], clamp)
                const fadeOut = interpolate(f, [last ? duration - fade : end - cue.from, duration - 1], [1, 0], clamp)
                return g * fadeIn * fadeOut
              }}
            />
          </Sequence>
        )
      })}
    </>
  )
}

/** One episode: scenes on the voiced timeline, frame chrome, subtitles, narration clips and the music bed. */
export const Episode: FC<{ timing: EpisodeTiming; registry: Record<string, SceneDef>; sectionTitles: Record<string, string>; music: MusicCue[] }> = ({
  timing,
  registry,
  sectionTitles,
  music,
}) => {
  const frame = useCurrentFrame()
  const sections = useMemo(() => sectionMarks(timing, registry, sectionTitles), [timing, registry, sectionTitles])
  const fullscreenRanges = useMemo(() => fullscreenRangesOf(timing, registry), [timing, registry])
  const cues: SubtitleCue[] = useMemo(
    () =>
      timing.scenes.flatMap(s =>
        s.lines.flatMap(l => chunkCue({ from: s.from + l.from, duration: l.duration, text: l.text, em: l.em, speech: l.speech }, FPS, config.locale)),
      ),
    [timing],
  )
  const chrome = chromeOpacity(frame, fullscreenRanges)
  const label = `${episodeTag(timing.episode)} · ${timing.episode.title}`

  return (
    <AbsoluteFill style={{ background: theme.ink }}>
      {timing.scenes.map((s, i) => {
        const def = registry[s.scene.id]
        if (!def) throw new Error(`no scene component for ${s.scene.id}`)
        const prev = timing.scenes[i - 1]
        const next = timing.scenes[i + 1]
        return (
          <Sequence key={s.scene.id} from={s.from} durationInFrames={s.duration + OVERLAP} premountFor={45}>
            <SceneLayer
              timing={s}
              def={def}
              first={i === 0}
              turnIn={!!prev && prev.scene.section !== s.scene.section}
              turnOut={!!next && next.scene.section !== s.scene.section}
              dipOut={!!next && !!registry[next.scene.id]?.dip}
            />
          </Sequence>
        )
      })}
      <TopBar episodeLabel={label} sections={sections} opacity={chrome} />
      <Timeline sections={sections} total={timing.duration} opacity={chrome} />
      <Subtitles cues={cues} fullscreenRanges={fullscreenRanges} locale={config.locale} />
      {timing.scenes.flatMap(s =>
        s.lines
          .filter(l => l.audio)
          .map(l => (
            <Sequence key={l.id} from={s.from + l.from} durationInFrames={l.duration + 6} layout="none">
              <Audio src={staticFile(l.audio as string)} />
            </Sequence>
          )),
      )}
      <MusicBed timing={timing} cues={music} />
    </AbsoluteFill>
  )
}
