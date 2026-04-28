export interface RoomUnit {
  id: string
  name: string
  roomTypeId: string
  roomTypeName: string
}

import { BookingStatus } from '@/lib/bookingStatus'

// BookingStatus 枚举与展示元数据已下沉至 lib/bookingStatus.ts；此处仅 re-export，
// 保持下游 `import { BookingStatus } from '@/types'` 调用路径稳定。
export { BookingStatus }

export interface Booking {
  id: string
  roomUnit: {
    roomId: string
    name: string
  }
  guestName: string
  checkIn: string
  checkOut: string
  status: BookingStatus
  totalAmount: number
  notes?: string
}

export interface BookingDetail extends Booking {
  guestEmail: string
  guestPhone: string
  source: string
  specialRequests: string
  paymentStatus: string
  createdAt: string
}

export interface Ticket {
  id: string
  subject: string
  guestName: string
  houseId: string
  houseName: string
  unread: boolean
  lastMessage: string
  updatedAt: string
}

/**
 * Booking 网格配置类型。
 *
 * 收敛 Booking 时间网格相关的所有运行时常量与视觉配置：日历窗口范围、
 * 列宽 / 标签列宽、虚拟滚动可视列数、表头背景。被 lib/bookingConfig 中
 * 的 BOOKING_CONFIG 单例消费，组件 / hook 不再各自维护魔法数字。
 *
 * 字段命名遵循常量命名规范（UPPER_SNAKE_CASE）：本接口及对应单例承载
 * 的均为编译期已知、运行时不可变的配置量，使用大写字段名让消费方在
 * 阅读处即可识别"这是配置常量"，与组件内部状态字段（驼峰）形成视觉
 * 区分，降低误改风险。
 *
 * 字段：
 * - DATE_RANGE_START / DATE_RANGE_END：日历可视窗口的起止 ISO 日期。
 * - COLUMN_WIDTH_PX：单日列宽（px）。
 * - LABEL_COLUMN_WIDTH_PX：左侧房型标签列宽（px），参与主体 minWidth 计算。
 * - TOTAL_DAYS：日历窗口总列数（虚拟滚动的逻辑总长度）。
 * - VISIBLE_COLUMNS：单屏渲染的日列数（横向虚拟化视窗大小）。
 *
 * 注：表头背景色已下沉到 token 层 --color-bg-booking-header，由
 * BookingGrid.module.css 直接消费，不再保留为 JS 配置字段。
 */
export interface BookingConfig {
  DATE_RANGE_START: string
  DATE_RANGE_END: string
  COLUMN_WIDTH_PX: number
  LABEL_COLUMN_WIDTH_PX: number
  /**
   * 行视觉占位高度（"行 stride"）的 SSR / 首帧 fallback。
   *
   * 多 lane 改造后，每个 RoomRow 的实际 stride = laneCount × LANE_HEIGHT_PX
   * + .row border-bottom，由 BookingGrid 在 useMemo 内累积 rowTopByRoomId；
   * 本字段仅作为单 lane 行的 SSR fallback 与历史兼容值保留。
   */
  ROW_HEIGHT_PX: number
  /**
   * 单条 lane（泳道）的内容高度（px），与 styles/tokens.css 的
   * --size-row-height 保持一致。多 lane 行的视觉高度 = laneCount ×
   * LANE_HEIGHT_PX，bar 在行内的纵向坐标按 lane 索引乘以本值递推：
   * `top = rowTop + laneIndex × LANE_HEIGHT_PX + BAR_OFFSET_TOP_PX`。
   */
  LANE_HEIGHT_PX: number
  /**
   * 预订条 bar 在行内的纵向偏移（px），与 token --size-bar-offset-top 对齐。
   * 由 GridBookingBars 在 inline top 内累加（top = rowIndex × ROW_HEIGHT_PX
   * + BAR_OFFSET_TOP_PX）；不能用 .barsLayer 的 padding-top 替代，因为
   * absolute 子元素 top:0 参照 padding box 顶边，padding-top 不会下推。
   */
  BAR_OFFSET_TOP_PX: number
  TOTAL_DAYS: number
  VISIBLE_COLUMNS: number
}
