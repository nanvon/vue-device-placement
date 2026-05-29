import { onUnmounted, reactive } from 'vue'

export type DragMode = 'create' | 'move'

interface DragState {
  /** 是否处于拖拽态 */
  active: boolean
  deviceId: string | null
  mode: DragMode | null
  /** 当前光标视口坐标（给跟随光标的浮层定位用） */
  pointerX: number
  pointerY: number
  /** 是否已越过移动阈值（区分"点击"与"拖动"） */
  moved: boolean
  /** 当前光标是否在底图区域内 */
  insideCanvas: boolean
}

export interface UseDragOptions {
  toRelative: (clientX: number, clientY: number) => { x: number; y: number } | null
  isInside: (clientX: number, clientY: number) => boolean
  /** 画布内移动时实时跟手（仅 move 模式触发） */
  onPreview: (deviceId: string, x: number, y: number) => void
  /** 松手提交：moved 表示是否真正拖动过（false 视为点击） */
  onDrop: (deviceId: string, mode: DragMode, x: number, y: number, moved: boolean) => void
}

/** 超过该像素位移才算"拖动"，避免轻点也触发拖拽与浮层闪烁 */
const MOVE_THRESHOLD = 3

/**
 * 统一的指针拖拽（技术方案 §6.1）：两条路径共用一套逻辑。
 * - 'create'：从左侧列表拖到画布 → 落在画布内才提交，过程中只显示跟随浮层；
 * - 'move'  ：画布内拖动已有点位 → 实时跟手（onPreview），松手提交。
 * 用 window 级监听保证指针移出元素后仍能收到事件（等效 setPointerCapture，且天然跨组件）。
 */
export function useDrag(options: UseDragOptions) {
  const state = reactive<DragState>({
    active: false,
    deviceId: null,
    mode: null,
    pointerX: 0,
    pointerY: 0,
    moved: false,
    insideCanvas: false,
  })

  let startX = 0
  let startY = 0

  function onPointerMove(e: PointerEvent) {
    state.pointerX = e.clientX
    state.pointerY = e.clientY

    if (!state.moved) {
      if (
        Math.abs(e.clientX - startX) > MOVE_THRESHOLD ||
        Math.abs(e.clientY - startY) > MOVE_THRESHOLD
      ) {
        state.moved = true
      }
    }

    state.insideCanvas = options.isInside(e.clientX, e.clientY)

    // 画布内移动：实时更新坐标，跟手渲染
    if (state.moved && state.mode === 'move' && state.deviceId) {
      const pos = options.toRelative(e.clientX, e.clientY)
      if (pos) options.onPreview(state.deviceId, pos.x, pos.y)
    }
  }

  function onPointerUp(e: PointerEvent) {
    const deviceId = state.deviceId
    const mode = state.mode
    const moved = state.moved

    if (deviceId && mode) {
      if (mode === 'move') {
        // 移动：松手提交最终坐标（toRelative 已 clamp 到边界内）
        const pos = options.toRelative(e.clientX, e.clientY)
        if (pos) options.onDrop(deviceId, mode, pos.x, pos.y, moved)
        else options.onDrop(deviceId, mode, 0, 0, false)
      } else {
        // 新建：仅当真正拖动且落在画布内才提交，否则按"点击"处理
        const inside = options.isInside(e.clientX, e.clientY)
        if (moved && inside) {
          const pos = options.toRelative(e.clientX, e.clientY)
          if (pos) options.onDrop(deviceId, mode, pos.x, pos.y, true)
          else options.onDrop(deviceId, mode, 0, 0, false)
        } else {
          options.onDrop(deviceId, mode, 0, 0, false)
        }
      }
    }

    stop()
  }

  function stop() {
    state.active = false
    state.deviceId = null
    state.mode = null
    state.moved = false
    state.insideCanvas = false
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
  }

  function start(deviceId: string, mode: DragMode, e: PointerEvent) {
    startX = e.clientX
    startY = e.clientY
    state.active = true
    state.deviceId = deviceId
    state.mode = mode
    state.pointerX = e.clientX
    state.pointerY = e.clientY
    state.moved = false
    state.insideCanvas = options.isInside(e.clientX, e.clientY)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
  }

  // 拖拽进行中若组件被卸载，清理全局监听
  onUnmounted(stop)

  return { state, start }
}
