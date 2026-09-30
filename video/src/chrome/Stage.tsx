import type { CSSProperties, FC, ReactNode } from 'react'
import { interpolate, useCurrentFrame } from 'remotion'
import { clamp, easeInOut, easeOut, progress } from '../lib/anim'
import type { Box } from '../lib/boxes'
import { FRAME, fonts, theme } from '../theme'
import { gatherSpotlights } from './Spotlight'

/** The canvas a `Stage` films: children are laid out in these page coordinates. */
export const PAGE = { width: 1920, height: 1080 }
const VIEW_W = FRAME.width
const VIEW_H = FRAME.contentHeight
/** Scale at which the whole page fits the content area. */
export const FIT_SCALE = Math.min(VIEW_W / PAGE.width, VIEW_H / PAGE.height)

export type CameraKey = {
  at: number
  /** Region to frame; omit for the full page. */
  box?: Box
  /** Fraction of the view the box should fill. */
  fill?: number
  /** Upper bound as a multiple of the fit scale. */
  maxZoom?: number
  /** Transition length in frames; defaults to one sized by the zoom and pan. */
  dur?: number
  /** Page pixels the view may extend past the bottom edge, to lift bottom-docked UI above the subtitles. */
  below?: number
}

type CameraState = { cx: number; cy: number; s: number }
type View = { s: number; tx: number; ty: number }

const resolve = (key: CameraKey): CameraState => {
  if (!key.box) return { cx: PAGE.width / 2, cy: PAGE.height / 2, s: FIT_SCALE }
  const [x, y, w, h] = key.box
  const fill = key.fill ?? 0.72
  const s = Math.min(Math.max(Math.min((VIEW_W * fill) / w, (VIEW_H * fill) / h), FIT_SCALE), FIT_SCALE * (key.maxZoom ?? 2.4))
  const halfW = VIEW_W / (2 * s)
  const halfH = VIEW_H / (2 * s)
  const fitAxis = (center: number, half: number, size: number) => (half * 2 >= size ? size / 2 : Math.min(Math.max(center, half), size - half))
  return { cx: fitAxis(x + w / 2, halfW, PAGE.width), cy: fitAxis(y + h / 2, halfH, PAGE.height + (key.below ?? 0)), s }
}

const toView = ({ cx, cy, s }: CameraState): View => ({ s, tx: VIEW_W / 2 - cx * s, ty: VIEW_H / 2 - cy * s })

/**
 * Zooms about the one page point that holds still on screen, so the target
 * grows in place instead of swinging in; moves at one scale stay linear pans.
 */
const blend = (a: View, b: View, p: number): View => {
  const s = a.s * (b.s / a.s) ** p
  const k = Math.abs(Math.log(b.s / a.s)) < 0.02 ? p : (a.s - s) / (a.s - b.s)
  return { s, tx: a.tx + (b.tx - a.tx) * k, ty: a.ty + (b.ty - a.ty) * k }
}

/** Longer for bigger zooms and pans, 20–40 frames. */
const travelFrames = (a: View, b: View) => {
  const zoom = Math.abs(Math.log(b.s / a.s))
  const pan = Math.hypot(b.tx - a.tx, b.ty - a.ty)
  return Math.round(Math.min(40, Math.max(20, 18 + zoom * 12 + pan / 90)))
}

export const cameraAt = (frame: number, keys: CameraKey[]): CameraState => {
  const sorted = [...keys].sort((a, b) => a.at - b.at)
  if (!sorted.length || frame < sorted[0].at) return resolve(sorted[0] ?? { at: 0 })
  let move = { from: toView(resolve(sorted[0])), to: toView(resolve(sorted[0])), at: sorted[0].at, dur: 1 }
  const viewAt = (f: number) => blend(move.from, move.to, progress(f, move.at, move.dur, easeInOut))
  for (const key of sorted.slice(1)) {
    if (frame < key.at) break
    const from = viewAt(key.at)
    const to = toView(resolve(key))
    move = { from, to, at: key.at, dur: key.dur ?? travelFrames(from, to) }
  }
  const { s, tx, ty } = viewAt(frame)
  return { s, cx: (VIEW_W / 2 - tx) / s, cy: (VIEW_H / 2 - ty) / s }
}

/** The framed content area. Children are laid out in page coordinates (1920×1080) and move with the camera. */
export const Stage: FC<{ camera?: CameraKey[]; children: ReactNode; style?: CSSProperties }> = ({ camera = [{ at: 0 }], children, style }) => {
  const frame = useCurrentFrame()
  const { cx, cy, s } = cameraAt(frame, camera)
  const tx = VIEW_W / 2 - cx * s
  const ty = VIEW_H / 2 - cy * s
  return (
    <div style={{ position: 'absolute', left: 0, top: FRAME.top, width: VIEW_W, height: VIEW_H, overflow: 'hidden', ...style }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: PAGE.width,
          height: PAGE.height,
          transformOrigin: '0 0',
          transform: `translate(${tx}px, ${ty}px) scale(${s})`,
        }}
      >
        {gatherSpotlights(children)}
      </div>
    </div>
  )
}

export type CursorKey = {
  at: number
  x: number
  y: number
  click?: boolean
  /** Control that visibly presses when this key clicks. */
  press?: Box
  /** Reach this key in a straight line with the button held, as when dragging a slider. */
  drag?: boolean
}

/** A click on the centre of `box` that also presses it. */
export const clickAt = (at: number, box: Box): CursorKey => ({ at, x: box[0] + box[2] / 2, y: box[1] + box[3] / 2, click: true, press: box })

