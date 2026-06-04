<script setup lang="ts">
import { computed, ref } from 'vue'
import { DevicePlacement } from 'vue-device-placement'
import type { Device, PaletteNode, Placement } from 'vue-device-placement'

/** 用内联 SVG 生成图标，省去外部图片依赖 */
function icon(emoji: string, bg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect rx="12" width="64" height="64" fill="${bg}"/><text x="32" y="44" font-size="34" text-anchor="middle">${emoji}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const background = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500">
    <rect width="800" height="500" fill="#eef2f7"/>
    <g fill="none" stroke="#c8d2e0" stroke-width="2">
      <rect x="40" y="50" width="320" height="190"/>
      <rect x="360" y="50" width="400" height="190"/>
      <rect x="40" y="240" width="720" height="210"/>
    </g>
    <text x="400" y="34" font-size="16" text-anchor="middle" fill="#8294ad">示例楼层平面图</text>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
})()

const devices = ref<Device[]>([
  { id: 'fire-hydrant-01', name: '消防栓-1F东', icon: icon('🧯', '#fde2e1') },
  { id: 'access-door-01', name: '门禁-东门', icon: icon('🚪', '#e3f0fd') },
  { id: 'camera-01', name: '摄像头-大厅', icon: icon('📷', '#e7f7e8') },
  { id: 'inverter-01', name: '逆变器-A区', icon: icon('🔌', '#fff3da') },
  { id: 'sensor-01', name: '温感-机房（这个名称特别长用于测试省略号效果）', icon: icon('🌡️', '#f0e8fb') },
])

const placements = ref<Placement[]>([
  { deviceId: 'camera-01', x: 0.324, y: 0.581 },
  { deviceId: 'inverter-01', x: 0.76, y: 0.402 },
])

// 树形模式演示：devices 仍是扁平全集，paletteTree 仅描述列表层级（主机-设备两级），父子节点都可打点
const paletteTree: PaletteNode[] = [
  {
    deviceId: 'fire-hydrant-01',
    children: [{ deviceId: 'camera-01' }, { deviceId: 'sensor-01' }]
  },
  {
    deviceId: 'access-door-01',
    children: [{ deviceId: 'inverter-01' }]
  }
]
const treeMode = ref(false)

const selected = ref<string | null>(null)

const json = computed(() => JSON.stringify(placements.value, null, 2))

const log = ref<string[]>([])
function record(msg: string) {
  log.value.unshift(`${new Date().toLocaleTimeString()}  ${msg}`)
  if (log.value.length > 10) log.value.pop()
}
function fmt(pos: { x: number; y: number }) {
  return `(${pos.x.toFixed(3)}, ${pos.y.toFixed(3)})`
}
</script>

<template>
  <div class="page">
    <header>
      <h1>vue-device-placement</h1>
      <span>设备打点组件 · Playground（拖一下 / 删一下，右侧 JSON 实时变化）</span>
      <label class="tree-toggle">
        <input v-model="treeMode" type="checkbox" />
        树形列表模式（主机-设备两级）
      </label>
    </header>

    <div class="layout">
      <DevicePlacement
        class="placer"
        :devices="devices"
        :palette-tree="treeMode ? paletteTree : undefined"
        :background="background"
        v-model:placements="placements"
        v-model:selected="selected"
        @place="(id, pos) => record(`place   ${id} ${fmt(pos)}`)"
        @move="(id, pos) => record(`move    ${id} ${fmt(pos)}`)"
        @remove="(id) => record(`remove  ${id}`)"
      />

      <aside class="side">
        <h2>placements（v-model）</h2>
        <pre>{{ json }}</pre>
        <h2>selected</h2>
        <pre>{{ selected ?? 'null' }}</pre>
        <h2>语义事件日志</h2>
        <ul class="log">
          <li v-for="(l, i) in log" :key="i">{{ l }}</li>
          <li v-if="log.length === 0" class="empty">（暂无）</li>
        </ul>
      </aside>
    </div>
  </div>
</template>

<style>
body {
  margin: 0;
  font-family: system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: #f7f8fa;
  color: #1f2937;
}
.page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}
header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
header h1 {
  font-size: 20px;
  margin: 0;
}
header span {
  color: #6b7280;
  font-size: 13px;
}
.tree-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
}
.layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.placer {
  flex: 1 1 auto;
  min-width: 0; /* flex item 默认 min-width:auto 会被内容撑开，这里允许其收缩 */
  --dp-height: 560px;
}
.side {
  flex: 0 0 300px;
  min-width: 0; /* 关键：不被内部长内容（日志/JSON）撑宽，严格保持 300px，避免挤占左侧组件 */
  overflow: hidden;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px 16px;
}
.side h2 {
  font-size: 13px;
  color: #6b7280;
  margin: 14px 0 6px;
}
.side h2:first-child {
  margin-top: 0;
}
.side pre {
  margin: 0;
  background: #0f172a;
  color: #e2e8f0;
  padding: 10px;
  border-radius: 6px;
  font-size: 12px;
  overflow: auto;
  max-height: 220px;
}
.log {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 12px;
  color: #374151;
}
.log li {
  padding: 2px 0;
  border-bottom: 1px dashed #eee;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: pre;
  overflow: hidden;
  text-overflow: ellipsis; /* 单条日志过长时省略，不撑宽面板 */
}
.log li.empty {
  color: #9ca3af;
  font-family: inherit;
}
</style>
