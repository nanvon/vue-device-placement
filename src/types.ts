/**
 * 设备（实例）：一台具体、唯一的设备。
 */
export interface Device {
  /** 唯一标识，作为点位的关联键（一设备一点位） */
  id: string
  /** 设备名称，显示在点位图标上方 */
  name: string
  /** 设备图标的图片 URL */
  icon: string
  /** 设备分类（预留字段，本期不用于分组） */
  type?: string
}

/**
 * 点位：一个设备被摆放在底图上的位置标记。
 * 坐标使用相对底图的归一化比例（0~1），与屏幕/容器尺寸无关。
 */
export interface Placement {
  /** 关联设备 id（唯一，对应"一设备一点位"） */
  deviceId: string
  /** 横向相对位置，取值 0~1 */
  x: number
  /** 纵向相对位置，取值 0~1 */
  y: number
}

/** 归一化坐标点 */
export interface Point {
  x: number
  y: number
}
