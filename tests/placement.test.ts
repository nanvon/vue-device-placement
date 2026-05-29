import { describe, it, expect } from 'vitest'
import {
  isPlaced,
  upsertPlacement,
  removePlacement,
  sanitizePlacements,
} from '../src/core/placement'
import type { Device, Placement } from '../src/types'

const devices: Device[] = [
  { id: 'a', name: '设备A', icon: 'a.png' },
  { id: 'b', name: '设备B', icon: 'b.png' },
]

describe('isPlaced', () => {
  it('存在该 deviceId 返回 true', () => {
    expect(isPlaced([{ deviceId: 'a', x: 0.1, y: 0.1 }], 'a')).toBe(true)
  })
  it('不存在返回 false', () => {
    expect(isPlaced([], 'a')).toBe(false)
    expect(isPlaced([{ deviceId: 'b', x: 0.1, y: 0.1 }], 'a')).toBe(false)
  })
})

describe('upsertPlacement', () => {
  it('新设备追加一条', () => {
    const r = upsertPlacement([], 'a', 0.2, 0.3)
    expect(r).toEqual([{ deviceId: 'a', x: 0.2, y: 0.3 }])
  })

  it('已存在时只更新坐标、不新增（一设备一点位）', () => {
    const list: Placement[] = [{ deviceId: 'a', x: 0.1, y: 0.1 }]
    const r = upsertPlacement(list, 'a', 0.8, 0.9)
    expect(r).toHaveLength(1)
    expect(r[0]).toEqual({ deviceId: 'a', x: 0.8, y: 0.9 })
  })

  it('保持其余点位不变、追加在末尾', () => {
    const list: Placement[] = [{ deviceId: 'a', x: 0.1, y: 0.1 }]
    const r = upsertPlacement(list, 'b', 0.5, 0.5)
    expect(r).toEqual([
      { deviceId: 'a', x: 0.1, y: 0.1 },
      { deviceId: 'b', x: 0.5, y: 0.5 },
    ])
  })

  it('返回新数组，不修改入参（单向数据流）', () => {
    const list: Placement[] = [{ deviceId: 'a', x: 0.1, y: 0.1 }]
    const r = upsertPlacement(list, 'b', 0.5, 0.5)
    expect(r).not.toBe(list)
    expect(list).toHaveLength(1)
  })
})

describe('removePlacement', () => {
  it('删除指定设备的点位', () => {
    const list: Placement[] = [
      { deviceId: 'a', x: 0.1, y: 0.1 },
      { deviceId: 'b', x: 0.2, y: 0.2 },
    ]
    expect(removePlacement(list, 'a')).toEqual([{ deviceId: 'b', x: 0.2, y: 0.2 }])
  })

  it('删除不存在的 id 返回等价数组', () => {
    const list: Placement[] = [{ deviceId: 'a', x: 0.1, y: 0.1 }]
    expect(removePlacement(list, 'x')).toEqual(list)
  })
})

describe('sanitizePlacements', () => {
  it('过滤设备清单中不存在的 id', () => {
    const list: Placement[] = [
      { deviceId: 'a', x: 0.1, y: 0.1 },
      { deviceId: 'ghost', x: 0.2, y: 0.2 },
    ]
    expect(sanitizePlacements(list, devices)).toEqual([{ deviceId: 'a', x: 0.1, y: 0.1 }])
  })

  it('去重同一 deviceId，仅保留第一条', () => {
    const list: Placement[] = [
      { deviceId: 'a', x: 0.1, y: 0.1 },
      { deviceId: 'a', x: 0.9, y: 0.9 },
    ]
    expect(sanitizePlacements(list, devices)).toEqual([{ deviceId: 'a', x: 0.1, y: 0.1 }])
  })

  it('clamp 越界坐标到 [0,1]', () => {
    const list: Placement[] = [{ deviceId: 'a', x: -1, y: 2 }]
    expect(sanitizePlacements(list, devices)).toEqual([{ deviceId: 'a', x: 0, y: 1 }])
  })

  it('空输入返回空数组', () => {
    expect(sanitizePlacements([], devices)).toEqual([])
  })
})
