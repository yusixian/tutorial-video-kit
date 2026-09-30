import { Children, type FC, Fragment, isValidElement, type ReactNode, useId } from 'react'
import { interpolate, useCurrentFrame } from 'remotion'
import { easeInOut, progress } from '../lib/anim'
import type { Box } from '../lib/boxes'
import { theme } from '../theme'

export type SpotlightProps = {
  box: Box
  from: number
  to: number
  dim?: number
  radius?: number
  color?: string
}

/** A spotlight starting within this many frames after (or `CHAIN_OVERLAP` before) the previous one ends takes over by moving. */
const CHAIN_GAP = 12
const CHAIN_OVERLAP = 20
const MORPH = 12
/** Page pixels the dim extends past the page, enough for the widest camera view. */
const BLEED = 600
const SIZE = { w: 1920 + BLEED * 2, h: 1080 + BLEED * 2 }

type Lit = { box: Box; radius: number; dim: number; color: string; opacity: number; grow: number }

const chainSpots = (spots: SpotlightProps[]) => {
  const chains: SpotlightProps[][] = []
  for (const spot of [...spots].sort((a, b) => a.from - b.from)) {
    const chain = chains.find(c => {
      const last = c[c.length - 1]
      const gap = spot.from - last.to
      return gap <= CHAIN_GAP && gap >= -CHAIN_OVERLAP && (last.color ?? theme.accent) === (spot.color ?? theme.accent)
    })
    if (chain) chain.push(spot)
    else chains.push([spot])
  }
  return chains
}

const chainAt = (chain: SpotlightProps[], frame: number): Lit | null => {
  const first = chain[0]
  const last = chain[chain.length - 1]
  const inP = progress(frame, first.from, 10)
  const opacity = inP * (1 - progress(frame, last.to - 8, 8, easeInOut))
  if (opacity <= 0) return null
  let box = first.box
  let radius = first.radius ?? 12
  let dim = first.dim ?? 0.4
  for (const spot of chain.slice(1)) {
    if (frame < spot.from) break
    const p = progress(frame, spot.from, MORPH, easeInOut)
    box = box.map((v, i) => v + (spot.box[i] - v) * p) as Box
    radius += ((spot.radius ?? 12) - radius) * p
    dim += ((spot.dim ?? 0.4) - dim) * p
  }
  return { box, radius, dim, color: first.color ?? theme.accent, opacity, grow: interpolate(inP, [0, 1], [10, 0]) }
}

/**
 * Spotlights sharing one dim: boxes that follow each other glide from one to
 * the next instead of blinking off and on, and boxes lit at the same time each
 * keep their own hole.
 */
export const SpotlightLayer: FC<{ spots: SpotlightProps[] }> = ({ spots }) => {
  const frame = useCurrentFrame()
  const maskId = useId()
  const lit = chainSpots(spots)
    .map(chain => chainAt(chain, frame))
    .filter((l): l is Lit => l !== null)
  if (!lit.length) return null
  const dim = Math.max(...lit.map(l => l.dim * l.opacity))
  const peak = Math.max(...lit.map(l => l.opacity))
  const rect = (l: Lit, extra = 0) => {
    const [x, y, w, h] = l.box
    const out = l.grow + extra
    return { x: x - out + BLEED, y: y - out + BLEED, width: w + out * 2, height: h + out * 2, rx: l.radius + extra }
  }
  return (
    <svg width={SIZE.w} height={SIZE.h} style={{ position: 'absolute', left: -BLEED, top: -BLEED, pointerEvents: 'none' }}>
      <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={SIZE.w} height={SIZE.h}>
        <rect width={SIZE.w} height={SIZE.h} fill="#fff" />
        {lit.map((l, i) => (
          <rect key={i} {...rect(l)} fill="#000" fillOpacity={l.opacity / peak} />
        ))}
      </mask>
      <rect width={SIZE.w} height={SIZE.h} fill="rgb(10, 12, 16)" fillOpacity={dim} mask={`url(#${maskId})`} />
      {lit.map((l, i) => (
        <g key={i} opacity={l.opacity} fill="none">
          <rect {...rect(l, 5.5)} stroke={l.color} strokeOpacity={0.22} strokeWidth={5} />
          <rect {...rect(l, 1.5)} stroke={l.color} strokeWidth={3} />
        </g>
      ))}
    </svg>
  )
}

/** Dims everything outside `box` and outlines it. Siblings inside a `Stage` are merged into one `SpotlightLayer`. */
export const Spotlight: FC<SpotlightProps> = props => <SpotlightLayer spots={[props]} />

/** Replaces the `Spotlight` elements in `children` (through fragments and arrays) with one layer where the first stood. */
export const gatherSpotlights = (children: ReactNode): ReactNode => {
  const spots: SpotlightProps[] = []
  const walk = (node: ReactNode): ReactNode =>
    Children.map(node, child => {
      if (!isValidElement(child)) return child
      if (child.type === Fragment) return walk((child.props as { children?: ReactNode }).children)
      if (child.type !== Spotlight) return child
      spots.push(child.props as SpotlightProps)
      return spots.length === 1 ? <SpotlightLayer key="spotlights" spots={spots} /> : null
    })
  const rest = walk(children)
  return spots.length > 1 ? rest : children
}
