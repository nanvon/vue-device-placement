<h1 align="center">vue-device-placement</h1>

<p align="center">
  A device placement and annotation component for Vue 3. Mark device locations on floor plans via drag-and-drop, output resolution-independent normalized coordinates, with built-in pan/zoom, highlight synchronization, and read-only marker clustering.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/vue-device-placement"><img src="https://img.shields.io/npm/v/vue-device-placement?color=blue" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/vue-device-placement"><img src="https://img.shields.io/npm/dm/vue-device-placement" alt="npm downloads"></a>
  <a href="https://github.com/nanvon/vue-device-placement/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-orange" alt="License"></a>
  <img src="https://img.shields.io/badge/Vue-3.3+-42b883?logo=vue.js&logoColor=white" alt="Vue 3.3+">
  <img src="https://img.shields.io/badge/dependencies-0-brightgreen" alt="Zero Dependencies">
</p>

<p align="center">
  <a href="#-installation">Installation</a> •
  <a href="#-quickstart">Quickstart</a> •
  <a href="#-features">Features</a> •
  <a href="#-component-api">Component API</a> •
  <a href="#-data-structures">Data Structures</a> •
  <a href="#-styling">Styling</a> •
  <a href="README.md">简体中文</a>
</p>

```text
┌──────────────┬──────────────────────────────────────────┐
│  Palette     │              Floor Plan Canvas           │
│  □ Hydrant-01│                                          │
│  □ Door-East │         [📷] Camera-Lobby                │
│  ▣ Camera-01 │           ▲ Marker pinned on floor plan  │
│  ▣ Inverter-A│                                          │
│   … (scroll) │         [⚡] Inverter-01                 │
└──────────────┴──────────────────────────────────────────┘
      Sidebar                     Canvas Stage
   □ Idle  ▣ Placed          Pan / Zoom / Clustering
```

---

## 📦 Installation

Install via your preferred package manager:

```bash
npm install vue-device-placement
# or using pnpm
pnpm add vue-device-placement
# or using yarn
yarn add vue-device-placement
```

> [!NOTE]
> This package requires Vue 3 in the host application (`peerDependencies: vue ^3.3.0`) and has zero third-party runtime dependencies.

---

## 🚀 Quickstart

### Minimal Single File Component (<15 lines)

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { DevicePlacement, type Device, type Placement } from 'vue-device-placement'
import 'vue-device-placement/style.css'

const devices = ref<Device[]>([{ id: 'cam-1', name: 'Lobby Camera', icon: '/camera.svg' }])
const placements = ref<Placement[]>([])
</script>

<template>
  <DevicePlacement :devices="devices" background="/floor.png" v-model:placements="placements" />
</template>
```

### Global Plugin Registration

Register the component globally in your application entry:

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

## ✨ Features

- **Normalized Relative Coordinates** — Coordinates are stored as `[0, 1]` relative ratios against the background image dimensions, remaining resolution-independent and aligned across window resizing or container layout shifts.
- **One-Device-One-Marker Invariant** — Enforced by the core pure function `upsertPlacement` to guarantee unique association per `deviceId`; handles palette drag-ins, in-canvas repositioning, and cross-boundary moves.
- **Zero Third-Party Runtime Dependencies** — Declares only `vue` (`^3.3.0`) as peerDependency, bundling no external drag libraries, charting engines, or heavy math dependencies.
- **Hardware-Accelerated DOM & CSS Rendering** — Built on native DOM and CSS 2D Transforms for canvas pan and zoom, with inverse scaling on markers to keep constant physical pixel size (map-pin effect).
- **Viewport Pan and Zoom Navigation** — Supports cursor-centered wheel zooming (1x to 5x), blank-area drag-to-pan, and double-click to reset; easily disabled via `zoomable`.
- **Adaptive Marker Clustering** — Built-in Euclidean greedy clustering in `readonly` mode automatically groups crowded markers into circular count badges, with auto-calculated bounding box zooming on click.
- **100% Local Calculation & Zero Telemetry** — Coordinate transforms, clustering, and data sanitization execute entirely client-side, with zero external network requests or tracking telemetry.
- **Dual Output Streams & Sanitization** — Emits full reactive arrays (`v-model:placements`) for bulk updates alongside granular semantic events (`place` / `move` / `remove`); includes `sanitizePlacements` to filter unknown IDs and clamp out-of-bound values.

---

## 📋 Component API

### Props

| Prop | Type | Required | Default | Description |
| :--- | :--- | :---: | :---: | :--- |
| `devices` | `Device[]` | Yes | — | Complete collection of device instances driving sidebar and canvas rendering |
| `background` | `string` | Yes | — | Background floor plan image URL |
| `placements` | `Placement[]` | No | `[]` | Placements array, synchronized via `v-model:placements` |
| `selected` | `string \| null` | No | `null` | Currently selected device ID, synchronized via `v-model:selected` |
| `highlightDuration` | `number` | No | `3000` | Highlight auto-clear timeout in milliseconds |
| `readonly` | `boolean` | No | `false` | Read-only mode; disables drag interactions and delete buttons |
| `zoomable` | `boolean` | No | `true` | Enables canvas wheel zooming, drag-to-pan, and double-click reset |
| `cluster` | `boolean` | No | `false` | Enables marker clustering (effective only when `readonly=true`) |
| `paletteTree` | `PaletteNode[]` | No | `undefined` | Hierarchy tree for the palette; renders indented tree when provided, flat list otherwise |

### Emits

| Event | Payload | Trigger Condition & Purpose |
| :--- | :--- | :--- |
| `update:placements` | `(value: Placement[])` | Emitted whenever placements change, returning sanitized array (bulk save) |
| `update:selected` | `(id: string \| null)` | Emitted when selected device changes |
| `place` | `(deviceId: string, pos: { x: number; y: number })` | Emitted when a new marker is dropped onto canvas (incremental save) |
| `move` | `(deviceId: string, pos: { x: number; y: number })` | Emitted when an existing marker is moved on canvas (incremental save) |
| `remove` | `(deviceId: string)` | Emitted when a marker delete button is clicked (incremental save) |
| `cluster-click` | `(payload: { members: ClusterMember[] })` | Emitted when a cluster dot is clicked, providing all member devices |

### Slots

| Slot Name | Scope Parameters | Description |
| :--- | :--- | :--- |
| `#marker` | `{ device: Device, placement: Placement, selected: boolean }` | Fully customize the canvas marker DOM structure |
| `#icon` | `{ device: Device, selected: boolean }` | Customize the marker icon while preserving the label and delete button |
| `#device-item` | `{ device: Device, placed: boolean, depth: number }` | Customize sidebar list items (`depth` indicates tree nesting depth) |
| `#palette-empty` | — | Empty state content when device list is empty |
| `#empty` | — | Empty state content when background image is missing or fails to load |
| `#cluster` | `{ members: ClusterMember[], count: number }` | Customize cluster badge styling |

