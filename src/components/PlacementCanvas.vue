<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { Device, Placement } from '../types'
import { useCanvasCoordinate } from '../composables/useCanvasCoordinate'
import { useZoomPan } from '../composables/useZoomPan'
import PlacementMarker from './PlacementMarker.vue'

const props = defineProps<{
  background: string
  devices: Device[]
  placements: Placement[]
  selected: string | null
  /** 正在被拖动的设备 id（move 模式） */
  draggingId?: string | null
  readonly?: boolean
  /** 是否启用底图缩放/平移 */
  zoomable?: boolean
}>()

const emit = defineEmits<{
  (e: 'marker-pointerdown', payload: { deviceId: string; event: PointerEvent }): void
  (e: 'marker-remove', deviceId: string): void
  (e: 'marker-select', deviceId: string): void
}>()

const imgEl = ref<HTMLImageElement | null>(null)
const canvasEl = ref<HTMLElement | null>(null)
const wrapEl = ref<HTMLElement | null>(null)
const loadError = ref(false)
// 底图自然宽高比（"w / h" 形式）；load 后写入，未知时为 null 不约束
const imgRatio = ref<string | null>(null)
const { toRelative, isInside, getRect } = useCanvasCoordinate(imgEl)
const { state: zoom, wrapStyle, onWheel, onPanStart, resetView } = useZoomPan(
  canvasEl,
  wrapEl,
  () => props.zoomable !== false,
)

/** 双击空白区域复位（避免双击点位时误触发） */
function onCanvasDblClick(e: MouseEvent) {
  if (props.zoomable === false) return
  if ((e.target as HTMLElement).closest('.dp-marker')) return
  resetView()
}

const deviceMap = computed(() => {
  const m = new Map<string, Device>()
  for (const d of props.devices) m.set(d.id, d)
  return m
})

// 只渲染设备清单中存在的点位（根组件已 sanitize，这里再兜底一层）
const renderable = computed(() =>
  props.placements
    .map((placement) => ({ placement, device: deviceMap.value.get(placement.deviceId) }))
    .filter((x): x is { placement: Placement; device: Device } => Boolean(x.device)),
)

const showEmpty = computed(() => !props.background || loadError.value)
const showHint = computed(() => !showEmpty.value && props.placements.length === 0)

watch(
  () => props.background,
  () => {
    // 切换底图：清空旧比例，等新图 load 后按其自然尺寸重置，避免用旧比例约束新图
    loadError.value = false
    imgRatio.value = null
  },
)

function onError() {
  loadError.value = true
}
// 记录底图自然宽高比，驱动包裹层 aspect-ratio：让 wrap 在舞台内等比收缩，盒子恒等于照片
// 实际渲染区（§6.2）。否则普通 div 的 max-width/max-height 各自独立夹取、丢失比例，导致
// object-fit:contain 留白，点位层据此对齐时把留白也算进"图内"，造成可在图外打点、且各页
// 留白不同而坐标对不上。
function applyImgRatio() {
  const el = imgEl.value
  if (el && el.naturalWidth && el.naturalHeight) {
    imgRatio.value = `${el.naturalWidth} / ${el.naturalHeight}`
  }
}
function onLoad() {
  loadError.value = false
  applyImgRatio()
}

// 兜底：底图被缓存时 load 可能在监听绑定前已触发（img.complete 为真不再 fire），
// 挂载后补读一次自然尺寸，避免 wrap 因缺 aspect-ratio 而塌陷
onMounted(() => {
  if (imgEl.value?.complete) applyImgRatio()
})

// 暴露给根组件做拖拽坐标换算 + 视图复位
defineExpose({ toRelative, isInside, getRect, resetView })
</script>

<template>
  <div
    ref="canvasEl"
    class="dp-canvas"
    :class="{ 'is-zoomed': zoom.scale > 1, 'is-panning': zoom.panning }"
    @wheel="onWheel"
    @dblclick="onCanvasDblClick"
  >
    <div v-if="!showEmpty" class="dp-canvas-stage">
      <div
        ref="wrapEl"
        class="dp-bg-wrap"
        :style="[wrapStyle, { '--dp-zoom': zoom.scale, aspectRatio: imgRatio }]"
        @pointerdown="onPanStart"
      >
        <img
          ref="imgEl"
          class="dp-bg"
          :src="background"
          alt="底图"
          draggable="false"
          @error="onError"
          @load="onLoad"
        />
        <div class="dp-marker-layer">
          <PlacementMarker
            v-for="item in renderable"
            :key="item.placement.deviceId"
            :device="item.device"
            :placement="item.placement"
            :selected="selected === item.placement.deviceId"
            :dragging="draggingId === item.placement.deviceId"
            :readonly="readonly"
            @pointerdown="emit('marker-pointerdown', { deviceId: item.placement.deviceId, event: $event })"
            @remove="emit('marker-remove', item.placement.deviceId)"
            @select="emit('marker-select', item.placement.deviceId)"
          >
            <template v-if="$slots.marker" #default="s"><slot name="marker" v-bind="s" /></template>
            <template v-if="$slots.icon" #icon="s"><slot name="icon" v-bind="s" /></template>
          </PlacementMarker>
        </div>
      </div>

      <div v-if="showHint" class="dp-canvas-hint">从左侧拖动设备到此处打点</div>
    </div>

    <div v-else class="dp-canvas-empty">
      <slot name="empty">
        <div class="dp-empty-default">
          <p v-if="!background">请提供底图（background）</p>
          <p v-else>底图加载失败</p>
        </div>
      </slot>
    </div>
  </div>
</template>
