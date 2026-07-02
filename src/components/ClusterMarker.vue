<script setup lang="ts">
import type { ClusterMember } from '../types'

defineProps<{
  members: ClusterMember[]
  /** 归一化坐标，取簇内种子点位置 */
  x: number
  y: number
}>()

const emit = defineEmits<{
  (e: 'click'): void
}>()

// 阻止冒泡：避免触发画布平移/双击复位（与 PlacementMarker 一致的处理方式）
function onClick(event: MouseEvent) {
  event.stopPropagation()
  emit('click')
}
</script>

<template>
  <div class="dp-cluster" :style="{ left: x * 100 + '%', top: y * 100 + '%' }" @click="onClick">
    <slot :members="members" :count="members.length">
      <div class="dp-cluster-dot">{{ members.length }}</div>
    </slot>
  </div>
</template>
