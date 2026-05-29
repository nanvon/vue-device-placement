import type { Point } from '../types'

/** 底图实际渲染区域的矩形（取自 getBoundingClientRect 的子集） */
export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

/**
 * 把任意数值钳制到 [0, 1] 区间。
 * NaN 视为 0，保证坐标恒合法（对应"拖出底图被限制在范围内"）。
 */
export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/**
 * 把页面像素坐标换算为相对底图的归一化坐标（0~1）。
 *
 * @param clientX 鼠标相对视口的 X（如 PointerEvent.clientX）
 * @param clientY 鼠标相对视口的 Y
 * @param rect    底图图片实际渲染区域（getBoundingClientRect 结果）
 * @returns       归一化坐标，已 clamp 到 [0,1]
 */
export function toNormalized(clientX: number, clientY: number, rect: Rect): Point {
  // 尺寸非法时不做除零，返回原点
  if (rect.width <= 0 || rect.height <= 0) {
    return { x: 0, y: 0 }
  }
  return {
    x: clamp01((clientX - rect.left) / rect.width),
    y: clamp01((clientY - rect.top) / rect.height),
  }
}
