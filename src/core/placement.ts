import type { Device, Placement } from '../types'
import { clamp01 } from './coordinate'

/** 判断某设备是否已放置（点位列表中是否存在该 deviceId） */
export function isPlaced(list: readonly Placement[], deviceId: string): boolean {
  return list.some((p) => p.deviceId === deviceId)
}

/**
 * upsert：有则更新坐标，无则追加。返回新数组（不修改入参）。
 * 从代码层面坐实 PRD 的"一设备一点位"——同一 deviceId 永远只有一条。
 */
export function upsertPlacement(
  list: readonly Placement[],
  deviceId: string,
  x: number,
  y: number,
): Placement[] {
  let found = false
  const next = list.map((p) => {
    if (p.deviceId === deviceId) {
      found = true
      return { ...p, x, y }
    }
    return p
  })
  if (!found) {
    next.push({ deviceId, x, y })
  }
  return next
}

/** 删除某设备的点位，返回新数组（不修改入参） */
export function removePlacement(list: readonly Placement[], deviceId: string): Placement[] {
  return list.filter((p) => p.deviceId !== deviceId)
}

/**
 * 清洗点位数据（用于回显时兜底）：
 * - 过滤设备清单中不存在的 deviceId（PRD §8 未知 id 忽略）
 * - 去重同一 deviceId，仅保留第一条（坚守一设备一点位）
 * - 坐标 clamp 到 0~1
 */
export function sanitizePlacements(
  list: readonly Placement[],
  devices: readonly Device[],
): Placement[] {
  const validIds = new Set(devices.map((d) => d.id))
  const seen = new Set<string>()
  const result: Placement[] = []
  for (const p of list) {
    if (!validIds.has(p.deviceId)) continue
    if (seen.has(p.deviceId)) continue
    seen.add(p.deviceId)
    result.push({ deviceId: p.deviceId, x: clamp01(p.x), y: clamp01(p.y) })
  }
  return result
}
