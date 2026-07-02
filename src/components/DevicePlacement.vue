<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ClusterMember, Device, PaletteNode, Placement } from '../types'
import { sanitizePlacements } from '../core/placement'
import { usePlacements } from '../composables/usePlacements'
import { useHighlight } from '../composables/useHighlight'
import { useDrag } from '../composables/useDrag'
import DevicePalette from './DevicePalette.vue'
import PlacementCanvas from './PlacementCanvas.vue'

defineOptions({ name: 'DevicePlacement' })

const props = withDefaults(
  defineProps<{
    /** 设备清单（设备实例全集，渲染左侧列表、画布点位与拖拽均基于此） */
    devices: Device[]
    /** 左侧列表层级数据；传入则列表按树形展开，不传则平铺 devices（一级列表）。仅影响列表展示，不影响打点 */
    paletteTree?: PaletteNode[]
    /** 底图图片 URL */
    background: string
    /** 点位数据，配合 v-model:placements */
    placements?: Placement[]
    /** 当前高亮设备 id；不绑定时组件内部维护，配合 v-model:selected 可外部控制 */
    selected?: string | null
    /** 高亮自动取消时长（毫秒） */
    highlightDuration?: number
    /** 只读模式：禁用拖拽与删除 */
    readonly?: boolean
    /** 是否启用底图缩放/平移（滚轮缩放、拖空白平移、双击复位） */
    zoomable?: boolean
    /** 是否启用点位聚合：密集点位合并显示为数字圆点，仅在 readonly=true 时生效 */
    cluster?: boolean
  }>(),
  {
    placements: () => [],
    selected: null,
    highlightDuration: 3000,
    readonly: false,
    zoomable: true,
    cluster: false,
  },
)

const emit = defineEmits<{
  (e: 'update:placements', value: Placement[]): void
  (e: 'update:selected', value: string | null): void
  (e: 'place', deviceId: string, pos: { x: number; y: number }): void
  (e: 'move', deviceId: string, pos: { x: number; y: number }): void
  (e: 'remove', deviceId: string): void
  (e: 'cluster-click', payload: { members: ClusterMember[] }): void
}>()

const canvasRef = ref<InstanceType<typeof PlacementCanvas> | null>(null)
const internalSelected = ref<string | null>(props.selected ?? null)

watch(
  () => props.selected,
  (value) => {
    internalSelected.value = value ?? null
  },
)

const activeSelected = computed(() => props.selected ?? internalSelected.value)

// 渲染与操作都基于"清洗后的"点位（过滤未知设备 id、去重、clamp），对应 PRD §8
const cleanPlacements = computed(() => sanitizePlacements(props.placements ?? [], props.devices))

const placements = usePlacements({
  placements: () => cleanPlacements.value,
  onUpdate: (next) => emit('update:placements', next),
  onPlace: (id, x, y) => emit('place', id, { x, y }),
  onMove: (id, x, y) => emit('move', id, { x, y }),
  onRemove: (id) => emit('remove', id),
})

const highlight = useHighlight({
  duration: () => props.highlightDuration,
  onChange: (id) => {
    internalSelected.value = id
    emit('update:selected', id)
  },
})

const drag = useDrag({
  toRelative: (x, y) => canvasRef.value?.toRelative(x, y) ?? null,
  isInside: (x, y) => canvasRef.value?.isInside(x, y) ?? false,
  onPreview: (id, x, y) => placements.write(id, x, y, 'silent'),
  onDrop: (id, _mode, x, y, moved) => {
    if (!moved) {
      // 未真正拖动：视为点击 → 选中高亮（未放置设备无操作，见 selectDevice）
      selectDevice(id)
      return
    }
    // 已放置再次拖入 = 移动（PRD F2）；否则新建。upsert 天然不新增，差异仅在语义事件
    const existed = placements.isPlaced(id)
    placements.write(id, x, y, existed ? 'move' : 'place')
  },
})

/** 点击设备/点位：仅已放置设备触发高亮（PRD F5：点未放置设备无操作） */
function selectDevice(id: string) {
  if (placements.isPlaced(id)) highlight.select(id)
}

function onPalettePointerDown(payload: { deviceId: string; event: PointerEvent }) {
  if (props.readonly) return
  drag.start(payload.deviceId, 'create', payload.event)
}

function onMarkerPointerDown(payload: { deviceId: string; event: PointerEvent }) {
  if (props.readonly) return
  drag.start(payload.deviceId, 'move', payload.event)
}

function onMarkerRemove(deviceId: string) {
  if (props.readonly) return
  placements.remove(deviceId)
  if (activeSelected.value === deviceId) highlight.select(null)
}

/** move 模式下正在拖动的点位 id（用于画布层置顶样式） */
const draggingId = computed(() => (drag.state.mode === 'move' ? drag.state.deviceId : null))

/** create 模式跟随光标浮层所显示的设备 */
const draggingDevice = computed<Device | null>(() => {
  const id = drag.state.deviceId
  if (!id) return null
  return props.devices.find((d) => d.id === id) ?? null
})

const ghostStyle = computed(() => ({
  left: `${drag.state.pointerX}px`,
  top: `${drag.state.pointerY}px`,
}))

const showGhost = computed(
  () =>
    drag.state.active &&
    drag.state.mode === 'create' &&
    drag.state.moved &&
    draggingDevice.value !== null,
)
</script>

<template>
  <div class="dp-root" :class="{ 'is-readonly': readonly }">
    <DevicePalette
      class="dp-section-palette"
      :devices="devices"
      :tree="paletteTree"
      :placed-set="placements.placedSet.value"
      :selected="activeSelected"
      :readonly="readonly"
      @pointerdown-device="onPalettePointerDown"
      @select-device="selectDevice"
    >
      <template v-if="$slots['device-item']" #device-item="s">
        <slot name="device-item" v-bind="s" />
      </template>
      <template v-if="$slots['palette-empty']" #palette-empty>
        <slot name="palette-empty" />
      </template>
    </DevicePalette>

    <PlacementCanvas
      ref="canvasRef"
      class="dp-section-canvas"
      :background="background"
      :devices="devices"
      :placements="cleanPlacements"
      :selected="activeSelected"
      :dragging-id="draggingId"
      :readonly="readonly"
      :zoomable="zoomable"
      :cluster="cluster"
      @marker-pointerdown="onMarkerPointerDown"
      @marker-remove="onMarkerRemove"
      @marker-select="selectDevice"
      @cluster-click="emit('cluster-click', $event)"
    >
      <template v-if="$slots.marker" #marker="s"><slot name="marker" v-bind="s" /></template>
      <template v-if="$slots.icon" #icon="s"><slot name="icon" v-bind="s" /></template>
      <template v-if="$slots.empty" #empty><slot name="empty" /></template>
      <template v-if="$slots.cluster" #cluster="s"><slot name="cluster" v-bind="s" /></template>
    </PlacementCanvas>

    <!-- 拖拽跟随光标的浮层（F8：拖拽视觉反馈） -->
    <div v-if="showGhost" class="dp-drag-ghost" :style="ghostStyle">
      <img
        class="dp-drag-ghost-icon"
        :src="draggingDevice!.icon"
        :alt="draggingDevice!.name"
        draggable="false"
      />
    </div>
  </div>
</template>
