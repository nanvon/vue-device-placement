<script setup lang="ts">
import { computed } from 'vue'
import type { Device, PaletteNode } from '../types'

const props = defineProps<{
  devices: Device[]
  /** 已放置设备 id 集合 */
  placedSet: Set<string>
  selected: string | null
  readonly?: boolean
  /** 层级数据；传入则按树形展开渲染，不传则平铺 devices（一级列表） */
  tree?: PaletteNode[]
}>()

/** 渲染用扁平项：每项携带设备实例与缩进深度，深度仅用于 CSS 缩进 */
interface FlatPaletteItem {
  device: Device
  depth: number
}

// devices 作为设备实例全集，按 id 建索引供 tree 节点按 deviceId 关联
const deviceMap = computed(() => {
  const map = new Map<string, Device>()
  props.devices.forEach((device) => map.set(device.id, device))
  return map
})

// 有 tree 时递归展开为带深度的扁平项（关联不到设备的节点跳过）；无 tree 时退回平铺，深度统一为 0。
// 注意：只有 tree 为 undefined（未传）才回退平铺，显式传 []（筛选后无匹配）应渲染真空，
// 否则调用方按条件筛选出空结果时会被这里误判成"没传树"而错误显示全部设备
const flatItems = computed<FlatPaletteItem[]>(() => {
  if (props.tree === undefined) {
    return props.devices.map((device) => ({ device, depth: 0 }))
  }

  const result: FlatPaletteItem[] = []
  const walk = (nodes: PaletteNode[], depth: number) => {
    nodes.forEach((node) => {
      const device = deviceMap.value.get(node.deviceId)
      if (device) result.push({ device, depth })
      if (node.children?.length) walk(node.children, depth + 1)
    })
  }
  walk(props.tree, 0)
  return result
})

const emit = defineEmits<{
  (e: 'pointerdown-device', payload: { deviceId: string; event: PointerEvent }): void
  (e: 'select-device', deviceId: string): void
}>()

function onPointerDown(device: Device, event: PointerEvent) {
  if (props.readonly) return
  if (event.button !== 0) return // 仅左键
  emit('pointerdown-device', { deviceId: device.id, event })
}

function onClick(device: Device) {
  emit('select-device', device.id)
}
</script>

<template>
  <div class="dp-palette">
    <div v-if="flatItems.length === 0" class="dp-palette-empty">
      <slot name="palette-empty">暂无设备</slot>
    </div>
    <ul v-else class="dp-device-list">
      <li
        v-for="item in flatItems"
        :key="item.device.id"
        class="dp-device-item"
        :class="{
          'is-placed': placedSet.has(item.device.id),
          'is-selected': selected === item.device.id,
        }"
        :style="{ '--dp-depth': item.depth }"
        @pointerdown="onPointerDown(item.device, $event)"
        @click="onClick(item.device)"
      >
        <slot
          name="device-item"
          :device="item.device"
          :placed="placedSet.has(item.device.id)"
          :depth="item.depth"
        >
          <img
            class="dp-device-icon"
            :src="item.device.icon"
            :alt="item.device.name"
            draggable="false"
          />
          <span class="dp-device-name" :title="item.device.name">{{ item.device.name }}</span>
          <span v-if="placedSet.has(item.device.id)" class="dp-device-badge" aria-label="已放置">✓</span>
        </slot>
      </li>
    </ul>
  </div>
</template>
