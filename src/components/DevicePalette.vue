<script setup lang="ts">
import type { Device } from '../types'

const props = defineProps<{
  devices: Device[]
  /** 已放置设备 id 集合 */
  placedSet: Set<string>
  selected: string | null
  readonly?: boolean
}>()

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
    <div v-if="devices.length === 0" class="dp-palette-empty">
      <slot name="palette-empty">暂无设备</slot>
    </div>
    <ul v-else class="dp-device-list">
      <li
        v-for="device in devices"
        :key="device.id"
        class="dp-device-item"
        :class="{
          'is-placed': placedSet.has(device.id),
          'is-selected': selected === device.id,
        }"
        @pointerdown="onPointerDown(device, $event)"
        @click="onClick(device)"
      >
        <slot name="device-item" :device="device" :placed="placedSet.has(device.id)">
          <img
            class="dp-device-icon"
            :src="device.icon"
            :alt="device.name"
            draggable="false"
          />
          <span class="dp-device-name" :title="device.name">{{ device.name }}</span>
          <span v-if="placedSet.has(device.id)" class="dp-device-badge" aria-label="已放置">✓</span>
        </slot>
      </li>
    </ul>
  </div>
</template>
