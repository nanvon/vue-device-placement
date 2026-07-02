# 设备打点组件 · 技术方案设计

| 项 | 内容 |
|---|---|
| 文档版本 | v0.1（待评审） |
| 更新日期 | 2026-05-29 |
| 关联文档 | [PRD.md](./PRD.md) v0.1 |
| 一句话技术栈 | Vue 3 + TypeScript + Vite 库模式，纯 CSS（CSS 变量主题），Vitest 测核心逻辑，发布 npm |

---

## 1. 技术选型

| 维度 | 选型 | 说明 |
|------|------|------|
| 框架 | Vue 3（`<script setup>` + Composition API） | |
| 语言 | TypeScript | 对外导出完整类型 |
| 构建/打包 | Vite（Library Mode） | 输出 ESM + UMD |
| 类型产物 | vite-plugin-dts | 生成 `.d.ts` |
| 样式 | 纯 CSS（scoped）+ CSS 变量 | 零第三方样式依赖 |
| 测试 | Vitest | 只测核心纯逻辑 |
| 拖拽 | Pointer Events（自实现） | 不引第三方拖拽库，理由见 §6.1 |
| 运行时依赖 | **零** | `vue` 作为 peerDependency，不打进包 |

> 依赖原则：保持**零运行时第三方依赖**，体积小、对接入方无侵入。`vue` 由使用方提供（peer）。

---

## 2. 工程目录结构

```
vue-device-placement/
├── docs/
│   ├── PRD.md
│   └── TECH_DESIGN.md
├── src/
│   ├── index.ts                 # 包入口：导出组件与类型
│   ├── types.ts                 # Device / Placement 等类型
│   ├── components/
│   │   ├── DevicePlacement.vue   # 根组件（编排、数据流）
│   │   ├── DevicePalette.vue     # 左侧设备列表
│   │   ├── PlacementCanvas.vue   # 中间底图画布
│   │   ├── PlacementMarker.vue   # 单个点位（图标+名称+删除×）
│   │   └── ClusterMarker.vue     # 聚合圆点（数字徽标，仅 cluster 生效时渲染）
│   ├── composables/
│   │   ├── usePlacements.ts       # 点位状态：upsert/remove/派生已放置集合
│   │   ├── useCanvasCoordinate.ts # 像素 ↔ 归一化坐标换算
│   │   ├── useDrag.ts             # 拖拽（列表→画布、画布内移动）
│   │   ├── useHighlight.ts        # 高亮选中 + 3 秒定时取消
│   │   ├── useZoomPan.ts          # 底图滚轮缩放 + 拖拽平移 + 复位 + 聚焦到区域
│   │   └── useCluster.ts          # 点位聚合的响应式包装（分组、marker 尺寸探测）
│   ├── core/                     # 纯函数（无 Vue 依赖，单测对象）
│   │   ├── coordinate.ts          # toNormalized / clamp01
│   │   ├── placement.ts           # upsert / remove / isPlaced / sanitize
│   │   └── cluster.ts             # clusterize（贪心按种子距离分组）/ boundingBoxOf
│   └── styles/
│       └── index.css             # 变量定义 + 组件样式
├── playground/                   # 本地演示页（实时看数据）
│   ├── index.html
│   └── main.ts
├── tests/                        # Vitest 单测
│   ├── coordinate.test.ts
│   ├── placement.test.ts
│   └── cluster.test.ts
├── package.json
├── tsconfig.json
└── vite.config.ts
```

> **关键分层**：把"与 Vue 无关的纯逻辑"（坐标换算、点位增删改）抽到 `src/core/`，这样单测不依赖组件渲染，又快又稳——正好匹配"只测核心逻辑"的选择。

---

## 3. 对外 API 设计（核心）

### 3.1 Props

