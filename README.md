<h1 align="center">vue-device-placement</h1>

<p align="center">
  面向 Vue 3 的底图设备点位布设组件。通过拖拽交互在平面图上标注设备位置，输出屏幕尺寸无关的归一化相对坐标，内置视图平移缩放、高亮联动与只读点位聚合。
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/vue-device-placement"><img src="https://img.shields.io/npm/v/vue-device-placement?color=blue" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/vue-device-placement"><img src="https://img.shields.io/npm/dm/vue-device-placement" alt="npm downloads"></a>
  <a href="https://github.com/nanvon/vue-device-placement/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-orange" alt="License"></a>
  <img src="https://img.shields.io/badge/Vue-3.3+-42b883?logo=vue.js&logoColor=white" alt="Vue 3.3+">
  <img src="https://img.shields.io/badge/dependencies-0-brightgreen" alt="Zero Dependencies">
</p>

<p align="center">
  <a href="#-快速安装">快速安装</a> •
  <a href="#-快速上手">快速上手</a> •
  <a href="#-核心特性">核心特性</a> •
  <a href="#-组件接口">组件接口</a> •
  <a href="#-数据结构">数据结构</a> •
  <a href="#-样式定制">样式定制</a> •
  <a href="README_EN.md">English</a>
</p>

```text
┌──────────────┬──────────────────────────────────────────┐
│  设备列表    │              底图画布                    │
│  □ 消防栓-01 │                                          │
│  □ 门禁-东门 │         [📷] 摄像头-大厅                │
│  ▣ 摄像头-01 │           ▲ 点位布设在平面图上           │
│  ▣ 逆变器-01 │                                          │
│   …（可滚动） │         [⚡] 逆变器-01                  │
└──────────────┴──────────────────────────────────────────┘
      左侧                        中间画布
   □ 未放置  ▣ 已放置      滚轮缩放 / 拖拽平移 / 聚合
```

---

## 📦 快速安装

通过包管理器引入：

```bash
npm install vue-device-placement
# 或使用 pnpm
pnpm add vue-device-placement
# 或使用 yarn
yarn add vue-device-placement
```

> [!NOTE]
> 本组件要求宿主环境提供 Vue 3（`peerDependencies: vue ^3.3.0`），无任何第三方运行时依赖。

---

## 🚀 快速上手

### 极简单文件使用（<15 行）

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { DevicePlacement, type Device, type Placement } from 'vue-device-placement'
import 'vue-device-placement/style.css'

const devices = ref<Device[]>([{ id: 'cam-1', name: '大厅摄像头', icon: '/camera.svg' }])
const placements = ref<Placement[]>([])
</script>

<template>
  <DevicePlacement :devices="devices" background="/floor.png" v-model:placements="placements" />
</template>
```

### 全局插件注册

可在应用入口全局挂载组件：

```ts
import { createApp } from 'vue'
import VueDevicePlacement from 'vue-device-placement'
import 'vue-device-placement/style.css'
import App from './App.vue'

const app = createApp(App)
app.use(VueDevicePlacement)
app.mount('#app')
```

---

## ✨ 核心特性

- **归一化相对坐标** — 点位坐标使用 `[0, 1]` 区间相对底图尺寸标注，与视口大小及屏幕分辨率解耦，窗口重排或容器缩放时位置恒定。
- **一设备一点位约束** — 底层纯函数 `upsertPlacement` 确保同一 `deviceId` 唯一关联单一坐标；支持列表拖入、画布重拖与跨区域移动。
- **零第三方运行时依赖** — 仅声明 `vue`（`^3.3.0`）作为 peerDependency，不引入任何第三方拖拽库、图表引擎或复杂数学包。
- **DOM 与 CSS 硬件加速渲染** — 依托原生 DOM 与 CSS 2D Transform 实现图层缩放平移，点位图标通过反向缩放保持物理像素恒定（地图 Pin 效果）。
- **视图缩放与平移漫游** — 支持鼠标滚轮以光标为中心缩放（1x ~ 5x）、空白区域按住平移与双击空白快速复位；可通过 `zoomable` 参数关闭。
- **点位密度自适应聚合** — 在 `readonly` 模式下内置基于欧氏距离的贪心聚类算法，自动将密集点位收缩为数字圆点，点击自动计算最小包围盒并聚焦缩放。
- **100% 本地计算与零网络遥测** — 坐标映射、聚类分组与数据校验全部在客户端同步完成，组件内部不发起任何网络请求或数据上报。
- **双轨数据输出与清洗兜底** — 同时提供全量响应式输出（`v-model:placements`）与原子语义事件（`place` / `move` / `remove`）；内置 `sanitizePlacements` 自动过滤未知 ID 与越界数值。

---

## 📋 组件接口

### Props

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| :--- | :--- | :---: | :---: | :--- |
| `devices` | `Device[]` | 是 | — | 设备实例全集，驱动左侧列表与画布点位渲染 |
| `background` | `string` | 是 | — | 底图图片 URL 地址 |
| `placements` | `Placement[]` | 否 | `[]` | 点位数据数组，支持 `v-model:placements` 双向绑定 |
| `selected` | `string \| null` | 否 | `null` | 当前选中的设备 ID，支持 `v-model:selected` 双向同步 |
| `highlightDuration` | `number` | 否 | `3000` | 选中高亮持续时间（毫秒），超时自动取消高亮 |
| `readonly` | `boolean` | 否 | `false` | 只读模式；开启后禁用拖拽交互与点位删除按钮 |
| `zoomable` | `boolean` | 否 | `true` | 是否启用画布滚轮缩放、拖拽平移与双击复位 |
| `cluster` | `boolean` | 否 | `false` | 是否开启密集点位聚合（仅在 `readonly=true` 时生效） |
| `paletteTree` | `PaletteNode[]` | 否 | `undefined` | 左侧列表层级树；传入后按树形递归缩进展示，不传则平铺展示 |

### Emits / 事件

| 事件名 | 回调参数 | 触发时机与用途 |
| :--- | :--- | :--- |
| `update:placements` | `(value: Placement[])` | 任何点位增删改时触发，输出全量清洗后的点位数组（全量保存） |
| `update:selected` | `(id: string \| null)` | 选中设备状态变更时触发 |
| `place` | `(deviceId: string, pos: { x: number; y: number })` | 从列表拖入新增点位时触发（增量保存） |
| `move` | `(deviceId: string, pos: { x: number; y: number })` | 在画布上拖动移动点位时触发（增量保存） |
| `remove` | `(deviceId: string)` | 点击删除点位时触发（增量保存） |
| `cluster-click` | `(payload: { members: ClusterMember[] })` | 点击聚合圆点时触发，提供簇内完整成员清单 |

### Slots / 插槽

| 插槽名 | 作用域参数 | 说明 |
| :--- | :--- | :--- |
| `#marker` | `{ device: Device, placement: Placement, selected: boolean }` | 完全自定义画布点位 DOM 结构 |
| `#icon` | `{ device: Device, selected: boolean }` | 自定义点位图标，保留默认名称标签与删除按钮 |
| `#device-item` | `{ device: Device, placed: boolean, depth: number }` | 自定义左侧列表项样式（`depth` 为层级深度） |
| `#palette-empty` | — | 左侧设备列表无数据时的空状态 |
| `#empty` | — | 画布无底图或底图加载失败时的空状态 |
| `#cluster` | `{ members: ClusterMember[], count: number }` | 自定义聚合圆点样式 |

