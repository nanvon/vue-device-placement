import './styles/index.css'
import DevicePlacement from './components/DevicePlacement.vue'

export { DevicePlacement }
export default DevicePlacement

// 类型
export type { Device, Placement, Point } from './types'

// 核心纯函数（供需要在组件外处理点位数据的高级用户使用）
export {
  isPlaced,
  upsertPlacement,
  removePlacement,
  sanitizePlacements,
} from './core/placement'
export { clamp01, toNormalized } from './core/coordinate'
export type { Rect } from './core/coordinate'
