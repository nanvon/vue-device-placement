import type { App, Plugin } from 'vue'
import './styles/index.css'
import DevicePlacement from './components/DevicePlacement.vue'

export function install(app: App) {
  app.component('DevicePlacement', DevicePlacement)
}

const plugin = DevicePlacement as typeof DevicePlacement & Plugin
plugin.install = install

export { DevicePlacement }
export default plugin

// 类型
export type { ClusterMember, Device, PaletteNode, Placement, Point } from './types'

// 核心纯函数（供需要在组件外处理点位数据的高级用户使用）
export {
  isPlaced,
  upsertPlacement,
  removePlacement,
  sanitizePlacements,
} from './core/placement'
export { clamp01, toNormalized } from './core/coordinate'
export type { Rect } from './core/coordinate'
export { clusterize, boundingBoxOf } from './core/cluster'
export type { ClusterInput, ClusterGroup, ClusterizeOptions } from './core/cluster'
