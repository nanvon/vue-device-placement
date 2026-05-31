# vue-device-placement

[![npm version](https://img.shields.io/npm/v/vue-device-placement.svg)](https://www.npmjs.com/package/vue-device-placement)
[![npm downloads](https://img.shields.io/npm/dm/vue-device-placement.svg)](https://www.npmjs.com/package/vue-device-placement)
[![GitHub](https://img.shields.io/badge/GitHub-nanvon/vue--device--placement-black)](https://github.com/nanvon/vue-device-placement)

> 在底图上拖拽标注设备位置的 Vue 3 组件 —— 装个包就能用的"设备打点"能力。

- npm: [vue-device-placement](https://www.npmjs.com/package/vue-device-placement)
- GitHub: [nanvon/vue-device-placement](https://github.com/nanvon/vue-device-placement)

很多业务都需要"在一张底图上标出设备的位置"：安防在楼层平面图上布摄像头/门禁/消防栓，光伏在电站图上布逆变器。本组件把这类交互抽象为开箱即用的前端组件：传入设备清单与底图，即可获得完整的拖拽打点能力，并拿到标准化的点位数据。

- 🎯 三种打点路径（列表拖入 / 再次拖入 / 画布内拖动）统一坐实「一设备一点位」
- 🔍 底图滚轮缩放 / 拖拽平移 / 双击复位（可关闭），大图也能精细打点
- 📐 坐标用相对比例（0~1）存储，底图缩放不错位
- 🔌 零运行时依赖，`vue` 作为 peer，体积小、无侵入
- 🎨 纯 CSS + CSS 变量主题，预留多个插槽
- 🧩 完整 TypeScript 类型

## 安装

```bash
npm i vue-device-placement
```

> 需要宿主项目提供 Vue 3（`peerDependencies: vue ^3.3.0`）。

## 快速上手

### 方式一：按组件引入

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { DevicePlacement } from 'vue-device-placement'
import type { Device, Placement } from 'vue-device-placement'
import 'vue-device-placement/style.css'

const devices = ref<Device[]>([
  { id: 'camera-01', name: '摄像头-大厅', icon: '/device-icons/camera.png' },
  { id: 'inverter-01', name: '逆变器-A区', icon: '/device-icons/inverter.png' },
])

// 可用后端读出的数据初始化（回显）
const placements = ref<Placement[]>([])

function save() {
  // 把 placements.value 发给后端保存
}
</script>

<template>
  <DevicePlacement
    :devices="devices"
    background="/floor-plans/1f.png"
    v-model:placements="placements"
    @place="save"
    @move="save"
    @remove="save"
  />
</template>
```

> 别忘了引入样式：`import 'vue-device-placement/style.css'`。
> `v-model:selected` 是可选的：不绑定时组件会自行维护高亮；只有当宿主项目也需要读取/控制当前高亮设备时才需要绑定。

### 方式二：作为 Vue 插件安装

```ts
import { createApp } from 'vue'
import VueDevicePlacement from 'vue-device-placement'
import 'vue-device-placement/style.css'
import App from './App.vue'

createApp(App).use(VueDevicePlacement).mount('#app')
```

安装后可在任意组件中直接使用：

```vue
<template>
  <DevicePlacement
    :devices="devices"
    background="/floor-plans/1f.png"
    v-model:placements="placements"
  />
</template>
```

## Props

| 名称 | 类型 | 必填 | 默认 | 说明 |
|------|------|:--:|:--:|------|
| `devices` | `Device[]` | 是 | — | 设备清单（渲染左侧列表） |
| `background` | `string` | 是 | — | 底图图片 URL |
| `placements` | `Placement[]` | 否 | `[]` | 点位数据，配合 `v-model:placements` |
| `selected` | `string \| null` | 否 | `null` | 当前高亮设备 id；不绑定时组件内部维护，配合 `v-model:selected` 可外部控制 |
| `highlightDuration` | `number` | 否 | `3000` | 高亮自动取消时长（毫秒） |
| `readonly` | `boolean` | 否 | `false` | 只读模式（禁用拖拽与删除） |
| `zoomable` | `boolean` | 否 | `true` | 底图缩放/平移：滚轮缩放、拖空白平移、双击复位；设为 `false` 全部禁用 |

> 主题（主色、图标尺寸等）不走 props，走 CSS 变量，见下文。

## 事件 / v-model

| 事件 | 参数 | 说明 |
|------|------|------|
| `update:placements` | `(placements: Placement[])` | 任何变更都吐出**完整数组**（整表覆盖保存用） |
| `update:selected` | `(id: string \| null)` | 高亮设备变化 |
| `place` | `(deviceId, { x, y })` | 新建一个点位时（增量保存用） |
| `move` | `(deviceId, { x, y })` | 移动点位时 |
| `remove` | `(deviceId)` | 删除点位时 |

> 同时提供「完整数组」和「语义事件」两套出口：要整表覆盖就用 `update:placements`，要增量保存就监听 `place/move/remove`。
> `update:selected` 始终会抛出；如果不绑定 `v-model:selected`，组件内部仍会正常高亮并自动取消。

## 插槽（Slots）

| 插槽 | 作用域参数 | 说明 |
|------|-----------|------|
| `marker` | `{ device, placement, selected }` | 完全自定义点位外观 |
| `icon` | `{ device, selected }` | 只自定义图标，保留默认名称与删除× |
| `device-item` | `{ device, placed }` | 自定义左侧列表项外观 |
| `palette-empty` | — | 左侧无设备时的空状态 |
| `empty` | — | 画布空状态（无底图 / 底图加载失败） |

## 数据格式

坐标使用**相对底图的归一化比例（0~1）**，与屏幕/容器尺寸无关；以 `deviceId` 为主键（一设备一点位）。输入与输出结构一致，可直接来回传递。

```ts
interface Device {
  id: string      // 唯一标识，点位关联键
  name: string    // 显示在点位上方
  icon: string    // 图标图片 URL
  type?: string   // 分类（预留，本期不分组）
}

interface Placement {
  deviceId: string // 关联设备 id（唯一）
  x: number        // 横向相对位置 0~1
  y: number        // 纵向相对位置 0~1
}
```

```json
[
  { "deviceId": "camera-01",   "x": 0.324, "y": 0.581 },
  { "deviceId": "inverter-01", "x": 0.760, "y": 0.402 }
]
```

回显数据中若含设备清单里不存在的 id，会被自动忽略，不影响其余点位渲染。

## 主题定制（CSS 变量）

覆盖 `.dp-root` 上的变量即可：

```css
.dp-root {
  --dp-primary-color: #2f80ed;     /* 主题/高亮色 */
  --dp-palette-width: 200px;       /* 左侧列表宽度 */
  --dp-marker-size: 32px;          /* 点位图标尺寸 */
  --dp-label-bg: rgba(0,0,0,.65);  /* 名称底色 */
  --dp-label-color: #fff;
  --dp-highlight-scale: 1.25;      /* 高亮放大倍数 */
  --dp-height: 480px;              /* 组件整体高度 */
}
```

## 本地开发

```bash
npm install      # 安装依赖
npm run dev      # 启动 playground 演示页（右侧实时显示点位 JSON）
npm test         # 运行核心逻辑单测
npm run build    # 类型检查 + 库构建，产出 dist/
```

## 浏览器支持

仅支持桌面浏览器（鼠标操作），本期不考虑触摸 / 移动端。

## License

MIT
