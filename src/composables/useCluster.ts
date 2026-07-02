import { computed, onUnmounted, ref, type ComputedRef } from 'vue'
import type { ClusterMember, Device, Placement } from '../types'
import { clusterize, spiderfyOffsets, type ClusterInput } from '../core/cluster'
import { clamp01 } from '../core/coordinate'
import { MAX_SCALE } from './useZoomPan'

export interface ClusterRenderItem {
  kind: 'single' | 'cluster'
  /** single 用 deviceId，cluster 用簇 id，与现有 :key="item.placement.deviceId" 取值方式对齐 */
  key: string
  /** 归一化坐标，供渲染 left/top: % 用 */
  x: number
  y: number
  device?: Device
  placement?: Placement
  members?: ClusterMember[]
}

export interface UseClusterOptions {
  items: () => ClusterMember[]
  /** 归一化坐标 → 像素的换算基准（scale=1 时的宽高）；返回 null 表示尚不可用 */
  getBaseSize: () => { width: number; height: number } | null
  scale: () => number
  /** 是否启用聚合（由调用方综合 readonly / cluster prop / 底图是否就绪 判断） */
  enabled: () => boolean
  /**
   * 用于探测实际 marker 像素尺寸的容器元素。
   * 必须传未被 CSS transform 缩放的祖先节点（如画布外框），不能传被 scale(zoom) 施加的
   * 元素（如底图 wrap）——否则兜底探测出的 px 会被当前缩放倍数放大，聚合半径随 scale
   * 等比膨胀，导致放大后聚合永远不拆分。
   */
  markerSizeEl: () => HTMLElement | null
}

const DEFAULT_MARKER_SIZE = 32
const MIN_COUNT = 2
const RADIUS_FACTOR = 1.2
/** 摊开环半径相对聚合半径的倍数，保证摊开后的独立点位彼此不贴在一起 */
const SPIDERFY_RADIUS_FACTOR = 1.5

/**
 * 探测运行时实际生效的 marker 像素尺寸：优先读画布内真实渲染的 .dp-marker-icon
 * 元素尺寸（浏览器已完成任意单位换算的最终 px 值，最可靠）；画布内暂无独立 marker
 * （比如全部被聚合）时，退化为用隐藏探测元素解析 --dp-marker-size 变量的实际单位。
 * 兜底分支要求 el 不在被 transform scale 的子树内，否则探测值会被缩放污染。
 */
function readMarkerSizePx(el: HTMLElement | null): number {
  if (!el) return DEFAULT_MARKER_SIZE
  const iconEl = el.querySelector('.dp-marker-icon') as HTMLElement | null
  if (iconEl) {
    const w = iconEl.getBoundingClientRect().width
    if (w > 0) return w
  }
  return resolveCssLengthVar(el, '--dp-marker-size', DEFAULT_MARKER_SIZE)
}

/** 借助一个挂载在同一父级下的隐藏元素，让浏览器完成 rem/em/px 等单位换算，而不是自己写正则解析 */
function resolveCssLengthVar(referenceEl: HTMLElement, varName: string, fallback: number): number {
  const raw = getComputedStyle(referenceEl).getPropertyValue(varName).trim()
  if (!raw) return fallback
  const probe = document.createElement('div')
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  probe.style.pointerEvents = 'none'
  probe.style.width = raw
  referenceEl.appendChild(probe)
  const px = probe.getBoundingClientRect().width
  probe.remove()
  return px > 0 ? px : fallback
}

function toSingle(item: ClusterMember): ClusterRenderItem {
  return {
    kind: 'single',
    key: item.placement.deviceId,
    x: item.placement.x,
    y: item.placement.y,
    device: item.device,
    placement: item.placement,
  }
}

/**
 * 把"已放大到最大缩放仍会合并"的簇按环形摊开成独立渲染项：位置仅用于渲染（不回写
 * 到真实 placement），围绕簇心按固定像素半径展开，换算成归一化坐标时需除以
 * "当前 scale"（此时恒为 MAX_SCALE），与聚合判定用的像素距离公式保持同一量纲。
 */
function spiderfyGroup(
  members: ClusterMember[],
  base: { width: number; height: number },
  scale: number,
  ringRadiusPx: number,
): ClusterRenderItem[] {
  const seed = members[0].placement
  const offsets = spiderfyOffsets(members.length, ringRadiusPx)
  return members.map((member, i) => {
    const offset = offsets[i]
    const x = clamp01(seed.x + offset.dx / (base.width * scale))
    const y = clamp01(seed.y + offset.dy / (base.height * scale))
    return {
      kind: 'single',
      key: member.placement.deviceId,
      x,
      y,
      device: member.device,
      placement: { ...member.placement, x, y },
    }
  })
}

/**
 * 点位聚合的响应式包装层：enabled() 为 false 时直接恒等映射成独立点位（不跑聚合算法，
 * 保证关闭聚合时行为与现状完全一致）；为 true 时按当前 scale 换算像素距离分组。
 */
export function useCluster(options: UseClusterOptions) {
  // 容器尺寸变化不是响应式的（getBoundingClientRect 不参与 Vue 依赖收集），
  // 用 ResizeObserver 桥接成一个响应式计数器
  const resizeTick = ref(0)
  let ro: ResizeObserver | null = null

  function observeResize(el: HTMLElement | null) {
    ro?.disconnect()
    ro = null
    if (!el) return
    ro = new ResizeObserver(() => {
      resizeTick.value++
    })
    ro.observe(el)
  }

  onUnmounted(() => ro?.disconnect())

  const groups: ComputedRef<ClusterRenderItem[]> = computed(() => {
    const items = options.items()
    // 只 touch 一下建立依赖，值本身不使用
    void resizeTick.value

    if (!options.enabled()) {
      return items.map(toSingle)
    }

    const base = options.getBaseSize()
    if (!base) {
      return items.map(toSingle)
    }

    const scale = options.scale()
    const radiusPx = readMarkerSizePx(options.markerSizeEl()) * RADIUS_FACTOR

    const memberMap = new Map(items.map((item) => [item.placement.deviceId, item]))
    const inputs: ClusterInput[] = items.map((item) => ({
      id: item.placement.deviceId,
      x: item.placement.x * base.width * scale,
      y: item.placement.y * base.height * scale,
    }))

    return clusterize(inputs, { radiusPx, minCount: MIN_COUNT }).flatMap((group) => {
      if (group.items.length === 1) {
        return [toSingle(memberMap.get(group.items[0].id)!)]
      }
      const members = group.items.map((i) => memberMap.get(i.id)!)
      if (scale >= MAX_SCALE) {
        // 已经到最大缩放仍会聚合：说明这批点位的间距/重合程度超出了"靠放大拆分"的能力
        // 范围，改为环形摊开成独立点位，保证"放大到底"或"点击聚合点后自动缩放到底"
        // 两种路径都不会再剩下无法访问的数字圆点
        return spiderfyGroup(members, base, scale, radiusPx * SPIDERFY_RADIUS_FACTOR)
      }
      const seed = members[0]
      return [
        {
          kind: 'cluster' as const,
          key: group.id,
          x: seed.placement.x,
          y: seed.placement.y,
          members,
        },
      ]
    })
  })

  return { groups, observeResize }
}