| 名称 | 类型 | 必填 | 默认 | 说明 |
|------|------|:--:|:--:|------|
| `devices` | `Device[]` | 是 | — | 设备清单（渲染左侧列表） |
| `background` | `string` | 是 | — | 底图图片 URL |
| `placements` | `Placement[]` | 否 | `[]` | 点位数据，配合 `v-model:placements` 双向绑定 |
| `selected` | `string \| null` | 否 | `null` | 当前高亮设备 id；不绑定时组件内部维护，配合 `v-model:selected` 可外部控制 |
| `highlightDuration` | `number` | 否 | `3000` | 高亮自动取消时长（毫秒） |
| `readonly` | `boolean` | 否 | `false` | 只读模式（禁用拖拽与删除）。预留扩展，P1 |
| `zoomable` | `boolean` | 否 | `true` | 是否启用底图缩放/平移（滚轮缩放、拖空白平移、双击复位）。关闭时复位并禁用相关交互 |
| `cluster` | `boolean` | 否 | `false` | 是否启用点位聚合；**仅在 `readonly=true` 时生效**，`readonly=false` 时即使传入也不生效 |

> 主题相关（主色、图标尺寸等）**不走 props，走 CSS 变量**（见 §7），避免 props 膨胀。

### 3.2 Events / v-model

| 事件 | 参数 | 说明 |
|------|------|------|
| `update:placements` | `(placements: Placement[])` | v-model，**任何变更都吐出完整数组**（接入方整体保存用） |
| `update:selected` | `(id: string \| null)` | v-model:selected |
| `place` | `(deviceId: string, pos: {x,y})` | 新建一个点位时（接入方增量保存用） |
| `move` | `(deviceId: string, pos: {x,y})` | 移动点位时 |
| `remove` | `(deviceId: string)` | 删除点位时 |
| `cluster-click` | `(payload: { members: ClusterMember[] })` | 点击聚合圆点时，除了内置的自动聚焦动作外再额外抛出，供接入方附加逻辑 |

> 同时提供"完整数组"和"语义事件"两套出口：要整表覆盖就用 `update:placements`，要增量保存就监听 `place/move/remove`。对应 PRD §7.7 两种存库策略。

包入口同时支持两种接入方式：
- 按组件使用：`import { DevicePlacement } from 'vue-device-placement'`；
- 按插件安装：`import VueDevicePlacement from 'vue-device-placement'` 后 `app.use(VueDevicePlacement)`，内部全局注册 `<DevicePlacement />`。

### 3.3 Slots（对应"预留插槽自定义"）

| 插槽 | 作用域参数 | 说明 |
|------|-----------|------|
| `marker` | `{ device, placement, selected }` | 完全自定义点位外观（覆盖默认的图标+名称） |
| `icon` | `{ device, selected }` | 只自定义图标部分，保留默认名称与删除× |
| `device-item` | `{ device, placed }` | 自定义左侧列表项外观 |
| `empty` | — | 画布空状态（无底图或无点位时） |
| `cluster` | `{ members: ClusterMember[], count: number }` | 自定义聚合圆点外观（覆盖默认的"圆形+数字"），`members` 为簇内设备与点位数据，接入方可据此实现例如按业务状态着色 |

### 3.4 使用示例（接入方视角）

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
const placements = ref<Placement[]>([])   // 可用后端读出的数据初始化（回显）

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

---

## 4. 数据类型定义

```ts
// src/types.ts
export interface Device {
  id: string          // 唯一标识，点位关联键
  name: string        // 显示在点位上方
  icon: string        // 图标图片 URL
  type?: string       // 分类（预留，本期不分组）
}

export interface Placement {
  deviceId: string    // 关联设备 id（唯一 → 一设备一点位）
  x: number           // 横向相对位置 0~1
  y: number           // 纵向相对位置 0~1
}
```

---

## 5. 内部架构与数据流

**组件树：**

```
<DevicePlacement>                 根：持有受控数据，向下分发，向上 emit
├── <DevicePalette>               左：列表 + 已放置状态 + 点击触发高亮
│      └── slot: device-item
└── <PlacementCanvas>             中：底图 + 点位层，承载拖拽与坐标换算
       ├── <img :src="background">
       └── <PlacementMarker> × N  点位：图标 + 名称 + 删除×
              └── slot: marker / icon
```

**数据流（单向 + 受控）：**

```
接入方 placements ──props──▶ DevicePlacement ──▶ 子组件渲染
                                   ▲
   用户操作(拖/移/删) ── emit ──────┘
   → 复制数组、修改、emit('update:placements', 新数组) → 接入方更新 → 回流
```

- 组件**不直接修改 props.placements**（遵循单向数据流），而是产出新数组通过事件抛出。
- "某设备是否已放置" = `placements` 中是否存在该 `deviceId`（派生计算，不单独存状态）。

