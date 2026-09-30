import type { FC } from 'react'
import { Composition, Folder, Still } from 'remotion'
import { Cover } from './cover/Cover'
import { Episode } from './episode/Episode'
import { entries } from './episode/entries'
import { FPS } from './lib/timeline'
import { FRAME } from './theme'

const COVER_SIZES = [
  { ratio: '16x9', width: 1920, height: 1080 },
  { ratio: '4x3', width: 1440, height: 1080 },
]

// Scene components are functions, which composition props cannot carry (they
// are serialized), so every episode gets a prop-less wrapper instead.
const episodeComponents = entries.map(({ script, registry, timing, music }) => {
  const Component: FC = () => <Episode timing={timing} registry={registry} sectionTitles={script.sections} music={music} />
  return { id: script.id.toUpperCase(), Component, duration: timing.duration }
})

export const RemotionRoot = () => (
  <>
    <Folder name="episodes">
      {episodeComponents.map(({ id, Component, duration }) => (
        <Composition key={id} id={id} component={Component} durationInFrames={duration} fps={FPS} width={FRAME.width} height={FRAME.height} />
      ))}
    </Folder>
    <Folder name="covers">
      {[...entries.map(e => e.script.id), 'all'].flatMap(episode =>
        COVER_SIZES.map(({ ratio, width, height }) => (
          <Still key={`${episode}-${ratio}`} id={`Cover-${episode.toUpperCase()}-${ratio}`} component={Cover} width={width} height={height} defaultProps={{ episode }} />
        )),
      )}
    </Folder>
  </>
)
