import { Easing, interpolate, spring } from 'remotion'

export const easeInOut = Easing.bezier(0.45, 0, 0.2, 1)
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1)

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

/** 0→1 over `dur` frames starting at `from`. */
export const progress = (frame: number, from: number, dur: number, easing = easeOut) =>
  interpolate(frame, [from, from + Math.max(1, dur)], [0, 1], { ...clamp, easing })

/** Visible between `from` and `to` with symmetric fades. */
export const visible = (frame: number, from: number, to: number, fade = 8) =>
  Math.min(progress(frame, from, fade), 1 - progress(frame, to - fade, fade, easeInOut))

/** Characters of `text` revealed by `frame`, typing `cps` characters per second at 30 fps. */
export const typed = (text: string, frame: number, from: number, cps = 14) => {
  const count = Math.max(0, Math.floor(((frame - from) / 30) * cps))
  return [...text].slice(0, count).join('')
}

/** The frame `ratio` of the way from `from` to `to`; cues written this way follow a line when its voicing changes length. */
export const cueAt = (from: number, to: number, ratio: number) => from + Math.round((to - from) * ratio)

/** 0→1 from `from` with a small settle past 1; reserved for results and figures landing, not general entrances. */
export const land = (frame: number, from: number) =>
  spring({ frame: frame - from, fps: 30, config: { damping: 14, stiffness: 120, mass: 0.9 } })