**Composables 职责：**
- `usePlacements`：封装 upsert / remove，计算 `placedSet`，统一 emit。
- `useCanvasCoordinate`：提供"鼠标像素 → 归一化坐标"换算。
- `useDrag`：拖拽状态机（列表拖入 / 画布内移动）。
- `useHighlight`：`selected` + 定时器管理；根组件同时维护内部 `selected`，保证未绑定 `v-model:selected` 时内置高亮仍可用。
- `useZoomPan`：底图滚轮缩放（以光标为焦点）、拖空白平移（边界钳制）、双击复位、聚焦到指定区域（`focusRect`，供聚合圆点点击用）；受 `zoomable` 开关控制。
- `useCluster`：点位聚合的响应式包装，`enabled=false` 时恒等映射为独立点位，`enabled=true` 时按当前缩放换算像素距离调用 `core/cluster.ts` 的 `clusterize` 分组。

---

## 6. 关键技术难点与解法 ⭐

### 6.1 拖拽实现：统一用 Pointer Events（不用 HTML5 拖放）

涉及两条拖拽路径：**A. 从左侧列表拖到画布**；**B. 在画布内拖动已有点位**。

| 方案 | 路径 A | 路径 B | 结论 |
|------|--------|--------|------|
| HTML5 Drag & Drop | 天生适合 | 不跟手、有拖影、坐标不精确、自定义难 | ✗ B 体验差 |
| **Pointer Events（自实现）** | 需自己做"跟随光标的浮层" | 完全可控、实时跟手、易 clamp | ✓ **采用** |

**决策：统一用 Pointer Events 自实现。** 理由：
1. 本期只支持桌面端鼠标，Pointer Events 完全够用；
2. 路径 B 本来就只能用 pointer，统一后两条路径共用一套逻辑、体验一致；
3. 实时跟手、边界限制、落点预览都好做，不踩 DnD 的各种坑（drop 失效、拖影样式等）。

**实现要点：**
- 列表项 `pointerdown` → 进入拖拽态，创建一个跟随光标的浮层（显示该设备图标）；
- `pointermove` → 浮层跟随光标；在画布范围内时可显示落点预览；
- `pointerup` → 若落在画布内，换算坐标后 `upsert(deviceId, x, y)`；否则取消；
- 画布内点位 `pointerdown` → 拖动该点位，`pointermove` 实时更新坐标（clamp 到 0~1），`pointerup` 提交；
- 用 `setPointerCapture` 保证指针移出元素后仍能收到事件。

> 路径 A 和 B 最终都汇聚到同一个动作 `upsert(deviceId, x, y)`——有则更新坐标、无则新建，从代码层面坐实 PRD 的"一设备一点位"。

### 6.2 坐标换算与底图自适应（最大的坑）⭐

**问题：** 底图按比例自适应容器时（`object-fit: contain`），图片实际显示区域通常**小于容器**（两侧或上下留白）。若用容器尺寸算比例，点位会整体偏移。

**解法：让点位层精确对齐"图片实际渲染区域"。**
- 容器内用 flex 居中放 `<img>`，img 设 `max-width/height:100%`、`width/height:auto`，使 **img 元素框 = 图片实际显示区域**；
- 点位层（绝对定位）覆盖在 img 上、与之同尺寸同位置；
- 鼠标像素 → 归一化：
  ```
  nx = clamp01( (e.clientX - imgRect.left) / imgRect.width )
  ny = clamp01( (e.clientY - imgRect.top)  / imgRect.height )
  ```
- 点位渲染用**百分比定位**：`left: x*100%; top: y*100%`（配合 `transform: translate(-50%,-50%)` 居中锚点）。

**归一化坐标的红利：** 因为点位用百分比定位，**底图尺寸变化时点位会自动跟随，无需任何 JS 重算**。只有在"鼠标像素 → 归一化"这一步（拖拽时）才需要 `imgRect`，临时 `getBoundingClientRect()` 取一次即可。

### 6.3 一设备一点位（upsert）

