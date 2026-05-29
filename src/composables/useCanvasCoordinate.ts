import type { Ref } from 'vue'
import type { Point } from '../types'
import { toNormalized, type Rect } from '../core/coordinate'

/**
 * 画布坐标换算：以"底图图片实际渲染区域"为基准（技术方案 §6.2）。
 * 只在拖拽这一刻临时 getBoundingClientRect 取一次，点位渲染本身用百分比，无需 JS 重算。
 */
export function useCanvasCoordinate(imgEl: Ref<HTMLImageElement | null>) {
  function getRect(): Rect | null {
    const el = imgEl.value
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return null
    return { left: r.left, top: r.top, width: r.width, height: r.height }
  }

  /** 像素 → 归一化坐标（已 clamp 到 0~1）；底图不可用时返回 null */
  function toRelative(clientX: number, clientY: number): Point | null {
    const rect = getRect()
    if (!rect) return null
    return toNormalized(clientX, clientY, rect)
  }

  /** 判断像素点是否落在底图渲染区域内 */
  function isInside(clientX: number, clientY: number): boolean {
    const rect = getRect()
    if (!rect) return false
    return (
      clientX >= rect.left &&
      clientX <= rect.left + rect.width &&
      clientY >= rect.top &&
      clientY <= rect.top + rect.height
    )
  }

  return { getRect, toRelative, isInside }
}
