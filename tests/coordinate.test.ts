import { describe, it, expect } from 'vitest'
import { clamp01, toNormalized } from '../src/core/coordinate'

describe('clamp01', () => {
  it('区间内的值保持不变', () => {
    expect(clamp01(0)).toBe(0)
    expect(clamp01(0.5)).toBe(0.5)
    expect(clamp01(1)).toBe(1)
  })

  it('小于 0 钳到 0', () => {
    expect(clamp01(-0.3)).toBe(0)
    expect(clamp01(-100)).toBe(0)
  })

  it('大于 1 钳到 1', () => {
    expect(clamp01(1.8)).toBe(1)
    expect(clamp01(100)).toBe(1)
  })

  it('NaN 归 0', () => {
    expect(clamp01(Number.NaN)).toBe(0)
  })
})

describe('toNormalized', () => {
  const rect = { left: 100, top: 50, width: 200, height: 400 }

  it('正常换算为相对比例', () => {
    expect(toNormalized(200, 250, rect)).toEqual({ x: 0.5, y: 0.5 })
    expect(toNormalized(100, 50, rect)).toEqual({ x: 0, y: 0 })
    expect(toNormalized(300, 450, rect)).toEqual({ x: 1, y: 1 })
  })

  it('越界坐标被 clamp 到 [0,1]', () => {
    expect(toNormalized(0, 0, rect)).toEqual({ x: 0, y: 0 })
    expect(toNormalized(1000, 1000, rect)).toEqual({ x: 1, y: 1 })
  })

  it('零尺寸不除零，返回原点', () => {
    expect(toNormalized(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ x: 0, y: 0 })
  })
})