```ts
// core/placement.ts（纯函数，可单测）
function upsertPlacement(list, deviceId, x, y): Placement[]   // 有则改坐标，无则追加
function removePlacement(list, deviceId): Placement[]
function isPlaced(list, deviceId): boolean
function sanitizePlacements(list, devices): Placement[]       // 过滤设备清单里不存在的脏数据
```

### 6.4 高亮 3 秒自动取消（定时器管理）

```ts
// useHighlight：切换选中时重置定时器
function select(id) {
  clearTimeout(timer)
  emit('update:selected', id)
  timer = setTimeout(() => emit('update:selected', null), props.highlightDuration)
}
onUnmounted(() => clearTimeout(timer))   // 防泄漏
```
- 点击左侧已放置设备 → `select(id)`；点击未放置设备 → 无操作（PRD F5）。

### 6.5 删除×显示时机

- `PlacementMarker` 上的删除×：默认隐藏，`:hover` 或该点位 `selected` 时显示（纯 CSS 控制为主）；
- 点击即删，无二次确认（PRD F4）。

### 6.6 边界与异常落地

| 场景 | 技术处理 |
|------|---------|
| 拖出底图 | 坐标 `clamp01`，恒在 0~1 |
| 点位重叠 | 允许；用 `z-index` 让选中/hover 的浮到最上层 |
| 名称过长 | CSS `max-width` + `text-overflow: ellipsis` |
| 底图加载失败 | `<img @error>` → 展示 `empty` 插槽 / 占位 |
| 无设备 / 无点位 | 渲染 `empty` 插槽或默认引导文案 |
| 回显含未知 id | `sanitizePlacements` 过滤，不影响其余点位 |

### 6.7 底图缩放 / 平移（useZoomPan）

对底图包裹层 `.dp-bg-wrap` 施加 `translate(tx, ty) scale(scale)`（`transform-origin: 0 0`）。**底图 `<img>` 与点位层同属该容器，一起被变换**，因此：

- **缩放焦点**：滚轮事件以光标位置为不动点求解新的 `tx/ty`（先反推未缩放的局部坐标，再保持其落在光标处），缩放范围 `1×~6×`（`1×` = 适应画布，不允许更小）。
- **平移钳制**：内容大于画布时限制在边界内不留空白，小于画布时居中（`clampTranslate`）。marker 的 `pointerdown` 已 `stopPropagation`，拖动点位不会触发平移。
- **坐标换算天然正确**：点位渲染用百分比、像素↔归一化换算依赖 `img.getBoundingClientRect()`。缩放后该 rect 实时反映 img 的真实显示区域，**无需为缩放额外改动坐标逻辑**（§6.2 的红利在缩放场景下依旧成立）。点位图标再用 `scale(1/zoom)` 反向抵消，避免随底图一起被放大。
- **开关**：`useZoomPan` 接收 `enabled` getter（来自 `zoomable` prop）。关闭时滚轮/平移/双击直接 return，并 `watch` 到关闭时复位视图。

### 6.8 点位聚合（cluster）⭐

**判定依据：** `PlacementMarker` 用 `scale(1/var(--dp-zoom))` 反向缩放保证图标视觉大小恒定（§7 主题变量），因此两点在当前缩放下的**真实屏幕像素距离**可以精确算出：`归一化坐标差 × 基准像素宽高 × scale`，不需要逐帧读 DOM 猜测。

**分组算法（`core/cluster.ts` 的 `clusterize`，纯函数，可单测）：** 贪心按种子点距离分组——遍历未分组点位作为种子，收纳"到种子欧氏距离 ≤ 半径"的其余未分组点入同一簇。**距离恒以种子为基准**，不是簇内任意成员，避免 A-B 近、B-C 近但 A-C 远时被链式并成一簇，簇的地理跨度因此被限制在 `2×半径` 内、形状可预测。

**响应式重算时机（`useCluster.ts`）：** 用 Vue `computed` 而非 `watch`——依赖自动收集，`scale`/点位数据变化时天然触发重算；容器尺寸变化不是响应式的（`getBoundingClientRect`/`offsetWidth` 不参与依赖收集），用 `ResizeObserver` 桥接成一个响应式计数器。**刻意不依赖 `tx/ty`**（平移不改变点位间相对像素距离），避免拖拽平移时无意义的重复计算。

