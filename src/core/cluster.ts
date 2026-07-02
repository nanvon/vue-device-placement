/** 参与聚合判定的单个点位，坐标为调用方已换算好的"当前 scale 下"的屏幕像素坐标 */
export interface ClusterInput {
  id: string
  x: number
  y: number
}

/**
 * 一个分组结果：可能是"聚合簇"（items.length >= minCount）也可能是"未达标的独立点"
 * （items.length < minCount，调用方应按独立 marker 渲染）。
 * 锚点坐标取种子点坐标，不额外计算质心，保持简单。
 */
export interface ClusterGroup {
  /** 用种子 id 派生，保证同一批输入下 key 稳定 */
  id: string
  items: ClusterInput[]
  x: number
  y: number
}

export interface ClusterizeOptions {
  /** 聚合半径（像素），与 items 的 x/y 同一量纲 */
  radiusPx: number
  /** 簇内成员数达到该值才算"聚合簇"，否则各自独立 */
  minCount: number
}

/**
 * 贪心按种子点像素距离分组（单遍扫描）：
 * 以未分组点为种子，收纳"到种子欧氏距离 <= radiusPx"的其余未分组点入同一簇。
 * 距离恒以种子为基准（而非簇内任意成员），避免 A-B 近、B-C 近但 A-C 远时被链式并成一簇，
 * 簇的地理跨度因此被限制在 2 * radiusPx 内，形状可预测。
 */
export function clusterize(items: ClusterInput[], options: ClusterizeOptions): ClusterGroup[] {
  const { radiusPx, minCount } = options
  const groups: ClusterGroup[] = []
  const visited = new Array<boolean>(items.length).fill(false)

  for (let i = 0; i < items.length; i++) {
    if (visited[i]) continue
    const seed = items[i]
    visited[i] = true
    const members: ClusterInput[] = [seed]

    if (radiusPx > 0) {
      for (let j = i + 1; j < items.length; j++) {
        if (visited[j]) continue
        const other = items[j]
        const dx = other.x - seed.x
        const dy = other.y - seed.y
        if (Math.sqrt(dx * dx + dy * dy) <= radiusPx) {
          visited[j] = true
          members.push(other)
        }
      }
    }

    if (members.length >= minCount) {
      groups.push({ id: `cluster:${seed.id}`, items: members, x: seed.x, y: seed.y })
    } else {
      for (const m of members) {
        groups.push({ id: m.id, items: [m], x: m.x, y: m.y })
      }
    }
  }

  return groups
}

/** 计算一组归一化坐标点的最小包围盒（用于"聚焦到某簇"换算目标区域） */
export function boundingBoxOf(points: Array<{ x: number; y: number }>): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }
  let minX = points[0].x
  let minY = points[0].y
  let maxX = points[0].x
  let maxY = points[0].y
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}