---

## 📐 Data Structures

### Core Type Definitions

```ts
/** Single device instance */
export interface Device {
  id: string          // Unique identifier, used as the placement key
  name: string        // Display name for tooltips and labels
  icon: string        // Device icon image URL
  type?: string       // Category identifier (reserved)
}

/** Marker placement data (normalized relative coordinates) */
export interface Placement {
  deviceId: string    // Associated device ID (one marker per device)
  x: number           // Horizontal relative position (0.0 to 1.0)
  y: number           // Vertical relative position (0.0 to 1.0)
}

/** Hierarchy tree node for the palette */
export interface PaletteNode {
  deviceId: string
  children?: PaletteNode[]
}

/** Cluster member element */
export interface ClusterMember {
  device: Device
  placement: Placement
}
```

### Placement JSON Output

```json
[
  { "deviceId": "cam-01", "x": 0.324, "y": 0.581 },
  { "deviceId": "inverter-01", "x": 0.760, "y": 0.402 }
]
```

### Exported Pure Utility Functions

For advanced scenarios requiring coordinate or placement processing outside Vue components:

```ts
import {
  clamp01,             // Clamps any numeric value to [0, 1]
  toNormalized,        // Converts viewport client coordinates to normalized coordinates
  upsertPlacement,     // Updates or appends a placement (enforcing single-device uniqueness)
  removePlacement,     // Removes placement by device ID
  sanitizePlacements,  // Validates, dedupes, and clamps placement data
  clusterize,          // Greedy Euclidean distance clustering
  boundingBoxOf,       // Calculates minimal bounding box for a set of points
} from 'vue-device-placement'
```

---

## 🎨 Styling

All visual aesthetics are structured using customizable CSS variables on `.dp-root`:

```css
.dp-root {
  --dp-primary-color: #2f80ed;     /* Accent and selected highlight color */
  --dp-palette-width: 200px;       /* Sidebar palette width */
  --dp-marker-size: 32px;          /* Marker icon size */
  --dp-cluster-size: 36px;         /* Cluster dot diameter */
  --dp-cluster-color: #2f80ed;     /* Cluster dot background */
  --dp-cluster-text-color: #fff;   /* Cluster dot text color */
  --dp-label-max-width: 96px;      /* Marker label maximum width */
  --dp-label-bg: rgba(0, 0, 0, .65);/* Marker label background */
  --dp-label-color: #ffffff;       /* Marker label text color */
  --dp-highlight-scale: 1.25;      /* Selected marker scale ratio */
  --dp-height: 480px;              /* Overall component height */
  --dp-indent: 16px;               /* Indentation per tree level */
  --dp-radius: 6px;                /* Border radius */
  --dp-canvas-bg: #f3f4f6;         /* Canvas background */
  --dp-palette-bg: #fafafa;        /* Sidebar background */
}
```

---

## 🔒 Privacy and Security

| Mechanism | Technical Fact | Security Assurance |
| :--- | :---: | :--- |
| **Computation Engine** | 100% Client-side in browser | Coordinate mapping, bounds clamping, and clustering execute locally |
| **Data Telemetry** | Zero network telemetry | No tracking SDKs or outbound network calls are present in the package |
| **Resource Access** | Read-only image URLs | Images are loaded solely via standard browser `<img>` rendering tags |

---

## 💻 Development

```bash
# Install dependencies
npm install

# Start local Playground demo server
npm run dev

# Run unit tests for core algorithms
npm test

# Build type declarations and production bundles
npm run build
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