**基准尺寸的一个时序坑：** `useZoomPan` 新增的 `getBaseSize()` 一开始用 `getBoundingClientRect().width / state.scale` 反推，但当 `focusRect()` 刚把 `state.scale` 改到新值、浏览器还没来得及重绘应用新的 `transform` 时，`getBoundingClientRect()` 读到的仍是旧视觉尺寸，除以已经是新值的 `state.scale` 会算出错误（偏小）的基准尺寸，导致聚合分组"缩放后该拆散却没拆散"。**解法：改用 `offsetWidth`/`offsetHeight`**——这是元素自身的布局尺寸，CSS `transform` 不影响它，天然不存在"视觉尺寸滞后于已变化的响应式状态"这个问题。

**运行时探测点位图标的实际像素尺寸（聚合半径 = 1.2 × 该尺寸）：** 不能直接读 `--dp-marker-size` 变量字符串做 `parseFloat`（`1.5rem` 这类非 px 单位会被错误解析成 `1.5`）。优先在画布内查找一个真实渲染的 `.dp-marker-icon` 元素，直接读其 `getBoundingClientRect().width`（浏览器已完成任意单位换算的最终 px 值）；画布内暂无独立 marker（比如全部被聚合，或接入方用 `#marker` 插槽完全自定义、不含 `.dp-marker-icon` 类名——例如消防监视页面）时，退化为创建一个隐藏探测元素、把 CSS 变量原始字符串赋给它的 `width` 再读取渲染结果，交给浏览器完成单位换算而不是自己写正则解析；两者都不可用则兜底默认值 32。

**告警等业务状态的可见性：** 组件的 `Device` 类型不理解"告警"概念。聚合圆点通过 `#cluster` 插槽把簇内成员（`{ device, placement }[]`）交给接入方，由接入方按自己的业务数据判断样式（见 PRD §3.2 的排除项）。

**点击聚合圆点聚焦（`focusRect`）：** 复用 `getBase()`（含 `left/top`）与已有的 `clampTranslate()`；目标 scale 取"让簇的归一化包围盒（`boundingBoxOf`）完整、居中进入可视区域"所需缩放比，双向 clamp 到 `[MIN_SCALE, MAX_SCALE]`——簇跨度极小时可能远超 `MAX_SCALE`，钳到上限即可，不要求必须贴边填满。`zoomable=false` 时跳过聚焦（否则会和 `useZoomPan` 里"`enabled=false` 强制复位"的既有逻辑打架），但仍抛出 `cluster-click`。聚焦触发的短暂 `state.focusing` 驱动 `.dp-bg-wrap.is-focusing` 的一次性 CSS transition，不做全局 transition（会拖累滚轮缩放/拖拽平移的即时手感）。

**双击复位冲突：** `onCanvasDblClick` 的目标排除判断从只排除 `.dp-marker` 扩展为同时排除 `.dp-cluster`，避免点击聚合圆点后被误判成双击空白而复位。

**已知的次要限制（不影响当前实际接入场景，未处理）：** 若接入方在运行时动态改变 `--dp-marker-size`（而非启动时静态声明），由于 CSS 变量变化本身不是 Vue 响应式依赖，聚合分组不会自动重算，需要一次额外的 `scale`/数据/容器尺寸变化才会带动它一起更新。当前所有实际接入页面均未有此动态切换场景。

---

## 7. 样式与主题方案

- 全部 scoped CSS，类名加前缀 `dp-`（device placement）防冲突；
- 可定制项通过 **CSS 变量**暴露，使用方覆盖即可改主题：

```css
.dp-root {
  --dp-primary-color: #2f80ed;     /* 主题/高亮色 */
  --dp-palette-width: 200px;       /* 左侧列表宽度 */
  --dp-marker-size: 32px;          /* 点位图标尺寸 */
  --dp-cluster-size: 36px;         /* 聚合圆点直径 */
  --dp-cluster-color: var(--dp-primary-color); /* 聚合圆点底色，默认复用主题色 */
  --dp-cluster-text-color: #fff;
  --dp-label-bg: rgba(0,0,0,.65);  /* 名称底色 */
  --dp-label-color: #fff;
  --dp-highlight-scale: 1.25;      /* 高亮放大倍数 */
}
```

- 样式打包成独立 `style.css`，使用方 `import 'vue-device-placement/style.css'`。

---

