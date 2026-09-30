import { Audio } from '@remotion/media'
import type { FC } from 'react'
import { Sequence, staticFile } from 'remotion'

/** The sounds `pnpm sfx` synthesizes into `public/audio/sfx/`. */
export type SfxName = 'click' | 'pop' | 'whoosh' | 'chime'

export const Sfx: FC<{ at: number; name: SfxName; volume?: number }> = ({ at, name, volume = 0.6 }) => (
  <Sequence from={Math.round(at)} durationInFrames={45} layout="none">
    <Audio src={staticFile(`audio/sfx/${name}.wav`)} volume={volume} />
  </Sequence>
)
