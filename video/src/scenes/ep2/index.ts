import type { SceneDef } from '../../episode/Episode'
import { Check, Publish, Title } from './delivery'

export const ep2Scenes: Record<string, SceneDef> = {
  'ep2-title': { component: Title, fullscreen: true },
  'ep2-check': { component: Check },
  'ep2-publish': { component: Publish },
}
