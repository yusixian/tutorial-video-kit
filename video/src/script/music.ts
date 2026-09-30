/**
 * Background tracks: `file` is relative to `public/`, `credit` is printed in the upload kits.
 * The demo bed is synthesized by `pnpm sfx`; put licensed tracks in `public/audio/bgm/`
 * and list them here with the attribution their license asks for.
 */
export const TRACKS = {
  'demo-bed': { file: 'audio/sfx/demo-bed.wav', credit: ['示例配乐由 video/scripts/sfx.ts 代码合成'] },
} satisfies Record<string, { file: string; credit: string[] }>

export type TrackId = keyof typeof TRACKS
