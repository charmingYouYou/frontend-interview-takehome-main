import React, { useMemo } from 'react'
import { Booking, RoomUnit } from '@/types'
import { useVisibleRange } from '@/hooks/useVisibleRange'
import { RoomRow } from './RoomRow'
import { BOOKING_CONFIG } from '@/lib/bookingConfig'
import { buildDayLabels } from '@/lib/date'
import styles from './BookingGrid.module.css'

interface BookingGridProps {
  roomUnits: RoomUnit[]
  bookings: Booking[]
  onBookingClick: (booking: Booking) => void
}

// 模块级常量空数组，作为 Map.get 未命中的兜底；保持引用稳定避免破坏
// RoomRow 的 React.memo 浅比较。
const EMPTY_BOOKINGS: Booking[] = []

/**
 * BookingGrid：预订时间网格的顶层容器。
 *
 * 职责：组合表头（房型槽 + 日期列）与滚动主体（多个 RoomRow），并通过
 *       useVisibleRange 维护可视窗口供 BookingBars 数据层做窗口过滤。
 * 滚动模型：整个网格只有一个滚动容器 `.body`，表头 `.header` 与全部
 *          RoomRow 同处于 `.body` 内层 wrapper（以 `minWidth` 撑出全宽），
 *          通过 `position: sticky` 实现首行（top:0）/ 首列（left:0）双向
 *          吸附 —— 横滚时表头日期列与下方日格自然对齐、纵滚时房型标签
 *          始终可见。原"双 scroll container 隔离 + 手动同步 scrollLeft"
 *          的双源结构彻底消失，`.headerDays` 也不再需要 overflow:hidden。
 * 表头渲染口径：表头日期列改为按 TOTAL_DAYS 全量渲染，与第 14 条 DayCells
 *          的全量策略对齐；`useVisibleRange` 不再驱动表头视图，仅供
 *          BookingBars 数据层过滤使用。
 * 重渲染抑制：bookings 全集按 roomId 一次性 useMemo 分桶为 Map，每行
 *          通过 `bookingsByRoom.get(room.id)` 拿到引用稳定的子集；当
 *          bookings / roomUnits 未变（如滚动场景）时全部 RoomRow 的
 *          bookings prop 引用稳定，配合 RoomRow 的 React.memo 浅比较
 *          整体跳过；从 O(N×M) 重复 filter 收敛为单次 O(M) 分桶。
 * 状态归属：本组件不再持有任何 hover 相关 React 状态 —— 行 / 日格 hover
 *          已彻底下沉到 CSS `:hover` 伪类，鼠标进出网格不会触发任何
 *          setState 与重渲染链路。
 * 配置来源：列宽 / 标签列宽 / 总天数 / 表头背景 / 日期窗口起点全部从
 *          BOOKING_CONFIG 读取（字段使用常量命名规范 UPPER_SNAKE_CASE），
 *          本组件不再保留任何魔法数字；同名字段以驼峰 props 显式透传给
 *          RoomRow，保持子组件接口稳定，便于复用与单测。
 * 视觉规格：所有静态样式（颜色 / 间距 / 边框 / 字号 / 表头背景 / sticky
 *          层级）来自 BookingGrid.module.css + tokens.css；仅依赖 JS 常量
 *          的几何值（列宽 COLUMN_WIDTH_PX、内层 wrapper 最小宽度
 *          TOTAL_DAYS * COLUMN_WIDTH_PX + LABEL_COLUMN_WIDTH_PX）仍以
 *          inline style 注入。
 */
export function BookingGrid({ roomUnits, bookings, onBookingClick }: BookingGridProps) {
  const { visibleRange, handleScroll } = useVisibleRange()

  const {
    COLUMN_WIDTH_PX,
    LABEL_COLUMN_WIDTH_PX,
    TOTAL_DAYS,
    DATE_RANGE_START,
  } = BOOKING_CONFIG
  const dayLabels = buildDayLabels(DATE_RANGE_START, TOTAL_DAYS)

  // 按 roomId 分桶：单次 O(M) 遍历建立 roomId → Booking[] 索引，避免
  // 在 roomUnits.map 内联 filter 触发 O(N×M) 重复扫描；同时保证子集
  // 数组引用跨帧稳定，让 RoomRow 的 React.memo 真正生效。
  const bookingsByRoom = useMemo(() => {
    const map = new Map<string, Booking[]>()
    for (const room of roomUnits) {
      map.set(room.id, [])
    }
    for (const booking of bookings) {
      const bucket = map.get(booking.roomUnit.roomId)
      if (bucket) bucket.push(booking)
    }
    return map
  }, [bookings, roomUnits])

  return (
    <div className={styles.root}>
      {/* 唯一滚动容器：表头与所有 RoomRow 同处其中，通过 sticky 实现首行 / 首列吸附 */}
      <div className={styles.body} onScroll={handleScroll}>
        <div
          className={styles.inner}
          style={{ minWidth: TOTAL_DAYS * COLUMN_WIDTH_PX + LABEL_COLUMN_WIDTH_PX }}
        >
          {/* Header row：sticky top:0 */}
          <div className={styles.header}>
            <div className={styles.headerLabel}>Room</div>
            <div className={styles.headerDays}>
              {Array.from({ length: TOTAL_DAYS }, (_, dayIndex) => (
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
              ))}
            </div>
          </div>

          {/* 房型行 */}
          {roomUnits.map(room => (
            <RoomRow
              key={room.id}
              rowId={room.id}
              rowName={room.name}
              bookings={bookingsByRoom.get(room.id) ?? EMPTY_BOOKINGS}
              visibleStartIndex={visibleRange.startIndex}
              visibleEndIndex={visibleRange.endIndex}
              totalDays={TOTAL_DAYS}
              columnWidthPx={COLUMN_WIDTH_PX}
              dateRangeStart={DATE_RANGE_START}
              onBookingClick={onBookingClick}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