const CURSOR_PATH = 'M5 3 L5 25 L10.4 19.8 L14.2 28.6 L18.1 26.9 L14.4 18.3 L21.8 18.3 Z'

/**
 * Pointer position: each move takes longer the farther it goes and bows
 * slightly like a wrist-driven hand, then settles briefly before a click.
 * Exported so a dragged control can follow the pointer exactly.
 */
export const cursorAt = (frame: number, keys: CursorKey[]) => {
  let x = keys[0].x
  let y = keys[0].y
  for (let i = 1; i < keys.length; i++) {
    const prev = keys[i - 1]
    const key = keys[i]
    const gap = Math.max(1, key.at - prev.at)
    const settle = key.click ? Math.min(6, Math.floor(gap / 3)) : 0
    const dx = key.x - prev.x
    const dy = key.y - prev.y
    const dist = Math.hypot(dx, dy)
    const travel = Math.min(Math.round(Math.min(30, Math.max(10, 10 + dist / 45))), Math.max(1, gap - settle))
    const start = key.at - settle - travel
    if (frame < start) break
    const p = progress(frame, start, travel, easeInOut)
    const bow = dist > 0 && !key.drag ? Math.sin(Math.PI * p) * Math.min(48, dist * 0.1) : 0
    const flip = dx < 0 ? -1 : 1
    x = prev.x + dx * p + (dy / Math.max(dist, 1)) * bow * flip
    y = prev.y + dy * p - (dx / Math.max(dist, 1)) * bow * flip
  }
  return { x, y }
}

/** A synthetic pointer in page coordinates; moves between keys and ripples on clicks. */
export const Cursor: FC<{ keys: CursorKey[]; hideAt?: number }> = ({ keys, hideAt }) => {
  const frame = useCurrentFrame()
  if (!keys.length || frame < keys[0].at - 10) return null
  const { x, y } = cursorAt(frame, keys)
  const appear = progress(frame, keys[0].at - 10, 10)
  const vanish = hideAt === undefined ? 0 : progress(frame, hideAt, 10)
  const opacity = appear * (1 - vanish)
  const lastClick = [...keys].reverse().find(k => k.click && frame >= k.at)
  const since = lastClick ? frame - lastClick.at : 99
  const dragging = keys.some((k, i) => k.drag && i > 0 && frame >= keys[i - 1].at && frame <= k.at)
  const press = dragging ? 0.86 : since < 8 ? interpolate(since, [0, 3, 8], [1, 0.82, 1], clamp) : 1
  const ripple = since < 22 ? since / 22 : 1
  const pressed = lastClick?.press && since < 12 ? interpolate(since, [0, 2, 12], [0, 1, 0], clamp) : 0

  return (
    <>
      {pressed > 0 && lastClick?.press ? (
        <div
          style={{
            position: 'absolute',
            left: lastClick.press[0],
            top: lastClick.press[1],
            width: lastClick.press[2],
            height: lastClick.press[3],
            borderRadius: Math.min(10, lastClick.press[3] / 2),
            background: 'rgba(15, 17, 22, 0.16)',
            boxShadow: 'inset 0 1px 3px rgba(15, 17, 22, 0.2)',
            opacity: pressed,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      <div style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', opacity }}>
        {since < 22 && lastClick ? (
          <div
            style={{
              position: 'absolute',
              left: lastClick.x - 30,
              top: lastClick.y - 30,
              width: 60,
              height: 60,
              borderRadius: '50%',
              border: `3px solid ${theme.brand}`,
              opacity: 1 - ripple,
              transform: `scale(${0.3 + ripple * 0.9})`,
            }}
          />
        ) : null}
        <svg
          width={34}
          height={34}
          viewBox="0 0 30 32"
          style={{
            position: 'absolute',
            left: x - 5,
            top: y - 3,
            transform: `scale(${press})`,
            transformOrigin: '5px 3px',
            filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))',
          }}
        >
          <path d={CURSOR_PATH} fill="#fff" stroke="#111" strokeWidth={1.6} strokeLinejoin="round" />
        </svg>
      </div>
    </>
  )
}

export { Spotlight } from './Spotlight'

/** A short label pinned beside a box, drawn in page coordinates. */
export const Callout: FC<{
  box: Box
  from: number
  to: number
  text: string
  side?: 'right' | 'left' | 'top' | 'bottom'
  size?: number
}> = ({ box, from, to, text, side = 'right', size = 20 }) => {
  const frame = useCurrentFrame()
  const opacity = progress(frame, from + 4, 10) * (1 - progress(frame, to - 8, 8, easeInOut))
  if (opacity <= 0) return null
  const [x, y, w, h] = box
  const gap = 18
  const lift = interpolate(progress(frame, from + 4, 14, easeOut), [0, 1], [10, 0])
  const pos: CSSProperties =
    side === 'right'
      ? { left: x + w + gap + lift, top: y + h / 2, transform: 'translateY(-50%)' }
      : side === 'left'
        ? { left: x - gap - lift, top: y + h / 2, transform: 'translate(-100%, -50%)' }
        : side === 'top'
          ? { left: x + w / 2, top: y - gap - lift, transform: 'translate(-50%, -100%)' }
          : { left: x + w / 2, top: y + h + gap + lift, transform: 'translateX(-50%)' }
  return (
    <div
      style={{
        position: 'absolute',
        ...pos,
        opacity,
        whiteSpace: 'nowrap',
        padding: `${size * 0.32}px ${size * 0.62}px`,
        borderRadius: size * 0.5,
        background: theme.paperInk,
        color: theme.text,
        fontFamily: fonts.sans,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: 0.5,
        boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
        pointerEvents: 'none',
      }}
    >
      {text}
    </div>
  )
}
