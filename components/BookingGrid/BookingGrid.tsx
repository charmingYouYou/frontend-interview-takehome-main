import React, { useState } from 'react'
import { Booking, RoomUnit } from '@/types'
import { useVisibleRange } from '@/hooks/useVisibleRange'
import { RoomRow, HoveredCell } from './RoomRow'
import { APP_CONFIG } from '@/lib/appConfig'
import styles from './BookingGrid.module.css'

const COLUMN_WIDTH_PX = 48
const TOTAL_DAYS = 30

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
 * 视觉规格：所有静态样式（颜色 / 间距 / 边框 / 字号）来自
 *         BookingGrid.module.css + tokens.css；仅以下两类值仍以 inline style
 *         注入：
 *           - 依赖 JS 常量的几何值：列宽 COLUMN_WIDTH_PX、主体最小宽度
 *             TOTAL_DAYS * COLUMN_WIDTH_PX + 140；
 *           - 来自 APP_CONFIG 的动态背景色 bookingHeaderBackground。
 */
export function BookingGrid({ roomUnits, bookings, onBookingClick }: BookingGridProps) {
  const { visibleRange, handleScroll } = useVisibleRange()
  const [hoveredCell, setHoveredCell] = useState<HoveredCell | null>(null)

  const startDate = new Date().toISOString().split('T')[0]
  const dayLabels = getDayLabels(startDate, TOTAL_DAYS)

  return (
    <div className={styles.root}>
      {/* Header row */}
      <div className={styles.header}>
        <div
          className={styles.headerLabel}
          style={{ background: APP_CONFIG.bookingHeaderBackground }}
        >
          Room
        </div>
        <div
          className={styles.headerDays}
          style={{ background: APP_CONFIG.bookingHeaderBackground }}
        >
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
        <div style={{ minWidth: TOTAL_DAYS * COLUMN_WIDTH_PX + 140 }}>
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
                dateRangeStart={APP_CONFIG.dateRangeStart}
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
