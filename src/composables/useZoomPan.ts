import { computed, onUnmounted, reactive, watch, type Ref } from 'vue'

/** 缩放下限：1 = 适应画布（底图完整可见），不允许缩得更小 */
const MIN_SCALE = 1
/** 缩放上限；导出供 useCluster.ts 判断"是否已到最大缩放"，触发聚合摊开兜底 */
export const MAX_SCALE = 6
/** 滚轮灵敏度：deltaY → 缩放因子的指数系数 */
const WHEEL_SENSITIVITY = 0.0015

interface ZoomState {
  scale: number
  /** 叠加在 flex 布局之上的平移量（像素，作用于 .dp-bg-wrap） */
  tx: number
  ty: number
  /** 是否正在平移（拖动空白区域） */
  panning: boolean
  /** 是否处于"聚焦到某区域"的瞬时过渡窗口内，仅用于驱动一次性 CSS transition */
  focusing: boolean
}

/**
 * 画布滚轮缩放 + 拖拽平移。
 *
 * 变换以 `.dp-bg-wrap` 的左上角为原点（transform-origin: 0 0），
 * 形式为 `translate(tx, ty) scale(scale)`。底图与点位层同属该容器，
 * 一起缩放；点位坐标换算依赖 getBoundingClientRect，缩放后天然正确。
 *
 * @param canvasEl 画布外框（裁剪区，作为平移钳制的边界）
 * @param wrapEl   底图包裹层（被施加变换的元素）
 * @param enabled  是否启用缩放/平移（getter）；关闭时滚轮/拖动不生效并复位视图
 */
