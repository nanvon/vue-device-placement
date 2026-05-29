<script setup lang="ts">
import type { Device, Placement } from '../types'

const props = defineProps<{
  device: Device
  placement: Placement
  selected: boolean
  readonly?: boolean
  /** 是否正被拖动（用于置顶 z-index / 改变光标） */
  dragging?: boolean
}>()

const emit = defineEmits<{
  (e: 'pointerdown', event: PointerEvent): void
  (e: 'remove'): void
  (e: 'select'): void
}>()

function onPointerDown(event: PointerEvent) {
  if (props.readonly) return
  if (event.button !== 0) return // 仅左键
  // 阻止冒泡到画布，避免误触发画布层逻辑
  event.stopPropagation()
  emit('pointerdown', event)
}

function onRemove(event: MouseEvent) {
  event.stopPropagation()
  emit('remove')
}

function onClick(event: MouseEvent) {
  event.stopPropagation()
  emit('select')
}
</script>

<template>
  <div
    class="dp-marker"
    :class="{ 'is-selected': selected, 'is-dragging': dragging }"
    :style="{ left: placement.x * 100 + '%', top: placement.y * 100 + '%' }"
    @pointerdown="onPointerDown"
    @click="onClick"
  >
    <!-- 完全自定义点位外观 -->
    <slot :device="device" :placement="placement" :selected="selected">
      <div class="dp-marker-body">
        <span class="dp-marker-label" :title="device.name">{{ device.name }}</span>
        <div class="dp-marker-icon-wrap">
          <!-- 仅自定义图标，保留名称与删除× -->
          <slot name="icon" :device="device" :selected="selected">
            <img
              class="dp-marker-icon"
              :src="device.icon"
              :alt="device.name"
              draggable="false"
            />
          </slot>
          <button
            v-if="!readonly"
            type="button"
            class="dp-marker-remove"
            aria-label="删除点位"
            title="删除"
            @click="onRemove"
            @pointerdown.stop
          >
            ×
          </button>
        </div>
      </div>
    </slot>
  </div>
</template>