---

## 📐 数据结构

### 核心类型定义

```ts
/** 单台设备实例 */
export interface Device {
  id: string          // 唯一标识，点位关联键
  name: string        // 设备名称，悬浮与标签显示
  icon: string        // 设备图标 URL
  type?: string       // 分类标识（预留字段）
}

/** 点位数据（归一化相对坐标） */
export interface Placement {
  deviceId: string    // 关联设备 ID（一设备一点位）
  x: number           // 横向相对位置（0.0 ~ 1.0）
  y: number           // 纵向相对位置（0.0 ~ 1.0）
}

/** 左侧层级展示树节点 */
export interface PaletteNode {
  deviceId: string
  children?: PaletteNode[]
}

/** 聚合簇成员 */
export interface ClusterMember {
  device: Device
  placement: Placement
}
```

### 点位 JSON 输出示例

```json
[
  { "deviceId": "cam-01", "x": 0.324, "y": 0.581 },
  { "deviceId": "inverter-01", "x": 0.760, "y": 0.402 }
]
```

### 纯函数工具库导出

对于需要在组件外处理点位或坐标的高级场景，组件库直接导出无状态核心纯函数：

```ts
import {
  clamp01,             // 将数值限制在 [0, 1] 区间
  toNormalized,        // 视口像素坐标转换为归一化坐标
  upsertPlacement,     // 更新或插入点位（保持单设备单点位）
  removePlacement,     // 移除指定设备点位
  sanitizePlacements,  // 校验并清洗点位数组（去重、过滤未知 ID、截断边界）
  clusterize,          // 基于欧氏距离的贪心点位聚合
  boundingBoxOf,       // 计算点位集合的最小包围盒
} from 'vue-device-placement'
```

---

## 🎨 样式定制

组件所有视觉样式均基于 CSS 变量构建。接入方可在宿主全局或容器类上直接覆盖：

```css
.dp-root {
  --dp-primary-color: #2f80ed;     /* 主题强调色与选中高亮色 */
  --dp-palette-width: 200px;       /* 左侧列表宽度 */
  --dp-marker-size: 32px;          /* 点位图标尺寸 */
  --dp-cluster-size: 36px;         /* 聚合圆点直径 */
  --dp-cluster-color: #2f80ed;     /* 聚合圆点背景色 */
  --dp-cluster-text-color: #fff;   /* 聚合圆点文字颜色 */
  --dp-label-max-width: 96px;      /* 点位名称最大宽度（超长省略） */
  --dp-label-bg: rgba(0, 0, 0, .65);/* 点位名称标签背景 */
  --dp-label-color: #ffffff;       /* 点位名称文字颜色 */
  --dp-highlight-scale: 1.25;      /* 选中时放大比例 */
  --dp-height: 480px;              /* 组件整体容器高度 */
  --dp-indent: 16px;               /* 树形列表每级缩进量 */
  --dp-radius: 6px;                /* 容器与列表项圆角 */
  --dp-canvas-bg: #f3f4f6;         /* 画布背景色 */
  --dp-palette-bg: #fafafa;        /* 左侧列表背景色 */
}
```

---

## 🔒 隐私与安全性

| 机制 | 规格事实 | 安全保障 |
| :--- | :---: | :--- |
| **计算位置** | 100% 浏览器客户端同步完成 | 坐标映射、越界钳制与聚类分组全程本地运算 |
| **数据上报** | 零网络遥测与埋点 | 组件自身不引入任何分析 SDK，不发起任何外联通信 |
| **资源权限** | 只读底图与图标 URL | 仅通过标准 `<img>` 标签加载宿主提供的图片 URL |

---

## 💻 本地开发

```bash
# 安装依赖
npm install

# 启动本地 Playground 演示服务
npm run dev

# 运行核心算法单元测试
npm test

# 构建类型声明与生产包产物
npm run build
```

---

## 📄 开源许可

本项目基于 [MIT License](LICENSE) 开源发布。
