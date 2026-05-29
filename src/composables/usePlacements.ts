import { computed } from 'vue'
import type { Placement } from '../types'
import { isPlaced, removePlacement, upsertPlacement } from '../core/placement'

/** write 触发的语义事件类型：silent 仅更新数据（拖动跟手），place/move 额外抛语义事件 */
export type WriteKind = 'silent' | 'place' | 'move'

export interface UsePlacementsOptions {
  /** 当前（已清洗的）点位数组，getter 形式 */
  placements: () => Placement[]
  /** 完整数组变更（v-model:placements） */
  onUpdate: (next: Placement[]) => void
  /** 新建点位语义事件 */
  onPlace: (deviceId: string, x: number, y: number) => void
  /** 移动点位语义事件 */
  onMove: (deviceId: string, x: number, y: number) => void
  /** 删除点位语义事件 */
  onRemove: (deviceId: string) => void
}

/**
 * 点位状态编排：基于"完整数组 + 语义事件"两套出口（对应技术方案 §3.2）。
 * 不直接持有点位状态，而是从受控的 placements() 派生，所有变更产出新数组向上抛。
 */
export function usePlacements(options: UsePlacementsOptions) {
  /** 已放置设备集合（派生计算，不单独存状态） */
  const placedSet = computed(() => new Set(options.placements().map((p) => p.deviceId)))

  function isPlacedDevice(deviceId: string): boolean {
    return isPlaced(options.placements(), deviceId)
  }

  /**
   * 写入一个点位坐标（upsert）。
   * - 'silent'：仅 emit update:placements（拖动过程中跟手）
   * - 'place' / 'move'：额外抛对应语义事件（落点提交时）
   */
  function write(deviceId: string, x: number, y: number, kind: WriteKind): void {
    const next = upsertPlacement(options.placements(), deviceId, x, y)
    options.onUpdate(next)
    if (kind === 'place') options.onPlace(deviceId, x, y)
    else if (kind === 'move') options.onMove(deviceId, x, y)
  }

  function remove(deviceId: string): void {
    if (!isPlacedDevice(deviceId)) return
    options.onUpdate(removePlacement(options.placements(), deviceId))
    options.onRemove(deviceId)
  }

  return { placedSet, isPlaced: isPlacedDevice, write, remove }
}
