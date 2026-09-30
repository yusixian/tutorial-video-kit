import type { SceneDef } from '../../episode/Episode'
import { Pipeline, ScriptData, Title } from './intro'
import { Panel } from './panel'
import { Outro, Voice } from './voice'

export const ep1Scenes: Record<string, SceneDef> = {
  'ep1-title': { component: Title, fullscreen: true },
  'ep1-pipeline': { component: Pipeline },
  'ep1-script': { component: ScriptData },
  'ep1-panel': { component: Panel },
  'ep1-voice': { component: Voice, dip: true },
  'ep1-outro': { component: Outro },
}
