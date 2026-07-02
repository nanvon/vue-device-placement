import { describe, it, expect } from 'vitest'
import { clusterize, boundingBoxOf } from '../src/core/cluster'

describe('clusterize', () => {
  it('两点距离在半径内且达到 minCount 时合并为一簇', () => {
    const result = clusterize(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 10, y: 0 },
      ],
      { radiusPx: 20, minCount: 2 },
    )
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('cluster:a')
    expect(result[0].items.map((i) => i.id)).toEqual(['a', 'b'])
    expect(result[0].x).toBe(0)
    expect(result[0].y).toBe(0)
  })

  it('两点距离超出半径时保持独立', () => {
    const result = clusterize(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 100, y: 0 },
      ],
      { radiusPx: 20, minCount: 2 },
    )
    expect(result).toHaveLength(2)
    expect(result.map((g) => g.id)).toEqual(['a', 'b'])
    expect(result.every((g) => g.items.length === 1)).toBe(true)
  })

  it('簇内成员数小于 minCount 时不合并，各自独立返回', () => {
    const result = clusterize(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 5, y: 0 },
      ],
      { radiusPx: 20, minCount: 3 },
    )
    expect(result).toHaveLength(2)
    expect(result.every((g) => g.items.length === 1)).toBe(true)
  })

  it('按种子距离判断而非链式传递：A-B 近、B-C 近但 A-C 远时不会被强行并成一簇', () => {
    // A(0,0) - B(15,0) 距离15 <= 半径20；B(15,0) - C(30,0) 距离15 <= 半径20；A-C 距离30 > 半径20
    // 以 A 为种子扫描时，B 在半径内被并入，C 到 A 的距离超出半径，不应被并入 A 的簇
    const result = clusterize(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 15, y: 0 },
        { id: 'c', x: 30, y: 0 },
      ],
      { radiusPx: 20, minCount: 2 },
    )
    const clusterGroup = result.find((g) => g.items.length > 1)
    expect(clusterGroup).toBeDefined()
    expect(clusterGroup!.items.map((i) => i.id)).toEqual(['a', 'b'])
    const cGroup = result.find((g) => g.id === 'c')
    expect(cGroup).toBeDefined()
    expect(cGroup!.items).toHaveLength(1)
  })

  it('分组结果与输入顺序相关：种子选取按数组顺序', () => {
    const result = clusterize(
      [
        { id: 'b', x: 15, y: 0 },
        { id: 'a', x: 0, y: 0 },
      ],
      { radiusPx: 20, minCount: 2 },
    )
    expect(result).toHaveLength(1)
    // 种子是数组里第一个出现的点，即 'b'
    expect(result[0].id).toBe('cluster:b')
  })

  it('radiusPx 为 0 或负数时，所有点各自独立', () => {
    const result = clusterize(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 1, y: 0 },
      ],
      { radiusPx: 0, minCount: 2 },
    )
    expect(result).toHaveLength(2)
    expect(result.every((g) => g.items.length === 1)).toBe(true)
  })

  it('空数组输入返回空数组', () => {
    expect(clusterize([], { radiusPx: 20, minCount: 2 })).toEqual([])
  })

  it('坐标完全重合的多点在 minCount 达标时合并为一簇', () => {
    const result = clusterize(
      [
        { id: 'a', x: 5, y: 5 },
        { id: 'b', x: 5, y: 5 },
        { id: 'c', x: 5, y: 5 },
      ],
      { radiusPx: 10, minCount: 2 },
    )
    expect(result).toHaveLength(1)
    expect(result[0].items).toHaveLength(3)
  })
})

describe('boundingBoxOf', () => {
  it('计算多点的最小/最大边界', () => {
    const box = boundingBoxOf([
      { x: 0.2, y: 0.5 },
      { x: 0.8, y: 0.1 },
      { x: 0.4, y: 0.9 },
    ])
    expect(box).toEqual({ minX: 0.2, minY: 0.1, maxX: 0.8, maxY: 0.9 })
  })

  it('单点输入时 min 等于 max', () => {
    const box = boundingBoxOf([{ x: 0.3, y: 0.6 }])
    expect(box).toEqual({ minX: 0.3, minY: 0.6, maxX: 0.3, maxY: 0.6 })
  })

  it('空数组输入返回全 0', () => {
    expect(boundingBoxOf([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 })
  })
})
