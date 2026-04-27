import React, { useState } from 'react'
import { Booking, RoomUnit } from '@/types'
import { useVisibleRange } from '@/hooks/useVisibleRange'
import { RoomRow, HoveredCell } from './RoomRow'
import { BOOKING_CONFIG } from '@/lib/bookingConfig'
import styles from './BookingGrid.module.css'

interface BookingGridProps {
  roomUnits: RoomUnit[]
  bookings: Booking[]
  onBookingClick: (booking: Booking) => void
}

/**
 * 根据起始日期生成 totalDays 个 "M/D" 形式的日期标签。
 *
 * 输入：ISO 格式起始日期字符串、需要生成的天数。
 * 输出：长度为 totalDays 的字符串数组，按日递增。
 * 副作用：无。
 */
function getDayLabels(startDate: string, totalDays: number): string[] {
  return Array.from({ length: totalDays }, (_, i) => {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    return `${d.getMonth() + 1}/${d.getDate()}`
  })
}

/**
 * BookingGrid：预订时间网格的顶层容器。
 *
 * 职责：组合表头（房型槽 + 日期列）与滚动主体（多个 RoomRow），并通过
 *       useVisibleRange 驱动横向虚拟化（仅渲染可视范围内的日期列与预订条）。
 * 状态归属：cell hover 状态（hoveredCell）仅在 Grid 内部跨 RoomRow 共享，
 *          以本地 useState 维护并通过 props 透传，避免提升至全局 Context
 *          污染无关页面的渲染链路。
 * 配置来源：列宽 / 标签列宽 / 总天数 / 表头背景 / 日期窗口起点全部从
 *          BOOKING_CONFIG 读取（字段使用常量命名规范 UPPER_SNAKE_CASE），
 *          本组件不再保留任何魔法数字；同名字段以驼峰 props 显式透传给
 *          RoomRow，保持子组件接口稳定，便于复用与单测。
 * 视觉规格：所有静态样式（颜色 / 间距 / 边框 / 字号 / 表头背景）来自
 *         BookingGrid.module.css + tokens.css；仅依赖 JS 常量的几何值
 *         （列宽 COLUMN_WIDTH_PX、主体最小宽度
 *         TOTAL_DAYS * COLUMN_WIDTH_PX + LABEL_COLUMN_WIDTH_PX）仍以
 *         inline style 注入。原 BOOKING_HEADER_BACKGROUND 已迁移至 token
 *         层 --color-bg-booking-header，组件层不再持有此色值。
 */
export function BookingGrid({ roomUnits, bookings, onBookingClick }: BookingGridProps) {
  const { visibleRange, handleScroll } = useVisibleRange()
  const [hoveredCell, setHoveredCell] = useState<HoveredCell | null>(null)

  const {
    COLUMN_WIDTH_PX,
    LABEL_COLUMN_WIDTH_PX,
    TOTAL_DAYS,
    DATE_RANGE_START,
  } = BOOKING_CONFIG
  const dayLabels = getDayLabels(DATE_RANGE_START, TOTAL_DAYS)

  return (
    <div className={styles.root}>
      {/* Header row */}
      <div className={styles.header}>
        <div className={styles.headerLabel}>
          Room
        </div>
        <div className={styles.headerDays}>
          {Array.from({ length: visibleRange.endIndex - visibleRange.startIndex + 1 }, (_, i) => {
            const dayIndex = visibleRange.startIndex + i
            if (dayIndex >= TOTAL_DAYS) return null
            return (
              <div
                key={dayIndex}
                className={styles.headerDay}
                style={{
                  width: COLUMN_WIDTH_PX,
                  minWidth: COLUMN_WIDTH_PX,
                }}
              >
                {dayLabels[dayIndex]}
              </div>
            )
          })}
        </div>
      </div>

      {/* Scrollable grid body */}
      <div
        className={styles.body}
        onScroll={handleScroll}
      >
        <div style={{ minWidth: TOTAL_DAYS * COLUMN_WIDTH_PX + LABEL_COLUMN_WIDTH_PX }}>
          {roomUnits.map(room => {
            const roomBookings = bookings.filter(
              b => b.roomUnit.roomId === room.id
            )
            return (
              <RoomRow
                key={room.id}
                rowId={room.id}
                rowName={room.name}
                bookings={roomBookings}
                visibleStartIndex={visibleRange.startIndex}
                visibleEndIndex={visibleRange.endIndex}
                totalDays={TOTAL_DAYS}
                columnWidthPx={COLUMN_WIDTH_PX}
                dateRangeStart={DATE_RANGE_START}
                hoveredCell={hoveredCell}
                onHoverCell={setHoveredCell}
                onBookingClick={onBookingClick}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
