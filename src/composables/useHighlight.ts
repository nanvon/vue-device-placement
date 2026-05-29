import { onUnmounted } from 'vue'

export interface UseHighlightOptions {
  /** 高亮自动取消时长（毫秒），用 getter 以便实时读取最新 prop */
  duration: () => number
  /** 选中变化时回调（用于 emit('update:selected', id)） */
  onChange: (id: string | null) => void
}

/**
 * 高亮选中 + 定时自动取消（PRD F5）。
 * - select(id)：切换选中并重置定时器，duration 后自动取消；
 * - select(null)：立即取消并清除定时器。
 */
export function useHighlight(options: UseHighlightOptions) {
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer() {
    if (timer != null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function select(id: string | null) {
    clearTimer()
    options.onChange(id)
    if (id != null) {
      timer = setTimeout(() => {
        timer = null
        options.onChange(null)
      }, options.duration())
    }
  }

  // 组件卸载时清理定时器，防止内存泄漏与卸载后回调
  onUnmounted(clearTimer)

  return { select, clearTimer }
}