## 8. 打包与 npm 发布

**vite.config.ts（库模式要点）：**
```ts
build: {
  lib: {
    entry: 'src/index.ts',
    name: 'VueDevicePlacement',
    formats: ['es', 'umd'],
    fileName: (f) => `vue-device-placement.${f}.js`,
  },
  rollupOptions: {
    external: ['vue'],                 // 不把 vue 打进包
    output: { globals: { vue: 'Vue' } },
  },
}
// plugins: [vue(), dts({ rollupTypes: true })]
```

**package.json 关键字段：**
```jsonc
{
  "type": "module",
  "main": "./dist/vue-device-placement.umd.js",
  "module": "./dist/vue-device-placement.es.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "import": "./dist/...es.js", "require": "./dist/...umd.js", "types": "./dist/index.d.ts" },
    "./style.css": "./dist/style.css"
  },
  "files": ["dist"],
  "sideEffects": ["**/*.css"],
  "peerDependencies": { "vue": "^3.3.0" }
}
```

产物：`dist/` 下 ESM + UMD + `index.d.ts` + `style.css`。

---

## 9. 测试方案（只测核心逻辑）

用 Vitest 测 `src/core/` 的纯函数（不测 UI 交互）：

| 测试文件 | 覆盖 |
|----------|------|
| `coordinate.test.ts` | `toNormalized` 换算正确、越界被 `clamp01` 钳到 [0,1] |
| `placement.test.ts` | `upsert` 同 id 不新增只改坐标、`remove`、`isPlaced`、`sanitize` 过滤脏数据 |
| `cluster.test.ts` | `clusterize` 距离内合并/距离外不合并、`minCount` 边界、按种子距离而非链式传递、顺序敏感性、`radiusPx<=0` 兜底、空输入、坐标重合；`boundingBoxOf` 多点/单点/空数组 |

---

## 10. 演示页 / Playground（满足"我能看到数据"）

`playground/` 用 Vite dev 跑：左侧设备、中间底图、**右侧实时显示当前点位 JSON**：

```
┌────────┬──────────────┬──────────────┐
│ 设备列表 │   底图打点    │ placements   │
│        │              │ JSON 实时显示  │
└────────┴──────────────┴──────────────┘
```
拖一下、删一下，右侧 JSON 立即变化，方便你确认数据格式与内容、随时复制。

---

## 11. 风险与取舍

| 风险点 | 应对 |
|--------|------|
| 坐标换算（§6.2）是最易出错处 | 抽成纯函数 + 单测；点位渲染用百分比，天然自适应 |
| Pointer 自实现拖入需做浮层 | 一次性封装在 `useDrag`，逻辑集中 |
| 跨域图片 | 仅 DOM `<img>` 展示、不读像素，无 CORS 问题 |
| SSR/Nuxt 接入 | 代码不在模块顶层访问 `window/document`，DOM 操作放生命周期内 |

---

## 12. 开发拆解（里程碑）

| 阶段 | 内容 |
|------|------|
| M1 | 工程脚手架：Vite + TS + 库模式 + Vitest + 目录结构 |
| M2 | 类型定义 + `core/` 纯逻辑 + 单测 |
| M3 | 静态布局与渲染：Palette / Canvas / Marker + CSS 变量 |
| M4 | 拖拽：列表 → 画布（Pointer + 浮层 + 坐标换算） |
| M5 | 拖拽：画布内移动 + 边界 clamp |
| M6 | 删除× + 已放置状态 + 高亮联动（定时器） |
| M7 | slot 扩展 + 空状态 / 异常处理 |
| M8 | 打包配置 + d.ts + 演示页 |
| M9 | README + 发布演练（`npm pack` 自检） |

---

## 13. 待确认（技术层面）

1. **npm 包名**：默认用 `vue-device-placement`（与项目同名）。发布前需 `npm view` 确认未被占用。
2. **Vue peer 版本下限**：默认 `^3.3.0`，是否需要更低？
3. **是否需要兼容 SSR / Nuxt**：默认按客户端渲染设计（已做 window/document 访问保护），如需正式支持 Nuxt 再评估。
4. **PRD 遗留的 UI 视觉细节**（已放置样式、高亮表现、空状态文案）：建议开发到 M3/M6 时定稿。