export function useZoomPan(
  canvasEl: Ref<HTMLElement | null>,
  wrapEl: Ref<HTMLElement | null>,
  enabled: () => boolean = () => true,
) {
  const state = reactive<ZoomState>({ scale: 1, tx: 0, ty: 0, panning: false, focusing: false })

  /**
   * 反推变换前的基准矩形（scale=1、tx=ty=0 时的位置/尺寸）。
   * 由当前实测矩形与当前 state 还原：W.left = base.left + tx，W.width = base.width * scale。
   */
  function getBase() {
    const wrap = wrapEl.value
    if (!wrap) return null
    const w = wrap.getBoundingClientRect()
    return {
      left: w.left - state.tx,
      top: w.top - state.ty,
      width: w.width / state.scale,
      height: w.height / state.scale,
    }
  }

  /**
   * 基准尺寸（scale=1 时的像素宽高），供聚合分组换算像素距离用。
   * 用 offsetWidth/offsetHeight 而非 getBoundingClientRect()/scale：CSS transform 不影响
   * 元素自身的布局尺寸（offsetWidth 天然就是"未缩放"的值），避免了 scale 刚变化、
   * 浏览器尚未完成该帧重绘时 getBoundingClientRect 读到旧视觉尺寸、与已经更新的
   * state.scale 数值错配导致算出错误基准尺寸的时序问题；也天然不读 tx/ty，
   * 保证响应式依赖里不含平移量，平移时不触发重新分组。
   */
  function getBaseSize() {
    const wrap = wrapEl.value
    if (!wrap) return null
    if (wrap.offsetWidth <= 0 || wrap.offsetHeight <= 0) return null
    return { width: wrap.offsetWidth, height: wrap.offsetHeight }
  }

  /** 把目标平移钳制在边界内：内容大于画布时不留黑边，小于画布时居中 */
  function clampTranslate(tx: number, ty: number, scale: number) {
    const canvas = canvasEl.value
    const base = getBase()
    if (!canvas || !base) return { tx, ty }
    const c = canvas.getBoundingClientRect()
    const w = base.width * scale
    const h = base.height * scale

    // 目标内容左/上边在视口中的位置 = base.left + tx
    function axis(baseStart: number, t: number, size: number, cStart: number, cSize: number) {
      if (size <= cSize) {
        // 内容更小：居中
        return cStart + (cSize - size) / 2 - baseStart
      }
      // 内容更大：限制在 [cEnd - size, cStart] 之间，避免出现空隙
      const min = cStart + cSize - size - baseStart
      const max = cStart - baseStart
      const desired = t
      return Math.min(max, Math.max(min, desired))
    }

    return {
      tx: axis(base.left, tx, w, c.left, c.width),
      ty: axis(base.top, ty, h, c.top, c.height),
    }
  }

  /** 滚轮：以光标为焦点缩放 */
  function onWheel(e: WheelEvent) {
    if (!enabled()) return
    if (!wrapEl.value) return
    e.preventDefault()

    const base = getBase()
    if (!base) return

    const nextScale = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, state.scale * Math.exp(-e.deltaY * WHEEL_SENSITIVITY)),
    )
    if (nextScale === state.scale) return

    // 光标下的内容点（未缩放局部坐标），缩放后保持落在光标处
    const ux = (e.clientX - (base.left + state.tx)) / state.scale
    const uy = (e.clientY - (base.top + state.ty)) / state.scale
    const tx = e.clientX - base.left - ux * nextScale
    const ty = e.clientY - base.top - uy * nextScale

    const clamped = clampTranslate(tx, ty, nextScale)
    state.scale = nextScale
    state.tx = clamped.tx
    state.ty = clamped.ty
  }

  let startX = 0
  let startY = 0
  let startTx = 0
  let startTy = 0

  function onPanMove(e: PointerEvent) {
    const clamped = clampTranslate(
      startTx + (e.clientX - startX),
      startTy + (e.clientY - startY),
      state.scale,
    )
    state.tx = clamped.tx
    state.ty = clamped.ty
  }

  function onPanUp() {
    state.panning = false
    window.removeEventListener('pointermove', onPanMove)
    window.removeEventListener('pointerup', onPanUp)
    window.removeEventListener('pointercancel', onPanUp)
  }

  /** 在空白区域按下开始平移（marker 已 stopPropagation，不会进入这里） */
  function onPanStart(e: PointerEvent) {
    if (!enabled()) return
    if (e.button !== 0) return
    if (state.scale <= MIN_SCALE) return // 未放大时无需平移
    startX = e.clientX
    startY = e.clientY
    startTx = state.tx
    startTy = state.ty
    state.panning = true
    window.addEventListener('pointermove', onPanMove)
    window.addEventListener('pointerup', onPanUp)
    window.addEventListener('pointercancel', onPanUp)
  }

  /** 复位到适应画布 */
  function resetView() {
    state.scale = 1
    state.tx = 0
    state.ty = 0
  }

  let focusTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * 聚焦到指定区域（用于"点击聚合圆点"）：自动计算合适的 scale 让目标区域完整、居中
   * 进入可视区域，并短暂置位 state.focusing 驱动一次性过渡动画（不影响滚轮/拖拽手感）。
   *
   * @param rect 目标区域，字段为 scale=1 时的局部坐标（即 getBase() 所在的坐标系）
   * @param opts.padding 目标区域四周预留的可视留白（像素），默认 48
   */
  function focusRect(
    rect: { left: number; top: number; width: number; height: number },
    opts?: { padding?: number },
  ) {
    const canvas = canvasEl.value
    const base = getBase()
    if (!canvas || !base) return
    const c = canvas.getBoundingClientRect()
    const padding = opts?.padding ?? 48

    // 目标区域可能退化成一个点（簇内成员坐标完全重合），兜底最小尺寸避免除零
    const targetW = Math.max(rect.width, 1)
    const targetH = Math.max(rect.height, 1)
    const availW = Math.max(c.width - padding * 2, 1)
    const availH = Math.max(c.height - padding * 2, 1)

    // 取宽高两个方向里更保守（更小）的缩放比，保证目标区域完整可见，不必贴边填满
    const rawScale = Math.min(availW / targetW, availH / targetH)
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale))

    const centerX = rect.left + targetW / 2
    const centerY = rect.top + targetH / 2
    const tx = c.left + c.width / 2 - base.left - centerX * nextScale
    const ty = c.top + c.height / 2 - base.top - centerY * nextScale

    const clamped = clampTranslate(tx, ty, nextScale)
    state.scale = nextScale
    state.tx = clamped.tx
    state.ty = clamped.ty

    state.focusing = true
    if (focusTimer != null) clearTimeout(focusTimer)
    focusTimer = setTimeout(() => {
      state.focusing = false
      focusTimer = null
    }, 260)
  }

  const wrapStyle = computed(() => ({
    transform: `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`,
    transformOrigin: '0 0',
  }))

  // 关闭缩放时复位视图，避免停留在已放大/平移的状态
  watch(enabled, (on) => {
    if (!on) {
      onPanUp()
      resetView()
    }
  })

  onUnmounted(() => {
    onPanUp()
    if (focusTimer != null) clearTimeout(focusTimer)
  })

  return { state, wrapStyle, onWheel, onPanStart, resetView, focusRect, getBase, getBaseSize }
}
